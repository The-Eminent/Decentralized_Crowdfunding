// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ReferralRewards {
    mapping(address => uint256) private referralCounts;
    mapping(address => uint256) private referralPoints;

    event ReferralRecorded(address indexed newUser, address indexed referrer);
    event RewardsClaimed(address indexed user, uint256 pointsClaimed);

    // Record a referral when a new contributor (newUser) is referred by referrer
   
    function recordReferral(address newUser, address referrer) external {
        require(newUser != address(0), "Invalid newUser");
        require(referrer != address(0), "Invalid referrer");
        require(newUser != referrer, "Can't refer self");

        referralCounts[referrer] += 1;
        // Each referral = +10 points
        referralPoints[referrer] += 10;

        emit ReferralRecorded(newUser, referrer);
    }

    function getReferralCount(address user) external view returns (uint256) {
        return referralCounts[user];
    }

    function getReferralPoints(address user) external view returns (uint256) {
        return referralPoints[user];
    }

    function claimRewards() external {
        uint256 points = referralPoints[msg.sender];
        require(points > 0, "No points to claim");
        // For demo, just reseting points to 0 to simulate claiming
        referralPoints[msg.sender] = 0;
        emit RewardsClaimed(msg.sender, points);
    }
}
