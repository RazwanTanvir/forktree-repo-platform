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

// 1. Get Node Statuses
app.get('/api/status', async (req, res) => {
  try {
    const statuses = await forkTreeService.getNodeStatuses();
    res.json({ success: true, nodes: statuses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get Fork Tree Topology
app.get('/api/tree', async (req, res) => {
  try {
    const tree = await forkTreeService.getTreeTopology();
    res.json({ success: true, tree });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get All Chain Data Points & HL7 Patient Records
app.get('/api/data', async (req, res) => {
  try {
    const patientData = await forkTreeService.getAllPatientRecords();
    const dataPoints = {};
    for (const chain of topology.chains) {
      try { dataPoints[chain.port] = await forkTreeService.getChainDataPoints(chain.port); } catch (e) {}
    }
    res.json({ success: true, data: patientData, points: dataPoints });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get Data for specific chain port
app.get('/api/data/:port', async (req, res) => {
  try {
    const port = parseInt(req.params.port, 10);
    const patientData = await forkTreeService.getChainPatientRecords(port);
    const dataPoints = await forkTreeService.getChainDataPoints(port);
    res.json({ success: true, port, data: patientData, points: dataPoints });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Run DFS / BFS Tree Search (Patient ID, Resource Type, Clinical Code, or Integer)
app.post('/api/search', async (req, res) => {
  try {
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

// 10. Add HL7 Patient Health Record (Secured with Caller Address)
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
    if (!deployments) {
      console.log('No deployments found. Deploying contracts...');
      deployments = await deployContracts();
    }

    console.log('\n[3/3] Checking / Seeding fork tree and initial patient data...');
    const cachePath = path.join(__dirname, 'storage/forkDetail.json');
    if (!fs.existsSync(cachePath)) {
      console.log('Seeding initial fork tree topology and HL7 FHIR records...');
      await seedForkTree();
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
