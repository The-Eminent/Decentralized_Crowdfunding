// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMultiSigApprover {
    function isApproved(uint256 projectId) external view returns (bool);
    function approveWithdrawal(uint256 projectId) external;
    function getApprovals(uint256 projectId) external view returns (uint256);
    function requiredApprovals() external view returns (uint256);
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

    event ProjectCreated(
        uint256 id,
        address indexed creator,
        string title,
        uint256 fundingGoal,
        uint256 deadline
    );

    event Funded(
        uint256 id,
        address indexed contributor,
        uint256 amount,
        string comment
    );

    event FundsWithdrawn(uint256 id, uint256 amount);

    IMultiSigApprover public multiSigApprover;

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
            _deadline
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

    function withdrawFunds(uint256 _id) public {
        Project storage project = projects[_id];
        require(msg.sender == project.creator, "Only creator can withdraw funds");
        require(project.totalFunds >= project.fundingGoal, "Funding goal not reached");
        require(project.isOpen == false, "Project is still open");
        require(address(multiSigApprover) != address(0), "MultiSigApprover not set");
        require(multiSigApprover.isApproved(_id), "Not approved by all trusted signers");

        uint256 amount = project.totalFunds;
        project.totalFunds = 0;
        project.creator.transfer(amount);

        emit FundsWithdrawn(_id, amount);
    }

    function getDonations(uint256 _id) public view returns (Donation[] memory) {
        return donations[_id];
    }

    function getApprovalStatus(uint256 _projectId) public view returns (uint256 approvedCount, uint256 requiredApprovals) {
        require(address(multiSigApprover) != address(0), "MultiSigApprover not set.");
        uint256 app = multiSigApprover.getApprovals(_projectId);
        uint256 req = multiSigApprover.requiredApprovals();
        return (app, req);
    }
}
