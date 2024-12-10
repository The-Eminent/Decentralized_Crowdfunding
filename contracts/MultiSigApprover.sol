// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MultiSigApprover {
    address[] public trustedSigners;
    uint256 public requiredApprovals; // This already has a getter function requiredApprovals()

    // milestoneApprovals is a public mapping, so a getter is automatically generated.
    // No need to define another function with the same name.
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) public milestoneApprovals;

    constructor(address[] memory _trustedSigners, uint256 _requiredApprovals) {
        require(_trustedSigners.length >= _requiredApprovals, "Not enough signers");
        trustedSigners = _trustedSigners;
        requiredApprovals = _requiredApprovals;
    }

    function approveWithdrawalForMilestone(uint256 projectId, uint8 milestone) external {
        require(isTrustedSigner(msg.sender), "Not a trusted signer");
        milestoneApprovals[projectId][milestone][msg.sender] = true;
    }

    function isApprovedForMilestone(uint256 projectId, uint8 milestone) external view returns (bool) {
        uint256 count = 0;
        for (uint256 i = 0; i < trustedSigners.length; i++) {
            if (milestoneApprovals[projectId][milestone][trustedSigners[i]]) {
                count++;
            }
        }
        return count >= requiredApprovals;
    }

    function isTrustedSigner(address signer) public view returns (bool) {
        for (uint256 i = 0; i < trustedSigners.length; i++) {
            if (trustedSigners[i] == signer) {
                return true;
            }
        }
        return false;
    }
}
