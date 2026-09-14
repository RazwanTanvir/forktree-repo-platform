// Multi-Chain JSON-RPC Engine for BlockchainForkTree
// Spins up independent, standard Ethereum JSON-RPC 2.0 servers across ports 8545-8551
const http = require('http');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { StoreForkEvent, BlockData } = require('../contracts/compiledArtifacts');
const topology = require('../config/networkTopology.json');

const STATE_FILE = path.join(__dirname, '../storage/chain_state.json');

class BlockchainNode {
  constructor(config) {
    this.networkId = config.networkId;
    this.port = config.port;
    this.name = config.name;
    this.role = config.role || (config.port === 8545 ? 'repository' : 'data');
    this.isRoot = !!config.isRoot;
    this.parentNetworkId = config.parentNetworkId || null;
    this.forkBlockNumber = config.forkBlockNumber || 0;

    this.server = null;
    this.blockNumber = 0;
    this.accounts = ['0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02'];
    this.contracts = new Map(); // address -> contractInstance
    this.receipts = new Map(); // txHash -> receipt
    this.blocks = [];

    // Interfaces for decoding
    this.storeForkEventIface = new ethers.Interface(StoreForkEvent.abi);
    this.blockDataIface = new ethers.Interface(BlockData.abi);

    this._initGenesis();
    this.loadStateFromFile();
  }

