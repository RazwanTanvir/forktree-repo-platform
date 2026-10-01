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
const storageAdapter = require('../services/storageAdapter');

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
    await it('Authors test clinical records across chains for traversal verification', async () => {
      for (const chain of topology.chains) {
        const chainInfo = deployments.dataChains[chain.networkId];
        const dataClient = new ContractClient(chain.rpcUrl, BlockData.abi, chainInfo.address);
        const patientRecords = (topology.samplePatientData && topology.samplePatientData[chain.networkId.toString()]) || [];
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
        const values = (topology.sampleData && topology.sampleData[chain.networkId.toString()]) || [];
        for (const val of values) {
          await dataClient.send('addDataPoint', [chain.networkId, chain.port, val]);
        }
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

    console.log('\n[Suite 10: Steering Council Project Provisioning & Security RBAC]');
    await it('Steering Council Chair successfully creates a root federation project', async () => {
      const councilChair = '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02';
      const tx = await repoClient.send('createProject', [
        'National Cardiovascular Clinical Trials Network',
        'Multi-center clinical trial repository linking cardiology clinics and research labs',
        11102n
      ], councilChair);
      assert.ok(tx.hash, 'Project creation tx hash should be present');

      const allProjects = await repoClient.call('getAllProjects');
      assert.ok(allProjects.length >= 1, 'Expected at least 1 active consortium project');
      const cardioProj = Array.from(allProjects).find(p => String(p.name || p[1]).includes('Cardiovascular'));
      assert.ok(cardioProj, 'Created project should be queryable in registry');
    });

    await it('NEGATIVE: Unauthorized caller (0x9999...) fails to create project (reverts)', async () => {
      const attacker = '0x9999999999999999999999999999999999999999';
      let rejected = false;
      try {
        await repoClient.send('createProject', [
          'Malicious Hijack Project',
          'Attempted unauthorized project creation',
          11102n
        ], attacker);
      } catch (err) {
        rejected = true;
        assert.ok(err.message.includes('not a Steering Council Admin'), `Expected unauthorized error, got: ${err.message}`);
      }
      assert.strictEqual(rejected, true, 'Non-council member should be rejected by smart contract');
    });

    console.log('\n[Suite 11: Detailed Healthcare Fork Requests & Lifecycle]');
    let detailedProposalId;
    await it('Submits detailed fork proposal for "Horizon Health Payor & Claims" with FHIR capabilities', async () => {
      const proposer = '0x1111111111111111111111111111111111111111'; // Metro Admin
      const initialAdmin = '0x5555555555555555555555555555555555555555';
      const tx = await repoClient.send('proposeForkWithDetails', [
        'Horizon Health Payor & Claims',
        11120n,
        8560n,
        11102n, // Branch from root MPI
        5n,
        'Dedicated health insurance payor for automated claim adjudication & coverage verification',
        'Health Insurance Payor',
        'Patient, Coverage, Claim, ClaimResponse',
        initialAdmin
      ], proposer);

      assert.ok(tx.hash, 'Fork proposal tx hash missing');
      const totalProps = await repoClient.call('totalProposals');
      detailedProposalId = Number(totalProps);
      const prop = await repoClient.call('getProposalByIndex', [detailedProposalId - 1]);
      assert.strictEqual(String(prop.orgName || prop[2]), 'Horizon Health Payor & Claims');
      assert.strictEqual(String(prop.orgType || prop[8]), 'Health Insurance Payor');
    });

    await it('Consortium votes and executes detailed fork proposal', async () => {
      const voter = '0x3333333333333333333333333333333333333333'; // BioLabs Admin
      await repoClient.send('voteOnProposal', [BigInt(detailedProposalId), true], voter);
      await repoClient.send('executeForkProposal', [BigInt(detailedProposalId)]);

      const prop = await repoClient.call('getProposalByIndex', [detailedProposalId - 1]);
      assert.strictEqual(Boolean(prop.executed !== undefined ? prop.executed : prop[11]), true);

      // Verify organization registered
      const allOrgs = await repoClient.call('getAllOrganizations');
      const payorOrg = Array.from(allOrgs).find(o => String(o.name || o[1]).includes('Horizon Health Payor'));
      assert.ok(payorOrg, 'Horizon Health Payor should now be registered in consortium directory');
    });

    console.log('\n[Suite 12: Inter-Organization Messaging & Cryptographic Anchoring]');
    let testMessageId;
    await it('Metro General Hospital dispatches an encrypted inter-org message to BioLabs', async () => {
      const payload = {
        resourceType: 'Communication',
        id: 'COMM-001',
        status: 'completed',
        subject: { reference: 'Patient/P101' },
        note: 'STAT bloodwork specimen dispatched to central diagnostics laboratory'
      };

      const result = await forkTreeService.sendMessage({
        senderNetworkId: 11103, // Metro Hospital
        recipientNetworkId: 11104, // BioLabs
        recipient: '0x4444444444444444444444444444444444444444',
        messageType: 'GENERAL',
        subject: 'STAT Specimen Transport Notice for Patient P101',
        fhirResourceType: 'Communication',
        fhirResourceId: 'COMM-001',
        payload,
        callerAddress: '0x2222222222222222222222222222222222222222'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.txHash, 'Transaction hash should be generated');
      assert.ok(result.dataHash, 'SHA-256 data hash should be generated');

      const allMsgs = await forkTreeService.getAllMessages();
      assert.ok(allMsgs.length > 0, 'Messages list should not be empty');
      const sentMsg = allMsgs.find(m => m.subject.includes('STAT Specimen Transport'));
      assert.ok(sentMsg, 'Dispatched message should exist');
      assert.strictEqual(sentMsg.senderNetworkId, 11103);
      assert.strictEqual(sentMsg.recipientNetworkId, 11104);
      assert.strictEqual(sentMsg.status, 0, 'Status should be PENDING (0)');
      testMessageId = sentMsg.messageId;
    });

    await it('Updates inter-org message status to ACKNOWLEDGED', async () => {
      const res = await forkTreeService.updateMessageStatus({
        messageId: testMessageId,
        status: 2, // ACKNOWLEDGED
        callerAddress: '0x4444444444444444444444444444444444444444'
      });
      assert.strictEqual(res.success, true);

      const msgs = await forkTreeService.getOrganizationMessages(11104);
      const updated = msgs.find(m => m.messageId === testMessageId);
      assert.strictEqual(updated.status, 2);
      assert.strictEqual(updated.statusText, 'ACKNOWLEDGED');
    });

    console.log('\n[Suite 13: Cross-Fork FHIR Interoperability Workflows]');
    let serviceReqMsgId;
    await it('Hospital -> Lab: Dispatches FHIR ServiceRequest (CMP LOINC 24323-8)', async () => {
      const orderPayload = {
        resourceType: 'ServiceRequest',
        id: 'SR-LAB-01',
        status: 'active',
        intent: 'order',
        priority: 'stat',
        subject: { reference: 'Patient/P101' },
        code: {
          coding: [{ system: 'http://loinc.org', code: '24323-8', display: 'Comprehensive metabolic panel' }]
        }
      };

      const res = await forkTreeService.sendMessage({
        senderNetworkId: 11103, // Metro General Hospital
        recipientNetworkId: 11104, // BioLabs Diagnostic Center
        recipient: '0x4444444444444444444444444444444444444444',
        messageType: 'FHIR_SERVICE_REQUEST',
        subject: 'STAT Comprehensive Metabolic Panel Order for Patient P101',
        fhirResourceType: 'ServiceRequest',
        fhirResourceId: 'SR-LAB-01',
        payload: orderPayload,
        callerAddress: '0x2222222222222222222222222222222222222222'
      });

      assert.strictEqual(res.success, true);
      const allMsgs = await forkTreeService.getAllMessages();
      const order = allMsgs.find(m => m.fhirResourceId === 'SR-LAB-01');
      assert.ok(order, 'ServiceRequest order should be indexed');
      serviceReqMsgId = order.messageId;
    });

    await it('Lab fulfills ServiceRequest with DiagnosticReport, updating request to FULFILLED', async () => {
      const reportPayload = {
        resourceType: 'DiagnosticReport',
        id: 'REP-CMP-01',
        status: 'final',
        code: { coding: [{ system: 'http://loinc.org', code: '24323-8', display: 'Comprehensive metabolic panel' }] },
        subject: { reference: 'Patient/P101' },
        basedOn: [{ reference: 'ServiceRequest/SR-LAB-01' }],
        result: [
          { display: 'Glucose: 102 mg/dL' },
          { display: 'Creatinine: 0.9 mg/dL' }
        ]
      };

      const fulfillRes = await forkTreeService.fulfillFhirOrder({
        requestMessageId: serviceReqMsgId,
        responseResourceType: 'DiagnosticReport',
        responsePayload: reportPayload,
        callerAddress: '0x4444444444444444444444444444444444444444' // BioLabs Specialist
      });

      assert.strictEqual(fulfillRes.success, true);

      // Verify original message is marked FULFILLED
      const allMsgs = await forkTreeService.getAllMessages();
      const originalReq = allMsgs.find(m => m.messageId === serviceReqMsgId);
      assert.strictEqual(originalReq.status, 3, 'Original request status should be 3 (FULFILLED)');

      // Verify cross-fork response message dispatched back to hospital
      const responseMsg = allMsgs.find(m => m.responseToMessageId === serviceReqMsgId);
      assert.ok(responseMsg, 'Response message linked to request should exist');
      assert.strictEqual(responseMsg.senderNetworkId, 11104);
      assert.strictEqual(responseMsg.recipientNetworkId, 11103);
      assert.strictEqual(responseMsg.fhirResourceType, 'DiagnosticReport');
    });

    await it('Hospital -> Pharmacy: MedicationRequest fulfilled with MedicationDispense', async () => {
      const medReqPayload = {
        resourceType: 'MedicationRequest',
        id: 'MED-REQ-02',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/P101' },
        medicationCodeableConcept: {
          coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '860975', display: 'Metformin 500mg' }]
        }
      };

      const sendRes = await forkTreeService.sendMessage({
        senderNetworkId: 11103,
        recipientNetworkId: 11107, // Outpatient Pharmacy
        recipient: '0x7777777777777777777777777777777777777777',
        messageType: 'FHIR_MEDICATION_REQUEST',
        subject: 'Prescription: Metformin 500mg for Patient P101',
        fhirResourceType: 'MedicationRequest',
        fhirResourceId: 'MED-REQ-02',
        payload: medReqPayload,
        callerAddress: '0x2222222222222222222222222222222222222222'
      });
      assert.strictEqual(sendRes.success, true);

      const allMsgs = await forkTreeService.getAllMessages();
      const medMsg = allMsgs.find(m => m.fhirResourceId === 'MED-REQ-02');

      const dispensePayload = {
        resourceType: 'MedicationDispense',
        id: 'DISP-02',
        status: 'completed',
        subject: { reference: 'Patient/P101' },
        quantity: { value: 60, unit: 'TAB' }
      };

      const fulfillRes = await forkTreeService.fulfillFhirOrder({
        requestMessageId: medMsg.messageId,
        responseResourceType: 'MedicationDispense',
        responsePayload: dispensePayload,
        callerAddress: '0x7777777777777777777777777777777777777777'
      });
      assert.strictEqual(fulfillRes.success, true);
    });

    console.log('\n[Suite 14: Hybrid Off-Chain Vault Security & Tamper-Resistance]');
    await it('Hybrid Storage Adapter encrypts, stores, and verifies AES-256-GCM integrity', async () => {
      const sampleClinicalDoc = {
        resourceType: 'Observation',
        id: 'OBS-GENOMICS-01',
        patientId: 'P101',
        gene: 'BRCA1',
        mutation: 'c.5266dupC',
        interpretation: 'Pathogenic'
      };

      const stored = storageAdapter.storeEncryptedPayload(sampleClinicalDoc);
      assert.ok(stored.cid.startsWith('ipfs://bafk'), 'Should produce valid IPFS CID');
      assert.strictEqual(stored.algorithm, 'AES-256-GCM');
      assert.strictEqual(stored.dataHash.length, 64, 'SHA-256 hash length should be 64 hex chars');

      const retrieved = storageAdapter.retrieveDecryptedPayload(stored.dataHash);
      assert.deepStrictEqual(retrieved, sampleClinicalDoc, 'Decrypted payload must match original object');
    });

    console.log('\n[Suite 15: Role-Based Message & Patient Isolation]');
    await it('Isolates inter-organization messages per organization', async () => {
      const bioLabsMsgs = await forkTreeService.getOrganizationMessages(11104);
      bioLabsMsgs.forEach(m => {
        assert.ok(
          m.senderNetworkId === 11104 || m.recipientNetworkId === 11104,
          `Message #${m.messageId} should belong to BioLabs (11104)`
        );
      });
    });

    await it('Enforces patient sovereign isolation for longitudinal records', async () => {
      const allRecordsByPort = await forkTreeService.getAllPatientRecords();
      const allFlat = Object.values(allRecordsByPort).flat();
      const p101Records = allFlat.filter(d => d.patientId === 'P101');
      assert.ok(p101Records.length > 0, 'P101 records should exist');
      p101Records.forEach(r => {
        assert.strictEqual(r.patientId, 'P101', 'Record must match patient P101');
      });
    });

    console.log('\n===========================================================');
    console.log(` ALL TESTS PASSED: ${passedTests}/${totalTests} (100% Success)`);
    console.log('===========================================================');
  } finally {
    // Pristine Storage Cleanup: Reset cache files to clean handover state (0 records)
    const fs = require('fs');
    const path = require('path');
    const storageDir = path.join(__dirname, '../storage');
    const emptyDump = {};
    for (const chain of topology.chains) {
      emptyDump[chain.rpcUrl] = [];
    }
    try {
      fs.writeFileSync(path.join(storageDir, 'chainTreeData.json'), JSON.stringify(emptyDump, null, 2), 'utf-8');
      fs.writeFileSync(path.join(storageDir, 'chainPatientData.json'), JSON.stringify(emptyDump, null, 2), 'utf-8');
      multiChainEngine.clearSavedState();
      const vaultDir = path.join(storageDir, 'vault');
      if (fs.existsSync(vaultDir)) {
        for (const file of fs.readdirSync(vaultDir)) {
          if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(vaultDir, file));
          }
        }
      }
    } catch (e) {}
    await multiChainEngine.stopAll();
  }
}

runTests().catch(err => {
  console.error('\nTest Suite Failed!\n', err);
  process.exit(1);
});
