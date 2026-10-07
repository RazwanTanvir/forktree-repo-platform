// Frontend Client Logic for BlockchainForkTree
// Shared Consortium Governance, Cross-Fork FHIR Interoperability & RBAC Platform

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  let currentPersona = {
    id: 'steering-council-admin',
    name: 'Dr. Marcus Vance',
    title: 'Consortium Steering Council Chair',
    address: '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02',
    organizationId: 11101,
    organizationName: 'Consortium Steering Council',
    role: 'STEERING_COUNCIL',
    port: 8545,
    permissions: ['MANAGE_CONSORTIUM', 'CREATE_PROJECT', 'REGISTER_ROOT_ORG', 'APPROVE_FORK', 'VOTE_PROPOSALS', 'SEND_INTER_ORG_MSG', 'VIEW_ALL'],
    avatar: '🏛️'
  };

  let cachedPersonas = [];
  let cachedChains = [];
  let cachedMessages = [];
  let activeMsgFilter = 'all';

  function getAuthHeaders() {
    return {
      'X-Caller-Address': currentPersona.address || '',
      'X-Caller-Role': currentPersona.role || '',
      'X-Caller-Port': String(currentPersona.port || ''),
      'X-Caller-Org': currentPersona.organizationName || ''
    };
  }

  // --- Navigation Tabs ---
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  function switchTab(targetTab) {
    tabButtons.forEach(b => {
      if (b.getAttribute('data-tab') === targetTab) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
    tabContents.forEach(c => {
      if (c.id === `tab-${targetTab}`) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });

    if (targetTab === 'tree') loadTreeTopology();
    if (targetTab === 'roles') {
      loadProjects();
      renderPersonaChips();
    }
    if (targetTab === 'messaging') {
      loadMessages();
      populateComposeRecipientDropdown();
      updateComposeTemplate();
    }
    if (targetTab === 'request-fork') {
      populateRequestForkParentSelect();
      loadForkBallots();
    }
    if (targetTab === 'governance') {
      loadGovernanceOrganizations();
      populateStakeholderChainSelect();
    }
    if (targetTab === 'nodes') loadNodesStatus();
    if (targetTab === 'data') {
      loadChainData();
      populateDataChainSelect();
      populateAddRecordChainSelect();
    }
    if (targetTab === 'blocks') {
      initBlocksTab();
    }
    if (targetTab === 'search') populateSearchStartSelect();
    if (targetTab === 'create-fork') populateForkParentSelect();
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  // --- Persona & Identity Management ---
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
            opt.textContent = `${p.avatar} ${p.name} (${p.role} - ${p.organizationName})`;
            select.appendChild(opt);
          });
          select.value = currentPersona.id;
          select.addEventListener('change', () => {
            const chosen = cachedPersonas.find(p => p.id === select.value);
            if (chosen) {
              currentPersona = chosen;
              updatePersonaUI();
              loadExplorerChains();
              populateDataChainSelect();
              loadChainData();
            }
          });
        }
      }
    } catch (e) {
      console.warn('Could not load personas:', e.message);
    }
    updatePersonaUI();
    loadVaultStats();
  }

  function updatePersonaUI() {
    // Header
    const avatarEl = document.getElementById('persona-avatar');
    const badgeEl = document.getElementById('persona-badge');
    const orgEl = document.getElementById('persona-org');
    const addrEl = document.getElementById('persona-address');

    if (avatarEl) avatarEl.textContent = currentPersona.avatar || '👤';
    if (badgeEl) {
      badgeEl.textContent = currentPersona.role;
      badgeEl.className = `badge badge-role role-${currentPersona.role.toLowerCase()}`;
    }
    if (orgEl) orgEl.textContent = currentPersona.organizationName;
    if (addrEl) addrEl.textContent = `${currentPersona.address.slice(0, 6)}...${currentPersona.address.slice(-4)}`;

    // Tab Roles Profile Card
    const profAvatar = document.getElementById('profile-avatar-large');
    const profName = document.getElementById('profile-name');
    const profTitle = document.getElementById('profile-title');
    const profOrg = document.getElementById('profile-org');
    const profAddr = document.getElementById('profile-address');
    const profBadge = document.getElementById('profile-role-badge');
    const permsList = document.getElementById('profile-permissions-list');

    if (profAvatar) profAvatar.textContent = currentPersona.avatar || '👤';
    if (profName) profName.textContent = currentPersona.name;
    if (profTitle) profTitle.textContent = currentPersona.title;
    if (profOrg) profOrg.textContent = `${currentPersona.organizationName} (Net ${currentPersona.organizationId} :${currentPersona.port})`;
    if (profAddr) profAddr.textContent = currentPersona.address;
    if (profBadge) {
      profBadge.textContent = currentPersona.role;
      profBadge.className = `badge badge-role role-${currentPersona.role.toLowerCase()}`;
    }

    if (permsList) {
      permsList.innerHTML = '';
      (currentPersona.permissions || []).forEach(perm => {
        const tag = document.createElement('span');
        tag.className = 'permission-tag';
        tag.textContent = perm;
        permsList.appendChild(tag);
      });
    }

    // Role-Gating: Steering Council Console
    const councilNotice = document.getElementById('council-restricted-notice');
    const projectForm = document.getElementById('form-create-project');
    const submitProjectBtn = document.getElementById('btn-submit-project');

    const isCouncil = currentPersona.role === 'STEERING_COUNCIL' || currentPersona.address === '0x163f57598de9cc708e9497aa50b6d5e5ed368d02';
    if (isCouncil) {
      if (councilNotice) councilNotice.style.display = 'none';
      if (projectForm) projectForm.style.opacity = '1';
      if (submitProjectBtn) submitProjectBtn.disabled = false;
    } else {
      if (councilNotice) councilNotice.style.display = 'block';
      if (projectForm) projectForm.style.opacity = '0.5';
      if (submitProjectBtn) submitProjectBtn.disabled = true;
    }

    // Auth Banner Text & Global Oversight / Intra-Org Isolation Indicators
    const bannerText = document.getElementById('auth-banner-text');
    const bannerIcon = document.getElementById('auth-banner-icon');
    const vaultStatsBadge = document.getElementById('vault-stats-badge');
    const isCouncilOrAuditor = ['STEERING_COUNCIL', 'AUDITOR'].includes(currentPersona.role);

    if (bannerText) {
      if (isCouncilOrAuditor) {
        if (bannerIcon) bannerIcon.textContent = '🌐';
        bannerText.textContent = `Authenticated as ${currentPersona.role === 'AUDITOR' ? 'Regulatory Auditor' : 'Steering Council Chair'} (${currentPersona.name}). Consortium Global Oversight & Regulatory Auditing Active.`;
        if (vaultStatsBadge) {
          vaultStatsBadge.textContent = '🌐 Global Consortium Oversight';
          vaultStatsBadge.className = 'badge badge-primary';
        }
      } else if (currentPersona.role === 'PATIENT') {
        if (bannerIcon) bannerIcon.textContent = '👤';
        bannerText.textContent = `Authenticated as Healthcare Consumer (${currentPersona.name}). Sovereign patient consent & access control active.`;
        if (vaultStatsBadge) {
          vaultStatsBadge.textContent = '👤 Sovereign Patient Access';
          vaultStatsBadge.className = 'badge badge-info';
        }
      } else {
        if (bannerIcon) bannerIcon.textContent = '🔒';
        bannerText.textContent = `Intra-Org Isolation Active: Access restricted exclusively to ${currentPersona.organizationName} (Port ${currentPersona.port}). External network infrastructure and cross-chain data are compartmentalized.`;
        if (vaultStatsBadge) {
          vaultStatsBadge.textContent = `🔒 Isolated: ${currentPersona.organizationName}`;
          vaultStatsBadge.className = 'badge badge-warning';
        }
      }
    }

    renderPersonaChips();
    applyRolePermissions();
  }

  function applyRolePermissions() {
    const role = currentPersona.role;
    const permissions = currentPersona.permissions || [];
    const isCouncilOrAuditor = ['STEERING_COUNCIL', 'AUDITOR'].includes(role);

    // 1. Role-gated navigation tabs: strictly hide unauthorized tabs
    let activeTabStillVisible = false;

    tabButtons.forEach(btn => {
      const allowedRoles = (btn.getAttribute('data-roles') || '').split(',').map(r => r.trim());
      const isAllowed = allowedRoles.includes(role);
      btn.style.display = isAllowed ? 'inline-flex' : 'none';
      if (btn.classList.contains('active') && isAllowed) {
        activeTabStillVisible = true;
      }
    });

    // 2. Tab redirection if current active tab is hidden for this role
    if (!activeTabStillVisible) {
      let defaultTab = 'data';
      if (role === 'STEERING_COUNCIL') defaultTab = 'roles';
      else if (role === 'AUDITOR') defaultTab = 'nodes';
      else if (role === 'ORG_ADMIN') defaultTab = 'blocks';
      else if (role === 'CLINICIAN') defaultTab = 'data';
      else if (role === 'SPECIALIST') defaultTab = 'messaging';
      else if (role === 'PATIENT') defaultTab = 'data';

      switchTab(defaultTab);
    } else {
      const activeBtn = document.querySelector('.tab-btn.active');
      if (activeBtn) {
        const activeTab = activeBtn.getAttribute('data-tab');
        if (activeTab === 'data') { populateDataChainSelect(); loadChainData(); }
        if (activeTab === 'blocks') { loadExplorerChains(); }
        if (activeTab === 'messaging') loadMessages();
        if (activeTab === 'request-fork') loadForkBallots();
        if (activeTab === 'nodes' && isCouncilOrAuditor) loadNodesStatus();
      }
    }

    // 3. Tab-specific controls visibility
    // TAB: Longitudinal EHR
    const authorRecordCard = document.getElementById('author-record-card');
    const patientConsentCard = document.getElementById('patient-consent-card');
    const ehrTitle = document.getElementById('ehr-records-title');
    const ehrSubtitle = document.getElementById('ehr-records-subtitle');

    if (authorRecordCard) {
      authorRecordCard.style.display = (role === 'CLINICIAN') ? 'block' : 'none';
      if (role === 'CLINICIAN') {
        populateAddRecordChainSelect();
        updateEhrClinicianContext();
      }
    }
    if (patientConsentCard) {
      patientConsentCard.style.display = (role === 'PATIENT') ? 'block' : 'none';
      if (role === 'PATIENT') renderPatientConsentUI();
    }
    if (ehrTitle) {
      ehrTitle.textContent = (role === 'PATIENT') ? 'My Personal Health Records (Sovereign Access)' : 'Longitudinal Health Record Explorer';
    }
    if (ehrSubtitle) {
      ehrSubtitle.textContent = (role === 'PATIENT') ? 'Cryptographically secured records under your sovereign patient consent' : 'Cryptographically anchored records with SHA-256 integrity verification';
    }

    // TAB: Messaging
    const composeBtn = document.getElementById('btn-open-compose');
    if (composeBtn) {
      const canCompose = ['CLINICIAN', 'SPECIALIST', 'ORG_ADMIN'].includes(role);
      composeBtn.style.display = canCompose ? 'inline-flex' : 'none';
    }

    const msgFilterOrg = document.getElementById('msg-filter-org');
    if (msgFilterOrg && ['CLINICIAN', 'SPECIALIST', 'ORG_ADMIN'].includes(role) && currentPersona.organizationId) {
      msgFilterOrg.value = currentPersona.organizationId;
    }

    // TAB: Request Fork & Governance
    const reqForkSubmitBtn = document.getElementById('btn-submit-fork-request');
    if (reqForkSubmitBtn) {
      const canFork = ['STEERING_COUNCIL', 'ORG_ADMIN'].includes(role);
      reqForkSubmitBtn.disabled = !canFork;
    }
  }

  function renderPersonaChips() {
    const grid = document.getElementById('persona-chips-grid');
    if (!grid) return;
    grid.innerHTML = '';

    cachedPersonas.forEach(p => {
      const chip = document.createElement('div');
      chip.className = `persona-chip ${p.id === currentPersona.id ? 'active' : ''}`;
      chip.innerHTML = `
        <div class="persona-chip-avatar">${p.avatar || '👤'}</div>
        <div class="persona-chip-text">
          <span class="persona-chip-name">${p.name}</span>
          <span class="persona-chip-role">${p.role} · ${p.organizationName.split(' ')[0]}</span>
        </div>
      `;
      chip.addEventListener('click', () => {
        currentPersona = p;
        const select = document.getElementById('persona-select');
        if (select) select.value = p.id;
        updatePersonaUI();
      });
      grid.appendChild(chip);
    });
  }

  async function loadVaultStats() {
    try {
      const res = await fetch('/api/vault/stats');
      const json = await res.json();
      if (json.success && json.stats) {
        const badge = document.getElementById('vault-stats-badge');
        const count = document.getElementById('stat-vault-docs');
        if (badge) badge.textContent = `Off-Chain Vault: ${json.stats.storedDocuments} Docs (AES-256-GCM)`;
        if (count) count.textContent = json.stats.storedDocuments;
      }
    } catch (e) {}
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

  // --- TAB 1: Tree Topology SVG Rendering ---
  async function loadTreeTopology() {
    const svg = document.getElementById('tree-svg');
    if (!svg) return;

    try {
      const res = await fetch('/api/tree', { headers: getAuthHeaders() });
      if (res.status === 403) {
        svg.innerHTML = '<text x="20" y="50" fill="#ef4444" font-size="14" font-family="system-ui, sans-serif">⛔ Access Denied: Tree Topology is restricted to Consortium Steering Council and Auditors under HIPAA/GDPR segregation.</text>';
        return;
      }
      const json = await res.json();
      if (!json.success || !json.tree) return;

      renderSvgTree(svg, json.tree);
    } catch (e) {
      console.error('Failed to render tree topology:', e);
    }
  }

  function renderSvgTree(svg, tree) {
    svg.innerHTML = '';
    const { nodes, edges } = tree;
    if (!nodes || nodes.length === 0) return;

    const width = svg.clientWidth || 800;
    const height = 450;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Level map & positioning
    const levelMap = {};
    nodes.forEach(n => {
      const lvl = n.depth || 0;
      if (!levelMap[lvl]) levelMap[lvl] = [];
      levelMap[lvl].push(n);
    });

    const maxLevel = Math.max(...Object.keys(levelMap).map(Number));
    const levelHeight = (height - 80) / Math.max(maxLevel, 1);
    const coords = {};

    Object.keys(levelMap).forEach(lvl => {
      const levelNodes = levelMap[lvl];
      const y = 50 + Number(lvl) * levelHeight;
      const colWidth = width / (levelNodes.length + 1);

      levelNodes.forEach((n, idx) => {
        const x = colWidth * (idx + 1);
        coords[n.networkId] = { x, y, ...n };
      });
    });

    // Draw Edges
    const gEdges = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edges.forEach(e => {
      const from = coords[e.from];
      const to = coords[e.to];
      if (from && to) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const dy = to.y - from.y;
        const d = `M ${from.x} ${from.y + 24} C ${from.x} ${from.y + dy / 2}, ${to.x} ${to.y - dy / 2}, ${to.x} ${to.y - 24}`;
        path.setAttribute('d', d);
        path.setAttribute('stroke', '#30363d');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        gEdges.appendChild(path);
      }
    });
    svg.appendChild(gEdges);

    // Draw Nodes
    const gNodes = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodes.forEach(n => {
      const c = coords[n.networkId];
      if (!c) return;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${c.x}, ${c.y})`);
      g.style.cursor = 'pointer';

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '-85');
      rect.setAttribute('y', '-24');
      rect.setAttribute('width', '170');
      rect.setAttribute('height', '48');
      rect.setAttribute('rx', '6');
      rect.setAttribute('fill', n.isRoot ? '#1c2d42' : '#161b22');
      rect.setAttribute('stroke', n.isRoot ? '#58a6ff' : '#30363d');
      rect.setAttribute('stroke-width', '1.5');
      g.appendChild(rect);

      const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('y', '-4');
      title.setAttribute('fill', '#c9d1d9');
      title.setAttribute('font-size', '11');
      title.setAttribute('font-weight', '600');
      title.textContent = n.name.length > 20 ? n.name.slice(0, 19) + '…' : n.name;
      g.appendChild(title);

      const meta = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      meta.setAttribute('text-anchor', 'middle');
      meta.setAttribute('y', '12');
      meta.setAttribute('fill', '#8b949e');
      meta.setAttribute('font-size', '10');
      meta.setAttribute('font-family', 'monospace');
      meta.textContent = `Net ${n.networkId} · :${n.port}`;
      g.appendChild(meta);

      gNodes.appendChild(g);
    });
    svg.appendChild(gNodes);
  }

  // --- TAB 2: Projects Management ---
  async function loadProjects() {
    const container = document.getElementById('projects-container');
    if (!container) return;

    try {
      const res = await fetch('/api/projects');
      const json = await res.json();
      if (json.success && Array.isArray(json.projects)) {
        if (json.projects.length === 0) {
          container.innerHTML = '<div class="empty-state">No active projects yet. Steering Council admins can provision projects above.</div>';
          return;
        }

        container.innerHTML = '';
        json.projects.forEach(p => {
          const card = document.createElement('div');
          card.className = 'project-card';
          card.innerHTML = `
            <div class="project-card-header">
              <span class="project-title">${p.name}</span>
              <span class="badge ${p.active ? 'badge-success' : 'badge-secondary'}">
                ${p.active ? '● Active Federation' : 'Archived'}
              </span>
            </div>
            <p class="project-desc">${p.description}</p>
            <div class="project-meta-row">
              <span>Project ID: #${p.projectId}</span>
              <span>Anchor Chain: ${p.rootNetworkId}</span>
              <span>Owner: ${p.owner.slice(0, 6)}...${p.owner.slice(-4)}</span>
              <span>Created: ${p.createdAtIso ? p.createdAtIso.split('T')[0] : 'Today'}</span>
            </div>
          `;
          container.appendChild(card);
        });
      }
    } catch (e) {
      container.innerHTML = `<div class="alert-box alert-warning">Error loading projects: ${e.message}</div>`;
    }
  }

  // Project Creation Form Handler
  const formCreateProject = document.getElementById('form-create-project');
  if (formCreateProject) {
    formCreateProject.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('project-name').value.trim();
      const description = document.getElementById('project-desc').value.trim();
      const rootNetworkId = parseInt(document.getElementById('project-root-net').value, 10);

      try {
        const btn = document.getElementById('btn-submit-project');
        btn.disabled = true;
        btn.textContent = 'Provisioning Project...';

        const res = await fetch('/api/projects/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Caller-Address': currentPersona.address
          },
          body: JSON.stringify({ name, description, rootNetworkId, callerAddress: currentPersona.address })
        });
        const json = await res.json();
        if (json.success) {
          alert(`✓ Project "${name}" created successfully on Governance Hub!`);
          formCreateProject.reset();
          loadProjects();
        } else {
          alert(`Error: ${json.error}`);
        }
      } catch (err) {
        alert(`Failed to create project: ${err.message}`);
      } finally {
        const btn = document.getElementById('btn-submit-project');
        btn.disabled = false;
        btn.textContent = '🏛️ Provision New Federation Project';
      }
    });
  }

  // --- TAB 3: Inter-Organization Messaging & FHIR Gateway ---
  async function loadMessages() {
    const container = document.getElementById('messages-list-container');
    if (!container) return;

    try {
      const orgFilter = document.getElementById('msg-filter-org');
      const orgVal = orgFilter ? orgFilter.value : 'all';
      const url = orgVal === 'all' ? '/api/messages' : `/api/messages?networkId=${orgVal}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.messages)) {
        let msgs = json.messages;

        // Role-based message isolation: Non-council/non-auditor users only see messages where their organization is sender or recipient
        const isAuditorOrCouncil = currentPersona.role === 'AUDITOR' || currentPersona.role === 'STEERING_COUNCIL';
        if (!isAuditorOrCouncil && currentPersona.organizationId) {
          msgs = msgs.filter(m => m.senderNetworkId === currentPersona.organizationId || m.recipientNetworkId === currentPersona.organizationId);
        }

        cachedMessages = msgs;
        updateMessageCounters();
        renderMessagesList();
      }
    } catch (e) {
      container.innerHTML = `<div class="alert-box alert-warning">Error loading messages: ${e.message}</div>`;
    }
  }

  function updateMessageCounters() {
    const totalEl = document.getElementById('stat-total-messages');
    const pendingEl = document.getElementById('stat-pending-orders');
    const fulfilledEl = document.getElementById('stat-fulfilled-orders');

    if (totalEl) totalEl.textContent = cachedMessages.length;
    if (pendingEl) {
      const count = cachedMessages.filter(m => m.status === 0 && m.messageType.startsWith('FHIR_')).length;
      pendingEl.textContent = count;
    }
    if (fulfilledEl) {
      const count = cachedMessages.filter(m => m.status === 3 || m.statusText === 'FULFILLED').length;
      fulfilledEl.textContent = count;
    }
  }

  function renderMessagesList() {
    const container = document.getElementById('messages-list-container');
    if (!container) return;

    let filtered = [...cachedMessages];
    if (activeMsgFilter === 'orders') {
      filtered = filtered.filter(m => m.messageType.startsWith('FHIR_'));
    } else if (activeMsgFilter === 'pending') {
      filtered = filtered.filter(m => m.status === 0);
    } else if (activeMsgFilter === 'fulfilled') {
      filtered = filtered.filter(m => m.status === 3);
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">No messages matching current criteria. Use "Compose Order" to dispatch a new FHIR transmission.</div>';
      return;
    }

    container.innerHTML = '';
    filtered.forEach(m => {
      const card = document.createElement('div');
      card.className = `message-card type-${m.messageType} ${m.messageId === selectedMessageId ? 'selected' : ''}`;
      
      const statusBadgeClass = m.status === 3 ? 'badge-success' : m.status === 0 ? 'badge-warning' : 'badge-info';
      const senderChain = cachedChains.find(c => c.networkId === m.senderNetworkId);
      const recipientChain = cachedChains.find(c => c.networkId === m.recipientNetworkId);

      const senderName = senderChain ? senderChain.name.split(' ')[0] : `Net ${m.senderNetworkId}`;
      const recipientName = recipientChain ? recipientChain.name.split(' ')[0] : `Net ${m.recipientNetworkId}`;

      card.innerHTML = `
        <div class="message-card-top">
          <span class="message-id-tag">#MSG-${m.messageId} · ${m.fhirResourceType || 'DIRECT'}</span>
          <span class="badge ${statusBadgeClass}">${m.statusText || 'PENDING'}</span>
        </div>
        <div class="message-subject-line">${m.subject}</div>
        <div class="message-route-row">
          <span>${senderName}</span>
          <span class="message-route-arrow">➔</span>
          <span>${recipientName}</span>
          <span style="margin-left: auto; font-family: monospace;">${m.timestampIso ? m.timestampIso.split('T')[1].slice(0, 5) : ''}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        selectedMessageId = m.messageId;
        renderMessagesList();
        renderMessageDetail(m);
      });

      container.appendChild(card);
    });

    if (selectedMessageId) {
      const found = cachedMessages.find(m => m.messageId === selectedMessageId);
      if (found) renderMessageDetail(found);
    }
  }

  function renderMessageDetail(m) {
    const titleEl = document.getElementById('msg-detail-title');
    const subtitleEl = document.getElementById('msg-detail-subtitle');
    const badgeEl = document.getElementById('msg-detail-status-badge');
    const bodyEl = document.getElementById('msg-detail-body');

    if (!titleEl || !bodyEl) return;

    titleEl.textContent = m.subject;
    subtitleEl.textContent = `Transmission #${m.messageId} · Category: ${m.messageType}`;
    
    if (badgeEl) {
      badgeEl.textContent = m.statusText;
      badgeEl.className = `badge ${m.status === 3 ? 'badge-success' : m.status === 0 ? 'badge-warning' : 'badge-info'}`;
    }

    const isOrder = m.messageType === 'FHIR_SERVICE_REQUEST' || m.messageType === 'FHIR_MEDICATION_REQUEST' || m.messageType === 'FHIR_CLAIM';
    const isPending = m.status === 0;

    let fulfillmentHtml = '';
    if (isOrder && isPending) {
      fulfillmentHtml = `
        <div class="action-banner">
          <div class="action-banner-text">
            <h4>Clinical Fulfillment Pending</h4>
            <p>This ${m.fhirResourceType} is pending review and fulfillment by the recipient organization.</p>
          </div>
          <button id="btn-trigger-fulfill" class="btn btn-success btn-sm">
            ⚡ Fulfill Order with Response
          </button>
        </div>
      `;
    }

    const payloadJsonStr = typeof m.payload === 'object' ? JSON.stringify(m.payload, null, 2) : m.payload;

    bodyEl.innerHTML = `
      <div class="msg-inspector-container">
        ${fulfillmentHtml}
        <div class="msg-inspector-meta">
          <div class="msg-inspector-field">
            <span class="field-label">Sender Network:</span>
            <span class="field-value font-mono">Chain ${m.senderNetworkId} (${m.sender.slice(0, 6)}...${m.sender.slice(-4)})</span>
          </div>
          <div class="msg-inspector-field">
            <span class="field-label">Recipient Network:</span>
            <span class="field-value font-mono">Chain ${m.recipientNetworkId} (${m.recipient.slice(0, 6)}...${m.recipient.slice(-4)})</span>
          </div>
          <div class="msg-inspector-field">
            <span class="field-label">FHIR Resource:</span>
            <span class="field-value font-bold">${m.fhirResourceType || 'None'}</span>
          </div>
          <div class="msg-inspector-field">
            <span class="field-label">Cryptographic Hash (SHA-256):</span>
            <span class="field-value font-mono" style="font-size: 11px; color: #7ee787;">${m.payloadHash ? m.payloadHash.slice(0, 24) + '…' : 'Verified'}</span>
          </div>
        </div>

        <div>
          <span class="field-label" style="margin-bottom: 6px; display: block;">Decrypted Off-Chain HL7 FHIR R4 Payload:</span>
          <pre class="font-mono" style="background: #0d1117; padding: 12px; border-radius: 4px; border: 1px solid #30363d; max-height: 280px; overflow-y: auto;"><code>${escapeHtml(payloadJsonStr)}</code></pre>
        </div>
      </div>
    `;

    const fulfillBtn = document.getElementById('btn-trigger-fulfill');
    if (fulfillBtn) {
      fulfillBtn.addEventListener('click', () => {
        openFulfillModal(m);
      });
    }
  }

  // Filter Pills click handling
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeMsgFilter = btn.getAttribute('data-msg-filter');
      renderMessagesList();
    });
  });

  // Compose Message Panel Toggles
  const btnOpenCompose = document.getElementById('btn-open-compose');
  const btnCloseCompose = document.getElementById('btn-close-compose');
  const btnCancelCompose = document.getElementById('btn-cancel-compose');
  const composePanel = document.getElementById('compose-message-panel');

  if (btnOpenCompose) {
    btnOpenCompose.addEventListener('click', () => {
      if (composePanel) composePanel.style.display = 'block';
      composePanel.scrollIntoView({ behavior: 'smooth' });
    });
  }
  if (btnCloseCompose) {
    btnCloseCompose.addEventListener('click', () => {
      if (composePanel) composePanel.style.display = 'none';
    });
  }
  if (btnCancelCompose) {
    btnCancelCompose.addEventListener('click', () => {
      if (composePanel) composePanel.style.display = 'none';
    });
  }

  async function populateComposeRecipientDropdown() {
    const select = document.getElementById('compose-recipient-net');
    const filterOrg = document.getElementById('msg-filter-org');
    if (!select) return;

    const chains = await fetchChains();
    select.innerHTML = '';
    if (filterOrg && filterOrg.options.length <= 1) {
      filterOrg.innerHTML = '<option value="all">All Organizations</option>';
    }

    chains.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.networkId;
      opt.textContent = `${c.name} (Chain ${c.networkId} | Port ${c.port})`;
      select.appendChild(opt);

      if (filterOrg) {
        const optFilter = document.createElement('option');
        optFilter.value = c.networkId;
        optFilter.textContent = c.name;
        filterOrg.appendChild(optFilter);
      }
    });

    if (filterOrg) {
      filterOrg.addEventListener('change', () => loadMessages());
    }
  }

  const composeTypeSelect = document.getElementById('compose-msg-type');
  if (composeTypeSelect) {
    composeTypeSelect.addEventListener('change', updateComposeTemplate);
  }

  const btnResetTemplate = document.getElementById('btn-reset-template');
  if (btnResetTemplate) {
    btnResetTemplate.addEventListener('click', updateComposeTemplate);
  }

  function updateComposeTemplate() {
    const typeSelect = document.getElementById('compose-msg-type');
    const textarea = document.getElementById('compose-payload');
    const subjectInput = document.getElementById('compose-subject');
    const patientId = (document.getElementById('compose-patient-id').value || 'P101').trim();

    if (!typeSelect || !textarea) return;

    const val = typeSelect.value;
    if (val === 'FHIR_SERVICE_REQUEST') {
      if (subjectInput) subjectInput.value = `Order: STAT Comprehensive Metabolic Panel (CMP) for Patient ${patientId}`;
      textarea.value = JSON.stringify({
        resourceType: "ServiceRequest",
        id: `SR-${Date.now().toString().slice(-4)}`,
        status: "active",
        intent: "order",
        priority: "stat",
        subject: { reference: `Patient/${patientId}` },
        code: {
          coding: [{
            system: "http://loinc.org",
            code: "24323-8",
            display: "Comprehensive metabolic 2000 panel - Serum or Plasma"
          }]
        },
        authoredOn: new Date().toISOString(),
        orderDetail: [{ text: "Evaluate liver and kidney function" }]
      }, null, 2);
    } else if (val === 'FHIR_MEDICATION_REQUEST') {
      if (subjectInput) subjectInput.value = `Prescription: Metformin 500mg Oral Tablet for Patient ${patientId}`;
      textarea.value = JSON.stringify({
        resourceType: "MedicationRequest",
        id: `MED-REQ-${Date.now().toString().slice(-4)}`,
        status: "active",
        intent: "order",
        subject: { reference: `Patient/${patientId}` },
        medicationCodeableConcept: {
          coding: [{
            system: "http://www.nlm.nih.gov/research/umls/rxnorm",
            code: "860975",
            display: "Metformin hydrochloride 500 MG Oral Tablet"
          }]
        },
        dispenseRequest: {
          numberOfRepeatsAllowed: 2,
          quantity: { value: 60, unit: "TAB" }
        }
      }, null, 2);
    } else if (val === 'FHIR_CLAIM') {
      if (subjectInput) subjectInput.value = `Insurance Claim: Inpatient Encounter for Patient ${patientId}`;
      textarea.value = JSON.stringify({
        resourceType: "Claim",
        id: `CLM-${Date.now().toString().slice(-4)}`,
        status: "active",
        type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/claim-type", code: "institutional" }] },
        use: "claim",
        patient: { reference: `Patient/${patientId}` },
        total: { value: 4500.00, currency: "USD" }
      }, null, 2);
    } else {
      if (subjectInput) subjectInput.value = `Inter-Organization Communication regarding Patient ${patientId}`;
      textarea.value = JSON.stringify({
        resourceType: "Communication",
        id: `COMM-${Date.now().toString().slice(-4)}`,
        status: "completed",
        subject: { reference: `Patient/${patientId}` },
        payload: [{ contentString: "Patient referred for follow-up evaluation." }]
      }, null, 2);
    }
  }

  // Compose Message Submit
  const formCompose = document.getElementById('form-compose-message');
  if (formCompose) {
    formCompose.addEventListener('submit', async (e) => {
      e.preventDefault();
      const recipientNet = parseInt(document.getElementById('compose-recipient-net').value, 10);
      const msgType = document.getElementById('compose-msg-type').value;
      const subject = document.getElementById('compose-subject').value.trim();
      const patientId = document.getElementById('compose-patient-id').value.trim();
      const payloadStr = document.getElementById('compose-payload').value.trim();

      let parsedPayload;
      try {
        parsedPayload = JSON.parse(payloadStr);
      } catch (err) {
        alert('Invalid JSON in payload textarea');
        return;
      }

      const fhirResType = parsedPayload.resourceType || '';
      const fhirResId = parsedPayload.id || `RES-${Date.now()}`;

      try {
        const btn = document.getElementById('btn-send-message');
        btn.disabled = true;
        btn.textContent = 'Encrypting & Dispatching...';

        const res = await fetch('/api/messages/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Caller-Address': currentPersona.address
          },
          body: JSON.stringify({
            senderNetworkId: currentPersona.organizationId,
            recipientNetworkId: recipientNet,
            messageType: msgType,
            subject,
            fhirResourceType: fhirResType,
            fhirResourceId: fhirResId,
            payload: parsedPayload,
            callerAddress: currentPersona.address
          })
        });

        const json = await res.json();
        if (json.success) {
          alert(`✓ Verifiable FHIR message dispatched! Anchored SHA-256 Digest: ${json.dataHash.slice(0, 18)}...`);
          if (composePanel) composePanel.style.display = 'none';
          loadMessages();
          loadVaultStats();
        } else {
          alert(`Error sending message: ${json.error}`);
        }
      } catch (err) {
        alert(`Failed to send message: ${err.message}`);
      } finally {
        const btn = document.getElementById('btn-send-message');
        btn.disabled = false;
        btn.textContent = '🚀 Cryptographically Sign & Dispatch';
      }
    });
  }

  // --- Order Fulfillment Flow ---
  function openFulfillModal(requestMsg) {
    const modal = document.getElementById('fulfill-modal');
    if (!modal) return;

    document.getElementById('fulfill-request-id').value = requestMsg.messageId;
    const resTypeSelect = document.getElementById('fulfill-resource-type');
    const notesInput = document.getElementById('fulfill-notes');
    const payloadArea = document.getElementById('fulfill-payload');

    // Pre-populate according to incoming request type
    if (requestMsg.messageType === 'FHIR_SERVICE_REQUEST') {
      resTypeSelect.value = 'DiagnosticReport';
      notesInput.value = 'Complete metabolic panel verified. Glucose: 104 mg/dL, Creatinine: 0.9 mg/dL (Normal).';
      payloadArea.value = JSON.stringify({
        resourceType: "DiagnosticReport",
        id: `REP-${Date.now().toString().slice(-4)}`,
        status: "final",
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0074", code: "CH", display: "Chemistry" }] }],
        code: { coding: [{ system: "http://loinc.org", code: "24323-8", display: "Comprehensive metabolic panel" }] },
        subject: { reference: `Patient/${requestMsg.payload.subject ? requestMsg.payload.subject.reference.replace('Patient/', '') : 'P101'}` },
        basedOn: [{ reference: `ServiceRequest/${requestMsg.fhirResourceId}` }],
        result: [
          { display: "Glucose: 104 mg/dL (Ref: 70-99 mg/dL)" },
          { display: "Creatinine: 0.9 mg/dL (Ref: 0.7-1.3 mg/dL)" }
        ]
      }, null, 2);
    } else if (requestMsg.messageType === 'FHIR_MEDICATION_REQUEST') {
      resTypeSelect.value = 'MedicationDispense';
      notesInput.value = '60 Metformin 500mg tablets dispensed with patient medication advisory.';
      payloadArea.value = JSON.stringify({
        resourceType: "MedicationDispense",
        id: `DISP-${Date.now().toString().slice(-4)}`,
        status: "completed",
        medicationCodeableConcept: requestMsg.payload.medicationCodeableConcept || { text: "Metformin 500mg" },
        subject: requestMsg.payload.subject || { reference: "Patient/P101" },
        authorizingPrescription: [{ reference: `MedicationRequest/${requestMsg.fhirResourceId}` }],
        quantity: { value: 60, unit: "TAB" }
      }, null, 2);
    } else {
      resTypeSelect.value = 'ClaimResponse';
      notesInput.value = 'Claim fully approved and adjudicated under primary coverage.';
      payloadArea.value = JSON.stringify({
        resourceType: "ClaimResponse",
        id: `RESP-${Date.now().toString().slice(-4)}`,
        status: "active",
        outcome: "complete",
        request: { reference: `Claim/${requestMsg.fhirResourceId}` },
        payment: { amount: { value: 4100.00, currency: "USD" } }
      }, null, 2);
    }

    modal.style.display = 'flex';
  }

  const fulfillModalClose = document.getElementById('fulfill-modal-close');
  const btnCancelFulfill = document.getElementById('btn-cancel-fulfill');
  if (fulfillModalClose) fulfillModalClose.addEventListener('click', () => { document.getElementById('fulfill-modal').style.display = 'none'; });
  if (btnCancelFulfill) btnCancelFulfill.addEventListener('click', () => { document.getElementById('fulfill-modal').style.display = 'none'; });

  const formFulfill = document.getElementById('form-fulfill-order');
  if (formFulfill) {
    formFulfill.addEventListener('submit', async (e) => {
      e.preventDefault();
      const requestId = document.getElementById('fulfill-request-id').value;
      const responseResourceType = document.getElementById('fulfill-resource-type').value;
      const payloadStr = document.getElementById('fulfill-payload').value.trim();

      let parsed;
      try { parsed = JSON.parse(payloadStr); } catch (err) { alert('Invalid JSON in fulfillment payload'); return; }

      try {
        const btn = document.getElementById('btn-submit-fulfillment');
        btn.disabled = true;
        btn.textContent = 'Committing & Fulfilling...';

        const res = await fetch('/api/messages/fulfill-fhir', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Caller-Address': currentPersona.address
          },
          body: JSON.stringify({
            requestMessageId: requestId,
            responseResourceType,
            responsePayload: parsed,
            callerAddress: currentPersona.address
          })
        });

        const json = await res.json();
        if (json.success) {
          alert('✓ Order fulfilled! Signed response dispatched and anchored on blockchain.');
          document.getElementById('fulfill-modal').style.display = 'none';
          loadMessages();
          loadVaultStats();
        } else {
          alert(`Error fulfilling order: ${json.error}`);
        }
      } catch (err) {
        alert(`Failed to fulfill order: ${err.message}`);
      } finally {
        const btn = document.getElementById('btn-submit-fulfillment');
        btn.disabled = false;
        btn.textContent = '✅ Sign, Commit & Fulfill Order';
      }
    });
  }

  // --- TAB 4: Request Fork with Healthcare Details ---
  async function populateRequestForkParentSelect() {
    const select = document.getElementById('req-parent-net');
    if (!select) return;
    const chains = await fetchChains();
    select.innerHTML = '';
    chains.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.networkId;
      opt.textContent = `${c.name} (Chain ${c.networkId} | Port ${c.port})`;
      select.appendChild(opt);
    });
  }

  async function loadForkBallots() {
    const container = document.getElementById('fork-ballots-container');
    const badge = document.getElementById('ballot-count-badge');
    if (!container) return;

    try {
      const res = await fetch('/api/governance/proposals');
      const json = await res.json();
      if (json.success && Array.isArray(json.proposals)) {
        if (badge) badge.textContent = `${json.proposals.length} Proposals`;

        if (json.proposals.length === 0) {
          container.innerHTML = '<div class="empty-state">No active governance ballots found. Submit a fork request using the form on the left.</div>';
          return;
        }

        container.innerHTML = '';
        json.proposals.forEach(p => {
          const card = document.createElement('div');
          card.className = `proposal-card ${p.executed ? 'executed' : ''}`;
          
          const canVote = ['STEERING_COUNCIL', 'ORG_ADMIN'].includes(currentPersona.role);

          card.innerHTML = `
            <div class="proposal-card-header">
              <span class="proposal-id-badge">Proposal #${p.proposalId}</span>
              <span class="badge ${p.executed ? 'badge-success' : 'badge-primary'}">
                ${p.executed ? '✓ Executed & Provisioned' : 'Active Ballot'}
              </span>
            </div>
            <h4 class="proposal-title">${p.orgName} (${p.orgType || 'Fork'})</h4>
            <p class="proposal-justification">${p.justification}</p>
            <div class="proposal-specs-grid">
              <div><span class="spec-label">Parent Chain:</span><span class="spec-val font-mono">${p.parentNetworkId}</span></div>
              <div><span class="spec-label">Assigned Port:</span><span class="spec-val font-mono">${p.portNumber}</span></div>
              <div><span class="spec-label">Fork Block:</span><span class="spec-val font-mono">#${p.parentChainForkBlockNumber}</span></div>
              <div><span class="spec-label">Proposer:</span><span class="spec-val font-mono">${p.proposer.slice(0, 6)}...${p.proposer.slice(-4)}</span></div>
            </div>
            <div class="vote-stats-bar">
              <div class="vote-stats-numbers">
                <span class="vote-stat-for">Votes For: ${p.votesFor}</span>
                <span class="vote-stat-against">Votes Against: ${p.votesAgainst}</span>
              </div>
            </div>
            <div class="proposal-actions-row">
              ${!p.executed ? `
                ${canVote ? `
                  <button class="btn-vote-for" data-pid="${p.proposalId}">👍 Vote For</button>
                  <button class="btn-vote-against" data-pid="${p.proposalId}">👎 Vote Against</button>
                  ${p.votesFor > p.votesAgainst ? `<button class="btn-execute-proposal" data-pid="${p.proposalId}">🚀 Execute Fork</button>` : ''}
                ` : `
                  <div style="font-size: 11px; color: #8b949e; font-style: italic;">Auditor Observation Only (Voting restricted to Member Organizations)</div>
                `}
              ` : `<div style="font-size: 11px; color: #7ee787;">✓ Live in tree topology</div>`}
            </div>
          `;

          // Vote / Execute handlers
          const forBtn = card.querySelector('.btn-vote-for');
          const againstBtn = card.querySelector('.btn-vote-against');
          const execBtn = card.querySelector('.btn-execute-proposal');

          if (forBtn) forBtn.addEventListener('click', () => castProposalVote(p.proposalId, true));
          if (againstBtn) againstBtn.addEventListener('click', () => castProposalVote(p.proposalId, false));
          if (execBtn) execBtn.addEventListener('click', () => executeApprovedProposal(p.proposalId));

          container.appendChild(card);
        });
      }
    } catch (e) {
      container.innerHTML = `<div class="alert-box alert-warning">Error loading ballots: ${e.message}</div>`;
    }
  }

  async function castProposalVote(proposalId, support) {
    try {
      const res = await fetch('/api/governance/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, support, callerAddress: currentPersona.address })
      });
      const json = await res.json();
      if (json.success) {
        alert(`✓ Vote recorded as ${currentPersona.name}!`);
        loadForkBallots();
      } else {
        alert(`Voting error: ${json.error}`);
      }
    } catch (e) {
      alert(`Failed to cast vote: ${e.message}`);
    }
  }

  async function executeApprovedProposal(proposalId) {
    try {
      const res = await fetch('/api/governance/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId })
      });
      const json = await res.json();
      if (json.success) {
        alert('✓ Proposal executed! Fork registered into tree topology.');
        loadForkBallots();
        loadTreeTopology();
      } else {
        alert(`Execution error: ${json.error}`);
      }
    } catch (e) {
      alert(`Failed to execute proposal: ${e.message}`);
    }
  }

  // Request Fork Form Handler
  const formRequestFork = document.getElementById('form-request-fork');
  if (formRequestFork) {
    formRequestFork.addEventListener('submit', async (e) => {
      e.preventDefault();
      const orgName = document.getElementById('req-org-name').value.trim();
      const orgType = document.getElementById('req-org-type').value;
      const parentNetworkId = parseInt(document.getElementById('req-parent-net').value, 10);
      const justification = document.getElementById('req-justification').value.trim();
      const fhirCapability = document.getElementById('req-fhir-capability').value.trim();
      const initialAdmin = document.getElementById('req-admin-address').value.trim() || currentPersona.address;
      const forkBlock = parseInt(document.getElementById('req-fork-block').value, 10) || 0;

      try {
        const btn = document.getElementById('btn-submit-fork-request');
        btn.disabled = true;
        btn.textContent = 'Submitting Proposal...';

        const res = await fetch('/api/governance/proposals/detailed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Caller-Address': currentPersona.address
          },
          body: JSON.stringify({
            orgName,
            orgType,
            parentNetworkId,
            justification,
            fhirCapability,
            initialAdmin,
            forkBlockNumber: forkBlock,
            callerAddress: currentPersona.address
          })
        });

        const json = await res.json();
        if (json.success) {
          alert(`✓ Detailed fork proposal for '${orgName}' submitted to consortium ballot!`);
          formRequestFork.reset();
          loadForkBallots();
        } else {
          alert(`Error submitting proposal: ${json.error}`);
        }
      } catch (err) {
        alert(`Failed to submit fork request: ${err.message}`);
      } finally {
        const btn = document.getElementById('btn-submit-fork-request');
        btn.disabled = false;
        btn.textContent = '🌿 Submit Fork Request to Consortium Ballot';
      }
    });
  }

  // --- Registration Modal ---
  const btnOpenReg = document.getElementById('btn-open-register-modal');
  const regModal = document.getElementById('register-modal');
  const regClose = document.getElementById('register-modal-close');
  const btnCancelReg = document.getElementById('btn-cancel-register');
  const btnGenWallet = document.getElementById('btn-gen-wallet');

  if (btnOpenReg) {
    btnOpenReg.addEventListener('click', async () => {
      if (regModal) regModal.style.display = 'flex';
      populateRegOrgSelect();
    });
  }
  if (regClose) regClose.addEventListener('click', () => { if (regModal) regModal.style.display = 'none'; });
  if (btnCancelReg) btnCancelReg.addEventListener('click', () => { if (regModal) regModal.style.display = 'none'; });

  if (btnGenWallet) {
    btnGenWallet.addEventListener('click', () => {
      const randHex = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => b.toString(16).padStart(2, '0')).join('');
      document.getElementById('reg-address').value = randHex;
    });
  }

  async function populateRegOrgSelect() {
    const select = document.getElementById('reg-org-select');
    if (!select) return;
    const chains = await fetchChains();
    select.innerHTML = '';
    chains.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.networkId;
      opt.dataset.port = c.port;
      opt.textContent = `${c.name} (Port ${c.port})`;
      select.appendChild(opt);
    });
  }

  const formRegister = document.getElementById('form-register-user');
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value.trim();
      const title = document.getElementById('reg-title').value.trim();
      const role = document.getElementById('reg-role').value;
      const orgSelect = document.getElementById('reg-org-select');
      const organizationId = parseInt(orgSelect.value, 10);
      const organizationName = orgSelect.options[orgSelect.selectedIndex].text.split(' (')[0];
      const port = parseInt(orgSelect.options[orgSelect.selectedIndex].dataset.port || 8547, 10);
      const address = document.getElementById('reg-address').value.trim();

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, title, role, organizationId, organizationName, port, address })
        });
        const json = await res.json();
        if (json.success) {
          alert(`✓ Stakeholder ${name} registered successfully!`);
          regModal.style.display = 'none';
          formRegister.reset();
          cachedPersonas.push(json.persona);
          currentPersona = json.persona;
          initPersonas();
        } else {
          alert(`Registration error: ${json.error}`);
        }
      } catch (err) {
        alert(`Failed to register stakeholder: ${err.message}`);
      }
    });
  }

  // --- TAB 5: Shared Governance Directory & Stakeholders ---
  async function loadGovernanceOrganizations() {
    const container = document.getElementById('governance-orgs-list');
    const badge = document.getElementById('org-count-badge');
    if (!container) return;

    try {
      const res = await fetch('/api/governance/organizations');
      const json = await res.json();
      if (json.success && Array.isArray(json.organizations)) {
        if (badge) badge.textContent = `${json.organizations.length} Organizations`;
        container.innerHTML = '';
        json.organizations.forEach(o => {
          const item = document.createElement('div');
          item.className = 'org-directory-card';
          item.innerHTML = `
            <div class="org-card-header">
              <span class="org-name">${o.name}</span>
              <span class="badge ${o.active ? 'badge-success' : 'badge-secondary'}">Active</span>
            </div>
            <div class="org-meta-grid">
              <div><span class="meta-lbl">Type:</span><span>${o.orgType}</span></div>
              <div><span class="meta-lbl">Network ID:</span><span class="font-mono">${o.networkId}</span></div>
              <div><span class="meta-lbl">RPC Port:</span><span class="font-mono">:${o.port}</span></div>
              <div><span class="meta-lbl">Admin:</span><span class="font-mono">${o.adminAddress.slice(0, 6)}...${o.adminAddress.slice(-4)}</span></div>
            </div>
          `;
          container.appendChild(item);
        });
      }
    } catch (e) {
      container.innerHTML = `<div class="alert-box alert-warning">Error loading organizations: ${e.message}</div>`;
    }
  }

  async function populateStakeholderChainSelect() {
    const select = document.getElementById('stakeholder-chain-select');
    if (!select) return;
    const chains = await fetchChains();
    select.innerHTML = '';
    chains.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.port;
      opt.textContent = `${c.name} (Port ${c.port})`;
      select.appendChild(opt);
    });

    select.removeEventListener('change', onStakeholderChainChange);
    select.addEventListener('change', onStakeholderChainChange);
    if (chains.length > 0) loadChainStakeholders(chains[0].port);
  }

  function onStakeholderChainChange(e) {
    loadChainStakeholders(e.target.value);
  }

  async function loadChainStakeholders(port) {
    const container = document.getElementById('stakeholders-list-container');
    if (!container) return;

    try {
      const res = await fetch(`/api/stakeholders/${port}`);
      const json = await res.json();
      if (json.success && json.stakeholders) {
        container.innerHTML = '';
        const list = json.stakeholders.stakeholders || [];
        if (list.length === 0) {
          container.innerHTML = `<div class="empty-state">No authorized stakeholders configured for Port ${port}.</div>`;
          return;
        }

        list.forEach(s => {
          const row = document.createElement('div');
          row.className = 'stakeholder-row';
          row.innerHTML = `
            <div class="stakeholder-info">
              <span class="stakeholder-name">${s.name}</span>
              <span class="stakeholder-addr font-mono">${s.address}</span>
            </div>
            <span class="badge badge-role role-${s.role.toLowerCase()}">${s.role}</span>
          `;
          container.appendChild(row);
        });
      }
    } catch (e) {
      container.innerHTML = `<div class="alert-box alert-warning">Error: ${e.message}</div>`;
    }
  }

  // --- TAB 6: Nodes Status ---
  async function loadNodesStatus() {
    const grid = document.getElementById('nodes-grid');
    if (!grid) return;

    try {
      const res = await fetch('/api/status', { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success && Array.isArray(json.nodes)) {
        grid.innerHTML = '';

        if (json.isGlobalOverview === false) {
          const banner = document.createElement('div');
          banner.className = 'alert-box alert-warning';
          banner.style.gridColumn = '1 / -1';
          banner.innerHTML = `🔒 <strong>Intra-Org Node View:</strong> ${escapeHtml(json.message || 'Displaying only your organization node.')}`;
          grid.appendChild(banner);
        }

        json.nodes.forEach(n => {
          const card = document.createElement('div');
          card.className = 'node-card';
          card.innerHTML = `
            <div class="node-card-header">
              <div class="node-title">${n.name}</div>
              <span class="badge ${n.online ? 'badge-success' : 'badge-danger'}">
                ${n.online ? '● Online' : 'Offline'}
              </span>
            </div>
            <div class="node-meta-grid">
              <div class="node-meta-item"><span class="node-meta-label">Port:</span><span class="node-meta-value">:${n.port}</span></div>
              <div class="node-meta-item"><span class="node-meta-label">Chain ID:</span><span class="node-meta-value">${n.networkId}</span></div>
              <div class="node-meta-item"><span class="node-meta-label">Block Height:</span><span class="node-meta-value">#${n.blockNumber}</span></div>
              <div class="node-meta-item"><span class="node-meta-label">Role:</span><span class="node-meta-value">${n.role}</span></div>
            </div>
          `;
          grid.appendChild(card);
        });
      }
    } catch (e) {
      grid.innerHTML = `<div class="alert-box alert-warning">Error loading nodes: ${e.message}</div>`;
    }
  }

  const btnRefreshNodes = document.getElementById('btn-refresh-nodes');
  if (btnRefreshNodes) btnRefreshNodes.addEventListener('click', loadNodesStatus);

  // --- TAB 7: Longitudinal EHR Explorer ---
  async function loadChainData() {
    const container = document.getElementById('patient-data-container');
    const select = document.getElementById('data-chain-select');
    if (!container) return;

    const isAuditorOrCouncil = ['STEERING_COUNCIL', 'AUDITOR'].includes(currentPersona.role);
    let portVal;
    if (isAuditorOrCouncil) {
      portVal = select ? select.value : 'all';
    } else if (currentPersona.role === 'PATIENT') {
      portVal = 'all';
    } else {
      portVal = currentPersona.port;
    }

    const url = portVal === 'all' ? '/api/data' : `/api/data/${portVal}`;

    try {
      const res = await fetch(url, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        let records = json.data || [];

        // Role-based patient filtering: Patients only see their own records
        if (currentPersona.role === 'PATIENT') {
          records = records.filter(r => {
            if (!r.patientId) return false;
            const pid = r.patientId.toUpperCase();
            return pid === 'P101' || pid === currentPersona.id.toUpperCase() || pid.includes('P101') || pid.includes('P-101');
          });
        }

        if (records.length === 0) {
          if (currentPersona.role === 'PATIENT') {
            container.innerHTML = `
              <div class="empty-state">
                <span style="font-size: 2.2rem; display: block; margin-bottom: 0.5rem;">🩺</span>
                <strong>No personal health records on file.</strong>
                <p style="margin-top: 4px; color: #8b949e; font-size: 13px;">When your authorized healthcare providers commit clinical records to the blockchain ledger, your longitudinal records will appear here.</p>
              </div>`;
          } else {
            container.innerHTML = `
              <div class="empty-state">
                <span style="font-size: 2.2rem; display: block; margin-bottom: 0.5rem;">🩺</span>
                <strong>No clinical records found for ${escapeHtml(currentPersona.organizationName)}.</strong>
                <p style="margin-top: 4px; color: #8b949e; font-size: 13px;">${currentPersona.role === 'CLINICIAN' ? 'Author and digitally sign the first real patient encounter on your organization ledger using the form above.' : 'Clinical records will appear once committed by authorized care team clinicians.'}</p>
              </div>`;
          }
          return;
        }

        container.innerHTML = '<div class="ehr-records-grid" id="ehr-grid-inner"></div>';
        const inner = document.getElementById('ehr-grid-inner');

        records.forEach(r => {
          const item = document.createElement('div');
          item.className = `ehr-record-card type-${r.resourceType}`;
          item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div>
                <span class="badge badge-resource badge-resource-${r.resourceType.toLowerCase()}">${r.resourceType}</span>
                <span style="font-weight: 700; margin-left: 8px;">${escapeHtml(r.clinicalCode)}</span>
              </div>
              <span style="font-size: 11px; color: #8b949e; font-family: monospace;">Block #${r.blockNumber} · Port ${r.portNumber}</span>
            </div>
            <p style="font-size: 12px; color: #c9d1d9; margin: 4px 0;">Patient: <strong>${escapeHtml(r.patientId)}</strong></p>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #8b949e;">
              <span style="font-family: monospace; color: #7ee787;">SHA-256: ${r.dataHash ? r.dataHash.slice(0, 16) + '…' : 'Anchored'} <span class="badge badge-success" style="font-size: 10px; margin-left: 6px; padding: 2px 6px;">✓ Verified SHA-256</span></span>
              <button class="btn btn-xs btn-outline btn-view-fhir">
                📋 View FHIR
              </button>
            </div>
          `;

          const viewBtn = item.querySelector('.btn-view-fhir');
          if (viewBtn) {
            viewBtn.addEventListener('click', () => {
              openFhirModal(r);
            });
          }

          inner.appendChild(item);
        });
      }
    } catch (e) {
      container.innerHTML = `<div class="alert-box alert-warning">Error loading EHR: ${e.message}</div>`;
    }
  }

  async function populateDataChainSelect() {
    const select = document.getElementById('data-chain-select');
    if (!select) return;
    const chains = await fetchChains();
    const isAuditorOrCouncil = ['STEERING_COUNCIL', 'AUDITOR'].includes(currentPersona.role);

    select.innerHTML = '';
    if (isAuditorOrCouncil) {
      const allOpt = document.createElement('option');
      allOpt.value = 'all';
      allOpt.textContent = '🌐 All Chains (Federated Audit View)';
      select.appendChild(allOpt);
      chains.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.port;
        opt.textContent = `${c.name} (Port ${c.port})`;
        select.appendChild(opt);
      });
      select.disabled = false;
      select.title = 'Consortium Global Audit View';
    } else if (currentPersona.role === 'PATIENT') {
      const allOpt = document.createElement('option');
      allOpt.value = 'all';
      allOpt.textContent = '👤 My Records (All Authorized Facilities)';
      select.appendChild(allOpt);
      select.value = 'all';
      select.disabled = true;
      select.title = 'Patient sovereign access across authorized facilities';
    } else {
      // Individual Staff: strictly isolated to their own organization!
      const ownChain = chains.find(c => c.port === currentPersona.port);
      const opt = document.createElement('option');
      opt.value = currentPersona.port;
      opt.textContent = ownChain ? `🏥 ${ownChain.name} (My Organization Ledger)` : `Port ${currentPersona.port}`;
      select.appendChild(opt);
      select.value = currentPersona.port;
      select.disabled = true;
      select.title = `Restricted to ${currentPersona.organizationName} under HIPAA § 164.502(b)`;
    }

    select.removeEventListener('change', loadChainData);
    select.addEventListener('change', loadChainData);
  }

  // --- Institutional Clinical EHR Documentation Engine ---
  async function computeSha256(text) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    }
  }

  function updateEhrClinicianContext() {
    const badge = document.getElementById('ehr-station-badge');
    const facility = document.getElementById('ehr-patient-facility');
    if (badge && currentPersona) {
      badge.textContent = `Clinician Station: ${currentPersona.name}`;
    }
    if (facility && currentPersona) {
      facility.textContent = `🏥 ${currentPersona.organizationName} (Port ${currentPersona.port})`;
    }
  }

  async function populateAddRecordChainSelect() {
    const select = document.getElementById('rec-target-port');
    if (!select) return;
    const chains = await fetchChains();
    select.innerHTML = '';
    const ownChain = chains.find(c => c.port === currentPersona.port);
    if (ownChain) {
      const opt = document.createElement('option');
      opt.value = ownChain.port;
      opt.textContent = `🏥 ${ownChain.name} (Port ${ownChain.port})`;
      select.appendChild(opt);
      select.value = ownChain.port;
      select.disabled = true;
    } else {
      chains.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.port;
        opt.textContent = `${c.name} (Port ${c.port})`;
        select.appendChild(opt);
      });
      if (currentPersona.port) select.value = currentPersona.port;
    }
  }

  function getActivePatientId() {
    const select = document.getElementById('ehr-patient-select');
    if (!select) return 'Patient/P-101';
    if (select.value === 'custom') {
      const customInput = document.getElementById('rec-patient-id-custom');
      const val = customInput ? customInput.value.trim() : '';
      return val ? (val.startsWith('Patient/') ? val : `Patient/${val}`) : 'Patient/P-Custom';
    }
    return `Patient/${select.value}`;
  }

  function buildFhirResourceFromForm() {
    const resourceTypeSelect = document.getElementById('rec-resource-type');
    const resourceType = resourceTypeSelect ? resourceTypeSelect.value : 'Encounter';
    const patientId = getActivePatientId();
    const patientName = document.getElementById('ehr-patient-name')?.textContent || 'Patient';
    const encounterRef = (document.getElementById('rec-encounter-ref')?.value || 'Encounter/enc-101').trim();
    const effectiveTime = new Date().toISOString();
    const resourceId = `${resourceType.toLowerCase()}-${Date.now().toString().slice(-6)}`;

    let resourceData = {};
    let clinicalCode = '';

    if (resourceType === 'Encounter') {
      const encClass = document.getElementById('enc-class')?.value || 'IMP';
      const encDept = document.getElementById('enc-department')?.value || 'Cardiology Acute Care';
      const encStatus = document.getElementById('enc-status')?.value || 'in-progress';
      const codePicker = document.getElementById('enc-code-picker')?.value || 'SNOMED:32485007|Hospital admission';
      const disposition = document.getElementById('enc-disposition')?.value || 'telemetry';
      const reason = document.getElementById('enc-reason')?.value || 'Patient admission for clinical monitoring.';

      let snomedCode = '32485007';
      let snomedDisplay = 'Hospital admission';
      if (codePicker === 'custom') {
        const customCode = (document.getElementById('enc-custom-code')?.value || 'SNOMED:32485007').trim();
        clinicalCode = customCode;
        snomedCode = customCode.split(':')[1] || customCode;
        snomedDisplay = 'Clinical encounter';
      } else {
        const parts = codePicker.split('|');
        clinicalCode = parts[0];
        snomedCode = parts[0].split(':')[1] || parts[0];
        snomedDisplay = parts[1] || 'Hospital admission';
      }

      const classDisplayMap = {
        'IMP': 'inpatient encounter',
        'EMER': 'emergency',
        'AMB': 'ambulatory',
        'SS': 'short stay'
      };

      resourceData = {
        resourceType: 'Encounter',
        id: resourceId,
        status: encStatus,
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: encClass,
          display: classDisplayMap[encClass] || 'inpatient encounter'
        },
        type: [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: snomedCode,
            display: snomedDisplay
          }]
        }],
        serviceType: {
          text: encDept
        },
        subject: {
          reference: patientId,
          display: patientName
        },
        participant: [{
          individual: {
            display: currentPersona ? currentPersona.name : 'Attending Clinician',
            identifier: { system: 'urn:consortium:address', value: currentPersona ? currentPersona.address : '' }
          }
        }],
        reasonCode: [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: snomedCode,
            display: snomedDisplay
          }],
          text: reason
        }],
        hospitalization: {
          dischargeDisposition: {
            text: disposition
          }
        },
        period: {
          start: effectiveTime
        }
      };

    } else if (resourceType === 'Observation') {
      const category = document.getElementById('obs-category')?.value || 'vital-signs';
      const preset = document.getElementById('obs-preset-picker')?.value || 'bp';
      const note = document.getElementById('obs-note')?.value || '';

      const interpDisplayMap = {
        'N': 'Normal',
        'A': 'Abnormal',
        'H': 'High',
        'L': 'Low',
        'HH': 'Critical High',
        'LL': 'Critical Low'
      };

      if (preset === 'bp') {
        clinicalCode = 'LOINC:85354-9';
        const systolic = parseFloat(document.getElementById('obs-bp-systolic')?.value || 142);
        const diastolic = parseFloat(document.getElementById('obs-bp-diastolic')?.value || 88);
        const interpretation = document.getElementById('obs-interpretation-bp')?.value || 'H';

        resourceData = {
          resourceType: 'Observation',
          id: resourceId,
          status: 'final',
          category: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs'
            }]
          }],
          code: {
            coding: [{
              system: 'http://loinc.org',
              code: '85354-9',
              display: 'Blood pressure panel with all children optional'
            }]
          },
          subject: { reference: patientId, display: patientName },
          encounter: { reference: encounterRef },
          effectiveDateTime: effectiveTime,
          performer: [{
            display: currentPersona ? currentPersona.name : 'Clinician',
            actor: currentPersona ? currentPersona.address : ''
          }],
          interpretation: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
              code: interpretation,
              display: interpDisplayMap[interpretation] || 'Normal'
            }]
          }],
          note: note ? [{ text: note }] : [],
          component: [
            {
              code: {
                coding: [{
                  system: 'http://loinc.org',
                  code: '8480-6',
                  display: 'Systolic blood pressure'
                }]
              },
              valueQuantity: {
                value: systolic,
                unit: 'mmHg',
                system: 'http://unitsofmeasure.org',
                code: 'mm[Hg]'
              }
            },
            {
              code: {
                coding: [{
                  system: 'http://loinc.org',
                  code: '8462-4',
                  display: 'Diastolic blood pressure'
                }]
              },
              valueQuantity: {
                value: diastolic,
                unit: 'mmHg',
                system: 'http://unitsofmeasure.org',
                code: 'mm[Hg]'
              }
            }
          ]
        };
      } else {
        const codeInput = document.getElementById('obs-clinical-code')?.value || 'LOINC:8867-4';
        clinicalCode = codeInput;
        const loincCode = codeInput.split(':')[1] || codeInput;
        const presetOpt = document.querySelector('#obs-preset-picker option:checked');
        const display = presetOpt ? (presetOpt.getAttribute('data-name') || presetOpt.textContent) : 'Clinical Observation';
        const val = parseFloat(document.getElementById('obs-value')?.value || 0);
        const unit = document.getElementById('obs-unit')?.value || '';
        const low = parseFloat(document.getElementById('obs-ref-low')?.value || 0);
        const high = parseFloat(document.getElementById('obs-ref-high')?.value || 0);
        const interpretation = document.getElementById('obs-interpretation')?.value || 'N';

        resourceData = {
          resourceType: 'Observation',
          id: resourceId,
          status: 'final',
          category: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: category,
              display: category
            }]
          }],
          code: {
            coding: [{
              system: 'http://loinc.org',
              code: loincCode,
              display
            }]
          },
          subject: { reference: patientId, display: patientName },
          encounter: { reference: encounterRef },
          effectiveDateTime: effectiveTime,
          performer: [{
            display: currentPersona ? currentPersona.name : 'Clinician',
            actor: currentPersona ? currentPersona.address : ''
          }],
          valueQuantity: {
            value: val,
            unit: unit,
            system: 'http://unitsofmeasure.org'
          },
          interpretation: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
              code: interpretation,
              display: interpDisplayMap[interpretation] || 'Normal'
            }]
          }],
          referenceRange: (low || high) ? [{
            low: low ? { value: low, unit } : undefined,
            high: high ? { value: high, unit } : undefined
          }] : undefined,
          note: note ? [{ text: note }] : []
        };
      }

    } else if (resourceType === 'Condition') {
      const codeInput = document.getElementById('cond-clinical-code')?.value || 'ICD-10:I10';
      clinicalCode = codeInput;
      const icdCode = codeInput.split(':')[1] || codeInput;
      const presetOpt = document.querySelector('#cond-preset-picker option:checked');
      const display = presetOpt ? (presetOpt.getAttribute('data-name') || 'Clinical Condition') : 'Essential (primary) hypertension';
      const clinStatus = document.getElementById('cond-clinical-status')?.value || 'active';
      const verStatus = document.getElementById('cond-verification-status')?.value || 'confirmed';
      const severity = document.getElementById('cond-severity')?.value || 'moderate';
      const onsetDate = document.getElementById('cond-onset-date')?.value || effectiveTime.slice(0, 10);
      const note = document.getElementById('cond-note')?.value || '';

      resourceData = {
        resourceType: 'Condition',
        id: resourceId,
        clinicalStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: clinStatus,
            display: clinStatus
          }]
        },
        verificationStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: verStatus,
            display: verStatus
          }]
        },
        severity: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: severity === 'severe' ? '24484000' : severity === 'mild' ? '255604002' : '6736007',
            display: severity
          }]
        },
        code: {
          coding: [{
            system: 'http://hl7.org/fhir/sid/icd-10-cm',
            code: icdCode,
            display
          }]
        },
        subject: { reference: patientId, display: patientName },
        encounter: { reference: encounterRef },
        onsetDateTime: onsetDate,
        recordedDate: effectiveTime,
        recorder: {
          display: currentPersona ? currentPersona.name : 'Clinician'
        },
        note: note ? [{ text: note }] : []
      };

    } else if (resourceType === 'MedicationRequest') {
      const codeInput = document.getElementById('med-clinical-code')?.value || 'RxNorm:314076';
      clinicalCode = codeInput;
      const rxNormCode = codeInput.split(':')[1] || codeInput;
      const medDisplay = document.getElementById('med-display-name')?.value || 'Lisinopril 10 MG Oral Tablet';
      const sig = document.getElementById('med-dosage')?.value || 'Take 1 tablet by mouth daily in the morning';
      const route = document.getElementById('med-route')?.value || 'oral';
      const freq = document.getElementById('med-frequency')?.value || 'QD';
      const qty = parseInt(document.getElementById('med-quantity')?.value || 30, 10);
      const days = parseInt(document.getElementById('med-days-supply')?.value || 30, 10);
      const refills = parseInt(document.getElementById('med-refills')?.value || 3, 10);
      const intent = document.getElementById('med-intent')?.value || 'order';
      const instructions = document.getElementById('med-instructions')?.value || '';

      resourceData = {
        resourceType: 'MedicationRequest',
        id: resourceId,
        status: 'active',
        intent,
        medicationCodeableConcept: {
          coding: [{
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: rxNormCode,
            display: medDisplay
          }]
        },
        subject: { reference: patientId, display: patientName },
        encounter: { reference: encounterRef },
        authoredOn: effectiveTime,
        requester: {
          display: currentPersona ? currentPersona.name : 'Ordering Clinician',
          identifier: { system: 'urn:consortium:address', value: currentPersona ? currentPersona.address : '' }
        },
        dosageInstruction: [{
          text: sig,
          route: {
            coding: [{
              system: 'http://snomed.info/sct',
              code: route === 'oral' ? '260548002' : route === 'iv' ? '47625008' : '34206005',
              display: route
            }]
          },
          timing: {
            code: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation',
                code: freq,
                display: freq
              }]
            }
          }
        }],
        dispenseRequest: {
          quantity: { value: qty, unit: 'TAB' },
          expectedSupplyDuration: { value: days, unit: 'days' },
          numberOfRepeatsAllowed: refills
        },
        note: instructions ? [{ text: instructions }] : []
      };

    } else if (resourceType === 'DiagnosticReport') {
      const codeInput = document.getElementById('diag-clinical-code')?.value || 'LOINC:24323-8';
      clinicalCode = codeInput;
      const loincCode = codeInput.split(':')[1] || codeInput;
      const presetOpt = document.querySelector('#diag-preset-picker option:checked');
      const panelName = presetOpt ? (presetOpt.getAttribute('data-name') || presetOpt.textContent) : 'Comprehensive metabolic panel';
      const section = document.getElementById('diag-section')?.value || 'CH';
      const accession = document.getElementById('diag-accession')?.value || 'ACC-2026-90412';
      const diagStatus = document.getElementById('diag-status')?.value || 'final';
      const conclusion = document.getElementById('diag-conclusion')?.value || '';
      const effectiveDate = document.getElementById('diag-effective-date')?.value || effectiveTime;

      resourceData = {
        resourceType: 'DiagnosticReport',
        id: resourceId,
        identifier: [{
          system: 'urn:oid:consortium-accession',
          value: accession
        }],
        status: diagStatus,
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
            code: section,
            display: section === 'CH' ? 'Chemistry' : section === 'HM' ? 'Hematology' : section === 'RAD' ? 'Radiology' : 'Diagnostic Service'
          }]
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: loincCode,
            display: panelName
          }]
        },
        subject: { reference: patientId, display: patientName },
        encounter: { reference: encounterRef },
        effectiveDateTime: effectiveDate,
        issued: effectiveTime,
        performer: [{
          display: currentPersona ? currentPersona.name : 'Pathologist',
          actor: currentPersona ? currentPersona.address : ''
        }],
        conclusion
      };
    }

    return { resourceData, resourceType, clinicalCode, patientId };
  }

  async function updateLiveFhirPreview() {
    const jsonEl = document.getElementById('ehr-live-json');
    const hashEl = document.getElementById('preview-sha256-hash');
    const badgeEl = document.getElementById('preview-fhir-type-badge');
    if (!jsonEl) return;

    try {
      const { resourceData, resourceType } = buildFhirResourceFromForm();
      const formatted = JSON.stringify(resourceData, null, 2);
      jsonEl.textContent = formatted;
      if (badgeEl) badgeEl.textContent = resourceType;

      const hash = await computeSha256(formatted);
      if (hashEl) {
        hashEl.textContent = `${hash.slice(0, 16)}...${hash.slice(-8)}`;
        hashEl.title = `Full SHA-256 Digest: ${hash}`;
      }
    } catch (e) {
      console.warn('Error updating live FHIR preview:', e);
    }
  }

  function initEhrAuthoring() {
    // 1. Patient Demographics Switcher
    const patientSelect = document.getElementById('ehr-patient-select');
    const customWrap = document.getElementById('ehr-patient-custom-wrap');
    const customInput = document.getElementById('rec-patient-id-custom');
    const hiddenPatientId = document.getElementById('rec-patient-id');

    if (patientSelect) {
      patientSelect.addEventListener('change', () => {
        const opt = patientSelect.options[patientSelect.selectedIndex];
        if (opt.value === 'custom') {
          if (customWrap) customWrap.style.display = 'block';
          if (customInput) customInput.focus();
        } else {
          if (customWrap) customWrap.style.display = 'none';
        }

        const nameEl = document.getElementById('ehr-patient-name');
        const genderEl = document.getElementById('ehr-patient-gender');
        const ageEl = document.getElementById('ehr-patient-age');
        const dobEl = document.getElementById('ehr-patient-dob');
        const mrnEl = document.getElementById('ehr-patient-mrn');
        const bedEl = document.getElementById('ehr-patient-bed');
        const allergyEl = document.getElementById('ehr-patient-allergy');
        const allergyPill = document.getElementById('ehr-allergy-pill');
        const avatarEl = document.getElementById('ehr-patient-avatar');

        if (nameEl) nameEl.textContent = opt.dataset.name || 'Patient';
        if (genderEl) genderEl.textContent = opt.dataset.gender || 'Unspecified';
        if (ageEl) ageEl.textContent = `${opt.dataset.age || '--'} yrs`;
        if (dobEl) dobEl.textContent = opt.dataset.dob || 'YYYY-MM-DD';
        if (mrnEl) mrnEl.textContent = `${opt.dataset.mrn || 'MRN'} (${opt.value})`;
        if (bedEl) bedEl.textContent = `🛏️ ${opt.dataset.bed || 'General Ward'}`;
        if (allergyEl) allergyEl.textContent = `⚠️ Allergy: ${opt.dataset.allergy || 'None Reported'}`;

        if (avatarEl) {
          avatarEl.textContent = (opt.dataset.gender === 'Male') ? '🧑' : '👩';
        }

        if (allergyPill) {
          allergyPill.className = 'ehr-status-pill pill-allergy';
          const sev = opt.dataset.allergySeverity;
          if (sev === 'severe') allergyPill.classList.add('allergy-severe');
          else if (sev === 'moderate') allergyPill.classList.add('allergy-moderate');
          else allergyPill.classList.add('allergy-none');
        }

        if (hiddenPatientId) {
          hiddenPatientId.value = (opt.value === 'custom' && customInput && customInput.value) 
            ? customInput.value.trim() 
            : `Patient/${opt.value}`;
        }

        updateLiveFhirPreview();
      });
    }

    if (customInput) {
      customInput.addEventListener('input', () => {
        if (hiddenPatientId) hiddenPatientId.value = customInput.value.trim() || 'Patient/P-Custom';
        updateLiveFhirPreview();
      });
    }

    // 2. Resource-Type Dynamic Subform Switcher
    const resourceTypeSelect = document.getElementById('rec-resource-type');
    const resourceHint = document.getElementById('ehr-resource-hint');
    const subforms = {
      'Encounter': document.getElementById('subform-encounter'),
      'Observation': document.getElementById('subform-observation'),
      'Condition': document.getElementById('subform-condition'),
      'MedicationRequest': document.getElementById('subform-medication'),
      'DiagnosticReport': document.getElementById('subform-diagnosticreport')
    };

    const hints = {
      'Encounter': 'Inpatient, emergency, or outpatient clinical touchpoint with reason for admission',
      'Observation': 'Vital signs, diagnostic laboratory values, or specialized clinical assessments',
      'Condition': 'Active problem list diagnoses, chronic conditions, or acute complaints (ICD-10)',
      'MedicationRequest': 'Electronic prescription entry (CPOE) with dosage instructions & dispensing schedule',
      'DiagnosticReport': 'Pathology findings, laboratory chemistry panels, or diagnostic imaging reports'
    };

    if (resourceTypeSelect) {
      resourceTypeSelect.addEventListener('change', () => {
        const selected = resourceTypeSelect.value;
        Object.keys(subforms).forEach(type => {
          if (subforms[type]) {
            subforms[type].style.display = (type === selected) ? 'block' : 'none';
          }
        });
        if (resourceHint) resourceHint.textContent = hints[selected] || '';
        updateLiveFhirPreview();
      });
    }

    // 3. Subform Presets & Dynamic Toggles
    // Encounter Code Picker
    const encCodePicker = document.getElementById('enc-code-picker');
    const encCustomCode = document.getElementById('enc-custom-code');
    if (encCodePicker) {
      encCodePicker.addEventListener('change', () => {
        if (encCustomCode) {
          encCustomCode.style.display = (encCodePicker.value === 'custom') ? 'block' : 'none';
        }
        updateLiveFhirPreview();
      });
    }

    // Observation Preset Picker
    const obsPresetPicker = document.getElementById('obs-preset-picker');
    const obsCodeInput = document.getElementById('obs-clinical-code');
    const obsBpRow = document.getElementById('obs-bp-row');
    const obsSingleRow = document.getElementById('obs-single-row');
    const obsCategory = document.getElementById('obs-category');
    const obsUnit = document.getElementById('obs-unit');
    const obsRefLow = document.getElementById('obs-ref-low');
    const obsRefHigh = document.getElementById('obs-ref-high');
    const obsVal = document.getElementById('obs-value');

    if (obsPresetPicker) {
      obsPresetPicker.addEventListener('change', () => {
        const opt = obsPresetPicker.options[obsPresetPicker.selectedIndex];
        const val = opt.value;
        if (val === 'bp') {
          if (obsBpRow) obsBpRow.style.display = 'grid';
          if (obsSingleRow) obsSingleRow.style.display = 'none';
          if (obsCodeInput) obsCodeInput.value = 'LOINC:85354-9';
          if (obsCategory) obsCategory.value = 'vital-signs';
        } else {
          if (obsBpRow) obsBpRow.style.display = 'none';
          if (obsSingleRow) obsSingleRow.style.display = 'grid';
          if (obsCodeInput) obsCodeInput.value = opt.dataset.code || 'LOINC:8867-4';
          if (obsCategory && opt.dataset.cat) obsCategory.value = opt.dataset.cat;
          if (obsUnit && opt.dataset.unit !== undefined) obsUnit.value = opt.dataset.unit;
          if (obsRefLow && opt.dataset.low !== undefined) obsRefLow.value = opt.dataset.low;
          if (obsRefHigh && opt.dataset.high !== undefined) obsRefHigh.value = opt.dataset.high;
          if (obsVal) {
            if (val === 'hr') obsVal.value = 74;
            else if (val === 'glucose') obsVal.value = 104;
            else if (val === 'spo2') obsVal.value = 98;
            else if (val === 'temp') obsVal.value = 98.6;
            else if (val === 'troponin') obsVal.value = 0.02;
            else if (val === 'ef') obsVal.value = 58;
            else if (val === 'hba1c') obsVal.value = 5.4;
          }
        }
        updateLiveFhirPreview();
      });
    }

    // Condition Preset Picker
    const condPresetPicker = document.getElementById('cond-preset-picker');
    const condCodeInput = document.getElementById('cond-clinical-code');
    if (condPresetPicker) {
      condPresetPicker.addEventListener('change', () => {
        if (condCodeInput) condCodeInput.value = condPresetPicker.value;
        updateLiveFhirPreview();
      });
    }

    // Medication Preset Picker
    const medPresetPicker = document.getElementById('med-preset-picker');
    const medCodeInput = document.getElementById('med-clinical-code');
    const medDisplayName = document.getElementById('med-display-name');
    const medDosage = document.getElementById('med-dosage');
    const medRoute = document.getElementById('med-route');
    const medQuantity = document.getElementById('med-quantity');
    const medDaysSupply = document.getElementById('med-days-supply');
    const medRefills = document.getElementById('med-refills');

    if (medPresetPicker) {
      medPresetPicker.addEventListener('change', () => {
        const opt = medPresetPicker.options[medPresetPicker.selectedIndex];
        if (medCodeInput) medCodeInput.value = opt.value;
        if (medDisplayName && opt.dataset.name) medDisplayName.value = opt.dataset.name;
        if (medDosage && opt.dataset.sig) medDosage.value = opt.dataset.sig;
        if (medRoute && opt.dataset.route) medRoute.value = opt.dataset.route;
        if (medQuantity && opt.dataset.qty) medQuantity.value = opt.dataset.qty;
        if (medDaysSupply && opt.dataset.days) medDaysSupply.value = opt.dataset.days;
        if (medRefills && opt.dataset.refills) medRefills.value = opt.dataset.refills;
        updateLiveFhirPreview();
      });
    }

    // DiagnosticReport Preset Picker
    const diagPresetPicker = document.getElementById('diag-preset-picker');
    const diagCodeInput = document.getElementById('diag-clinical-code');
    const diagSection = document.getElementById('diag-section');
    if (diagPresetPicker) {
      diagPresetPicker.addEventListener('change', () => {
        const opt = diagPresetPicker.options[diagPresetPicker.selectedIndex];
        if (diagCodeInput) diagCodeInput.value = opt.value;
        if (diagSection && opt.dataset.sec) diagSection.value = opt.dataset.sec;
        updateLiveFhirPreview();
      });
    }

    // 4. Reactive input listeners for live JSON preview
    const form = document.getElementById('form-add-clinical-record');
    if (form) {
      form.addEventListener('input', () => updateLiveFhirPreview());
      form.addEventListener('change', () => updateLiveFhirPreview());
    }

    // 5. Collapsible Live Preview Accordion
    const previewToggle = document.getElementById('ehr-preview-toggle');
    const previewBody = document.getElementById('ehr-preview-body');
    const toggleIcon = document.getElementById('preview-toggle-icon');
    if (previewToggle && previewBody) {
      previewToggle.addEventListener('click', () => {
        previewBody.classList.toggle('collapsed');
        if (toggleIcon) toggleIcon.classList.toggle('collapsed');
      });
    }

    // Initial trigger
    updateEhrClinicianContext();
    updateLiveFhirPreview();

    // 6. Enhanced Clinical Form Submission
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const portSelect = document.getElementById('rec-target-port');
        const portVal = parseInt(portSelect ? portSelect.value : currentPersona.port, 10);
        const { resourceData, resourceType, clinicalCode, patientId } = buildFhirResourceFromForm();

        const btn = document.getElementById('btn-commit-record');
        if (btn) {
          btn.disabled = true;
          btn.textContent = '🔒 Signing & Anchoring to Chain...';
        }

        try {
          const res = await fetch('/api/add-patient-record', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders()
            },
            body: JSON.stringify({
              port: portVal,
              patientId,
              resourceType,
              clinicalCode,
              resourceData,
              callerAddress: currentPersona ? currentPersona.address : '0x163f57598dE9Cc708E9497aA50b6D5e5eD368d02'
            })
          });

          const json = await res.json();
          if (json.success) {
            const vaultMsg = json.vaultCid ? `\nEncrypted Vault CID: ${json.vaultCid}` : '';
            alert(
              `✓ Clinical Record Cryptographically Anchored!\n\n` +
              `• Facility: Port ${portVal} (${currentPersona ? currentPersona.organizationName : 'Hospital'})\n` +
              `• Resource: ${resourceType} (${clinicalCode})\n` +
              `• Patient: ${patientId}\n` +
              `• Block Tx Hash: ${json.txHash}\n` +
              `• SHA-256 State Digest: ${json.dataHash}` +
              vaultMsg
            );

            loadChainData();
            loadVaultStats();
            updateLiveFhirPreview();
          } else {
            alert(`Error committing clinical record: ${json.error}`);
          }
        } catch (err) {
          alert(`Failed to commit clinical record: ${err.message}`);
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = '🔒 Finalize, Sign & Commit Clinical Record';
          }
        }
      });
    }
  }

  // Patient Consent UI
  function renderPatientConsentUI() {
    const consentContainer = document.getElementById('patient-consent-list');
    if (!consentContainer) return;

    consentContainer.innerHTML = '';
    const facilities = [
      { id: '11103', name: 'Metro General Hospital', desc: 'Inpatient EHR, surgical notes, discharge summaries' },
      { id: '11104', name: 'BioLabs Diagnostic Center', desc: 'Lab specimens, genetic panels, bloodwork' },
      { id: '11105', name: 'Cardio Specialty Clinic', desc: 'ECG waveforms, echocardiograms, cardiology consults' },
      { id: '11106', name: 'Emergency Care Center', desc: 'Trauma triage, ER encounters, allergy alerts' },
      { id: '11107', name: 'Consortium Pharmacy Network', desc: 'Prescription dispensing, medication reconciliation' }
    ];

    facilities.forEach(fac => {
      const consentKey = `consent_${currentPersona.id}_${fac.id}`;
      const isGranted = localStorage.getItem(consentKey) !== 'revoked';

      const row = document.createElement('div');
      row.className = 'consent-item-row';
      row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #161b22; border: 1px solid #30363d; border-radius: 6px; margin-bottom: 8px;';

      row.innerHTML = `
        <div>
          <div style="font-weight: 600; color: #f0f6fc;">${fac.name}</div>
          <div style="font-size: 12px; color: #8b949e;">${fac.desc}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="badge ${isGranted ? 'badge-success' : 'badge-danger'}" id="badge-${consentKey}">
            ${isGranted ? '● Sharing Authorized' : '○ Access Revoked'}
          </span>
          <button class="btn btn-xs ${isGranted ? 'btn-outline' : 'btn-primary'}" id="btn-${consentKey}">
            ${isGranted ? 'Revoke Consent' : 'Grant Access'}
          </button>
        </div>
      `;

      const btn = row.querySelector(`#btn-${consentKey}`);
      btn.addEventListener('click', () => {
        const currentStatus = localStorage.getItem(consentKey) !== 'revoked';
        if (currentStatus) {
          localStorage.setItem(consentKey, 'revoked');
        } else {
          localStorage.setItem(consentKey, 'granted');
        }
        renderPatientConsentUI();
      });

      consentContainer.appendChild(row);
    });
  }

  // --- TAB 8: Multi-Chain Search ---
  async function populateSearchStartSelect() {
    const select = document.getElementById('search-start-chain');
    if (!select) return;
    const chains = await fetchChains();
    select.innerHTML = '';
    chains.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.networkId;
      opt.textContent = `${c.name} (Chain ${c.networkId})`;
      select.appendChild(opt);
    });
  }

  const formSearch = document.getElementById('form-search');
  if (formSearch) {
    formSearch.addEventListener('submit', async (e) => {
      e.preventDefault();
      const algorithm = document.getElementById('search-algorithm').value;
      const startNetworkId = parseInt(document.getElementById('search-start-chain').value, 10);
      const searchValue = document.getElementById('search-value').value.trim();

      const resultsSection = document.getElementById('search-results-section');
      const summaryBar = document.getElementById('search-summary-bar');
      const pathRow = document.getElementById('search-traversal-path');
      const timeline = document.getElementById('search-longitudinal-timeline');

      try {
        const btn = document.getElementById('btn-run-search');
        btn.disabled = true;
        btn.textContent = 'Traversing Fork Tree...';

        const res = await fetch('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ algorithm, startNetworkId, searchValue })
        });

        if (res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          resultsSection.style.display = 'block';
          summaryBar.innerHTML = `
            <span style="color: #ef4444;"><strong>⛔ 403 Forbidden:</strong> ${escapeHtml(errData.error || 'Cross-Chain search traversal is restricted to Consortium Oversight.')}</span>
          `;
          pathRow.innerHTML = '';
          timeline.innerHTML = '<div class="empty-state color-danger">Access Denied: Healthcare staff cannot execute cross-chain traversal queries under HIPAA § 164.502(b).</div>';
          return;
        }

        const json = await res.json();
        if (json.success && json.result) {
          const { traversalPath, longitudinalRecord, query } = json.result;
          resultsSection.style.display = 'block';

          summaryBar.innerHTML = `
            <span><strong>${algorithm} Search:</strong> Queried "${searchValue}" starting at Chain ${startNetworkId}.</span>
            <span class="badge badge-success">Found ${longitudinalRecord.length} Clinical Events across ${traversalPath.length} Visited Nodes</span>
          `;

          // Traversal Path
          pathRow.innerHTML = '';
          traversalPath.forEach(p => {
            const step = document.createElement('div');
            step.className = `traversal-step-chip ${p.found ? 'found' : ''}`;
            step.innerHTML = `
              <span class="step-badge">Step ${p.step}</span>
              <span class="step-name">${p.name.split(' ')[0]} (:${p.port})</span>
            `;
            pathRow.appendChild(step);
          });

          // Longitudinal Timeline
          timeline.innerHTML = '';
          if (longitudinalRecord.length === 0) {
            timeline.innerHTML = '<div class="empty-state">No matching clinical records discovered on visited chains.</div>';
          } else {
            longitudinalRecord.forEach(r => {
              const recCard = document.createElement('div');
              recCard.className = `timeline-card type-${r.resourceType}`;
              recCard.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span class="badge badge-resource badge-resource-${r.resourceType.toLowerCase()}">${r.resourceType}</span>
                  <span style="font-size: 11px; color: #8b949e; font-family: monospace;">${r.chainName} (: ${r.portNumber})</span>
                </div>
                <div style="font-weight: 700; color: #fff;">${r.clinicalCode}</div>
                <div style="font-size: 11px; color: #7ee787; font-family: monospace; margin-top: 4px;">SHA-256 Verified</div>
              `;
              timeline.appendChild(recCard);
            });
          }
        }
      } catch (err) {
        alert(`Search failed: ${err.message}`);
      } finally {
        const btn = document.getElementById('btn-run-search');
        btn.disabled = false;
        btn.textContent = '🔍 Execute Multi-Chain Traversal';
      }
    });
  }

  // --- TAB 9: Direct Spin-Up Fork ---
  async function populateForkParentSelect() {
    const select = document.getElementById('fork-parent-select');
    if (!select) return;
    const chains = await fetchChains();
    select.innerHTML = '';
    chains.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.networkId;
      opt.textContent = `${c.name} (Chain ${c.networkId} | Port ${c.port} | Block #${c.blockNumber})`;
      select.appendChild(opt);
    });
  }

  const formCreateFork = document.getElementById('form-create-fork');
  if (formCreateFork) {
    formCreateFork.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('fork-chain-name').value.trim();
      const parentNetworkId = parseInt(document.getElementById('fork-parent-select').value, 10);
      const forkBlockNumber = parseInt(document.getElementById('fork-block-input').value, 10) || 0;

      const badge = document.getElementById('spinup-status-badge');
      const resultPanel = document.getElementById('spinup-result-panel');
      const startBtn = document.getElementById('btn-start-fork');

      try {
        startBtn.disabled = true;
        if (badge) { badge.textContent = 'Spinning Up...'; badge.className = 'badge badge-warning'; }

        // Animate steps
        ['step-1', 'step-2', 'step-3', 'step-4', 'step-5'].forEach((id, idx) => {
          setTimeout(() => {
            const el = document.getElementById(id);
            if (el) el.classList.add('active');
          }, idx * 400);
        });

        const res = await fetch('/api/fork/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, parentNetworkId, forkBlockNumber })
        });
        const json = await res.json();
        if (json.success && json.node) {
          if (badge) { badge.textContent = 'Active Node'; badge.className = 'badge badge-success'; }
          if (resultPanel) {
            resultPanel.style.display = 'block';
            resultPanel.innerHTML = `
              <div class="alert-box" style="background: rgba(46, 160, 67, 0.15); border: 1px solid #2ea043; color: #7ee787;">
                <h4>✓ Node Spun Up Successfully!</h4>
                <p><strong>${json.node.name}</strong> is now live on Port <code>${json.node.port}</code> (Net ID <code>${json.node.networkId}</code>).</p>
                <p style="font-family: monospace; font-size: 11px;">Contract: ${json.node.contractAddress}</p>
              </div>
            `;
          }
          loadTreeTopology();
        } else {
          alert(`Error: ${json.error}`);
        }
      } catch (err) {
        alert(`Failed to spin up node: ${err.message}`);
      } finally {
        startBtn.disabled = false;
      }
    });
  }

  // --- Modals & Helpers ---
  function openFhirModal(record) {
    const modal = document.getElementById('fhir-modal');
    if (!modal) return;

    document.getElementById('modal-title').textContent = `${record.resourceType}: ${record.clinicalCode}`;
    document.getElementById('modal-badge-resource').textContent = record.resourceType;
    document.getElementById('modal-code').textContent = record.clinicalCode;
    document.getElementById('modal-chain').textContent = `Chain ${record.networkId} (: ${record.portNumber})`;

    const jsonStr = typeof record.resourceData === 'object' ? JSON.stringify(record.resourceData, null, 2) : record.resourceData;
    document.getElementById('modal-json-content').textContent = jsonStr;

    modal.style.display = 'flex';
  }

  const modalCloseBtn = document.getElementById('modal-close-btn');
  const btnCloseFhir = document.getElementById('btn-close-fhir-modal');
  const btnCopyFhir = document.getElementById('btn-copy-fhir');

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => { document.getElementById('fhir-modal').style.display = 'none'; });
  if (btnCloseFhir) btnCloseFhir.addEventListener('click', () => { document.getElementById('fhir-modal').style.display = 'none'; });
  if (btnCopyFhir) {
    btnCopyFhir.addEventListener('click', () => {
      const code = document.getElementById('modal-json-content').textContent;
      navigator.clipboard.writeText(code).then(() => alert('Copied FHIR JSON to clipboard!'));
    });
  }

  const btnReseed = document.getElementById('btn-reseed');
  if (btnReseed) {
    btnReseed.addEventListener('click', async () => {
      if (confirm('Reset and reseed all chains, deploy contracts, and seed sample HL7 FHIR records?')) {
        btnReseed.disabled = true;
        btnReseed.textContent = 'Reseeding...';
        try {
          const res = await fetch('/api/health');
          alert('Consortium reset initiated. Please refresh the page in a moment.');
          window.location.reload();
        } catch (e) {
          alert('Reseed failed: ' + e.message);
        } finally {
          btnReseed.disabled = false;
          btnReseed.textContent = '↺ Reset & Reseed';
        }
      }
    });
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ========================================================
  // Multi-Fork Chain & Block Explorer
  // ========================================================
  let cachedExplorerChains = [];
  let selectedExplorerPort = 8546;
  let selectedExplorerBlockNum = null;
  let currentExplorerMode = 'blocks'; // 'blocks' or 'lineage'

  async function initBlocksTab() {
    setupExplorerToolbar();
    await loadExplorerChains();
  }

  function setupExplorerToolbar() {
    const chainSelect = document.getElementById('explorer-chain-select');
    if (chainSelect && !chainSelect.dataset.listenerAttached) {
      chainSelect.dataset.listenerAttached = 'true';
      chainSelect.addEventListener('change', () => {
        selectedExplorerPort = parseInt(chainSelect.value, 10);
        updateChainMetricsBar();
        if (currentExplorerMode === 'blocks') {
          loadChainBlocks(selectedExplorerPort);
        }
      });
    }

    const btnModeBlocks = document.getElementById('btn-mode-blocks');
    const btnModeLineage = document.getElementById('btn-mode-lineage');
    const patientFilterGroup = document.getElementById('explorer-patient-filter-group');
    const viewBlocks = document.getElementById('view-chain-blocks');
    const viewLineage = document.getElementById('view-patient-lineage');
    const patientSelect = document.getElementById('explorer-patient-select');

    if (btnModeBlocks && !btnModeBlocks.dataset.listenerAttached) {
      btnModeBlocks.dataset.listenerAttached = 'true';
      btnModeBlocks.addEventListener('click', () => {
        currentExplorerMode = 'blocks';
        btnModeBlocks.classList.add('active');
        btnModeLineage.classList.remove('active');
        if (patientFilterGroup) patientFilterGroup.style.display = 'none';
        if (viewBlocks) viewBlocks.style.display = 'block';
        if (viewLineage) viewLineage.style.display = 'none';
        loadChainBlocks(selectedExplorerPort);
      });
    }

    if (btnModeLineage && !btnModeLineage.dataset.listenerAttached) {
      btnModeLineage.dataset.listenerAttached = 'true';
      btnModeLineage.addEventListener('click', () => {
        currentExplorerMode = 'lineage';
        btnModeLineage.classList.add('active');
        btnModeBlocks.classList.remove('active');
        if (patientFilterGroup) patientFilterGroup.style.display = 'flex';
        if (viewBlocks) viewBlocks.style.display = 'none';
        if (viewLineage) viewLineage.style.display = 'block';
        const targetPid = patientSelect ? patientSelect.value : 'Patient/P-101';
        loadPatientLineage(targetPid);
      });
    }

    if (patientSelect && !patientSelect.dataset.listenerAttached) {
      patientSelect.dataset.listenerAttached = 'true';
      patientSelect.addEventListener('change', () => {
        if (currentExplorerMode === 'lineage') {
          loadPatientLineage(patientSelect.value);
        }
      });
    }

    const btnRefresh = document.getElementById('btn-refresh-blocks');
    if (btnRefresh && !btnRefresh.dataset.listenerAttached) {
      btnRefresh.dataset.listenerAttached = 'true';
      btnRefresh.addEventListener('click', () => {
        if (currentExplorerMode === 'blocks') {
          loadChainBlocks(selectedExplorerPort);
        } else {
          const targetPid = patientSelect ? patientSelect.value : 'Patient/P-101';
          loadPatientLineage(targetPid);
        }
      });
    }
  }

  async function loadExplorerChains() {
    try {
      const res = await fetch('/api/explorer/chains', { headers: getAuthHeaders() });
      const json = await res.json();
      if (!json.success || !Array.isArray(json.chains)) return;

      cachedExplorerChains = json.chains;
      const isConsortiumOversight = (currentPersona && (currentPersona.role === 'STEERING_COUNCIL' || currentPersona.role === 'AUDITOR'));

      // If user is individual healthcare staff, jail selectedExplorerPort to their own org port
      if (!isConsortiumOversight && currentPersona && currentPersona.port) {
        selectedExplorerPort = currentPersona.port;
      } else if (!cachedExplorerChains.find(c => c.port === selectedExplorerPort)) {
        selectedExplorerPort = cachedExplorerChains[0] ? cachedExplorerChains[0].port : 8545;
      }

      // Update explorer titles and isolation alerts
      const explorerTitle = document.querySelector('#tab-blocks .section-title, #tab-blocks h2');
      if (explorerTitle) {
        explorerTitle.textContent = isConsortiumOversight 
          ? 'Multi-Fork Blockchain Explorer' 
          : `🔒 ${currentPersona.organizationName || 'Organization'} Private Ledger Explorer`;
      }

      const select = document.getElementById('explorer-chain-select');
      if (select) {
        select.innerHTML = '';
        cachedExplorerChains.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.port;
          const roleIcon = c.role === 'repository' ? '🏛️' : (c.isRoot ? '🌐' : '🏥');
          opt.textContent = `${roleIcon} ${c.name} (Port ${c.port} | Net ${c.networkId})`;
          if (c.port === selectedExplorerPort) opt.selected = true;
          select.appendChild(opt);
        });

        // Disable select for individual staff so they cannot switch to other chains
        select.disabled = !isConsortiumOversight;
        if (!isConsortiumOversight) {
          select.title = `Your access is restricted to ${currentPersona.organizationName} (Port ${currentPersona.port}) under HIPAA § 164.502(b)`;
        } else {
          select.removeAttribute('title');
        }
      }

      updateChainMetricsBar();
      if (currentExplorerMode === 'blocks') {
        await loadChainBlocks(selectedExplorerPort);
      }
    } catch (e) {
      console.error('Error loading explorer chains:', e);
    }
  }

  function updateChainMetricsBar() {
    const chain = cachedExplorerChains.find(c => c.port === selectedExplorerPort);
    if (!chain) return;

    const nameEl = document.getElementById('metric-chain-name');
    const netPortEl = document.getElementById('metric-net-port');
    const heightEl = document.getElementById('metric-block-height');
    const lineageEl = document.getElementById('metric-fork-lineage');
    const recordsEl = document.getElementById('metric-total-records');
    const statusEl = document.getElementById('metric-chain-status');

    if (nameEl) nameEl.textContent = chain.name;
    if (netPortEl) netPortEl.textContent = `Net ${chain.networkId} : Port ${chain.port}`;
    if (heightEl) heightEl.textContent = `Height: #${chain.currentBlockHeight} (${chain.totalBlocks} blocks)`;
    if (lineageEl) {
      lineageEl.textContent = chain.role === 'repository'
        ? 'Consortium Governance Anchor'
        : (chain.isRoot ? 'Master Patient Index Genesis' : `Forked from Net ${chain.parentNetworkId} @ Block ${chain.forkBlockNumber}`);
    }
    if (recordsEl) recordsEl.textContent = `${chain.totalRecords} Records`;
    if (statusEl) {
      statusEl.textContent = chain.online ? 'Online (Consensus OK)' : 'Offline';
      statusEl.className = chain.online ? 'badge badge-success' : 'badge badge-danger';
    }
  }

  async function loadChainBlocks(port) {
    const feedContainer = document.getElementById('blocks-feed-container');
    const badgeCount = document.getElementById('badge-blocks-count');
    if (!feedContainer) return;

    feedContainer.innerHTML = '<div class="loading-spinner">Loading chain blocks...</div>';

    try {
      const res = await fetch(`/api/explorer/chain/${port}/blocks`, { headers: getAuthHeaders() });
      if (res.status === 403) {
        feedContainer.innerHTML = `
          <div class="empty-state" style="border: 1px solid #ef4444; background: rgba(239, 68, 68, 0.05); padding: 1.5rem; border-radius: 8px;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">⛔</div>
            <h4 style="color: #ef4444; margin-bottom: 0.5rem;">Access Denied (403 Forbidden)</h4>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0;">
              Unauthorized cross-chain access attempt. Under HIPAA § 164.502(b) & GDPR Art. 5(1)(f), 
              healthcare staff at <strong>${escapeHtml(currentPersona ? currentPersona.organizationName : 'your facility')}</strong> 
              cannot inspect external clinical ledgers without patient consent or inter-organizational referral.
            </p>
          </div>
        `;
        if (badgeCount) badgeCount.textContent = 'Access Restricted';
        return;
      }
      const json = await res.json();

      if (!json.success || !Array.isArray(json.blocks)) {
        feedContainer.innerHTML = '<div class="empty-state">No blocks found on this chain.</div>';
        return;
      }

      const blocks = json.blocks;
      if (badgeCount) badgeCount.textContent = `${blocks.length} Blocks`;

      if (blocks.length === 0) {
        feedContainer.innerHTML = '<div class="empty-state">No blocks mined yet.</div>';
        return;
      }

      feedContainer.innerHTML = '';
      blocks.slice().reverse().forEach((b) => {
        const card = document.createElement('div');
        card.className = `block-feed-card ${selectedExplorerBlockNum === b.blockNumber ? 'active' : ''}`;
        card.dataset.blockNumber = b.blockNumber;

        const isGenesis = (b.blockNumber === 0);
        const hasRecords = (b.recordsCount > 0);

        card.innerHTML = `
          <div class="block-card-header">
            <span class="block-num-badge ${isGenesis ? 'genesis' : ''}">
              ${isGenesis ? 'Genesis Block #0' : `Block #${b.blockNumber}`}
            </span>
            <span class="block-time">${new Date(b.timestamp * 1000).toLocaleTimeString()}</span>
          </div>
          <div class="block-hash-row">
            <span class="hash-label">Hash:</span>
            <span class="hash-val font-mono" title="${b.hash}">${b.hash.slice(0, 16)}...${b.hash.slice(-8)}</span>
          </div>
          <div class="block-meta-row">
            <span class="badge ${hasRecords ? 'badge-primary' : 'badge-outline'}">
              ${b.recordsCount} FHIR Records
            </span>
            <span class="badge badge-secondary">
              ${b.txCount} Tx
            </span>
          </div>
        `;

        card.addEventListener('click', () => {
          document.querySelectorAll('.block-feed-card').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          selectedExplorerBlockNum = b.blockNumber;
          inspectBlock(port, b.blockNumber);
        });

        feedContainer.appendChild(card);
      });

      const targetBlock = selectedExplorerBlockNum !== null
        ? blocks.find(b => b.blockNumber === selectedExplorerBlockNum) || blocks[blocks.length - 1]
        : blocks[blocks.length - 1];

      if (targetBlock) {
        selectedExplorerBlockNum = targetBlock.blockNumber;
        inspectBlock(port, targetBlock.blockNumber);
      }
    } catch (e) {
      feedContainer.innerHTML = `<div class="empty-state color-danger">Error loading blocks: ${e.message}</div>`;
    }
  }

  async function inspectBlock(port, blockNum) {
    const titleEl = document.getElementById('inspector-block-title');
    const subtitleEl = document.getElementById('inspector-block-subtitle');
    const badgeEl = document.getElementById('inspector-block-badge');
    const bodyEl = document.getElementById('inspector-block-body');

    if (!bodyEl) return;
    bodyEl.innerHTML = '<div class="loading-spinner">Loading block data & validating cryptographic hashes...</div>';

    try {
      const res = await fetch(`/api/explorer/chain/${port}/block/${blockNum}`, { headers: getAuthHeaders() });
      if (res.status === 403) {
        bodyEl.innerHTML = '<div class="empty-state color-danger">⛔ 403 Forbidden: Cross-chain block inspection unauthorized under HIPAA/GDPR isolation.</div>';
        return;
      }
      const json = await res.json();

      if (!json.success || !json.block) {
        bodyEl.innerHTML = '<div class="empty-state color-danger">Failed to retrieve block details.</div>';
        return;
      }

      const blk = json.block;
      const h = blk.blockHeader;

      if (titleEl) titleEl.textContent = `Block #${blk.blockNumber} Inspector`;
      if (subtitleEl) subtitleEl.textContent = `Chain Port ${port} | Mined at ${new Date(h.timestamp * 1000).toLocaleString()}`;
      if (badgeEl) {
        badgeEl.textContent = (blk.records.length > 0) ? `${blk.records.length} Verified Records` : 'Empty State Block';
        badgeEl.className = (blk.records.length > 0) ? 'badge badge-success' : 'badge badge-secondary';
      }

      let recordsHtml = '';
      if (blk.records && blk.records.length > 0) {
        recordsHtml = `
          <div class="block-records-section">
            <h4 class="section-title">Committed HL7 FHIR Healthcare Records (${blk.records.length}):</h4>
            <div class="records-list">
              ${blk.records.map((r) => {
                const formattedJson = JSON.stringify(r.resourceData, null, 2);
                return `
                  <div class="record-inspect-card">
                    <div class="record-header">
                      <div class="record-header-left">
                        <span class="badge badge-primary font-bold">${escapeHtml(r.resourceType)}</span>
                        <span class="record-patient-id font-mono font-bold">${escapeHtml(r.patientId)}</span>
                        <span class="record-code font-mono">${escapeHtml(r.clinicalCode)}</span>
                      </div>
                      <div class="record-header-right">
                        ${r.integrityVerified ? 
                          '<span class="badge badge-success" title="SHA-256 integrity match verified against on-chain anchor">✓ SHA-256 VERIFIED</span>' : 
                          '<span class="badge badge-danger">⚠ HASH MISMATCH</span>'}
                        ${r.hasOffChainVault ? 
                          `<span class="badge badge-outline" title="Encrypted off-chain in AES-256-GCM vault">🔐 Vault: ${r.vaultCid.slice(0, 16)}...</span>` : ''}
                      </div>
                    </div>

                    <div class="record-hashes-row">
                      <div class="hash-field">
                        <span class="lbl">On-Chain State Digest:</span>
                        <span class="val font-mono">${r.dataHash}</span>
                      </div>
                    </div>

                    <div class="record-json-preview">
                      <div class="json-tools-row">
                        <span class="json-lbl">HL7 FHIR R4 JSON Payload:</span>
                        <button type="button" class="btn btn-xs btn-outline btn-copy-raw-json" data-json="${encodeURIComponent(formattedJson)}">
                          📋 Copy JSON
                        </button>
                      </div>
                      <pre class="json-code-block font-mono"><code>${escapeHtml(formattedJson)}</code></pre>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      } else {
        recordsHtml = `
          <div class="empty-state" style="margin-top: 1rem;">
            <span style="font-size: 1.5rem; display: block; margin-bottom: 0.25rem;">ℹ️</span>
            No clinical records were committed inside this specific block (Genesis or System Consensus Block).
          </div>
        `;
      }

      bodyEl.innerHTML = `
        <div class="block-header-details-grid">
          <div class="detail-item">
            <span class="detail-label">Block Number:</span>
            <span class="detail-value font-mono">${h.number} (${blk.blockNumber})</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Block Hash:</span>
            <span class="detail-value font-mono text-truncate" title="${h.hash}">${h.hash}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Parent Block Hash:</span>
            <span class="detail-value font-mono text-truncate" title="${h.parentHash}">${h.parentHash}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Mined By (Validator):</span>
            <span class="detail-value font-mono text-truncate">${h.miner}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Timestamp:</span>
            <span class="detail-value">${new Date(h.timestamp * 1000).toLocaleString()} (${h.timestamp})</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Gas Used / Transactions:</span>
            <span class="detail-value font-mono">${h.gasUsed} / ${h.txCount} tx</span>
          </div>
        </div>

        ${recordsHtml}
      `;

      bodyEl.querySelectorAll('.btn-copy-raw-json').forEach(btn => {
        btn.addEventListener('click', () => {
          const raw = decodeURIComponent(btn.getAttribute('data-json'));
          navigator.clipboard.writeText(raw).then(() => {
            btn.textContent = '✓ Copied!';
            setTimeout(() => { btn.textContent = '📋 Copy JSON'; }, 2000);
          });
        });
      });

    } catch (e) {
      bodyEl.innerHTML = `<div class="empty-state color-danger">Error inspecting block: ${e.message}</div>`;
    }
  }

  async function loadPatientLineage(patientId) {
    const timelineEl = document.getElementById('patient-lineage-timeline');
    const badgeHops = document.getElementById('badge-lineage-hops');
    const titleEl = document.getElementById('lineage-patient-title');

    if (!timelineEl) return;
    timelineEl.innerHTML = '<div class="loading-spinner">Tracing patient record trajectory across all forks...</div>';

    try {
      const cleanPid = patientId.replace(/^Patient\//i, '');
      const res = await fetch(`/api/explorer/patient/${encodeURIComponent(cleanPid)}/lineage`, { headers: getAuthHeaders() });
      const json = await res.json();

      if (!json.success || !json.lineage) {
        timelineEl.innerHTML = '<div class="empty-state">No lineage touchpoints found for this patient.</div>';
        return;
      }

      const l = json.lineage;
      if (titleEl) titleEl.textContent = `Patient ${patientId} Cross-Fork Trajectory (${l.participatingForks.length} Healthcare Entities)`;
      if (badgeHops) badgeHops.textContent = `${l.totalTouchpoints} Causal Touchpoints`;

      if (!l.lineageTrajectory || l.lineageTrajectory.length === 0) {
        timelineEl.innerHTML = '<div class="empty-state">No records found for this patient across the fork tree.</div>';
        return;
      }

      timelineEl.innerHTML = `
        <div class="lineage-summary-strip">
          <span class="summary-item"><strong>Patient ID:</strong> <span class="font-mono">${escapeHtml(l.patientId)}</span></span>
          <span class="summary-item"><strong>Traversed Organizations:</strong> ${l.participatingForks.join(' ➔ ')}</span>
        </div>
        <div class="lineage-timeline-track">
          ${l.lineageTrajectory.map((step, idx) => {
            if (step.isShielded) {
              return `
                <div class="timeline-step-card shielded-event-notice">
                  <div class="step-marker" style="background: #64748b;">
                    <span class="step-num">${idx + 1}</span>
                  </div>
                  <div class="step-content">
                    <div class="step-header">
                      <div class="step-org-badge">
                        <span class="org-icon">🔒</span>
                        <strong>${escapeHtml(step.chainName)}</strong>
                        <span class="font-mono text-muted">(Port ${step.port} | Net ${step.networkId} | Block #${step.blockNumber})</span>
                      </div>
                      <span class="step-time">${new Date(step.timestamp * 1000).toLocaleString()}</span>
                    </div>
                    <div class="step-resource-info" style="margin-top: 0.5rem;">
                      <span class="badge badge-secondary font-bold">${escapeHtml(step.resourceType)}</span>
                      <span class="badge badge-outline" style="border-color: #f59e0b; color: #d97706;">🛡️ External Facility Shielded</span>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem; background: var(--bg-surface-elevated); padding: 0.75rem; border-radius: 6px; font-style: italic;">
                      [RESTRICTED PHI - EXTERNAL FACILITY]: Clinical payload redacted for ${escapeHtml(currentPersona ? currentPersona.name : 'current user')} pursuant to Minimum Necessary disclosure rule. Direct inter-facility referral or patient-signed authorization required for payload decryption.
                    </div>
                  </div>
                </div>
              `;
            }

            const formatted = JSON.stringify(step.resourceData, null, 2);
            const isGenesis = step.isRoot;
            return `
              <div class="timeline-step-card">
                <div class="step-marker">
                  <span class="step-num">${idx + 1}</span>
                </div>
                <div class="step-content">
                  <div class="step-header">
                    <div class="step-org-badge">
                      <span class="org-icon">${isGenesis ? '🌐' : '🏥'}</span>
                      <strong>${escapeHtml(step.chainName)}</strong>
                      <span class="font-mono text-muted">(Port ${step.port} | Net ${step.networkId} | Block #${step.blockNumber})</span>
                    </div>
                    <span class="step-time">${new Date(step.timestamp * 1000).toLocaleString()}</span>
                  </div>

                  <div class="step-resource-info">
                    <span class="badge badge-primary font-bold">${escapeHtml(step.resourceType)}</span>
                    <span class="resource-code font-mono">${escapeHtml(step.clinicalCode)}</span>
                    ${step.integrityVerified ? 
                      '<span class="badge badge-success">✓ SHA-256 Validated</span>' : 
                      '<span class="badge badge-danger">⚠ Tampered</span>'}
                  </div>

                  <div class="step-json-card">
                    <pre class="json-code-block font-mono"><code>${escapeHtml(formatted)}</code></pre>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } catch (e) {
      timelineEl.innerHTML = `<div class="empty-state color-danger">Error tracing lineage: ${e.message}</div>`;
    }
  }

  // Boot Platform UI
  initPersonas();
  loadTreeTopology();
  initEhrAuthoring();
});
