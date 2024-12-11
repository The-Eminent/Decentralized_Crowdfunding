// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title MicropaymentChannel
 * @notice A simple micropayment channel contract demonstrating off-chain signatures.
 *
 * Flow:
 * - Sender deploys contract with initial ETH, sets receiver and expiration.
 * - Off-chain: Sender signs messages of form (contract_address, amount).
 * - Receiver uses claim(...) with a valid signature to retrieve funds.
 * - If time expires, sender can reclaim the remaining funds.
 */
contract MicroPaymentChannel {
    address public sender;
    address public receiver;
    uint256 public expiration;

    constructor(address _receiver, uint256 duration) payable {
        sender = msg.sender;
        receiver = _receiver;
        expiration = block.timestamp + duration; // channel valid until expiration
    }

    // Sender can reclaim after expiration
    function reclaim() external {
        require(msg.sender == sender, "Only sender can reclaim");
        require(block.timestamp >= expiration, "Channel not expired yet");
        payable(sender).transfer(address(this).balance);
    }

    /**
     * @dev Receiver calls claim with amount and signed message from sender
     * @param amount The amount that the sender agreed off-chain
     * @param v,r,s Signature components from sender's signed message
     */
    function claim(uint256 amount, uint8 v, bytes32 r, bytes32 s) external {
        require(msg.sender == receiver, "Caller not receiver");
        bytes32 message = prefixed(keccak256(abi.encodePacked(address(this), amount)));
        address signer = ecrecover(message, v, r, s);
        require(signer == sender, "Invalid signature");
        require(amount <= address(this).balance, "Insufficient balance in channel");

        // Transfer the amount to receiver
        payable(receiver).transfer(amount);
    }

    // Helper function to generate the prefixed hash for ecrecover
    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        // Ethereum signed message prefix
        // like it ensures the signature is compatible with Ethereum wallets
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }
}
