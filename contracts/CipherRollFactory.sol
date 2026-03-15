// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ConfidentialPayroll.sol";
import "./ConfidentialPayToken.sol";

/**
 * @title  CipherRollFactory
 * @notice Permissionless factory — anyone can create their own confidential
 *         payroll organization by calling createOrganization().
 *
 *         One shared cUSD token is deployed at factory construction.
 *         Each new payroll contract is registered as a minter on that token.
 *
 *         Global invite registry: employees look up which payroll contract
 *         their invite code belongs to before calling claimInvite().
 */
contract CipherRollFactory {

    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────

    ConfidentialPayToken public immutable payToken;

    /// @notice employer address → their payroll contract
    mapping(address => address) public employerToContract;

    /// @notice invite codeHash → payroll contract that owns it
    mapping(bytes32 => address) public inviteCodeToContract;

    /// @notice reverse lookup: is this address a CipherRoll payroll contract?
    mapping(address => bool) private _isPayroll;

    address[] private _allPayrolls;

    // ─────────────────────────────────────────────
    //  Events & Errors
    // ─────────────────────────────────────────────

    event OrganizationCreated(address indexed employer, address indexed payroll, string name);
    event InviteRegistered(bytes32 indexed codeHash, address indexed payroll);

    error AlreadyHasOrganization();
    error NotARegisteredPayroll();
    error InviteAlreadyRegistered();

    // ─────────────────────────────────────────────
    //  Constructor — deploys shared cUSD token
    // ─────────────────────────────────────────────

    constructor() {
        payToken = new ConfidentialPayToken();
    }

    // ─────────────────────────────────────────────
    //  Organization creation
    // ─────────────────────────────────────────────

    /**
     * @notice Deploy a new ConfidentialPayroll for the caller.
     *         One wallet = one organization.
     * @param  name  Company display name (stored on-chain)
     * @return addr  Address of the newly deployed payroll contract
     */
    function createOrganization(string calldata name) external returns (address addr) {
        if (employerToContract[msg.sender] != address(0)) revert AlreadyHasOrganization();

        ConfidentialPayroll payroll = new ConfidentialPayroll(
            msg.sender,
            name,
            address(payToken),
            address(this)
        );
        addr = address(payroll);

        payToken.addMinter(addr);

        employerToContract[msg.sender] = addr;
        _isPayroll[addr] = true;
        _allPayrolls.push(addr);

        emit OrganizationCreated(msg.sender, addr, name);
    }

    // ─────────────────────────────────────────────
    //  Invite registry — called by payroll contracts
    // ─────────────────────────────────────────────

    function registerInvite(bytes32 codeHash) external {
        if (!_isPayroll[msg.sender]) revert NotARegisteredPayroll();
        if (inviteCodeToContract[codeHash] != address(0)) revert InviteAlreadyRegistered();
        inviteCodeToContract[codeHash] = msg.sender;
        emit InviteRegistered(codeHash, msg.sender);
    }

    // ─────────────────────────────────────────────
    //  Views
    // ─────────────────────────────────────────────

    function getPayrollForInvite(bytes32 codeHash) external view returns (address) {
        return inviteCodeToContract[codeHash];
    }

    function getPayrollForEmployer(address employer) external view returns (address) {
        return employerToContract[employer];
    }

    function isPayrollContract(address addr) external view returns (bool) {
        return _isPayroll[addr];
    }

    function totalOrganizations() external view returns (uint256) {
        return _allPayrolls.length;
    }
}
