import { assetImage, resolveArtifactAsset } from '../assets.js';

let activeContext = null;
let artifacts = [];
let searchQuery = '';
let loading = false;
let loadToken = 0;
let searchTimer = null;
let expandedIds = new Set();
let expandAll = false;
let currentModal = null;

const styles = `
.art-page { display:flex; flex-direction:column; gap:18px; min-width:0; }
.art-header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; }
.art-title { margin:0; color:var(--text); font-size:1.5rem; }
.art-subtitle { margin:5px 0 0; color:var(--muted); font-size:.9rem; }
.art-toolbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.art-search { flex:1; min-width:200px; max-width:460px; box-sizing:border-box; border:1px solid var(--border); border-radius:8px; padding:10px 12px; background:var(--surface-2); color:var(--text); font:inherit; }
.art-btn { cursor:pointer; border:1px solid var(--border); border-radius:8px; padding:9px 12px; background:var(--surface-2); color:var(--text); font:inherit; font-size:.86rem; }
.art-btn.primary { background:var(--teal); border-color:var(--teal); color:#101820; font-weight:600; }
.art-btn.danger { color:var(--red); }
.art-list { display:flex; flex-direction:column; gap:12px; }
.art-card { display:flex; flex-direction:column; gap:12px; min-width:0; }
.art-card-top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
.art-card-title { margin:0; color:var(--text); font-size:1.05rem; overflow-wrap:anywhere; }
.art-icon { width:52px; height:52px; flex-shrink:0; border-radius:8px; }
.art-preview { color:var(--muted); font-size:.87rem; line-height:1.5; margin-top:5px; overflow-wrap:anywhere; }
.art-toggle { display:flex; flex-direction:column; flex:1; min-width:0; cursor:pointer; border:0; background:transparent; padding:0; text-align:left; color:inherit; font:inherit; }
.art-chevron { color:var(--muted); flex-shrink:0; padding:2px 0 0 8px; }
.art-bonus-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.art-bonus { border:1px solid var(--border); background:var(--surface-2); border-radius:8px; padding:12px; min-width:0; }
.art-bonus-label { margin:0 0 7px; color:var(--teal); font-size:.78rem; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
.art-bonus-text { color:var(--text); font-size:.9rem; line-height:1.55; white-space:pre-wrap; overflow-wrap:anywhere; }
.art-actions { display:flex; flex-wrap:wrap; gap:8px; padding-top:2px; }
.art-muted { color:var(--muted); font-size:.86rem; }
.art-form { display:flex; flex-direction:column; gap:14px; }
.art-field { display:flex; flex-direction:column; gap:6px; }
.art-label { color:var(--muted); font-size:.86rem; }
.art-input, .art-textarea { width:100%; box-sizing:border-box; border:1px solid var(--border); border-radius:8px; padding:10px 12px; background:var(--surface-2); color:var(--text); font:inherit; }
.art-textarea { min-height:100px; resize:vertical; }
.art-form-actions { display:flex; gap:8px; flex-wrap:wrap; }
@media(max-width:650px) { .art-bonus-grid { grid-template-columns:1fr; } .art-search { max-width:none; width:100%; } .art-toolbar { align-items:stretch; } }
`;

