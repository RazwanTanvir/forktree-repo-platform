// Frontend client logic for BlockchainForkTree Dashboard
document.addEventListener('DOMContentLoaded', () => {
  // Navigation Tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const content = document.getElementById(`tab-${targetTab}`);
      if (content) content.classList.add('active');

      if (targetTab === 'tree') loadTreeTopology();
      if (targetTab === 'nodes') loadNodesStatus();
      if (targetTab === 'data') loadChainData();
      if (targetTab === 'create-fork') populateChainDropdowns();
    });
  });

  // Global Actions
  const btnReseed = document.getElementById('btn-reseed');
  if (btnReseed) {
    btnReseed.addEventListener('click', async () => {
      btnReseed.disabled = true;
      btnReseed.textContent = '↺ Resetting & Reseeding...';
      try {
        const res = await fetch('/api/reset-and-seed', { method: 'POST' });
        const json = await res.json();
        alert(json.message || 'Reset complete!');
        loadNodesStatus();
        loadTreeTopology();
        loadChainData();
      } catch (err) {
        alert('Reset failed: ' + err.message);
      } finally {
        btnReseed.disabled = false;
        btnReseed.textContent = '↺ Reset & Reseed';
      }
    });
  }

  const btnRefreshNodes = document.getElementById('btn-refresh-nodes');
  if (btnRefreshNodes) {
    btnRefreshNodes.addEventListener('click', loadNodesStatus);
  }

  // Chain Data Filter
  const chainFilter = document.getElementById('chain-filter');
  if (chainFilter) {
    chainFilter.addEventListener('change', () => {
      loadChainData(chainFilter.value);
    });
  }

  // Add Data Form
  const formAddData = document.getElementById('form-add-data');
  if (formAddData) {
    formAddData.addEventListener('submit', async (e) => {
      e.preventDefault();
      const port = document.getElementById('add-target-port').value;
      const dataValue = document.getElementById('add-value').value;
      const statusDiv = document.getElementById('add-data-status');

      statusDiv.className = 'alert-msg';
      statusDiv.style.display = 'block';
      statusDiv.textContent = 'Submitting transaction...';

      try {
        const res = await fetch('/api/add-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ port, dataValue })
        });
        const json = await res.json();

        if (json.success) {
          statusDiv.className = 'alert-msg show-success';
          statusDiv.textContent = `✓ ${json.message} (Tx: ${json.txHash ? json.txHash.slice(0, 16) : ''}...)`;
          document.getElementById('add-value').value = '';
          loadChainData(chainFilter.value);
        } else {
          statusDiv.className = 'alert-msg show-error';
          statusDiv.textContent = `Error: ${json.error}`;
        }
      } catch (err) {
        statusDiv.className = 'alert-msg show-error';
        statusDiv.textContent = `Error: ${err.message}`;
      }
    });
  }

  // Search Form
  const formSearch = document.getElementById('form-search');
  if (formSearch) {
    formSearch.addEventListener('submit', async (e) => {
      e.preventDefault();
      const algorithm = document.getElementById('search-algorithm').value;
      const searchValue = document.getElementById('search-value').value;
      const startNetworkId = document.getElementById('search-root').value;
      executeSearch(algorithm, startNetworkId, searchValue);
    });
  }

  // Search Chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.getAttribute('data-search');
      const algo = chip.getAttribute('data-algo') || document.getElementById('search-algorithm').value;
      document.getElementById('search-value').value = val;
      document.getElementById('search-algorithm').value = algo;
      executeSearch(algo, 11102, val);
    });
  });

  // Create Fork Form
  const formCreateFork = document.getElementById('form-create-fork');
  if (formCreateFork) {
    formCreateFork.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('fork-name').value.trim();
      const parentNetworkId = document.getElementById('fork-parent-select').value;
      const forkBlockNumber = document.getElementById('fork-block-num').value;
      const initialDataStr = document.getElementById('fork-initial-data').value.trim();
      const initialData = initialDataStr ? initialDataStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)) : [];

      const btnSubmit = document.getElementById('btn-submit-fork');
      const progressContainer = document.getElementById('fork-create-progress');
      const resultDiv = document.getElementById('fork-create-result');

      btnSubmit.disabled = true;
      btnSubmit.textContent = '⏳ Spinning Up Fork...';
      progressContainer.style.display = 'block';
      resultDiv.style.display = 'none';

      const setStep = (id, state, text) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.className = `progress-step-item ${state}`;
        if (text) el.textContent = text;
      };

      setStep('step-port', 'active', '1. Allocating dynamic Port & Chain ID...');
      setStep('step-node', 'pending', '2. Boot JSON-RPC 2.0 Ethereum node');
      setStep('step-contract', 'pending', '3. Deploy BlockData smart contract');
      setStep('step-repo', 'pending', '4. Register fork event in StoreForkEvent (Port 8545)');
      setStep('step-data', 'pending', '5. Ingest initial data points');

      try {
        await new Promise(r => setTimeout(r, 200));
        setStep('step-port', 'done', '✓ 1. Dynamic Port & Chain ID Allocated');
        setStep('step-node', 'active', '2. Booting JSON-RPC 2.0 Ethereum node...');

        const res = await fetch('/api/fork/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, parentNetworkId, forkBlockNumber, initialData })
        });
        const json = await res.json();

        if (!json.success) throw new Error(json.error || 'Fork creation failed');

        const node = json.node;
        setStep('step-node', 'done', `✓ 2. Node live on Port ${node.port} (Chain ID: ${node.networkId})`);
        setStep('step-contract', 'done', `✓ 3. BlockData contract deployed at ${node.contractAddress.slice(0, 14)}...`);
        setStep('step-repo', 'done', `✓ 4. Fork registered in Repository (Parent: ${node.parentNetworkId} @ Block ${node.forkBlockNumber})`);
        setStep('step-data', 'done', `✓ 5. Ingested ${node.initialData ? node.initialData.length : 0} initial data points`);

        // Success Card
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <div class="node-created-card">
            <div class="node-created-title">
              <span>🎉</span>
              <span>Blockchain Successfully Forked & Online!</span>
            </div>
            <div class="node-created-meta">
              <div class="node-meta-item">
                <div class="node-meta-label">Chain Name</div>
                <div class="node-meta-value">${node.name}</div>
              </div>
              <div class="node-meta-item">
                <div class="node-meta-label">RPC Endpoint</div>
                <div class="node-meta-value">${node.rpcUrl}</div>
              </div>
              <div class="node-meta-item">
                <div class="node-meta-label">Network ID</div>
                <div class="node-meta-value">${node.networkId}</div>
              </div>
              <div class="node-meta-item">
                <div class="node-meta-label">Parent Chain</div>
                <div class="node-meta-value">Network ${node.parentNetworkId} (Fork @ #${node.forkBlockNumber})</div>
              </div>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-outline" style="font-size: 12px;" onclick="document.querySelector('[data-tab=tree]').click();">
                🌳 View in Topology Graph
              </button>
              <button type="button" class="btn btn-outline" style="font-size: 12px;" onclick="document.querySelector('[data-tab=nodes]').click();">
                ⚡ View in Nodes Monitor
              </button>
              <button type="button" class="btn btn-outline" style="font-size: 12px;" onclick="document.querySelector('[data-tab=data]').click();">
                📊 Add Data to this Chain
              </button>
            </div>
          </div>
        `;

        document.getElementById('fork-name').value = '';
        document.getElementById('fork-initial-data').value = '';

        await populateChainDropdowns();
        loadTreeTopology();
        loadNodesStatus();
        loadChainData();
      } catch (err) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `<div class="alert-msg show-error">Failed to spin up forked chain: ${err.message}</div>`;
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = '🚀 Start & Spin Up Node';
      }
    });
  }

  // Parent selector change updates fork block number
  const forkParentSelect = document.getElementById('fork-parent-select');
  if (forkParentSelect) {
    forkParentSelect.addEventListener('change', updateForkBlockFromParent);
  }

  const btnUseLatestBlock = document.getElementById('btn-use-latest-block');
  if (btnUseLatestBlock) {
    btnUseLatestBlock.addEventListener('click', updateForkBlockFromParent);
  }

  // Initial Load
  populateChainDropdowns();
  loadTreeTopology();
  loadNodesStatus();
  loadChainData();
});

// Load Nodes Status
async function loadNodesStatus() {
  const container = document.getElementById('nodes-grid');
  if (!container) return;

  try {
    const res = await fetch('/api/status');
    const json = await res.json();
    const nodes = json.nodes || [];

    const activeCount = nodes.filter(n => n.online).length;
    document.getElementById('global-status').textContent = `${activeCount}/${nodes.length} Chains Active`;

    container.innerHTML = nodes.map(node => `
      <div class="node-card">
        <div class="node-card-top">
          <h4>${node.name}</h4>
          <span class="status-indicator">
            <span class="status-dot ${node.online ? 'pulsing' : ''}" style="background-color: ${node.online ? 'var(--accent-green)' : 'var(--accent-red)'}"></span>
            ${node.online ? 'Online' : 'Offline'}
          </span>
        </div>
        <div class="node-stats">
          <div class="stat-row">
            <span>Role:</span>
            <span class="badge ${node.role === 'repository' ? 'badge-info' : (node.isRoot ? 'badge-primary' : 'badge-warning')}">${node.role}</span>
          </div>
          <div class="stat-row">
            <span>Network ID:</span>
            <span class="stat-val">${node.networkId}</span>
          </div>
          <div class="stat-row">
            <span>RPC Port:</span>
            <span class="stat-val">${node.port}</span>
          </div>
          <div class="stat-row">
            <span>Block Height:</span>
            <span class="stat-val">#${node.blockNumber}</span>
          </div>
          <div class="stat-row">
            <span>Dev Balance:</span>
            <span class="stat-val">${parseFloat(node.balance).toFixed(2)} ETH</span>
          </div>
          <div class="stat-row" style="margin-top: 4px;">
            <span>Contract:</span>
            <span class="stat-val" style="font-size: 10px;" title="${node.contractAddress || 'None'}">
              ${node.contractAddress ? node.contractAddress.slice(0, 10) + '...' : 'Not deployed'}
            </span>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="alert-msg show-error">Failed to load nodes: ${err.message}</div>`;
  }
}

let cachedChains = [];

// Populate all chain dropdowns dynamically
async function populateChainDropdowns() {
  try {
    const res = await fetch('/api/chains');
    const json = await res.json();
    cachedChains = json.chains || [];

    // 1. Parent chain selector in "Spin Up Fork" (#fork-parent-select)
    const forkParentSelect = document.getElementById('fork-parent-select');
    if (forkParentSelect) {
      const prevVal = forkParentSelect.value;
      forkParentSelect.innerHTML = cachedChains.map(c => `
        <option value="${c.networkId}" ${c.networkId === 11102 ? 'selected' : ''}>
          ${c.name} (Port ${c.port} | Net ${c.networkId}${c.isRoot ? ' - ROOT' : ''} | Block #${c.blockNumber})
        </option>
      `).join('');
      if (prevVal && cachedChains.some(c => c.networkId.toString() === prevVal)) {
        forkParentSelect.value = prevVal;
      }
      updateForkBlockFromParent();
    }

    // 2. Data Explorer filter dropdown (#chain-filter)
    const chainFilter = document.getElementById('chain-filter');
    if (chainFilter) {
      const currentVal = chainFilter.value || 'all';
      chainFilter.innerHTML = `
        <option value="all">All Blockchains (Aggregate)</option>
        ${cachedChains.map(c => `
          <option value="${c.port}">${c.name} (Port ${c.port})</option>
        `).join('')}
      `;
      chainFilter.value = currentVal;
    }

    // 3. Add Data Target dropdown (#add-target-port)
    const addTargetPort = document.getElementById('add-target-port');
    if (addTargetPort) {
      const currentVal = addTargetPort.value;
      addTargetPort.innerHTML = cachedChains.map(c => `
        <option value="${c.port}">Port ${c.port} (${c.name})</option>
      `).join('');
      if (currentVal && cachedChains.some(c => c.port.toString() === currentVal)) {
        addTargetPort.value = currentVal;
      }
    }

    // 4. Search Root Chain dropdown (#search-root)
    const searchRoot = document.getElementById('search-root');
    if (searchRoot) {
      const currentVal = searchRoot.value || '11102';
      searchRoot.innerHTML = cachedChains.map(c => `
        <option value="${c.networkId}" ${c.networkId.toString() === currentVal ? 'selected' : ''}>
          ${c.name} (Net ${c.networkId} | Port ${c.port}${c.isRoot ? ' - Root' : ''})
        </option>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to populate chain dropdowns:', err);
  }
}

