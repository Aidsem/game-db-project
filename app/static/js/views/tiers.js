// app/static/js/views/tiers.js
import { characterVisual } from '../assets.js';

// DB Feature: Demonstrates tier_list_combat and tier_list_exploration tables
// FK to characters table with ON DELETE CASCADE, CHECK constraint on tier (S, A, B, C, D)
// UNIQUE constraints on (character_id, role) for combat, and character_id for exploration

let currentMode = 'combat';
let editMode = false;
let renderRequest = 0;

export async function render(root, ctx) {
  const { api, ui, theme, params } = ctx;
  root.innerHTML = '';

  // Inject view-specific styles
  if (!document.getElementById('tier-css')) {
    const style = ui.el('style', { id: 'tier-css' }, `
      .tier-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem; }
      .tier-header h2 { margin: 0; font-family: 'Fraunces', serif; }
      .tier-summary { color: var(--muted); font-size: 0.9rem; margin-bottom: 1rem; }
      .tier-controls { display:flex; gap:1rem; align-items:center; flex-wrap:wrap; margin-bottom:1rem; }
      .tier-switch { display:flex; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:3px; }
      .tier-switch-btn { padding:.55rem 1rem; border:0; background:transparent; color:var(--muted); cursor:pointer; border-radius:6px; font:inherit; font-size:.9rem; }
      .tier-switch-btn.active { background:#1769cf; color:white; font-weight:600; }
      .tier-board { display:grid; grid-template-columns:64px repeat(3,minmax(0,1fr)); min-width:760px; border:1px solid var(--border); background:var(--surface); }
      .tier-board-wrap { overflow-x:auto; border-radius:9px; }
      .tier-column-head { background:#171d29; color:var(--text); padding:13px 8px; text-align:center; font-weight:700; border-left:1px solid var(--border); }
      .tier-column-head:first-child { border-left:0; }
      .tier-row { display:contents; }
      .tier-label-box { min-height:132px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:800; font-size:1.4rem; color:#14161C; padding:.5rem; text-align:center; border-top:1px solid var(--border); }
      .tier-count { font-size:.72rem; opacity:.85; font-family:'JetBrains Mono',monospace; margin-top:.15rem; }
      .tier-content { padding:9px; display:grid; grid-template-columns:repeat(auto-fill,minmax(64px,1fr)); align-content:start; gap:7px; min-height:132px; border-left:1px solid var(--border); border-top:1px solid var(--border); background:rgba(5,10,19,.38); }
      .tier-tile { position:relative; display:flex; flex-direction:column; align-items:center; gap:3px; min-width:0; text-align:center; }
      .tier-tile-link { display:flex; flex-direction:column; align-items:center; gap:3px; width:100%; color:var(--text); font-size:.68rem; line-height:1.2; }
      .tier-character-avatar { width:50px; min-width:50px; height:50px; }
      .tier-character-name { max-width:100%; overflow-wrap:anywhere; }
      .tier-del-btn { position:absolute; z-index:1; top:-4px; right:-4px; width:21px; height:21px; border:1px solid var(--border); border-radius:50%; background:#291c24; color:var(--red); cursor:pointer; }
      .tier-add-btn { grid-column:1/-1; justify-self:start; width:30px; height:30px; border-radius:50%; border:1px dashed var(--teal); color:var(--teal); background:transparent; font-size:1rem; cursor:pointer; }
      .tier-empty { color:var(--muted); padding:8px; font-size:.8rem; }
      @media(max-width:650px) { .tier-board { min-width:700px; } .tier-content,.tier-label-box { min-height:112px; } .tier-character-avatar { width:44px; min-width:44px; height:44px; } }
    `);
    document.head.appendChild(style);
  }

  currentMode = params.mode === 'exploration' ? 'exploration' : 'combat';

  const updateModeHash = (mode) => {
    currentMode = mode;
    const url = new URLSearchParams(window.location.hash.split('?')[1] || '');
    url.set('mode', mode);
    history.replaceState(null, '', `#/tiers?${url.toString()}`);
  };

  const titleText = ui.el('h2', {}, 'Tier List');
  const editBtn = ui.el('button', {
    class: `btn ${editMode ? 'primary' : 'ghost'}`,
    onclick: () => {
      editMode = !editMode;
      renderPage();
    }
  }, editMode ? 'Done Editing' : 'Edit mode');

  const pageHead = ui.el('div', { class: 'tier-header' },
    ui.el('div', {}, titleText),
    editBtn
  );

  const summaryLine = ui.el('div', { class: 'tier-summary' });
  const controlsBar = ui.el('div', { class: 'tier-controls' });
  const boardContainer = ui.el('div', {});

  root.appendChild(pageHead);
  root.appendChild(summaryLine);
  root.appendChild(controlsBar);
  root.appendChild(boardContainer);

  let selectedElement = 'All';

  async function renderPage() {
    const requestId = ++renderRequest;
    summaryLine.innerHTML = '';
    controlsBar.innerHTML = '';
    boardContainer.innerHTML = '';
    boardContainer.appendChild(ui.skeleton(5));

    const combatSwitch = ui.el('button', {
      class: `tier-switch-btn ${currentMode === 'combat' ? 'active' : ''}`,
      onclick: () => {
        if (currentMode !== 'combat') {
          updateModeHash('combat');
          renderPage();
        }
      }
    }, 'Combat');

    const expSwitch = ui.el('button', {
      class: `tier-switch-btn ${currentMode === 'exploration' ? 'active' : ''}`,
      onclick: () => {
        if (currentMode !== 'exploration') {
          updateModeHash('exploration');
          renderPage();
        }
      }
    }, 'Exploration');

    const modeSwitch = ui.el('div', { class: 'tier-switch' }, combatSwitch, expSwitch);

    const elemOptions = ['All', 'Pyro', 'Hydro', 'Electro', 'Cryo', 'Dendro', 'Geo', 'Anemo'];
    const elemSelect = ui.el('select', {
      class: 'field',
      onchange: (e) => {
        selectedElement = e.target.value;
        renderPage();
      }
    }, ...elemOptions.map(e => ui.el('option', { value: e, selected: selectedElement === e }, e)));

    controlsBar.appendChild(modeSwitch);
    controlsBar.appendChild(ui.el('div', {}, ui.el('label', { class: 'stat-label' }, 'Element'), elemSelect));

    try {
      // DB Feature: JOINs characters with tier tables
      const [allCharacters, tierData] = await Promise.all([
        api.get('/characters'),
        api.get(currentMode === 'combat' ? '/tier-lists/combat' : '/tier-lists/exploration')
      ]);
      if (requestId !== renderRequest) return;

      const charMap = new Map(allCharacters.map(c => [c.id, c]));

      let filteredData = tierData.filter(item => {
        const char = charMap.get(item.character_id);
        if (!char) return false;
        if (selectedElement !== 'All' && char.element !== selectedElement) return false;
        return true;
      });

      const tierCounts = { S: 0, A: 0, B: 0, C: 0, D: 0 };
      const uniqueChars = new Set();

      filteredData.forEach(item => {
        if (tierCounts[item.tier] !== undefined) tierCounts[item.tier]++;
        uniqueChars.add(item.character_id);
      });

      summaryLine.textContent = `${uniqueChars.size} characters ranked · S tier: ${tierCounts.S}, A tier: ${tierCounts.A}, B tier: ${tierCounts.B}, C tier: ${tierCounts.C}, D tier: ${tierCounts.D}`;

      boardContainer.innerHTML = '';

      const board = ui.el('div', { class: 'tier-board' });
      board.appendChild(ui.el('div', { class: 'tier-column-head', 'aria-hidden': 'true' }, 'Tier'));
      const combatRoles = [
        { key: 'Main DPS', label: 'Main DPS' },
        { key: 'Sub DPS', label: 'Sub-DPS' },
        { key: 'Support', label: 'Support / Healer' }
      ];
      if (currentMode === 'combat') {
        combatRoles.forEach(role => board.appendChild(ui.el('div', { class: 'tier-column-head' }, role.label)));
      } else {
        board.appendChild(ui.el('div', { class: 'tier-column-head' }, 'Exploration'));
        board.style.gridTemplateColumns = '64px minmax(0,1fr)';
      }

      ['S', 'A', 'B', 'C', 'D'].forEach(tier => {
        const rowEntries = filteredData.filter(entry => entry.tier === tier);
        const labelBox = ui.el('div', {
          class: 'tier-label-box',
          style: { backgroundColor: theme.tierColor(tier) }
        }, ui.el('span', {}, tier), ui.el('span', { class: 'tier-count' }, `${rowEntries.length} ranked`));
        board.appendChild(labelBox);

        const roles = currentMode === 'combat' ? combatRoles : [{ key: 'Exploration', label: 'Exploration' }];
        roles.forEach(role => {
          const contentBox = ui.el('div', { class: 'tier-content' });
          const entries = rowEntries.filter(entry => currentMode === 'exploration' ||
            (role.key === 'Support' ? ['Support', 'Healer'].includes(entry.role) : entry.role === role.key));
          entries.forEach(entry => {
            const character = charMap.get(entry.character_id);
            if (!character) return;
            const name = character.name || entry.character_name || 'Unknown character';
            const tile = ui.el('div', { class: 'tier-tile' });
            const link = ui.el('a', {
              class: 'tier-tile-link',
              href: `#/characters?open=${encodeURIComponent(entry.character_id)}`,
              title: `${name}${entry.role ? ` · ${entry.role}` : ''} · ${tier} tier`
            });
            link.appendChild(characterVisual(ui, character, {
              compact: true,
              className: 'tier-character-avatar'
            }));
            link.appendChild(ui.el('span', { className: 'tier-character-name' }, name));
            tile.appendChild(link);
            if (editMode) {
              tile.appendChild(ui.el('button', {
                type: 'button', className: 'tier-del-btn', title: 'Remove entry',
                'aria-label': `Remove ${name} from ${tier} tier`,
                onclick: async () => {
                  const confirmed = await ui.confirmDialog(`Remove ${name} from ${tier} tier?`);
                  if (!confirmed) return;
                  try {
                    const endpoint = currentMode === 'combat' ? `/tier-lists/combat/${entry.id}` : `/tier-lists/exploration/${entry.id}`;
                    await api.del(endpoint);
                    ui.toast('Removed from tier list', 'success');
                    renderPage();
                  } catch (error) { ui.toast(error.message, 'error'); }
                }
              }, '×'));
            }
            contentBox.appendChild(tile);
          });
          if (!entries.length) contentBox.appendChild(ui.el('span', { className: 'tier-empty' }, '—'));
          if (editMode) contentBox.appendChild(ui.el('button', {
            type: 'button', className: 'tier-add-btn', title: `Add to ${tier} · ${role.label}`,
            'aria-label': `Add character to ${tier} tier, ${role.label}`,
            onclick: () => openAddModal(tier, allCharacters, currentMode === 'combat' ? role.key : '')
          }, '+'));
          board.appendChild(contentBox);
        });
      });
      const boardWrap = ui.el('div', { className: 'tier-board-wrap' }, board);
      boardContainer.replaceChildren(boardWrap);

    } catch (err) {
      if (requestId !== renderRequest) return;
      boardContainer.replaceChildren();
      boardContainer.appendChild(ui.el('div', { className: 'tier-error', role: 'alert' },
        ui.emptyState(`Tier list could not be loaded: ${err.message}`),
        ui.el('button', { className: 'btn', onclick: renderPage }, 'Retry')));
    }
  }

  // DB Feature: INSERT into tier_list_combat / tier_list_exploration with UNIQUE constraint checks
  function openAddModal(targetTier, allCharacters, initialRole = '') {
    const charSelect = ui.el('select', { class: 'field' },
      ...allCharacters.map(c => ui.el('option', { value: c.id }, `${c.name} (${c.element})`))
    );

    let roleSelect = null;
    if (currentMode === 'combat') {
      roleSelect = ui.el('select', { class: 'field' },
        ...['Main DPS', 'Sub DPS', 'Support', 'Healer'].map(r => ui.el('option', { value: r, selected: r === initialRole }, r))
      );
    }

    const modalForm = ui.el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        const charId = parseInt(charSelect.value, 10);
        try {
          if (currentMode === 'combat') {
            const payload = {
              character_id: charId,
              tier: targetTier,
              role: roleSelect.value
            };
            await api.post('/tier-lists/combat', payload);
          } else {
            const payload = {
              character_id: charId,
              tier: targetTier
            };
            await api.post('/tier-lists/exploration', payload);
          }
          ui.toast('Added to tier list', 'success');
          ui.closeModal();
          renderPage();
        } catch (err) {
          if (err.message && (err.message.includes('409') || err.message.toLowerCase().includes('duplicate') || err.message.toLowerCase().includes('already'))) {
            ui.toast(currentMode === 'combat' ? 'This character already has that role' : 'This character is already in the tier list', 'error');
          } else {
            ui.toast(err.message, 'error');
          }
        }
      }
    },
      ui.el('div', { class: 'field' },
        ui.el('label', {}, 'Character'),
        charSelect
      ),
      currentMode === 'combat' ? ui.el('div', { class: 'field' },
        ui.el('label', {}, 'Role'),
        roleSelect
      ) : null,
      ui.el('div', { class: 'form-actions' },
        ui.el('button', { type: 'button', class: 'btn', onclick: ui.closeModal }, 'Cancel'),
        ui.el('button', { type: 'submit', class: 'btn primary' }, `Add to ${targetTier} Tier`)
      )
    );

    ui.openModal({
      title: `Add Character to ${targetTier} Tier (${currentMode === 'combat' ? 'Combat' : 'Exploration'})`,
      body: modalForm
    });
  }

  await renderPage();
}

export function destroy() {
  renderRequest++;
}
