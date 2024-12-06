// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract NameRegistry {
    mapping(address => string) private userNames;

    // Register a name for the sender (Ethereum address)
    function registerName(string memory name) public {
        require(bytes(name).length > 0, "Name cannot be empty");
        userNames[msg.sender] = name;
    }

    // Retrieve the name of a given address
    function getName(address user) public view returns (string memory) {
        return userNames[user];
    }
}
