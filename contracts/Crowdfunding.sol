// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Crowdfunding {
    struct Project {
        uint256 id;
        string title;
        string description;
        uint256 fundingGoal; // In Wei
        uint256 totalFunds;  // In Wei
        address payable creator;
        bool isOpen;
        uint256 deadline; // Timestamp
    }

    struct Donation {
        address contributor;
        uint256 amount;   // In Wei
        string comment;
    }

    uint256 public projectCount = 0;
    mapping(uint256 => Project) public projects;
    mapping(uint256 => Donation[]) public donations; // projectId => Donation[]
    mapping(uint256 => mapping(address => uint256)) public contributions; // projectId => contributor => amount

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

    // Create a new project
    function createProject(
        string memory _title,
        string memory _description,
        uint256 _fundingGoal, // In Wei
        uint256 _deadline      // Timestamp
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

        emit ProjectCreated(
            projectCount,
            msg.sender,
            _title,
            _fundingGoal,
            _deadline
        );
    }

    // Fund a project
    function fundProject(uint256 _id, string memory _comment) public payable {
        Project storage project = projects[_id];
        require(project.isOpen, "Project is not open for funding");
        require(block.timestamp < project.deadline, "Funding deadline has passed");
        require(msg.value > 0, "Contribution must be greater than zero");

        project.totalFunds += msg.value;
        contributions[_id][msg.sender] += msg.value;

        donations[_id].push(Donation(msg.sender, msg.value, _comment));

        emit Funded(_id, msg.sender, msg.value, _comment);

        // Close project if funding goal is reached
        if (project.totalFunds >= project.fundingGoal) {
            project.isOpen = false;
        }
    }

    // Withdraw funds from a project
    function withdrawFunds(uint256 _id) public {
        Project storage project = projects[_id];
        require(msg.sender == project.creator, "Only creator can withdraw funds");
        require(project.totalFunds >= project.fundingGoal, "Funding goal not reached");
        require(project.isOpen == false, "Project is still open");

        uint256 amount = project.totalFunds;
        project.totalFunds = 0;
        project.isOpen = false;

        project.creator.transfer(amount);

        emit FundsWithdrawn(_id, amount);
    }

    // Get all donations for a project
    function getDonations(uint256 _id) public view returns (Donation[] memory) {
        return donations[_id];
    }
}
