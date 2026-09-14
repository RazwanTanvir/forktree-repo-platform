// End-to-end Automated Test Suite for BlockchainForkTree
// Validates Shared Consortium Governance, Stakeholder RBAC Security, and Longitudinal EHR Traversals

const assert = require('assert');
const crypto = require('crypto');
const { ethers } = require('ethers');
const { multiChainEngine } = require('../engine/chainEngine');
const { deployContracts } = require('../scripts/deployContracts');
const { seedForkTree } = require('../scripts/seedForkTree');
const forkTreeService = require('../services/forkTreeService');
const { ContractClient } = require('../services/contractClient');
const { ConsortiumGovernance, StoreForkEvent, BlockData } = require('../contracts/compiledArtifacts');
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
  console.log('   (Shared Governance & Stakeholder RBAC Security)        ');
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
    await it('Deploys ConsortiumGovernance on 8545 and BlockData on 8546-8551', async () => {
      deployments = await deployContracts();
      assert.ok(deployments.repository.address, 'Repository contract address missing');
      assert.strictEqual(Object.keys(deployments.dataChains).length, 6, 'Expected 6 deployed data contracts');
    });

    console.log('\n[Suite 3: Shared Consortium Governance & Organization Registry]');
    const repoClient = new ContractClient(topology.repositoryChain.rpcUrl, ConsortiumGovernance.abi, deployments.repository.address);

    await it('Verifies consortium member organizations registered on Port 8545', async () => {
      const orgCount = await repoClient.call('totalOrganizations');
      assert.ok(Number(orgCount) >= 6, 'Expected at least 6 registered consortium organizations');

      const allOrgs = await repoClient.call('getAllOrganizations');
      const orgNames = Array.from(allOrgs).map(o => String(o.name || o[1]));
      assert.ok(orgNames.some(n => n.includes('Metro General Hospital')), 'Metro Hospital should be registered');
      assert.ok(orgNames.some(n => n.includes('BioLabs')), 'BioLabs should be registered');
    });

    let testProposalId;
    await it('Submits on-chain fork proposal for Pediatric Specialty Clinic', async () => {
      const proposer = '0x1111111111111111111111111111111111111111'; // Metro Admin
      const tx = await repoClient.send('proposeFork', [
        "Children's Health & Pediatric Clinic",
        11110,
        8554,
        11103, // Fork from Metro Hospital
        10,
        'Expansion of regional pediatric and adolescent care',
        'Specialty Clinic'
      ], proposer);

      assert.ok(tx.hash, 'Proposal transaction hash missing');

      const totalProps = await repoClient.call('totalProposals');
      testProposalId = Number(totalProps);
      assert.ok(testProposalId > 0, 'Proposal ID should be positive');

      const proposal = await repoClient.call('getProposalByIndex', [testProposalId - 1]);
      assert.strictEqual(String(proposal.orgName || proposal[2]), "Children's Health & Pediatric Clinic");
      assert.strictEqual(Number(proposal.votesFor || proposal[9]), 1, 'Proposer should automatically cast 1 vote for');
    });

    await it('Member organizations vote on proposal and verify majority consensus', async () => {
      const voter = '0x3333333333333333333333333333333333333333'; // BioLabs Admin
      await repoClient.send('voteOnProposal', [BigInt(testProposalId), true], voter);

      const updatedProp = await repoClient.call('getProposalByIndex', [testProposalId - 1]);
      assert.strictEqual(Number(updatedProp.votesFor || updatedProp[9]), 2, 'Expected 2 votes for');
    });

    await it('Executes approved proposal and automatically updates fork topology', async () => {
      await repoClient.send('executeForkProposal', [BigInt(testProposalId)]);

      const execProp = await repoClient.call('getProposalByIndex', [testProposalId - 1]);
      assert.strictEqual(Boolean(execProp.executed !== undefined ? execProp.executed : execProp[11]), true);

      // Verify adjacency list updated
      const adjMetro = await repoClient.call('getAdjacencyList', [11103]);
      const children = Array.from(adjMetro).map(c => Number(c));
      assert.ok(children.includes(11110), 'Metro Hospital 11103 should now include Pediatric child 11110');
    });

    console.log('\n[Suite 4: Initial Fork Tree Topology Seeding]');
    await it('Seeds initial fork events and registers parent-child topology', async () => {
      await seedForkTree();
      const totalForks = await repoClient.call('totalForks');
      assert.ok(Number(totalForks) >= 6, 'Expected at least 6 registered fork events');

      const adjRoot = await repoClient.call('getAdjacencyList', [11102]);
      const childNetIds = Array.from(adjRoot).map(c => Number(c));
      assert.ok(childNetIds.includes(11103), 'Root 11102 should have child 11103');
      assert.ok(childNetIds.includes(11104), 'Root 11102 should have child 11104');
    });

    console.log('\n[Suite 5: Stakeholder Ownership & Role-Based Access Control (RBAC)]');
    const metroConfig = topology.chains.find(c => c.port === 8547);
    const metroClient = new ContractClient(metroConfig.rpcUrl, BlockData.abi, deployments.dataChains[metroConfig.networkId].address);

    const biolabsConfig = topology.chains.find(c => c.port === 8548);
    const biolabsClient = new ContractClient(biolabsConfig.rpcUrl, BlockData.abi, deployments.dataChains[biolabsConfig.networkId].address);

    await it('POSITIVE: Authorized clinician (Dr. Alice) successfully commits patient record', async () => {
      const drAlice = '0x2222222222222222222222222222222222222222';
      const samplePayload = JSON.stringify({ resourceType: 'Observation', value: 'Normal' });
      const hash = crypto.createHash('sha256').update(samplePayload).digest('hex');

      const tx = await metroClient.send('addPatientRecordSecured', [
        metroConfig.networkId,
        metroConfig.port,
        'P101',
        'Observation',
        'LOINC:8867-4',
        samplePayload,
        hash,
        Math.floor(Date.now() / 1000)
      ], drAlice);

      assert.ok(tx.hash, 'Transaction hash should be present');
    });

    await it('NEGATIVE: Unauthorized address (0x9999...) is rejected by smart contract RBAC', async () => {
      const attacker = '0x9999999999999999999999999999999999999999';
      const samplePayload = JSON.stringify({ resourceType: 'Observation', value: 'Fake' });
      const hash = crypto.createHash('sha256').update(samplePayload).digest('hex');

      let rejected = false;
      try {
        await metroClient.send('addPatientRecordSecured', [
          metroConfig.networkId,
          metroConfig.port,
          'P101',
          'Observation',
          'LOINC:0000-0',
          samplePayload,
          hash,
          Math.floor(Date.now() / 1000)
        ], attacker);
      } catch (err) {
        rejected = true;
        assert.ok(err.message.includes('not authorized'), `Expected unauthorized error, got: ${err.message}`);
      }
      assert.strictEqual(rejected, true, 'Unauthorized writer should be rejected');
    });

    await it('NEGATIVE: Cross-org clinician cannot write to unauthorized organization (Dr. Alice on BioLabs)', async () => {
      const drAlice = '0x2222222222222222222222222222222222222222';
      const samplePayload = JSON.stringify({ resourceType: 'Observation', value: 'Unauthorized Cross Org' });
      const hash = crypto.createHash('sha256').update(samplePayload).digest('hex');

      let rejected = false;
      try {
        await biolabsClient.send('addPatientRecordSecured', [
          biolabsConfig.networkId,
          biolabsConfig.port,
          'P101',
          'Observation',
          'LOINC:15074-8',
          samplePayload,
          hash,
          Math.floor(Date.now() / 1000)
        ], drAlice);
      } catch (err) {
        rejected = true;
        assert.ok(err.message.includes('not authorized'), `Expected unauthorized error, got: ${err.message}`);
      }
      assert.strictEqual(rejected, true, 'Cross-org unauthorized write should be rejected');
    });

    await it('Org owner can grant CLINICIAN role to a new doctor, enabling writes', async () => {
      const drRobert = '0x8888888888888888888888888888888888888888';
      const metroAdmin = '0x1111111111111111111111111111111111111111';

      // 1. Admin grants role 1 (CLINICIAN)
      await metroClient.send('setStakeholderRole', [drRobert, 1], metroAdmin);

      // 2. Dr. Robert can now commit
      const samplePayload = JSON.stringify({ resourceType: 'Observation', value: 'Dr Robert Note' });
      const hash = crypto.createHash('sha256').update(samplePayload).digest('hex');

      const tx = await metroClient.send('addPatientRecordSecured', [
        metroConfig.networkId,
        metroConfig.port,
        'P101',
        'Observation',
        'LOINC:8867-4',
        samplePayload,
        hash,
        Math.floor(Date.now() / 1000)
      ], drRobert);

      assert.ok(tx.hash, 'Dr. Robert should successfully commit after role grant');
    });

    console.log('\n[Suite 6: Cross-Chain HL7 Healthcare Data Integrity]');
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
        assert.ok(pts.length >= 0, `Data points should be queryable on ${chain.port}`);
      }
    });

    console.log('\n[Suite 7: Depth-First Search (DFS) & Longitudinal EHR Reconstruction]');
    await it('Reconstructs complete longitudinal EHR for Patient P101 across all chains via DFS', async () => {
      const result = await forkTreeService.dfsSearch(11102, 'P101', 'patientId');
      assert.strictEqual(result.success, true, 'DFS Search should find matches for P101');
      assert.ok(result.longitudinalRecord.length >= 6, `Expected at least 6 clinical events for P101, got ${result.longitudinalRecord.length}`);

      const visitedPorts = result.traversalPath.map(p => p.port);
      [8546, 8547, 8548, 8549, 8550, 8551].forEach(port => {
        assert.ok(visitedPorts.includes(port), `DFS should visit Port ${port}`);
      });
    });

    await it('Discovers target integer value 43 on Chain 11104 (Port 8548) via DFS', async () => {
      const result = await forkTreeService.dfsSearch(11102, 43, 'integer');
      assert.strictEqual(result.success, true);
      const matched = result.matches.find(m => m.networkId === 11104);
      assert.ok(matched, 'Chain 11104 should contain value 43');
    });

    console.log('\n[Suite 8: Breadth-First Search (BFS) & Clinical Filtering]');
    await it('Reconstructs complete longitudinal EHR for Patient P101 in level order via BFS', async () => {
      const result = await forkTreeService.bfsSearch(11102, 'P101', 'patientId');
      assert.strictEqual(result.success, true);
      assert.ok(result.longitudinalRecord.length >= 6);

      const levels = result.traversalPath.map(p => p.level);
      for (let i = 1; i < levels.length; i++) {
        assert.ok(levels[i] >= levels[i - 1], 'BFS levels must be non-decreasing');
      }
    });

    await it('Discovers all Observation resources across chains via BFS', async () => {
      const result = await forkTreeService.bfsSearch(11102, 'Observation', 'resourceType');
      assert.strictEqual(result.success, true);
      const obsRecs = result.longitudinalRecord.filter(r => r.resourceType.toLowerCase() === 'observation');
      assert.ok(obsRecs.length >= 2, 'Expected multiple Observation records');
    });

    console.log('\n[Suite 9: Dynamic Healthcare Fork Spawning & Cross-Chain Traversal]');
    let spawnedNodePort;
    await it('Spins up new healthcare fork "Fork Zeta - Oncology Clinic" from Beta 11104', async () => {
      const res = await forkTreeService.createForkChain({
        name: 'Fork Zeta - Oncology Clinic',
        parentNetworkId: 11104,
        forkBlockNumber: 2,
        initialPatientRecords: [
          {
            patientId: 'P101',
            resourceType: 'Observation',
            clinicalCode: 'LOINC:21907-1',
            resourceData: {
              resourceType: 'Observation',
              id: 'OBS-ONCO-01',
              status: 'final',
              code: { coding: [{ system: 'http://loinc.org', code: '21907-1', display: 'Cancer antigen 125' }] },
              valueQuantity: { value: 18.5, unit: 'U/mL' }
            }
          }
        ]
      });

      assert.strictEqual(res.success, true);
      spawnedNodePort = res.node.port;
      assert.ok(spawnedNodePort >= 8552, `Expected dynamic port >= 8552, got ${spawnedNodePort}`);
    });

    await it('Discovers the new oncology record in the spawned fork via BFS search', async () => {
      const result = await forkTreeService.bfsSearch(11102, 'P101', 'patientId');
      assert.strictEqual(result.success, true);
      const oncoRec = result.longitudinalRecord.find(r => r.clinicalCode === 'LOINC:21907-1');
      assert.ok(oncoRec, 'BFS should discover the newly spawned oncology clinic record');
      assert.strictEqual(oncoRec.portNumber, spawnedNodePort);
    });

    console.log('\n===========================================================');
    console.log(` ALL TESTS PASSED: ${passedTests}/${totalTests} (100% Success)`);
    console.log('===========================================================');
  } finally {
    await multiChainEngine.stopAll();
  }
}

runTests().catch(err => {
  console.error('\nTest Suite Failed!\n', err);
  process.exit(1);
});
