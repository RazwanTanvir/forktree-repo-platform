// Frontend client logic for BlockchainForkTree Shared Governance & EHR Platform
document.addEventListener('DOMContentLoaded', () => {
  // Active Persona State
  let currentPersona = {
    id: 'metro-clinician',
    name: 'Dr. Alice Smith',
    title: 'Senior Attending Physician',
    address: '0x2222222222222222222222222222222222222222',
    organizationId: 11103,
    organizationName: 'Metro General Hospital',
    role: 'CLINICIAN',
    port: 8547,
    permissions: ['WRITE_RECORDS', 'READ_RECORDS', 'QUERY_EHR'],
    avatar: '🩺'
  };

  let cachedPersonas = [];
  let cachedChains = [];

  // --- Navigation Tabs ---
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
      if (targetTab === 'governance') {
        loadGovernanceOrganizations();
        loadGovernanceProposals();
        populateProposalParentDropdown();
      }
      if (targetTab === 'nodes') loadNodesStatus();
      if (targetTab === 'data') {
        loadChainData();
        populateDataChainSelect();
      }
      if (targetTab === 'create-fork') populateForkParentSelect();
    });
  });

  // --- Persona Switcher Setup ---
  async function initPersonas() {
    try {
      const res = await fetch('/api/personas');
      const json = await res.json();
      if (json.success && Array.isArray(json.personas)) {
        cachedPersonas = json.personas;
        const select = document.getElementById('persona-select');
        if (select) {
          select.innerHTML = '';
          cachedPersonas.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.avatar} ${p.name} (${p.title} - ${p.organizationName})`;
            select.appendChild(opt);
          });
          select.value = currentPersona.id;
          select.addEventListener('change', () => {
            const chosen = cachedPersonas.find(p => p.id === select.value);
            if (chosen) {
              currentPersona = chosen;
              updatePersonaUI();
            }
          });
        }
      }
    } catch (e) {
      console.warn('Could not load personas:', e.message);
    }
    updatePersonaUI();
  }

  function updatePersonaUI() {
    const avatarEl = document.getElementById('persona-avatar');
    const badgeEl = document.getElementById('persona-badge');
    const orgEl = document.getElementById('persona-org');
    const addrEl = document.getElementById('persona-address');
    const propProposerEl = document.getElementById('prop-current-proposer');

    if (avatarEl) avatarEl.textContent = currentPersona.avatar || '👤';
    if (badgeEl) {
      badgeEl.textContent = currentPersona.role;
      badgeEl.className = `badge badge-role role-${currentPersona.role.toLowerCase()}`;
    }
    if (orgEl) orgEl.textContent = `${currentPersona.organizationName} (:${currentPersona.port})`;
    if (addrEl) addrEl.textContent = `${currentPersona.address.slice(0, 6)}...${currentPersona.address.slice(-4)}`;
    if (propProposerEl) propProposerEl.textContent = currentPersona.address;

    updateAuthStatusBanner();
    checkChainAuthorization();
  }

  function updateAuthStatusBanner() {
    const banner = document.getElementById('auth-status-banner');
    const title = document.getElementById('auth-status-title');
    const desc = document.getElementById('auth-status-desc');
    const targetChainSelect = document.getElementById('patient-chain-select');
    const targetPort = targetChainSelect ? parseInt(targetChainSelect.value, 10) : currentPersona.port;

    if (!banner || !title || !desc) return;

    const isAuthorized = (currentPersona.port === targetPort && (currentPersona.role === 'CLINICIAN' || currentPersona.role === 'ADMIN')) || currentPersona.address === '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02';

    if (isAuthorized) {
      banner.className = 'auth-banner auth-allowed';
      title.textContent = `✓ Authorized Clinician / Stakeholder`;
      desc.textContent = `You are authenticated as ${currentPersona.name} (${currentPersona.title}) with write authorization on Port ${targetPort}.`;
    } else {
      banner.className = 'auth-banner auth-restricted';
      title.textContent = `⚠️ Restricted Access / Read-Only`;
      desc.textContent = `Operating as ${currentPersona.name} (${currentPersona.role} at ${currentPersona.organizationName}). You do not have clinician write authorization on Port ${targetPort}. Transactions will revert unless granted stakeholder role by the organization owner.`;
    }
  }

  function checkChainAuthorization() {
    const targetChainSelect = document.getElementById('patient-chain-select');
    const hint = document.getElementById('chain-auth-hint');
    const permBadge = document.getElementById('write-perm-badge');
    const commitBtn = document.getElementById('btn-commit-record');

    if (!targetChainSelect) return;
    const targetPort = parseInt(targetChainSelect.value, 10);
    const isAuthorized = (currentPersona.port === targetPort && (currentPersona.role === 'CLINICIAN' || currentPersona.role === 'ADMIN')) || currentPersona.address === '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02';

    if (isAuthorized) {
      if (hint) {
        hint.textContent = `✓ Active persona is an authorized writer on this blockchain (: ${targetPort}).`;
        hint.style.color = '#7ee787';
      }
      if (permBadge) {
        permBadge.textContent = '🔓 Authorized Clinician';
        permBadge.className = 'badge badge-success';
      }
      if (commitBtn) {
        commitBtn.disabled = false;
        commitBtn.textContent = '🔒 Commit Record with Clinician Credentials';
      }
    } else {
      if (hint) {
        hint.textContent = `⚠️ Active persona (${currentPersona.name}) is not a registered clinician for Port ${targetPort}.`;
        hint.style.color = '#f85149';
      }
      if (permBadge) {
        permBadge.textContent = '🔒 Unauthorized (Revert on commit)';
        permBadge.className = 'badge badge-danger';
      }
      if (commitBtn) {
        commitBtn.disabled = false;
        commitBtn.textContent = '⚠️ Attempt Commit (Will Test RBAC Reversion)';
      }
    }
  }

  // --- Fetch Active Chains Helper ---
  async function fetchChains() {
    try {
      const res = await fetch('/api/chains');
      const json = await res.json();
      if (json.success && Array.isArray(json.chains)) {
        cachedChains = json.chains;
      }
    } catch (e) {
      console.warn('Could not fetch chains:', e.message);
    }
    return cachedChains;
  }

  async function populateDataChainSelect() {
    const select = document.getElementById('patient-chain-select');
    const filter = document.getElementById('data-chain-filter');
    if (!select) return;

    const chains = await fetchChains();
    const currentVal = select.value;
    select.innerHTML = '';
    chains.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.port;
      opt.textContent = `${c.name} (Port ${c.port} | Net ${c.networkId})`;
      select.appendChild(opt);
    });

    if (currentVal && chains.some(c => c.port === Number(currentVal))) {
      select.value = currentVal;
    } else if (chains.some(c => c.port === currentPersona.port)) {
      select.value = currentPersona.port;
    }

    if (filter && filter.options.length <= 1) {
      chains.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.port;
        opt.textContent = `${c.name} (Port ${c.port})`;
        filter.appendChild(opt);
      });
    }

    select.removeEventListener('change', onDataChainSelectChange);
    select.addEventListener('change', onDataChainSelectChange);
    checkChainAuthorization();
  }

  function onDataChainSelectChange() {
    updateAuthStatusBanner();
    checkChainAuthorization();
  }

  async function populateProposalParentDropdown() {
    const select = document.getElementById('prop-parent-chain');
    if (!select) return;
    const chains = await fetchChains();
    select.innerHTML = '';
    chains.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.networkId;
      opt.textContent = `${c.name} (Net ${c.networkId} | Port ${c.port})`;
      select.appendChild(opt);
    });
  }

  async function populateForkParentSelect() {
    const select = document.getElementById('fork-parent-select');
    if (!select) return;
    const chains = await fetchChains();
    select.innerHTML = '';
    chains.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.networkId;
      opt.textContent = `${c.name} (Net ${c.networkId} | Port ${c.port} | Block #${c.blockNumber})`;
      select.appendChild(opt);
    });
  }

  // --- TAB 1: Tree Topology SVG Rendering ---
  async function loadTreeTopology() {
    const svg = document.getElementById('tree-svg');
    if (!svg) return;

    try {
      const res = await fetch('/api/tree');
      const json = await res.json();
      if (!json.success || !json.tree) return;

      const { nodes, edges } = json.tree;
      renderTreeSvg(svg, nodes, edges);
    } catch (e) {
      console.warn('Failed to load tree topology:', e.message);
    }
  }

  function renderTreeSvg(svg, nodes, edges) {
    svg.innerHTML = '';
    if (!nodes || nodes.length === 0) return;

    const width = svg.clientWidth || 600;
    const height = svg.clientHeight || 450;

    // Calculate hierarchical levels using parent links
    const levelMap = new Map();
    const childrenMap = new Map();

    nodes.forEach(n => {
      childrenMap.set(n.networkId, []);
    });

    edges.forEach(e => {
      if (childrenMap.has(e.from)) {
        childrenMap.get(e.from).push(e.to);
      }
    });

    const rootNode = nodes.find(n => n.isRoot) || nodes[0];
    levelMap.set(rootNode.networkId, 0);

    const queue = [rootNode.networkId];
    while (queue.length > 0) {
      const current = queue.shift();
      const currentLevel = levelMap.get(current);
      const kids = childrenMap.get(current) || [];
      kids.forEach(kid => {
        if (!levelMap.has(kid)) {
          levelMap.set(kid, currentLevel + 1);
          queue.push(kid);
        }
      });
    }

    const maxLevel = Math.max(...Array.from(levelMap.values()), 1);
    const levelCounts = {};
    levelMap.forEach(lvl => {
      levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
    });

    const levelCurrentIdx = {};
    const coords = new Map();

    nodes.forEach(n => {
      const lvl = levelMap.get(n.networkId) || 0;
      const totalInLvl = levelCounts[lvl] || 1;
      const idx = levelCurrentIdx[lvl] || 0;
      levelCurrentIdx[lvl] = idx + 1;

      const y = 60 + (lvl * ((height - 120) / maxLevel));
      const x = (width / (totalInLvl + 1)) * (idx + 1);

      coords.set(n.networkId, { x, y });
    });

    // Render edges
    edges.forEach(e => {
      const p1 = coords.get(e.from);
      const p2 = coords.get(e.to);
      if (p1 && p2) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midY = (p1.y + p2.y) / 2;
        const d = `M ${p1.x} ${p1.y} C ${p1.x} ${midY}, ${p2.x} ${midY}, ${p2.x} ${p2.y}`;
        path.setAttribute('d', d);
        path.setAttribute('stroke', 'rgba(56, 139, 253, 0.45)');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);

        // Edge label (fork block)
        if (e.forkBlock !== undefined) {
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', (p1.x + p2.x) / 2 + 10);
          text.setAttribute('y', midY);
          text.setAttribute('fill', '#e3b341');
          text.setAttribute('font-size', '10');
          text.setAttribute('font-family', 'var(--font-mono)');
          text.textContent = `@Block ${e.forkBlock}`;
          svg.appendChild(text);
        }
      }
    });

    // Render nodes
    nodes.forEach(n => {
      const p = coords.get(n.networkId);
      if (!p) return;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('cursor', 'pointer');

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', p.x);
      circle.setAttribute('cy', p.y);
      circle.setAttribute('r', n.isRoot ? '24' : '20');
      circle.setAttribute('fill', n.isRoot ? '#1f6feb' : '#238636');
      circle.setAttribute('stroke', '#f0f6fc');
      circle.setAttribute('stroke-width', '2');
      g.appendChild(circle);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', p.x);
      label.setAttribute('y', p.y + 36);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', '#f0f6fc');
      label.setAttribute('font-size', '11');
      label.setAttribute('font-weight', '600');
      label.textContent = n.name.split(' (')[0];
      g.appendChild(label);

      const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      sub.setAttribute('x', p.x);
      sub.setAttribute('y', p.y + 48);
      sub.setAttribute('text-anchor', 'middle');
      sub.setAttribute('fill', 'var(--text-secondary)');
      sub.setAttribute('font-size', '9');
      sub.setAttribute('font-family', 'var(--font-mono)');
      sub.textContent = `:${n.port} | Net ${n.networkId}`;
      g.appendChild(sub);

      svg.appendChild(g);
    });
  }

  // --- TAB 2: Shared Governance Dashboard ---
  async function loadGovernanceOrganizations() {
    const tbody = document.getElementById('governance-orgs-tbody');
    const countBadge = document.getElementById('org-count-badge');
    if (!tbody) return;

    try {
      const res = await fetch('/api/governance/organizations');
      const json = await res.json();
      if (!json.success || !Array.isArray(json.organizations)) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No organizations registered yet.</td></tr>';
        return;
      }

      const orgs = json.organizations;
      if (countBadge) countBadge.textContent = `${orgs.length} Organizations`;

      tbody.innerHTML = '';
      orgs.forEach(o => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>#${o.orgId}</strong></td>
          <td><strong>${o.name}</strong></td>
          <td><span class="badge badge-info">${o.orgType || 'Healthcare Org'}</span></td>
          <td><code>${o.networkId}</code></td>
          <td><code>:${o.port}</code></td>
          <td title="${o.adminAddress}"><code class="mono-code">${o.adminAddress.slice(0, 6)}...${o.adminAddress.slice(-4)}</code></td>
          <td><span class="badge badge-success">✓ Active Member</span></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" class="alert-msg show-error">Failed to load organizations: ${e.message}</td></tr>`;
    }
  }

  async function loadGovernanceProposals() {
    const container = document.getElementById('proposals-list-container');
    if (!container) return;

    try {
      const res = await fetch('/api/governance/proposals');
      const json = await res.json();
      if (!json.success || !Array.isArray(json.proposals) || json.proposals.length === 0) {
        container.innerHTML = '<div class="empty-state">No governance proposals submitted yet. Use the form above to propose a new organizational fork.</div>';
        return;
      }

      const proposals = json.proposals;
      container.innerHTML = '';

      proposals.forEach(p => {
        const totalVotes = p.votesFor + p.votesAgainst;
        const pctFor = totalVotes > 0 ? Math.round((p.votesFor / totalVotes) * 100) : 50;
        const card = document.createElement('div');
        card.className = `proposal-card ${p.executed ? 'executed' : ''}`;

        const isMember = currentPersona.role === 'ADMIN';

        card.innerHTML = `
          <div class="proposal-header">
            <div>
              <div class="proposal-title">#${p.proposalId}: ${p.orgName}</div>
              <div class="proposal-meta">
                <span>Proposed by: <code class="mono-code">${p.proposer.slice(0, 6)}...${p.proposer.slice(-4)}</code></span> | 
                <span>Fork from: <strong>Chain ${p.parentNetworkId}</strong></span> |
                <span>Type: <strong>${p.orgType}</strong></span>
              </div>
            </div>
            <span class="badge ${p.executed ? 'badge-success' : 'badge-primary'}">
              ${p.executed ? '✓ Executed & Spun Up' : 'Voting Open'}
            </span>
          </div>

          <div class="proposal-justification">
            <strong>Clinical Justification:</strong> ${p.justification}
          </div>

          <div class="vote-stats-container">
            <div class="vote-stats-numbers">
              <span class="vote-stat-for">👍 ${p.votesFor} For (${pctFor}%)</span>
              <span class="vote-stat-against">👎 ${p.votesAgainst} Against</span>
            </div>
            <div class="vote-progress-track">
              <div class="vote-progress-fill" style="width: ${pctFor}%;"></div>
            </div>
          </div>

          ${p.executed ? `
            <div class="badge badge-success text-center py-1">
              Active in Tree Lineage (Net ${p.networkId} | Port ${p.portNumber})
            </div>
          ` : `
            <div class="proposal-actions-row">
              <button class="btn-vote-for" data-id="${p.proposalId}" ${!isMember ? 'disabled title="Only member admins can vote"' : ''}>
                👍 Vote FOR
              </button>
              <button class="btn-vote-against" data-id="${p.proposalId}" ${!isMember ? 'disabled title="Only member admins can vote"' : ''}>
                👎 Vote AGAINST
              </button>
              ${p.votesFor > p.votesAgainst ? `
                <button class="btn-execute-proposal" data-id="${p.proposalId}">
                  🚀 Execute & Spin Up Node
                </button>
              ` : ''}
            </div>
          `}
        `;

        container.appendChild(card);
      });

      // Wire up voting buttons
      container.querySelectorAll('.btn-vote-for').forEach(btn => {
        btn.addEventListener('click', () => castVote(btn.dataset.id, true));
      });
      container.querySelectorAll('.btn-vote-against').forEach(btn => {
        btn.addEventListener('click', () => castVote(btn.dataset.id, false));
      });
      container.querySelectorAll('.btn-execute-proposal').forEach(btn => {
        btn.addEventListener('click', () => executeProposal(btn.dataset.id));
      });
    } catch (e) {
      container.innerHTML = `<div class="alert-msg show-error">Failed to load proposals: ${e.message}</div>`;
    }
  }

  async function castVote(proposalId, support) {
    try {
      const res = await fetch('/api/governance/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: Number(proposalId),
          support: Boolean(support),
          voterAddress: currentPersona.address
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(`✓ Vote recorded as ${currentPersona.name} (${support ? 'FOR' : 'AGAINST'})`);
        loadGovernanceProposals();
      } else {
        alert(`Voting error: ${json.error}`);
      }
    } catch (e) {
      alert(`Network error: ${e.message}`);
    }
  }

  async function executeProposal(proposalId) {
    if (!confirm(`Execute Proposal #${proposalId} and spin up the new forked blockchain node?`)) return;

    try {
      const res = await fetch('/api/governance/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: Number(proposalId),
          executorAddress: currentPersona.address
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(`✓ Proposal executed! Node spun up and integrated into consortium tree.`);
        loadGovernanceProposals();
        loadGovernanceOrganizations();
        loadTreeTopology();
      } else {
        alert(`Execution error: ${json.error}`);
      }
    } catch (e) {
      alert(`Network error: ${e.message}`);
    }
  }

  // Proposal Submission Form
  const formProposal = document.getElementById('form-submit-proposal');
  if (formProposal) {
    formProposal.addEventListener('submit', async e => {
      e.preventDefault();
      const orgName = document.getElementById('prop-org-name').value.trim();
      const parentNetworkId = Number(document.getElementById('prop-parent-chain').value);
      const orgType = document.getElementById('prop-org-type').value;
      const justification = document.getElementById('prop-justification').value.trim();

      const btn = document.getElementById('btn-submit-proposal');
      btn.disabled = true;
      btn.textContent = 'Submitting on-chain...';

      try {
        const res = await fetch('/api/governance/proposals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgName,
            parentNetworkId,
            orgType,
            justification,
            proposerAddress: currentPersona.address
          })
        });
        const json = await res.json();
        if (json.success) {
          alert(`✓ Proposal submitted successfully to Consortium Governance! Proposal ID: #${json.proposal ? json.proposal.networkId : ''}`);
          formProposal.reset();
          loadGovernanceProposals();
        } else {
          alert(`Submission failed: ${json.error}`);
        }
      } catch (e) {
        alert(`Network error: ${e.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = '📜 Submit Proposal to Consortium';
      }
    });
  }

  const btnRefreshProposals = document.getElementById('btn-refresh-proposals');
  if (btnRefreshProposals) {
    btnRefreshProposals.addEventListener('click', loadGovernanceProposals);
  }

  // --- TAB 3: Nodes Status ---
  async function loadNodesStatus() {
    const grid = document.getElementById('nodes-grid');
    if (!grid) return;

    try {
      const res = await fetch('/api/status');
      const json = await res.json();
      if (!json.success || !Array.isArray(json.nodes)) return;

      grid.innerHTML = '';
      json.nodes.forEach(node => {
        const card = document.createElement('div');
        card.className = 'node-card';
        card.innerHTML = `
          <div class="node-header">
            <div>
              <div class="node-title">${node.name}</div>
              <div class="node-sub">Network ID: ${node.networkId}</div>
            </div>
            <span class="badge ${node.online ? 'badge-success' : 'badge-danger'}">
              ${node.online ? '● Online' : '○ Offline'}
            </span>
          </div>
          <div class="node-metrics">
            <div class="metric-item">
              <span class="metric-label">RPC Endpoint</span>
              <span class="metric-val mono">: ${node.port}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Block Height</span>
              <span class="metric-val mono">#${node.blockNumber}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Contract Status</span>
              <span class="metric-val">${node.contractDeployed ? '✓ Deployed' : 'Not Deployed'}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Role</span>
              <span class="metric-val">${node.role.toUpperCase()}</span>
            </div>
          </div>
        `;
        grid.appendChild(card);
      });
    } catch (e) {
      console.warn('Failed to load node statuses:', e.message);
    }
  }

  // --- TAB 4: Data Explorer ---
  async function loadChainData(filterPort = 'all') {
    const tbody = document.getElementById('data-table-tbody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/data');
      const json = await res.json();
      if (!json.success || !json.data) return;

      const allData = json.data;
      let records = [];

      if (filterPort === 'all') {
        Object.values(allData).forEach(chainRecs => {
          if (Array.isArray(chainRecs)) records.push(...chainRecs);
        });
      } else {
        records = allData[filterPort] || [];
      }

      records.sort((a, b) => b.timestamp - a.timestamp);

      if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No clinical records found on selected blockchain(s).</td></tr>';
        return;
      }

      tbody.innerHTML = '';
      records.forEach(rec => {
        const tr = document.createElement('tr');
        const badgeClass = getResourceBadgeClass(rec.resourceType);

        tr.innerHTML = `
          <td><strong>#${rec.blockNumber}</strong></td>
          <td>${rec.chainName || `Port ${rec.portNumber}`}</td>
          <td><strong>${rec.patientId}</strong></td>
          <td><span class="badge ${badgeClass}">${rec.resourceType}</span></td>
          <td><code>${rec.clinicalCode}</code></td>
          <td title="${rec.dataHash}"><code class="mono-code">${rec.dataHash ? rec.dataHash.slice(0, 10) : ''}...</code></td>
          <td>${rec.timestampIso ? new Date(rec.timestampIso).toLocaleString() : ''}</td>
          <td>
            <button class="btn btn-outline btn-sm btn-inspect-fhir" data-fhir='${JSON.stringify(rec.resourceData || {}).replace(/'/g, "&apos;")}'>
              Inspect FHIR
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('.btn-inspect-fhir').forEach(btn => {
        btn.addEventListener('click', () => {
          try {
            const data = JSON.parse(btn.getAttribute('data-fhir'));
            openFhirModal(data);
          } catch (e) {
            alert('Failed to parse FHIR JSON: ' + e.message);
          }
        });
      });
    } catch (e) {
      console.warn('Failed to load chain data:', e.message);
    }
  }

  function getResourceBadgeClass(type) {
    const t = (type || '').toLowerCase();
    if (t === 'patient') return 'badge-resource-patient';
    if (t === 'observation') return 'badge-resource-obs';
    if (t === 'condition') return 'badge-resource-cond';
    if (t === 'encounter') return 'badge-resource-enc';
    if (t === 'diagnosticreport') return 'badge-resource-diag';
    if (t === 'medicationrequest') return 'badge-resource-med';
    return 'badge-primary';
  }

  // Add Patient Record Form Submission
  const formAddPatientRecord = document.getElementById('form-add-patient-record');
  if (formAddPatientRecord) {
    formAddPatientRecord.addEventListener('submit', async e => {
      e.preventDefault();
      const port = Number(document.getElementById('patient-chain-select').value);
      const patientId = document.getElementById('patient-id-input').value.trim();
      const resourceType = document.getElementById('resource-type-select').value;
      const clinicalCode = document.getElementById('clinical-code-input').value.trim();
      const rawJson = document.getElementById('resource-data-input').value.trim();
      const resultDiv = document.getElementById('add-record-result');

      let parsedPayload;
      try {
        parsedPayload = JSON.parse(rawJson);
      } catch (err) {
        alert('Invalid JSON in FHIR Resource Payload: ' + err.message);
        return;
      }

      resultDiv.className = 'add-result-msg';
      resultDiv.textContent = 'Committing record to organization blockchain with active credentials...';

      try {
        const res = await fetch('/api/add-patient-record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Caller-Address': currentPersona.address
          },
          body: JSON.stringify({
            port,
            patientId,
            resourceType,
            clinicalCode,
            resourceData: parsedPayload,
            callerAddress: currentPersona.address
          })
        });
        const json = await res.json();
        if (json.success) {
          resultDiv.className = 'add-result-msg show-success';
          resultDiv.textContent = `✓ Record committed! Block #${json.blockNumber !== undefined ? json.blockNumber : ''} | SHA-256: ${json.dataHash.slice(0, 16)}... | Caller: ${currentPersona.name}`;
          loadChainData();
        } else {
          resultDiv.className = 'add-result-msg show-error';
          resultDiv.textContent = `✗ Commit Rejected: ${json.error}`;
        }
      } catch (err) {
        resultDiv.className = 'add-result-msg show-error';
        resultDiv.textContent = `Network error: ${err.message}`;
      }
    });
  }

  const btnRefreshData = document.getElementById('btn-refresh-data');
  if (btnRefreshData) {
    btnRefreshData.addEventListener('click', () => {
      const filter = document.getElementById('data-chain-filter');
      loadChainData(filter ? filter.value : 'all');
    });
  }

  const dataFilter = document.getElementById('data-chain-filter');
  if (dataFilter) {
    dataFilter.addEventListener('change', () => {
      loadChainData(dataFilter.value);
    });
  }

  // --- TAB 5: Multi-Chain Search ---
  const formSearch = document.getElementById('form-search');
  if (formSearch) {
    formSearch.addEventListener('submit', async e => {
      e.preventDefault();
      executeSearch();
    });
  }

  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const query = btn.getAttribute('data-query');
      const type = btn.getAttribute('data-type');
      const input = document.getElementById('search-value-input');
      const typeSelect = document.getElementById('search-query-type');
      if (input) input.value = query;
      if (typeSelect) typeSelect.value = type;
      executeSearch();
    });
  });

  async function executeSearch() {
    const input = document.getElementById('search-value-input');
    const typeSelect = document.getElementById('search-query-type');
    const algoRadios = document.getElementsByName('algorithm');
    const resultsSec = document.getElementById('search-results-section');

    let algorithm = 'BFS';
    algoRadios.forEach(r => { if (r.checked) algorithm = r.value; });

    const searchValue = input ? input.value.trim() : 'P101';
    const queryType = typeSelect ? typeSelect.value : 'patientId';

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          algorithm,
          searchValue,
          queryType,
          startNetworkId: 11102
        })
      });
      const json = await res.json();
      if (!json.success || !json.result) return;

      const result = json.result;
      if (resultsSec) resultsSec.style.display = 'block';

      renderSearchResults(result);
    } catch (e) {
      alert('Search failed: ' + e.message);
    }
  }

  function renderSearchResults(result) {
    const routeList = document.getElementById('traversal-route-list');
    const stats = document.getElementById('traversal-stats');
    const algoBadge = document.getElementById('search-algo-badge');
    const timelineContainer = document.getElementById('ehr-timeline-container');
    const matchesBadge = document.getElementById('search-matches-badge');

    if (algoBadge) algoBadge.textContent = `${result.algorithm} Traversal`;

    // Traversal Path
    if (stats) {
      stats.innerHTML = `
        <span>Visited Organizations: <strong>${result.visitedCount}</strong></span> |
        <span>Query: <strong>${result.query.searchValue}</strong> (${result.query.queryType})</span>
      `;
    }

    if (routeList) {
      routeList.innerHTML = '';
      result.traversalPath.forEach(step => {
        const stepDiv = document.createElement('div');
        stepDiv.className = `traversal-step ${step.found ? 'match-step' : ''}`;
        stepDiv.innerHTML = `
          <div class="step-badge">${step.step}</div>
          <div class="step-details">
            <div class="step-title">${step.name} (: ${step.port})</div>
            <div class="step-meta">Level ${step.level} | Net ID ${step.networkId}</div>
          </div>
          ${step.found ? '<span class="badge badge-success">✓ Record Matched</span>' : '<span class="badge badge-secondary">Searched</span>'}
        `;
        routeList.appendChild(stepDiv);
      });
    }

    // Longitudinal EHR Timeline
    const records = result.longitudinalRecord || [];
    if (matchesBadge) matchesBadge.textContent = `${records.length} Clinical Events`;

    if (timelineContainer) {
      if (records.length === 0) {
        timelineContainer.innerHTML = '<div class="empty-state">No matching clinical events found across the consortium tree.</div>';
        return;
      }

      timelineContainer.innerHTML = '';
      records.forEach((rec, idx) => {
        const card = document.createElement('div');
        card.className = 'timeline-card';
        const badgeClass = getResourceBadgeClass(rec.resourceType);

        card.innerHTML = `
          <div class="timeline-header">
            <div class="timeline-title-row">
              <span class="badge ${badgeClass}">${rec.resourceType}</span>
              <strong>${rec.clinicalCode}</strong>
              <span class="timeline-chain">${rec.chainName} (: ${rec.portNumber})</span>
            </div>
            <span class="timeline-time">${rec.timestampIso ? new Date(rec.timestampIso).toLocaleString() : ''}</span>
          </div>
          <div class="timeline-body">
            <div>Patient: <strong>${rec.patientId}</strong> | Block <strong>#${rec.blockNumber}</strong></div>
            <div class="timeline-hash">SHA-256 Digest: <code>${rec.dataHash}</code></div>
          </div>
          <div class="timeline-footer">
            <button class="btn btn-outline btn-sm btn-inspect-timeline" data-idx="${idx}">
              Inspect Decoded FHIR JSON
            </button>
          </div>
        `;
        timelineContainer.appendChild(card);
      });

      timelineContainer.querySelectorAll('.btn-inspect-timeline').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-idx'));
          if (records[idx]) {
            openFhirModal(records[idx].resourceData);
          }
        });
      });
    }
  }

  // --- TAB 6: Spin Up Fork ---
  const formCreateFork = document.getElementById('form-create-fork');
  if (formCreateFork) {
    formCreateFork.addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('fork-chain-name').value.trim();
      const parentNetworkId = Number(document.getElementById('fork-parent-select').value);
      const forkBlockNumber = document.getElementById('fork-block-input').value;
      const initialDataStr = document.getElementById('fork-initial-data').value.trim();

      const initialData = initialDataStr ? initialDataStr.split(',').map(s => s.trim()) : [];
      const statusBadge = document.getElementById('spinup-status-badge');
      const resultPanel = document.getElementById('spinup-result-panel');

      if (statusBadge) {
        statusBadge.textContent = 'Provisioning...';
        statusBadge.className = 'badge badge-primary';
      }

      // Step animations
      const s1 = document.getElementById('step-1');
      const s2 = document.getElementById('step-2');
      const s3 = document.getElementById('step-3');
      const s4 = document.getElementById('step-4');
      const s5 = document.getElementById('step-5');

      [s1, s2, s3, s4, s5].forEach(s => { if (s) s.className = 'step-item active'; });

      try {
        const res = await fetch('/api/fork/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            parentNetworkId,
            forkBlockNumber: forkBlockNumber ? Number(forkBlockNumber) : undefined,
            initialData
          })
        });
        const json = await res.json();

        if (json.success) {
          [s1, s2, s3, s4, s5].forEach(s => { if (s) s.className = 'step-item done'; });
          if (statusBadge) {
            statusBadge.textContent = '✓ Live';
            statusBadge.className = 'badge badge-success';
          }
          if (resultPanel) {
            resultPanel.style.display = 'block';
            resultPanel.className = 'spinup-result-panel show-success';
            resultPanel.innerHTML = `
              <strong>✓ Forked Node Online!</strong>
              <div>Port: <code>${json.node.port}</code> | Net ID: <code>${json.node.networkId}</code></div>
              <div>Contract: <code>${json.node.contractAddress}</code></div>
            `;
          }
          loadTreeTopology();
          fetchChains();
        } else {
          throw new Error(json.error);
        }
      } catch (err) {
        if (statusBadge) {
          statusBadge.textContent = 'Failed';
          statusBadge.className = 'badge badge-danger';
        }
        if (resultPanel) {
          resultPanel.style.display = 'block';
          resultPanel.className = 'spinup-result-panel show-error';
          resultPanel.textContent = 'Error: ' + err.message;
        }
      }
    });
  }

  const btnUseLatest = document.getElementById('btn-use-latest-block');
  if (btnUseLatest) {
    btnUseLatest.addEventListener('click', async () => {
      const parentSelect = document.getElementById('fork-parent-select');
      const blockInput = document.getElementById('fork-block-input');
      if (!parentSelect || !blockInput) return;

      const parentNetId = Number(parentSelect.value);
      const chains = await fetchChains();
      const parent = chains.find(c => c.networkId === parentNetId);
      if (parent) {
        blockInput.value = parent.blockNumber;
      }
    });
  }

  // --- Modal Logic ---
  function openFhirModal(data) {
    const modal = document.getElementById('fhir-modal');
    const codeBlock = document.getElementById('modal-json-content');
    const resBadge = document.getElementById('modal-badge-resource');

    if (codeBlock) {
      codeBlock.textContent = JSON.stringify(data, null, 2);
    }
    if (resBadge && data && data.resourceType) {
      resBadge.textContent = data.resourceType;
    }
    if (modal) modal.style.display = 'flex';
  }

  function closeFhirModal() {
    const modal = document.getElementById('fhir-modal');
    if (modal) modal.style.display = 'none';
  }

  const closeBtn = document.getElementById('modal-close-btn');
  const closeBtnFooter = document.getElementById('btn-close-fhir-modal');
  if (closeBtn) closeBtn.addEventListener('click', closeFhirModal);
  if (closeBtnFooter) closeBtnFooter.addEventListener('click', closeFhirModal);

  const copyBtn = document.getElementById('btn-copy-fhir');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const codeBlock = document.getElementById('modal-json-content');
      if (codeBlock) {
        navigator.clipboard.writeText(codeBlock.textContent).then(() => {
          copyBtn.textContent = '✓ Copied!';
          setTimeout(() => { copyBtn.textContent = '📋 Copy JSON'; }, 2000);
        });
      }
    });
  }

  // --- Boot Initialization ---
  initPersonas();
  loadTreeTopology();
  fetchChains().then(() => {
    populateDataChainSelect();
  });
});
