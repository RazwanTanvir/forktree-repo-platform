// Web Dashboard and API Server for BlockchainForkTree
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { multiChainEngine } = require('./engine/chainEngine');
const { deployContracts } = require('./scripts/deployContracts');
const { seedForkTree } = require('./scripts/seedForkTree');
const forkTreeService = require('./services/forkTreeService');
const { ContractClient } = require('./services/contractClient');
const { ConsortiumGovernance, BlockData } = require('./contracts/compiledArtifacts');
const topology = require('./config/networkTopology.json');

let stakeholdersConfig = { personas: [], defaultStakeholders: {} };
try {
  stakeholdersConfig = require('./config/consortiumStakeholders.json');
} catch (e) {}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getCallerStakeholder(req) {
  let personas = [];
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'config/consortiumStakeholders.json'), 'utf-8');
    personas = JSON.parse(raw).personas || [];
  } catch (e) {
    personas = stakeholdersConfig.personas || [];
  }

  const callerAddr = (
    req.headers['x-caller-address'] ||
    req.query.callerAddress ||
    ''
  ).toLowerCase().trim();

  if (!callerAddr) {
    if (req.headers['x-caller-role']) {
      return {
        address: '0x0000000000000000000000000000000000000000',
        role: req.headers['x-caller-role'],
        port: parseInt(req.headers['x-caller-port'], 10) || null,
        organizationName: req.headers['x-caller-org'] || 'Staff'
      };
    }
    return null;
  }

  const match = personas.find(p => (p.address || '').toLowerCase() === callerAddr);
  if (match) return match;

  const defaultStakeholders = stakeholdersConfig.defaultStakeholders || {};
  for (const [portStr, list] of Object.entries(defaultStakeholders)) {
    const m = list.find(s => (s.address || '').toLowerCase() === callerAddr);
    if (m) {
      return {
        address: m.address,
        name: m.name,
        role: m.role,
        port: parseInt(portStr, 10),
        organizationName: m.name
      };
    }
  }

  return null;
}

