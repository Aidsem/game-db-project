import { assetImage, resolveWeaponAsset } from '../assets.js';

let activeContext = null;
let weapons = [];
let selectedType = 'All';
let searchQuery = '';
let loading = false;
let loadToken = 0;
let searchTimer = null;
let expandedDescriptions = new Set();
let currentModal = null;

const TYPES = ['All', 'Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst'];

const styles = `
.wpn-page { display:flex; flex-direction:column; gap:18px; min-width:0; }
.wpn-header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; }
.wpn-title { margin:0; color:var(--text); font-size:1.5rem; }
.wpn-subtitle { margin:5px 0 0; color:var(--muted); font-size:.9rem; }
.wpn-toolbar { display:flex; flex-direction:column; gap:12px; }
.wpn-filter-row { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
.wpn-segments { display:flex; gap:5px; flex-wrap:wrap; }
.wpn-segment { border:1px solid var(--border); border-radius:8px; padding:8px 12px; background:var(--surface); color:var(--muted); cursor:pointer; font:inherit; font-size:.86rem; }
.wpn-segment.active { color:var(--text); border-color:var(--teal); background:var(--surface-2); }
.wpn-search { width:min(100%,320px); box-sizing:border-box; border:1px solid var(--border); border-radius:8px; padding:10px 12px; background:var(--surface-2); color:var(--text); font:inherit; }
.wpn-group { display:flex; flex-direction:column; gap:10px; }
.wpn-group-heading { display:flex; align-items:center; gap:9px; margin:0; font-size:1.08rem; color:var(--text); }
.wpn-count { font-size:.78rem; font-weight:500; color:var(--muted); background:var(--surface-2); border:1px solid var(--border); border-radius:999px; padding:2px 8px; }
.wpn-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.wpn-card { display:flex; flex-direction:column; gap:10px; min-width:0; border-top:1px solid var(--border); }
.wpn-icon { width:64px; height:64px; align-self:flex-start; border-radius:8px; }
.wpn-type-line { display:flex; align-items:center; gap:7px; }
.wpn-type-icon { width:24px; height:24px; }
.wpn-card.rarity-5 { border-top:3px solid var(--amber); }
.wpn-card.rarity-4 { border-top:3px solid var(--violet); }
.wpn-card-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
.wpn-name { margin:0; font-size:1rem; line-height:1.4; color:var(--text); overflow-wrap:anywhere; }
.wpn-rarity { flex-shrink:0; color:var(--amber); white-space:nowrap; letter-spacing:1px; font-size:.84rem; }
.wpn-type { color:var(--muted); font-size:.78rem; }
.wpn-description { margin:0; color:var(--muted); font-size:.86rem; line-height:1.5; white-space:pre-wrap; overflow-wrap:anywhere; cursor:pointer; }
.wpn-description.clamped { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.wpn-description:focus-visible { outline:2px solid var(--teal); outline-offset:3px; border-radius:3px; }
.wpn-card-actions { display:flex; gap:8px; margin-top:auto; padding-top:4px; }
.wpn-btn { cursor:pointer; border:1px solid var(--border); border-radius:8px; padding:8px 11px; background:var(--surface-2); color:var(--text); font:inherit; font-size:.84rem; }
.wpn-btn.primary { background:var(--teal); border-color:var(--teal); color:#101820; font-weight:600; }
.wpn-btn.danger { color:var(--red); }
.wpn-empty { color:var(--muted); font-size:.9rem; }
.wpn-form { display:flex; flex-direction:column; gap:14px; }
.wpn-field { display:flex; flex-direction:column; gap:6px; }
.wpn-label { color:var(--muted); font-size:.86rem; }
.wpn-input, .wpn-select, .wpn-textarea { width:100%; box-sizing:border-box; border:1px solid var(--border); border-radius:8px; padding:10px 12px; background:var(--surface-2); color:var(--text); font:inherit; }
.wpn-textarea { min-height:100px; resize:vertical; }
.wpn-form-actions { display:flex; gap:8px; flex-wrap:wrap; }
@media(max-width:1000px) { .wpn-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media(max-width:650px) { .wpn-grid { grid-template-columns:1fr; } .wpn-search { width:100%; } .wpn-filter-row { align-items:stretch; } }
`;

function addStyles() {
  if (document.getElementById('weapons-css')) return;
  const style = document.createElement('style');
  style.id = 'weapons-css';
  style.textContent = styles;
  document.head.appendChild(style);
}

