// Precompiled ABI and Bytecode for ConsortiumGovernance and BlockData contracts

const ConsortiumGovernanceAbi = [
  // Legacy StoreForkEvent Methods
  {
    "inputs": [
      { "internalType": "int256", "name": "_networkId", "type": "int256" },
      { "internalType": "int256", "name": "_portNumber", "type": "int256" },
      { "internalType": "int256", "name": "_parentNetworkId", "type": "int256" },
      { "internalType": "uint256", "name": "_parentChainForkBlockNumber", "type": "uint256" }
    ],
    "name": "addForkDetail",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalForks",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "index", "type": "uint256" }],
    "name": "getForkDetailByIndex",
    "outputs": [
      {
        "components": [
          { "internalType": "int256", "name": "networkId", "type": "int256" },
          { "internalType": "int256", "name": "portNumber", "type": "int256" },
          { "internalType": "int256", "name": "parentNetworkId", "type": "int256" },
          { "internalType": "uint256", "name": "parentChainForkBlockNumber", "type": "uint256" }
        ],
        "internalType": "struct ConsortiumGovernance.ForkDetail",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllForkDetails",
    "outputs": [
      {
        "components": [
          { "internalType": "int256", "name": "networkId", "type": "int256" },
          { "internalType": "int256", "name": "portNumber", "type": "int256" },
          { "internalType": "int256", "name": "parentNetworkId", "type": "int256" },
          { "internalType": "uint256", "name": "parentChainForkBlockNumber", "type": "uint256" }
        ],
        "internalType": "struct ConsortiumGovernance.ForkDetail[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "int256", "name": "_networkId", "type": "int256" }],
    "name": "getAdjacencyList",
    "outputs": [{ "internalType": "int256[]", "name": "", "type": "int256[]" }],
    "stateMutability": "view",
    "type": "function"
  },

  // Organization Registry Methods
  {
    "inputs": [
      { "internalType": "string", "name": "_name", "type": "string" },
      { "internalType": "address", "name": "_adminAddress", "type": "address" },
      { "internalType": "uint256", "name": "_networkId", "type": "uint256" },
      { "internalType": "uint256", "name": "_port", "type": "uint256" },
      { "internalType": "string", "name": "_orgType", "type": "string" }
    ],
    "name": "registerOrganization",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalOrganizations",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllOrganizations",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "orgId", "type": "uint256" },
          { "internalType": "string", "name": "name", "type": "string" },
          { "internalType": "address", "name": "adminAddress", "type": "address" },
          { "internalType": "uint256", "name": "networkId", "type": "uint256" },
          { "internalType": "uint256", "name": "port", "type": "uint256" },
          { "internalType": "string", "name": "orgType", "type": "string" },
          { "internalType": "bool", "name": "active", "type": "bool" },
          { "internalType": "uint256", "name": "joinedAt", "type": "uint256" }
        ],
        "internalType": "struct ConsortiumGovernance.Organization[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "index", "type": "uint256" }],
    "name": "getOrganizationByIndex",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "orgId", "type": "uint256" },
          { "internalType": "string", "name": "name", "type": "string" },
          { "internalType": "address", "name": "adminAddress", "type": "address" },
          { "internalType": "uint256", "name": "networkId", "type": "uint256" },
          { "internalType": "uint256", "name": "port", "type": "uint256" },
          { "internalType": "string", "name": "orgType", "type": "string" },
          { "internalType": "bool", "name": "active", "type": "bool" },
          { "internalType": "uint256", "name": "joinedAt", "type": "uint256" }
        ],
        "internalType": "struct ConsortiumGovernance.Organization",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },

  // Governance Proposals & Voting
  {
    "inputs": [
      { "internalType": "string", "name": "_orgName", "type": "string" },
      { "internalType": "uint256", "name": "_networkId", "type": "uint256" },
      { "internalType": "uint256", "name": "_portNumber", "type": "uint256" },
      { "internalType": "uint256", "name": "_parentNetworkId", "type": "uint256" },
      { "internalType": "uint256", "name": "_forkBlockNumber", "type": "uint256" },
      { "internalType": "string", "name": "_justification", "type": "string" },
      { "internalType": "string", "name": "_orgType", "type": "string" }
    ],
    "name": "proposeFork",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalProposals",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllProposals",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "proposalId", "type": "uint256" },
          { "internalType": "address", "name": "proposer", "type": "address" },
          { "internalType": "string", "name": "orgName", "type": "string" },
          { "internalType": "uint256", "name": "networkId", "type": "uint256" },
          { "internalType": "uint256", "name": "portNumber", "type": "uint256" },
          { "internalType": "uint256", "name": "parentNetworkId", "type": "uint256" },
          { "internalType": "uint256", "name": "parentChainForkBlockNumber", "type": "uint256" },
          { "internalType": "string", "name": "justification", "type": "string" },
          { "internalType": "string", "name": "orgType", "type": "string" },
          { "internalType": "uint256", "name": "votesFor", "type": "uint256" },
          { "internalType": "uint256", "name": "votesAgainst", "type": "uint256" },
          { "internalType": "bool", "name": "executed", "type": "bool" },
          { "internalType": "uint256", "name": "createdAt", "type": "uint256" }
        ],
        "internalType": "struct ConsortiumGovernance.ForkProposal[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "index", "type": "uint256" }],
    "name": "getProposalByIndex",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "proposalId", "type": "uint256" },
          { "internalType": "address", "name": "proposer", "type": "address" },
          { "internalType": "string", "name": "orgName", "type": "string" },
          { "internalType": "uint256", "name": "networkId", "type": "uint256" },
          { "internalType": "uint256", "name": "portNumber", "type": "uint256" },
          { "internalType": "uint256", "name": "parentNetworkId", "type": "uint256" },
          { "internalType": "uint256", "name": "parentChainForkBlockNumber", "type": "uint256" },
          { "internalType": "string", "name": "justification", "type": "string" },
          { "internalType": "string", "name": "orgType", "type": "string" },
          { "internalType": "uint256", "name": "votesFor", "type": "uint256" },
          { "internalType": "uint256", "name": "votesAgainst", "type": "uint256" },
          { "internalType": "bool", "name": "executed", "type": "bool" },
          { "internalType": "uint256", "name": "createdAt", "type": "uint256" }
        ],
        "internalType": "struct ConsortiumGovernance.ForkProposal",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_proposalId", "type": "uint256" },
      { "internalType": "bool", "name": "_support", "type": "bool" }
    ],
    "name": "voteOnProposal",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_proposalId", "type": "uint256" }],
    "name": "executeForkProposal",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const BlockDataAbi = [
  // RBAC & Stakeholder Ownership
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "account", "type": "address" },
      { "internalType": "uint8", "name": "role", "type": "uint8" }
    ],
    "name": "setStakeholderRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "getStakeholderRole",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "isAuthorizedClinician",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },

  // Consent Management
  {
    "inputs": [
      { "internalType": "string", "name": "_patientId", "type": "string" },
      { "internalType": "uint256", "name": "_targetOrgNetworkId", "type": "uint256" }
    ],
    "name": "grantConsent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "_patientId", "type": "string" },
      { "internalType": "uint256", "name": "_targetOrgNetworkId", "type": "uint256" }
    ],
    "name": "revokeConsent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "_patientId", "type": "string" },
      { "internalType": "uint256", "name": "_targetOrgNetworkId", "type": "uint256" }
    ],
    "name": "hasConsent",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },

  // HL7 FHIR Patient Records
  {
    "inputs": [
      { "internalType": "uint256", "name": "_networkId", "type": "uint256" },
      { "internalType": "uint256", "name": "_portNumber", "type": "uint256" },
      { "internalType": "string", "name": "_patientId", "type": "string" },
      { "internalType": "string", "name": "_resourceType", "type": "string" },
      { "internalType": "string", "name": "_clinicalCode", "type": "string" },
      { "internalType": "string", "name": "_resourceData", "type": "string" },
      { "internalType": "string", "name": "_dataHash", "type": "string" },
      { "internalType": "uint256", "name": "_timestamp", "type": "uint256" }
    ],
    "name": "addPatientRecordSecured",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_networkId", "type": "uint256" },
      { "internalType": "uint256", "name": "_portNumber", "type": "uint256" },
      { "internalType": "string", "name": "_patientId", "type": "string" },
      { "internalType": "string", "name": "_resourceType", "type": "string" },
      { "internalType": "string", "name": "_clinicalCode", "type": "string" },
      { "internalType": "string", "name": "_resourceData", "type": "string" },
      { "internalType": "string", "name": "_dataHash", "type": "string" },
      { "internalType": "uint256", "name": "_timestamp", "type": "uint256" }
    ],
    "name": "addPatientRecord",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalRecords",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "index", "type": "uint256" }],
    "name": "getRecordByIndex",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "blockNumber", "type": "uint256" },
          { "internalType": "uint256", "name": "networkId", "type": "uint256" },
          { "internalType": "uint256", "name": "portNumber", "type": "uint256" },
          { "internalType": "string", "name": "patientId", "type": "string" },
          { "internalType": "string", "name": "resourceType", "type": "string" },
          { "internalType": "string", "name": "clinicalCode", "type": "string" },
          { "internalType": "string", "name": "resourceData", "type": "string" },
          { "internalType": "string", "name": "dataHash", "type": "string" },
          { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
        ],
        "internalType": "struct BlockData.PatientHealthRecord",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllRecords",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "blockNumber", "type": "uint256" },
          { "internalType": "uint256", "name": "networkId", "type": "uint256" },
          { "internalType": "uint256", "name": "portNumber", "type": "uint256" },
          { "internalType": "string", "name": "patientId", "type": "string" },
          { "internalType": "string", "name": "resourceType", "type": "string" },
          { "internalType": "string", "name": "clinicalCode", "type": "string" },
          { "internalType": "string", "name": "resourceData", "type": "string" },
          { "internalType": "string", "name": "dataHash", "type": "string" },
          { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
        ],
        "internalType": "struct BlockData.PatientHealthRecord[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "string", "name": "_patientId", "type": "string" }],
    "name": "searchByPatientId",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "string", "name": "_resourceType", "type": "string" }],
    "name": "searchByResourceType",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "string", "name": "_keyword", "type": "string" }],
    "name": "searchByKeyword",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },

  // Legacy Integer Data Points
  {
    "inputs": [
      { "internalType": "uint256", "name": "_networkId", "type": "uint256" },
      { "internalType": "uint256", "name": "_portNumber", "type": "uint256" },
      { "internalType": "uint256", "name": "_data", "type": "uint256" }
    ],
    "name": "addDataPoint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalDataPoints",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "index", "type": "uint256" }],
    "name": "getDataPointByIndex",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "blockNumber", "type": "uint256" },
          { "internalType": "uint256", "name": "networkId", "type": "uint256" },
          { "internalType": "uint256", "name": "portNumber", "type": "uint256" },
          { "internalType": "uint256", "name": "data", "type": "uint256" }
        ],
        "internalType": "struct BlockData.DataPoint",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllDataPoints",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "blockNumber", "type": "uint256" },
          { "internalType": "uint256", "name": "networkId", "type": "uint256" },
          { "internalType": "uint256", "name": "portNumber", "type": "uint256" },
          { "internalType": "uint256", "name": "data", "type": "uint256" }
        ],
        "internalType": "struct BlockData.DataPoint[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "targetValue", "type": "uint256" }],
    "name": "searchMatchingDataPointsBlockNumbers",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const mockBytecode = "0x608060405234801561001057600080fd5b50";

module.exports = {
  ConsortiumGovernance: {
    abi: ConsortiumGovernanceAbi,
    bytecode: mockBytecode
  },
  // Maintain backward compatibility alias
  StoreForkEvent: {
    abi: ConsortiumGovernanceAbi,
    bytecode: mockBytecode
  },
  BlockData: {
    abi: BlockDataAbi,
    bytecode: mockBytecode
  }
};
