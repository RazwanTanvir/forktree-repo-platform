// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ConsortiumGovernance
 * @dev Shared Governance and Organization Topology Platform for BlockchainForkTree.
 * Manages consortium organizations, projects, healthcare fork proposals, voting,
 * and inter-organization cross-fork FHIR messaging.
 */
contract ConsortiumGovernance {

    // --- Steering Council & Project Management ---
    struct Project {
        uint256 projectId;
        string name;
        string description;
        address owner;
        uint256 rootNetworkId;
        bool active;
        uint256 createdAt;
    }

    Project[] public projects;
    mapping(address => bool) public isSteeringCouncil;
    address public consortiumChair;

    // --- Legacy StoreForkEvent Compatibility ---
    struct ForkDetail {
        int256 networkId;
        int256 portNumber;
        int256 parentNetworkId;
        uint256 parentChainForkBlockNumber;
    }

    ForkDetail[] public forkDetails;
    mapping(int256 => int256[]) public adjacencyList;

    // --- Consortium Organization Registry ---
    struct Organization {
        uint256 orgId;
        string name;
        address adminAddress;
        uint256 networkId;
        uint256 port;
        string orgType;
        bool active;
        uint256 joinedAt;
    }

    Organization[] public organizations;
    mapping(uint256 => uint256) public networkIdToOrgIndex;
    mapping(address => bool) public isMemberAdmin;

    // --- Consortium Fork Proposals & Voting ---
    struct ForkProposal {
        uint256 proposalId;
        address proposer;
        string orgName;
        uint256 networkId;
        uint256 portNumber;
        uint256 parentNetworkId;
        uint256 parentChainForkBlockNumber;
        string justification;
        string orgType;
        uint256 votesFor;
        uint256 votesAgainst;
        bool executed;
        uint256 createdAt;
        string fhirCapability;
        address initialAdmin;
    }

    ForkProposal[] public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // --- Inter-Organization & Cross-Fork FHIR Messaging Protocol ---
    struct InterOrgMessage {
        uint256 messageId;
        uint256 senderNetworkId;
        address sender;
        uint256 recipientNetworkId;
        address recipient;
        string messageType;       // GENERAL, FHIR_SERVICE_REQUEST, FHIR_DIAGNOSTIC_REPORT, FHIR_MEDICATION_REQUEST, FHIR_MEDICATION_DISPENSE, FHIR_CLAIM, FHIR_CLAIM_RESPONSE
        string subject;
        string fhirResourceType;  // ServiceRequest, DiagnosticReport, MedicationRequest, MedicationDispense, Claim, ClaimResponse
        string fhirResourceId;
        string payloadHash;       // SHA-256 integrity hash
        string payload;           // Structured FHIR JSON or encrypted payload CID
        uint8 status;             // 0: PENDING, 1: DELIVERED, 2: ACKNOWLEDGED, 3: FULFILLED, 4: REJECTED
        uint256 timestamp;
        uint256 responseToMessageId; // Threading: 0 if initial, or messageId of request
    }

    InterOrgMessage[] public messages;
    mapping(uint256 => uint256[]) public orgMessageIndices; // networkId => messageIds

    // Events
    event SteeringCouncilMemberUpdated(address indexed account, bool isCouncil);
    event ProjectCreated(uint256 indexed projectId, string name, address indexed owner, uint256 rootNetworkId);
    event ForkAdded(int256 indexed networkId, int256 indexed parentNetworkId, int256 portNumber, uint256 forkBlockNumber);
    event OrganizationRegistered(uint256 indexed orgId, string name, address indexed adminAddress, uint256 networkId, uint256 port);
    event ForkProposed(uint256 indexed proposalId, address indexed proposer, string orgName, uint256 networkId, uint256 parentNetworkId);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 votesFor, uint256 votesAgainst);
    event ProposalExecuted(uint256 indexed proposalId, uint256 indexed networkId, uint256 portNumber);
    event MessageSent(
        uint256 indexed messageId,
        uint256 indexed senderNetworkId,
        uint256 indexed recipientNetworkId,
        string messageType,
        string fhirResourceType,
        string payloadHash
    );
    event MessageStatusUpdated(uint256 indexed messageId, uint8 status, address indexed updater);

    modifier onlySteeringCouncil() {
        require(
            msg.sender == consortiumChair || isSteeringCouncil[msg.sender] || consortiumChair == address(0),
            "Security: Caller is not a Steering Council Admin"
        );
        _;
    }

    constructor() {
        consortiumChair = msg.sender;
        isSteeringCouncil[msg.sender] = true;
    }

    // --- Steering Council & Project Methods ---
    function setSteeringCouncilMember(address account, bool isCouncil) public onlySteeringCouncil {
        require(account != address(0), "Invalid address");
        isSteeringCouncil[account] = isCouncil;
        emit SteeringCouncilMemberUpdated(account, isCouncil);
    }

    function createProject(
        string memory _name,
        string memory _description,
        uint256 _rootNetworkId
    ) public onlySteeringCouncil returns (uint256) {
        uint256 projectId = projects.length + 1;
        projects.push(Project({
            projectId: projectId,
            name: _name,
            description: _description,
            owner: msg.sender,
            rootNetworkId: _rootNetworkId,
            active: true,
            createdAt: block.timestamp
        }));

        emit ProjectCreated(projectId, _name, msg.sender, _rootNetworkId);
        return projectId;
    }

    function totalProjects() public view returns (uint256) {
        return projects.length;
    }

    function getAllProjects() public view returns (Project[] memory) {
        return projects;
    }

    function getProjectByIndex(uint256 index) public view returns (Project memory) {
        require(index < projects.length, "Index out of bounds");
        return projects[index];
    }

    // --- Legacy Fork Registration ---
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

    // --- Organization Registry Methods ---
    function registerOrganization(
        string memory _name,
        address _adminAddress,
        uint256 _networkId,
        uint256 _port,
        string memory _orgType
    ) public returns (uint256) {
        uint256 orgId = organizations.length + 1;
        organizations.push(Organization({
            orgId: orgId,
            name: _name,
            adminAddress: _adminAddress,
            networkId: _networkId,
            port: _port,
            orgType: _orgType,
            active: true,
            joinedAt: block.timestamp
        }));

        networkIdToOrgIndex[_networkId] = organizations.length - 1;
        isMemberAdmin[_adminAddress] = true;

        emit OrganizationRegistered(orgId, _name, _adminAddress, _networkId, _port);
        return orgId;
    }

    function totalOrganizations() public view returns (uint256) {
        return organizations.length;
    }

    function getAllOrganizations() public view returns (Organization[] memory) {
        return organizations;
    }

    function getOrganizationByIndex(uint256 index) public view returns (Organization memory) {
        require(index < organizations.length, "Index out of bounds");
        return organizations[index];
    }

    // --- Governance Proposal & Voting Methods ---
    function proposeFork(
        string memory _orgName,
        uint256 _networkId,
        uint256 _portNumber,
        uint256 _parentNetworkId,
        uint256 _forkBlockNumber,
        string memory _justification,
        string memory _orgType
    ) public returns (uint256) {
        return proposeForkWithDetails(
            _orgName,
            _networkId,
            _portNumber,
            _parentNetworkId,
            _forkBlockNumber,
            _justification,
            _orgType,
            "Patient, Observation, Condition",
            msg.sender
        );
    }

    function proposeForkWithDetails(
        string memory _orgName,
        uint256 _networkId,
        uint256 _portNumber,
        uint256 _parentNetworkId,
        uint256 _forkBlockNumber,
        string memory _justification,
        string memory _orgType,
        string memory _fhirCapability,
        address _initialAdmin
    ) public returns (uint256) {
        uint256 proposalId = proposals.length + 1;

        address admin = _initialAdmin == address(0) ? msg.sender : _initialAdmin;

        proposals.push(ForkProposal({
            proposalId: proposalId,
            proposer: msg.sender,
            orgName: _orgName,
            networkId: _networkId,
            portNumber: _portNumber,
            parentNetworkId: _parentNetworkId,
            parentChainForkBlockNumber: _forkBlockNumber,
            justification: _justification,
            orgType: _orgType,
            votesFor: 1, // Proposer automatic vote
            votesAgainst: 0,
            executed: false,
            createdAt: block.timestamp,
            fhirCapability: _fhirCapability,
            initialAdmin: admin
        }));

        hasVoted[proposalId][msg.sender] = true;

        emit ForkProposed(proposalId, msg.sender, _orgName, _networkId, _parentNetworkId);
        emit VoteCast(proposalId, msg.sender, true, 1, 0);

        return proposalId;
    }

    function totalProposals() public view returns (uint256) {
        return proposals.length;
    }

    function getAllProposals() public view returns (ForkProposal[] memory) {
        return proposals;
    }

    function getProposalByIndex(uint256 index) public view returns (ForkProposal memory) {
        require(index < proposals.length, "Index out of bounds");
        return proposals[index];
    }

    function voteOnProposal(uint256 _proposalId, bool _support) public {
        require(_proposalId > 0 && _proposalId <= proposals.length, "Invalid proposal ID");
        ForkProposal storage proposal = proposals[_proposalId - 1];
        require(!proposal.executed, "Proposal already executed");
        require(!hasVoted[_proposalId][msg.sender], "Already voted on this proposal");

        hasVoted[_proposalId][msg.sender] = true;

        if (_support) {
            proposal.votesFor += 1;
        } else {
            proposal.votesAgainst += 1;
        }

        emit VoteCast(_proposalId, msg.sender, _support, proposal.votesFor, proposal.votesAgainst);
    }

    function executeForkProposal(uint256 _proposalId) public {
        require(_proposalId > 0 && _proposalId <= proposals.length, "Invalid proposal ID");
        ForkProposal storage proposal = proposals[_proposalId - 1];
        require(!proposal.executed, "Proposal already executed");
        require(proposal.votesFor > proposal.votesAgainst, "Proposal does not have majority support");

        proposal.executed = true;

        // Automatically register fork into tree topology
        int256 netId = int256(proposal.networkId);
        int256 parentNetId = int256(proposal.parentNetworkId);
        int256 port = int256(proposal.portNumber);

        forkDetails.push(ForkDetail(netId, port, parentNetId, proposal.parentChainForkBlockNumber));
        adjacencyList[parentNetId].push(netId);

        // Register organization in consortium registry
        registerOrganization(
            proposal.orgName,
            proposal.initialAdmin,
            proposal.networkId,
            proposal.portNumber,
            proposal.orgType
        );

        emit ProposalExecuted(_proposalId, proposal.networkId, proposal.portNumber);
        emit ForkAdded(netId, parentNetId, port, proposal.parentChainForkBlockNumber);
    }

    // --- Inter-Organization & Cross-Fork Messaging Methods ---
    function sendMessage(
        uint256 _senderNetworkId,
        uint256 _recipientNetworkId,
        address _recipient,
        string memory _messageType,
        string memory _subject,
        string memory _fhirResourceType,
        string memory _fhirResourceId,
        string memory _payloadHash,
        string memory _payload,
        uint256 _responseToMessageId
    ) public returns (uint256) {
        uint256 messageId = messages.length + 1;

        messages.push(InterOrgMessage({
            messageId: messageId,
            senderNetworkId: _senderNetworkId,
            sender: msg.sender,
            recipientNetworkId: _recipientNetworkId,
            recipient: _recipient,
            messageType: _messageType,
            subject: _subject,
            fhirResourceType: _fhirResourceType,
            fhirResourceId: _fhirResourceId,
            payloadHash: _payloadHash,
            payload: _payload,
            status: 0, // PENDING
            timestamp: block.timestamp,
            responseToMessageId: _responseToMessageId
        }));

        orgMessageIndices[_senderNetworkId].push(messageId);
        orgMessageIndices[_recipientNetworkId].push(messageId);

        emit MessageSent(messageId, _senderNetworkId, _recipientNetworkId, _messageType, _fhirResourceType, _payloadHash);
        return messageId;
    }

    function updateMessageStatus(uint256 _messageId, uint8 _status) public {
        require(_messageId > 0 && _messageId <= messages.length, "Invalid message ID");
        require(_status <= 4, "Invalid status");

        InterOrgMessage storage msgObj = messages[_messageId - 1];
        msgObj.status = _status;

        emit MessageStatusUpdated(_messageId, _status, msg.sender);
    }

    function totalMessages() public view returns (uint256) {
        return messages.length;
    }

    function getAllMessages() public view returns (InterOrgMessage[] memory) {
        return messages;
    }

    function getMessageByIndex(uint256 index) public view returns (InterOrgMessage memory) {
        require(index < messages.length, "Index out of bounds");
        return messages[index];
    }

    function getMessagesForOrganization(uint256 _networkId) public view returns (uint256[] memory) {
        return orgMessageIndices[_networkId];
    }
}
