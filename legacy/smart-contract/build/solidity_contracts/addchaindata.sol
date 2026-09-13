// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DataStore {

    // Define the data structure
    struct DataPoint {
        uint256 blockNumber;
        int networkId;
        int portNumber;
        int data;
    }

    // Store the data array
    DataPoint[] public dataPoints;

    // Track current block number
    uint256 private _currentBlockNumber = 0;

    // Function to add a new data point
    function addDataPoint(int _networkId, int _portNumber, int _data) public {
        dataPoints.push(DataPoint(_currentBlockNumber, _networkId, _portNumber, _data));
        _currentBlockNumber++;
    }

    // Function to get a data point by index
    function getDataPointByIndex(uint256 index) public view returns (DataPoint memory) {
        require(index < dataPoints.length, "Index out of bounds");
        return dataPoints[index];
    }

    // Function to get the last added data point
    function getLastDataPoint() public view returns (DataPoint memory) {
        require(dataPoints.length > 0, "No data points stored yet");
        return dataPoints[dataPoints.length - 1];
    }

    // Function to get all data points
    function getAllDataPoints() public view returns (DataPoint[] memory) {
        return dataPoints;
    }
	// Function to search and return block numbers where the specified data point matches
    function searchMatchingDataPointsBlockNumbers(int _networkId, int _portNumber, int _data) public view returns (uint256[] memory) {
        uint256[] memory matchingBlockNumbers = new uint256[](dataPoints.length);
        uint256 matchingCount = 0;

        for (uint256 i = 0; i < dataPoints.length; i++) {
            if (
                dataPoints[i].networkId == _networkId &&
                dataPoints[i].portNumber == _portNumber &&
                dataPoints[i].data == _data
            ) {
                // Add the block number to the result array
                matchingBlockNumbers[matchingCount] = dataPoints[i].blockNumber;
                matchingCount++;
            }
        }

        // Resize the array to remove unused slots
        assembly {
            mstore(matchingBlockNumbers, matchingCount)
        }

        return matchingBlockNumbers;
    }
}
