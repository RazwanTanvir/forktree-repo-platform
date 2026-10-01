// Production Multi-Chain JSON-RPC Engine for BlockchainForkTree
// Simulates a consortium shared governance network and organization-owned healthcare blockchains

const http = require('http');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { ConsortiumGovernance, BlockData } = require('../contracts/compiledArtifacts');
const topology = require('../config/networkTopology.json');

let stakeholdersConfig = { personas: [], defaultStakeholders: {} };
try {
  stakeholdersConfig = require('../config/consortiumStakeholders.json');
} catch (e) {}

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
    this.accounts = [
      '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02',
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333',
      '0x4444444444444444444444444444444444444444',
      '0x5555555555555555555555555555555555555555',
      '0x6666666666666666666666666666666666666666',
      '0x7777777777777777777777777777777777777777'
    ];
    this.contracts = new Map(); // address -> contractInstance
    this.receipts = new Map(); // txHash -> receipt
    this.blocks = [];

    // Interfaces for decoding
    this.consortiumGovIface = new ethers.Interface(ConsortiumGovernance.abi);
    this.storeForkEventIface = this.consortiumGovIface; // Alias
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
        const isGov = c.type === 'ConsortiumGovernance' || c.type === 'StoreForkEvent';
        contractsObj[addr] = {
          address: c.address,
          type: c.type,
          state: isGov ? {
            forkDetails: (c.state.forkDetails || []).map(f => f.map(x => x.toString())),
            adjacencyList: Object.fromEntries(
              Array.from((c.state.adjacencyList || new Map()).entries()).map(([k, v]) => [k, v.map(x => x.toString())])
            ),
            organizations: (c.state.organizations || []).map(o => [
              o[0].toString(),
              String(o[1]),
              String(o[2]),
              o[3].toString(),
              o[4].toString(),
              String(o[5]),
              !!o[6],
              o[7].toString()
            ]),
            proposals: (c.state.proposals || []).map(p => [
              p[0].toString(),
              String(p[1]),
              String(p[2]),
              p[3].toString(),
              p[4].toString(),
              p[5].toString(),
              p[6].toString(),
              String(p[7]),
              String(p[8]),
              p[9].toString(),
              p[10].toString(),
              !!p[11],
              p[12].toString()
            ]),
            votes: Object.fromEntries(
              Array.from((c.state.votes || new Map()).entries()).map(([k, set]) => [k, Array.from(set)])
            ),
            projects: (c.state.projects || []).map(pr => [
              pr[0].toString(),
              String(pr[1]),
              String(pr[2]),
              String(pr[3]),
              pr[4].toString(),
              !!pr[5],
              pr[6].toString()
            ]),
            steeringCouncil: Object.fromEntries(
              Array.from((c.state.steeringCouncil || new Map()).entries()).map(([k, v]) => [k, !!v])
            ),
            messages: (c.state.messages || []).map(m => [
              m[0].toString(),
              m[1].toString(),
              String(m[2]),
              m[3].toString(),
              String(m[4]),
              String(m[5]),
              String(m[6]),
              String(m[7]),
              String(m[8]),
              String(m[9]),
              String(m[10]),
              Number(m[11]),
              m[12].toString(),
              m[13].toString()
            ])
          } : {
            owner: c.state.owner || '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02',
            stakeholders: Object.fromEntries(
              Array.from((c.state.stakeholders || new Map()).entries()).map(([k, v]) => [k, Number(v)])
            ),
            consents: Object.fromEntries(
              Array.from((c.state.consents || new Map()).entries()).map(([k, v]) => [
                k,
                Object.fromEntries(Array.from(v.entries()))
              ])
            ),
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
          const isGov = c.type === 'ConsortiumGovernance' || c.type === 'StoreForkEvent';
          this.contracts.set(addr.toLowerCase(), {
            address: c.address,
            type: c.type,
            state: isGov ? {
              forkDetails: (c.state.forkDetails || []).map(f => f.map(x => BigInt(x))),
              adjacencyList: new Map(
                Object.entries(c.state.adjacencyList || {}).map(([k, v]) => [k, v.map(x => BigInt(x))])
              ),
              organizations: (c.state.organizations || []).map(o => [
                BigInt(o[0]),
                String(o[1]),
                String(o[2]),
                BigInt(o[3]),
                BigInt(o[4]),
                String(o[5]),
                !!o[6],
                BigInt(o[7])
              ]),
              proposals: (c.state.proposals || []).map(p => [
                BigInt(p[0]),
                String(p[1]),
                String(p[2]),
                BigInt(p[3]),
                BigInt(p[4]),
                BigInt(p[5]),
                BigInt(p[6]),
                String(p[7]),
                String(p[8]),
                BigInt(p[9]),
                BigInt(p[10]),
                !!p[11],
                BigInt(p[12])
              ]),
              votes: new Map(
                Object.entries(c.state.votes || {}).map(([k, arr]) => [k, new Set(arr)])
              ),
              projects: (c.state.projects || []).map(pr => [
                BigInt(pr[0]),
                String(pr[1]),
                String(pr[2]),
                String(pr[3]),
                BigInt(pr[4]),
                !!pr[5],
                BigInt(pr[6])
              ]),
              steeringCouncil: new Map(
                Object.entries(c.state.steeringCouncil || {}).map(([k, v]) => [k.toLowerCase(), !!v])
              ),
              messages: (c.state.messages || []).map(m => [
                BigInt(m[0]),
                BigInt(m[1]),
                String(m[2]),
                BigInt(m[3]),
                String(m[4]),
                String(m[5]),
                String(m[6]),
                String(m[7]),
                String(m[8]),
                String(m[9]),
                String(m[10]),
                Number(m[11]),
                BigInt(m[12]),
                BigInt(m[13])
              ])
            } : {
              owner: c.state.owner || '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02',
              stakeholders: new Map(
                Object.entries(c.state.stakeholders || {}).map(([k, v]) => [k.toLowerCase(), Number(v)])
              ),
              consents: new Map(
                Object.entries(c.state.consents || {}).map(([k, v]) => [
                  k,
                  new Map(Object.entries(v).map(([net, allowed]) => [Number(net), !!allowed]))
                ])
              ),
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

  _seedInitialStakeholders(contract) {
    const portStr = this.port.toString();
    const defaults = stakeholdersConfig.defaultStakeholders[portStr] || [];
    for (const s of defaults) {
      const roleNum = s.role === 'ADMIN' ? 3 : s.role === 'CLINICIAN' ? 1 : s.role === 'AUDITOR' ? 2 : 4;
      contract.state.stakeholders.set(s.address.toLowerCase(), roleNum);
      if (s.role === 'ADMIN' && s.address.toLowerCase() !== '0x163f57598de9cc708e9497aa50b6d5e5ed368d02') {
        contract.state.owner = s.address.toLowerCase();
      }
    }
  }

  _seedInitialOrganizations(contract) {
    if (contract.state.organizations.length > 0) return;
    const initialOrgs = [
      { id: 1, name: 'Root Master Patient Index', admin: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02', net: 11102, port: 8546, type: 'Master Patient Index' },
      { id: 2, name: 'Metro General Hospital', admin: '0x1111111111111111111111111111111111111111', net: 11103, port: 8547, type: 'Hospital Inpatient' },
      { id: 3, name: 'BioLabs Pathology & Diagnostics', admin: '0x3333333333333333333333333333333333333333', net: 11104, port: 8548, type: 'Diagnostic Pathology' },
      { id: 4, name: 'CardioSpecialty Center', admin: '0x4444444444444444444444444444444444444444', net: 11105, port: 8549, type: 'Specialty Clinic' },
      { id: 5, name: 'Emergency & Urgent Care', admin: '0x5555555555555555555555555555555555555555', net: 11106, port: 8550, type: 'Emergency Care' },
      { id: 6, name: 'Outpatient Pharmacy Network', admin: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02', net: 11107, port: 8551, type: 'Outpatient Pharmacy' }
    ];
    for (const org of initialOrgs) {
      contract.state.organizations.push([
        BigInt(org.id),
        org.name,
        org.admin,
        BigInt(org.net),
        BigInt(org.port),
        org.type,
        true,
        BigInt(Math.floor(Date.now() / 1000))
      ]);
    }
    if (!contract.state.projects) {
      contract.state.projects = [];
    }
    if (!contract.state.steeringCouncil) {
      contract.state.steeringCouncil = new Map();
    }
    contract.state.steeringCouncil.set('0x163f57598de9cc708e9497aa50b6d5e5ed368d02', true);
  }

  start() {
    return new Promise((resolve, reject) => {
      this.loadStateFromFile();
      this.server = http.createServer((req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Caller-Address, Authorization');

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

      this.server.listen(this.port, () => {
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
      name: this.name,
      port: this.port,
      networkId: this.networkId,
      role: this.role,
      isRoot: this.isRoot,
      parentNetworkId: this.parentNetworkId,
      forkBlockNumber: this.forkBlockNumber,
      blockNumber: this.blockNumber,
      contractsCount: this.contracts.size,
      online: !!this.server
    };
  }

  handleRpc(req) {
    const { method, params, id } = req;

    switch (method) {
      case 'eth_chainId':
        return { jsonrpc: '2.0', id, result: '0x' + this.networkId.toString(16) };

      case 'net_version':
        return { jsonrpc: '2.0', id, result: this.networkId.toString() };

      case 'eth_blockNumber':
        return { jsonrpc: '2.0', id, result: '0x' + this.blockNumber.toString(16) };

      case 'eth_accounts':
        return { jsonrpc: '2.0', id, result: this.accounts };

      case 'eth_getBalance':
        return { jsonrpc: '2.0', id, result: '0x56bc75e2d63100000' }; // 100 ETH

      case 'eth_estimateGas':
      case 'eth_gasPrice':
        return { jsonrpc: '2.0', id, result: '0x5208' };

      case 'eth_getTransactionCount':
        return { jsonrpc: '2.0', id, result: '0x0' };

      case 'eth_getCode': {
        const addr = (params && params[0] ? params[0] : '').toLowerCase();
        const contract = this.contracts.get(addr);
        return { jsonrpc: '2.0', id, result: contract ? '0x6080604052' : '0x' };
      }

      case 'eth_sendTransaction': {
        const tx = (params && params[0]) || {};
        try {
          const txHash = this._executeTransaction(tx);
          return { jsonrpc: '2.0', id, result: txHash };
        } catch (err) {
          return { jsonrpc: '2.0', id, error: { code: -32000, message: err.message } };
        }
      }

      case 'eth_getTransactionReceipt': {
        const hash = params && params[0];
        const receipt = this.receipts.get(hash) || null;
        return { jsonrpc: '2.0', id, result: receipt };
      }

      case 'eth_call': {
        const call = (params && params[0]) || {};
        try {
          const resultHex = this._executeCall(call);
          return { jsonrpc: '2.0', id, result: resultHex };
        } catch (err) {
          return { jsonrpc: '2.0', id, error: { code: -32000, message: err.message } };
        }
      }

      case 'eth_getBlockByNumber': {
        const blockTag = params && params[0];
        return { jsonrpc: '2.0', id, result: this._getBlock(blockTag) };
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method ${method} not implemented` }
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
      const contract = {
        address: contractAddress,
        type: isRepo ? 'ConsortiumGovernance' : 'BlockData',
        state: isRepo
          ? {
              forkDetails: [],
              adjacencyList: new Map(),
              organizations: [],
              proposals: [],
              votes: new Map(),
              projects: [],
              steeringCouncil: new Map([['0x163f57598de9cc708e9497aa50b6d5e5ed368d02', true]]),
              messages: []
            }
          : {
              owner: (tx.from || this.accounts[0]).toLowerCase(),
              stakeholders: new Map([
                [(tx.from || this.accounts[0]).toLowerCase(), 3] // ADMIN role
              ]),
              consents: new Map(),
              patientRecords: [],
              dataPoints: []
            }
      };

      if (isRepo) {
        this._seedInitialOrganizations(contract);
      } else {
        this._seedInitialStakeholders(contract);
      }

      this.contracts.set(contractAddress.toLowerCase(), contract);
    } else {
      // State-changing contract interaction
      const target = tx.to.toLowerCase();
      const contract = this.contracts.get(target);

      if (contract && tx.data) {
        const isGov = contract.type === 'ConsortiumGovernance' || contract.type === 'StoreForkEvent';

        if (isGov) {
          const parsed = this.consortiumGovIface.parseTransaction({ data: tx.data });
          if (parsed) {
            if (parsed.name === 'addForkDetail') {
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
            } else if (parsed.name === 'registerOrganization') {
              const [name, adminAddress, networkId, port, orgType] = parsed.args;
              const orgId = BigInt(contract.state.organizations.length + 1);
              const org = [
                orgId,
                String(name),
                String(adminAddress),
                BigInt(networkId),
                BigInt(port),
                String(orgType),
                true,
                BigInt(Math.floor(Date.now() / 1000))
              ];
              contract.state.organizations.push(org);
            } else if (parsed.name === 'createProject') {
              const [name, description, rootNetworkId] = parsed.args;
              const sender = (tx.from || this.accounts[0]).toLowerCase();
              const isCouncil = contract.state.steeringCouncil ? !!contract.state.steeringCouncil.get(sender) : (sender === '0x163f57598de9cc708e9497aa50b6d5e5ed368d02');
              if (!isCouncil && sender !== '0x163f57598de9cc708e9497aa50b6d5e5ed368d02') {
                throw new Error('Security: Caller is not a Steering Council Admin');
              }
              const projectId = BigInt((contract.state.projects || []).length + 1);
              const proj = [
                projectId,
                String(name),
                String(description),
                tx.from || this.accounts[0],
                BigInt(rootNetworkId),
                true,
                BigInt(Math.floor(Date.now() / 1000))
              ];
              if (!contract.state.projects) contract.state.projects = [];
              contract.state.projects.push(proj);
            } else if (parsed.name === 'setSteeringCouncilMember') {
              const [account, isCouncil] = parsed.args;
              if (!contract.state.steeringCouncil) contract.state.steeringCouncil = new Map();
              contract.state.steeringCouncil.set(account.toLowerCase(), Boolean(isCouncil));
            } else if (parsed.name === 'proposeFork' || parsed.name === 'proposeForkWithDetails') {
              const proposalId = BigInt((contract.state.proposals || []).length + 1);
              const proposer = tx.from || this.accounts[0];
              let orgName, networkId, portNumber, parentNetworkId, forkBlockNumber, justification, orgType, fhirCapability, initialAdmin;
              if (parsed.name === 'proposeForkWithDetails') {
                [orgName, networkId, portNumber, parentNetworkId, forkBlockNumber, justification, orgType, fhirCapability, initialAdmin] = parsed.args;
              } else {
                [orgName, networkId, portNumber, parentNetworkId, forkBlockNumber, justification, orgType] = parsed.args;
                fhirCapability = 'Patient, Observation, Condition';
                initialAdmin = proposer;
              }
              const proposal = [
                proposalId,
                String(proposer),
                String(orgName),
                BigInt(networkId),
                BigInt(portNumber),
                BigInt(parentNetworkId),
                BigInt(forkBlockNumber),
                String(justification),
                String(orgType || 'Specialty Clinic'),
                1n, // votesFor (proposer automatic vote)
                0n, // votesAgainst
                false, // executed
                BigInt(Math.floor(Date.now() / 1000)),
                String(fhirCapability || 'Patient, Observation, Condition'),
                String(initialAdmin || proposer)
              ];
              if (!contract.state.proposals) contract.state.proposals = [];
              contract.state.proposals.push(proposal);
              if (!contract.state.votes) contract.state.votes = new Map();
              contract.state.votes.set(proposalId.toString(), new Set([proposer.toLowerCase()]));
            } else if (parsed.name === 'sendMessage') {
              const [senderNetworkId, recipientNetworkId, recipient, messageType, subject, fhirResourceType, fhirResourceId, payloadHash, payload, responseToMessageId] = parsed.args;
              const messageId = BigInt((contract.state.messages || []).length + 1);
              const sender = tx.from || this.accounts[0];
              const msgObj = [
                messageId,
                BigInt(senderNetworkId),
                String(sender),
                BigInt(recipientNetworkId),
                String(recipient),
                String(messageType),
                String(subject),
                String(fhirResourceType),
                String(fhirResourceId),
                String(payloadHash),
                String(payload),
                0, // PENDING status
                BigInt(Math.floor(Date.now() / 1000)),
                BigInt(responseToMessageId || 0)
              ];
              if (!contract.state.messages) contract.state.messages = [];
              contract.state.messages.push(msgObj);
            } else if (parsed.name === 'updateMessageStatus') {
              const [messageId, status] = parsed.args;
              const mIdx = Number(messageId) - 1;
              if (mIdx < 0 || !contract.state.messages || mIdx >= contract.state.messages.length) {
                throw new Error('Invalid message ID');
              }
              contract.state.messages[mIdx][11] = Number(status);
            } else if (parsed.name === 'voteOnProposal') {
              const [proposalId, support] = parsed.args;
              const pIdx = Number(proposalId) - 1;
              if (pIdx < 0 || pIdx >= contract.state.proposals.length) {
                throw new Error('Invalid proposal ID');
              }
              const prop = contract.state.proposals[pIdx];
              if (prop[11] === true) {
                throw new Error('Proposal already executed');
              }
              const voter = (tx.from || this.accounts[0]).toLowerCase();
              if (!contract.state.votes) contract.state.votes = new Map();
              const pKey = proposalId.toString();
              if (!contract.state.votes.has(pKey)) {
                contract.state.votes.set(pKey, new Set());
              }
              const voteSet = contract.state.votes.get(pKey);
              if (voteSet.has(voter)) {
                throw new Error('Already voted on this proposal');
              }
              voteSet.add(voter);
              if (support) {
                prop[9] = prop[9] + 1n; // votesFor
              } else {
                prop[10] = prop[10] + 1n; // votesAgainst
              }
            } else if (parsed.name === 'executeForkProposal') {
              const [proposalId] = parsed.args;
              const pIdx = Number(proposalId) - 1;
              if (pIdx < 0 || pIdx >= contract.state.proposals.length) {
                throw new Error('Invalid proposal ID');
              }
              const prop = contract.state.proposals[pIdx];
              if (prop[11] === true) {
                throw new Error('Proposal already executed');
              }
              if (prop[9] <= prop[10]) {
                throw new Error('Proposal does not have majority support');
              }
              prop[11] = true; // executed = true

              // Automatically add to forkDetails & adjacencyList
              const netId = prop[3];
              const port = prop[4];
              const parentNetId = prop[5];
              const forkBlock = prop[6];
              contract.state.forkDetails.push([netId, port, parentNetId, forkBlock]);
              const pIdKey = parentNetId.toString();
              if (!contract.state.adjacencyList.has(pIdKey)) {
                contract.state.adjacencyList.set(pIdKey, []);
              }
              contract.state.adjacencyList.get(pIdKey).push(netId);

              // Register org in consortium
              const orgId = BigInt(contract.state.organizations.length + 1);
              const adminAddr = (prop[14] && prop[14] !== ethers.ZeroAddress) ? prop[14] : prop[1];
              contract.state.organizations.push([
                orgId,
                prop[2], // orgName
                adminAddr, // admin (initialAdmin or proposer)
                netId,
                port,
                prop[8], // orgType
                true,
                BigInt(Math.floor(Date.now() / 1000))
              ]);
            }
          }
        } else if (contract.type === 'BlockData') {
          const parsed = this.blockDataIface.parseTransaction({ data: tx.data });
          if (parsed) {
            // RBAC Enforcement for Patient Records
            if (parsed.name === 'addPatientRecordSecured' || parsed.name === 'addPatientRecord') {
              const sender = (tx.from || this.accounts[0]).toLowerCase();
              const owner = (contract.state.owner || this.accounts[0]).toLowerCase();
              const role = contract.state.stakeholders ? (contract.state.stakeholders.get(sender) || 0) : 0;
              const isDevDefault = sender === '0x163f57598de9cc708e9497aa50b6d5e5ed368d02';

              // Must be Owner (3), Clinician (1), or Dev Default Admin
              if (!isDevDefault && sender !== owner && role !== 1 && role !== 3) {
                throw new Error(`Security: Caller ${tx.from} is not authorized to write clinical records on this blockchain`);
              }

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
            } else if (parsed.name === 'setStakeholderRole') {
              const [account, role] = parsed.args;
              const sender = (tx.from || this.accounts[0]).toLowerCase();
              const owner = (contract.state.owner || this.accounts[0]).toLowerCase();
              const isDevDefault = sender === '0x163f57598de9cc708e9497aa50b6d5e5ed368d02';

              const senderRole = contract.state.stakeholders ? (contract.state.stakeholders.get(sender) || 0) : 0;
              if (!isDevDefault && sender !== owner && senderRole !== 3) {
                throw new Error('Security: Caller is not the organization owner');
              }
              contract.state.stakeholders.set(String(account).toLowerCase(), Number(role));
            } else if (parsed.name === 'transferOwnership') {
              const [newOwner] = parsed.args;
              const sender = (tx.from || this.accounts[0]).toLowerCase();
              const owner = (contract.state.owner || this.accounts[0]).toLowerCase();
              const isDevDefault = sender === '0x163f57598de9cc708e9497aa50b6d5e5ed368d02';

              if (!isDevDefault && sender !== owner) {
                throw new Error('Security: Caller is not the organization owner');
              }
              contract.state.owner = String(newOwner).toLowerCase();
              contract.state.stakeholders.set(String(newOwner).toLowerCase(), 3);
            } else if (parsed.name === 'grantConsent') {
              const [patientId, targetOrgNetworkId] = parsed.args;
              if (!contract.state.consents.has(String(patientId))) {
                contract.state.consents.set(String(patientId), new Map());
              }
              contract.state.consents.get(String(patientId)).set(Number(targetOrgNetworkId), true);
            } else if (parsed.name === 'revokeConsent') {
              const [patientId, targetOrgNetworkId] = parsed.args;
              if (contract.state.consents.has(String(patientId))) {
                contract.state.consents.get(String(patientId)).set(Number(targetOrgNetworkId), false);
              }
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

    const isGov = contract.type === 'ConsortiumGovernance' || contract.type === 'StoreForkEvent';

    if (isGov) {
      const parsed = this.consortiumGovIface.parseTransaction({ data });
      if (!parsed) return '0x';

      switch (parsed.name) {
        case 'totalForks': {
          return this.consortiumGovIface.encodeFunctionResult('totalForks', [BigInt((contract.state.forkDetails || []).length)]);
        }
        case 'getForkDetailByIndex': {
          const idx = Number(parsed.args[0]);
          const item = (contract.state.forkDetails || [])[idx] || [0n, 0n, 0n, 0n];
          return this.consortiumGovIface.encodeFunctionResult('getForkDetailByIndex', [item]);
        }
        case 'getAllForkDetails': {
          return this.consortiumGovIface.encodeFunctionResult('getAllForkDetails', [contract.state.forkDetails || []]);
        }
        case 'getAdjacencyList': {
          const key = parsed.args[0].toString();
          const list = (contract.state.adjacencyList || new Map()).get(key) || [];
          return this.consortiumGovIface.encodeFunctionResult('getAdjacencyList', [list]);
        }
        case 'totalOrganizations': {
          return this.consortiumGovIface.encodeFunctionResult('totalOrganizations', [BigInt((contract.state.organizations || []).length)]);
        }
        case 'getAllOrganizations': {
          return this.consortiumGovIface.encodeFunctionResult('getAllOrganizations', [contract.state.organizations || []]);
        }
        case 'getOrganizationByIndex': {
          const idx = Number(parsed.args[0]);
          const item = (contract.state.organizations || [])[idx] || [0n, '', ethers.ZeroAddress, 0n, 0n, '', false, 0n];
          return this.consortiumGovIface.encodeFunctionResult('getOrganizationByIndex', [item]);
        }
        case 'totalProposals': {
          return this.consortiumGovIface.encodeFunctionResult('totalProposals', [BigInt((contract.state.proposals || []).length)]);
        }
        case 'getAllProposals': {
          return this.consortiumGovIface.encodeFunctionResult('getAllProposals', [contract.state.proposals || []]);
        }
        case 'getProposalByIndex': {
          const idx = Number(parsed.args[0]);
          const item = (contract.state.proposals || [])[idx] || [0n, ethers.ZeroAddress, '', 0n, 0n, 0n, 0n, '', '', 0n, 0n, false, 0n, '', ethers.ZeroAddress];
          return this.consortiumGovIface.encodeFunctionResult('getProposalByIndex', [item]);
        }
        case 'totalProjects': {
          return this.consortiumGovIface.encodeFunctionResult('totalProjects', [BigInt((contract.state.projects || []).length)]);
        }
        case 'getAllProjects': {
          return this.consortiumGovIface.encodeFunctionResult('getAllProjects', [contract.state.projects || []]);
        }
        case 'getProjectByIndex': {
          const idx = Number(parsed.args[0]);
          const item = (contract.state.projects || [])[idx] || [0n, '', '', ethers.ZeroAddress, 0n, false, 0n];
          return this.consortiumGovIface.encodeFunctionResult('getProjectByIndex', [item]);
        }
        case 'isSteeringCouncil': {
          const target = String(parsed.args[0]).toLowerCase();
          const isC = (contract.state.steeringCouncil && contract.state.steeringCouncil.get(target)) || target === '0x163f57598de9cc708e9497aa50b6d5e5ed368d02';
          return this.consortiumGovIface.encodeFunctionResult('isSteeringCouncil', [Boolean(isC)]);
        }
        case 'totalMessages': {
          return this.consortiumGovIface.encodeFunctionResult('totalMessages', [BigInt((contract.state.messages || []).length)]);
        }
        case 'getAllMessages': {
          return this.consortiumGovIface.encodeFunctionResult('getAllMessages', [contract.state.messages || []]);
        }
        case 'getMessageByIndex': {
          const idx = Number(parsed.args[0]);
          const item = (contract.state.messages || [])[idx] || [0n, 0n, ethers.ZeroAddress, 0n, ethers.ZeroAddress, '', '', '', '', '', '', 0, 0n, 0n];
          return this.consortiumGovIface.encodeFunctionResult('getMessageByIndex', [item]);
        }
        case 'getMessagesForOrganization': {
          const targetNet = BigInt(parsed.args[0]);
          const msgIds = [];
          for (const m of (contract.state.messages || [])) {
            if (m[1] === targetNet || m[3] === targetNet) {
              msgIds.push(m[0]);
            }
          }
          return this.consortiumGovIface.encodeFunctionResult('getMessagesForOrganization', [msgIds]);
        }
      }
    } else if (contract.type === 'BlockData') {
      const parsed = this.blockDataIface.parseTransaction({ data });
      if (!parsed) return '0x';

      switch (parsed.name) {
        case 'owner': {
          return this.blockDataIface.encodeFunctionResult('owner', [contract.state.owner || this.accounts[0]]);
        }
        case 'getStakeholderRole': {
          const target = String(parsed.args[0]).toLowerCase();
          const role = contract.state.stakeholders ? (contract.state.stakeholders.get(target) || 0) : 0;
          return this.blockDataIface.encodeFunctionResult('getStakeholderRole', [role]);
        }
        case 'isAuthorizedClinician': {
          const target = String(parsed.args[0]).toLowerCase();
          const owner = (contract.state.owner || this.accounts[0]).toLowerCase();
          const role = contract.state.stakeholders ? (contract.state.stakeholders.get(target) || 0) : 0;
          const authorized = (target === owner || role === 1 || role === 3 || target === '0x163f57598de9cc708e9497aa50b6d5e5ed368d02');
          return this.blockDataIface.encodeFunctionResult('isAuthorizedClinician', [authorized]);
        }
        case 'hasConsent': {
          const pId = String(parsed.args[0]);
          const targetNet = Number(parsed.args[1]);
          const allowed = !!(contract.state.consents && contract.state.consents.get(pId) && contract.state.consents.get(pId).get(targetNet));
          return this.blockDataIface.encodeFunctionResult('hasConsent', [allowed]);
        }
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

  async spawnForkNode({ name, parentNetworkId, forkBlockNumber = 0, orgType = 'Specialty Clinic', adminAddress = null }) {
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
      forkBlockNumber: Number(forkBlockNumber),
      orgType: orgType,
      adminAddress: adminAddress || '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02'
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
