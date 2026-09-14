// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ConsortiumGovernance
 * @dev Shared Governance and Organization Topology Platform for BlockchainForkTree.
 * Manages consortium organizations, on-chain fork proposals, voting, and parent-child tree lineage.
 */
contract ConsortiumGovernance {

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
    }

    ForkProposal[] public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // Events
    event ForkAdded(int256 indexed networkId, int256 indexed parentNetworkId, int256 portNumber, uint256 forkBlockNumber);
    event OrganizationRegistered(uint256 indexed orgId, string name, address indexed adminAddress, uint256 networkId, uint256 port);
    event ForkProposed(uint256 indexed proposalId, address indexed proposer, string orgName, uint256 networkId, uint256 parentNetworkId);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 votesFor, uint256 votesAgainst);
    event ProposalExecuted(uint256 indexed proposalId, uint256 indexed networkId, uint256 portNumber);

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
        uint256 proposalId = proposals.length + 1;

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
            createdAt: block.timestamp
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
            proposal.proposer,
            proposal.networkId,
            proposal.portNumber,
            proposal.orgType
        );

        emit ProposalExecuted(_proposalId, proposal.networkId, proposal.portNumber);
        emit ForkAdded(netId, parentNetId, port, proposal.parentChainForkBlockNumber);
    }
}
