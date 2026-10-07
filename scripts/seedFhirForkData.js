// Production FHIR Multi-Fork Data Seeder for BlockchainForkTree
// Seeds authentic HL7 FHIR R4 compliant clinical records across autonomous organization forks
// Maintains strict data lineage, cross-fork causal links (subject, basedOn, encounter, authorizingPrescription),
// and on-chain SHA-256 hash anchoring with hybrid off-chain encrypted vault storage.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ContractClient } = require('../services/contractClient');
const { StoreForkEvent, BlockData } = require('../contracts/compiledArtifacts');
const storageAdapter = require('../services/storageAdapter');
const topology = require('../config/networkTopology.json');

const PATIENTS = [
  {
    patientId: 'Patient/P-101',
    cleanId: 'P101',
    name: 'Sarah Connor',
    gender: 'female',
    birthDate: '1984-05-12',
    mrn: 'MRN-101-SC',
    phone: '+1-555-0199',
    address: { city: 'Boston', state: 'MA', postalCode: '02115' },
    records: [
      // 1. Root Chain: Master Patient Index (Port 8546)
      {
        port: 8546,
        networkId: 11102,
        resourceType: 'Patient',
        clinicalCode: 'DEMOGRAPHICS',
        data: {
          resourceType: 'Patient',
          id: 'P-101',
          identifier: [{ system: 'urn:oid:consortium-mpi', value: 'MRN-101-SC' }],
          active: true,
          name: [{ use: 'official', family: 'Connor', given: ['Sarah'] }],
          gender: 'female',
          birthDate: '1984-05-12',
          telecom: [{ system: 'phone', value: '+1-555-0199', use: 'mobile' }],
          address: [{ line: ['42 Commonwealth Ave'], city: 'Boston', state: 'MA', postalCode: '02115' }]
        }
      },
      // 2. Emergency Care Center: Acute Vitals (Port 8550)
      {
        port: 8550,
        networkId: 11106,
        resourceType: 'Encounter',
        clinicalCode: 'SNOMED:50849002',
        data: {
          resourceType: 'Encounter',
          id: 'enc-100',
          status: 'finished',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'EMER', display: 'emergency' },
          subject: { reference: 'Patient/P-101', display: 'Sarah Connor' },
          reasonCode: [{ coding: [{ system: 'http://snomed.info/sct', code: '50849002', display: 'Emergency triage' }] }],
          period: { start: '2026-09-15T08:15:00Z', end: '2026-09-15T10:30:00Z' }
        }
      },
      {
        port: 8550,
        networkId: 11106,
        resourceType: 'Observation',
        clinicalCode: 'LOINC:85354-9',
        data: {
          resourceType: 'Observation',
          id: 'obs-100',
          status: 'final',
          category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
          code: { coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel with all children optional' }] },
          subject: { reference: 'Patient/P-101' },
          encounter: { reference: 'Encounter/enc-100' },
          effectiveDateTime: '2026-09-15T08:30:00Z',
          component: [
            { code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }] }, valueQuantity: { value: 148, unit: 'mmHg', system: 'http://unitsofmeasure.org' } },
            { code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' }] }, valueQuantity: { value: 92, unit: 'mmHg', system: 'http://unitsofmeasure.org' } }
          ]
        }
      },
      // 3. Metro General Hospital: Admission, Diagnosis, Lab Order (Port 8547)
      {
        port: 8547,
        networkId: 11103,
        resourceType: 'Encounter',
        clinicalCode: 'SNOMED:32485007',
        data: {
          resourceType: 'Encounter',
          id: 'enc-101',
          status: 'finished',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'IMP', display: 'inpatient encounter' },
          subject: { reference: 'Patient/P-101', display: 'Sarah Connor' },
          reasonCode: [{ coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'I10', display: 'Essential (primary) hypertension' }] }],
          period: { start: '2026-09-15T11:00:00Z', end: '2026-09-17T14:00:00Z' }
        }
      },
      {
        port: 8547,
        networkId: 11103,
        resourceType: 'Condition',
        clinicalCode: 'ICD-10:I10',
        data: {
          resourceType: 'Condition',
          id: 'cond-101',
          clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
          verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
          category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }] }],
          code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'I10', display: 'Essential (primary) hypertension' }] },
          subject: { reference: 'Patient/P-101' },
          encounter: { reference: 'Encounter/enc-101' },
          recordedDate: '2026-09-15T11:30:00Z'
        }
      },
      {
        port: 8547,
        networkId: 11103,
        resourceType: 'ServiceRequest',
        clinicalCode: 'LOINC:24323-8',
        data: {
          resourceType: 'ServiceRequest',
          id: 'req-101',
          status: 'active',
          intent: 'order',
          priority: 'stat',
          code: { coding: [{ system: 'http://loinc.org', code: '24323-8', display: 'Comprehensive metabolic 2000 panel' }] },
          subject: { reference: 'Patient/P-101' },
          encounter: { reference: 'Encounter/enc-101' },
          authoredOn: '2026-09-15T12:00:00Z',
          requester: { display: 'Dr. Gregory House, MD' }
        }
      },
      // 4. BioLabs Diagnostic Center: Specimen Testing & Diagnostic Report (Port 8548)
      {
        port: 8548,
        networkId: 11104,
        resourceType: 'Observation',
        clinicalCode: 'LOINC:2345-7',
        data: {
          resourceType: 'Observation',
          id: 'obs-101',
          status: 'final',
          basedOn: [{ reference: 'ServiceRequest/req-101' }],
          code: { coding: [{ system: 'http://loinc.org', code: '2345-7', display: 'Glucose [Mass/volume] in Serum or Plasma' }] },
          subject: { reference: 'Patient/P-101' },
          effectiveDateTime: '2026-09-15T13:45:00Z',
          valueQuantity: { value: 104, unit: 'mg/dL', system: 'http://unitsofmeasure.org' },
          referenceRange: [{ low: { value: 70, unit: 'mg/dL' }, high: { value: 99, unit: 'mg/dL' } }]
        }
      },
      {
        port: 8548,
        networkId: 11104,
        resourceType: 'Observation',
        clinicalCode: 'LOINC:10839-9',
        data: {
          resourceType: 'Observation',
          id: 'obs-102',
          status: 'final',
          basedOn: [{ reference: 'ServiceRequest/req-101' }],
          code: { coding: [{ system: 'http://loinc.org', code: '10839-9', display: 'Troponin I.cardiac [Mass/volume] in Serum or Plasma' }] },
          subject: { reference: 'Patient/P-101' },
          effectiveDateTime: '2026-09-15T13:45:00Z',
          valueQuantity: { value: 0.02, unit: 'ng/mL', system: 'http://unitsofmeasure.org' },
          referenceRange: [{ high: { value: 0.04, unit: 'ng/mL' } }]
        }
      },
      {
        port: 8548,
        networkId: 11104,
        resourceType: 'DiagnosticReport',
        clinicalCode: 'LOINC:24323-8',
        data: {
          resourceType: 'DiagnosticReport',
          id: 'rep-101',
          status: 'final',
          category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'CH', display: 'Chemistry' }] }],
          code: { coding: [{ system: 'http://loinc.org', code: '24323-8', display: 'Comprehensive metabolic panel' }] },
          subject: { reference: 'Patient/P-101' },
          basedOn: [{ reference: 'ServiceRequest/req-101' }],
          effectiveDateTime: '2026-09-15T14:30:00Z',
          result: [{ reference: 'Observation/obs-101' }, { reference: 'Observation/obs-102' }],
          conclusion: 'Cardiac biomarkers within normal limits. Mild borderline fasting hyperglycemia.'
        }
      },
      // 5. Cardio Specialty Clinic: Echo & Lisinopril Prescription (Port 8549)
      {
        port: 8549,
        networkId: 11105,
        resourceType: 'Observation',
        clinicalCode: 'LOINC:88062-5',
        data: {
          resourceType: 'Observation',
          id: 'obs-103',
          status: 'final',
          code: { coding: [{ system: 'http://loinc.org', code: '88062-5', display: 'Left ventricular Ejection fraction by 2D echo' }] },
          subject: { reference: 'Patient/P-101' },
          effectiveDateTime: '2026-09-16T10:00:00Z',
          valueQuantity: { value: 58, unit: '%', system: 'http://unitsofmeasure.org' }
        }
      },
      {
        port: 8549,
        networkId: 11105,
        resourceType: 'MedicationRequest',
        clinicalCode: 'RxNorm:314076',
        data: {
          resourceType: 'MedicationRequest',
          id: 'med-101',
          status: 'active',
          intent: 'order',
          medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '314076', display: 'Lisinopril 10 MG Oral Tablet' }] },
          subject: { reference: 'Patient/P-101' },
          authoredOn: '2026-09-16T11:00:00Z',
          dosageInstruction: [{ text: 'Take 1 tablet by mouth daily in the morning' }]
        }
      },
      // 6. Consortium Pharmacy Network: Medication Dispense (Port 8551)
      {
        port: 8551,
        networkId: 11107,
        resourceType: 'MedicationDispense',
        clinicalCode: 'RxNorm:314076',
        data: {
          resourceType: 'MedicationDispense',
          id: 'disp-101',
          status: 'completed',
          medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '314076', display: 'Lisinopril 10 MG Oral Tablet' }] },
          subject: { reference: 'Patient/P-101' },
          authorizingPrescription: [{ reference: 'MedicationRequest/med-101' }],
          quantity: { value: 30, unit: 'TAB' },
          daysSupply: { value: 30, unit: 'days' },
          whenHandedOver: '2026-09-17T16:30:00Z'
        }
      }
    ]
  },
  {
    patientId: 'Patient/P-102',
    cleanId: 'P102',
    name: 'Robert Chen',
    gender: 'male',
    birthDate: '1968-11-23',
    mrn: 'MRN-102-RC',
    phone: '+1-555-0244',
    address: { city: 'Cambridge', state: 'MA', postalCode: '02138' },
    records: [
      // 1. Root Chain: Master Patient Index (Port 8546)
      {
        port: 8546,
        networkId: 11102,
        resourceType: 'Patient',
        clinicalCode: 'DEMOGRAPHICS',
        data: {
          resourceType: 'Patient',
          id: 'P-102',
          identifier: [{ system: 'urn:oid:consortium-mpi', value: 'MRN-102-RC' }],
          active: true,
          name: [{ use: 'official', family: 'Chen', given: ['Robert'] }],
          gender: 'male',
          birthDate: '1968-11-23',
          telecom: [{ system: 'phone', value: '+1-555-0244', use: 'mobile' }],
          address: [{ line: ['15 Oxford St'], city: 'Cambridge', state: 'MA', postalCode: '02138' }]
        }
      },
      // 2. Metro General Hospital: Diabetes Diagnosis & Lab Order (Port 8547)
      {
        port: 8547,
        networkId: 11103,
        resourceType: 'Condition',
        clinicalCode: 'ICD-10:E11.9',
        data: {
          resourceType: 'Condition',
          id: 'cond-201',
          clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
          code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'E11.9', display: 'Type 2 diabetes mellitus without complications' }] },
          subject: { reference: 'Patient/P-102' },
          recordedDate: '2026-09-18T09:00:00Z'
        }
      },
      {
        port: 8547,
        networkId: 11103,
        resourceType: 'ServiceRequest',
        clinicalCode: 'LOINC:4548-4',
        data: {
          resourceType: 'ServiceRequest',
          id: 'req-201',
          status: 'active',
          intent: 'order',
          code: { coding: [{ system: 'http://loinc.org', code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total in Blood' }] },
          subject: { reference: 'Patient/P-102' },
          authoredOn: '2026-09-18T09:30:00Z'
        }
      },
      // 3. BioLabs Diagnostics: HbA1c Lab Result (Port 8548)
      {
        port: 8548,
        networkId: 11104,
        resourceType: 'Observation',
        clinicalCode: 'LOINC:4548-4',
        data: {
          resourceType: 'Observation',
          id: 'obs-201',
          status: 'final',
          basedOn: [{ reference: 'ServiceRequest/req-201' }],
          code: { coding: [{ system: 'http://loinc.org', code: '4548-4', display: 'Hemoglobin A1c in Blood' }] },
          subject: { reference: 'Patient/P-102' },
          effectiveDateTime: '2026-09-18T11:00:00Z',
          valueQuantity: { value: 7.6, unit: '%', system: 'http://unitsofmeasure.org' },
          referenceRange: [{ high: { value: 5.7, unit: '%' } }]
        }
      },
      {
        port: 8548,
        networkId: 11104,
        resourceType: 'DiagnosticReport',
        clinicalCode: 'LOINC:4548-4',
        data: {
          resourceType: 'DiagnosticReport',
          id: 'rep-201',
          status: 'final',
          code: { coding: [{ system: 'http://loinc.org', code: '4548-4', display: 'HbA1c Glycated Hemoglobin Report' }] },
          subject: { reference: 'Patient/P-102' },
          basedOn: [{ reference: 'ServiceRequest/req-201' }],
          effectiveDateTime: '2026-09-18T11:30:00Z',
          result: [{ reference: 'Observation/obs-201' }],
          conclusion: 'Elevated HbA1c indicative of suboptimally controlled Type 2 Diabetes Mellitus.'
        }
      },
      // 4. Metro General: Prescription for Metformin (Port 8547)
      {
        port: 8547,
        networkId: 11103,
        resourceType: 'MedicationRequest',
        clinicalCode: 'RxNorm:860975',
        data: {
          resourceType: 'MedicationRequest',
          id: 'med-201',
          status: 'active',
          intent: 'order',
          medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '860975', display: 'Metformin hydrochloride 500 MG Oral Tablet' }] },
          subject: { reference: 'Patient/P-102' },
          authoredOn: '2026-09-18T14:00:00Z',
          dosageInstruction: [{ text: '500 mg orally twice daily with meals' }]
        }
      },
      // 5. Pharmacy Network: Metformin Dispense (Port 8551)
      {
        port: 8551,
        networkId: 11107,
        resourceType: 'MedicationDispense',
        clinicalCode: 'RxNorm:860975',
        data: {
          resourceType: 'MedicationDispense',
          id: 'disp-201',
          status: 'completed',
          medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '860975', display: 'Metformin hydrochloride 500 MG Oral Tablet' }] },
          subject: { reference: 'Patient/P-102' },
          authorizingPrescription: [{ reference: 'MedicationRequest/med-201' }],
          quantity: { value: 60, unit: 'TAB' },
          daysSupply: { value: 30, unit: 'days' },
          whenHandedOver: '2026-09-19T11:00:00Z'
        }
      }
    ]
  },
  {
    patientId: 'Patient/P-103',
    cleanId: 'P103',
    name: 'Maria Garcia',
    gender: 'female',
    birthDate: '1992-03-15',
    mrn: 'MRN-103-MG',
    phone: '+1-555-0377',
    address: { city: 'Somerville', state: 'MA', postalCode: '02143' },
    records: [
      // 1. Root Chain: Master Patient Index (Port 8546)
      {
        port: 8546,
        networkId: 11102,
        resourceType: 'Patient',
        clinicalCode: 'DEMOGRAPHICS',
        data: {
          resourceType: 'Patient',
          id: 'P-103',
          identifier: [{ system: 'urn:oid:consortium-mpi', value: 'MRN-103-MG' }],
          active: true,
          name: [{ use: 'official', family: 'Garcia', given: ['Maria'] }],
          gender: 'female',
          birthDate: '1992-03-15',
          telecom: [{ system: 'phone', value: '+1-555-0377', use: 'mobile' }],
          address: [{ line: ['88 Elm St'], city: 'Somerville', state: 'MA', postalCode: '02143' }]
        }
      },
      // 2. Emergency Care: Acute Asthma Exacerbation (Port 8550)
      {
        port: 8550,
        networkId: 11106,
        resourceType: 'Encounter',
        clinicalCode: 'SNOMED:26636000',
        data: {
          resourceType: 'Encounter',
          id: 'enc-301',
          status: 'finished',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'EMER', display: 'emergency' },
          subject: { reference: 'Patient/P-103', display: 'Maria Garcia' },
          reasonCode: [{ coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'J45.21', display: 'Mild intermittent asthma with acute exacerbation' }] }],
          period: { start: '2026-09-20T03:00:00Z', end: '2026-09-20T06:30:00Z' }
        }
      },
      {
        port: 8550,
        networkId: 11106,
        resourceType: 'Observation',
        clinicalCode: 'LOINC:2708-6',
        data: {
          resourceType: 'Observation',
          id: 'obs-301',
          status: 'final',
          code: { coding: [{ system: 'http://loinc.org', code: '2708-6', display: 'Oxygen saturation in Arterial blood by Pulse oximetry' }] },
          subject: { reference: 'Patient/P-103' },
          encounter: { reference: 'Encounter/enc-301' },
          effectiveDateTime: '2026-09-20T03:15:00Z',
          valueQuantity: { value: 91, unit: '%', system: 'http://unitsofmeasure.org' }
        }
      },
      {
        port: 8550,
        networkId: 11106,
        resourceType: 'Condition',
        clinicalCode: 'ICD-10:J45.21',
        data: {
          resourceType: 'Condition',
          id: 'cond-301',
          clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
          code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'J45.21', display: 'Mild intermittent asthma with acute exacerbation' }] },
          subject: { reference: 'Patient/P-103' },
          encounter: { reference: 'Encounter/enc-301' }
        }
      },
      // 3. Metro Hospital: Albuterol Prescription (Port 8547)
      {
        port: 8547,
        networkId: 11103,
        resourceType: 'MedicationRequest',
        clinicalCode: 'RxNorm:745679',
        data: {
          resourceType: 'MedicationRequest',
          id: 'med-301',
          status: 'active',
          intent: 'order',
          medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '745679', display: 'Albuterol 0.09 MG/ACTUAT Inhaler' }] },
          subject: { reference: 'Patient/P-103' },
          authoredOn: '2026-09-20T07:00:00Z',
          dosageInstruction: [{ text: 'Inhale 2 puffs every 4 to 6 hours as needed for wheezing' }]
        }
      },
      // 4. Pharmacy Network: Inhaler Dispense (Port 8551)
      {
        port: 8551,
        networkId: 11107,
        resourceType: 'MedicationDispense',
        clinicalCode: 'RxNorm:745679',
        data: {
          resourceType: 'MedicationDispense',
          id: 'disp-301',
          status: 'completed',
          medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '745679', display: 'Albuterol 0.09 MG/ACTUAT Inhaler' }] },
          subject: { reference: 'Patient/P-103' },
          authorizingPrescription: [{ reference: 'MedicationRequest/med-301' }],
          quantity: { value: 1, unit: 'inhaler' },
          whenHandedOver: '2026-09-20T09:30:00Z'
        }
      }
    ]
  }
];

