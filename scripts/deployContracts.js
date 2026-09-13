// Deploys StoreForkEvent on Port 8545 (Repository) and BlockData on Ports 8546-8551 (Data Chains)
const fs = require('fs');
const path = require('path');
const { ContractClient } = require('../services/contractClient');
const { StoreForkEvent, BlockData } = require('../contracts/compiledArtifacts');
const topology = require('../config/networkTopology.json');

async function deployContracts() {
  console.log('=== Deploying Contracts Across Multi-Chain Network ===');
  const deployments = {
    repository: null,
    dataChains: {}
  };

  // 1. Deploy StoreForkEvent on Repository Chain (Port 8545)
  const repoConfig = topology.repositoryChain;
  console.log(`\n1. Deploying StoreForkEvent on ${repoConfig.name} (${repoConfig.rpcUrl})...`);
  const repoAddress = await ContractClient.deploy(repoConfig.rpcUrl, StoreForkEvent.abi);

  deployments.repository = {
    networkId: repoConfig.networkId,
    port: repoConfig.port,
    address: repoAddress,
    contractType: 'StoreForkEvent'
  };
  console.log(`✓ StoreForkEvent deployed at: ${repoAddress} on Port ${repoConfig.port}`);

  // 2. Deploy BlockData on Each Data Chain (Ports 8546-8551)
  console.log('\n2. Deploying BlockData contracts across data chains...');
  for (const chain of topology.chains) {
    console.log(`Deploying on ${chain.name} (${chain.rpcUrl})...`);
    const dataAddress = await ContractClient.deploy(chain.rpcUrl, BlockData.abi);

    deployments.dataChains[chain.networkId] = {
      networkId: chain.networkId,
      port: chain.port,
      name: chain.name,
      address: dataAddress,
      contractType: 'BlockData',
      rpcUrl: chain.rpcUrl
    };
    console.log(`✓ BlockData deployed at: ${dataAddress} on Port ${chain.port}`);
  }

  // Save deployments.json
  const deployPath = path.join(__dirname, '../config/deployments.json');
  fs.writeFileSync(deployPath, JSON.stringify(deployments, null, 2), 'utf-8');
  console.log(`\n✓ All contracts deployed successfully! Saved metadata to ${deployPath}`);

  return deployments;
}

if (require.main === module) {
  deployContracts().catch(err => {
    console.error('Deployment failed:', err);
    process.exit(1);
  });
}

module.exports = { deployContracts };
