# BlockchainForkTree Platform

A modern, clean, cross-platform implementation of the **BlockchainForkTree** research project. Compatible with macOS (Apple Silicon arm64 / Intel) and Linux across modern Node.js runtimes (Node 18, 20, 22, and 26+).

---

## Key Features

1. **Multi-Chain Architecture (7 Independent Blockchains)**:
   - **Repository Chain (Port 8545 / Network ID 11101)**: Stores the global fork registry, parent-child edges, and graph adjacency list via `StoreForkEvent.sol`.
   - **Data-Bearing Chains (Ports 8546–8551 / Network IDs 11102–11107)**: Independent EVM networks storing structured data points `(blockNumber, networkId, portNumber, data)` via `BlockData.sol`.
2. **Built-in Zero-Dependency Multi-Chain JSON-RPC Engine**:
   - Eliminates legacy Geth PoW/Ethash incompatibilities, fatal `terminalTotalDifficulty` crashes, and brittle native C++ bindings (`bufferutil`, `utf-8-validate`).
   - Spins up 7 full JSON-RPC 2.0 endpoints in milliseconds with disk state persistence.
   - Also includes a native Geth launcher (`scripts/run_geth_nodes.sh`) for users wishing to run Geth `--dev` mode.
3. **Multi-Algorithm Tree Traversal Engine (DFS & BFS)**:
   - **Breadth-First Search (BFS)**: Explores nodes level-by-level (Root Level 0 &rarr; Level 1 Forks &rarr; Level 2 Sub-forks). Finds shallow matches faster (e.g. finds value `43` on Beta at Step 3).
   - **Depth-First Search (DFS)**: Dives deep along lineage branches before backtracking (e.g. dives into Alpha &rarr; Gamma &rarr; Delta before backtracking to Beta at Step 5).
   - Both algorithms query on-chain contracts directly via JSON-RPC.
4. **Dynamic Forked Blockchain Creation**:
   - Web UI wizard allowing users to fork new blockchains from the Root or any active branch.
   - Dynamic port allocation (`8552`, `8553`, ...) and Network ID assignment (`11108`, `11109`, ...).
   - Instant contract provisioning (`BlockData`), repository registration (`StoreForkEvent`), and live SVG graph updates.
5. **Interactive Web Dashboard**:
   - **Fork Tree Topology**: Dynamic hierarchical SVG graph showing all forks, branches, and fork block heights.
   - **Nodes Monitor**: Real-time status, block heights, dev balances, and contracts for all running nodes.
   - **Chain Data Explorer**: View data points across chains and submit new transactions.
   - **Multi-Chain Tree Search**: Choose BFS or DFS to query data points across the distributed tree.
   - **Spin Up Fork Wizard**: Launch new forked blockchains with custom names, parent links, and initial data.
6. **Comprehensive Automated Test Suite**:
   - 16 test suites verifying node health, deployment, topology registration, data ingestion, DFS traversal, BFS traversal, traversal comparison, dynamic data insertion, and on-the-fly fork creation.

---

## Quick Start

### 1. Prerequisites
- **Node.js** (v18.0+ or newer, tested on Node v26.5.0)
- **NPM** (v9.0+)

### 2. Installation
Navigate to the `forktree-platform` directory and install dependencies:
```bash
cd forktree-platform
npm install
```

### 3. Run Automated Tests
Execute the full end-to-end verification suite:
```bash
npm test
```
Expected output:
```text
===========================================================
       BlockchainForkTree: Automated Test Suite            
===========================================================
[Suite 1: Multi-Chain Network Engine]
  ✓ Starts all 7 blockchain nodes (Ports 8545-8551)
  ✓ Verifies JSON-RPC eth_chainId for each node
[Suite 2: Smart Contract Deployment]
  ✓ Deploys StoreForkEvent on 8545 and BlockData on 8546-8551
[Suite 3: Fork Tree Topology Registration]
  ✓ Seeds fork events into repository contract on Port 8545
[Suite 4: Cross-Chain Data Ingestion]
  ✓ Verifies data points stored across all child blockchains
[Suite 5: Depth-First Search (DFS) Traversal]
  ✓ Discovers target value 43 on Chain 11104 (Port 8548) via DFS
  ✓ Discovers target value 62 on Chain 11106 (Port 8550) via DFS
  ✓ Returns 0 matches for non-existent target value 99999 via DFS
[Suite 6: Breadth-First Search (BFS) Traversal]
  ✓ Traverses in level-by-level order (Root -> Level 1 -> Level 2)
  ✓ Discovers target value 43 at Step 3 in BFS vs Step 5 in DFS
  ✓ Unified search API correctly switches between BFS and DFS
[Suite 7: Dynamic Data Point Insertion & Multi-Algorithm Discovery]
  ✓ Dynamically adds data point 777 to Port 8549 and discovers it via both DFS and BFS
[Suite 8: Dynamic Forked Blockchain Creation & Cross-Chain Traversal]
  ✓ Dynamically spins up a new forked blockchain "Fork Zeta" from Beta 11104
  ✓ Verifies new node 8552 JSON-RPC response and contract deployment
  ✓ Verifies fork registration in Repository on Port 8545 and topology update
  ✓ Discovers data point 888 in the new forked blockchain via BFS and DFS search
===========================================================
 ALL TESTS PASSED: 16/16 (100% Success)
===========================================================
```

