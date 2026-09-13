// Web Dashboard and API Server for BlockchainForkTree
const express = require('express');
const path = require('path');
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

// 3. Get All Chain Data Points
app.get('/api/data', async (req, res) => {
  try {
    const data = await forkTreeService.getAllDataPoints();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get Data Points for specific chain port
app.get('/api/data/:port', async (req, res) => {
  try {
    const port = parseInt(req.params.port, 10);
    const data = await forkTreeService.getChainDataPoints(port);
    res.json({ success: true, port, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Run DFS / BFS Tree Search
app.post('/api/search', async (req, res) => {
  try {
    const { startNetworkId = 11102, searchValue = 43, algorithm = 'DFS' } = req.body;
    const result = await forkTreeService.search(algorithm, startNetworkId, searchValue);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Add Data Point to a specific chain
app.post('/api/add-data', async (req, res) => {
  try {
    const { port, dataValue } = req.body;
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

// 7. List Active Chains
app.get('/api/chains', async (req, res) => {
  try {
    const chains = await forkTreeService.getActiveChains();
    res.json({ success: true, chains });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Spin Up New Forked Blockchain
app.post('/api/fork/create', async (req, res) => {
  try {
    const { name, parentNetworkId, forkBlockNumber, initialData } = req.body;
    if (!parentNetworkId) {
      return res.status(400).json({ success: false, error: 'Parent blockchain selection is required.' });
    }
    const result = await forkTreeService.createForkChain({
      name,
      parentNetworkId,
      forkBlockNumber,
      initialData
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