function el(tag, attrs = {}, children = []) {
  return activeContext.ui.el(tag, attrs, children);
}

function textNode(tag, className, value) {
  return el(tag, { className }, value == null ? '' : String(value));
}

function showToast(message, type = 'error') {
  activeContext?.ui?.toast(message, type);
}

function weaponId(weapon) {
  return weapon?.weapon_id ?? weapon?.id;
}

function weaponName(weapon) {
  return String(weapon?.name ?? weapon?.weapon_name ?? 'Unnamed weapon');
}

function weaponType(weapon) {
  return String(weapon?.type ?? weapon?.weapon_type ?? 'Other');
}

function weaponRarity(weapon) {
  const value = Number(weapon?.rarity);
  return Number.isFinite(value) ? value : 0;
}

function rarityDiamonds(rarity) {
  const helper = activeContext?.theme?.rarityDiamonds;
  if (typeof helper === 'function') {
    try {
      return String(helper(rarity));
    } catch (_) {
      // Fall back to a simple text representation if the theme helper cannot render this rarity.
    }
  }
  const value = Number(rarity);
  return Number.isFinite(value) && value > 0 ? '◆'.repeat(value) : '—';
}

function sortedWeapons(items) {
  return items.slice().sort((a, b) =>
    weaponRarity(b) - weaponRarity(a) ||
    weaponName(a).localeCompare(weaponName(b))
  );
}

function filteredWeapons() {
  const query = searchQuery.trim().toLocaleLowerCase();
  return sortedWeapons(weapons).filter((weapon) => {
    const matchesType = selectedType === 'All' || weaponType(weapon).toLowerCase() === selectedType.toLowerCase();
    const matchesQuery = !query ||
      weaponName(weapon).toLocaleLowerCase().includes(query) ||
      weaponType(weapon).toLocaleLowerCase().includes(query) ||
      String(weapon?.description ?? '').toLocaleLowerCase().includes(query);
    return matchesType && matchesQuery;
  });
}

async function fetchWeapons() {
  const response = await activeContext.api.get('/weapons');
  return Array.isArray(response) ? response : (response?.weapons ?? response?.data ?? []);
}

async function reloadWeapons() {
  const token = ++loadToken;
  loading = true;
  renderContent();

  try {
    const result = await fetchWeapons();
    if (token !== loadToken) return;
    weapons = result;
  } catch (error) {
    if (token !== loadToken) return;
    showToast(error?.message || 'Could not load weapons');
  } finally {
    if (token === loadToken) {
      loading = false;
      renderContent();
    }
  }
}

function makeButton(label, handler, className = 'wpn-btn') {
  const button = el('button', { type: 'button', className }, label);
  button.addEventListener('click', handler);
  return button;
}

function renderHeader(root) {
  const header = el('div', { className: 'wpn-header' });
  const heading = el('div', {});
  heading.appendChild(textNode('h1', 'wpn-title', 'Weapons'));
  heading.appendChild(textNode('p', 'wpn-subtitle', 'Browse and manage weapon data in the reference database.'));
  header.appendChild(heading);
  header.appendChild(makeButton('+ New weapon', () => openWeaponModal(), 'wpn-btn primary'));
  root.appendChild(header);
}

function renderToolbar(root) {
  const toolbar = el('div', { className: 'wpn-toolbar' });
  const row = el('div', { className: 'wpn-filter-row' });
  const segments = el('div', { className: 'wpn-segments', role: 'group', 'aria-label': 'Filter weapons by type' });

  TYPES.forEach((type) => {
    const segment = makeButton(type, () => {
      selectedType = type;
      renderContent();
    }, `wpn-segment${selectedType === type ? ' active' : ''}`);
    segment.setAttribute('aria-pressed', selectedType === type ? 'true' : 'false');
    segments.appendChild(segment);
  });

  const search = el('input', {
    type: 'search',
    className: 'wpn-search',
    placeholder: 'Search weapons…',
    'aria-label': 'Search weapons',
    value: searchQuery
  });
  search.addEventListener('input', () => {
    const value = search.value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = value;
      renderContent();
    }, 250);
  });

  row.appendChild(segments);
  row.appendChild(search);
  toolbar.appendChild(row);
  root.appendChild(toolbar);
}

