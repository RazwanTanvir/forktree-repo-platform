//SPDX-License-Identifier: MIT
// HelloWorld.sol
pragma solidity ^0.8.7;

contract HelloWorld {
    string public message;

    constructor() {
        message = "Hello, World!";
    }

    function updateMessage(string memory newMessage) public {
        message = newMessage;
    }
}
