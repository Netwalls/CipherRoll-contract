// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import { SepoliaZamaFHEVMConfig } from "fhevm/config/ZamaFHEVMConfig.sol";
import { ConfidentialERC20 } from "fhevm-contracts/contracts/token/ERC20/ConfidentialERC20.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title ConfidentialPayToken (cUSD)
 * @notice ERC-7984 confidential payment token used for payroll disbursement.
 *         All balances and transfer amounts are fully encrypted on-chain via Zama fhEVM.
 *         Only sender and recipient know exact amounts — the blockchain enforces
 *         settlement without ever exposing financial data.
 *
 * @dev Inherits fhevm-contracts/ConfidentialERC20 (ERC-7984 compliant).
 *      Adds multi-minter support so the payroll contract can fund itself.
 */
contract ConfidentialPayToken is SepoliaZamaFHEVMConfig, Ownable2Step, ConfidentialERC20 {
    /// @notice Addresses authorized to call `mint()` (e.g., ConfidentialPayroll)
    mapping(address => bool) public minters;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event Mint(address indexed to, uint64 amount);

    error NotMinter();
    error ZeroAddress();
    error SupplyOverflow();

    constructor() Ownable(msg.sender) ConfidentialERC20("Confidential USD", "cUSD") {}

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
     *         Internally encrypted — only `to` (and the contract) can see the balance.
     * @param to     Recipient (e.g., the ConfidentialPayroll contract)
     * @param amount Plaintext amount in smallest unit (6 decimals → 1e6 = 1 cUSD)
     */
    function mint(address to, uint64 amount) external onlyMinter {
        if (to == address(0)) revert ZeroAddress();
        // Overflow guard: totalSupply is plaintext in ConfidentialERC20
        unchecked {
            if (_totalSupply + amount < _totalSupply) revert SupplyOverflow();
        }
        _unsafeMint(to, amount);
        _totalSupply += amount;
        emit Mint(to, amount);
    }

    // ──────────────────────────────────────────────────────────
    //  View helpers
    // ──────────────────────────────────────────────────────────

    /**
     * @notice Return the raw ciphertext handle for `account`'s balance.
     *         Use with fhevmjs `instance.reencrypt()` to decrypt off-chain.
     */
    function encryptedBalanceOf(address account) external view returns (uint256) {
        return euint64.unwrap(balanceOf(account));
    }
}