function renderWeaponCard(weapon) {
  const rarity = weaponRarity(weapon);
  const card = el('article', { className: `card wpn-card${rarity === 5 ? ' rarity-5' : rarity === 4 ? ' rarity-4' : ''}` });
  card.appendChild(assetImage(activeContext.ui, {
    src: weapon?.assets?.image_url || resolveWeaponAsset(weapon),
    alt: `${weaponName(weapon)} image`,
    className: 'wpn-icon',
    fallback: `${weaponName(weapon)} image unavailable`
  }));
  const heading = el('div', { className: 'wpn-card-heading' });
  const name = textNode('h3', 'wpn-name', weaponName(weapon));
  heading.appendChild(name);
  heading.appendChild(textNode('span', 'wpn-rarity rarity', rarityDiamonds(rarity)));
  card.appendChild(heading);
  const typeLine = el('div', { className: 'wpn-type-line' });
  typeLine.appendChild(assetImage(activeContext.ui, {
    src: weapon?.assets?.weapon_type_icon_url,
    alt: `${weaponType(weapon)} weapon type icon`,
    className: 'wpn-type-icon',
    fallback: 'No icon available'
  }));
  typeLine.appendChild(textNode('div', 'wpn-type', weaponType(weapon)));
  card.appendChild(typeLine);

  const descriptionText = String(weapon?.description ?? '');
  const description = el('p', {
    className: `wpn-description${expandedDescriptions.has(String(weaponId(weapon))) ? '' : ' clamped'}`,
    role: 'button',
    tabIndex: 0,
    title: 'Click to expand or collapse description',
    'aria-expanded': expandedDescriptions.has(String(weaponId(weapon))) ? 'true' : 'false'
  }, descriptionText || 'No description available.');
  const toggleDescription = () => {
    const id = String(weaponId(weapon));
    if (expandedDescriptions.has(id)) expandedDescriptions.delete(id);
    else expandedDescriptions.add(id);
    renderContent();
  };
  description.addEventListener('click', toggleDescription);
  description.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleDescription();
    }
  });
  card.appendChild(description);

  const actions = el('div', { className: 'wpn-card-actions' });
  actions.appendChild(makeButton('Edit', () => openWeaponModal(weapon)));
  actions.appendChild(makeButton('Delete', () => deleteWeapon(weapon), 'wpn-btn danger'));
  card.appendChild(actions);
  return card;
}

function renderContent() {
  const root = document.getElementById('weapons-content');
  if (!root) return;
  root.replaceChildren();

  if (loading) {
    root.appendChild(activeContext.ui.skeleton());
    return;
  }

  const filtered = filteredWeapons();
  if (!filtered.length) {
    root.appendChild(activeContext.ui.emptyState(
      weapons.length ? 'No weapons match your filters.' : 'No weapons yet. Add one with “+ New weapon”.'
    ));
    return;
  }

  const groups = new Map();
  filtered.forEach((weapon) => {
    const type = weaponType(weapon);
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(weapon);
  });

  const knownOrder = TYPES.filter((type) => type !== 'All');
  const groupNames = Array.from(groups.keys()).sort((a, b) => {
    const aIndex = knownOrder.indexOf(a);
    const bIndex = knownOrder.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });

  groupNames.forEach((type) => {
    const group = el('section', { className: 'wpn-group' });
    const heading = el('h2', { className: 'wpn-group-heading' });
    heading.appendChild(el('span', {}, type));
    heading.appendChild(textNode('span', 'wpn-count', String(groups.get(type).length)));
    group.appendChild(heading);

    const grid = el('div', { className: 'wpn-grid' });
    sortedWeapons(groups.get(type)).forEach((weapon) => grid.appendChild(renderWeaponCard(weapon)));
    group.appendChild(grid);
    root.appendChild(group);
  });
}

function formField(labelText, control) {
  const field = el('div', { className: 'wpn-field' });
  field.appendChild(textNode('label', 'wpn-label', labelText));
  field.appendChild(control);
  return field;
}

function closeModal() {
  if (activeContext?.ui?.closeModal) activeContext.ui.closeModal();
  else if (currentModal?.close) currentModal.close();
  else if (currentModal?.dismiss) currentModal.dismiss();
  else if (currentModal instanceof HTMLElement && currentModal.parentNode) currentModal.remove();
  currentModal = null;
}

