// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import { SepoliaZamaFHEVMConfig } from "fhevm/config/ZamaFHEVMConfig.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ConfidentialPayToken.sol";

interface ICipherRollFactory {
    function registerInvite(bytes32 codeHash) external;
}

/**
 * @title  ConfidentialPayroll
 * @notice One instance per employer (deployed by CipherRollFactory).
 *         Salaries are stored as FHE ciphertexts — only employer + each
 *         employee can decrypt their own value.
 *
 *  Flow:
 *   1. employer.createInvite(codeHash, name, dept) — share plaintext code off-chain
 *   2. employee.claimInvite(code) — registers their wallet
 *   3. employer.setSalary(addr, encSalary, proof) — activates employee
 *   4. employer.executePayroll() — pays everyone with encrypted transfers
 *   5. employee.getMySalaryHandle() + fhevmjs reencrypt → decrypts locally
 */
contract ConfidentialPayroll is SepoliaZamaFHEVMConfig, Ownable, ReentrancyGuard {

    enum Status { None, Pending, Active, Inactive }

    struct Employee {
        Status   status;
        bool     salarySet;
        euint64  encryptedSalary;
        uint256  claimedAt;
        uint256  lastPaidAt;
        uint256  totalPayments;
        string   name;
        string   department;
    }

    struct InviteRecord {
        bool    exists;
        address claimedBy;
        string  name;
        string  department;
        uint256 createdAt;
    }

    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────

    ConfidentialPayToken  public immutable paymentToken;
    ICipherRollFactory    public immutable factory;

    string   public companyName;
    uint256  public currentCycle;

    mapping(address => Employee)    private _employees;
    address[]                       private _employeeList;
    mapping(address => bool)        private _isEmployee;

    mapping(bytes32 => InviteRecord) private _invites;
    bytes32[]                        private _inviteList;

    mapping(address => uint256) public lastPaidCycle;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    event CompanyNameSet(string name);
    event InviteCreated(bytes32 indexed codeHash, string name, string dept, uint256 ts);
    event InviteClaimed(bytes32 indexed codeHash, address indexed employee, uint256 ts);
    event SalarySet(address indexed employee, uint256 ts);
    event EmployeeDeactivated(address indexed employee);
    event EmployeeReactivated(address indexed employee);
    event PayrollExecuted(uint256 indexed cycle, uint256 ts, uint256 count);
    event PaymentMade(address indexed employee, uint256 indexed cycle, uint256 ts);
    event PayrollFunded(uint64 amount);

    // ─────────────────────────────────────────────
    //  Errors
    // ─────────────────────────────────────────────

    error InvalidCode();
    error CodeAlreadyClaimed();
    error AlreadyRegistered();
    error NotEmployee();
    error NotActive();
    error SalaryNotSet();
    error Unauthorized();
    error ZeroAddress();

    // ─────────────────────────────────────────────
    //  Constructor (called by factory with explicit owner)
    // ─────────────────────────────────────────────

    constructor(
        address _owner,
        string memory _companyName,
        address _paymentToken,
        address _factory
    ) Ownable(_owner) {
        if (_paymentToken == address(0)) revert ZeroAddress();
        if (_factory == address(0)) revert ZeroAddress();
        paymentToken = ConfidentialPayToken(_paymentToken);
        factory = ICipherRollFactory(_factory);
        companyName = _companyName;
        currentCycle = 1;
        emit CompanyNameSet(_companyName);
    }

    // ─────────────────────────────────────────────
    //  Settings
    // ─────────────────────────────────────────────

    function setCompanyName(string calldata _name) external onlyOwner {
        companyName = _name;
        emit CompanyNameSet(_name);
    }

    // ─────────────────────────────────────────────
    //  Invite creation
    // ─────────────────────────────────────────────

    /**
     * @notice Create an invite for a future employee.
     * @param codeHash   keccak256(abi.encodePacked(bytes32Code)) — computed by frontend
     * @param name       Employee display name
     * @param department Department
     */
    function createInvite(
        bytes32 codeHash,
        string calldata name,
        string calldata department
    ) external onlyOwner {
        require(!_invites[codeHash].exists, "Code already used");

        _invites[codeHash] = InviteRecord({
            exists:    true,
            claimedBy: address(0),
            name:      name,
            department: department,
            createdAt: block.timestamp
        });
        _inviteList.push(codeHash);

        // Register globally in factory so employees can find this contract
        factory.registerInvite(codeHash);

        emit InviteCreated(codeHash, name, department, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  Invite claiming (employee)
    // ─────────────────────────────────────────────

    /**
     * @notice Employee claims their invite by submitting the plaintext bytes32 code.
     */
    function claimInvite(bytes32 code) external {
        bytes32 codeHash = keccak256(abi.encodePacked(code));
        InviteRecord storage inv = _invites[codeHash];

        if (!inv.exists)               revert InvalidCode();
        if (inv.claimedBy != address(0)) revert CodeAlreadyClaimed();
        if (_isEmployee[msg.sender])   revert AlreadyRegistered();

        inv.claimedBy = msg.sender;

        _employees[msg.sender] = Employee({
            status:           Status.Pending,
            salarySet:        false,
            encryptedSalary:  TFHE.asEuint64(0),
            claimedAt:        block.timestamp,
            lastPaidAt:       0,
            totalPayments:    0,
            name:             inv.name,
            department:       inv.department
        });

        _isEmployee[msg.sender] = true;
        _employeeList.push(msg.sender);

        emit InviteClaimed(codeHash, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  Salary management
    // ─────────────────────────────────────────────

    /**
     * @notice Set (or update) an employee's encrypted salary. Also activates Pending employees.
     */
    function setSalary(
        address employeeAddress,
        einput encryptedSalary,
        bytes calldata inputProof
    ) external onlyOwner {
        if (!_isEmployee[employeeAddress]) revert NotEmployee();
        Employee storage emp = _employees[employeeAddress];
        require(emp.status == Status.Pending || emp.status == Status.Active, "Wrong status");

        euint64 salary = TFHE.asEuint64(encryptedSalary, inputProof);
        emp.encryptedSalary = salary;
        emp.salarySet = true;
        if (emp.status == Status.Pending) emp.status = Status.Active;

        TFHE.allowThis(salary);
        TFHE.allow(salary, owner());
        TFHE.allow(salary, employeeAddress);

        emit SalarySet(employeeAddress, block.timestamp);
    }

    function deactivateEmployee(address addr) external onlyOwner {
        if (!_isEmployee[addr]) revert NotEmployee();
        _employees[addr].status = Status.Inactive;
        emit EmployeeDeactivated(addr);
    }

    function reactivateEmployee(address addr) external onlyOwner {
        if (!_isEmployee[addr]) revert NotEmployee();
        _employees[addr].status = Status.Active;
        emit EmployeeReactivated(addr);
    }

    // ─────────────────────────────────────────────
    //  Funding
    // ─────────────────────────────────────────────

    function fundPayroll(uint64 amount) external onlyOwner {
        paymentToken.mint(address(this), amount);
        emit PayrollFunded(amount);
    }

    // ─────────────────────────────────────────────
    //  Payroll execution
    // ─────────────────────────────────────────────

    function executePayroll() external onlyOwner nonReentrant {
        uint256 cycle = currentCycle;
        uint256 count = 0;

        for (uint256 i = 0; i < _employeeList.length; i++) {
            address addr = _employeeList[i];
            Employee storage emp = _employees[addr];
            if (emp.status != Status.Active) continue;
            if (!emp.salarySet) continue;
            if (lastPaidCycle[addr] == cycle) continue;

            paymentToken.transfer(addr, emp.encryptedSalary);
            emp.lastPaidAt = block.timestamp;
            emp.totalPayments += 1;
            lastPaidCycle[addr] = cycle;
            count++;
            emit PaymentMade(addr, cycle, block.timestamp);
        }

        currentCycle++;
        emit PayrollExecuted(cycle, block.timestamp, count);
    }

    function payEmployee(address addr) external onlyOwner nonReentrant {
        if (!_isEmployee[addr]) revert NotEmployee();
        Employee storage emp = _employees[addr];
        if (emp.status != Status.Active) revert NotActive();
        if (!emp.salarySet) revert SalaryNotSet();

        paymentToken.transfer(addr, emp.encryptedSalary);
        emp.lastPaidAt = block.timestamp;
        emp.totalPayments += 1;
        emit PaymentMade(addr, currentCycle, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  Views — salary handles
    // ─────────────────────────────────────────────

    function getSalaryHandle(address addr) external view returns (uint256) {
        if (msg.sender != owner() && msg.sender != addr) revert Unauthorized();
        if (!_isEmployee[addr]) revert NotEmployee();
        return euint64.unwrap(_employees[addr].encryptedSalary);
    }

    function getMySalaryHandle() external view returns (uint256) {
        if (!_isEmployee[msg.sender]) revert NotEmployee();
        return euint64.unwrap(_employees[msg.sender].encryptedSalary);
    }

    // ─────────────────────────────────────────────
    //  Views — employee info (public for claimed check)
    // ─────────────────────────────────────────────

    function getEmployeeInfo(address addr) external view returns (
        uint8 status, bool salarySet, uint256 claimedAt,
        uint256 lastPaidAt, uint256 totalPayments,
        string memory empName, string memory department
    ) {
        if (msg.sender != owner() && msg.sender != addr) revert Unauthorized();
        if (!_isEmployee[addr]) revert NotEmployee();
        Employee storage emp = _employees[addr];
        return (uint8(emp.status), emp.salarySet, emp.claimedAt,
                emp.lastPaidAt, emp.totalPayments, emp.name, emp.department);
    }

    function isRegistered(address addr) external view returns (bool) {
        return _isEmployee[addr];
    }

    function getEmployeeStatus(address addr) external view returns (uint8) {
        return uint8(_employees[addr].status);
    }

    function getEmployeeList() external view onlyOwner returns (address[] memory) {
        return _employeeList;
    }

    function totalEmployees() external view returns (uint256) {
        return _employeeList.length;
    }

    function activeEmployeeCount() external view returns (uint256) {
        uint256 n = 0;
        for (uint256 i = 0; i < _employeeList.length; i++) {
            if (_employees[_employeeList[i]].status == Status.Active) n++;
        }
        return n;
    }

    // getInvite is public so employee can verify before claiming
    function getInvite(bytes32 codeHash) external view returns (
        bool exists, address claimedBy, string memory invName,
        string memory department, uint256 createdAt
    ) {
        InviteRecord storage inv = _invites[codeHash];
        return (inv.exists, inv.claimedBy, inv.name, inv.department, inv.createdAt);
    }

    function getInviteList() external view onlyOwner returns (bytes32[] memory) {
        return _inviteList;
    }

    function getPayrollBalanceHandle() external view onlyOwner returns (uint256) {
        return euint64.unwrap(paymentToken.balanceOf(address(this)));
    }
}