function updateForkBlockFromParent() {
  const select = document.getElementById('fork-parent-select');
  const input = document.getElementById('fork-block-num');
  if (!select || !input) return;
  const parentId = parseInt(select.value, 10);
  const parent = cachedChains.find(c => c.networkId === parentId);
  if (parent) {
    input.value = parent.blockNumber || 0;
  }
}

// Load Tree Topology & Render Interactive SVG
async function loadTreeTopology() {
  const svg = document.getElementById('tree-svg');
  if (!svg) return;

  try {
    const res = await fetch('/api/tree');
    const json = await res.json();
    const tree = json.tree || {};
    renderTreeSvg(svg, tree);
  } catch (err) {
    console.error('Failed to load tree topology:', err);
  }
}

// Dynamic Hierarchical Tree SVG Renderer
function renderTreeSvg(svg, tree) {
  svg.innerHTML = '';
  const containerWidth = svg.parentElement ? svg.parentElement.clientWidth : 700;
  const nodes = tree.nodes || [];
  const edges = tree.edges || [];
  const adjacencyList = tree.adjacencyList || {};

  if (nodes.length === 0) return;

  // 1. Compute tree levels via BFS starting from Root chain (11102)
  const levelMap = {};
  const rootNode = nodes.find(n => n.isRoot) || nodes.find(n => n.id === '11102') || nodes[0];
  const rootId = rootNode ? rootNode.id : '11102';

  levelMap[rootId] = 0;
  const queue = [rootId];
  const visited = new Set([rootId]);

  while (queue.length > 0) {
    const currId = queue.shift();
    const currLevel = levelMap[currId];
    const children = adjacencyList[currId] || [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        visited.add(childId);
        levelMap[childId] = currLevel + 1;
        queue.push(childId);
      }
    }
  }

  // Handle any nodes not linked to root
  nodes.forEach(n => {
    if (levelMap[n.id] === undefined) {
      levelMap[n.id] = (n.parentNetworkId && levelMap[n.parentNetworkId] !== undefined)
        ? levelMap[n.parentNetworkId] + 1
        : 1;
    }
  });

  // 2. Group nodes by level
  const levels = {};
  nodes.forEach(n => {
    const lvl = levelMap[n.id] || 0;
    if (!levels[lvl]) levels[lvl] = [];
    levels[lvl].push(n);
  });

  const maxLevel = Math.max(...Object.keys(levels).map(Number), 1);
  const maxNodesInAnyLevel = Math.max(...Object.values(levels).map(arr => arr.length), 1);

  // Dynamic canvas sizing
  const width = Math.max(containerWidth, maxNodesInAnyLevel * 190 + 140);
  const height = Math.max(450, 100 + (maxLevel + 1) * 125);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.style.minWidth = `${width}px`;
  svg.style.height = `${height}px`;

  const levelColors = ['#388bfd', '#e3b341', '#bc8cff', '#39c5cf', '#f778ba', '#ff7b72'];

  // 3. Compute (x, y) coordinates
  const positions = {};

  // Repository node position (Port 8545 / 11101)
  positions['11101'] = {
    x: 95,
    y: 50,
    color: '#39c5cf',
    label: '11101: Repo (Port 8545)',
    fullLabel: 'Repository Chain (Port 8545)'
  };

  Object.keys(levels).sort((a, b) => Number(a) - Number(b)).forEach(lvlStr => {
    const lvl = Number(lvlStr);
    const nodesAtLvl = levels[lvl];
    const k = nodesAtLvl.length;
    const y = 80 + lvl * 120;
    const col = levelColors[lvl % levelColors.length];

    nodesAtLvl.forEach((node, idx) => {
      const x = (idx + 1) * (width / (k + 1));
      const shortName = node.name.length > 14 ? node.name.slice(0, 14) + '...' : node.name;
      positions[node.id] = {
        x,
        y,
        color: col,
        label: `${node.id}: ${shortName} (Port ${node.port})`,
        fullLabel: `${node.name} (Port ${node.port} | Net ${node.id})`
      };
    });
  });

  // 4. Draw Edges (Curved Bezier connectors)
  edges.forEach(edge => {
    const src = positions[edge.source];
    const tgt = positions[edge.target];
    if (src && tgt) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = `M ${src.x} ${src.y} C ${src.x} ${(src.y + tgt.y) / 2}, ${tgt.x} ${(src.y + tgt.y) / 2}, ${tgt.x} ${tgt.y}`;
      line.setAttribute('d', d);
      line.setAttribute('class', 'tree-link');
      line.setAttribute('id', `edge-${edge.source}-${edge.target}`);
      svg.appendChild(line);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', (src.x + tgt.x) / 2 + 6);
      text.setAttribute('y', (src.y + tgt.y) / 2);
      text.setAttribute('fill', '#8b949e');
      text.setAttribute('font-size', '11');
      text.setAttribute('font-family', 'JetBrains Mono');
      text.textContent = `Fork @ Block ${edge.forkBlock}`;
      svg.appendChild(text);
    }
  });

  // Reference connection from Repo to Root
  if (positions['11101'] && positions[rootId]) {
    const repoEdge = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    repoEdge.setAttribute('d', `M ${positions['11101'].x} ${positions['11101'].y} L ${positions[rootId].x} ${positions[rootId].y}`);
    repoEdge.setAttribute('stroke', 'rgba(57, 197, 207, 0.4)');
    repoEdge.setAttribute('stroke-width', '1.5');
    repoEdge.setAttribute('stroke-dasharray', '3 3');
    repoEdge.setAttribute('fill', 'none');
    svg.appendChild(repoEdge);
  }

  // 5. Draw Node cards
  Object.keys(positions).forEach(key => {
    const p = positions[key];
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'node-group');
    g.setAttribute('id', `node-g-${key}`);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', p.x - 85);
    rect.setAttribute('y', p.y - 20);
    rect.setAttribute('width', 170);
    rect.setAttribute('height', 40);
    rect.setAttribute('rx', 8);
    rect.setAttribute('fill', '#161b22');
    rect.setAttribute('stroke', p.color);
    rect.setAttribute('stroke-width', 1.5);
    g.appendChild(rect);

    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', p.x);
    txt.setAttribute('y', p.y + 4);
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('fill', '#f0f6fc');
    txt.setAttribute('font-size', '11');
    txt.setAttribute('font-weight', '600');
    txt.setAttribute('font-family', 'Inter');
    txt.textContent = p.label;
    g.appendChild(txt);

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = p.fullLabel || p.label;
    g.appendChild(title);

    svg.appendChild(g);
  });
}

