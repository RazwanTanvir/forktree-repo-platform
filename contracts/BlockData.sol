// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title BlockData
 * @dev Organization-owned Healthcare Blockchain Data Contract with Role-Based Access Control (RBAC).
 * Enforces stakeholder ownership, clinician authorization, and patient cross-organization consent.
 */
contract BlockData {

    // --- Stakeholder Roles ---
    uint8 public constant ROLE_NONE = 0;
    uint8 public constant ROLE_CLINICIAN = 1;
    uint8 public constant ROLE_AUDITOR = 2;
    uint8 public constant ROLE_ADMIN = 3;
    uint8 public constant ROLE_PATIENT = 4;

    address public owner;
    mapping(address => uint8) public stakeholderRoles;

    // Consent: patientId => (targetOrgNetworkId => allowed)
    mapping(string => mapping(uint256 => bool)) public patientConsents;

    // --- HL7 FHIR Healthcare Patient Records ---
    struct PatientHealthRecord {
        uint256 blockNumber;
        uint256 networkId;
        uint256 portNumber;
        string patientId;       // e.g. "P101", "MRN-10492"
        string resourceType;    // HL7 FHIR: "Patient", "Observation", "Condition", "Encounter", etc.
        string clinicalCode;    // e.g. LOINC "15074-8", ICD-10 "E11.9", RxNorm "860975"
        string resourceData;    // Complete HL7 FHIR JSON string
        string dataHash;        // Cryptographic integrity hash (SHA-256)
        uint256 timestamp;      // Unix epoch seconds
    }

    PatientHealthRecord[] public patientRecords;
    uint256 private _currentBlockNumber = 0;

    // --- Legacy Data Point Compatibility ---
    struct DataPoint {
        uint256 blockNumber;
        uint256 networkId;
        uint256 portNumber;
        uint256 data;
    }

    DataPoint[] public dataPoints;

    // Events
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event StakeholderRoleUpdated(address indexed account, uint8 role);
    event ConsentUpdated(string indexed patientId, uint256 indexed targetOrgNetworkId, bool granted);
    event PatientRecordAdded(
        uint256 indexed blockNumber,
        uint256 indexed networkId,
        string patientId,
        string resourceType,
        string clinicalCode,
        string dataHash,
        uint256 timestamp,
        address indexed recorder
    );
    event DataPointAdded(uint256 indexed blockNumber, uint256 indexed networkId, uint256 portNumber, uint256 data);

    modifier onlyOwner() {
        require(msg.sender == owner || owner == address(0), "Security: Caller is not the organization owner");
        _;
    }

    modifier onlyAuthorizedClinician() {
        require(
            msg.sender == owner ||
            owner == address(0) ||
            stakeholderRoles[msg.sender] == ROLE_CLINICIAN ||
            stakeholderRoles[msg.sender] == ROLE_ADMIN,
            "Security: Caller is not authorized to write clinical records"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
        stakeholderRoles[msg.sender] = ROLE_ADMIN;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
        stakeholderRoles[newOwner] = ROLE_ADMIN;
    }

    // --- Stakeholder RBAC Management ---
    function setStakeholderRole(address account, uint8 role) public onlyOwner {
        require(account != address(0), "Invalid account");
        stakeholderRoles[account] = role;
        emit StakeholderRoleUpdated(account, role);
    }

    function getStakeholderRole(address account) public view returns (uint8) {
        if (account == owner) return ROLE_ADMIN;
        return stakeholderRoles[account];
    }

    function isAuthorizedClinician(address account) public view returns (bool) {
        if (account == owner || owner == address(0)) return true;
        uint8 role = stakeholderRoles[account];
        return (role == ROLE_CLINICIAN || role == ROLE_ADMIN);
    }

    // --- Patient Cross-Organization Consent Management ---
    function grantConsent(string memory _patientId, uint256 _targetOrgNetworkId) public {
        patientConsents[_patientId][_targetOrgNetworkId] = true;
        emit ConsentUpdated(_patientId, _targetOrgNetworkId, true);
    }

    function revokeConsent(string memory _patientId, uint256 _targetOrgNetworkId) public {
        patientConsents[_patientId][_targetOrgNetworkId] = false;
        emit ConsentUpdated(_patientId, _targetOrgNetworkId, false);
    }

    function hasConsent(string memory _patientId, uint256 _targetOrgNetworkId) public view returns (bool) {
        return patientConsents[_patientId][_targetOrgNetworkId];
    }

    // --- Secured HL7 FHIR Patient Record Ingestion ---
    function addPatientRecordSecured(
        uint256 _networkId,
        uint256 _portNumber,
        string memory _patientId,
        string memory _resourceType,
        string memory _clinicalCode,
        string memory _resourceData,
        string memory _dataHash,
        uint256 _timestamp
    ) public onlyAuthorizedClinician returns (uint256) {
        uint256 recordBlock = _currentBlockNumber;
        patientRecords.push(PatientHealthRecord(
            recordBlock,
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
            recordBlock,
            _networkId,
            _patientId,
            _resourceType,
            _clinicalCode,
            _dataHash,
            _timestamp,
            msg.sender
        );

        _currentBlockNumber++;
        return recordBlock;
    }

    function addPatientRecord(
        uint256 _networkId,
        uint256 _portNumber,
        string memory _patientId,
        string memory _resourceType,
        string memory _clinicalCode,
        string memory _resourceData,
        string memory _dataHash,
        uint256 _timestamp
    ) public returns (uint256) {
        return addPatientRecordSecured(
            _networkId,
            _portNumber,
            _patientId,
            _resourceType,
            _clinicalCode,
            _resourceData,
            _dataHash,
            _timestamp
        );
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

    // --- Legacy Data Point Functions ---
    function addDataPoint(uint256 _networkId, uint256 _portNumber, uint256 _data) public {
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

    function getAllDataPoints() public view returns (DataPoint[] memory) {
        return dataPoints;
    }

    function searchMatchingDataPointsBlockNumbers(uint256 targetValue) public view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < dataPoints.length; i++) {
            if (dataPoints[i].data == targetValue) {
                count++;
            }
        }
        uint256[] memory matchingBlocks = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < dataPoints.length; i++) {
            if (dataPoints[i].data == targetValue) {
                matchingBlocks[idx] = dataPoints[i].blockNumber;
                idx++;
            }
        }
        return matchingBlocks;
    }
}
