// Seeds the Fork Tree Topology into Repository Chain and Data Points into Child Chains
const fs = require('fs');
const path = require('path');
const { ContractClient } = require('../services/contractClient');
const { StoreForkEvent, BlockData } = require('../contracts/compiledArtifacts');
const topology = require('../config/networkTopology.json');

async function seedForkTree() {
  console.log('=== Seeding BlockchainForkTree Topology & Data Points ===');

  const deployPath = path.join(__dirname, '../config/deployments.json');
  if (!fs.existsSync(deployPath)) {
    throw new Error('deployments.json not found! Run deployContracts.js first.');
  }
  const deployments = JSON.parse(fs.readFileSync(deployPath, 'utf-8'));

  // 1. Seed Fork Topology into Repository Chain (Port 8545)
  console.log('\n1. Registering fork events on Repository Chain (Port 8545)...');
  const repoClient = new ContractClient(
    topology.repositoryChain.rpcUrl,
    StoreForkEvent.abi,
    deployments.repository.address
  );

  for (const chain of topology.chains) {
    console.log(`  -> Registering Fork: Chain ${chain.networkId} (Port ${chain.port}) parent: ${chain.parentNetworkId} at block ${chain.forkBlockNumber}`);
    await repoClient.send('addForkDetail', [
      chain.networkId,
      chain.port,
      chain.parentNetworkId,
      chain.forkBlockNumber
    ]);
  }

  const totalForks = await repoClient.call('totalForks');
  console.log(`✓ Fork topology registered! Total forks in repository: ${totalForks}`);

  // 2. Seed Data Points across all data chains (Ports 8546-8551)
  console.log('\n2. Populating data points across child blockchains...');
  const allChainDataDump = {};

  for (const chain of topology.chains) {
    const chainInfo = deployments.dataChains[chain.networkId];
    const dataClient = new ContractClient(chain.rpcUrl, BlockData.abi, chainInfo.address);

    const values = topology.sampleData[chain.networkId.toString()] || [];
    console.log(`  -> Chain ${chain.networkId} (Port ${chain.port}): Adding ${values.length} data points [${values.join(', ')}]...`);

    for (const val of values) {
      await dataClient.send('addDataPoint', [chain.networkId, chain.port, val]);
    }

    const totalPts = await dataClient.call('totalDataPoints');
    console.log(`     ✓ Total data points on Port ${chain.port}: ${totalPts}`);

    const points = await dataClient.call('getAllDataPoints');
    allChainDataDump[chain.rpcUrl] = points.map(p => [
      p.blockNumber.toString(),
      p.networkId.toString(),
      p.portNumber.toString(),
      p.data.toString()
    ]);
  }

  // 3. Save Cache Files into storage/
  const storageDir = path.join(__dirname, '../storage');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const allForkDetails = await repoClient.call('getAllForkDetails');
  const forkDetailsDump = allForkDetails.map(f => [
    f.networkId.toString(),
    f.portNumber.toString(),
    f.parentNetworkId.toString(),
    f.parentChainForkBlockNumber.toString()
  ]);

  fs.writeFileSync(path.join(storageDir, 'forkDetail.json'), JSON.stringify(forkDetailsDump, null, 2), 'utf-8');
  fs.writeFileSync(path.join(storageDir, 'chainTreeData.json'), JSON.stringify(allChainDataDump, null, 2), 'utf-8');

  console.log(`\n✓ Cached forkDetail.json and chainTreeData.json in ${storageDir}`);
  return { forkDetails: forkDetailsDump, chainData: allChainDataDump };
}

if (require.main === module) {
  seedForkTree().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}

module.exports = { seedForkTree };
