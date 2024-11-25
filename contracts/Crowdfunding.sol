// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Crowdfunding {
    struct Project {
        uint256 id;
        address payable creator;
        string title;
        string description;
        uint256 fundingGoal;
        uint256 totalFunds;
        bool isOpen;
    }

    uint256 public projectCount = 0;
    mapping(uint256 => Project) public projects;
    mapping(uint256 => mapping(address => uint256)) public contributions;

    event ProjectCreated(
        uint256 id,
        address creator,
        string title,
        uint256 fundingGoal
    );

    event Funded(
        uint256 id,
        address contributor,
        uint256 amount
    );

    event FundsWithdrawn(
        uint256 id,
        uint256 amount
    );

    function createProject(
        string memory _title,
        string memory _description,
        uint256 _fundingGoal
    ) public {
        require(_fundingGoal > 0, "Funding goal must be greater than zero");

        projectCount++;
        projects[projectCount] = Project(
            projectCount,
            payable(msg.sender),
            _title,
            _description,
            _fundingGoal,
            0,
            true
        );

        emit ProjectCreated(projectCount, msg.sender, _title, _fundingGoal);
    }

    function fundProject(uint256 _id) public payable {
        Project storage project = projects[_id];
        require(project.isOpen, "Project is not open for funding");
        require(msg.value > 0, "Contribution must be greater than zero");

        project.totalFunds += msg.value;
        contributions[_id][msg.sender] += msg.value;

        emit Funded(_id, msg.sender, msg.value);
    }

    function withdrawFunds(uint256 _id) public {
        Project storage project = projects[_id];
        require(msg.sender == project.creator, "Only creator can withdraw funds");
        require(project.totalFunds >= project.fundingGoal, "Funding goal not reached");
        require(project.isOpen, "Project is already closed");

        uint256 amount = project.totalFunds;
        project.totalFunds = 0;
        project.isOpen = false;

        project.creator.transfer(amount);

        emit FundsWithdrawn(_id, amount);
    }
}
