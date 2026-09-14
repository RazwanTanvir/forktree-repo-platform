// Core service for Fork Tree topology, Node monitoring, and DFS Traversal Search
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');
const { ContractClient } = require('./contractClient');
const { StoreForkEvent, BlockData } = require('../contracts/compiledArtifacts');
const topology = require('../config/networkTopology.json');
const { multiChainEngine } = require('../engine/chainEngine');

class ForkTreeService {
  constructor() {
    this.deploymentsPath = path.join(__dirname, '../config/deployments.json');
  }

  getDeployments() {
    if (fs.existsSync(this.deploymentsPath)) {
      return JSON.parse(fs.readFileSync(this.deploymentsPath, 'utf-8'));
    }
    return null;
  }

  async getNodeStatuses() {
    const statuses = [];

    // Repository node
    const repoConfig = topology.repositoryChain;
    statuses.push(await this._probeNode(repoConfig));

    // Data chains
    for (const chain of topology.chains) {
      statuses.push(await this._probeNode(chain));
    }

    return statuses;
  }

  async _probeNode(config) {
    const info = {
      port: config.port,
      networkId: config.networkId,
      name: config.name,
      rpcUrl: config.rpcUrl,
      role: config.port === 8545 ? 'repository' : (config.isRoot ? 'root' : 'fork'),
      parentNetworkId: config.parentNetworkId || null,
      forkBlockNumber: config.forkBlockNumber || 0,
      online: false,
      blockNumber: 0,
      contractDeployed: false,
      contractAddress: null,
      balance: '0'
    };

    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const blockNumHex = await provider.send('eth_blockNumber', []);
      const accounts = await provider.send('eth_accounts', []);

      info.online = true;
      info.blockNumber = parseInt(blockNumHex, 16);

      if (accounts && accounts.length > 0) {
        const balHex = await provider.send('eth_getBalance', [accounts[0], 'latest']);
        info.balance = ethers.formatEther(BigInt(balHex));
      }

      const deps = this.getDeployments();
      if (deps) {
        if (config.port === 8545 && deps.repository) {
          info.contractDeployed = true;
          info.contractAddress = deps.repository.address;
        } else if (deps.dataChains && deps.dataChains[config.networkId]) {
          info.contractDeployed = true;
          info.contractAddress = deps.dataChains[config.networkId].address;
        }
      }
    } catch (e) {
      info.online = false;
    }

