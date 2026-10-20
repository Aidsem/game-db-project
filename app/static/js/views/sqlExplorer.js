// app/static/js/views/sqlExplorer.js

export async function render(root, ctx) {
  const { ui, theme, params, api } = ctx;
  root.innerHTML = '';

  // Inject view-specific styles once
  if (!document.getElementById('sqlx-css')) {
    const style = ui.el('style', { id: 'sqlx-css' }, `
      .sqlx-header { margin-bottom: 1rem; }
      .sqlx-header h2 { margin: 0 0 0.25rem 0; font-family: 'Fraunces', serif; }
      .sqlx-header p { margin: 0; color: var(--muted); }
      .sqlx-concepts { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem; }
      .sqlx-concept-chip { background: var(--surface-2); padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.85rem; border: 1px solid var(--border); cursor: pointer; transition: 0.2s; }
      .sqlx-concept-chip:hover { border-color: var(--teal); color: var(--teal); }
      .sqlx-tabs { display: flex; gap: 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; overflow-x: auto; }
      .sqlx-tab { padding: 0.5rem 1rem; border-bottom: 2px solid transparent; cursor: pointer; color: var(--muted); white-space: nowrap; }
      .sqlx-tab.active { border-bottom-color: var(--teal); color: var(--text); }
      .sqlx-content-area { display: flex; flex-direction: column; gap: 1.5rem; }
      .sqlx-row { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
      .sqlx-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; }
      .sqlx-error-card { border-color: var(--red); background: rgba(255, 50, 50, 0.05); }
      .sqlx-error-card h4 { color: var(--red); margin: 0 0 0.5rem 0; }
      .sqlx-query-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1rem; }
      .sqlx-query-head { padding: 1rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); cursor: pointer; }
      .sqlx-query-body { padding: 1rem; display: none; }
      .sqlx-query-card.open .sqlx-query-body { display: block; }
      .sqlx-pre { background: #0d1117; color: #c9d1d9; padding: 1rem; border-radius: 6px; overflow-x: auto; margin-top: 0.5rem; font-family: monospace; font-size: 0.9rem; }
      .sqlx-profile-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; }
      .sqlx-stat-chips { display: flex; flex-wrap: wrap; gap: 0.25rem; margin: 0.5rem 0; }
      .sqlx-stat-chip { font-size: 0.75rem; background: var(--bg); padding: 0.15rem 0.5rem; border-radius: 4px; border: 1px solid var(--border); }
    `);
    document.head.appendChild(style);
  }

  const activeTab = params.tab || 'views';
  const setTab = (tab) => { window.location.hash = `#/sql?tab=${tab}`; };

  // Header & Concepts
  const header = ui.el('div', { class: 'sqlx-header' },
    ui.el('h2', {}, 'SQL Explorer'),
    ui.el('p', {}, 'Live PostgreSQL features running on Neon')
  );

  const concepts = ui.el('div', { class: 'sqlx-concepts' },
    ui.el('div', { class: 'sqlx-concept-chip', onclick: () => setTab('views') }, 'View'),
    ui.el('div', { class: 'sqlx-concept-chip', onclick: () => setTab('function') }, 'Function'),
    ui.el('div', { class: 'sqlx-concept-chip', onclick: () => setTab('triggers') }, 'Stored Procedure'),
    ui.el('div', { class: 'sqlx-concept-chip', onclick: () => setTab('triggers') }, 'Trigger'),
    ui.el('div', { class: 'sqlx-concept-chip', onclick: () => setTab('jsonb') }, 'JSONB + GIN Index'),
    ui.el('div', { class: 'sqlx-concept-chip', onclick: () => setTab('queries') }, 'Index & Constraint')
  );

  // Tabs
  const tabsDef = [
    { id: 'views', label: 'Views' },
    { id: 'function', label: 'Function' },
    { id: 'queries', label: 'Queries' },
    { id: 'jsonb', label: 'JSONB' },
    { id: 'triggers', label: 'Triggers & Audit' }
  ];
  const tabBar = ui.el('div', { class: 'sqlx-tabs', role: 'tablist' },
    ...tabsDef.map(t => ui.el('div', {
      class: `sqlx-tab ${activeTab === t.id ? 'active' : ''}`,
      onclick: () => setTab(t.id),
      role: 'tab',
      'aria-selected': activeTab === t.id
    }, t.label))
  );

  const contentArea = ui.el('div', { class: 'sqlx-content-area' });
  root.appendChild(ui.el('div', {}, header, concepts, tabBar, contentArea));

  // Render Active Tab Content
  try {
    if (activeTab === 'views') {
      await renderViewsTab(contentArea, ctx);
    } else if (activeTab === 'function') {
      await renderFunctionTab(contentArea, ctx);
    } else if (activeTab === 'queries') {
      await renderQueriesTab(contentArea, ctx);
    } else if (activeTab === 'jsonb') {
      await renderJsonbTab(contentArea, ctx);
    } else if (activeTab === 'triggers') {
      await renderTriggersTab(contentArea, ctx);
    }
  } catch (err) {
    ui.toast(err.message, 'error');
    contentArea.appendChild(ui.emptyState('Failed to load tab data.'));
  }
}