  _initGenesis() {
    this.blocks.push({
      number: '0x0',
      hash: '0x' + (this.networkId.toString(16).padStart(64, '0')),
      parentHash: '0x' + '0'.repeat(64),
      timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16),
      transactions: []
    });
  }

  saveStateToFile() {
    try {
      const dir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      let allState = {};
      if (fs.existsSync(STATE_FILE)) {
        try { allState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); } catch (e) {}
      }

      const contractsObj = {};
      for (const [addr, c] of this.contracts) {
        contractsObj[addr] = {
          address: c.address,
          type: c.type,
          state: c.type === 'StoreForkEvent' ? {
            forkDetails: c.state.forkDetails.map(f => f.map(x => x.toString())),
            adjacencyList: Object.fromEntries(
              Array.from(c.state.adjacencyList.entries()).map(([k, v]) => [k, v.map(x => x.toString())])
            )
          } : {
            patientRecords: (c.state.patientRecords || []).map(r => [
              r[0].toString(),
              r[1].toString(),
              r[2].toString(),
              String(r[3]),
              String(r[4]),
              String(r[5]),
              String(r[6]),
              String(r[7]),
              r[8].toString()
            ]),
            dataPoints: (c.state.dataPoints || []).map(dp => dp.map(x => x.toString()))
          }
        };
      }

      allState[this.port] = {
        blockNumber: this.blockNumber,
        contracts: contractsObj,
        receipts: Array.from(this.receipts.entries())
      };

      fs.writeFileSync(STATE_FILE, JSON.stringify(allState, null, 2), 'utf-8');
    } catch (err) {
      console.warn(`[Node :${this.port}] Failed to save state:`, err.message);
    }
  }

  loadStateFromFile() {
    try {
      if (!fs.existsSync(STATE_FILE)) return;
      const allState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      const state = allState[this.port];
      if (!state) return;

      this.blockNumber = state.blockNumber || 0;
      if (state.receipts) {
        this.receipts = new Map(state.receipts);
      }
      if (state.contracts) {
        this.contracts.clear();
        for (const [addr, c] of Object.entries(state.contracts)) {
          this.contracts.set(addr.toLowerCase(), {
            address: c.address,
            type: c.type,
            state: c.type === 'StoreForkEvent' ? {
              forkDetails: (c.state.forkDetails || []).map(f => f.map(x => BigInt(x))),
              adjacencyList: new Map(
                Object.entries(c.state.adjacencyList || {}).map(([k, v]) => [k, v.map(x => BigInt(x))])
              )
            } : {
              patientRecords: (c.state.patientRecords || []).map(r => [
                BigInt(r[0]),
                BigInt(r[1]),
                BigInt(r[2]),
                String(r[3]),
                String(r[4]),
                String(r[5]),
                String(r[6]),
                String(r[7]),
                BigInt(r[8])
              ]),
              dataPoints: (c.state.dataPoints || []).map(dp => dp.map(x => BigInt(x)))
            }
          });
        }
      }
    } catch (err) {
      console.warn(`[Node :${this.port}] Failed to load state:`, err.message);
    }
  }

  start() {
    return new Promise((resolve, reject) => {
      this.loadStateFromFile();
      this.server = http.createServer((req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const rpcReq = JSON.parse(body);
              let rpcRes;
              if (Array.isArray(rpcReq)) {
                rpcRes = rpcReq.map(r => this.handleRpc(r));
              } else {
                rpcRes = this.handleRpc(rpcReq);
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(rpcRes));
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: null,
                error: { code: -32603, message: err.message }
              }));
            }
          });
        } else if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.getStatus()));
        } else {
          res.writeHead(405);
          res.end();
        }
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        resolve(this);
      });

      this.server.on('error', reject);
    });
  }

  stop() {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getStatus() {
    return {
      port: this.port,
      networkId: this.networkId,
      name: this.name,
      role: this.role,
      parentNetworkId: this.parentNetworkId,
      forkBlockNumber: this.forkBlockNumber,
      isRoot: this.isRoot,
      blockNumber: this.blockNumber,
      online: this.server !== null,
      contractsCount: this.contracts.size,
      contractAddresses: Array.from(this.contracts.keys())
    };
  }

  handleRpc(req) {
    if (!req || typeof req !== 'object') {
      return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
    }
    const { method, params = [], id = 1 } = req;

    switch (method) {
      case 'eth_chainId':
        return { jsonrpc: '2.0', id, result: '0x' + this.networkId.toString(16) };

      case 'net_version':
        return { jsonrpc: '2.0', id, result: this.networkId.toString() };

      case 'eth_blockNumber':
        return { jsonrpc: '2.0', id, result: '0x' + this.blockNumber.toString(16) };

      case 'eth_accounts':
        return { jsonrpc: '2.0', id, result: this.accounts };

      case 'eth_coinbase':
        return { jsonrpc: '2.0', id, result: this.accounts[0] };

      case 'eth_getBalance':
        return { jsonrpc: '2.0', id, result: '0x1000000000000000000000' }; // 1000 ETH

      case 'eth_gasPrice':
        return { jsonrpc: '2.0', id, result: '0x3b9aca00' }; // 1 Gwei

      case 'eth_estimateGas':
        return { jsonrpc: '2.0', id, result: '0x100000' };

      case 'eth_getTransactionCount':
        return { jsonrpc: '2.0', id, result: '0x' + this.receipts.size.toString(16) };

      case 'personal_unlockAccount':
        return { jsonrpc: '2.0', id, result: true };

      case 'eth_sendTransaction':
        return { jsonrpc: '2.0', id, result: this._executeTransaction(params[0]) };

      case 'eth_call':
        return { jsonrpc: '2.0', id, result: this._executeCall(params[0]) };

      case 'eth_getTransactionReceipt': {
        const hash = params[0];
        return { jsonrpc: '2.0', id, result: this.receipts.get(hash) || null };
      }

      case 'eth_getTransactionByHash': {
        const hash = params[0];
        const receipt = this.receipts.get(hash);
        if (!receipt) {
          return { jsonrpc: '2.0', id, result: null };
        }
        return {
          jsonrpc: '2.0',
          id,
          result: {
            hash: receipt.transactionHash,
            blockHash: receipt.blockHash,
            blockNumber: receipt.blockNumber,
            transactionIndex: receipt.transactionIndex,
            from: receipt.from,
            to: receipt.to,
            value: '0x0',
            gasPrice: '0x3b9aca00',
            gas: receipt.gasUsed,
            input: '0x',
            nonce: '0x0'
          }
        };
      }

      case 'eth_getCode': {
        const target = (params[0] || '').toLowerCase();
        const contract = this.contracts.get(target);
        return {
          jsonrpc: '2.0',
          id,
          result: contract ? '0x608060405234801561001057600080fd5b50' : '0x'
        };
      }

      case 'eth_getBlockByNumber':
        return { jsonrpc: '2.0', id, result: this._getBlock(params[0]) };

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method ${method} not implemented in simulated chain` }
        };
    }
  }

  _executeTransaction(tx) {
    this.blockNumber++;
    const txHash = ethers.keccak256(ethers.toUtf8Bytes(`tx-${this.port}-${this.blockNumber}-${Date.now()}-${Math.random()}`));

    let contractAddress = null;

    if (!tx.to || tx.to === '0x' || tx.to === ethers.ZeroAddress) {
      // Contract Deployment
      contractAddress = ethers.getCreateAddress({
        from: tx.from || this.accounts[0],
        nonce: this.contracts.size + 1
      });

      const isRepo = this.role === 'repository';
      this.contracts.set(contractAddress.toLowerCase(), {
        address: contractAddress,
        type: isRepo ? 'StoreForkEvent' : 'BlockData',
        state: isRepo
          ? { forkDetails: [], adjacencyList: new Map() }
          : { patientRecords: [], dataPoints: [] }
      });
    } else {
      // State-changing contract interaction
      const target = tx.to.toLowerCase();
      const contract = this.contracts.get(target);

      if (contract && tx.data) {
        if (contract.type === 'StoreForkEvent') {
          const parsed = this.storeForkEventIface.parseTransaction({ data: tx.data });
          if (parsed && parsed.name === 'addForkDetail') {
            const [networkId, portNumber, parentNetworkId, forkBlockNumber] = parsed.args;
            const detail = [
              BigInt(networkId),
              BigInt(portNumber),
              BigInt(parentNetworkId),
              BigInt(forkBlockNumber)
            ];
            contract.state.forkDetails.push(detail);

            const pIdKey = parentNetworkId.toString();
            if (!contract.state.adjacencyList.has(pIdKey)) {
              contract.state.adjacencyList.set(pIdKey, []);
            }
            contract.state.adjacencyList.get(pIdKey).push(BigInt(networkId));
          }
        } else if (contract.type === 'BlockData') {
          const parsed = this.blockDataIface.parseTransaction({ data: tx.data });
          if (parsed) {
            if (parsed.name === 'addPatientRecord') {
              const [networkId, portNumber, patientId, resourceType, clinicalCode, resourceData, dataHash, timestamp] = parsed.args;
              const record = [
                BigInt(this.blockNumber),
                BigInt(networkId),
                BigInt(portNumber),
                String(patientId),
                String(resourceType),
                String(clinicalCode),
                String(resourceData),
                String(dataHash),
                BigInt(timestamp || Math.floor(Date.now() / 1000))
              ];
              if (!contract.state.patientRecords) contract.state.patientRecords = [];
              contract.state.patientRecords.push(record);
            } else if (parsed.name === 'addDataPoint') {
              const [networkId, portNumber, data] = parsed.args;
              const point = [
                BigInt(this.blockNumber),
                BigInt(networkId),
                BigInt(portNumber),
                BigInt(data)
              ];
              if (!contract.state.dataPoints) contract.state.dataPoints = [];
              contract.state.dataPoints.push(point);
            }
          }
        }
      }
    }

    const receipt = {
      transactionHash: txHash,
      transactionIndex: '0x0',
      blockNumber: '0x' + this.blockNumber.toString(16),
      blockHash: ethers.keccak256(ethers.toUtf8Bytes(`block-${this.blockNumber}`)),
      cumulativeGasUsed: '0x5208',
      gasUsed: '0x5208',
      contractAddress: contractAddress,
      status: '0x1',
      from: tx.from || this.accounts[0],
      to: tx.to || null,
      logs: []
    };

    this.receipts.set(txHash, receipt);
    this.saveStateToFile();
    return txHash;
  }

  _executeCall(call) {
    const target = (call.to || '').toLowerCase();
    const contract = this.contracts.get(target);
    const data = call.data;

    if (!contract || !data) {
      return '0x';
    }

    if (contract.type === 'StoreForkEvent') {
      const parsed = this.storeForkEventIface.parseTransaction({ data });
      if (!parsed) return '0x';

      switch (parsed.name) {
        case 'totalForks': {
          return this.storeForkEventIface.encodeFunctionResult('totalForks', [BigInt(contract.state.forkDetails.length)]);
        }
        case 'getForkDetailByIndex': {
          const idx = Number(parsed.args[0]);
          const item = contract.state.forkDetails[idx] || [0n, 0n, 0n, 0n];
          return this.storeForkEventIface.encodeFunctionResult('getForkDetailByIndex', [item]);
        }
        case 'getAllForkDetails': {
          return this.storeForkEventIface.encodeFunctionResult('getAllForkDetails', [contract.state.forkDetails]);
        }
        case 'getAdjacencyList': {
          const key = parsed.args[0].toString();
          const list = contract.state.adjacencyList.get(key) || [];
          return this.storeForkEventIface.encodeFunctionResult('getAdjacencyList', [list]);
        }
      }
    } else if (contract.type === 'BlockData') {
      const parsed = this.blockDataIface.parseTransaction({ data });
      if (!parsed) return '0x';

      switch (parsed.name) {
        case 'totalRecords': {
          const len = (contract.state.patientRecords || []).length;
          return this.blockDataIface.encodeFunctionResult('totalRecords', [BigInt(len)]);
        }
        case 'getRecordByIndex': {
          const idx = Number(parsed.args[0]);
          const item = (contract.state.patientRecords || [])[idx] || [0n, 0n, 0n, '', '', '', '', '', 0n];
          return this.blockDataIface.encodeFunctionResult('getRecordByIndex', [item]);
        }
        case 'getAllRecords': {
          return this.blockDataIface.encodeFunctionResult('getAllRecords', [contract.state.patientRecords || []]);
        }
        case 'searchByPatientId': {
          const target = String(parsed.args[0]);
          const matching = [];
          for (const r of (contract.state.patientRecords || [])) {
            if (r[3] === target) {
              matching.push(r[0]);
            }
          }
          return this.blockDataIface.encodeFunctionResult('searchByPatientId', [matching]);
        }
        case 'searchByResourceType': {
          const target = String(parsed.args[0]).toLowerCase();
          const matching = [];
          for (const r of (contract.state.patientRecords || [])) {
            if (r[4].toLowerCase() === target) {
              matching.push(r[0]);
            }
          }
          return this.blockDataIface.encodeFunctionResult('searchByResourceType', [matching]);
        }
        case 'searchByKeyword': {
          const target = String(parsed.args[0]).toLowerCase();
          const matching = [];
          for (const r of (contract.state.patientRecords || [])) {
            if (r[3].toLowerCase().includes(target) ||
                r[4].toLowerCase().includes(target) ||
                r[5].toLowerCase().includes(target) ||
                r[6].toLowerCase().includes(target)) {
              matching.push(r[0]);
            }
          }
          return this.blockDataIface.encodeFunctionResult('searchByKeyword', [matching]);
        }
        case 'totalDataPoints': {
          return this.blockDataIface.encodeFunctionResult('totalDataPoints', [BigInt((contract.state.dataPoints || []).length)]);
        }
        case 'getDataPointByIndex': {
          const idx = Number(parsed.args[0]);
          const item = (contract.state.dataPoints || [])[idx] || [0n, 0n, 0n, 0n];
          return this.blockDataIface.encodeFunctionResult('getDataPointByIndex', [item]);
        }
        case 'getLastDataPoint': {
          const len = (contract.state.dataPoints || []).length;
          const item = len > 0 ? contract.state.dataPoints[len - 1] : [0n, 0n, 0n, 0n];
          return this.blockDataIface.encodeFunctionResult('getLastDataPoint', [item]);
        }
        case 'getAllDataPoints': {
          return this.blockDataIface.encodeFunctionResult('getAllDataPoints', [contract.state.dataPoints || []]);
        }
        case 'searchMatchingDataPointsBlockNumbers': {
          const targetValue = BigInt(parsed.args[0]);
          const matchingBlocks = [];
          for (const pt of (contract.state.dataPoints || [])) {
            if (pt[3] === targetValue) {
              matchingBlocks.push(pt[0]);
            }
          }
          return this.blockDataIface.encodeFunctionResult('searchMatchingDataPointsBlockNumbers', [matchingBlocks]);
        }
      }
    }

    return '0x';
  }

  _getBlock(blockTag) {
    return {
      number: '0x' + this.blockNumber.toString(16),
      hash: ethers.keccak256(ethers.toUtf8Bytes(`block-${this.blockNumber}`)),
      parentHash: '0x' + '0'.repeat(64),
      timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16),
      transactions: []
    };
  }
}

class MultiChainEngine {
  constructor() {
    this.nodes = new Map();
  }

  async startAll() {
    // 1. Repository chain on 8545
    const repoConfig = topology.repositoryChain;
    const repoNode = new BlockchainNode({ ...repoConfig, role: 'repository' });
    await repoNode.start();
    this.nodes.set(repoConfig.port, repoNode);

    // 2. Data chains on 8546-8551
    for (const chainConfig of topology.chains) {
      const node = new BlockchainNode({ ...chainConfig, role: 'data' });
      await node.start();
      this.nodes.set(chainConfig.port, node);
    }

    return this.nodes;
  }

  async stopAll() {
    for (const [_, node] of this.nodes) {
      await node.stop();
    }
    this.nodes.clear();
  }

  clearSavedState() {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }
  }

  getNode(port) {
    return this.nodes.get(Number(port)) || null;
  }

  getNodeByNetworkId(networkId) {
    for (const [_, node] of this.nodes) {
      if (node.networkId === Number(networkId)) return node;
    }
    return null;
  }

  async spawnForkNode({ name, parentNetworkId, forkBlockNumber = 0 }) {
    let maxPort = 8551;
    let maxNetworkId = 11107;

    for (const [port, node] of this.nodes) {
      if (port > maxPort) maxPort = port;
      if (node.networkId > maxNetworkId) maxNetworkId = node.networkId;
    }
    for (const c of topology.chains) {
      if (c.port > maxPort) maxPort = c.port;
      if (c.networkId > maxNetworkId) maxNetworkId = c.networkId;
    }

    const newPort = maxPort + 1;
    const newNetworkId = maxNetworkId + 1;

    const nodeConfig = {
      name: name || `Fork Chain ${newNetworkId}`,
      port: newPort,
      networkId: newNetworkId,
      rpcUrl: `http://localhost:${newPort}`,
      role: 'data',
      isRoot: false,
      parentNetworkId: Number(parentNetworkId),
      forkBlockNumber: Number(forkBlockNumber)
    };

    const node = new BlockchainNode(nodeConfig);
    await node.start();
    this.nodes.set(newPort, node);

    // Keep in-memory topology updated
    const exists = topology.chains.find(c => c.networkId === newNetworkId);
    if (!exists) {
      topology.chains.push(nodeConfig);
    }

    node.saveStateToFile();
    return { node, nodeConfig };
  }

  getAllStatus() {
    const list = [];
    for (const [_, node] of this.nodes) {
      list.push(node.getStatus());
    }
    return list;
  }
}

const multiChainEngine = new MultiChainEngine();

module.exports = {
  BlockchainNode,
  MultiChainEngine,
  multiChainEngine
};
