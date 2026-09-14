// Precompiled ABI and Bytecode for StoreForkEvent and BlockData contracts
const StoreForkEventAbi = [
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
        "internalType": "struct ForkDetailStore.ForkDetail",
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
        "internalType": "struct ForkDetailStore.ForkDetail[]",
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
  }
];

const BlockDataAbi = [
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
    "outputs": [],
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
  // Legacy backward compatibility
  {
    "inputs": [
      { "internalType": "int256", "name": "_networkId", "type": "int256" },
      { "internalType": "int256", "name": "_portNumber", "type": "int256" },
      { "internalType": "int256", "name": "_data", "type": "int256" }
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
    "inputs": [],
    "name": "getAllDataPoints",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "blockNumber", "type": "uint256" },
          { "internalType": "int256", "name": "networkId", "type": "int256" },
          { "internalType": "int256", "name": "portNumber", "type": "int256" },
          { "internalType": "int256", "name": "data", "type": "int256" }
        ],
        "internalType": "struct DataStore.DataPoint[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "int256", "name": "_data", "type": "int256" }],
    "name": "searchMatchingDataPointsBlockNumbers",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  }
];

module.exports = {
  StoreForkEvent: {
    abi: StoreForkEventAbi,
    contractName: "ForkDetailStore"
  },
  BlockData: {
    abi: BlockDataAbi,
    contractName: "BlockData"
  }
};