export function destroy() {
  // No charts or global listeners to clean up
}

// ==========================================
// Tab 1: Views
// Demonstrates VIEW creation and querying
// ==========================================
async function renderViewsTab(container, { ui, api }) {
  const viewsList = [
    { id: 'character-overview', name: 'v_character_overview' },
    { id: 'build-details', name: 'v_build_details' },
    { id: 'damage-summary', name: 'v_build_damage_summary' }
  ];
  let currentView = viewsList[0];
  let currentData = [];

  const descMap = {
    'character-overview': 'Combines characters with their best combat and exploration tiers.',
    'build-details': 'Joins builds, weapons, artifacts, and aggregates the team junction table.',
    'damage-summary': 'Aggregates damage logs to show run count, average, and max damage per build.'
  };

  const select = ui.el('select', { class: 'field' }, ...viewsList.map(v => ui.el('option', { value: v.id }, v.name)));
  const tableRoot = ui.el('div', {});
  const metaRoot = ui.el('div', { class: 'sqlx-row muted' });

  const loadView = async () => {
    tableRoot.innerHTML = '';
    metaRoot.innerHTML = '';
    tableRoot.appendChild(ui.skeleton());
    try {
      currentData = await api.get(`/views/${currentView.id}`);
      tableRoot.innerHTML = '';
      if (!currentData.length) {
        tableRoot.appendChild(ui.emptyState('No data found in view.'));
        return;
      }
      const cols = Object.keys(currentData[0]).map(k => ({ key: k, label: k }));
      tableRoot.appendChild(ui.table(cols, currentData));
      metaRoot.appendChild(ui.el('span', { class: 'chip' }, `${currentData.length} rows`));
      metaRoot.appendChild(ui.el('span', {}, descMap[currentView.id]));
    } catch (err) {
      tableRoot.innerHTML = '';
      ui.toast(err.message, 'error');
    }
  };

  select.onchange = (e) => {
    currentView = viewsList.find(v => v.id === e.target.value);
    loadView();
  };

  const toolbar = ui.el('div', { class: 'sqlx-row' },
    ui.el('label', {}, 'Select View: '),
    select,
    ui.el('button', { class: 'btn', onclick: () => ui.downloadCsv(`${currentView.name}.csv`, currentData) }, 'Export CSV')
  );

  const infoCard = ui.el('div', { class: 'sqlx-card' },
    ui.el('h4', { style: { marginTop: 0 } }, 'What is a View?'),
    ui.el('p', { class: 'muted' }, 'A VIEW is a virtual table representing the result of a stored SQL query, simplifying complex JOINs and providing a consistent read interface without duplicating data.')
  );

  container.appendChild(toolbar);
  container.appendChild(metaRoot);
  container.appendChild(tableRoot);
  container.appendChild(infoCard);

  await loadView();
}

