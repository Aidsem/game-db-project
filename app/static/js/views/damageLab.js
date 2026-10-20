// app/static/js/views/damageLab.js

let chartInstance = null;

export async function render(root, ctx) {
  const { api, ui, theme, params, graphUrl } = ctx;
  root.innerHTML = '';

  if (!document.getElementById('lab-css')) {
    const style = ui.el('style', { id: 'lab-css' }, `
      .lab-header { margin-bottom: 1.5rem; }
      .lab-header h2 { margin: 0 0 0.25rem 0; font-family: 'Fraunces', serif; }
      .lab-header p { margin: 0; color: var(--muted); }
      .lab-controls { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; padding: 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
      .lab-controls .field { margin: 0; min-width: 200px; }
      .lab-content { display: flex; flex-direction: column; gap: 1.5rem; }
      .lab-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; }
      .lab-build-head { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
      .lab-build-details { display: flex; flex-wrap: wrap; gap: 0.5rem; color: var(--muted); font-size: 0.9rem; }
      .lab-best-badge { background: rgba(242, 165, 65, 0.1); color: var(--amber); border: 1px solid var(--amber); padding: 0.25rem 0.75rem; border-radius: 1rem; font-weight: bold; font-size: 0.85rem; }
      .lab-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; align-items: end; margin-bottom: 0.5rem; }
      .lab-quick-fill { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
      .lab-error { color: var(--red); font-size: 0.9rem; margin-top: 0.5rem; display: none; }
      .lab-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
      .lab-stat-box { background: var(--surface-2); padding: 1rem; border-radius: 6px; text-align: center; border: 1px solid var(--border); }
      .lab-stat-box div { font-size: 0.85rem; color: var(--muted); margin-bottom: 0.25rem; }
      .lab-stat-box strong { font-size: 1.25rem; font-family: 'JetBrains Mono', monospace; }
      .lab-graphs { display: grid; grid-template-columns: 1fr; gap: 1rem; }
      @media (min-width: 800px) { .lab-graphs { grid-template-columns: 1fr 1fr; } }
      .lab-graph-box { text-align: center; border: 1px solid var(--border); border-radius: 6px; padding: 1rem; background: var(--surface-2); }
      .lab-graph-box img { max-width: 100%; height: auto; border-radius: 4px; margin-bottom: 0.5rem; }
      .lab-chart-container { height: 200px; width: 100%; margin-bottom: 1rem; }
    `);
    document.head.appendChild(style);
  }

  // --- Layout Setup ---
  const header = ui.el('div', { class: 'lab-header' },
    ui.el('h2', {}, 'Damage Lab'),
    ui.el('p', {}, 'Log damage values, test triggers, and visualize metrics.')
  );

  const controls = ui.el('div', { class: 'lab-controls' });
  const contentArea = ui.el('div', { class: 'lab-content' });
  root.appendChild(ui.el('div', {}, header, controls, contentArea));

  controls.appendChild(ui.skeleton(1));

  // --- Load Characters ---
  let characters = [];
  try {
    characters = await api.get('/characters');
  } catch (err) {
    ui.toast(err.message, 'error');
    return;
  }

  if (!characters.length) {
    controls.innerHTML = '';
    contentArea.appendChild(ui.emptyState('No characters exist.'));
    return;
  }

  let savedCharId = null;
  try { savedCharId = sessionStorage.getItem('damageLabCharId'); } catch (e) {}

  let activeCharId = params.character_id || savedCharId || characters[0].id.toString();
  // Ensure selected ID actually exists in the list
  if (!characters.find(c => c.id.toString() === activeCharId.toString())) {
    activeCharId = characters[0].id.toString();
  }

  const charSelect = ui.el('select', { class: 'field' }, ...characters.map(c => ui.el('option', { value: c.id }, c.name)));
  charSelect.value = activeCharId;

  const buildSelect = ui.el('select', { class: 'field' });
  controls.innerHTML = '';
  controls.appendChild(ui.el('div', {}, ui.el('label', { class: 'stat-label' }, 'Character'), charSelect));
  const buildSelectWrapper = ui.el('div', {}, ui.el('label', { class: 'stat-label' }, 'Build'), buildSelect);
  controls.appendChild(buildSelectWrapper);

  // --- State updates ---
  const updateUrlAndSession = (charId) => {
    history.replaceState(null, '', `#/damage-lab?character_id=${charId}`);
    try { sessionStorage.setItem('damageLabCharId', charId); } catch (e) {}
  };

  const loadBuildsForCharacter = async (charId) => {
    contentArea.innerHTML = '';
    contentArea.appendChild(ui.skeleton());
    buildSelect.innerHTML = '';
    buildSelectWrapper.style.display = 'none';

    try {
      const builds = await api.get(`/builds?character_id=${charId}`);
      if (!builds.length) {
        contentArea.innerHTML = '';
        const btn = ui.el('button', { class: 'btn primary', onclick: () => location.hash = `#/builds` }, 'Go to Builds');
        contentArea.appendChild(ui.emptyState('This character has no builds.'));
        contentArea.lastChild.appendChild(btn);
        return;
      }

      buildSelectWrapper.style.display = 'block';
      builds.forEach(b => buildSelect.appendChild(ui.el('option', { value: b.id }, b.build_name)));

      const onBuildChange = () => {
        const build = builds.find(b => b.id.toString() === buildSelect.value);
        if (build) renderLab(build, characters.find(c => c.id.toString() === charId));
      };

      buildSelect.onchange = onBuildChange;
      onBuildChange(); // Render first build immediately
    } catch (err) {
      contentArea.innerHTML = '';
      ui.toast(err.message, 'error');
    }
  };

  charSelect.onchange = (e) => {
    const id = e.target.value;
    updateUrlAndSession(id);
    loadBuildsForCharacter(id);
  };

  // Initial load
  updateUrlAndSession(activeCharId);
  await loadBuildsForCharacter(activeCharId);

  // --- Render Lab content for a specific build ---
  async function renderLab(build, character) {
    contentArea.innerHTML = '';
    contentArea.appendChild(ui.skeleton());

    try {
      // Fetch required data: Best build (SQL Function demo), and current logs
      let bestBuild = null;
      try { bestBuild = await api.get(`/best-build/${character.id}`); } catch (e) { /* 404 is normal if no logs exist */ }
      const logs = await api.get(`/damage-logs?build_id=${build.id}`);

      contentArea.innerHTML = '';

      // a) Header Card
      const headerCard = ui.el('div', { class: 'lab-card' });
      const elColor = theme.elementColor(character.element);
      const isBest = bestBuild && bestBuild.build_id === build.id;

      const headTop = ui.el('div', { class: 'lab-build-head' },
        ui.el('h3', { style: { margin: 0 } },
          ui.el('span', { class: 'chip swatch', style: { backgroundColor: elColor } }, character.element),
          ` ${character.name} - ${build.build_name}`
        ),
        isBest ? ui.el('span', { class: 'lab-best-badge' }, `★ Best build, avg ${bestBuild.avg_damage?.toLocaleString() || 0}`) : ui.el('span', {})
      );

      const teamChips = (build.team_members || []).map(tm => ui.el('span', { class: 'chip' }, tm.teammate_name));
      const details = ui.el('div', { class: 'lab-build-details' },
        ui.el('span', {}, `⚔ ${build.weapon?.name || 'No Weapon'}`),
        ui.el('span', {}, ` • 🪷 ${build.artifact?.set_name || 'No Artifact'}`),
        teamChips.length ? ui.el('span', {}, ' • Team: ', ...teamChips) : ''
      );

      headerCard.appendChild(headTop);
      headerCard.appendChild(details);
      contentArea.appendChild(headerCard);

      // b) Add Form (Procedure & Trigger demo)
      const formCard = ui.el('div', { class: 'lab-card' });
      formCard.appendChild(ui.el('h4', { style: { marginTop: 0 } }, 'Log Damage (Stored Procedure Demo)'));

      const inputLabel = ui.el('input', { class: 'field', placeholder: 'e.g. Vaporize Burst', required: true });
      const inputVal = ui.el('input', { class: 'field', type: 'number', placeholder: 'Value', required: true, min: 0 });
      const inputNotes = ui.el('input', { class: 'field', placeholder: 'Notes (optional)' });
      const submitBtn = ui.el('button', { class: 'btn primary' }, 'Add Log');
      const inlineError = ui.el('div', { class: 'lab-error' });

      const setLabel = (lbl) => { inputLabel.value = lbl; inputVal.focus(); };
      const quickFill = ui.el('div', { class: 'lab-quick-fill' },
        ui.el('button', { class: 'btn ghost', onclick: () => setLabel('Normal Attack') }, 'Normal Attack'),
        ui.el('button', { class: 'btn ghost', onclick: () => setLabel('Elemental Skill') }, 'Skill'),
        ui.el('button', { class: 'btn ghost', onclick: () => setLabel('Elemental Burst') }, 'Burst')
      );

      const formRow = ui.el('form', { class: 'lab-form' }, inputLabel, inputVal, inputNotes, submitBtn);

      formRow.onsubmit = async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        inlineError.style.display = 'none';
        try {
          // Calls the stored procedure. The trigger validate_damage rejects negative values and returns a 400.
          await api.post('/procedures/add-damage-log', {
            build_id: build.id,
            label: inputLabel.value,
            damage_value: Number(inputVal.value),
            notes: inputNotes.value
          });
          ui.toast('Damage log added', 'success');
          inputLabel.value = ''; inputVal.value = ''; inputNotes.value = '';
          renderLab(build, character); // reload everything
        } catch (err) {
          ui.toast(err.message, 'error');
          inlineError.textContent = `Trigger blocked insert: ${err.message}`;
          inlineError.style.display = 'block';
        } finally {
          submitBtn.disabled = false;
        }
      };

      formCard.appendChild(quickFill);
      formCard.appendChild(formRow);
      formCard.appendChild(inlineError);
      formCard.appendChild(ui.el('p', { class: 'muted', style: { fontSize: '0.85rem', margin: '0.5rem 0 0 0' } }, 'Hint: Try a negative value to see the BEFORE INSERT trigger reject it.'));
      contentArea.appendChild(formCard);

      // c) Logs & Stats
      const logsCard = ui.el('div', { class: 'lab-card' });

      if (!logs.length) {
        logsCard.appendChild(ui.emptyState('No damage logs for this build yet.'));
        contentArea.appendChild(logsCard);
        return; // Don't render graphs if no logs
      }

      const runs = logs.length;
      const vals = logs.map(l => l.damage_value);
      const avg = Math.round(vals.reduce((a, b) => a + b, 0) / runs);
      const max = Math.max(...vals);
      const min = Math.min(...vals);

      const statsGrid = ui.el('div', { class: 'lab-stats' },
        ui.el('div', { class: 'lab-stat-box' }, ui.el('div', {}, 'Runs'), ui.el('strong', {}, runs)),
        ui.el('div', { class: 'lab-stat-box' }, ui.el('div', {}, 'Average'), ui.el('strong', {}, avg.toLocaleString())),
        ui.el('div', { class: 'lab-stat-box' }, ui.el('div', {}, 'Max'), ui.el('strong', {}, max.toLocaleString())),
        ui.el('div', { class: 'lab-stat-box' }, ui.el('div', {}, 'Min'), ui.el('strong', {}, min.toLocaleString()))
      );
      logsCard.appendChild(statsGrid);

      const tableCols = [
        { key: 'label', label: 'Label' },
        { key: 'damage_value', label: 'Damage', render: (r) => ui.el('span', { class: 'mono' }, r.damage_value.toLocaleString()) },
        { key: 'recorded_at', label: 'Time', render: (r) => new Date(r.recorded_at).toLocaleString() },
        { key: 'notes', label: 'Notes' },
        { key: 'actions', label: '', render: (r) => {
          const btn = ui.el('button', { class: 'icon-btn danger', 'aria-label': 'Delete' }, '✕');
          btn.onclick = async () => {
            if (await ui.confirmDialog('Delete this damage log?')) {
              try {
                await api.del(`/damage-logs/${r.id}`);
                ui.toast('Deleted', 'success');
                renderLab(build, character);
              } catch (e) { ui.toast(e.message, 'error'); }
            }
          };
          return btn;
        }}
      ];

      logsCard.appendChild(ui.table(tableCols, logs, { sortable: true }));
      contentArea.appendChild(logsCard);

      // d & e) Graphs (Chart.js + Matplotlib)
      const graphCard = ui.el('div', { class: 'lab-card' });
      graphCard.appendChild(ui.el('h4', { style: { marginTop: 0 } }, 'Visualizations'));

      // Client-side Chart.js
      const canvas = ui.el('canvas');
      const chartContainer = ui.el('div', { class: 'lab-chart-container' }, canvas);
      graphCard.appendChild(chartContainer);

      if (chartInstance) chartInstance.destroy();
      chartInstance = new Chart(canvas, {
        type: 'line',
        data: {
          labels: logs.map(l => new Date(l.recorded_at).toLocaleTimeString()),
          datasets: [{
            label: 'Damage',
            data: vals,
            borderColor: '#3FC9BE', // Teal
            backgroundColor: 'rgba(63, 201, 190, 0.1)',
            fill: true,
            tension: 0.2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#2A2E3A' }, ticks: { color: '#8B90A3', font: { family: 'JetBrains Mono' } } },
            x: { grid: { display: false }, ticks: { color: '#8B90A3' } }
          }
        }
      });

      // Server-side Matplotlib PNGs
      const uBuild = graphUrl('build', build.id);
      const uCompare = graphUrl('compare', character.id);

      const renderGraphBox = (url, title, filename) => {
        const box = ui.el('div', { class: 'lab-graph-box' });
        box.appendChild(ui.el('div', { style: { marginBottom: '0.5rem', fontWeight: 'bold' } }, title));
        const img = ui.el('img', { class: 'graph', src: url, alt: title });
        img.onerror = () => { img.style.display = 'none'; box.appendChild(ui.el('p', { class: 'muted' }, 'Graph unavailable.')); };
        box.appendChild(img);
        box.appendChild(ui.el('div', {}, ui.el('a', { href: url, download: filename, class: 'muted', style: { fontSize: '0.85rem' } }, 'Download PNG')));
        return box;
      };

      const pyGraphs = ui.el('div', { class: 'lab-graphs' },
        renderGraphBox(uBuild, 'Build Damage Distribution', 'build_graph.png'),
        renderGraphBox(uCompare, 'Character Builds Comparison', 'compare_graph.png')
      );

      graphCard.appendChild(pyGraphs);
      contentArea.appendChild(graphCard);

    } catch (err) {
      contentArea.innerHTML = '';
      ui.toast(err.message, 'error');
    }
  }
}

export function destroy() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}