// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ReferralRewards {
    mapping(address => uint256) public referralCount;

    event ReferralRecorded(address indexed referrer, address indexed contributor);

    // Record a referral after a successful contribution
    // Only callable by the frontend after a user funds a project if a ref parameter was present
    function recordReferral(address contributor, address referrer) external {
        require(referrer != address(0), "Invalid referrer");
        require(referrer != contributor, "Cannot refer self");
        referralCount[referrer] += 1;
        emit ReferralRecorded(referrer, contributor);
    }

    function getReferralCount(address referrer) external view returns (uint256) {
        return referralCount[referrer];
    }
}
