// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ForkDetailStore {

    struct ForkDetail {
        int256 networkId;
        int256 portNumber;
        int256 parentNetworkId;
        uint256 parentChainForkBlockNumber;
    }

    ForkDetail[] public forkDetails;
    mapping(int256 => int256[]) public adjacencyList;

    event ForkAdded(int256 indexed networkId, int256 indexed parentNetworkId, int256 portNumber, uint256 forkBlockNumber);

    function addForkDetail(int256 _networkId, int256 _portNumber, int256 _parentNetworkId, uint256 _parentChainForkBlockNumber) public {
        forkDetails.push(ForkDetail(_networkId, _portNumber, _parentNetworkId, _parentChainForkBlockNumber));
        adjacencyList[_parentNetworkId].push(_networkId);
        emit ForkAdded(_networkId, _parentNetworkId, _portNumber, _parentChainForkBlockNumber);
    }

    function totalForks() public view returns (uint256) {
        return forkDetails.length;
    }

    function getForkDetailByIndex(uint256 index) public view returns (ForkDetail memory) {
        require(index < forkDetails.length, "Index out of bounds");
        return forkDetails[index];
    }

    function getAllForkDetails() public view returns (ForkDetail[] memory) {
        return forkDetails;
    }

    function getAdjacencyList(int256 _networkId) public view returns (int256[] memory) {
        return adjacencyList[_networkId];
    }
}
