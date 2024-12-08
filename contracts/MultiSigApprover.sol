// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MultiSigApprover {
    address[] public trustedSigners;
    mapping(uint256 => mapping(address => bool)) public approvals;
    uint256 public requiredApprovals;

    constructor(address[] memory _trustedSigners, uint256 _requiredApprovals) {
        require(_trustedSigners.length >= _requiredApprovals, "Not enough signers");
        trustedSigners = _trustedSigners;
        requiredApprovals = _requiredApprovals;
    }

    function approveWithdrawal(uint256 projectId) public {
        require(isTrustedSigner(msg.sender), "Not a trusted signer");
        approvals[projectId][msg.sender] = true;
    }

    function isApproved(uint256 projectId) public view returns (bool) {
        uint256 count = 0;
        for (uint256 i = 0; i < trustedSigners.length; i++) {
            if (approvals[projectId][trustedSigners[i]]) {
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
