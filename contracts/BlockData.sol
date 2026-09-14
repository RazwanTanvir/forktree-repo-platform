// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BlockData {

    struct PatientHealthRecord {
        uint256 blockNumber;
        uint256 networkId;
        uint256 portNumber;
        string patientId;       // e.g. "P101", "MRN-10492"
        string resourceType;    // HL7 FHIR: "Patient", "Observation", "Condition", "Encounter"
        string clinicalCode;    // e.g. LOINC "15074-8", ICD-10 "E11.9"
        string resourceData;    // Complete HL7 FHIR JSON string
        string dataHash;        // Cryptographic integrity hash (SHA-256)
        uint256 timestamp;      // Unix epoch seconds
    }

    PatientHealthRecord[] public patientRecords;
    uint256 private _currentBlockNumber = 0;

    event PatientRecordAdded(
        uint256 indexed blockNumber,
        uint256 indexed networkId,
        string patientId,
        string resourceType,
        string clinicalCode,
        string dataHash,
        uint256 timestamp
    );

    function addPatientRecord(
        uint256 _networkId,
        uint256 _portNumber,
        string memory _patientId,
        string memory _resourceType,
        string memory _clinicalCode,
        string memory _resourceData,
        string memory _dataHash,
        uint256 _timestamp
    ) public {
        patientRecords.push(PatientHealthRecord(
            _currentBlockNumber,
            _networkId,
            _portNumber,
            _patientId,
            _resourceType,
            _clinicalCode,
            _resourceData,
            _dataHash,
            _timestamp
        ));

        emit PatientRecordAdded(
            _currentBlockNumber,
            _networkId,
            _patientId,
            _resourceType,
            _clinicalCode,
            _dataHash,
            _timestamp
        );

        _currentBlockNumber++;
    }

    function totalRecords() public view returns (uint256) {
        return patientRecords.length;
    }

    function getRecordByIndex(uint256 index) public view returns (PatientHealthRecord memory) {
        require(index < patientRecords.length, "Index out of bounds");
        return patientRecords[index];
    }

    function getAllRecords() public view returns (PatientHealthRecord[] memory) {
        return patientRecords;
    }

    function searchByPatientId(string memory _patientId) public view returns (uint256[] memory) {
        bytes32 target = keccak256(bytes(_patientId));
        uint256 count = 0;
        for (uint256 i = 0; i < patientRecords.length; i++) {
            if (keccak256(bytes(patientRecords[i].patientId)) == target) {
                count++;
            }
        }
        uint256[] memory matchingBlocks = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < patientRecords.length; i++) {
            if (keccak256(bytes(patientRecords[i].patientId)) == target) {
                matchingBlocks[idx] = patientRecords[i].blockNumber;
                idx++;
            }
        }
        return matchingBlocks;
    }

    function searchByResourceType(string memory _resourceType) public view returns (uint256[] memory) {
        bytes32 target = keccak256(bytes(_resourceType));
        uint256 count = 0;
        for (uint256 i = 0; i < patientRecords.length; i++) {
            if (keccak256(bytes(patientRecords[i].resourceType)) == target) {
                count++;
            }
        }
        uint256[] memory matchingBlocks = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < patientRecords.length; i++) {
            if (keccak256(bytes(patientRecords[i].resourceType)) == target) {
                matchingBlocks[idx] = patientRecords[i].blockNumber;
                idx++;
            }
        }
        return matchingBlocks;
    }

    function searchByKeyword(string memory _keyword) public view returns (uint256[] memory) {
        bytes32 target = keccak256(bytes(_keyword));
        uint256 count = 0;
        for (uint256 i = 0; i < patientRecords.length; i++) {
            if (keccak256(bytes(patientRecords[i].patientId)) == target ||
                keccak256(bytes(patientRecords[i].resourceType)) == target ||
                keccak256(bytes(patientRecords[i].clinicalCode)) == target) {
                count++;
            }
        }
        uint256[] memory matchingBlocks = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < patientRecords.length; i++) {
            if (keccak256(bytes(patientRecords[i].patientId)) == target ||
                keccak256(bytes(patientRecords[i].resourceType)) == target ||
                keccak256(bytes(patientRecords[i].clinicalCode)) == target) {
                matchingBlocks[idx] = patientRecords[i].blockNumber;
                idx++;
            }
        }
        return matchingBlocks;
    }
}
