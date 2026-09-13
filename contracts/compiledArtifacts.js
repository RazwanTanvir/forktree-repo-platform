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
    "inputs": [{ "internalType": "uint256", "name": "index", "type": "uint256" }],
    "name": "getDataPointByIndex",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "blockNumber", "type": "uint256" },
          { "internalType": "int256", "name": "networkId", "type": "int256" },
          { "internalType": "int256", "name": "portNumber", "type": "int256" },
          { "internalType": "int256", "name": "data", "type": "int256" }
        ],
        "internalType": "struct DataStore.DataPoint",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getLastDataPoint",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "blockNumber", "type": "uint256" },
          { "internalType": "int256", "name": "networkId", "type": "int256" },
          { "internalType": "int256", "name": "portNumber", "type": "int256" },
          { "internalType": "int256", "name": "data", "type": "int256" }
        ],
        "internalType": "struct DataStore.DataPoint",
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
    contractName: "DataStore"
  }
};
