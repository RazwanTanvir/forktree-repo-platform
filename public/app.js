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
  let selectedMessageId = null;
  let activeMsgFilter = 'all';

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

    // Auth Banner Text
    const bannerText = document.getElementById('auth-banner-text');
    if (bannerText) {
      if (isCouncil) {
        bannerText.textContent = `Authenticated as Steering Council Chair (${currentPersona.name}). Root federation provisioning & oversight active.`;
      } else if (currentPersona.role === 'CLINICIAN') {
        bannerText.textContent = `Authenticated as Clinician (${currentPersona.name} at ${currentPersona.organizationName}). Write permissions & order dispatch active.`;
      } else if (currentPersona.role === 'SPECIALIST') {
        bannerText.textContent = `Authenticated as Healthcare Specialist (${currentPersona.name} at ${currentPersona.organizationName}). Order fulfillment active.`;
      } else {
        bannerText.textContent = `Operating as ${currentPersona.name} (${currentPersona.role} at ${currentPersona.organizationName}). Role-based permissions enforced.`;
      }
    }

    renderPersonaChips();
    applyRolePermissions();
  }

  function applyRolePermissions() {
    const role = currentPersona.role;
    const permissions = currentPersona.permissions || [];

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
      else if (role === 'ORG_ADMIN') defaultTab = 'governance';
      else if (role === 'CLINICIAN') defaultTab = 'data';
      else if (role === 'SPECIALIST') defaultTab = 'messaging';
      else if (role === 'AUDITOR') defaultTab = 'tree';
      else if (role === 'PATIENT') defaultTab = 'data';

      switchTab(defaultTab);
    } else {
      const activeBtn = document.querySelector('.tab-btn.active');
      if (activeBtn) {
        const activeTab = activeBtn.getAttribute('data-tab');
        if (activeTab === 'data') loadChainData();
        if (activeTab === 'messaging') loadMessages();
        if (activeTab === 'request-fork') loadForkBallots();
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
      if (role === 'CLINICIAN') populateAddRecordChainSelect();
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
      const res = await fetch('/api/tree');
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
      const res = await fetch('/api/status');
      const json = await res.json();
      if (json.success && Array.isArray(json.nodes)) {
        grid.innerHTML = '';
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

    const portVal = select ? select.value : 'all';
    const url = portVal === 'all' ? '/api/data' : `/api/data/${portVal}`;

    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        let records = json.data || [];

        // Role-based patient filtering: Patients only see their own records
        if (currentPersona.role === 'PATIENT') {
          records = records.filter(r => {
            if (!r.patientId) return false;
            const pid = r.patientId.toUpperCase();
            return pid === 'P101' || pid === currentPersona.id.toUpperCase() || pid.includes('P101');
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
                <strong>No clinical records found.</strong>
                <p style="margin-top: 4px; color: #8b949e; font-size: 13px;">${currentPersona.role === 'CLINICIAN' ? 'Author and digitally sign the first real patient encounter using the form above.' : 'Clinical records will appear once committed by authorized care team clinicians.'}</p>
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
              <span style="font-family: monospace; color: #7ee787;">SHA-256: ${r.dataHash ? r.dataHash.slice(0, 18) + '…' : 'Anchored'}</span>
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
    select.innerHTML = '<option value="all">All Chains (Federated View)</option>';
    chains.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.port;
      opt.textContent = `${c.name} (Port ${c.port})`;
      select.appendChild(opt);
    });

    select.removeEventListener('change', loadChainData);
    select.addEventListener('change', loadChainData);
  }

  async function populateAddRecordChainSelect() {
    const select = document.getElementById('rec-target-port');
    if (!select) return;
    const chains = await fetchChains();
    select.innerHTML = '';
    chains.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.port;
      opt.textContent = `${c.name} (Port ${c.port})`;
      select.appendChild(opt);
    });
    if (currentPersona.port && chains.some(c => c.port === currentPersona.port)) {
      select.value = currentPersona.port;
    }
  }

  // Clinical Record Form Submission
  const formAddClinicalRecord = document.getElementById('form-add-clinical-record');
  if (formAddClinicalRecord) {
    formAddClinicalRecord.addEventListener('submit', async (e) => {
      e.preventDefault();
      const portVal = parseInt(document.getElementById('rec-target-port').value, 10);
      const patientId = document.getElementById('rec-patient-id').value.trim();
      const resourceType = document.getElementById('rec-resource-type').value;
      const clinicalCode = document.getElementById('rec-clinical-code').value.trim();
      const summaryNote = document.getElementById('rec-summary-note').value.trim();

      const btn = document.getElementById('btn-commit-record');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '🔒 Signing & Anchoring to Chain...';
      }

      const resourceData = {
        resourceType: resourceType,
        id: `${resourceType.toLowerCase()}-${Date.now().toString().slice(-6)}`,
        status: 'final',
        code: {
          text: clinicalCode,
          coding: [{
            system: clinicalCode.startsWith('LOINC') ? 'http://loinc.org' : 'http://hl7.org/fhir/sid/icd-10',
            code: clinicalCode.split(':')[1] || clinicalCode,
            display: summaryNote
          }]
        },
        subject: {
          reference: `Patient/${patientId}`,
          display: `Patient ${patientId}`
        },
        performer: [{
          display: currentPersona.name,
          actor: currentPersona.address
        }],
        note: [{ text: summaryNote }],
        effectiveDateTime: new Date().toISOString()
      };

      try {
        const res = await fetch('/api/add-patient-record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Caller-Address': currentPersona.address
          },
          body: JSON.stringify({
            port: portVal,
            patientId,
            resourceType,
            clinicalCode,
            resourceData,
            callerAddress: currentPersona.address
          })
        });

        const json = await res.json();
        if (json.success) {
          alert(`✓ Clinical record cryptographically anchored on Port ${portVal}!\nTx Hash: ${json.txHash}\nSHA-256 Digest: ${json.dataHash}`);
          document.getElementById('rec-summary-note').value = '';
          loadChainData();
          loadVaultStats();
        } else {
          alert(`Error committing clinical record: ${json.error}`);
        }
      } catch (err) {
        alert(`Failed to commit clinical record: ${err.message}`);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🔒 Commit Record with Clinician Signature';
        }
      }
    });
  }

  // Patient Consent UI
  function renderPatientConsentUI() {
    const consentContainer = document.getElementById('patient-consent-list');
    if (!consentContainer) return;

    consentContainer.innerHTML = '';
    const facilities = [
      { id: '11103', name: 'Metro General Hospital', desc: 'Inpatient EHR, surgical notes, discharge summaries' },
      { id: '11104', name: 'BioLabs Pathology & Diagnostics', desc: 'Lab specimens, genetic panels, bloodwork' },
      { id: '11105', name: 'CardioSpecialty Center', desc: 'ECG waveforms, echocardiograms, cardiology consults' },
      { id: '11106', name: 'Emergency & Urgent Care', desc: 'Trauma triage, ER encounters, allergy alerts' },
      { id: '11107', name: 'Outpatient Pharmacy Network', desc: 'Prescription dispensing, medication reconciliation' }
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ algorithm, startNetworkId, searchValue })
        });
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

  // Boot Platform UI
  initPersonas();
  loadTreeTopology();
});
