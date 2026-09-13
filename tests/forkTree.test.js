// End-to-end Automated Test Suite for BlockchainForkTree
const assert = require('assert');
const { ethers } = require('ethers');
const { multiChainEngine } = require('../engine/chainEngine');
const { deployContracts } = require('../scripts/deployContracts');
const { seedForkTree } = require('../scripts/seedForkTree');
const forkTreeService = require('../services/forkTreeService');
const { ContractClient } = require('../services/contractClient');
const { BlockData, StoreForkEvent } = require('../contracts/compiledArtifacts');
const topology = require('../config/networkTopology.json');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  return fn()
    .then(() => {
      passedTests++;
      console.log(`  ✓ ${desc}`);
    })
    .catch(err => {
      console.error(`  ✗ ${desc}`);
      console.error(`    Error: ${err.message}`);
      throw err;
    });
}

async function runTests() {
  console.log('===========================================================');
  console.log('       BlockchainForkTree: Automated Test Suite            ');
  console.log('===========================================================');

  try {
    console.log('\n[Suite 1: Multi-Chain Network Engine]');
    await it('Starts all 7 blockchain nodes (Ports 8545-8551)', async () => {
      await multiChainEngine.startAll();
      const statuses = multiChainEngine.getAllStatus();
      assert.strictEqual(statuses.length, 7, 'Expected 7 active nodes');
      statuses.forEach(s => assert.strictEqual(s.online, true, `Node ${s.port} should be online`));
    });

    await it('Verifies JSON-RPC eth_chainId for each node', async () => {
      const statuses = multiChainEngine.getAllStatus();
      for (const s of statuses) {
        const node = multiChainEngine.getNode(s.port);
        const res = node.handleRpc({ method: 'eth_chainId', params: [], id: 1 });
        const expectedHex = '0x' + s.networkId.toString(16);
        assert.strictEqual(res.result.toLowerCase(), expectedHex.toLowerCase(), `Chain ID mismatch for port ${s.port}`);
      }
    });

    console.log('\n[Suite 2: Smart Contract Deployment]');
    let deployments;
    await it('Deploys StoreForkEvent on 8545 and BlockData on 8546-8551', async () => {
      deployments = await deployContracts();
      assert.ok(deployments.repository.address, 'Repository contract address missing');
      assert.strictEqual(Object.keys(deployments.dataChains).length, 6, 'Expected 6 deployed data contracts');
    });

    console.log('\n[Suite 3: Fork Tree Topology Registration]');
    await it('Seeds fork events into repository contract on Port 8545', async () => {
      await seedForkTree();
      const repoClient = new ContractClient(topology.repositoryChain.rpcUrl, StoreForkEvent.abi, deployments.repository.address);
      const totalForks = await repoClient.call('totalForks');
      assert.strictEqual(Number(totalForks), 6, 'Expected 6 registered fork events');

      const adjRoot = await repoClient.call('getAdjacencyList', [11102]);
      const childNetIds = Array.from(adjRoot).map(c => Number(c));
      assert.deepStrictEqual(childNetIds, [11103, 11104], 'Root 11102 should have children 11103 and 11104');
    });

    console.log('\n[Suite 4: Cross-Chain Data Ingestion]');
    await it('Verifies data points stored across all child blockchains', async () => {
      for (const chain of topology.chains) {
        const info = deployments.dataChains[chain.networkId];
        const client = new ContractClient(chain.rpcUrl, BlockData.abi, info.address);
        const pts = await client.call('getAllDataPoints');
        const expectedCount = topology.sampleData[chain.networkId.toString()].length;
        assert.strictEqual(pts.length, expectedCount, `Expected ${expectedCount} data points on port ${chain.port}`);
      }
    });

    console.log('\n[Suite 5: Depth-First Search (DFS) Traversal]');
    await it('Discovers target value 43 on Chain 11104 (Port 8548) via DFS', async () => {
      const searchRes = await forkTreeService.dfsSearch(11102, 43);
      assert.strictEqual(searchRes.algorithm, 'DFS');
      assert.strictEqual(searchRes.success, true, 'Search should succeed for value 43');
      assert.strictEqual(searchRes.matches.length, 1, 'Expected 1 match');
      assert.strictEqual(searchRes.matches[0].networkId, 11104, 'Match should be on Network 11104');
      assert.strictEqual(searchRes.matches[0].port, 8548, 'Match should be on Port 8548');
      
      const visitedOrder = searchRes.traversalPath.map(p => p.networkId);
      assert.deepStrictEqual(visitedOrder, [11102, 11103, 11105, 11106, 11104, 11107], 'DFS path should explore branches first');
    });

    await it('Discovers target value 62 on Chain 11106 (Port 8550) via DFS', async () => {
      const searchRes = await forkTreeService.dfsSearch(11102, 62);
      assert.strictEqual(searchRes.success, true, 'Search should succeed for value 62');
      assert.strictEqual(searchRes.matches[0].networkId, 11106, 'Match should be on Network 11106');
    });

    await it('Returns 0 matches for non-existent target value 99999 via DFS', async () => {
      const searchRes = await forkTreeService.dfsSearch(11102, 99999);
      assert.strictEqual(searchRes.success, false, 'Search should fail for non-existent value');
      assert.strictEqual(searchRes.matches.length, 0, 'Matches should be empty');
    });

    console.log('\n[Suite 6: Breadth-First Search (BFS) Traversal]');
    await it('Traverses in level-by-level order (Root -> Level 1 -> Level 2)', async () => {
      const bfsRes = await forkTreeService.bfsSearch(11102, 43);
      assert.strictEqual(bfsRes.algorithm, 'BFS');
      assert.strictEqual(bfsRes.success, true);
      assert.strictEqual(bfsRes.matches.length, 1);
      assert.strictEqual(bfsRes.matches[0].networkId, 11104);

      const visitedOrder = bfsRes.traversalPath.map(p => p.networkId);
      assert.deepStrictEqual(visitedOrder, [11102, 11103, 11104, 11105, 11106, 11107], 'BFS path must visit siblings (Level 1) before children (Level 2)');

      const levels = bfsRes.traversalPath.map(p => p.level);
      assert.deepStrictEqual(levels, [0, 1, 1, 2, 2, 2], 'Node levels should match tree depth');
    });

    await it('Discovers target value 43 at Step 3 in BFS vs Step 5 in DFS', async () => {
      const bfsRes = await forkTreeService.bfsSearch(11102, 43);
      const dfsRes = await forkTreeService.dfsSearch(11102, 43);

      const bfsStep = bfsRes.traversalPath.find(p => p.networkId === 11104).step;
      const dfsStep = dfsRes.traversalPath.find(p => p.networkId === 11104).step;

      assert.strictEqual(bfsStep, 3, 'BFS should reach Level 1 Beta chain (11104) at step 3');
      assert.strictEqual(dfsStep, 5, 'DFS should reach Beta chain (11104) at step 5 after exploring Alpha branch');
      assert.ok(bfsStep < dfsStep, 'BFS should find Level 1 node faster than DFS');
    });

    await it('Unified search API correctly switches between BFS and DFS', async () => {
      const resBfs = await forkTreeService.search('BFS', 11102, 24);
      assert.strictEqual(resBfs.algorithm, 'BFS');
      assert.strictEqual(resBfs.matches[0].networkId, 11102);

      const resDfs = await forkTreeService.search('DFS', 11102, 24);
      assert.strictEqual(resDfs.algorithm, 'DFS');
      assert.strictEqual(resDfs.matches[0].networkId, 11102);
    });

    console.log('\n[Suite 7: Dynamic Data Point Insertion & Multi-Algorithm Discovery]');
    await it('Dynamically adds data point 777 to Port 8549 and discovers it via both DFS and BFS', async () => {
      const chain5 = topology.chains.find(c => c.port === 8549);
      const info5 = deployments.dataChains[chain5.networkId];
      const client5 = new ContractClient(chain5.rpcUrl, BlockData.abi, info5.address);

      await client5.send('addDataPoint', [chain5.networkId, chain5.port, 777]);

      const dfsRes = await forkTreeService.dfsSearch(11102, 777);
      assert.strictEqual(dfsRes.success, true, 'DFS should find newly added data point 777');
      assert.strictEqual(dfsRes.matches[0].port, 8549, 'DFS should match on Port 8549');

      const bfsRes = await forkTreeService.bfsSearch(11102, 777);
      assert.strictEqual(bfsRes.success, true, 'BFS should find newly added data point 777');
      assert.strictEqual(bfsRes.matches[0].port, 8549, 'BFS should match on Port 8549');
    });

    console.log('\n[Suite 8: Dynamic Forked Blockchain Creation & Cross-Chain Traversal]');
    let newForkResult;
    await it('Dynamically spins up a new forked blockchain "Fork Zeta" from Beta 11104', async () => {
      newForkResult = await forkTreeService.createForkChain({
        name: 'Fork Zeta (Beta Child)',
        parentNetworkId: 11104,
        forkBlockNumber: 4,
        initialData: [888]
      });

      assert.strictEqual(newForkResult.success, true, 'Fork creation should succeed');
      assert.strictEqual(newForkResult.node.networkId, 11108, 'Expected Network ID 11108');
      assert.strictEqual(newForkResult.node.port, 8552, 'Expected Port 8552');
      assert.strictEqual(newForkResult.node.parentNetworkId, 11104, 'Expected Parent 11104');
      assert.ok(newForkResult.node.contractAddress, 'Expected deployed contract address');
    });

    await it('Verifies new node 8552 JSON-RPC response and contract deployment', async () => {
      const provider = new ethers.JsonRpcProvider('http://localhost:8552');
      const chainIdHex = await provider.send('eth_chainId', []);
      assert.strictEqual(parseInt(chainIdHex, 16), 11108, 'Chain ID should be 11108');

      const client = new ContractClient('http://localhost:8552', BlockData.abi, newForkResult.node.contractAddress);
      const pts = await client.call('getAllDataPoints');
      assert.strictEqual(pts.length, 1, 'Expected 1 seeded initial data point');
      assert.strictEqual(Number(pts[0].data), 888, 'Expected value 888');
    });

    await it('Verifies fork registration in Repository on Port 8545 and topology update', async () => {
      const repoClient = new ContractClient(
        topology.repositoryChain.rpcUrl,
        StoreForkEvent.abi,
        deployments.repository.address
      );
      const totalForks = await repoClient.call('totalForks');
      assert.strictEqual(Number(totalForks), 7, 'Repository should now have 7 registered forks');

      const tree = await forkTreeService.getTreeTopology();
      const nodeExists = tree.nodes.some(n => n.id === '11108');
      assert.strictEqual(nodeExists, true, 'Tree nodes should include 11108');

      const edgeExists = tree.edges.some(e => e.source === '11104' && e.target === '11108');
      assert.strictEqual(edgeExists, true, 'Tree edges should include edge 11104 -> 11108');
    });

    await it('Discovers data point 888 in the new forked blockchain via BFS and DFS search', async () => {
      const bfsRes = await forkTreeService.search('BFS', 11102, 888);
      assert.strictEqual(bfsRes.success, true, 'BFS should find 888 in dynamically created fork');
      assert.strictEqual(bfsRes.matches[0].networkId, 11108, 'Match should be on Network 11108');
      assert.strictEqual(bfsRes.matches[0].port, 8552, 'Match should be on Port 8552');

      const dfsRes = await forkTreeService.search('DFS', 11102, 888);
      assert.strictEqual(dfsRes.success, true, 'DFS should find 888 in dynamically created fork');
      assert.strictEqual(dfsRes.matches[0].networkId, 11108, 'Match should be on Network 11108');
    });

    console.log('\n===========================================================');
    console.log(` ALL TESTS PASSED: ${passedTests}/${totalTests} (100% Success)`);
    console.log('===========================================================');
  } finally {
    await multiChainEngine.stopAll();
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('\nTest Suite Failed!');
    process.exit(1);
  });
}

module.exports = { runTests };