function addStyles() {
  if (document.getElementById('artifacts-css')) return;
  const style = document.createElement('style');
  style.id = 'artifacts-css';
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

function artifactId(artifact) {
  return artifact?.artifact_id ?? artifact?.id;
}

function setName(artifact) {
  return String(artifact?.set_name ?? artifact?.name ?? 'Unnamed set');
}

function bonus2(artifact) {
  return String(artifact?.bonus_2pc ?? artifact?.two_piece_bonus ?? artifact?.two_pc_bonus ?? '');
}

function bonus4(artifact) {
  return String(artifact?.bonus_4pc ?? artifact?.four_piece_bonus ?? artifact?.four_pc_bonus ?? '');
}

function isExpanded(artifact) {
  return expandAll || expandedIds.has(String(artifactId(artifact)));
}

async function fetchArtifacts() {
  const response = await activeContext.api.get('/artifacts');
  return Array.isArray(response) ? response : (response?.artifacts ?? response?.data ?? []);
}

async function reloadArtifacts() {
  const token = ++loadToken;
  loading = true;
  renderContent();

  try {
    const rows = await fetchArtifacts();
    if (token !== loadToken) return;
    artifacts = rows.slice().sort((a, b) => setName(a).localeCompare(setName(b)));
  } catch (error) {
    if (token !== loadToken) return;
    artifacts = [];
    showToast(error?.message || 'Could not load artifact sets');
  } finally {
    if (token === loadToken) {
      loading = false;
      renderContent();
    }
  }
}

function makeButton(label, handler, className = 'art-btn') {
  const button = el('button', { type: 'button', className }, label);
  button.addEventListener('click', handler);
  return button;
}

function renderHeader(root) {
  const header = el('div', { className: 'art-header' });
  const heading = el('div', {});
  heading.appendChild(textNode('h1', 'art-title', 'Artifacts'));
  heading.appendChild(textNode('p', 'art-subtitle', 'Browse and manage artifact set bonuses.'));
  header.appendChild(heading);
  header.appendChild(makeButton('+ New set', () => openArtifactModal(), 'art-btn primary'));
  root.appendChild(header);
}

function renderToolbar(root) {
  const toolbar = el('div', { className: 'art-toolbar' });
  const search = el('input', {
    type: 'search',
    className: 'art-search',
    placeholder: 'Search artifact sets…',
    'aria-label': 'Search artifact sets',
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

  toolbar.appendChild(search);
  toolbar.appendChild(makeButton(
    expandAll ? 'Collapse all' : 'Expand all',
    () => {
      expandAll = !expandAll;
      if (!expandAll) expandedIds.clear();
      renderContent();
    }
  ));
  root.appendChild(toolbar);
}

function filteredArtifacts() {
  const query = searchQuery.trim().toLocaleLowerCase();
  return artifacts.filter((artifact) => setName(artifact).toLocaleLowerCase().includes(query));
}

function renderBonusBlock(label, value) {
  const block = el('section', { className: 'art-bonus' });
  block.appendChild(textNode('h3', 'art-bonus-label', label));
  block.appendChild(textNode('div', 'art-bonus-text', value || 'No bonus text available.'));
  return block;
}

function toggleArtifact(artifact) {
  const id = String(artifactId(artifact));
  if (expandedIds.has(id)) expandedIds.delete(id);
  else expandedIds.add(id);

  if (expandAll) {
    expandAll = false;
    expandedIds.add(id);
  }

  renderContent();
}

function renderArtifactCard(artifact) {
  const expanded = isExpanded(artifact);
  const card = el('article', { className: 'card art-card' });

  const top = el('div', { className: 'art-card-top' });
  top.appendChild(assetImage(activeContext.ui, {
    src: artifact?.assets?.icon_url || resolveArtifactAsset(artifact),
    alt: `${setName(artifact)} artifact set image`,
    className: 'art-icon',
    fallback: `${setName(artifact)} image unavailable`
  }));
  const toggle = el('button', {
    type: 'button',
    className: 'art-toggle',
    'aria-expanded': expanded ? 'true' : 'false'
  });

  toggle.appendChild(textNode('h2', 'art-card-title', setName(artifact)));
  toggle.appendChild(textNode('div', 'art-preview', `2pc: ${bonus2(artifact) || 'No bonus text available.'}`));
  toggle.addEventListener('click', () => toggleArtifact(artifact));

  top.appendChild(toggle);
  top.appendChild(textNode('span', 'art-chevron', expanded ? '⌃' : '⌄'));
  card.appendChild(top);

  if (expanded) {
    const bonuses = el('div', { className: 'art-bonus-grid' });
    bonuses.appendChild(renderBonusBlock('2-piece bonus', bonus2(artifact)));
    bonuses.appendChild(renderBonusBlock('4-piece bonus', bonus4(artifact)));
    card.appendChild(bonuses);
  }

  const actions = el('div', { className: 'art-actions' });
  actions.appendChild(makeButton('Edit', () => openArtifactModal(artifact)));
  actions.appendChild(makeButton('Delete', () => deleteArtifact(artifact), 'art-btn danger'));
  card.appendChild(actions);

  return card;
}

function renderContent() {
  const root = document.getElementById('artifacts-content');
  if (!root) return;
  root.replaceChildren();

  if (loading) {
    root.appendChild(activeContext.ui.skeleton());
    return;
  }

  const filtered = filteredArtifacts();
  if (!filtered.length) {
    root.appendChild(activeContext.ui.emptyState(
      artifacts.length ? 'No artifact sets match your search.' : 'No artifact sets yet. Add one with “+ New set”.'
    ));
    return;
  }

  const list = el('div', { className: 'art-list' });
  filtered.forEach((artifact) => list.appendChild(renderArtifactCard(artifact)));
  root.appendChild(list);
}

function formField(label, control) {
  const field = el('div', { className: 'art-field' });
  field.appendChild(textNode('label', 'art-label', label));
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

function openArtifactModal(artifact = null) {
  const editing = Boolean(artifact);
  const form = el('form', { className: 'art-form' });

  const nameInput = el('input', {
    type: 'text',
    className: 'art-input',
    name: 'set_name',
    required: true,
    maxLength: 160,
    placeholder: 'Artifact set name',
    value: String(artifact?.set_name ?? artifact?.name ?? '')
  });

  const bonus2Input = el('textarea', {
    className: 'art-textarea',
    name: 'bonus_2pc',
    required: true,
    placeholder: '2-piece bonus',
    value: bonus2(artifact)
  });

  const bonus4Input = el('textarea', {
    className: 'art-textarea',
    name: 'bonus_4pc',
    required: true,
    placeholder: '4-piece bonus',
    value: bonus4(artifact)
  });

  form.appendChild(formField('Set name', nameInput));
  form.appendChild(formField('2-piece bonus', bonus2Input));
  form.appendChild(formField('4-piece bonus', bonus4Input));

  const actions = el('div', { className: 'art-form-actions' });
  actions.appendChild(makeButton(editing ? 'Save changes' : 'Create set', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      showToast('Set name is required', 'warning');
      return;
    }

    await saveArtifact(artifact, {
      set_name: name,
      bonus_2pc: bonus2Input.value.trim(),
      bonus_4pc: bonus4Input.value.trim()
    });
  }, 'art-btn primary'));
  actions.appendChild(makeButton('Cancel', closeModal));
  form.appendChild(actions);

  showModal(editing ? 'Edit artifact set' : 'New artifact set', form);
}

function isConflict(error) {
  return error?.status === 409 ||
    error?.statusCode === 409 ||
    error?.response?.status === 409;
}

async function saveArtifact(artifact, payload) {
  try {
    if (artifact) {
      await activeContext.api.put(`/artifacts/${encodeURIComponent(artifactId(artifact))}`, payload);
      showToast('Artifact set updated', 'success');
    } else {
      await activeContext.api.post('/artifacts', payload);
      showToast('Artifact set created', 'success');
    }
    closeModal();
    await reloadArtifacts();
  } catch (error) {
    if (!artifact && isConflict(error)) {
      showToast('A set with that name already exists', 'error');
    } else {
      showToast(error?.message || `Could not ${artifact ? 'update' : 'create'} artifact set`);
    }
  }
}

function deleteArtifact(artifact) {
  activeContext.ui.confirmDialog('Delete this artifact set?', async () => {
    try {
      await activeContext.api.del(`/artifacts/${encodeURIComponent(artifactId(artifact))}`);
      showToast('Artifact set deleted', 'success');
      expandedIds.delete(String(artifactId(artifact)));
      await reloadArtifacts();
    } catch (error) {
      if (isConflict(error)) {
        showToast('This set is used by a build and cannot be deleted', 'error');
      } else {
        showToast(error?.message || 'Could not delete artifact set');
      }
    }
  });
}

async function render(root, ctx) {
  activeContext = ctx;
  addStyles();
  root.replaceChildren();

  const page = el('div', { className: 'art-page' });
  root.appendChild(page);

  renderHeader(page);
  renderToolbar(page);

  const content = el('div', { id: 'artifacts-content', className: 'art-page' });
  page.appendChild(content);

  await reloadArtifacts();
}

function destroy() {
  loadToken++;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = null;
  closeModal();
  activeContext = null;
  artifacts = [];
  searchQuery = '';
  expandedIds.clear();
  expandAll = false;
  loading = false;
}

export { render, destroy };