// ==========================================
// Tab 2: Function
// Demonstrates custom SQL functions
// ==========================================
async function renderFunctionTab(container, { ui, api }) {
  container.appendChild(ui.skeleton());
  const chars = await api.get('/characters');
  container.innerHTML = '';

  const select = ui.el('select', { class: 'field' },
    ...chars.map(c => ui.el('option', { value: c.id }, c.name))
  );

  const resultCard = ui.el('div', { class: 'sqlx-card', style: { display: 'none' } });

  const runBtn = ui.el('button', { class: 'btn primary' }, 'Run get_best_build()');
  runBtn.onclick = async () => {
    const id = select.value;
    resultCard.style.display = 'block';
    resultCard.innerHTML = '';
    resultCard.appendChild(ui.skeleton(2));
    try {
      const res = await api.get(`/best-build/${id}`);
      resultCard.innerHTML = '';
      resultCard.appendChild(ui.el('h4', { style: { marginTop: 0 } }, 'Result:'));
      resultCard.appendChild(ui.el('p', {}, `Build: `, ui.el('strong', {}, res.build_name)));
      resultCard.appendChild(ui.el('p', {}, `Avg Damage: `, ui.el('strong', { class: 'stat' }, res.avg_damage?.toLocaleString() || 'N/A')));
    } catch (err) {
      resultCard.innerHTML = '';
      if (err.message.includes('404')) {
        resultCard.appendChild(ui.emptyState('This character has no damage logs yet.'));
      } else {
        ui.toast(err.message, 'error');
        resultCard.appendChild(ui.el('p', { class: 'muted' }, 'Error running function.'));
      }
    }
  };

  const codeBlock = ui.el('div', { class: 'sqlx-card' },
    ui.el('p', { class: 'muted' }, 'A stored function executes logic directly in the database. This one queries logs to find the build with the highest average damage for a given character.'),
    ui.el('div', { class: 'sqlx-pre' }, 'SELECT * FROM get_best_build( character_id );')
  );

  container.appendChild(ui.el('div', { class: 'sqlx-row' }, ui.el('label', {}, 'Character: '), select, runBtn));
  container.appendChild(resultCard);
  container.appendChild(codeBlock);
}

// ==========================================
// Tab 3: Queries
// Demonstrates various SQL queries
// ==========================================
async function renderQueriesTab(container, { ui, api }) {
  container.appendChild(ui.skeleton());
  const queries = await api.get('/demo-queries');
  container.innerHTML = '';

  queries.forEach(q => {
    const card = ui.el('div', { class: 'sqlx-query-card' });

    const toggleOpen = () => {
      const wasOpen = card.classList.contains('open');
      document.querySelectorAll('.sqlx-query-card').forEach(c => c.classList.remove('open'));
      if (!wasOpen) card.classList.add('open');
    };

    const head = ui.el('div', { class: 'sqlx-query-head', onclick: toggleOpen },
      ui.el('strong', {}, q.title),
      ui.el('span', { class: 'muted' }, '▼')
    );

    const resultRoot = ui.el('div', { style: { marginTop: '1rem' } });

    const runBtn = ui.el('button', { class: 'btn primary' }, 'Run Query');
    runBtn.onclick = async (e) => {
      e.stopPropagation();
      resultRoot.innerHTML = '';
      resultRoot.appendChild(ui.skeleton(2));
      const start = performance.now();
      try {
        const fullQ = await api.get(`/demo-queries/${q.id}`);
        const ms = (performance.now() - start).toFixed(1);
        resultRoot.innerHTML = '';
        if (!fullQ.rows || !fullQ.rows.length) {
          resultRoot.appendChild(ui.emptyState('Query returned 0 rows.'));
        } else {
          const cols = Object.keys(fullQ.rows[0]).map(k => ({ key: k, label: k }));
          resultRoot.appendChild(ui.el('div', { class: 'sqlx-row muted', style: { marginBottom: '0.5rem' } },
            ui.el('span', { class: 'chip' }, `${fullQ.rows.length} rows`),
            ui.el('span', {}, `${ms} ms execution time`)
          ));
          resultRoot.appendChild(ui.table(cols, fullQ.rows, { sortable: true }));
        }
      } catch (err) {
        resultRoot.innerHTML = '';
        ui.toast(err.message, 'error');
      }
    };

    const copyBtn = ui.el('button', { class: 'btn' }, 'Copy');
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(q.sql);
      ui.toast('SQL copied to clipboard', 'success');
    };

    const body = ui.el('div', { class: 'sqlx-query-body' },
      ui.el('div', { class: 'sqlx-pre' }, q.sql),
      ui.el('div', { class: 'sqlx-row', style: { marginTop: '1rem' } }, runBtn, copyBtn),
      resultRoot
    );

    card.appendChild(head);
    card.appendChild(body);
    container.appendChild(card);
  });
}