### 4. Start the Interactive Web Dashboard
```bash
npm start
```
Open your browser at:
**[http://localhost:3000](http://localhost:3000)**

---

## CLI Commands

You can run searches and pipeline operations via CLI:

| Command | Description |
|---|---|
| `node scripts/searchData.js [val] [root] BFS` | Runs Breadth-First Search (e.g. `node scripts/searchData.js 43 11102 BFS`) |
| `node scripts/searchData.js [val] [root] DFS` | Runs Depth-First Search (e.g. `node scripts/searchData.js 43 11102 DFS`) |
| `npm run deploy` | Deploys `StoreForkEvent` (Port 8545) and `BlockData` (Ports 8546-8551) |
| `npm run seed` | Registers the fork tree topology and seeds initial data points |
| `npm test` | Runs the automated 12-test suite |

---

## Project Structure

```
forktree-platform/
├── package.json                   # Project dependencies and npm scripts
├── server.js                      # Express API server & Web Dashboard entrypoint
├── config/
│   ├── networkTopology.json       # Network IDs, ports, parents, and sample data
│   └── deployments.json           # Deployed contract addresses per chain
├── contracts/
│   ├── StoreForkEvent.sol         # Repository contract (fork registry & adjacency list)
│   ├── BlockData.sol              # Data contract (stores data points per chain)
│   └── compiledArtifacts.js       # Precompiled ABIs and bytecode
├── engine/
│   └── chainEngine.js             # 7-node JSON-RPC 2.0 multi-chain engine with disk persistence
├── scripts/
│   ├── deployContracts.js         # Contract deployment orchestrator
│   ├── seedForkTree.js            # Fork topology & data seeding script
│   ├── searchData.js              # Standalone CLI DFS search runner
│   └── run_geth_nodes.sh          # POSIX shell script to launch native Geth --dev nodes
├── services/
│   ├── contractClient.js          # Standard JSON-RPC contract interaction client
│   └── forkTreeService.js         # Fork tree service (topology, monitoring, DFS search)
├── storage/
│   ├── chain_state.json           # State persistence for simulated multi-chain nodes
│   ├── forkDetail.json            # Cached fork event snapshot (research format)
│   ├── chainTreeData.json         # Cached chain data snapshot (research format)
│   └── searchresult.txt           # Output log of latest DFS search
├── public/                        # Web Dashboard UI
│   ├── index.html                 # Single page application structure
│   ├── styles.css                 # Dark-mode styling, cards, tables, SVG graph
│   └── app.js                     # Browser client logic (safe native Fetch API)
└── tests/
    └── forkTree.test.js           # Automated end-to-end test suite
```

---

## How the Fork Tree Works

```
                     [Port 8545 / Network 11101]
                  Consortium Governance Repository
                                 │
                                 ▼
                     [Port 8546 / Network 11102]
                   Master Patient Index (MPI Root)
                        /               \
            (Fork @ Block 1)         (Fork @ Block 3)
                      /                   \
           [Port 8547 / 11103]     [Port 8548 / 11104]
         Metro General Hospital   BioLabs Diagnostic Center
               /        \                   │
     (Fork @ 2)      (Fork @ 1)         (Fork @ 3)
            /              \                │
    [Port 8549]        [Port 8550]     [Port 8551]
Cardio Specialty     Emergency Care   Consortium Pharmacy
     Clinic              Center             Network
    (11105)             (11106)             (11107)
```