async function seedFhirForkData() {
  console.log('=== Seeding Multi-Chain Network with Authentic HL7 FHIR Patient Lineage ===\n');

  const deployPath = path.join(__dirname, '../config/deployments.json');
  if (!fs.existsSync(deployPath)) {
    throw new Error('deployments.json not found! Run deployContracts.js first.');
  }
  const deployments = JSON.parse(fs.readFileSync(deployPath, 'utf-8'));

  const { multiChainEngine } = require('../engine/chainEngine');
  if (!multiChainEngine.getNode(8545)) {
    console.log('Starting Multi-Chain Engine nodes (Ports 8545-8551)...');
    await multiChainEngine.startAll();
    console.log('✓ Multi-Chain Engine online.\n');
  }

  // 1. Ensure Repository Chain Lineage is registered
  console.log('1. Verifying Consortium Fork Topology in Repository Chain (Port 8545)...');
  const repoClient = new ContractClient(
    topology.repositoryChain.rpcUrl,
    StoreForkEvent.abi,
    deployments.repository.address
  );

  for (const chain of topology.chains) {
    await repoClient.send('addForkDetail', [
      chain.networkId,
      chain.port,
      chain.parentNetworkId,
      chain.forkBlockNumber
    ]);
  }
  console.log('   ✓ Repository fork lineage initialized.\n');

  // 2. Ingest Patient Records into respective chain smart contracts and off-chain vault
  console.log('2. Committing FHIR Resources with Cryptographic SHA-256 Anchors & AES-256-GCM Vaults...');

  const allChainPatientDataDump = {};
  for (const chain of topology.chains) {
    allChainPatientDataDump[chain.rpcUrl] = [];
  }

  let totalSeeded = 0;

  for (const pat of PATIENTS) {
    console.log(`\n  -> Processing Patient: ${pat.patientId} (${pat.name})`);

    for (const rec of pat.records) {
      const chain = topology.chains.find(c => c.port === rec.port);
      if (!chain) continue;

      const chainDep = deployments.dataChains && deployments.dataChains[chain.networkId];
      if (!chainDep) continue;

      const client = new ContractClient(chain.rpcUrl, BlockData.abi, chainDep.address);

      // A. Encrypt and store off-chain in vault
      const rawJson = JSON.stringify(rec.data, null, 2);
      const vaultResult = storageAdapter.storeEncryptedPayload(rec.data);
      const dataHash = vaultResult.dataHash;
      const tsSec = rec.data.effectiveDateTime || rec.data.authoredOn || rec.data.recordedDate
        ? Math.floor(new Date(rec.data.effectiveDateTime || rec.data.authoredOn || rec.data.recordedDate).getTime() / 1000)
        : Math.floor(Date.now() / 1000);

      // B. Send transaction to BlockData smart contract
      const tx = await client.send('addPatientRecord', [
        chain.networkId,
        chain.port,
        pat.patientId,
        rec.resourceType,
        rec.clinicalCode,
        rawJson,
        dataHash,
        tsSec
      ]);

      const receipt = await tx.wait();
      const bNumHex = receipt ? receipt.blockNumber : '0x1';
      const bNum = parseInt(bNumHex, 16);

      console.log(`     [Port ${rec.port} | ${chain.name}] Block #${bNum}: ${rec.resourceType} (${rec.data.id}) -> Hash: ${dataHash.slice(0, 16)}...`);

      allChainPatientDataDump[chain.rpcUrl].push({
        blockNumber: bNum,
        networkId: chain.networkId,
        portNumber: chain.port,
        patientId: pat.patientId,
        resourceType: rec.resourceType,
        clinicalCode: rec.clinicalCode,
        resourceData: rec.data,
        rawResourceData: rawJson,
        dataHash: dataHash,
        timestamp: tsSec,
        timestampIso: new Date(tsSec * 1000).toISOString(),
        txHash: tx.hash
      });

      totalSeeded++;
    }
  }

  // 3. Sync cache files in storage/
  const storageDir = path.join(__dirname, '../storage');
  if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

  fs.writeFileSync(path.join(storageDir, 'chainPatientData.json'), JSON.stringify(allChainPatientDataDump, null, 2), 'utf-8');

  console.log(`\n✓ SUCCESS: Successfully seeded ${totalSeeded} FHIR resources across ${PATIENTS.length} patients and 6 healthcare forks!`);
  console.log(`✓ Off-Chain Vault populated with AES-256-GCM encrypted records in ${path.join(storageDir, 'vault')}`);
}

if (require.main === module) {
  seedFhirForkData().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}

module.exports = { seedFhirForkData, PATIENTS };
