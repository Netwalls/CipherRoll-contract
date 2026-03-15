// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { ERC7984 } from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title ConfidentialPayToken (cUSD)
 * @notice ERC-7984 confidential payment token used for payroll disbursement.
 *         All balances and transfer amounts are fully encrypted on-chain via Zama fhEVM.
 *         Only sender and recipient know exact amounts — the blockchain enforces
 *         settlement without ever exposing financial data.
 */
contract ConfidentialPayToken is ZamaEthereumConfig, Ownable2Step, ERC7984 {
    /// @notice Addresses authorized to call `mint()` (e.g., ConfidentialPayroll)
    mapping(address => bool) public minters;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event Mint(address indexed to, uint64 amount);

    error NotMinter();
    error ZeroAddress();

    constructor() Ownable(msg.sender) ERC7984("Confidential USD", "cUSD", "") {}

    modifier onlyMinter() {
        if (!minters[msg.sender] && msg.sender != owner()) revert NotMinter();
        _;
    }

    // ──────────────────────────────────────────────────────────
    //  Minter management (owner only)
    // ──────────────────────────────────────────────────────────

    function addMinter(address minter) external onlyOwner {
        if (minter == address(0)) revert ZeroAddress();
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    // ──────────────────────────────────────────────────────────
    //  Minting
    // ──────────────────────────────────────────────────────────

    /**
     * @notice Mint `amount` cUSD to `to`.
     * @param to     Recipient (e.g., the ConfidentialPayroll contract)
     * @param amount Plaintext amount in smallest unit (6 decimals → 1e6 = 1 cUSD)
     */
    function mint(address to, uint64 amount) external onlyMinter {
        if (to == address(0)) revert ZeroAddress();
        euint64 encAmount = FHE.asEuint64(amount);
        FHE.allowThis(encAmount);
        FHE.allow(encAmount, to);
        _mint(to, encAmount);
        emit Mint(to, amount);
    }

    // ──────────────────────────────────────────────────────────
    //  Operator transfer (called by payroll contract)
    // ──────────────────────────────────────────────────────────

    /**
     * @notice Transfer encrypted amount from payroll contract to employee.
     *         Payroll contract must be set as operator before calling.
     */
    function payEmployee(address from, address to, euint64 amount) external onlyMinter {
        _transfer(from, to, amount);
    }

    // ──────────────────────────────────────────────────────────
    //  View helpers
    // ──────────────────────────────────────────────────────────

    /**
     * @notice Return the raw ciphertext handle for `account`'s balance.
     */
    function encryptedBalanceOf(address account) external view returns (bytes32) {
        return euint64.unwrap(confidentialBalanceOf(account));
    }

    /**
     * @notice Return the encrypted balance directly.
     */
    function balanceOf(address account) external view returns (euint64) {
        return confidentialBalanceOf(account);
    }
}
