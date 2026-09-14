// End-to-end Automated Test Suite for BlockchainForkTree
const assert = require('assert');
const crypto = require('crypto');
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

    console.log('\n[Suite 4: Cross-Chain HL7 Healthcare Data Ingestion & Integrity]');
    await it('Verifies HL7 Patient Health Records stored on child chains', async () => {
      for (const chain of topology.chains) {
        const info = deployments.dataChains[chain.networkId];
        const client = new ContractClient(chain.rpcUrl, BlockData.abi, info.address);
        const records = await client.call('getAllRecords');
        const expectedRecs = (topology.samplePatientData[chain.networkId.toString()] || []).length;
        assert.strictEqual(records.length, expectedRecs, `Expected ${expectedRecs} patient records on port ${chain.port}`);
      }
    });

    await it('Verifies SHA-256 cryptographic hash integrity of stored FHIR records', async () => {
      const rootConfig = topology.chains.find(c => c.port === 8546);
      const rootClient = new ContractClient(rootConfig.rpcUrl, BlockData.abi, deployments.dataChains[rootConfig.networkId].address);
      const records = await rootClient.call('getAllRecords');
      assert.ok(records.length > 0, 'Root should have patient records');

      for (const rec of records) {
        const computedHash = crypto.createHash('sha256').update(rec.resourceData).digest('hex');
        assert.strictEqual(rec.dataHash, computedHash, `SHA-256 integrity mismatch for record ${rec.patientId}`);
        assert.ok(rec.timestamp > 0n, 'Timestamp should be valid Unix epoch seconds');
      }
    });

    await it('Verifies legacy integer data points for backward compatibility', async () => {
      for (const chain of topology.chains) {
        const info = deployments.dataChains[chain.networkId];
        const client = new ContractClient(chain.rpcUrl, BlockData.abi, info.address);
        const pts = await client.call('getAllDataPoints');
        const expectedCount = topology.sampleData[chain.networkId.toString()].length;
        assert.strictEqual(pts.length, expectedCount, `Expected ${expectedCount} data points on port ${chain.port}`);
      }
    });

    console.log('\n[Suite 5: Depth-First Search (DFS) & Longitudinal EHR Reconstruction]');
    await it('Reconstructs complete longitudinal EHR for Patient P101 across all 6 chains via DFS', async () => {
      const searchRes = await forkTreeService.dfsSearch(11102, 'P101', 'patientId');
      assert.strictEqual(searchRes.algorithm, 'DFS');
      assert.strictEqual(searchRes.success, true, 'Search should succeed for patient P101');
      assert.strictEqual(searchRes.matches.length, 6, 'Patient P101 should have records on all 6 chains');
      assert.ok(searchRes.longitudinalRecord.length >= 6, 'Expected at least 6 aggregated clinical events in EHR');

      // Verify records are sorted chronologically
      for (let i = 1; i < searchRes.longitudinalRecord.length; i++) {
        assert.ok(searchRes.longitudinalRecord[i].timestamp >= searchRes.longitudinalRecord[i - 1].timestamp, 'EHR timeline must be sorted chronologically');
      }

      // Verify DFS exploration order (deep branches first before backtracking)
      const visitedOrder = searchRes.traversalPath.map(p => p.networkId);
      assert.deepStrictEqual(visitedOrder, [11102, 11103, 11105, 11106, 11104, 11107], 'DFS path should explore Alpha branch deep before Beta');
    });

    await it('Discovers target integer value 43 on Chain 11104 (Port 8548) via DFS (legacy compat)', async () => {
      const searchRes = await forkTreeService.dfsSearch(11102, 43);
      assert.strictEqual(searchRes.success, true);
      assert.strictEqual(searchRes.matches[0].networkId, 11104);
      assert.strictEqual(searchRes.matches[0].port, 8548);
    });

    await it('Returns 0 matches for non-existent patient ID P999 via DFS', async () => {
      const searchRes = await forkTreeService.dfsSearch(11102, 'P999', 'patientId');
      assert.strictEqual(searchRes.success, false, 'Search should fail for non-existent patient P999');
      assert.strictEqual(searchRes.matches.length, 0);
    });

    console.log('\n[Suite 6: Breadth-First Search (BFS) & Clinical Resource Filtering]');
    await it('Reconstructs complete longitudinal EHR for Patient P101 in level-by-level order via BFS', async () => {
      const bfsRes = await forkTreeService.bfsSearch(11102, 'P101', 'patientId');
      assert.strictEqual(bfsRes.algorithm, 'BFS');
      assert.strictEqual(bfsRes.success, true);
      assert.strictEqual(bfsRes.matches.length, 6);
      assert.ok(bfsRes.longitudinalRecord.length >= 6);

      const visitedOrder = bfsRes.traversalPath.map(p => p.networkId);
      assert.deepStrictEqual(visitedOrder, [11102, 11103, 11104, 11105, 11106, 11107], 'BFS path must visit siblings (Level 1) before children (Level 2)');

      const levels = bfsRes.traversalPath.map(p => p.level);
      assert.deepStrictEqual(levels, [0, 1, 1, 2, 2, 2], 'Node levels should match tree depth');
    });

    await it('Discovers all Observation resources across chains via BFS', async () => {
      const obsRes = await forkTreeService.bfsSearch(11102, 'Observation', 'resourceType');
      assert.strictEqual(obsRes.success, true);
      // Observations exist on Beta (11104), Gamma (11105), and Delta (11106)
      const matchedChains = obsRes.matches.map(m => m.networkId).sort();
      assert.deepStrictEqual(matchedChains, [11104, 11105, 11106], 'Observations should be found on Beta, Gamma, and Delta chains');
    });

    await it('Discovers clinical diagnosis code E11.9 (Type 2 Diabetes) on Fork Alpha 11103', async () => {
      const diagRes = await forkTreeService.search('BFS', 11102, 'E11.9', 'keyword');
      assert.strictEqual(diagRes.success, true);
      assert.strictEqual(diagRes.matches.length, 1);
      assert.strictEqual(diagRes.matches[0].networkId, 11103);
      assert.strictEqual(diagRes.matches[0].matchingRecords[0].clinicalCode, 'ICD-10:E11.9');
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

    console.log('\n[Suite 7: Dynamic Healthcare Record Insertion & Integrity Verification]');
    await it('Dynamically commits new HL7 Observation to Port 8549 and discovers it via BFS and DFS', async () => {
      const chain5 = topology.chains.find(c => c.port === 8549);
      const info5 = deployments.dataChains[chain5.networkId];
      const client5 = new ContractClient(chain5.rpcUrl, BlockData.abi, info5.address);

      const newFhirData = {
        resourceType: 'Observation',
        id: 'OBS-999',
        status: 'final',
        code: { coding: [{ system: 'http://loinc.org', code: '2345-7', display: 'Glucose in Blood' }] },
        subject: { reference: 'Patient/P200' },
        valueQuantity: { value: 142, unit: 'mg/dL' }
      };
      const jsonStr = JSON.stringify(newFhirData);
      const dataHash = crypto.createHash('sha256').update(jsonStr).digest('hex');
      const timestamp = Math.floor(Date.now() / 1000);

      await client5.send('addPatientRecord', [
        chain5.networkId,
        chain5.port,
        'P200',
        'Observation',
        'LOINC:2345-7',
        jsonStr,
        dataHash,
        timestamp
      ]);

      // Verify search discovery
      const bfsRes = await forkTreeService.search('BFS', 11102, 'P200', 'patientId');
      assert.strictEqual(bfsRes.success, true, 'BFS should discover dynamically added patient P200');
      assert.strictEqual(bfsRes.matches[0].port, 8549, 'Match should be on Port 8549');
      assert.strictEqual(bfsRes.matches[0].matchingRecords[0].dataHash, dataHash, 'Hash should match');

      const dfsRes = await forkTreeService.search('DFS', 11102, 'P200', 'patientId');
      assert.strictEqual(dfsRes.success, true, 'DFS should discover dynamically added patient P200');
      assert.strictEqual(dfsRes.matches[0].port, 8549);
    });

    await it('Dynamically adds legacy integer 777 to Port 8549 and discovers it via DFS', async () => {
      const chain5 = topology.chains.find(c => c.port === 8549);
      const info5 = deployments.dataChains[chain5.networkId];
      const client5 = new ContractClient(chain5.rpcUrl, BlockData.abi, info5.address);

      await client5.send('addDataPoint', [chain5.networkId, chain5.port, 777]);

      const dfsRes = await forkTreeService.dfsSearch(11102, 777);
      assert.strictEqual(dfsRes.success, true);
      assert.strictEqual(dfsRes.matches[0].port, 8549);
    });

    console.log('\n[Suite 8: Dynamic Forked Healthcare Blockchain Spawning & Cross-Chain Traversal]');
    let newForkResult;
    await it('Spins up new healthcare fork "Fork Zeta - Oncology Clinic" from Beta 11104', async () => {
      newForkResult = await forkTreeService.createForkChain({
        name: 'Fork Zeta - Oncology Clinic',
        parentNetworkId: 11104,
        forkBlockNumber: 4,
        initialData: [888],
        initialPatientRecords: [
          {
            patientId: 'P101',
            resourceType: 'Condition',
            clinicalCode: 'ICD-10:C34.90',
            resourceData: {
              resourceType: 'Condition',
              id: 'COND-801',
              code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'C34.90', display: 'Malignant neoplasm of unsp part of bronchus or lung' }] },
              subject: { reference: 'Patient/P101' }
            }
          }
        ]
      });

      assert.strictEqual(newForkResult.success, true, 'Fork creation should succeed');
      assert.strictEqual(newForkResult.node.networkId, 11108, 'Expected Network ID 11108');
      assert.strictEqual(newForkResult.node.port, 8552, 'Expected Port 8552');
      assert.strictEqual(newForkResult.node.parentNetworkId, 11104, 'Expected Parent 11104');
      assert.ok(newForkResult.node.contractAddress, 'Expected deployed contract address');
    });

    await it('Verifies new node 8552 JSON-RPC response and HL7 patient record deployment', async () => {
      const provider = new ethers.JsonRpcProvider('http://localhost:8552');
      const chainIdHex = await provider.send('eth_chainId', []);
      assert.strictEqual(parseInt(chainIdHex, 16), 11108, 'Chain ID should be 11108');

      const client = new ContractClient('http://localhost:8552', BlockData.abi, newForkResult.node.contractAddress);
      const recs = await client.call('getAllRecords');
      assert.strictEqual(recs.length, 1, 'Expected 1 seeded initial patient record');
      assert.strictEqual(recs[0].patientId, 'P101');
      assert.strictEqual(recs[0].clinicalCode, 'ICD-10:C34.90');

      const pts = await client.call('getAllDataPoints');
      assert.strictEqual(pts.length, 1, 'Expected 1 seeded initial data point');
      assert.strictEqual(Number(pts[0].data), 888);
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

    await it('Discovers the new oncology record in the spawned fork via BFS and DFS search', async () => {
      const bfsRes = await forkTreeService.search('BFS', 11102, 'C34.90', 'keyword');
      assert.strictEqual(bfsRes.success, true, 'BFS should find C34.90 in dynamically created fork');
      assert.strictEqual(bfsRes.matches[0].networkId, 11108, 'Match should be on Network 11108');
      assert.strictEqual(bfsRes.matches[0].port, 8552, 'Match should be on Port 8552');

      const dfsRes = await forkTreeService.search('DFS', 11102, 'C34.90', 'keyword');
      assert.strictEqual(dfsRes.success, true, 'DFS should find C34.90 in dynamically created fork');
      assert.strictEqual(dfsRes.matches[0].networkId, 11108);
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