// ==========================================
// Tab 4: JSONB
// Demonstrates NoSQL JSON queries in PostgreSQL
// ==========================================
async function renderJsonbTab(container, { ui, api, theme }) {
  const regions = ['All', 'Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan', 'Snezhnaya', "Khaenri'ah"];
  const select = ui.el('select', { class: 'field' }, ...regions.map(r => ui.el('option', { value: r === 'All' ? '' : r }, r)));

  const grid = ui.el('div', { class: 'sqlx-profile-grid' });

  const loadProfiles = async () => {
    grid.innerHTML = '';
    grid.appendChild(ui.skeleton());
    try {
      const region = select.value;
      const url = region ? `/profiles?region=${encodeURIComponent(region)}` : '/profiles';
      const profiles = await api.get(url);
      grid.innerHTML = '';

      if (!profiles.length) {
        grid.appendChild(ui.emptyState('No profiles found for this region.'));
        return;
      }

      profiles.forEach(p => {
        const prof = p.profile || {};
        const stats = (prof.stat_priority || []).map(s => ui.el('span', { class: 'sqlx-stat-chip' }, s));
        const card = ui.el('div', { class: 'sqlx-card' },
          ui.el('div', { class: 'sqlx-row', style: { justifyContent: 'space-between' } },
            ui.el('strong', {}, p.name),
            ui.el('span', { class: 'chip swatch' }, prof.region || 'Unknown')
          ),
          ui.el('div', { class: 'sqlx-stat-chips' }, ...stats),
          ui.el('p', { class: 'muted', style: { fontSize: '0.85rem', margin: '0.5rem 0 0 0' } }, prof.playstyle || 'No playstyle text.')
        );
        grid.appendChild(card);
      });
    } catch (err) {
      grid.innerHTML = '';
      ui.toast(err.message, 'error');
    }
  };

  select.onchange = loadProfiles;

  const infoCard = ui.el('div', { class: 'sqlx-card' },
    ui.el('p', { class: 'muted' }, 'PostgreSQL allows querying schemaless JSON data directly. The query below uses a GIN index on the profile column for rapid searching inside the JSON structure.'),
    ui.el('div', { class: 'sqlx-pre' }, "SELECT character_id, profile FROM character_profiles WHERE profile->>'region' = 'X';")
  );

  container.appendChild(ui.el('div', { class: 'sqlx-row' }, ui.el('label', {}, 'Filter Region: '), select));
  container.appendChild(grid);
  container.appendChild(infoCard);

  await loadProfiles();
}

