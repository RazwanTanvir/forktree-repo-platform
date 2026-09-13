// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ForkDetailStore {

    // Define the ForkDetail structure
    struct ForkDetail {
        int networkId;
        int portNumber;
        int parentNetworkId;
        uint256 parentChainForkBlockNumber;
    }

    // Store the ForkDetail array
    ForkDetail[] public forkDetails;

    // Mapping to store the adjacency list
    mapping(int => int[]) public adjacencyList;

    // Function to add a new ForkDetail
    function addForkDetail(int _networkId, int portNumber, int _parentNetworkId, uint256 _parentChainForkBlockNumber) public {
        forkDetails.push(ForkDetail(_networkId, portNumber, _parentNetworkId, _parentChainForkBlockNumber));

        // Update the adjacency list
        adjacencyList[_parentNetworkId].push(_networkId);
    }

    // Function to get a ForkDetail by index
    function getForkDetailByIndex(uint256 index) public view returns (ForkDetail memory) {
        require(index < forkDetails.length, "Index out of bounds");
        return forkDetails[index];
    }

    // Function to get all ForkDetails
    function getAllForkDetails() public view returns (ForkDetail[] memory) {
        return forkDetails;
    }

    // Function to get the adjacency list for a given network ID
    function getAdjacencyList(int _networkId) public view returns (int[] memory) {
        return adjacencyList[_networkId];
    }
}
