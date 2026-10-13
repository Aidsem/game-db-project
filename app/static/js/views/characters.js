// app/static/js/views/characters.js

// DB Feature: Table characters with PK id, UNIQUE name and release_order, CHECK rarity 1 to 5
let activeCharacters = [];

export async function render(root, ctx) {
  const { api, ui, theme, params } = ctx;
  root.innerHTML = '';

  // Inject view-specific styles
  if (!document.getElementById('char-css')) {
    const style = ui.el('style', { id: 'char-css' }, `
      .char-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem; }
      .char-title-group { display: flex; align-items: center; gap: 0.75rem; }
      .char-card { border-left-width: 3px; border-left-style: solid; display: flex; flex-direction: column; gap: 0.5rem; }
      .char-card-top { display: flex; justify-content: space-between; align-items: flex-start; }
      .char-card-name { font-weight: 600; font-size: 1.1rem; }
      .char-card-meta { display: flex; gap: 0.5rem; align-items: center; font-size: 0.85rem; color: var(--muted); }
      .char-drawer-section { margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--border); }
      .char-drawer-title { font-size: 0.95rem; font-weight: 600; color: var(--teal); margin-bottom: 0.5rem; text-transform: lowercase; }
      .char-build-item { background: var(--surface-2); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 0.5rem; }
      .char-chip-group { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.25rem; }
      .char-actions { display: flex; gap: 0.5rem; margin-top: 1.5rem; flex-wrap: wrap; }
      @media {max-width: 800px} {
        .char-head { flex-direction: column; align-items: stretch; }
        .toolbar { flex-direction: column; align-items: stretch; }
      }
    `);
    document.head.appendChild(style);
  }

  // Filter and sort state initialized from hash params
  const state = {
    q: params.q || '',
    element: params.element || '',
    weapon_type: params.weapon_type || '',
    rarity: params.rarity || '',
    sort: params.sort || 'release_order'
  };

  // Setup DOM layout
  const countChip = ui.el('span', { class: 'chip' }, '0');
  const newBtn = ui.el('button', { class: 'btn primary', onclick: () => openCharacterModal() }, '+ New character');
  
  const pageHead = ui.el('div', { class: 'char-head' },
    ui.el('div', { class: 'char-title-group' },
      ui.el('h2', { style: { margin: 0 } }, 'Characters'),
      countChip
    ),
    newBtn
  );

  // Filter toolbar controls
  const searchInput = ui.el('input', {
    class: 'field',
    placeholder: 'Search name...',
    value: state.q,
    oninput: ui.debounce((e) => {
      state.q = e.target.value.trim();
      applyFiltersAndRender();
    }, 250)
  });

  const elementSelect = ui.el('select', {
    class: 'field',
    onchange: (e) => { state.element = e.target.value; applyFiltersAndRender(); }
  },
    ui.el('option', { value: '' }, 'All Elements'),
    ...['Pyro', 'Hydro', 'Electro', 'Cryo', 'Dendro', 'Geo', 'Anemo'].map(e => 
      ui.el('option', { value: e, selected: state.element === e }, e)
    )
  );

  const weaponSelect = ui.el('select', {
    class: 'field',
    onchange: (e) => { state.weapon_type = e.target.value; applyFiltersAndRender(); }
  },
    ui.el('option', { value: '' }, 'All Weapons'),
    ...['Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst'].map(w => 
      ui.el('option', { value: w, selected: state.weapon_type === w }, w)
    )
  );

  const raritySelect = ui.el('select', {
    class: 'field',
    onchange: (e) => { state.rarity = e.target.value; applyFiltersAndRender(); }
  },
    ui.el('option', { value: '' }, 'All Rarities'),
    ui.el('option', { value: '4', selected: state.rarity === '4' }, '4 Stars'),
    ui.el('option', { value: '5', selected: state.rarity === '5' }, '5 Stars')
  );

  const sortSelect = ui.el('select', {
    class: 'field',
    onchange: (e) => { state.sort = e.target.value; applyFiltersAndRender(); }
  },
    ui.el('option', { value: 'release_order', selected: state.sort === 'release_order' }, 'Release order'),
    ui.el('option', { value: 'name', selected: state.sort === 'name' }, 'Name A-Z'),
    ui.el('option', { value: 'rarity_desc', selected: state.sort === 'rarity_desc' }, 'Rarity high-low')
  );

  const clearBtn = ui.el('button', {
    class: 'btn ghost',
    onclick: () => {
      state.q = '';
      state.element = '';
      state.weapon_type = '';
      state.rarity = '';
      state.sort = 'release_order';
      searchInput.value = '';
      elementSelect.value = '';
      weaponSelect.value = '';
      raritySelect.value = '';
      sortSelect.value = 'release_order';
      applyFiltersAndRender();
    }
  }, 'Clear');

  const toolbar = ui.el('div', { class: 'toolbar' },
    searchInput,
    elementSelect,
    weaponSelect,
    raritySelect,
    sortSelect,
    clearBtn
  );

  const gridContainer = ui.el('div', { class: 'grid' });
  gridContainer.appendChild(ui.skeleton(6));

  root.appendChild(pageHead);
  root.appendChild(toolbar);
  root.appendChild(gridContainer);

  // Sync state to URL hash parameters
  function syncUrlParams() {
    const query = new URLSearchParams();
    if (state.q) query.set('q', state.q);
    if (state.element) query.set('element', state.element);
    if (state.weapon_type) query.set('weapon_type', state.weapon_type);
    if (state.rarity) query.set('rarity', state.rarity);
    if (state.sort && state.sort !== 'release_order') query.set('sort', state.sort);
    const queryString = query.toString();
    const newHash = `#/characters${queryString ? '?' + queryString : ''}`;
    history.replaceState(null, '', newHash);
  }

  // Client-side filtering and rendering
  function applyFiltersAndRender() {
    syncUrlParams();
    let list = activeCharacters.slice();

    if (state.q) {
      const query = state.q.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(query));
    }
    if (state.element) {
      list = list.filter(c => c.element === state.element);
    }
    if (state.weapon_type) {
      list = list.filter(c => c.weapon_type === state.weapon_type);
    }
    if (state.rarity) {
      list = list.filter(c => String(c.rarity) === String(state.rarity));
    }

    if (state.sort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (state.sort === 'rarity_desc') {
      list.sort((a, b) => b.rarity - a.rarity || a.release_order - b.release_order);
    } else {
      list.sort((a, b) => a.release_order - b.release_order);
    }

    countChip.textContent = String(list.length);
    gridContainer.innerHTML = '';

    if (!list.length) {
      gridContainer.appendChild(ui.emptyState('No characters found matching criteria.'));
      return;
    }

    list.forEach(char => {
      const elCol = theme.elementColor(char.element);
      const card = ui.el('div', {
        class: 'card clickable char-card',
        style: { borderLeftColor: elCol },
        onclick: () => openCharacterDrawer(char.id)
      },
        ui.el('div', { class: 'char-card-top' },
          ui.el('div', { class: 'char-card-name' }, char.name),
          ui.el('div', { class: 'rarity' }, theme.rarityDiamonds(char.rarity))
        ),
        ui.el('div', { class: 'char-card-meta' },
          ui.el('span', { class: 'chip swatch', style: { backgroundColor: elCol } }, char.element),
          ui.el('span', {}, char.weapon_type)
        )
      );
      gridContainer.appendChild(card);
    });
  }

  // Load characters from API
  async function loadCharacters() {
    try {
      activeCharacters = await api.get('/characters');
      applyFiltersAndRender();

      if (params.open) {
        openCharacterDrawer(params.open);
      }
    } catch (err) {
      gridContainer.innerHTML = '';
      ui.toast(err.message, 'error');
    }
  }

  // Drawer detail view
  // DB Feature: Joins tier_list_combat, tier_list_exploration, builds and character_profiles JSONB table
  async function openCharacterDrawer(id) {
    ui.openDrawer({ title: 'Loading...', body: ui.skeleton(4) });

    try {
      const charData = await api.get(`/characters/${id}`);
      let profileData = null;

      try {
        profileData = await api.get(`/profiles/${id}`);
      } catch (e) {
        // 404 is expected if character lacks a JSONB profile
      }

      const elCol = theme.elementColor(charData.element);

      // Render builds list
      const buildsList = ui.el('div', {});
      if (charData.builds && charData.builds.length) {
        charData.builds.forEach(b => {
          const teamChips = (b.team_members || []).map(t =>
            ui.el('span', { class: 'chip' }, t.teammate_name)
          );
          buildsList.appendChild(
            ui.el('div', { class: 'char-build-item' },
              ui.el('div', { style: { fontWeight: '600' } }, b.build_name),
              ui.el('div', { class: 'muted', style: { fontSize: '0.85rem' } },
                `Weapon: ${b.weapon ? b.weapon.name : 'None'} | Artifact: ${b.artifact ? b.artifact.set_name : 'None'}`
              ),
              teamChips.length ? ui.el('div', { class: 'char-chip-group' }, ...teamChips) : null,
              b.average_damage ? ui.el('div', { class: 'mono', style: { fontSize: '0.85rem', marginTop: '0.25rem', color: 'var(--teal)' } },
                `Avg Damage: ${Math.round(b.average_damage).toLocaleString()}`
              ) : null
            )
          );
        });
      } else {
        buildsList.appendChild(ui.el('p', { class: 'muted' }, 'No builds registered yet.'));
      }

      // Combat Tiers
      const combatBadges = (charData.combat_tiers || []).map(ct =>
        ui.el('span', {
          class: 'tier-badge',
          style: { backgroundColor: theme.tierColor(ct.tier) }
        }, `${ct.tier} - ${ct.role}`)
      );

      // Exploration Tier
      const expTier = charData.exploration_tier ?
        ui.el('span', {
          class: 'tier-badge',
          style: { backgroundColor: theme.tierColor(charData.exploration_tier.tier) }
        }, charData.exploration_tier.tier) :
        ui.el('span', { class: 'muted' }, 'Unranked');

      // Profile section demonstrating 1 to 1 relation and JSONB column
      const profileSection = ui.el('div', { class: 'char-drawer-section' },
        ui.el('div', { class: 'char-drawer-title' }, 'JSONB profile'),
        profileData && profileData.profile ? ui.el('div', {},
          ui.el('div', { style: { marginBottom: '0.5rem' } },
            ui.el('span', { class: 'chip' }, profileData.profile.region || 'Unknown Region')
          ),
          profileData.profile.stat_priority ? ui.el('div', { class: 'char-chip-group', style: { marginBottom: '0.5rem' } },
            ...profileData.profile.stat_priority.map(s => ui.el('span', { class: 'chip swatch' }, s))
          ) : null,
          profileData.profile.playstyle ? ui.el('p', { class: 'muted', style: { fontSize: '0.85rem' } }, profileData.profile.playstyle) : null
        ) : ui.el('p', { class: 'muted' }, 'No profile yet')
      );

      const editBtn = ui.el('button', {
        class: 'btn',
        onclick: () => {
          ui.closeDrawer();
          openCharacterModal(charData);
        }
      }, 'Edit');

      // DB Feature: ON DELETE CASCADE constraint automatically cleans up tiers, builds, and logs
      const deleteBtn = ui.el('button', {
        class: 'btn danger',
        onclick: async () => {
          const confirmed = await ui.confirmDialog(`Delete ${charData.name}? Their tiers, builds and logs will also be deleted via ON DELETE CASCADE.`);
          if (confirmed) {
            try {
              await api.del(`/characters/${charData.id}`);
              ui.toast('Character deleted', 'success');
              ui.closeDrawer();
              await loadCharacters();
            } catch (err) {
              ui.toast(err.message, 'error');
            }
          }
        }
      }, 'Delete');

      const labBtn = ui.el('button', {
        class: 'btn primary',
        onclick: () => {
          ui.closeDrawer();
          location.hash = `#/damage-lab?character_id=${charData.id}`;
        }
      }, 'Open in Damage Lab');

      const drawerBody = ui.el('div', {},
        ui.el('div', { style: { display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' } },
          ui.el('span', { class: 'chip swatch', style: { backgroundColor: elCol } }, charData.element),
          ui.el('span', { class: 'muted' }, charData.weapon_type),
          ui.el('span', { class: 'rarity' }, theme.rarityDiamonds(charData.rarity))
        ),
        charData.description ? ui.el('p', { style: { fontSize: '0.9rem', marginBottom: '1rem' } }, charData.description) : null,

        ui.el('div', { class: 'char-drawer-section' },
          ui.el('div', { class: 'char-drawer-title' }, 'Combat tiers'),
          combatBadges.length ? ui.el('div', { class: 'char-chip-group' }, ...combatBadges) : ui.el('span', { class: 'muted' }, 'Unranked')
        ),

        ui.el('div', { class: 'char-drawer-section' },
          ui.el('div', { class: 'char-drawer-title' }, 'Exploration tier'),
          expTier
        ),

        ui.el('div', { class: 'char-drawer-section' },
          ui.el('div', { class: 'char-drawer-title' }, 'Recommended builds'),
          buildsList
        ),

        profileSection,

        ui.el('div', { class: 'char-actions' }, editBtn, deleteBtn, labBtn)
      );

      ui.openDrawer({ title: charData.name, body: drawerBody });
    } catch (err) {
      ui.toast(err.message, 'error');
      ui.closeDrawer();
    }
  }

  // Create / Edit modal handler
  // DB Feature: Catches HTTP 409 when PostgreSQL UNIQUE constraint on name or release_order is violated
  function openCharacterModal(character = null) {
    const isEdit = !!character;
    const maxOrder = activeCharacters.reduce((max, c) => Math.max(max, c.release_order || 0), 0);
    const defaultOrder = isEdit ? character.release_order : maxOrder + 1;

    const nameInput = ui.el('input', {
      class: 'field',
      required: true,
      value: isEdit ? character.name : ''
    });

    const orderInput = ui.el('input', {
      class: 'field',
      type: 'number',
      required: true,
      value: String(defaultOrder)
    });

    const raritySelectModal = ui.el('select', { class: 'field' },
      ...[1, 2, 3, 4, 5].map(r =>
        ui.el('option', { value: String(r), selected: isEdit ? character.rarity === r : r === 5 }, `${r} Stars`)
      )
    );

    const elementSelectModal = ui.el('select', { class: 'field' },
      ...['Pyro', 'Hydro', 'Electro', 'Cryo', 'Dendro', 'Geo', 'Anemo'].map(e =>
        ui.el('option', { value: e, selected: isEdit ? character.element === e : e === 'Pyro' }, e)
      )
    );

    const weaponSelectModal = ui.el('select', { class: 'field' },
      ...['Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst'].map(w =>
        ui.el('option', { value: w, selected: isEdit ? character.weapon_type === w : w === 'Sword' }, w)
      )
    );

    const descTextarea = ui.el('textarea', {
      class: 'field',
      rows: '3'
    }, isEdit && character.description ? character.description : '');

    const modalForm = ui.el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        const nameVal = nameInput.value.trim();
        const orderVal = parseInt(orderInput.value, 10);
        const rarityVal = parseInt(raritySelectModal.value, 10);

        if (!nameVal) {
          ui.toast('Name cannot be empty', 'error');
          return;
        }

        if (isNaN(rarityVal) || rarityVal < 1 || rarityVal > 5) {
          ui.toast('Rarity must be a number between 1 and 5', 'error');
          return;
        }

        const payload = {
          name: nameVal,
          release_order: isNaN(orderVal) ? defaultOrder : orderVal,
          rarity: rarityVal,
          element: elementSelectModal.value,
          weapon_type: weaponSelectModal.value,
          description: descTextarea.value.trim()
        };

        try {
          if (isEdit) {
            await api.put(`/characters/${character.id}`, payload);
            ui.toast('Character updated successfully', 'success');
          } else {
            await api.post('/characters', payload);
            ui.toast('Character created successfully', 'success');
          }
          ui.closeModal();
          await loadCharacters();
        } catch (err) {
          if (err.message && err.message.includes('409')) {
            ui.toast('A character with that name or release order already exists', 'error');
          } else {
            ui.toast(err.message, 'error');
          }
        }
      }
    },
      ui.el('div', { class: 'field' },
        ui.el('label', {}, 'Character name'),
        nameInput
      ),
      ui.el('div', { class: 'field' },
        ui.el('label', {}, 'Release order'),
        orderInput
      ),
      ui.el('div', { class: 'field' },
        ui.el('label', {}, 'Rarity'),
        raritySelectModal
      ),
      ui.el('div', { class: 'field' },
        ui.el('label', {}, 'Element'),
        elementSelectModal
      ),
      ui.el('div', { class: 'field' },
        ui.el('label', {}, 'Weapon type'),
        weaponSelectModal
      ),
      ui.el('div', { class: 'field' },
        ui.el('label', {}, 'Description'),
        descTextarea
      ),
      ui.el('div', { class: 'form-actions' },
        ui.el('button', { type: 'button', class: 'btn', onclick: ui.closeModal }, 'Cancel'),
        ui.el('button', { type: 'submit', class: 'btn primary' }, isEdit ? 'Save changes' : 'Create character')
      )
    );

    ui.openModal({
      title: isEdit ? `Edit ${character.name}` : 'New character',
      body: modalForm
    });
  }

  // Initial render step
  await loadCharacters();
}

export function destroy() {
  activeCharacters = [];
}