    return info;
  }

  async getTreeTopology() {
    const deps = this.getDeployments();
    const result = {
      nodes: [],
      edges: [],
      adjacencyList: {},
      totalForks: 0
    };

    // If repository contract is deployed, query the actual on-chain topology
    if (deps && deps.repository) {
      try {
        const repoClient = new ContractClient(
          topology.repositoryChain.rpcUrl,
          StoreForkEvent.abi,
          deps.repository.address
        );

        const totalForksBn = await repoClient.call('totalForks');
        result.totalForks = Number(totalForksBn);

        const forkDetails = await repoClient.call('getAllForkDetails');

        for (const chain of topology.chains) {
          result.nodes.push({
            id: chain.networkId.toString(),
            name: chain.name,
            port: chain.port,
            isRoot: chain.isRoot,
            parentNetworkId: chain.parentNetworkId.toString(),
            forkBlockNumber: chain.forkBlockNumber
          });

          const pKey = chain.parentNetworkId.toString();
          const children = await repoClient.call('getAdjacencyList', [chain.parentNetworkId]);
          result.adjacencyList[pKey] = Array.from(children).map(c => c.toString());
        }

        // Build edges
        for (const detail of forkDetails) {
          const netId = detail.networkId.toString();
          const pId = detail.parentNetworkId.toString();
          if (pId !== '11101') {
            result.edges.push({
              source: pId,
              target: netId,
              forkBlock: Number(detail.parentChainForkBlockNumber)
            });
          }
        }

        return result;
      } catch (err) {
        console.warn('Failed to fetch on-chain topology, falling back to static topology:', err.message);
      }
    }

    // Fallback to static topology from config
    for (const chain of topology.chains) {
      result.nodes.push({
        id: chain.networkId.toString(),
        name: chain.name,
        port: chain.port,
        isRoot: chain.isRoot,
        parentNetworkId: chain.parentNetworkId.toString(),
        forkBlockNumber: chain.forkBlockNumber
      });

      const pKey = chain.parentNetworkId.toString();
      if (!result.adjacencyList[pKey]) {
        result.adjacencyList[pKey] = [];
      }
      result.adjacencyList[pKey].push(chain.networkId.toString());

      if (!chain.isRoot) {
        result.edges.push({
          source: chain.parentNetworkId.toString(),
          target: chain.networkId.toString(),
          forkBlock: chain.forkBlockNumber
        });
      }
    }

    result.totalForks = topology.chains.length;
    return result;
  }

  async getChainDataPoints(port) {
    const deps = this.getDeployments();
    const chainConfig = topology.chains.find(c => c.port === Number(port));
    if (!chainConfig || !deps || !deps.dataChains || !deps.dataChains[chainConfig.networkId]) {
      return [];
    }

    const contractInfo = deps.dataChains[chainConfig.networkId];
    const client = new ContractClient(chainConfig.rpcUrl, BlockData.abi, contractInfo.address);

    const points = await client.call('getAllDataPoints');
    return points.map(p => ({
      blockNumber: Number(p.blockNumber),
      networkId: Number(p.networkId),
      portNumber: Number(p.portNumber),
      data: Number(p.data)
    }));
  }

  async getAllDataPoints() {
    const all = {};
    for (const chain of topology.chains) {
      try {
        all[chain.port] = await this.getChainDataPoints(chain.port);
      } catch (err) {
        all[chain.port] = [];
      }
    }
    return all;
  }

  async getChainPatientRecords(port) {
    const deps = this.getDeployments();
    const chainConfig = topology.chains.find(c => c.port === Number(port));
    if (!chainConfig || !deps || !deps.dataChains || !deps.dataChains[chainConfig.networkId]) {
      return [];
    }

    const contractInfo = deps.dataChains[chainConfig.networkId];
    const client = new ContractClient(chainConfig.rpcUrl, BlockData.abi, contractInfo.address);

    const records = await client.call('getAllRecords');
    return records.map(r => {
      let parsedData = r.resourceData;
      try {
        parsedData = JSON.parse(r.resourceData);
      } catch (e) {}

      return {
        blockNumber: Number(r.blockNumber),
        networkId: Number(r.networkId),
        portNumber: Number(r.portNumber),
        patientId: r.patientId,
        resourceType: r.resourceType,
        clinicalCode: r.clinicalCode,
        resourceData: parsedData,
        rawResourceData: r.resourceData,
        dataHash: r.dataHash,
        timestamp: Number(r.timestamp),
        timestampIso: new Date(Number(r.timestamp) * 1000).toISOString()
      };
    });
  }

  async getAllPatientRecords() {
    const all = {};
    for (const chain of topology.chains) {
      try {
        all[chain.port] = await this.getChainPatientRecords(chain.port);
      } catch (err) {
        all[chain.port] = [];
      }
    }
    return all;
  }

  _resolveQueryType(searchValue, queryType) {
    if (queryType && ['patientId', 'resourceType', 'keyword', 'integer'].includes(queryType)) {
      return queryType;
    }
    if (typeof searchValue === 'number') {
      return 'integer';
    }
    const str = String(searchValue).trim();
    if (/^\d+$/.test(str) && Number(str) < 10000 && !str.startsWith('0')) {
      return 'integer';
    }
    if (/^P\d+$/i.test(str) || str.toUpperCase().startsWith('MRN')) {
      return 'patientId';
    }
    if (['patient', 'observation', 'condition', 'encounter', 'diagnosticreport', 'medicationrequest'].includes(str.toLowerCase())) {
      return 'resourceType';
    }
    return 'keyword';
  }

  async dfsSearch(startNetworkId = 11102, searchValue = 43, queryType = null) {
    const treeTopology = await this.getTreeTopology();
    const deps = this.getDeployments();
    const resolvedType = this._resolveQueryType(searchValue, queryType);

    const traversalPath = [];
    const matches = [];
    const longitudinalRecord = [];
    const visited = new Set();

    const dfs = async (currentNetId, depth = 0) => {
      if (visited.has(currentNetId)) return;
      visited.add(currentNetId);

      const chainConfig = topology.chains.find(c => c.networkId.toString() === currentNetId);
      if (!chainConfig) return;

      const pathEntry = {
        networkId: chainConfig.networkId,
        port: chainConfig.port,
        name: chainConfig.name,
        level: depth,
        depth,
        step: traversalPath.length + 1,
        timestamp: new Date().toISOString()
      };
      traversalPath.push(pathEntry);

      // Query chain contract for matching data
      if (deps && deps.dataChains && deps.dataChains[chainConfig.networkId]) {
        try {
          const client = new ContractClient(
            chainConfig.rpcUrl,
            BlockData.abi,
            deps.dataChains[chainConfig.networkId].address
          );

          let matchingBlocks = [];
          let matchingRecords = [];

          if (resolvedType === 'integer') {
            const res = await client.call('searchMatchingDataPointsBlockNumbers', [BigInt(searchValue)]);
            matchingBlocks = Array.from(res).map(b => Number(b));
          } else {
            let res;
            if (resolvedType === 'patientId') {
              res = await client.call('searchByPatientId', [String(searchValue)]);
            } else if (resolvedType === 'resourceType') {
              res = await client.call('searchByResourceType', [String(searchValue)]);
            } else {
              res = await client.call('searchByKeyword', [String(searchValue)]);
            }
            matchingBlocks = Array.from(res).map(b => Number(b));

            if (matchingBlocks.length > 0) {
              const allRecs = await client.call('getAllRecords');
              for (const r of allRecs) {
                if (matchingBlocks.includes(Number(r.blockNumber))) {
                  let parsedData = r.resourceData;
                  try { parsedData = JSON.parse(r.resourceData); } catch (e) {}
                  const recObj = {
                    blockNumber: Number(r.blockNumber),
                    networkId: Number(r.networkId),
                    portNumber: Number(r.portNumber),
                    chainName: chainConfig.name,
                    patientId: r.patientId,
                    resourceType: r.resourceType,
                    clinicalCode: r.clinicalCode,
                    resourceData: parsedData,
                    rawResourceData: r.resourceData,
                    dataHash: r.dataHash,
                    timestamp: Number(r.timestamp),
                    timestampIso: new Date(Number(r.timestamp) * 1000).toISOString()
                  };
                  matchingRecords.push(recObj);
                  longitudinalRecord.push(recObj);
                }
              }
            }
          }

          if (matchingBlocks.length > 0) {
            matches.push({
              networkId: chainConfig.networkId,
              port: chainConfig.port,
              name: chainConfig.name,
              level: depth,
              depth,
              matchingBlocks,
              matchingRecords,
              searchValue: resolvedType === 'integer' ? Number(searchValue) : String(searchValue),
              queryType: resolvedType
            });
            pathEntry.foundMatch = true;
          }
        } catch (err) {
          console.error(`Error querying chain ${chainConfig.port} during DFS:`, err.message);
        }
      }

      // Recurse to children in adjacency list
      const children = treeTopology.adjacencyList[currentNetId] || [];
      for (const childNetId of children) {
        await dfs(childNetId, depth + 1);
      }
    };

    await dfs(startNetworkId.toString(), 0);

    longitudinalRecord.sort((a, b) => a.timestamp - b.timestamp);

    return {
      algorithm: 'DFS',
      query: {
        startNetworkId: Number(startNetworkId),
        searchValue: resolvedType === 'integer' ? Number(searchValue) : String(searchValue),
        queryType: resolvedType
      },
      traversalPath,
      matches,
      longitudinalRecord,
      visitedCount: visited.size,
      success: matches.length > 0
    };
  }

  async bfsSearch(startNetworkId = 11102, searchValue = 43, queryType = null) {
    const treeTopology = await this.getTreeTopology();
    const deps = this.getDeployments();
    const resolvedType = this._resolveQueryType(searchValue, queryType);

    const traversalPath = [];
    const matches = [];
    const longitudinalRecord = [];
    const visited = new Set();
    const queue = [{ id: startNetworkId.toString(), level: 0 }];

    while (queue.length > 0) {
      const { id: currentNetId, level } = queue.shift();
      if (visited.has(currentNetId)) continue;
      visited.add(currentNetId);

      const chainConfig = topology.chains.find(c => c.networkId.toString() === currentNetId);
      if (!chainConfig) continue;

      const pathEntry = {
        networkId: chainConfig.networkId,
        port: chainConfig.port,
        name: chainConfig.name,
        level,
        step: traversalPath.length + 1,
        timestamp: new Date().toISOString()
      };
      traversalPath.push(pathEntry);

      // Query chain contract for matching data
      if (deps && deps.dataChains && deps.dataChains[chainConfig.networkId]) {
        try {
          const client = new ContractClient(
            chainConfig.rpcUrl,
            BlockData.abi,
            deps.dataChains[chainConfig.networkId].address
          );

          let matchingBlocks = [];
          let matchingRecords = [];

          if (resolvedType === 'integer') {
            const res = await client.call('searchMatchingDataPointsBlockNumbers', [BigInt(searchValue)]);
            matchingBlocks = Array.from(res).map(b => Number(b));
          } else {
            let res;
            if (resolvedType === 'patientId') {
              res = await client.call('searchByPatientId', [String(searchValue)]);
            } else if (resolvedType === 'resourceType') {
              res = await client.call('searchByResourceType', [String(searchValue)]);
            } else {
              res = await client.call('searchByKeyword', [String(searchValue)]);
            }
            matchingBlocks = Array.from(res).map(b => Number(b));

            if (matchingBlocks.length > 0) {
              const allRecs = await client.call('getAllRecords');
              for (const r of allRecs) {
                if (matchingBlocks.includes(Number(r.blockNumber))) {
                  let parsedData = r.resourceData;
                  try { parsedData = JSON.parse(r.resourceData); } catch (e) {}
                  const recObj = {
                    blockNumber: Number(r.blockNumber),
                    networkId: Number(r.networkId),
                    portNumber: Number(r.portNumber),
                    chainName: chainConfig.name,
                    patientId: r.patientId,
                    resourceType: r.resourceType,
                    clinicalCode: r.clinicalCode,
                    resourceData: parsedData,
                    rawResourceData: r.resourceData,
                    dataHash: r.dataHash,
                    timestamp: Number(r.timestamp),
                    timestampIso: new Date(Number(r.timestamp) * 1000).toISOString()
                  };
                  matchingRecords.push(recObj);
                  longitudinalRecord.push(recObj);
                }
              }
            }
          }

          if (matchingBlocks.length > 0) {
            matches.push({
              networkId: chainConfig.networkId,
              port: chainConfig.port,
              name: chainConfig.name,
              level,
              matchingBlocks,
              matchingRecords,
              searchValue: resolvedType === 'integer' ? Number(searchValue) : String(searchValue),
              queryType: resolvedType
            });
            pathEntry.foundMatch = true;
          }
        } catch (err) {
          console.error(`Error querying chain ${chainConfig.port} during BFS:`, err.message);
        }
      }

      // Enqueue child nodes
      const children = treeTopology.adjacencyList[currentNetId] || [];
      for (const childNetId of children) {
        if (!visited.has(childNetId)) {
          queue.push({ id: childNetId, level: level + 1 });
        }
      }
    }

    longitudinalRecord.sort((a, b) => a.timestamp - b.timestamp);

    return {
      algorithm: 'BFS',
      query: {
        startNetworkId: Number(startNetworkId),
        searchValue: resolvedType === 'integer' ? Number(searchValue) : String(searchValue),
        queryType: resolvedType
      },
      traversalPath,
      matches,
      longitudinalRecord,
      visitedCount: visited.size,
      success: matches.length > 0
    };
  }

  async search(algorithm = 'DFS', startNetworkId = 11102, searchValue = 43, queryType = null) {
    if ((algorithm || '').toUpperCase() === 'BFS') {
      return this.bfsSearch(startNetworkId, searchValue, queryType);
    }
    return this.dfsSearch(startNetworkId, searchValue, queryType);
  }

  async getActiveChains() {
    const list = [];
    for (const chain of topology.chains) {
      let blockNumber = 0;
      let online = false;
      try {
        const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
        const bNum = await provider.send('eth_blockNumber', []);
        blockNumber = parseInt(bNum, 16);
        online = true;
      } catch (e) {}

      list.push({
        networkId: chain.networkId,
        port: chain.port,
        name: chain.name,
        rpcUrl: chain.rpcUrl,
        isRoot: !!chain.isRoot,
        parentNetworkId: chain.parentNetworkId,
        forkBlockNumber: chain.forkBlockNumber,
        blockNumber,
        online
      });
    }
    return list;
  }

  async createForkChain({ name, parentNetworkId, forkBlockNumber, initialData = [], initialPatientRecords = [] }) {
    const parentIdNum = Number(parentNetworkId);
    const parentChain = topology.chains.find(c => c.networkId === parentIdNum);
    if (!parentChain) {
      throw new Error(`Parent chain with Network ID ${parentNetworkId} not found`);
    }

    // Determine fork block number (default to parent's current block height)
    let finalForkBlock = Number(forkBlockNumber);
    if (isNaN(finalForkBlock) || finalForkBlock < 0) {
      try {
        const parentProvider = new ethers.JsonRpcProvider(parentChain.rpcUrl);
        const bNum = await parentProvider.send('eth_blockNumber', []);
        finalForkBlock = parseInt(bNum, 16);
      } catch (e) {
        finalForkBlock = 0;
      }
    }

    // 1. Spawn node in multiChainEngine
    const chainName = (name || '').trim() || `Fork from ${parentChain.name}`;
    const { node, nodeConfig } = await multiChainEngine.spawnForkNode({
      name: chainName,
      parentNetworkId: parentIdNum,
      forkBlockNumber: finalForkBlock
    });

    console.log(`[ForkTreeService] Spun up node ${nodeConfig.name} on Port ${nodeConfig.port} (Net ID ${nodeConfig.networkId})`);

    // 2. Deploy BlockData contract on new node
    let dataAddress = null;
    try {
      dataAddress = await ContractClient.deploy(nodeConfig.rpcUrl, BlockData.abi);
      console.log(`[ForkTreeService] Deployed BlockData at ${dataAddress} on Port ${nodeConfig.port}`);
    } catch (err) {
      console.error(`[ForkTreeService] Failed to deploy BlockData on ${nodeConfig.port}:`, err.message);
      throw new Error(`Failed to deploy contract on new chain: ${err.message}`);
    }

    // 3. Update deployments.json
    let deployments = this.getDeployments() || { repository: null, dataChains: {} };
    if (!deployments.dataChains) deployments.dataChains = {};
    deployments.dataChains[nodeConfig.networkId] = {
      networkId: nodeConfig.networkId,
      port: nodeConfig.port,
      name: nodeConfig.name,
      address: dataAddress,
      contractType: 'BlockData',
      rpcUrl: nodeConfig.rpcUrl
    };
    fs.writeFileSync(this.deploymentsPath, JSON.stringify(deployments, null, 2), 'utf-8');

    // 4. Register fork detail in StoreForkEvent contract on Port 8545 (Repository)
    if (deployments.repository && deployments.repository.address) {
      try {
        const repoClient = new ContractClient(
          topology.repositoryChain.rpcUrl,
          StoreForkEvent.abi,
          deployments.repository.address
        );
        await repoClient.send('addForkDetail', [
          nodeConfig.networkId,
          nodeConfig.port,
          nodeConfig.parentNetworkId,
          nodeConfig.forkBlockNumber
        ]);
        console.log(`[ForkTreeService] Registered fork event in repository on Port 8545`);
      } catch (err) {
        console.error('[ForkTreeService] Failed to register fork event in repository:', err.message);
      }
    }

    // 5. Seed initial patient records if provided
    const insertedRecords = [];
    if (Array.isArray(initialPatientRecords) && initialPatientRecords.length > 0) {
      try {
        const client = new ContractClient(nodeConfig.rpcUrl, BlockData.abi, dataAddress);
        for (const rec of initialPatientRecords) {
          const jsonStr = typeof rec.resourceData === 'string' ? rec.resourceData : JSON.stringify(rec.resourceData || {});
          const dataHash = crypto.createHash('sha256').update(jsonStr).digest('hex');
          const timestamp = rec.timestamp || Math.floor(Date.now() / 1000);

          await client.send('addPatientRecord', [
            nodeConfig.networkId,
            nodeConfig.port,
            rec.patientId || 'P101',
            rec.resourceType || 'Observation',
            rec.clinicalCode || 'CLIN-001',
            jsonStr,
            dataHash,
            timestamp
          ]);
          insertedRecords.push(rec);
        }
        console.log(`[ForkTreeService] Seeded ${insertedRecords.length} initial HL7 patient records on Port ${nodeConfig.port}`);
      } catch (err) {
        console.error(`[ForkTreeService] Failed to seed initial patient records on ${nodeConfig.port}:`, err.message);
      }
    }

    // 6. Seed initial legacy data points if provided
    const insertedPoints = [];
    if (Array.isArray(initialData) && initialData.length > 0) {
      try {
        const client = new ContractClient(nodeConfig.rpcUrl, BlockData.abi, dataAddress);
        for (const val of initialData) {
          const numVal = parseInt(val, 10);
          if (!isNaN(numVal)) {
            await client.send('addDataPoint', [nodeConfig.networkId, nodeConfig.port, numVal]);
            insertedPoints.push(numVal);
          }
        }
        console.log(`[ForkTreeService] Seeded ${insertedPoints.length} initial data points on Port ${nodeConfig.port}`);
      } catch (err) {
        console.error(`[ForkTreeService] Failed to seed initial data points on ${nodeConfig.port}:`, err.message);
      }
    }

    return {
      success: true,
      message: `Forked blockchain '${nodeConfig.name}' spun up successfully on Port ${nodeConfig.port}!`,
      node: {
        ...nodeConfig,
        contractAddress: dataAddress,
        initialData: insertedPoints,
        initialPatientRecords: insertedRecords
      }
    };
  }
}

module.exports = new ForkTreeService();
