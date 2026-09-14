// Web Dashboard and API Server for BlockchainForkTree
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { multiChainEngine } = require('./engine/chainEngine');
const { deployContracts } = require('./scripts/deployContracts');
const { seedForkTree } = require('./scripts/seedForkTree');
const forkTreeService = require('./services/forkTreeService');
const { ContractClient } = require('./services/contractClient');
const { BlockData } = require('./contracts/compiledArtifacts');
const topology = require('./config/networkTopology.json');

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
    const dataPoints = await forkTreeService.getAllDataPoints();
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

// 6. Add HL7 Patient Health Record
app.post('/api/add-patient-record', async (req, res) => {
  try {
    const { port, patientId, resourceType, clinicalCode, resourceData } = req.body;
    const chainConfig = topology.chains.find(c => c.port === Number(port));
    if (!chainConfig) {
      return res.status(400).json({ success: false, error: `Invalid chain port: ${port}` });
    }

    const deps = forkTreeService.getDeployments();
    if (!deps || !deps.dataChains || !deps.dataChains[chainConfig.networkId]) {
      return res.status(400).json({ success: false, error: 'Contract not deployed on this chain' });
    }

    const jsonStr = typeof resourceData === 'string' ? resourceData : JSON.stringify(resourceData || {});
    const dataHash = crypto.createHash('sha256').update(jsonStr).digest('hex');
    const timestamp = Math.floor(Date.now() / 1000);

    const contractInfo = deps.dataChains[chainConfig.networkId];
    const client = new ContractClient(chainConfig.rpcUrl, BlockData.abi, contractInfo.address);
    const tx = await client.send('addPatientRecord', [
      chainConfig.networkId,
      chainConfig.port,
      patientId,
      resourceType,
      clinicalCode,
      jsonStr,
      dataHash,
      timestamp
    ]);

    res.json({
      success: true,
      message: `HL7 ${resourceType} record for patient ${patientId} added to Chain ${chainConfig.networkId} (Port ${port})`,
      txHash: tx.hash,
      dataHash
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Add Data Point to a specific chain (supports both HL7 and integer formats)
app.post('/api/add-data', async (req, res) => {
  try {
    const { port, dataValue, patientId, resourceType, clinicalCode, resourceData } = req.body;
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

    if (patientId) {
      const jsonStr = typeof resourceData === 'string' ? resourceData : JSON.stringify(resourceData || {});
      const dataHash = crypto.createHash('sha256').update(jsonStr).digest('hex');
      const timestamp = Math.floor(Date.now() / 1000);

      const tx = await client.send('addPatientRecord', [
        chainConfig.networkId,
        chainConfig.port,
        patientId,
        resourceType || 'Observation',
        clinicalCode || 'GEN-001',
        jsonStr,
        dataHash,
        timestamp
      ]);

      return res.json({
        success: true,
        message: `HL7 Patient Record for ${patientId} added to Chain ${chainConfig.networkId} (Port ${port})`,
        txHash: tx.hash,
        dataHash
      });
    }

    const tx = await client.send('addDataPoint', [
      chainConfig.networkId,
      chainConfig.port,
      parseInt(dataValue, 10)
    ]);

    res.json({
      success: true,
      message: `Data point ${dataValue} added to Chain ${chainConfig.networkId} (Port ${port})`,
      txHash: tx.hash
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. List Active Chains
app.get('/api/chains', async (req, res) => {
  try {
    const chains = await forkTreeService.getActiveChains();
    res.json({ success: true, chains });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Spin Up New Forked Blockchain
app.post('/api/fork/create', async (req, res) => {
  try {
    const { name, parentNetworkId, forkBlockNumber, initialData, initialPatientRecords } = req.body;
    if (!parentNetworkId) {
      return res.status(400).json({ success: false, error: 'Parent blockchain selection is required.' });
    }
    const result = await forkTreeService.createForkChain({
      name,
      parentNetworkId,
      forkBlockNumber,
      initialData,
      initialPatientRecords
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Reset Network & Reseed
app.post('/api/reset-and-seed', async (req, res) => {
  try {
    console.log('[API] Resetting network and reseeding...');
    await multiChainEngine.stopAll();
    await multiChainEngine.startAll();
    await deployContracts();
    await seedForkTree();
    res.json({ success: true, message: 'Network reset, contracts re-deployed, and data re-seeded successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function startServer() {
  console.log('=== Initializing BlockchainForkTree Platform ===');
  console.log('1. Starting simulated multi-chain nodes (Ports 8545-8551)...');
  await multiChainEngine.startAll();

  console.log('2. Deploying contracts...');
  await deployContracts();

  console.log('3. Seeding fork topology and initial data points...');
  await seedForkTree();

  app.listen(PORT, () => {
    console.log('===========================================================');
    console.log(` BlockchainForkTree Dashboard running at http://localhost:${PORT}`);
    console.log('===========================================================');
  });
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('Server startup failed:', err);
    process.exit(1);
  });
}

module.exports = { app, startServer };
