// Core service for Fork Tree topology, Node monitoring, and DFS Traversal Search
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');
const { ContractClient } = require('./contractClient');
const { ConsortiumGovernance, StoreForkEvent, BlockData } = require('../contracts/compiledArtifacts');
const storageAdapter = require('./storageAdapter');
const topology = require('../config/networkTopology.json');
const { multiChainEngine } = require('../engine/chainEngine');

let stakeholdersConfig = { personas: [], defaultStakeholders: {} };
try {
  stakeholdersConfig = require('../config/consortiumStakeholders.json');
} catch (e) {}

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
    if (!deps || !deps.repository || !deps.repository.address) {
      return this._getFallbackTopology();
    }

    try {
      const repoClient = new ContractClient(
        topology.repositoryChain.rpcUrl,
        ConsortiumGovernance.abi,
        deps.repository.address
      );

      const totalForks = await repoClient.call('totalForks');
      const forkCount = Number(totalForks);

      if (forkCount === 0) {
        return this._getFallbackTopology();
      }

      const allDetails = await repoClient.call('getAllForkDetails');

      const nodes = [];
      const edges = [];
      const adjacency = {};

      const rootChain = topology.chains.find(c => c.isRoot) || topology.chains[0];

      const seenNodes = new Set();
      const seenEdges = new Set();

      for (const fork of allDetails) {
        const netId = Number(fork.networkId || fork[0]);
        const port = Number(fork.portNumber || fork[1]);
        const parentNetId = Number(fork.parentNetworkId || fork[2]);
        const forkBlock = Number(fork.parentChainForkBlockNumber || fork[3]);

        if (!seenNodes.has(netId)) {
          seenNodes.add(netId);
          const chainMeta = topology.chains.find(c => c.networkId === netId) || {
            name: `Fork Chain ${netId}`,
            isRoot: false
          };

          nodes.push({
            networkId: netId,
            port,
            name: chainMeta.name,
            isRoot: netId === rootChain.networkId,
            parentNetworkId: parentNetId,
            forkBlockNumber: forkBlock,
            contractAddress: (deps.dataChains && deps.dataChains[netId]) ? deps.dataChains[netId].address : null
          });
        }

        const edgeKey = `${parentNetId}->${netId}`;
        if (parentNetId !== topology.repositoryChain.networkId && !seenEdges.has(edgeKey)) {
          seenEdges.add(edgeKey);
          edges.push({
            from: parentNetId,
            to: netId,
            forkBlock
          });

          if (!adjacency[parentNetId]) adjacency[parentNetId] = [];
          adjacency[parentNetId].push(netId);
        }
      }

      return {
        rootNetworkId: rootChain.networkId,
        nodes,
        edges,
        adjacency
      };
    } catch (err) {
      console.warn('[ForkTreeService] Falling back to config topology due to error:', err.message);
      return this._getFallbackTopology();
    }
  }

  _getFallbackTopology() {
    const nodes = topology.chains.map(c => ({
      networkId: c.networkId,
      port: c.port,
      name: c.name,
      isRoot: !!c.isRoot,
      parentNetworkId: c.parentNetworkId,
      forkBlockNumber: c.forkBlockNumber
    }));

    const edges = [];
    const adjacency = {};
    const rootChain = topology.chains.find(c => c.isRoot) || topology.chains[0];

    for (const c of topology.chains) {
      if (c.parentNetworkId && c.parentNetworkId !== topology.repositoryChain.networkId) {
        edges.push({
          from: c.parentNetworkId,
          to: c.networkId,
          forkBlock: c.forkBlockNumber
        });
        if (!adjacency[c.parentNetworkId]) adjacency[c.parentNetworkId] = [];
        adjacency[c.parentNetworkId].push(c.networkId);
      }
    }

    return {
      rootNetworkId: rootChain.networkId,
      nodes,
      edges,
      adjacency
    };
  }

  // --- Consortium Governance Methods ---
  async getOrganizations() {
    const deps = this.getDeployments();
    if (!deps || !deps.repository || !deps.repository.address) {
      return [];
    }
    try {
      const repoClient = new ContractClient(
        topology.repositoryChain.rpcUrl,
        ConsortiumGovernance.abi,
        deps.repository.address
      );
      const rawOrgs = await repoClient.call('getAllOrganizations');
      const list = [];
      for (const o of rawOrgs) {
        list.push({
          orgId: Number(o.orgId || o[0]),
          name: String(o.name || o[1]),
          adminAddress: String(o.adminAddress || o[2]),
          networkId: Number(o.networkId || o[3]),
          port: Number(o.port || o[4]),
          orgType: String(o.orgType || o[5]),
          active: Boolean(o.active !== undefined ? o.active : o[6]),
          joinedAt: Number(o.joinedAt || o[7])
        });
      }
      return list;
    } catch (e) {
      console.warn('[ForkTreeService] Failed to fetch organizations:', e.message);
      return [];
    }
  }

  async getProposals() {
    const deps = this.getDeployments();
    if (!deps || !deps.repository || !deps.repository.address) {
      return [];
    }
    try {
      const repoClient = new ContractClient(
        topology.repositoryChain.rpcUrl,
        ConsortiumGovernance.abi,
        deps.repository.address
      );
      const rawProps = await repoClient.call('getAllProposals');
      const list = [];
      for (const p of rawProps) {
        list.push({
          proposalId: Number(p.proposalId || p[0]),
          proposer: String(p.proposer || p[1]),
          orgName: String(p.orgName || p[2]),
          networkId: Number(p.networkId || p[3]),
          portNumber: Number(p.portNumber || p[4]),
          parentNetworkId: Number(p.parentNetworkId || p[5]),
          parentChainForkBlockNumber: Number(p.parentChainForkBlockNumber || p[6]),
          justification: String(p.justification || p[7]),
          orgType: String(p.orgType || p[8]),
          votesFor: Number(p.votesFor || p[9]),
          votesAgainst: Number(p.votesAgainst || p[10]),
          executed: Boolean(p.executed !== undefined ? p.executed : p[11]),
          createdAt: Number(p.createdAt || p[12])
        });
      }
      return list;
    } catch (e) {
      console.warn('[ForkTreeService] Failed to fetch proposals:', e.message);
      return [];
    }
  }

  async submitForkProposal(proposalData) {
    const deps = this.getDeployments();
    if (!deps || !deps.repository || !deps.repository.address) {
      throw new Error('Repository contract not deployed');
    }
    const repoClient = new ContractClient(
      topology.repositoryChain.rpcUrl,
      ConsortiumGovernance.abi,
      deps.repository.address
    );

    let parentNetId = Number(proposalData.parentNetworkId || 11102);
    let forkBlock = Number(proposalData.forkBlockNumber);
    if (isNaN(forkBlock) || forkBlock < 0) {
      try {
        const parentChain = topology.chains.find(c => c.networkId === parentNetId);
        if (parentChain) {
          const prov = new ethers.JsonRpcProvider(parentChain.rpcUrl);
          const bNum = await prov.send('eth_blockNumber', []);
          forkBlock = parseInt(bNum, 16);
        } else {
          forkBlock = 0;
        }
      } catch (e) {
        forkBlock = 0;
      }
    }

    let maxPort = 8551;
    let maxNetId = 11107;
    for (const c of topology.chains) {
      if (c.port > maxPort) maxPort = c.port;
      if (c.networkId > maxNetId) maxNetId = c.networkId;
    }
    const port = Number(proposalData.portNumber) || (maxPort + 1);
    const netId = Number(proposalData.networkId) || (maxNetId + 1);
    const proposer = proposalData.proposerAddress || '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02';

    const tx = await repoClient.send('proposeFork', [
      proposalData.orgName || `Fork ${netId}`,
      netId,
      port,
      parentNetId,
      forkBlock,
      proposalData.justification || 'Healthcare Specialty Branch Proposal',
      proposalData.orgType || 'Specialty Clinic'
    ], proposer);

    return {
      success: true,
      txHash: tx.hash,
      proposal: {
        proposer,
        orgName: proposalData.orgName,
        networkId: netId,
        portNumber: port,
        parentNetworkId: parentNetId,
        forkBlockNumber: forkBlock,
        justification: proposalData.justification,
        orgType: proposalData.orgType
      }
    };
  }

  async voteProposal({ voterAddress, proposalId, support = true }) {
    const deps = this.getDeployments();
    if (!deps || !deps.repository || !deps.repository.address) {
      throw new Error('Repository contract not deployed');
    }
    const repoClient = new ContractClient(
      topology.repositoryChain.rpcUrl,
      ConsortiumGovernance.abi,
      deps.repository.address
    );
    const voter = voterAddress || '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02';
    const tx = await repoClient.send('voteOnProposal', [
      BigInt(proposalId),
      Boolean(support)
    ], voter);

    return {
      success: true,
      proposalId: Number(proposalId),
      voter,
      support: Boolean(support),
      txHash: tx.hash
    };
  }

  async executeProposal({ executorAddress, proposalId, initialPatientRecords = [] }) {
    const deps = this.getDeployments();
    if (!deps || !deps.repository || !deps.repository.address) {
      throw new Error('Repository contract not deployed');
    }
    const repoClient = new ContractClient(
      topology.repositoryChain.rpcUrl,
      ConsortiumGovernance.abi,
      deps.repository.address
    );

    const proposals = await this.getProposals();
    const target = proposals.find(p => p.proposalId === Number(proposalId));
    if (!target) {
      throw new Error(`Proposal ID ${proposalId} not found`);
    }

    const executor = executorAddress || '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02';
    const tx = await repoClient.send('executeForkProposal', [BigInt(proposalId)], executor);

    // Spin up physical node
    let spunNodeResult = null;
    try {
      spunNodeResult = await this.createForkChain({
        name: target.orgName,
        parentNetworkId: target.parentNetworkId,
        forkBlockNumber: target.parentChainForkBlockNumber,
        initialPatientRecords
      });
    } catch (e) {
      console.warn('[ForkTreeService] Node creation:', e.message);
    }

    return {
      success: true,
      proposalId: Number(proposalId),
      executed: true,
      txHash: tx.hash,
      nodeResult: spunNodeResult
    };
  }

  // --- Stakeholder RBAC Management ---
  async getStakeholders(port) {
    const portNum = Number(port);
    const chain = topology.chains.find(c => c.port === portNum);
    if (!chain) return [];

    const deps = this.getDeployments();
    const chainDep = deps && deps.dataChains && deps.dataChains[chain.networkId];
    if (!chainDep) return [];

    const node = multiChainEngine.getNode(portNum);
    const stakeholders = [];

    const personas = (stakeholdersConfig && stakeholdersConfig.personas) || [];
    for (const p of personas) {
      if (p.port === portNum) {
        stakeholders.push({
          address: p.address,
          name: p.name,
          title: p.title,
          role: p.role,
          avatar: p.avatar
        });
      }
    }

    if (node) {
      for (const [_, contract] of node.contracts) {
        if (contract.type === 'BlockData' && contract.state.stakeholders) {
          for (const [sAddr, roleNum] of contract.state.stakeholders) {
            const exists = stakeholders.find(s => s.address.toLowerCase() === sAddr.toLowerCase());
            if (!exists) {
              const rName = roleNum === 3 ? 'ADMIN' : roleNum === 1 ? 'CLINICIAN' : roleNum === 2 ? 'AUDITOR' : 'PATIENT';
              stakeholders.push({
                address: sAddr,
                name: `Stakeholder ${sAddr.slice(0, 6)}`,
                title: `${rName} Role`,
                role: rName,
                avatar: roleNum === 1 ? '🩺' : roleNum === 3 ? '🏥' : '👤'
              });
            }
          }
        }
      }
    }

    return stakeholders;
  }

  async setStakeholderRole(port, ownerAddress, targetAddress, role = 1) {
    const portNum = Number(port);
    const chain = topology.chains.find(c => c.port === portNum);
    if (!chain) throw new Error(`Chain on port ${port} not found`);

    const deps = this.getDeployments();
    const chainDep = deps && deps.dataChains && deps.dataChains[chain.networkId];
    if (!chainDep) throw new Error(`Contract on port ${port} not deployed`);

    const client = new ContractClient(chain.rpcUrl, BlockData.abi, chainDep.address);
    const tx = await client.send('setStakeholderRole', [
      targetAddress,
      Number(role)
    ], ownerAddress);

    return {
      success: true,
      port: portNum,
      targetAddress,
      role: Number(role),
      txHash: tx.hash
    };
  }

  async addPatientRecord({ port, patientId, resourceType, clinicalCode, resourceData, callerAddress = null }) {
    const portNum = Number(port);
    const chain = topology.chains.find(c => c.port === portNum);
    if (!chain) throw new Error(`Chain with port ${port} not found`);

    const deps = this.getDeployments();
    const chainDep = deps && deps.dataChains && deps.dataChains[chain.networkId];
    if (!chainDep) throw new Error(`Contract for port ${port} not deployed`);

    const client = new ContractClient(chain.rpcUrl, BlockData.abi, chainDep.address);
    const jsonStr = typeof resourceData === 'string' ? resourceData : JSON.stringify(resourceData || {});
    const dataHash = crypto.createHash('sha256').update(jsonStr).digest('hex');
    const timestamp = Math.floor(Date.now() / 1000);

    const fromAddr = callerAddress || '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02';

    const tx = await client.send('addPatientRecord', [
      chain.networkId,
      chain.port,
      patientId,
      resourceType,
      clinicalCode,
      jsonStr,
      dataHash,
      timestamp
    ], fromAddr);

    // Store encrypted in hybrid off-chain vault (AES-256-GCM)
    let vaultResult = null;
    try {
      vaultResult = storageAdapter.storeEncryptedPayload(jsonStr);
    } catch (e) {
      console.warn('[ForkTreeService] Vault storage warning:', e.message);
    }

    return {
      success: true,
      port: portNum,
      networkId: chain.networkId,
      patientId,
      resourceType,
      clinicalCode,
      dataHash,
      vaultCid: vaultResult ? vaultResult.cid : null,
      timestamp,
      txHash: tx.hash,
      callerAddress: fromAddr
    };
  }

  async getChainDataPoints(port) {
    const chain = topology.chains.find(c => c.port === Number(port));
    if (!chain) return [];

    const deps = this.getDeployments();
    if (!deps || !deps.dataChains || !deps.dataChains[chain.networkId]) {
      return [];
    }

    try {
      const client = new ContractClient(chain.rpcUrl, BlockData.abi, deps.dataChains[chain.networkId].address);
      const points = await client.call('getAllDataPoints');
      return Array.from(points).map(p => ({
        blockNumber: Number(p.blockNumber || p[0]),
        networkId: Number(p.networkId || p[1]),
        portNumber: Number(p.portNumber || p[2]),
        data: Number(p.data || p[3])
      }));
    } catch (e) {
      console.warn(`[ForkTreeService] Could not fetch data points from :${port}:`, e.message);
      return [];
    }
  }

  async getChainPatientRecords(port) {
    const chain = topology.chains.find(c => c.port === Number(port));
    if (!chain) return [];

    const deps = this.getDeployments();
    if (!deps || !deps.dataChains || !deps.dataChains[chain.networkId]) {
      return [];
    }

    try {
      const client = new ContractClient(chain.rpcUrl, BlockData.abi, deps.dataChains[chain.networkId].address);
      const records = await client.call('getAllRecords');
      return Array.from(records).map(r => {
        let parsedData = r.resourceData || r[6];
        try { parsedData = JSON.parse(parsedData); } catch (e) {}

        const tsSec = Number(r.timestamp || r[8]);
        const isoTime = tsSec ? new Date(tsSec * 1000).toISOString() : new Date().toISOString();

        return {
          blockNumber: Number(r.blockNumber || r[0]),
          networkId: Number(r.networkId || r[1]),
          portNumber: Number(r.portNumber || r[2]),
          chainName: chain.name,
          patientId: String(r.patientId || r[3]),
          resourceType: String(r.resourceType || r[4]),
          clinicalCode: String(r.clinicalCode || r[5]),
          resourceData: parsedData,
          rawResourceData: String(r.resourceData || r[6]),
          dataHash: String(r.dataHash || r[7]),
          timestamp: tsSec,
          timestampIso: isoTime
        };
      });
    } catch (e) {
      console.warn(`[ForkTreeService] Could not fetch patient records from :${port}:`, e.message);
      return [];
    }
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

      const chainConfig = topology.chains.find(c => c.networkId.toString() === currentNetId.toString());
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

      if (deps && deps.dataChains && deps.dataChains[chainConfig.networkId]) {
        try {
          const client = new ContractClient(
            chainConfig.rpcUrl,
            BlockData.abi,
            deps.dataChains[chainConfig.networkId].address
          );

          let matchingBlocks = [];

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
                    patientId: String(r.patientId),
                    resourceType: String(r.resourceType),
                    clinicalCode: String(r.clinicalCode),
                    resourceData: parsedData,
                    rawResourceData: String(r.resourceData),
                    dataHash: String(r.dataHash),
                    timestamp: Number(r.timestamp),
                    timestampIso: new Date(Number(r.timestamp) * 1000).toISOString()
                  };
                  longitudinalRecord.push(recObj);
                }
              }
            }
          }

          if (matchingBlocks.length > 0) {
            matches.push({
              networkId: chainConfig.networkId,
              port: chainConfig.port,
              chainName: chainConfig.name,
              matchingBlocks,
              found: true,
              queryType: resolvedType
            });
            pathEntry.found = true;
          }
        } catch (err) {
          console.warn(`[ForkTreeService] Error querying chain ${chainConfig.port}:`, err.message);
        }
      }

      const children = treeTopology.adjacency[currentNetId] || [];
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
    const queue = [{ netId: startNetworkId.toString(), level: 0 }];

    while (queue.length > 0) {
      const { netId, level } = queue.shift();

      if (visited.has(netId)) continue;
      visited.add(netId);

      const chainConfig = topology.chains.find(c => c.networkId.toString() === netId.toString());
      if (!chainConfig) continue;

      const pathEntry = {
        networkId: chainConfig.networkId,
        port: chainConfig.port,
        name: chainConfig.name,
        level,
        depth: level,
        step: traversalPath.length + 1,
        timestamp: new Date().toISOString()
      };
      traversalPath.push(pathEntry);

      if (deps && deps.dataChains && deps.dataChains[chainConfig.networkId]) {
        try {
          const client = new ContractClient(
            chainConfig.rpcUrl,
            BlockData.abi,
            deps.dataChains[chainConfig.networkId].address
          );

          let matchingBlocks = [];

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
                    patientId: String(r.patientId),
                    resourceType: String(r.resourceType),
                    clinicalCode: String(r.clinicalCode),
                    resourceData: parsedData,
                    rawResourceData: String(r.resourceData),
                    dataHash: String(r.dataHash),
                    timestamp: Number(r.timestamp),
                    timestampIso: new Date(Number(r.timestamp) * 1000).toISOString()
                  };
                  longitudinalRecord.push(recObj);
                }
              }
            }
          }

          if (matchingBlocks.length > 0) {
            matches.push({
              networkId: chainConfig.networkId,
              port: chainConfig.port,
              chainName: chainConfig.name,
              matchingBlocks,
              found: true,
              queryType: resolvedType
            });
            pathEntry.found = true;
          }
        } catch (err) {
          console.warn(`[ForkTreeService] Error querying chain ${chainConfig.port}:`, err.message);
        }
      }

      const children = treeTopology.adjacency[netId] || [];
      for (const childNetId of children) {
        if (!visited.has(childNetId.toString())) {
          queue.push({ netId: childNetId.toString(), level: level + 1 });
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
          ConsortiumGovernance.abi,
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

  // --- Steering Council Project Methods ---
  async getProjects() {
    const deps = this.getDeployments();
    if (!deps || !deps.repository || !deps.repository.address) {
      return [];
    }

    try {
      const client = new ContractClient(
        topology.repositoryChain.rpcUrl,
        ConsortiumGovernance.abi,
        deps.repository.address
      );
      const raw = await client.call('getAllProjects');
      return Array.from(raw).map(p => ({
        projectId: Number(p.projectId || p[0]),
        name: String(p.name || p[1]),
        description: String(p.description || p[2]),
        owner: String(p.owner || p[3]),
        rootNetworkId: Number(p.rootNetworkId || p[4]),
        active: Boolean(p.active !== undefined ? p.active : p[5]),
        createdAt: Number(p.createdAt || p[6]),
        createdAtIso: new Date(Number(p.createdAt || p[6]) * 1000).toISOString()
      }));
    } catch (err) {
      console.warn('[ForkTreeService] Failed to fetch projects:', err.message);
      return [];
    }
  }

  async createProject({ name, description, rootNetworkId, callerAddress }) {
    const deps = this.getDeployments();
    if (!deps || !deps.repository || !deps.repository.address) {
      throw new Error('Repository contract not deployed');
    }

    const client = new ContractClient(
      topology.repositoryChain.rpcUrl,
      ConsortiumGovernance.abi,
      deps.repository.address
    );

    const fromAddr = callerAddress || '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02';
    const tx = await client.send('createProject', [
      name,
      description,
      BigInt(rootNetworkId || 11102)
    ], fromAddr);

    return {
      success: true,
      message: `Project "${name}" created on Steering Council Governance Hub`,
      txHash: tx.hash
    };
  }

  // --- Detailed Fork Proposals ---
  async submitDetailedForkProposal({
    orgName,
    networkId,
    portNumber,
    parentNetworkId,
    forkBlockNumber,
    justification,
    orgType = 'Specialty Clinic',
    fhirCapability = 'Patient, Observation, Condition',
    initialAdmin,
    callerAddress
  }) {
    const deps = this.getDeployments();
    if (!deps || !deps.repository || !deps.repository.address) {
      throw new Error('Consortium governance contract not deployed');
    }

    const client = new ContractClient(
      topology.repositoryChain.rpcUrl,
      ConsortiumGovernance.abi,
      deps.repository.address
    );

    const fromAddr = callerAddress || '0x1111111111111111111111111111111111111111';
    const adminAddr = initialAdmin || fromAddr;

    let targetPort = Number(portNumber);
    if (!targetPort || targetPort <= 0) {
      const active = await this.getActiveChains();
      const maxPort = active.reduce((max, c) => Math.max(max, c.port), 8551);
      targetPort = maxPort + 1;
    }

    let targetNet = Number(networkId);
    if (!targetNet || targetNet <= 0) {
      targetNet = targetPort + 2556;
    }

    let forkBlock = Number(forkBlockNumber);
    if (isNaN(forkBlock) || forkBlock < 0) forkBlock = 0;

    const tx = await client.send('proposeForkWithDetails', [
      orgName,
      targetNet,
      targetPort,
      Number(parentNetworkId),
      forkBlock,
      justification || `Operational fork for ${orgName}`,
      orgType,
      fhirCapability,
      adminAddr
    ], fromAddr);

    return {
      success: true,
      message: `Detailed fork request for '${orgName}' (${orgType}) submitted to consortium ballot`,
      txHash: tx.hash,
      networkId: targetNet,
      portNumber: targetPort
    };
  }

  // --- Inter-Organization Messaging & Cross-Fork FHIR Gateway ---
  async sendMessage({
    senderNetworkId,
    recipientNetworkId,
    recipient,
    messageType = 'GENERAL',
    subject,
    fhirResourceType = '',
    fhirResourceId = '',
    payload,
    responseToMessageId = 0,
    callerAddress
  }) {
    const deps = this.getDeployments();
    if (!deps || !deps.repository || !deps.repository.address) {
      throw new Error('Governance repository contract not deployed');
    }

    const client = new ContractClient(
      topology.repositoryChain.rpcUrl,
      ConsortiumGovernance.abi,
      deps.repository.address
    );

    const fromAddr = callerAddress || '0x1111111111111111111111111111111111111111';
    const toAddr = recipient || ethers.ZeroAddress;

    // Encrypt and hash payload via storage adapter
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    const storedVault = storageAdapter.storeEncryptedPayload(payloadStr);

    const tx = await client.send('sendMessage', [
      BigInt(senderNetworkId),
      BigInt(recipientNetworkId),
      toAddr,
      String(messageType),
      String(subject || 'Inter-Organization Healthcare Transmission'),
      String(fhirResourceType),
      String(fhirResourceId),
      String(storedVault.dataHash),
      String(payloadStr), // On-chain for simulation visibility, accompanied by hash
      BigInt(responseToMessageId || 0)
    ], fromAddr);

    return {
      success: true,
      message: `Message sent from Network ${senderNetworkId} to Network ${recipientNetworkId}`,
      txHash: tx.hash,
      dataHash: storedVault.dataHash,
      cid: storedVault.cid
    };
  }

  async getAllMessages() {
    const deps = this.getDeployments();
    if (!deps || !deps.repository || !deps.repository.address) {
      return [];
    }

    try {
      const client = new ContractClient(
        topology.repositoryChain.rpcUrl,
        ConsortiumGovernance.abi,
        deps.repository.address
      );
      const raw = await client.call('getAllMessages');
      return Array.from(raw).map(m => {
        let parsedPayload = m.payload || m[10];
        try { parsedPayload = JSON.parse(parsedPayload); } catch (e) {}

        const statusNum = Number(m.status !== undefined ? m.status : m[11]);
        const statusMap = { 0: 'PENDING', 1: 'DELIVERED', 2: 'ACKNOWLEDGED', 3: 'FULFILLED', 4: 'REJECTED' };

        return {
          messageId: Number(m.messageId || m[0]),
          senderNetworkId: Number(m.senderNetworkId || m[1]),
          sender: String(m.sender || m[2]),
          recipientNetworkId: Number(m.recipientNetworkId || m[3]),
          recipient: String(m.recipient || m[4]),
          messageType: String(m.messageType || m[5]),
          subject: String(m.subject || m[6]),
          fhirResourceType: String(m.fhirResourceType || m[7]),
          fhirResourceId: String(m.fhirResourceId || m[8]),
          payloadHash: String(m.payloadHash || m[9]),
          payload: parsedPayload,
          rawPayload: String(m.payload || m[10]),
          status: statusNum,
          statusText: statusMap[statusNum] || 'UNKNOWN',
          timestamp: Number(m.timestamp || m[12]),
          timestampIso: new Date(Number(m.timestamp || m[12]) * 1000).toISOString(),
          responseToMessageId: Number(m.responseToMessageId || m[13])
        };
      });
    } catch (err) {
      console.warn('[ForkTreeService] Failed to fetch messages:', err.message);
      return [];
    }
  }

  async getOrganizationMessages(networkId) {
    const all = await this.getAllMessages();
    const netNum = Number(networkId);
    return all.filter(m => m.senderNetworkId === netNum || m.recipientNetworkId === netNum);
  }

  async updateMessageStatus({ messageId, status, callerAddress }) {
    const deps = this.getDeployments();
    if (!deps || !deps.repository || !deps.repository.address) {
      throw new Error('Governance contract not deployed');
    }

    const client = new ContractClient(
      topology.repositoryChain.rpcUrl,
      ConsortiumGovernance.abi,
      deps.repository.address
    );

    const fromAddr = callerAddress || '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02';
    const tx = await client.send('updateMessageStatus', [
      BigInt(messageId),
      Number(status)
    ], fromAddr);

    return {
      success: true,
      message: `Message #${messageId} status updated to ${status}`,
      txHash: tx.hash
    };
  }

  // --- Automated FHIR Order Fulfillment ---
  // e.g. Lab fulfills ServiceRequest with DiagnosticReport + Observation
  // or Pharmacy fulfills MedicationRequest with MedicationDispense
  // or Payor fulfills Claim with ClaimResponse
  async fulfillFhirOrder({ requestMessageId, responseResourceType, responsePayload, callerAddress }) {
    const all = await this.getAllMessages();
    const reqMsg = all.find(m => m.messageId === Number(requestMessageId));
    if (!reqMsg) {
      throw new Error(`Original request message #${requestMessageId} not found`);
    }

    const senderNet = reqMsg.recipientNetworkId; // Fulfiller becomes sender
    const recipientNet = reqMsg.senderNetworkId; // Original requester becomes recipient
    const recipientAddr = reqMsg.sender;

    // 1. Commit clinical record on fulfilling organization's chain if applicable
    const fulfillingChain = topology.chains.find(c => c.networkId === senderNet);
    const patientId = (responsePayload && responsePayload.subject && responsePayload.subject.reference)
      ? responsePayload.subject.reference.replace('Patient/', '')
      : (reqMsg.payload && reqMsg.payload.subject && reqMsg.payload.subject.reference)
        ? reqMsg.payload.subject.reference.replace('Patient/', '')
        : 'P101';

    let committedRecord = null;
    if (fulfillingChain) {
      try {
        const clinicalCode = (responsePayload && responsePayload.code && responsePayload.code.coding && responsePayload.code.coding[0])
          ? `${responsePayload.code.coding[0].system}:${responsePayload.code.coding[0].code}`
          : 'CLIN-FULFILL-01';

        committedRecord = await this.addPatientRecord({
          port: fulfillingChain.port,
          patientId,
          resourceType: responseResourceType || 'DiagnosticReport',
          clinicalCode,
          resourceData: responsePayload,
          callerAddress
        });
      } catch (e) {
        console.warn(`[ForkTreeService] Note: Record ingestion on chain ${fulfillingChain.port} skipped or failed:`, e.message);
      }
    }

    // 2. Dispatch the response message
    const msgType = `FHIR_${(responseResourceType || 'DIAGNOSTIC_REPORT').toUpperCase().replace('-', '_')}`;
    const sent = await this.sendMessage({
      senderNetworkId: senderNet,
      recipientNetworkId: recipientNet,
      recipient: recipientAddr,
      messageType: msgType,
      subject: `Fulfillment Response for #${reqMsg.messageId} (${reqMsg.subject})`,
      fhirResourceType: responseResourceType || 'DiagnosticReport',
      fhirResourceId: responsePayload.id || `RES-${Date.now()}`,
      payload: responsePayload,
      responseToMessageId: reqMsg.messageId,
      callerAddress
    });

    // 3. Update original request message to status 3 (FULFILLED)
    await this.updateMessageStatus({
      messageId: reqMsg.messageId,
      status: 3, // FULFILLED
      callerAddress
    });

    return {
      success: true,
      message: `Request #${reqMsg.messageId} successfully fulfilled and cross-fork response dispatched!`,
      responseMessage: sent,
      committedRecord
    };
  }

  // --- Multi-Fork Block & Data Explorer Services ---

  async getExplorerChains() {
    const statuses = await this.getNodeStatuses();
    const chainsList = [];

    // Repository chain
    const repoStatus = statuses.find(s => s.port === 8545) || {};
    const repoNode = multiChainEngine.getNode(8545);
    chainsList.push({
      networkId: 11101,
      port: 8545,
      name: 'Consortium Governance Repository',
      role: 'repository',
      parentNetworkId: null,
      forkBlockNumber: 0,
      currentBlockHeight: repoNode ? repoNode.blockNumber : (repoStatus.blockNumber || 0),
      totalBlocks: repoNode ? repoNode.blocks.length : (repoStatus.blockNumber ? repoStatus.blockNumber + 1 : 1),
      totalRecords: 0,
      contractAddress: repoStatus.contractAddress || null,
      online: repoStatus.online !== false,
      isRoot: false
    });

    // Data chains
    for (const chain of topology.chains) {
      const st = statuses.find(s => s.port === chain.port) || {};
      const node = multiChainEngine.getNode(chain.port);
      let records = [];
      try {
        records = await this.getChainPatientRecords(chain.port);
      } catch (e) {}

      chainsList.push({
        networkId: chain.networkId,
        port: chain.port,
        name: chain.name,
        role: chain.isRoot ? 'root' : 'fork',
        parentNetworkId: chain.parentNetworkId,
        forkBlockNumber: chain.forkBlockNumber,
        currentBlockHeight: node ? node.blockNumber : (st.blockNumber || 0),
        totalBlocks: node ? node.blocks.length : (st.blockNumber ? st.blockNumber + 1 : 1),
        totalRecords: records.length,
        contractAddress: st.contractAddress || null,
        online: st.online !== false,
        isRoot: !!chain.isRoot
      });
    }

    return chainsList;
  }

  async getChainBlocks(port) {
    const portNum = Number(port);
    const node = multiChainEngine.getNode(portNum);
    const chainRecords = await this.getChainPatientRecords(portNum);

    let rawBlocks = [];
    if (node && node.getAllBlocks) {
      rawBlocks = node.getAllBlocks();
    } else {
      const chainConfig = portNum === 8545 ? topology.repositoryChain : topology.chains.find(c => c.port === portNum);
      if (chainConfig) {
        try {
          const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
          const currentHeight = Number(await provider.send('eth_blockNumber', []));
          for (let b = 0; b <= currentHeight; b++) {
            const blk = await provider.send('eth_getBlockByNumber', ['0x' + b.toString(16), false]);
            if (blk) rawBlocks.push(blk);
          }
        } catch (e) {}
      }
    }

    // Correlate blocks with smart contract patient records
    return rawBlocks.map((b, idx) => {
      const bNum = typeof b.blockNumber === 'number' ? b.blockNumber : (b.number ? parseInt(b.number, 16) : idx);
      const recordsInBlock = chainRecords.filter(r => r.blockNumber === bNum);

      return {
        blockNumber: bNum,
        blockNumberHex: b.number || ('0x' + bNum.toString(16)),
        hash: b.hash || ethers.keccak256(ethers.toUtf8Bytes(`block-${portNum}-${bNum}`)),
        parentHash: b.parentHash || ('0x' + '0'.repeat(64)),
        timestamp: b.timestampSec || (b.timestamp ? parseInt(b.timestamp, 16) : Math.floor(Date.now() / 1000)),
        timestampIso: b.timestampSec ? new Date(b.timestampSec * 1000).toISOString() : (b.timestamp ? new Date(parseInt(b.timestamp, 16) * 1000).toISOString() : new Date().toISOString()),
        miner: b.miner || '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02',
        gasUsed: b.gasUsed || '0x5208',
        txCount: (b.transactions || []).length,
        transactions: b.transactions || [],
        recordsCount: recordsInBlock.length,
        patientRecords: recordsInBlock
      };
    });
  }

  async getChainBlockDetail(port, blockNumber) {
    const portNum = Number(port);
    const bNum = Number(blockNumber);
    const allBlocks = await this.getChainBlocks(portNum);
    const block = allBlocks.find(b => b.blockNumber === bNum);
    if (!block) {
      throw new Error(`Block #${bNum} on chain port ${portNum} not found`);
    }

    // Enrich each record with live SHA-256 verification and vault metadata
    const enrichedRecords = (block.patientRecords || []).map(r => {
      const jsonStr = typeof r.resourceData === 'string' ? r.resourceData : JSON.stringify(r.resourceData);
      const computedHash = crypto.createHash('sha256').update(jsonStr).digest('hex');
      const isVerified = (computedHash === r.dataHash);
      const vaultInfo = storageAdapter.retrieveDecryptedPayload(r.dataHash);

      return {
        ...r,
        computedHash,
        integrityVerified: isVerified,
        hasOffChainVault: !!vaultInfo,
        vaultCid: `ipfs://bafk${r.dataHash.slice(0, 44)}`
      };
    });

    return {
      port: portNum,
      blockNumber: bNum,
      blockHeader: {
        number: block.blockNumberHex,
        hash: block.hash,
        parentHash: block.parentHash,
        miner: block.miner,
        timestamp: block.timestamp,
        timestampIso: block.timestampIso,
        gasUsed: block.gasUsed,
        txCount: block.txCount
      },
      transactions: block.transactions,
      records: enrichedRecords
    };
  }

  async getPatientLineageAcrossForks(patientId) {
    const targetPid = String(patientId).trim();
    const allRecords = [];

    for (const chain of topology.chains) {
      try {
        const records = await this.getChainPatientRecords(chain.port);
        for (const r of records) {
          const pid = (r.patientId || '').trim();
          const cleanTarget = targetPid.replace(/^Patient\//i, '').toLowerCase();
          const cleanPid = pid.replace(/^Patient\//i, '').toLowerCase();

          if (cleanPid === cleanTarget) {
            const jsonStr = typeof r.resourceData === 'string' ? r.resourceData : JSON.stringify(r.resourceData);
            const computedHash = crypto.createHash('sha256').update(jsonStr).digest('hex');

            allRecords.push({
              chainName: chain.name,
              port: chain.port,
              networkId: chain.networkId,
              isRoot: !!chain.isRoot,
              parentNetworkId: chain.parentNetworkId,
              forkBlockNumber: chain.forkBlockNumber,
              blockNumber: r.blockNumber,
              patientId: r.patientId,
              resourceType: r.resourceType,
              clinicalCode: r.clinicalCode,
              resourceData: r.resourceData,
              dataHash: r.dataHash,
              integrityVerified: (computedHash === r.dataHash),
              timestamp: r.timestamp,
              timestampIso: r.timestampIso
            });
          }
        }
      } catch (err) {
        console.warn(`[ForkTreeService] Lineage fetch warning on port ${chain.port}:`, err.message);
      }
    }

    allRecords.sort((a, b) => a.timestamp - b.timestamp || a.networkId - b.networkId || a.blockNumber - b.blockNumber);

    return {
      patientId: targetPid,
      totalTouchpoints: allRecords.length,
      participatingForks: Array.from(new Set(allRecords.map(r => r.chainName))),
      lineageTrajectory: allRecords
    };
  }

}

module.exports = new ForkTreeService();
