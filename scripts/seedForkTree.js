// Seeds the Fork Tree Topology into Repository Chain and Data Points into Child Chains
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

  // 2. Seed Data Points & Patient Health Records across all data chains (Ports 8546-8551)
  console.log('\n2. Populating HL7 Patient Health Records across child blockchains...');
  const allChainDataDump = {};
  const allChainPatientDataDump = {};

  for (const chain of topology.chains) {
    const chainInfo = deployments.dataChains[chain.networkId];
    const dataClient = new ContractClient(chain.rpcUrl, BlockData.abi, chainInfo.address);

    // 2a. Seed HL7 Patient Records
    const patientRecords = (topology.samplePatientData && topology.samplePatientData[chain.networkId.toString()]) || [];
    console.log(`  -> Chain ${chain.networkId} (Port ${chain.port}): Adding ${patientRecords.length} HL7 Patient Records...`);

    for (const rec of patientRecords) {
      const jsonStr = typeof rec.resourceData === 'string' ? rec.resourceData : JSON.stringify(rec.resourceData);
      const dataHash = crypto.createHash('sha256').update(jsonStr).digest('hex');
      const timestamp = Math.floor(Date.now() / 1000);

      await dataClient.send('addPatientRecord', [
        chain.networkId,
        chain.port,
        rec.patientId,
        rec.resourceType,
        rec.clinicalCode,
        jsonStr,
        dataHash,
        timestamp
      ]);
    }

    const totalRecs = await dataClient.call('totalRecords');
    console.log(`     ✓ Total HL7 Patient Records on Port ${chain.port}: ${totalRecs}`);

    // 2b. Seed legacy integer data points for backward compatibility
    const values = topology.sampleData[chain.networkId.toString()] || [];
    for (const val of values) {
      await dataClient.send('addDataPoint', [chain.networkId, chain.port, val]);
    }

    const totalPts = await dataClient.call('totalDataPoints');
    console.log(`     ✓ Total legacy data points on Port ${chain.port}: ${totalPts}`);

    // Fetch and dump records
    const records = await dataClient.call('getAllRecords');
    allChainPatientDataDump[chain.rpcUrl] = records.map(r => ({
      blockNumber: Number(r.blockNumber),
      networkId: Number(r.networkId),
      portNumber: Number(r.portNumber),
      patientId: r.patientId,
      resourceType: r.resourceType,
      clinicalCode: r.clinicalCode,
      resourceData: r.resourceData,
      dataHash: r.dataHash,
      timestamp: Number(r.timestamp)
    }));

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
  fs.writeFileSync(path.join(storageDir, 'chainPatientData.json'), JSON.stringify(allChainPatientDataDump, null, 2), 'utf-8');

  console.log(`\n✓ Cached forkDetail.json, chainTreeData.json, and chainPatientData.json in ${storageDir}`);
  return { forkDetails: forkDetailsDump, chainData: allChainDataDump, patientData: allChainPatientDataDump };
}

if (require.main === module) {
  seedForkTree().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}

module.exports = { seedForkTree };