function showModal(title, content) {
  closeModal();
  currentModal = activeContext.ui.openModal({ title, body: content });
}

function openWeaponModal(weapon = null) {
  const editing = Boolean(weapon);
  const form = el('form', { className: 'wpn-form' });

  const nameInput = el('input', {
    className: 'wpn-input',
    name: 'name',
    required: true,
    maxLength: 120,
    placeholder: 'Weapon name',
    value: weaponName(weapon || { name: '' }) === 'Unnamed weapon' ? '' : weaponName(weapon || { name: '' })
  });

  const typeSelect = el('select', { className: 'wpn-select', name: 'type', required: true });
  TYPES.filter((type) => type !== 'All').forEach((type) => {
    const option = el('option', { value: type }, type);
    if (weapon && weaponType(weapon) === type) option.selected = true;
    typeSelect.appendChild(option);
  });
  if (!weapon) typeSelect.value = 'Sword';

  const raritySelect = el('select', { className: 'wpn-select', name: 'rarity', required: true });
  [1, 2, 3, 4, 5].forEach((rarity) => {
    const option = el('option', { value: String(rarity) }, `${rarity} star${rarity === 1 ? '' : 's'} ${rarityDiamonds(rarity)}`);
    if (weaponRarity(weapon) === rarity) option.selected = true;
    raritySelect.appendChild(option);
  });
  if (!weapon) raritySelect.value = '1';

  const descriptionInput = el('textarea', {
    className: 'wpn-textarea',
    name: 'description',
    placeholder: 'Weapon description',
    value: String(weapon?.description ?? '')
  });

  form.appendChild(formField('Name', nameInput));
  form.appendChild(formField('Type', typeSelect));
  form.appendChild(formField('Rarity', raritySelect));
  form.appendChild(formField('Description', descriptionInput));

  const actions = el('div', { className: 'wpn-form-actions' });
  const save = makeButton(editing ? 'Save changes' : 'Create weapon', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      showToast('Weapon name is required', 'warning');
      return;
    }
    const payload = {
      name,
      type: typeSelect.value,
      rarity: Number(raritySelect.value),
      description: descriptionInput.value.trim()
    };
    await saveWeapon(weapon, payload);
  }, 'wpn-btn primary');
  actions.appendChild(save);
  actions.appendChild(makeButton('Cancel', closeModal));
  form.appendChild(actions);

  showModal(editing ? 'Edit weapon' : 'New weapon', form);
}

async function saveWeapon(weapon, payload) {
  try {
    if (weapon) {
      await activeContext.api.put(`/weapons/${encodeURIComponent(weaponId(weapon))}`, payload);
      showToast('Weapon updated', 'success');
    } else {
      await activeContext.api.post('/weapons', payload);
      showToast('Weapon created', 'success');
    }
    closeModal();
    await reloadWeapons();
  } catch (error) {
    if (!weapon && isConflict(error)) {
      showToast('A weapon with that name already exists', 'error');
    } else {
      showToast(error?.message || `Could not ${weapon ? 'update' : 'create'} weapon`);
    }
  }
}

function isConflict(error) {
  return error?.status === 409 ||
    error?.statusCode === 409 ||
    error?.response?.status === 409;
}

function deleteWeapon(weapon) {
  activeContext.ui.confirmDialog('Delete this weapon?', async () => {
    try {
      await activeContext.api.del(`/weapons/${encodeURIComponent(weaponId(weapon))}`);
      showToast('Weapon deleted', 'success');
      await reloadWeapons();
    } catch (error) {
      if (isConflict(error)) {
        showToast('This weapon is used by a build, so it cannot be deleted (ON DELETE RESTRICT)', 'error');
      } else {
        showToast(error?.message || 'Could not delete weapon');
      }
    }
  });
}

async function render(root, ctx) {
  activeContext = ctx;
  addStyles();
  root.replaceChildren();

  const page = el('div', { className: 'wpn-page' });
  root.appendChild(page);
  renderHeader(page);
  renderToolbar(page);

  const content = el('div', { id: 'weapons-content', className: 'wpn-page' });
  page.appendChild(content);

  await reloadWeapons();
}

function destroy() {
  loadToken++;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = null;
  closeModal();
  activeContext = null;
  weapons = [];
  selectedType = 'All';
  searchQuery = '';
  expandedDescriptions.clear();
  loading = false;
}

export { render, destroy };