// ==========================================
// Tab 5: Triggers and Audit
// Demonstrates constraints, stored procedures, triggers
// ==========================================
async function renderTriggersTab(container, { ui, api }) {
  const triggerContainer = ui.el('div', { class: 'sqlx-card' });
  triggerContainer.appendChild(ui.skeleton(2));

  const auditContainer = ui.el('div', { class: 'sqlx-card', style: { marginTop: '1.5rem' } });

  container.appendChild(triggerContainer);
  container.appendChild(auditContainer);

  // Load Trigger Demo
  try {
    const builds = await api.get('/builds');
    triggerContainer.innerHTML = '';

    if (!builds.length) {
      triggerContainer.appendChild(ui.emptyState('Need at least one build to demonstrate triggers.'));
    } else {
      const demoBuildId = builds[0].id;

      triggerContainer.appendChild(ui.el('h4', { style: { marginTop: 0 } }, 'Trigger & Procedure Demo'));
      triggerContainer.appendChild(ui.el('p', { class: 'muted' }, 'Attempts to insert a damage log. A BEFORE INSERT trigger validates the data, rejecting negative values.'));

      const errorBox = ui.el('div', { class: 'sqlx-error-card sqlx-card', style: { display: 'none', margin: '1rem 0' } });

      const testNegativeBtn = ui.el('button', { class: 'btn danger' }, 'Try a negative value (-5)');
      testNegativeBtn.onclick = async () => {
        errorBox.style.display = 'none';
        try {
          await api.post('/procedures/add-damage-log', { build_id: demoBuildId, label: 'Demo', damage_value: -5 });
        } catch (err) {
          errorBox.style.display = 'block';
          errorBox.innerHTML = '';
          errorBox.appendChild(ui.el('h4', {}, 'Trigger validate_damage blocked this insert'));
          errorBox.appendChild(ui.el('p', {}, err.message));
        }
      };

      const testValidBtn = ui.el('button', { class: 'btn primary' }, 'Insert a valid value (100000)');
      testValidBtn.onclick = async () => {
        errorBox.style.display = 'none';
        try {
          await api.post('/procedures/add-damage-log', { build_id: demoBuildId, label: 'Demo Valid', damage_value: 100000 });
          ui.toast('Valid damage log inserted successfully via procedure', 'success');
        } catch (err) {
          ui.toast(err.message, 'error');
        }
      };

      triggerContainer.appendChild(ui.el('div', { class: 'sqlx-row' }, testNegativeBtn, testValidBtn));
      triggerContainer.appendChild(errorBox);
    }
  } catch (err) {
    triggerContainer.innerHTML = '';
    ui.toast(err.message, 'error');
  }

  // Load Audit Log
  const loadAudit = async () => {
    auditContainer.innerHTML = '';
    auditContainer.appendChild(ui.skeleton());
    try {
      const logs = await api.get('/audit-log');
      auditContainer.innerHTML = '';

      const headRow = ui.el('div', { class: 'sqlx-row', style: { justifyContent: 'space-between', marginBottom: '1rem' } },
        ui.el('h4', { style: { margin: 0 } }, 'Audit Log'),
        ui.el('button', { class: 'btn', onclick: loadAudit }, 'Refresh')
      );
      auditContainer.appendChild(headRow);
      auditContainer.appendChild(ui.el('p', { class: 'muted' }, 'The audit_characters AFTER INSERT/DELETE trigger automatically logs changes to this table.'));

      if (!logs.length) {
        auditContainer.appendChild(ui.emptyState('No audit logs found.'));
      } else {
        const cols = [
          { key: 'id', label: 'ID' },
          { key: 'table_name', label: 'Table' },
          { key: 'action', label: 'Action' },
          { key: 'record_id', label: 'Rec ID' },
          { key: 'details', label: 'Details' },
          { key: 'logged_at', label: 'Time', render: (r) => new Date(r.logged_at).toLocaleString() }
        ];
        auditContainer.appendChild(ui.table(cols, logs));
      }
    } catch (err) {
      auditContainer.innerHTML = '';
      ui.toast(err.message, 'error');
    }
  };

  await loadAudit();
}