// 1. Get Node Statuses (Full cluster view restricted to Steering Council & Auditors)
app.get('/api/status', async (req, res) => {
  try {
    const caller = getCallerStakeholder(req);
    const statuses = await forkTreeService.getNodeStatuses();

    // If caller is individual clinic staff (CLINICIAN, SPECIALIST, ORG_ADMIN), jail to their own node!
    if (caller && !['STEERING_COUNCIL', 'AUDITOR'].includes(caller.role)) {
      const myNodes = statuses.filter(s => s.port === caller.port);
      return res.json({
        success: true,
        nodes: myNodes,
        isGlobalOverview: false,
        message: `Restricted view: displaying only ${caller.organizationName || 'your organization'} (Port ${caller.port}). Overall cluster overview is restricted to Steering Council and Auditors.`
      });
    }

    res.json({ success: true, nodes: statuses, isGlobalOverview: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get Fork Tree Topology (Restricted to Steering Council & Auditors)
app.get('/api/tree', async (req, res) => {
  try {
    const caller = getCallerStakeholder(req);
    if (caller && !['STEERING_COUNCIL', 'AUDITOR'].includes(caller.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access Denied: Full consortium fork topology overview is strictly restricted to Steering Council and Regulatory Auditors under zero-trust governance rules.'
      });
    }

    const tree = await forkTreeService.getTreeTopology();
    res.json({ success: true, tree });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get Chain Data Points & HL7 Patient Records (Scoped to Caller's Organization)
app.get('/api/data', async (req, res) => {
  try {
    const caller = getCallerStakeholder(req);
    let patientData = await forkTreeService.getAllPatientRecords();
    const dataPoints = {};

    if (caller && !['STEERING_COUNCIL', 'AUDITOR'].includes(caller.role)) {
      if (caller.role === 'PATIENT') {
        patientData = patientData.filter(r => {
          const pid = (r.patientId || '').toUpperCase();
          return pid === 'P101' || pid.includes('P101') || pid.includes('P-101');
        });
      } else {
        // Individual clinic staff only sees their own organization's records!
        patientData = patientData.filter(r => r.portNumber === caller.port);
      }
    }

    for (const chain of topology.chains) {
      if (!caller || ['STEERING_COUNCIL', 'AUDITOR'].includes(caller.role) || chain.port === caller.port) {
        try { dataPoints[chain.port] = await forkTreeService.getChainDataPoints(chain.port); } catch (e) {}
      }
    }
    res.json({ success: true, data: patientData, points: dataPoints });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get Data for specific chain port (Scoped to Caller's Organization)
app.get('/api/data/:port', async (req, res) => {
  try {
    const port = parseInt(req.params.port, 10);
    const caller = getCallerStakeholder(req);

    if (caller && !['STEERING_COUNCIL', 'AUDITOR', 'PATIENT'].includes(caller.role)) {
      if (caller.port !== port) {
        return res.status(403).json({
          success: false,
          error: `Access Denied (HIPAA § 164.502(b)): You are authenticated as staff of ${caller.organizationName || 'your organization'} (Port ${caller.port}). Access to clinical records from Port ${port} is prohibited.`
        });
      }
    }

    let patientData = await forkTreeService.getChainPatientRecords(port);
    if (caller && caller.role === 'PATIENT') {
      const allowedPid = (caller.patientId || 'P-101').toUpperCase().replace(/^PATIENT\//i, '');
      patientData = patientData.filter(r => {
        const pid = (r.patientId || '').toUpperCase().replace(/^PATIENT\//i, '');
        return pid === allowedPid;
      });
    }
    const dataPoints = await forkTreeService.getChainDataPoints(port);
    res.json({ success: true, port, data: patientData, points: dataPoints });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Run DFS / BFS Tree Search (Restricted to Steering Council & Auditors)
app.post('/api/search', async (req, res) => {
  try {
    const caller = getCallerStakeholder(req);
    if (caller && !['STEERING_COUNCIL', 'AUDITOR'].includes(caller.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access Denied: Consortium-wide DFS/BFS cross-chain tree traversal is restricted to Consortium Steering Council and Regulatory Auditors.'
      });
    }

    const { startNetworkId = 11102, searchValue = 'P101', algorithm = 'BFS', queryType = null } = req.body;
    const result = await forkTreeService.search(algorithm, startNetworkId, searchValue, queryType);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Stakeholder Personas
app.get('/api/personas', (req, res) => {
  res.json({ success: true, personas: stakeholdersConfig.personas || [] });
});

// 7. Organization Stakeholders & Permissions
app.get('/api/stakeholders/:port', async (req, res) => {
  try {
    const port = parseInt(req.params.port, 10);
    const stakeholders = await forkTreeService.getStakeholders(port);
    res.json({ success: true, port, stakeholders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/stakeholders/:port', async (req, res) => {
  try {
    const port = parseInt(req.params.port, 10);
    const { ownerAddress, targetAddress, role } = req.body;
    const result = await forkTreeService.setStakeholderRole(port, ownerAddress, targetAddress, role);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Consortium Governance: Member Organizations
app.get('/api/governance/organizations', async (req, res) => {
  try {
    const orgs = await forkTreeService.getOrganizations();
    res.json({ success: true, organizations: orgs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Consortium Governance: Proposals & Voting
app.get('/api/governance/proposals', async (req, res) => {
  try {
    const proposals = await forkTreeService.getProposals();
    res.json({ success: true, proposals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/governance/proposals', async (req, res) => {
  try {
    const result = await forkTreeService.submitForkProposal(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/governance/vote', async (req, res) => {
  try {
    const result = await forkTreeService.voteProposal(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/governance/execute', async (req, res) => {
  try {
    const result = await forkTreeService.executeProposal(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9b. Steering Council Projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await forkTreeService.getProjects();
    res.json({ success: true, projects });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/projects/create', async (req, res) => {
  try {
    const { name, description, rootNetworkId, callerAddress } = req.body;
    const fromAddr = callerAddress || req.headers['x-caller-address'] || '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02';
    const result = await forkTreeService.createProject({
      name,
      description,
      rootNetworkId,
      callerAddress: fromAddr
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9c. Detailed Healthcare Fork Proposals
app.post('/api/governance/proposals/detailed', async (req, res) => {
  try {
    const { orgName, networkId, portNumber, parentNetworkId, forkBlockNumber, justification, orgType, fhirCapability, initialAdmin, callerAddress } = req.body;
    const fromAddr = callerAddress || req.headers['x-caller-address'] || '0x1111111111111111111111111111111111111111';
    const result = await forkTreeService.submitDetailedForkProposal({
      orgName,
      networkId,
      portNumber,
      parentNetworkId,
      forkBlockNumber,
      justification,
      orgType,
      fhirCapability,
      initialAdmin,
      callerAddress: fromAddr
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9d. Inter-Organization Messaging & Cross-Fork FHIR Gateway
app.get('/api/messages', async (req, res) => {
  try {
    const { networkId } = req.query;
    let messages;
    if (networkId) {
      messages = await forkTreeService.getOrganizationMessages(Number(networkId));
    } else {
      messages = await forkTreeService.getAllMessages();
    }
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/messages/:networkId', async (req, res) => {
  try {
    const netId = parseInt(req.params.networkId, 10);
    const messages = await forkTreeService.getOrganizationMessages(netId);
    res.json({ success: true, networkId: netId, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/messages/send', async (req, res) => {
  try {
    const { senderNetworkId, recipientNetworkId, recipient, messageType, subject, fhirResourceType, fhirResourceId, payload, responseToMessageId, callerAddress } = req.body;
    const fromAddr = callerAddress || req.headers['x-caller-address'] || '0x1111111111111111111111111111111111111111';
    const result = await forkTreeService.sendMessage({
      senderNetworkId,
      recipientNetworkId,
      recipient,
      messageType,
      subject,
      fhirResourceType,
      fhirResourceId,
      payload,
      responseToMessageId,
      callerAddress: fromAddr
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/messages/status', async (req, res) => {
  try {
    const { messageId, status, callerAddress } = req.body;
    const fromAddr = callerAddress || req.headers['x-caller-address'] || '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02';
    const result = await forkTreeService.updateMessageStatus({ messageId, status, callerAddress: fromAddr });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/messages/fulfill-fhir', async (req, res) => {
  try {
    const { requestMessageId, responseResourceType, responsePayload, callerAddress } = req.body;
    const fromAddr = callerAddress || req.headers['x-caller-address'] || '0x4444444444444444444444444444444444444444';
    const result = await forkTreeService.fulfillFhirOrder({
      requestMessageId,
      responseResourceType,
      responsePayload,
      callerAddress: fromAddr
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9e. Register New Stakeholder Persona
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, title, address, organizationId, organizationName, role, port, permissions, avatar } = req.body;
    if (!name || !address || !role) {
      return res.status(400).json({ success: false, error: 'Name, address, and role are required' });
    }

    const personaId = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString().slice(-4);
    const newPersona = {
      id: personaId,
      name,
      title: title || `${role} Stakeholder`,
      address: address.toLowerCase(),
      organizationId: Number(organizationId || 11103),
      organizationName: organizationName || 'Consortium Participant',
      role,
      port: Number(port || 8547),
      permissions: Array.isArray(permissions) ? permissions : ['READ_RECORDS', 'SEND_INTER_ORG_MSG'],
      avatar: avatar || (role === 'STEERING_COUNCIL' ? '🏛️' : role === 'CLINICIAN' ? '🩺' : role === 'SPECIALIST' ? '🔬' : '🏥')
    };

    if (!stakeholdersConfig.personas) stakeholdersConfig.personas = [];
    stakeholdersConfig.personas.push(newPersona);

    try {
      const confPath = path.join(__dirname, 'config/consortiumStakeholders.json');
      fs.writeFileSync(confPath, JSON.stringify(stakeholdersConfig, null, 2), 'utf-8');
    } catch (e) {}

    res.json({ success: true, persona: newPersona, message: `Stakeholder ${name} registered successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9f. Vault Stats
app.get('/api/vault/stats', (req, res) => {
  try {
    const storageAdapter = require('./services/storageAdapter');
    res.json({ success: true, stats: storageAdapter.getVaultStats() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Multi-Fork Block & Data Explorer Endpoints
app.get('/api/explorer/chains', async (req, res) => {
  try {
    const caller = getCallerStakeholder(req);
    const allChains = await forkTreeService.getExplorerChains();

    if (caller && !['STEERING_COUNCIL', 'AUDITOR'].includes(caller.role)) {
      // Individual healthcare organization staff: jailed to their own organization's chain!
      const myChains = allChains.filter(c => c.port === caller.port);
      return res.json({
        success: true,
        chains: myChains.length > 0 ? myChains : allChains.filter(c => c.port === caller.port),
        isGlobalOverview: false,
        jailedPort: caller.port,
        organizationName: caller.organizationName
      });
    }

    res.json({ success: true, chains: allChains, isGlobalOverview: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/explorer/chain/:port/blocks', async (req, res) => {
  try {
    const port = parseInt(req.params.port, 10);
    const caller = getCallerStakeholder(req);

    if (caller && !['STEERING_COUNCIL', 'AUDITOR'].includes(caller.role)) {
      if (caller.port !== port) {
        return res.status(403).json({
          success: false,
          error: `Unauthorized: Cross-organization ledger inspection is prohibited. You are restricted to ${caller.organizationName || 'your organization'} on Port ${caller.port}.`
        });
      }
    }

    const blocks = await forkTreeService.getChainBlocks(port);
    res.json({ success: true, port, blocks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/explorer/chain/:port/block/:blockNumber', async (req, res) => {
  try {
    const port = parseInt(req.params.port, 10);
    const blockNumber = parseInt(req.params.blockNumber, 10);
    const caller = getCallerStakeholder(req);

    if (caller && !['STEERING_COUNCIL', 'AUDITOR'].includes(caller.role)) {
      if (caller.port !== port) {
        return res.status(403).json({
          success: false,
          error: `Unauthorized: Cross-organization block inspection is prohibited. You are restricted to ${caller.organizationName || 'your organization'} on Port ${caller.port}.`
        });
      }
    }

    const blockDetail = await forkTreeService.getChainBlockDetail(port, blockNumber);
    res.json({ success: true, port, blockNumber, block: blockDetail });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/explorer/patient/:patientId/lineage', async (req, res) => {
  try {
    const patientId = req.params.patientId;
    const caller = getCallerStakeholder(req);

    if (caller && caller.role === 'PATIENT') {
      const allowedPid = (caller.patientId || 'P-101').toUpperCase().replace(/^PATIENT\//i, '');
      const reqPid = (patientId || '').toUpperCase().replace(/^PATIENT\//i, '');
      if (reqPid !== allowedPid) {
        return res.status(403).json({
          success: false,
          error: `Access Denied (HIPAA § 164.502): Sovereign Patient Privacy Rule. You are authenticated as Patient ${caller.name} (${caller.patientId || 'P-101'}) and cannot access health records for Patient ${patientId}.`
        });
      }
    }

    const lineage = await forkTreeService.getPatientLineageAcrossForks(patientId);

    if (caller && !['STEERING_COUNCIL', 'AUDITOR', 'PATIENT'].includes(caller.role)) {
      // Individual staff member: external facility clinical resources must be masked / shielded
      // unless on caller's own port
      const filteredTrajectory = (lineage.lineageTrajectory || []).map(event => {
        if (event.port === caller.port) {
          return event; // Full access to own org's event
        }
        // Shield external event details while keeping cryptographic verification anchor
        return {
          chainName: event.chainName,
          port: event.port,
          networkId: event.networkId,
          isRoot: event.isRoot,
          parentNetworkId: event.parentNetworkId,
          forkBlockNumber: event.forkBlockNumber,
          blockNumber: event.blockNumber,
          patientId: event.patientId,
          resourceType: event.resourceType,
          clinicalCode: '[RESTRICTED PHI - EXTERNAL FACILITY]',
          isShielded: true,
          dataHash: event.dataHash,
          blockHash: event.blockHash,
          timestamp: event.timestamp,
          shieldReason: `Event occurred at ${event.chainName}. Protected under HIPAA Minimum Necessary Rule. Direct inspection requires Patient Consent Directive or Inter-Org Referral.`
        };
      });

      return res.json({
        success: true,
        lineage: {
          ...lineage,
          lineageTrajectory: filteredTrajectory,
          isShieldedForStaff: true,
          viewerOrganization: caller.organizationName
        }
      });
    }

    res.json({ success: true, lineage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Add HL7 Patient Health Record (Secured with Caller Address)
app.post('/api/add-patient-record', async (req, res) => {
  try {
    const { port, patientId, resourceType, clinicalCode, resourceData, callerAddress } = req.body;
    const fromAddr = callerAddress || req.headers['x-caller-address'] || '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02';

    const result = await forkTreeService.addPatientRecord({
      port,
      patientId,
      resourceType,
      clinicalCode,
      resourceData,
      callerAddress: fromAddr
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Add Data Point (Legacy + Patient record support)
app.post('/api/add-data', async (req, res) => {
  try {
    const { port, dataValue, patientId, resourceType, clinicalCode, resourceData, callerAddress } = req.body;
    const fromAddr = callerAddress || req.headers['x-caller-address'] || '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02';

    if (patientId) {
      const result = await forkTreeService.addPatientRecord({
        port,
        patientId,
        resourceType: resourceType || 'Observation',
        clinicalCode: clinicalCode || 'CLIN-001',
        resourceData: resourceData || {},
        callerAddress: fromAddr
      });
      return res.json(result);
    }

    const chainConfig = topology.chains.find(c => c.port === Number(port));
    if (!chainConfig) {
      return res.status(400).json({ success: false, error: `Invalid chain port: ${port}` });
    }

    const deps = forkTreeService.getDeployments();
    if (!deps || !deps.dataChains || !deps.dataChains[chainConfig.networkId]) {
      return res.status(400).json({ success: false, error: 'Contract not deployed on this chain' });
    }

    const contractInfo = deps.dataChains[chainConfig.networkId];
    const client = new ContractClient(chainConfig.rpcUrl, BlockData.abi, contractInfo.address);
    const numVal = parseInt(dataValue, 10);
    const tx = await client.send('addDataPoint', [chainConfig.networkId, chainConfig.port, numVal], fromAddr);

    res.json({
      success: true,
      message: `Data point ${numVal} added to Chain ${chainConfig.networkId} (Port ${port})`,
      txHash: tx.hash
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Create / Spin Up a New Forked Blockchain
app.post('/api/fork/create', async (req, res) => {
  try {
    const { name, parentNetworkId, forkBlockNumber, initialData, initialPatientRecords } = req.body;
    const result = await forkTreeService.createForkChain({
      name,
      parentNetworkId,
      forkBlockNumber,
      initialData: initialData || [],
      initialPatientRecords: initialPatientRecords || []
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Get Active Chains
app.get('/api/chains', async (req, res) => {
  try {
    const chains = await forkTreeService.getActiveChains();
    res.json({ success: true, chains });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    nodesConfigured: topology.chains.length + 1
  });
});

// Reseed authentic FHIR clinical records across forks
app.post('/api/reseed-fhir', async (req, res) => {
  try {
    const { seedFhirForkData } = require('./scripts/seedFhirForkData');
    await seedFhirForkData();
    res.json({ success: true, message: 'Successfully seeded authentic HL7 FHIR records across all forks.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Initialize & Boot Platform
async function startPlatform() {
  console.log('===========================================================');
  console.log('  BlockchainForkTree: Shared Consortium Governance Platform');
  console.log('===========================================================');

  try {
    console.log('\n[1/3] Starting multi-chain network engine...');
    await multiChainEngine.startAll();

    console.log('\n[2/3] Checking / Deploying smart contracts...');
    let deployments = forkTreeService.getDeployments();
    const repoNode = multiChainEngine.getNode(8545);
    const needDeploy = !deployments || !deployments.repository || !repoNode || !repoNode.contracts.has((deployments.repository.address || '').toLowerCase());

    if (needDeploy) {
      console.log('Deploying smart contracts across multi-chain network...');
      deployments = await deployContracts();
      console.log('Registering clean fork tree topology (0 mock records)...');
      await seedForkTree();
    } else {
      const cachePath = path.join(__dirname, 'storage/forkDetail.json');
      if (!fs.existsSync(cachePath)) {
        console.log('Registering clean fork tree topology (0 mock records)...');
        await seedForkTree();
      }
    }

    // Auto-seed authentic HL7 FHIR records across network entities if empty
    try {
      const rootRecords = await forkTreeService.getChainPatientRecords(8546);
      if (!rootRecords || rootRecords.length === 0) {
        console.log('Seeding authentic HL7 FHIR records across forks for P-101, P-102, P-103...');
        const { seedFhirForkData } = require('./scripts/seedFhirForkData');
        await seedFhirForkData();
      }
    } catch (e) {
      console.warn('Auto-seed check notice:', e.message);
    }

    app.listen(PORT, () => {
      console.log('===========================================================');
      console.log(` Consortium Dashboard running at http://localhost:${PORT}`);
      console.log('===========================================================');
    });
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startPlatform();
}

module.exports = app;
