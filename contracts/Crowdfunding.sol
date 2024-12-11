// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMultiSigApprover {
    function requiredApprovals() external view returns (uint256);
    function approveWithdrawalForMilestone(uint256 projectId, uint8 milestone) external;
    function isApprovedForMilestone(uint256 projectId, uint8 milestone) external view returns (bool);
    function isTrustedSigner(address signer) external view returns (bool);
    function milestoneApprovals(uint256 projectId, uint8 milestone, address signer) external view returns (bool);
}

contract Crowdfunding {
    struct Project {
        uint256 id;
        string title;
        string description;
        uint256 fundingGoal; 
        uint256 totalFunds;  
        address payable creator;
        bool isOpen;
        uint256 deadline;
        uint8 milestonesClaimed; 
    }

    struct Donation {
        address contributor;
        uint256 amount;   
        string comment;
    }

    uint256 public projectCount = 0;
    mapping(uint256 => Project) public projects;
    mapping(uint256 => Donation[]) public donations; 
    mapping(uint256 => mapping(address => uint256)) public contributions;

    IMultiSigApprover public multiSigApprover;

    event ProjectCreated(uint256 id, address indexed creator, string title, uint256 fundingGoal, uint256 deadline);
    event Funded(uint256 id, address indexed contributor, uint256 amount, string comment);
    event FundsWithdrawn(uint256 id, uint256 amount);

    function setMultiSigApprover(address _approver) public {
        require(address(multiSigApprover) == address(0), "Already set");
        multiSigApprover = IMultiSigApprover(_approver);
    }

    function createProject(
        string memory _title,
        string memory _description,
        uint256 _fundingGoal,
        uint256 _deadline
    ) public {
        require(bytes(_title).length > 0, "Title is required");
        require(bytes(_description).length > 0, "Description is required");
        require(_fundingGoal > 0, "Funding goal must be greater than zero");
        require(_deadline > block.timestamp, "Deadline must be in the future");

        projectCount++;
        projects[projectCount] = Project(
            projectCount,
            _title,
            _description,
            _fundingGoal,
            0,
            payable(msg.sender),
            true,
            _deadline,
            0
        );

        emit ProjectCreated(projectCount, msg.sender, _title, _fundingGoal, _deadline);
    }

    function fundProject(uint256 _id, string memory _comment) public payable {
        Project storage project = projects[_id];
        require(project.isOpen, "Project is not open for funding");
        require(block.timestamp < project.deadline, "Funding deadline has passed");
        require(msg.value > 0, "Contribution must be greater than zero");

        project.totalFunds += msg.value;
        contributions[_id][msg.sender] += msg.value;

        donations[_id].push(Donation(msg.sender, msg.value, _comment));

        emit Funded(_id, msg.sender, msg.value, _comment);

        if (project.totalFunds >= project.fundingGoal) {
            project.isOpen = false;
        }
    }

    // Multiple increments logic:
    // There are 3 increments total (0,1,2). 
    // Each milestone = 1/3 of fundingGoal except last which is remainder.
    // If multiple increments unlocked at once, withdraw them all at once if all approved.

    function withdrawFunds(uint256 _id) public {
        Project storage project = projects[_id];
        require(msg.sender == project.creator, "Only creator can withdraw funds");
        require(address(multiSigApprover) != address(0), "Approver not set");

        // Calculate how many increments unlocked
        // increments: first two = fundingGoal/3 each, last = remainder
        uint256 goal = project.fundingGoal;
        uint256 g1 = goal / 3;
        uint256 g2 = goal / 3;
        uint256 g3 = goal - g1 - g2;

        uint8 claimed = project.milestonesClaimed;
        // how many increments are unlocked based on totalFunds
        uint8 unlocked = 0;
        if (project.totalFunds >= g1) unlocked = 1;
        if (project.totalFunds >= g1+g2) unlocked = 2;
        if (project.totalFunds >= goal) unlocked = 3;

        require(unlocked > claimed, "No new increments unlocked");

        // Check approvals for each increment from claimed to unlocked-1
        for (uint8 m = claimed; m < unlocked; m++) {
            require(multiSigApprover.isApprovedForMilestone(_id, m), "Not all increments approved");
        }

        // Withdraw all newly unlocked increments
        uint256 amount = 0;
        for (uint8 m = claimed; m < unlocked; m++) {
            if (m == 0) amount += g1;
            else if (m == 1) amount += g2;
            else amount += g3;
        }

        project.milestonesClaimed = unlocked;
        project.creator.transfer(amount);

        emit FundsWithdrawn(_id, amount);
    }

    function getDonations(uint256 _id) public view returns (Donation[] memory) {
        return donations[_id];
    }

    function getApprovalStatus() public view returns (uint256 approvedCount, uint256 requiredApprovals) {
    // Returns dummy values since old logic is deprecated
    return (0, multiSigApprover.requiredApprovals());
}
}
