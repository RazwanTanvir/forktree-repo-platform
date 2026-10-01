/**
 * Hardhat Multi-Network Production & Testnet Configuration
 * Supports deployment to:
 * 1. Local Consortium Engine (localhost:8545)
 * 2. Public Ethereum Testnets (Sepolia, Holesky)
 * 3. Private Enterprise Consortium (Hyperledger Besu QBFT, Polygon CDK)
 */

require('dotenv').config({ path: './config/.env' });

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';
const HOLESKY_RPC_URL = process.env.HOLESKY_RPC_URL || 'https://ethereum-holesky-rpc.publicnode.com';
const BESU_RPC_URL = process.env.BESU_CONSORTIUM_RPC_URL || 'http://127.0.0.1:8545';

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 11101,
      accounts: [DEPLOYER_PRIVATE_KEY]
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      chainId: 11155111,
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 'auto'
    },
    holesky: {
      url: HOLESKY_RPC_URL,
      chainId: 17000,
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 'auto'
    },
    besu_consortium: {
      url: BESU_RPC_URL,
      chainId: 11101,
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 0 // Zero-gas enterprise consortium model
    }
  },
  paths: {
    sources: './contracts',
    tests: './tests',
    cache: './storage/hardhat-cache',
    artifacts: './storage/hardhat-artifacts'
  }
};
