// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DataStore {

    struct DataPoint {
        uint256 blockNumber;
        int256 networkId;
        int256 portNumber;
        int256 data;
    }

    DataPoint[] public dataPoints;
    uint256 private _currentBlockNumber = 0;

    event DataPointAdded(uint256 indexed blockNumber, int256 indexed networkId, int256 portNumber, int256 data);

    function addDataPoint(int256 _networkId, int256 _portNumber, int256 _data) public {
        dataPoints.push(DataPoint(_currentBlockNumber, _networkId, _portNumber, _data));
        emit DataPointAdded(_currentBlockNumber, _networkId, _portNumber, _data);
        _currentBlockNumber++;
    }

    function totalDataPoints() public view returns (uint256) {
        return dataPoints.length;
    }

    function getDataPointByIndex(uint256 index) public view returns (DataPoint memory) {
        require(index < dataPoints.length, "Index out of bounds");
        return dataPoints[index];
    }

    function getLastDataPoint() public view returns (DataPoint memory) {
        require(dataPoints.length > 0, "No data points stored yet");
        return dataPoints[dataPoints.length - 1];
    }

    function getAllDataPoints() public view returns (DataPoint[] memory) {
        return dataPoints;
    }

    // Search and return block numbers where data matches query
    function searchMatchingDataPointsBlockNumbers(int256 _data) public view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < dataPoints.length; i++) {
            if (dataPoints[i].data == _data) {
                count++;
            }
        }
        uint256[] memory matchingBlockNumbers = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < dataPoints.length; i++) {
            if (dataPoints[i].data == _data) {
                matchingBlockNumbers[index] = dataPoints[i].blockNumber;
                index++;
            }
        }
        return matchingBlockNumbers;
    }
}