// Load Chain Data
async function loadChainData(portFilter = 'all') {
  const tbody = document.getElementById('data-table-body');
  if (!tbody) return;

  try {
    let rows = [];
    if (portFilter === 'all') {
      const res = await fetch('/api/data');
      const json = await res.json();
      const all = json.data || {};
      Object.keys(all).forEach(port => {
        rows.push(...all[port]);
      });
    } else {
      const res = await fetch(`/api/data/${portFilter}`);
      const json = await res.json();
      rows = json.data || [];
    }

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color: var(--text-muted);">No data points found on this chain.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(pt => `
      <tr>
        <td><span class="badge badge-primary">#${pt.blockNumber}</span></td>
        <td><code>${pt.networkId}</code></td>
        <td><code>Port ${pt.portNumber}</code></td>
        <td><strong style="color: var(--accent-gold); font-size: 14px;">${pt.data}</strong></td>
        <td><span style="color: var(--text-secondary); font-size: 12px;">Stored via BlockData contract</span></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center show-error">Failed to load data: ${err.message}</td></tr>`;
  }
}

// Execute Multi-Chain Tree Search (BFS or DFS)
async function executeSearch(algorithm = 'BFS', startNetworkId = 11102, searchValue = 43) {
  const container = document.getElementById('search-results-area');
  if (!container) return;

  const algoName = algorithm === 'BFS' ? 'Breadth-First Search (BFS)' : 'Depth-First Search (DFS)';

  container.innerHTML = `
    <div class="empty-state">
      <div class="status-dot pulsing" style="width: 16px; height: 16px; margin: 0 auto 12px auto;"></div>
      <p>Executing on-chain <strong>${algoName}</strong> across the blockchain tree for value <strong>${searchValue}</strong>...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ algorithm, startNetworkId, searchValue })
    });
    const json = await res.json();
    const result = json.result;

    if (!result) throw new Error('No result returned from search API');

    let html = '';

    // Summary Header
    html += `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span class="badge ${result.algorithm === 'BFS' ? 'badge-info' : 'badge-purple'}">${result.algorithm} Traversal</span>
            <span class="badge ${result.success ? 'badge-success' : 'badge-warning'}">
              ${result.success ? 'Match Discovered' : 'No Matches'}
            </span>
          </div>
          <h4>Target Value: <span style="color: var(--accent-gold); font-size: 18px;">${result.query.searchValue}</span></h4>
          <p style="color: var(--text-secondary); font-size: 13px;">Root Chain: <code>${result.query.startNetworkId}</code> | Visited: <strong>${result.visitedCount}</strong> nodes | Matches: <strong>${result.matches.length}</strong></p>
        </div>
      </div>
    `;

    // Traversal Path Timeline
    html += `
      <h4 style="font-size: 13px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
        Step-by-Step ${result.algorithm} Traversal Route:
      </h4>
      <div class="traversal-timeline">
    `;

    result.traversalPath.forEach(step => {
      const lvl = step.level !== undefined ? step.level : step.depth;
      html += `
        <div class="traversal-step ${step.foundMatch ? 'match-step' : ''}">
          <div class="step-badge">${step.step}</div>
          <div class="step-details">
            <div class="step-title">
              ${step.name}
              <span class="level-tag">${result.algorithm === 'BFS' ? 'Level' : 'Depth'} ${lvl}</span>
            </div>
            <div class="step-sub">Network ID: ${step.networkId} | Port: ${step.port}</div>
          </div>
          ${step.foundMatch ? `<div class="match-tag">★ MATCH DISCOVERED</div>` : `<span style="color: var(--text-muted); font-size: 12px;">Queried</span>`}
        </div>
      `;
    });

    html += `</div>`;

    // Detailed matches card
    if (result.matches.length > 0) {
      html += `
        <div style="margin-top: 24px; padding: 16px; background: rgba(227, 179, 65, 0.08); border: 1px solid rgba(227, 179, 65, 0.3); border-radius: var(--radius-sm);">
          <h4 style="color: var(--accent-gold); font-size: 14px; margin-bottom: 8px;">✓ Matching Block Confirmation:</h4>
          ${result.matches.map(m => `
            <p style="font-size: 13px; color: var(--text-primary); margin-bottom: 4px;">
              Chain <strong>${m.name}</strong> (Port <code>${m.port}</code>) matched target value <strong>${m.searchValue}</strong> at <strong>Block #${m.matchingBlocks.join(', #')}</strong> on <strong>${result.algorithm === 'BFS' ? 'Level' : 'Depth'} ${m.level !== undefined ? m.level : m.depth}</strong>.
            </p>
          `).join('')}
        </div>
      `;
    }

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="alert-msg show-error">Search failed: ${err.message}</div>`;
  }
}

// Retain alias for any legacy calls
window.executeDfsSearch = (startNetworkId, searchValue) => executeSearch('DFS', startNetworkId, searchValue);
window.executeSearch = executeSearch;
