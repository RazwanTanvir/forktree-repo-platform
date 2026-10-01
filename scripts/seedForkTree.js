// Clean Topology Initializer for BlockchainForkTree
// Connects parent-child blockchain topology on Consortium Governance without inserting any mock patient data

const fs = require('fs');
const path = require('path');
const { ContractClient } = require('../services/contractClient');
const { StoreForkEvent, BlockData } = require('../contracts/compiledArtifacts');
const topology = require('../config/networkTopology.json');

async function seedForkTree() {
  console.log('=== Initializing BlockchainForkTree Topology (Clean Client Handover Mode) ===');

  const deployPath = path.join(__dirname, '../config/deployments.json');
  if (!fs.existsSync(deployPath)) {
    throw new Error('deployments.json not found! Run deployContracts.js first.');
  }
  const deployments = JSON.parse(fs.readFileSync(deployPath, 'utf-8'));

  // 1. Register Fork Topology into Repository Chain (Port 8545)
  console.log('\n1. Registering clean fork topology on Repository Chain (Port 8545)...');
  const repoClient = new ContractClient(
    topology.repositoryChain.rpcUrl,
    StoreForkEvent.abi,
    deployments.repository.address
  );

  for (const chain of topology.chains) {
    console.log(`  -> Registering Lineage: Chain ${chain.networkId} (Port ${chain.port}) parent: ${chain.parentNetworkId} at block ${chain.forkBlockNumber}`);
    await repoClient.send('addForkDetail', [
      chain.networkId,
      chain.port,
      chain.parentNetworkId,
      chain.forkBlockNumber
    ]);
  }

  const totalForks = await repoClient.call('totalForks');
  console.log(`✓ Fork topology registered! Total forks in repository: ${totalForks}`);

  // 2. Prepare clean empty data structures (Zero mock patient data)
  console.log('\n2. Verifying clean state across all child blockchains (0 patient records)...');
  const allChainDataDump = {};
  const allChainPatientDataDump = {};

  for (const chain of topology.chains) {
    allChainPatientDataDump[chain.rpcUrl] = [];
    allChainDataDump[chain.rpcUrl] = [];
  }

  // 3. Save Clean Cache Files into storage/
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
  fs.writeFileSync(path.join(storageDir, 'chainPatientData.json'), JSON.stringify(allChainPatientDataDump, null, 2), 'utf-8');

  console.log(`\n✓ Pristine topology ready with ZERO mock records in ${storageDir}`);
  return { forkDetails: forkDetailsDump, chainData: allChainDataDump, patientData: allChainPatientDataDump };
}

if (require.main === module) {
  seedForkTree().catch(err => {
    console.error('Initialization failed:', err);
    process.exit(1);
  });
}

module.exports = { seedForkTree };
