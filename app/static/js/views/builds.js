
import { assetImage, characterVisual, resolveArtifactAsset, resolveWeaponAsset } from '../assets.js';

let stylesAdded = false;
let activeContext = null;
let selectedCharacterId = '';
let selectedBuildId = '';
let activeRoot = null;
let characters = [];
let weapons = [];
let artifacts = [];
let builds = [];
let loading = false;
let buildError = '';
let referenceError = '';
let loadToken = 0;

const styles = `
.bld-page { display:flex; flex-direction:column; gap:18px; }
.bld-header { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
.bld-title { margin:0; color:var(--text); font-size:1.5rem; }
.bld-subtitle { margin:5px 0 0; color:var(--muted); font-size:.9rem; }
.bld-character-summary { display:flex; align-items:center; gap:12px; margin-top:12px; }
.bld-character-portrait { width:58px; min-width:58px; height:58px; }
.bld-character-details { display:flex; flex-direction:column; gap:2px; min-width:0; }
.bld-character-meta { color:var(--muted); font-size:.78rem; overflow-wrap:anywhere; }
.bld-character-name { font-weight:600; }
.bld-error { border:1px solid var(--red); border-radius:8px; padding:12px; color:var(--text); background:var(--surface); }
.bld-controls { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.bld-select-wrap { display:flex; flex-direction:column; gap:6px; min-width:220px; }
.bld-label { font-size:.82rem; color:var(--muted); }
.bld-select, .bld-input, .bld-textarea { width:100%; box-sizing:border-box; border:1px solid var(--border); border-radius:8px; padding:10px 12px; background:var(--surface-2); color:var(--text); font:inherit; }
.bld-textarea { min-height:80px; resize:vertical; }
.bld-build-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
.bld-character-group { display:flex; flex-direction:column; gap:10px; }
.bld-character-group + .bld-character-group { margin-top:8px; }
.bld-group-heading { display:flex; align-items:center; gap:9px; color:var(--text); font-size:1.05rem; }
.bld-group-heading .asset-image { width:36px; height:36px; border-radius:50%; }
.bld-build-card { display:flex; flex-direction:column; gap:14px; min-width:0; }
.bld-build-card.is-search-target { outline:2px solid var(--teal); outline-offset:2px; }
.bld-card-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.bld-build-name { margin:0; font-size:1.08rem; overflow-wrap:anywhere; }
.bld-section { display:flex; flex-direction:column; gap:7px; }
.bld-section-title { color:var(--muted); font-size:.78rem; text-transform:uppercase; letter-spacing:.05em; }
.bld-item-name { color:var(--text); font-weight:600; }
.bld-item-image { width:48px; height:48px; border-radius:8px; }
.bld-muted { color:var(--muted); font-size:.83rem; line-height:1.45; }
.bld-chips { display:flex; flex-wrap:wrap; gap:7px; }
.bld-chip { display:inline-flex; align-items:center; gap:7px; padding:5px 9px; border:1px solid var(--border); border-radius:999px; background:var(--surface-2); color:var(--text); font-size:.82rem; max-width:100%; }
.bld-chip-name { overflow-wrap:anywhere; }
.bld-remove { border:0; background:transparent; color:var(--red); cursor:pointer; font-size:1rem; line-height:1; padding:0 2px; }
.bld-damage { border-top:1px solid var(--border); padding-top:12px; display:flex; justify-content:space-between; align-items:center; gap:12px; }
.bld-damage-value { font-size:1.15rem; font-weight:700; color:var(--teal); }
.bld-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:auto; padding-top:4px; }
.bld-btn { cursor:pointer; border:1px solid var(--border); border-radius:8px; padding:9px 12px; background:var(--surface-2); color:var(--text); font:inherit; font-size:.86rem; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
.bld-btn.primary { background:var(--teal); border-color:var(--teal); color:#101820; font-weight:600; }
.bld-btn.danger { color:var(--red); }
.bld-btn:disabled { opacity:.5; cursor:not-allowed; }
.bld-form { display:flex; flex-direction:column; gap:14px; }
.bld-form-field { display:flex; flex-direction:column; gap:6px; }
.bld-form-label { color:var(--muted); font-size:.86rem; }
.bld-form-hint { color:var(--muted); font-size:.78rem; }
.bld-rarity { color:var(--amber); letter-spacing:1px; white-space:nowrap; }
.bld-artifact { display:flex; flex-direction:column; gap:4px; }
.bld-artifact-bonus { color:var(--muted); font-size:.82rem; line-height:1.45; }
.bld-no-data { color:var(--muted); font-size:.88rem; }
@media(max-width:800px) { .bld-build-list { grid-template-columns:1fr; } .bld-header { align-items:flex-start; } .bld-select-wrap { min-width:min(100%,260px); } }
`;

function addStyles() {
  if (document.getElementById('builds-css')) return;
  const style = document.createElement('style');
  style.id = 'builds-css';
  style.textContent = styles;
  document.head.appendChild(style);
}

function el(tag, attrs = {}, children = []) {
  return activeContext.ui.el(tag, attrs, children);
}

function textNode(tag, className, value) {
  return el(tag, { className }, value == null ? '' : String(value));
}

function button(label, onClick, className = 'bld-btn') {
  const node = el('button', { type: 'button', className }, label);
  node.addEventListener('click', onClick);
  return node;
}

function setHashCharacter(id) {
  selectedCharacterId = id == null ? '' : String(id);
  const params = new URLSearchParams();
  if (selectedCharacterId) params.set('character_id', selectedCharacterId);
  const hash = selectedCharacterId
    ? `#/builds?${params.toString()}`
    : '#/builds';
  window.location.hash = hash;
}

function showToast(message, type = 'error') {
  activeContext.ui.toast(message, type);
}

function getId(value) {
  return value?.id ?? value?.character_id ?? value?.weapon_id ?? value?.artifact_id ?? value?.build_id ?? value?.member_id ?? '';
}

function getCharacterName(character) {
  return character?.name ?? character?.character_name ?? 'Unknown character';
}

function getWeaponName(weapon) {
  return weapon?.name ?? weapon?.weapon_name ?? 'Unknown weapon';
}

function getArtifactName(artifact) {
  return artifact?.set_name ?? artifact?.name ?? artifact?.artifact_set_name ?? 'Unknown artifact set';
}

function getBuildId(build) {
  return build?.build_id ?? build?.id;
}

function getBuildWeapon(build) {
  return build?.weapon ?? build?.weapon_details ?? build?.weapon_data ?? null;
}

function getBuildArtifact(build) {
  return build?.artifact ?? build?.artifact_set ?? build?.artifact_details ?? build?.artifact_data ?? null;
}

function getBuildTeam(build) {
  return build?.team_members ?? build?.team ?? build?.members ?? [];
}

function rarityText(rarity) {
  const count = Number(rarity);
  if (Number.isFinite(count) && count > 0 && count <= 5) {
    return '◆'.repeat(count);
  }
  return '—';
}

function rarityLabel(item) {
  const rarity = item?.rarity ?? item?.rarity_stars ?? item?.star_rating;
  const helper = activeContext.theme?.rarityDiamonds;
  if (typeof helper === 'function' && rarity != null) {
    try {
      return helper(rarity);
    } catch (_) {
      return rarityText(rarity);
    }
  }
  return rarityText(rarity);
}

function formatNumber(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number)
    ? number.toLocaleString()
    : 'no data';
}

function safeString(value) {
  return value == null ? '' : String(value);
}

function openDamageLab() {
  if (!selectedCharacterId) return;
  window.location.hash = `#/damage-lab?character_id=${encodeURIComponent(selectedCharacterId)}`;
}

async function fetchCharacters() {
  const response = await activeContext.api.get('/characters');
  const rows = Array.isArray(response) ? response : (response?.characters ?? response?.data ?? []);
  return rows.slice().sort((a, b) => getCharacterName(a).localeCompare(getCharacterName(b)));
}

async function fetchBuilds(characterId) {
  const path = characterId ? `/builds?character_id=${encodeURIComponent(characterId)}` : '/builds';
  const response = await activeContext.api.get(path);
  return Array.isArray(response) ? response : (response?.builds ?? response?.data ?? []);
}

async function reloadBuilds() {
  const token = ++loadToken;
  loading = true;
  renderBuildArea();

  try {
    const rows = await fetchBuilds(selectedCharacterId || '');
    if (token !== loadToken) return;
    builds = rows;
    buildError = '';
  } catch (error) {
    if (token !== loadToken) return;
    builds = [];
    buildError = 'The Builds API could not be reached. Check the server/database connection and retry.';
  } finally {
    if (token === loadToken) {
      loading = false;
      renderBuildArea();
    }
  }
}

function renderCharacterPicker() {
  const wrap = el('div', { className: 'bld-select-wrap' });
  wrap.appendChild(textNode('label', 'bld-label', 'Character'));
  const select = el('select', { className: 'bld-select', 'aria-label': 'Select character' });
  const placeholder = el('option', { value: '' }, 'Choose a character…');
  select.appendChild(placeholder);

  characters.forEach((character) => {
    const id = getId(character);
    const option = el('option', { value: String(id) }, getCharacterName(character));
    if (String(id) === String(selectedCharacterId)) option.selected = true;
    select.appendChild(option);
  });

  select.value = selectedCharacterId;
  select.addEventListener('change', async () => {
    setHashCharacter(select.value);
    await reloadBuilds();
  });
  wrap.appendChild(select);
  return wrap;
}

function renderHeader(root) {
  const header = el('div', { className: 'bld-header' });
  const titleGroup = el('div', {});
  titleGroup.appendChild(textNode('h1', 'bld-title', 'Builds'));
  titleGroup.appendChild(textNode('p', 'bld-subtitle', 'Browse builds saved in this database by character, manage teams, and compare damage.'));
  const selected = characters.find((character) => String(getId(character)) === String(selectedCharacterId));
  if (selected) {
    const summary = el('div', { className: 'bld-character-summary' });
    summary.appendChild(characterVisual(activeContext.ui, selected, {
      compact: true,
      className: 'bld-character-portrait'
    }));
    const details = el('div', { className: 'bld-character-details' });
    details.appendChild(textNode('span', 'bld-character-name', getCharacterName(selected)));
    details.appendChild(textNode('span', 'bld-character-meta', [
      selected.rarity ? `${selected.rarity} star${Number(selected.rarity) === 1 ? '' : 's'}` : 'Rarity unspecified',
      selected.element || 'Element unspecified',
      selected.weapon_type || 'Weapon unspecified'
    ].join(' · ')));
    summary.appendChild(details);
    titleGroup.appendChild(summary);
  }
  header.appendChild(titleGroup);

  const controls = el('div', { className: 'bld-controls' });
  controls.appendChild(renderCharacterPicker());
  const newBuildButton = button('+ New build', () => openNewBuildModal(), 'bld-btn primary');
  newBuildButton.disabled = !selectedCharacterId || Boolean(referenceError);
  newBuildButton.title = selectedCharacterId ? '' : 'Choose a character before creating a build';
  controls.appendChild(newBuildButton);
  header.appendChild(controls);
  root.appendChild(header);
}

function renderBuildArea() {
  const root = document.getElementById('builds-content');
  if (!root) return;
  root.replaceChildren();

  if (loading) {
    root.appendChild(activeContext.ui.skeleton());
    return;
  }

  if (buildError) {
    const errorBox = el('div', { className: 'bld-error', role: 'alert' });
    errorBox.appendChild(textNode('p', 'bld-muted', `Builds could not be loaded: ${buildError}`));
    errorBox.appendChild(button('Retry', () => reloadBuilds(), 'bld-btn'));
    root.appendChild(errorBox);
    return;
  }

  if (referenceError) {
    const errorBox = el('div', { className: 'bld-error', role: 'alert' });
    errorBox.appendChild(textNode('p', 'bld-muted', `Weapon and artifact options could not be loaded: ${referenceError}`));
    errorBox.appendChild(button('Retry options', () => render(activeRoot, activeContext), 'bld-btn'));
    root.appendChild(errorBox);
  }

  if (!builds.length) {
    const empty = el('div', { className: 'bld-page' });
    empty.appendChild(activeContext.ui.emptyState(selectedCharacterId
      ? 'No saved builds for this character yet. Create one with “+ New build”.'
      : 'No saved builds yet. Choose a character to create the first build.'));
    root.appendChild(empty);
    return;
  }

  const characterMap = new Map(characters.map(character => [String(getId(character)), character]));
  const groups = selectedCharacterId
    ? [[selectedCharacterId, builds]]
    : Array.from(builds.reduce((map, build) => {
      const characterId = String(build.character_id ?? '');
      if (!map.has(characterId)) map.set(characterId, []);
      map.get(characterId).push(build);
      return map;
    }, new Map()).entries()).sort(([idA], [idB]) =>
      getCharacterName(characterMap.get(idA)).localeCompare(getCharacterName(characterMap.get(idB))));

  groups.forEach(([characterId, characterBuilds]) => {
    const group = el('section', { className: 'bld-character-group' });
    if (!selectedCharacterId) {
      const character = characterMap.get(String(characterId));
      const heading = el('h2', { className: 'bld-group-heading' });
      if (character) heading.appendChild(characterVisual(activeContext.ui, character, { compact: true }));
      heading.appendChild(textNode('span', '', character ? getCharacterName(character) : 'Unknown character'));
      group.appendChild(heading);
    }
    const list = el('div', { className: 'bld-build-list' });
    characterBuilds.forEach((build) => {
      const card = renderBuildCard(build);
      if (String(getBuildId(build)) === selectedBuildId) {
        card.id = `build-${selectedBuildId}`;
        card.classList.add('is-search-target');
      }
      list.appendChild(card);
    });
    group.appendChild(list);
    root.appendChild(group);
  });
  if (selectedBuildId) requestAnimationFrame(() => document.getElementById(`build-${selectedBuildId}`)?.scrollIntoView({ block: 'center' }));
}

function renderBuildCard(build) {
  const card = el('section', { className: 'card bld-build-card' });
  const heading = el('div', { className: 'bld-card-heading' });
  heading.appendChild(textNode('h2', 'bld-build-name', build?.build_name || 'Unnamed build'));
  card.appendChild(heading);

  const weapon = getBuildWeapon(build);
  const weaponSection = el('div', { className: 'bld-section' });
  weaponSection.appendChild(textNode('div', 'bld-section-title', 'Weapon'));
  if (weapon) {
    const row = el('div', { className: 'bld-chips' });
    row.appendChild(assetImage(activeContext.ui, {
      src: weapon?.assets?.image_url || resolveWeaponAsset(weapon),
      alt: `${getWeaponName(weapon)} image`,
      className: 'bld-item-image',
      fallback: `${getWeaponName(weapon)} image unavailable`
    }));
    row.appendChild(textNode('span', 'bld-item-name', getWeaponName(weapon)));
    row.appendChild(textNode('span', 'bld-rarity', rarityLabel(weapon)));
    weaponSection.appendChild(row);
  } else {
    weaponSection.appendChild(textNode('span', 'bld-no-data', 'No weapon selected'));
  }
  card.appendChild(weaponSection);

  const artifact = getBuildArtifact(build);
  const artifactSection = el('div', { className: 'bld-section' });
  artifactSection.appendChild(textNode('div', 'bld-section-title', 'Artifact set'));
  if (artifact) {
    const artifactInfo = el('div', { className: 'bld-artifact' });
    artifactInfo.appendChild(assetImage(activeContext.ui, {
      src: artifact?.assets?.icon_url || resolveArtifactAsset(artifact),
      alt: `${getArtifactName(artifact)} artifact set image`,
      className: 'bld-item-image',
      fallback: `${getArtifactName(artifact)} image unavailable`
    }));
    artifactInfo.appendChild(textNode('div', 'bld-item-name', getArtifactName(artifact)));
    const twoPc = artifact?.bonus_2pc ?? artifact?.two_piece_bonus ?? artifact?.two_pc_bonus ?? artifact?.effect_2pc;
    const fourPc = artifact?.bonus_4pc ?? artifact?.four_piece_bonus ?? artifact?.four_pc_bonus ?? artifact?.effect_4pc;
    if (twoPc) artifactInfo.appendChild(textNode('div', 'bld-artifact-bonus', `Documented 2-piece effect: ${twoPc}`));
    if (fourPc) artifactInfo.appendChild(textNode('div', 'bld-artifact-bonus', `Documented 4-piece effect: ${fourPc}`));
    if (twoPc || fourPc) {
      artifactInfo.appendChild(textNode('div', 'bld-artifact-bonus', 'Active artifact configuration is not recorded for this database build.'));
    }
    artifactSection.appendChild(artifactInfo);
  } else {
    artifactSection.appendChild(textNode('span', 'bld-no-data', 'No artifact set selected'));
  }
  card.appendChild(artifactSection);

  const teamSection = el('div', { className: 'bld-section' });
  teamSection.appendChild(textNode('div', 'bld-section-title', 'Team members'));
  const team = getBuildTeam(build);
  const chips = el('div', { className: 'bld-chips' });
  if (!team.length) {
    chips.appendChild(textNode('span', 'bld-no-data', 'No teammates added'));
  } else {
    team.forEach((member) => {
      const memberCharacter = member?.character ?? member?.member ?? member?.character_details ?? member;
      const memberId = member?.member_id ?? member?.team_member_id ?? member?.character_id ?? getId(memberCharacter);
      const chip = el('span', { className: 'bld-chip' });
      chip.appendChild(textNode('span', 'bld-chip-name', getCharacterName(memberCharacter)));
      const remove = el('button', {
        type: 'button',
        className: 'bld-remove',
        title: 'Remove teammate',
        'aria-label': `Remove ${getCharacterName(memberCharacter)}`
      }, '✕');
      remove.addEventListener('click', () => removeTeammate(build, memberId));
      chip.appendChild(remove);
      chips.appendChild(chip);
    });
  }
  teamSection.appendChild(chips);
  card.appendChild(teamSection);

  const damage = build?.average_damage ?? build?.avg_damage ?? build?.averageDamage;
  const damageRow = el('div', { className: 'bld-damage' });
  damageRow.appendChild(textNode('span', 'bld-muted', 'Average damage'));
  damageRow.appendChild(textNode('span', 'bld-damage-value', formatNumber(damage)));
  card.appendChild(damageRow);

  const actions = el('div', { className: 'bld-actions' });
  actions.appendChild(button('Add teammate', () => openAddTeammateModal(build), 'bld-btn'));
  const damageLink = el('a', {
    className: 'bld-btn',
    href: `#/damage-lab?character_id=${encodeURIComponent(build.character_id ?? selectedCharacterId)}`
  }, 'Open in Damage Lab');
  actions.appendChild(damageLink);
  actions.appendChild(button('Delete build', () => deleteBuild(build), 'bld-btn danger'));
  card.appendChild(actions);

  return card;
}

function formField(label, control, hint) {
  const field = el('div', { className: 'bld-form-field' });
  field.appendChild(textNode('label', 'bld-form-label', label));
  field.appendChild(control);
  if (hint) field.appendChild(textNode('div', 'bld-form-hint', hint));
  return field;
}

function makeSelect(options, placeholder) {
  const select = el('select', { className: 'bld-select' });
  select.appendChild(el('option', { value: '' }, placeholder));
  options.forEach((option) => {
    select.appendChild(el('option', { value: String(option.value) }, option.label));
  });
  return select;
}

async function loadWeaponsAndArtifacts() {
  const [weaponResponse, artifactResponse] = await Promise.all([
    activeContext.api.get('/weapons'),
    activeContext.api.get('/artifacts')
  ]);
  weapons = (Array.isArray(weaponResponse) ? weaponResponse : (weaponResponse?.weapons ?? weaponResponse?.data ?? []));
  artifacts = (Array.isArray(artifactResponse) ? artifactResponse : (artifactResponse?.artifacts ?? artifactResponse?.data ?? []));
}

function weaponOptionsForCharacter() {
  const character = characters.find((item) => String(getId(item)) === String(selectedCharacterId));
  const preferredType = character?.weapon_type ?? character?.weaponType ?? '';
  const sorted = weapons.slice().sort((a, b) => {
    const aMatch = String(a?.weapon_type ?? a?.type ?? '') === String(preferredType);
    const bMatch = String(b?.weapon_type ?? b?.type ?? '') === String(preferredType);
    if (aMatch !== bMatch) return aMatch ? -1 : 1;
    const typeCompare = String(a?.weapon_type ?? a?.type ?? '').localeCompare(String(b?.weapon_type ?? b?.type ?? ''));
    return typeCompare || getWeaponName(a).localeCompare(getWeaponName(b));
  });
  return { sorted, preferredType };
}

function openNewBuildModal() {
  if (!selectedCharacterId) {
    showToast('Pick a character first', 'warning');
    return;
  }

  const form = el('form', { className: 'bld-form' });
  const nameInput = el('input', {
    className: 'bld-input',
    name: 'build_name',
    placeholder: 'Optional build name',
    value: ''
  });
  form.appendChild(formField('Build name (optional)', nameInput));

  const { sorted: sortedWeapons, preferredType } = weaponOptionsForCharacter();
  const weaponSelect = el('select', { className: 'bld-select', name: 'weapon_id', required: true });
  weaponSelect.appendChild(el('option', { value: '' }, 'Choose a weapon…'));
  const grouped = new Map();
  sortedWeapons.forEach((weapon) => {
    const type = String(weapon?.weapon_type ?? weapon?.type ?? 'Other');
    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type).push(weapon);
  });
  const orderedTypes = Array.from(grouped.keys()).sort((a, b) => {
    if (a === preferredType) return -1;
    if (b === preferredType) return 1;
    return a.localeCompare(b);
  });
  orderedTypes.forEach((type) => {
    const group = el('optgroup', { label: type });
    grouped.get(type).forEach((weapon) => {
      const rarity = rarityLabel(weapon);
      const option = el('option', { value: String(getId(weapon)) }, `${getWeaponName(weapon)} ${rarity}`);
      group.appendChild(option);
    });
    weaponSelect.appendChild(group);
  });
  form.appendChild(formField('Weapon', weaponSelect, preferredType ? `Weapons matching ${preferredType} are listed first.` : ''));

  const artifactSelect = el('select', { className: 'bld-select', name: 'artifact_id', required: true });
  artifactSelect.appendChild(el('option', { value: '' }, 'Choose an artifact set…'));
  artifacts.slice().sort((a, b) => getArtifactName(a).localeCompare(getArtifactName(b))).forEach((artifact) => {
    artifactSelect.appendChild(el('option', { value: String(getId(artifact)) }, getArtifactName(artifact)));
  });
  form.appendChild(formField('Artifact set', artifactSelect));

  const actions = el('div', { className: 'bld-actions' });
  const submit = button('Create build', () => {
    if (!weaponSelect.value || !artifactSelect.value) {
      showToast('Choose a weapon and artifact set', 'warning');
      return;
    }
    submitBuild({
      character_id: selectedCharacterId,
      weapon_id: weaponSelect.value,
      artifact_id: artifactSelect.value,
      build_name: nameInput.value.trim()
    });
  }, 'bld-btn primary');
  actions.appendChild(submit);
  actions.appendChild(button('Cancel', closeModal, 'bld-btn'));
  form.appendChild(actions);

  showModal('New build', form);
}

async function submitBuild(payload) {
  try {
    await activeContext.api.post('/builds', payload);
    closeModal();
    showToast('Build created', 'success');
    await reloadBuilds();
  } catch (error) {
    if (error?.status === 409 || error?.statusCode === 409 || error?.response?.status === 409) {
      showToast('This character already has a build with that name', 'error');
    } else {
      showToast(error?.message || 'Could not create build');
    }
  }
}

function openAddTeammateModal(build) {
  const ownCharacterId = String(build.character_id ?? selectedCharacterId);
  const candidates = characters.filter((character) => String(getId(character)) !== String(ownCharacterId));
  if (!candidates.length) {
    showToast('No other characters are available to add', 'warning');
    return;
  }

  const form = el('form', { className: 'bld-form' });
  const characterSelect = makeSelect(
    candidates.map((character) => ({ value: getId(character), label: getCharacterName(character) })),
    'Choose a teammate…'
  );
  characterSelect.required = true;
  const notesInput = el('textarea', {
    className: 'bld-textarea',
    name: 'notes',
    placeholder: 'Optional notes about this teammate'
  });
  form.appendChild(formField('Character', characterSelect));
  form.appendChild(formField('Notes (optional)', notesInput));

  const actions = el('div', { className: 'bld-actions' });
  actions.appendChild(button('Add teammate', async () => {
    if (!characterSelect.value) {
      showToast('Choose a teammate', 'warning');
      return;
    }
    await addTeammate(build, characterSelect.value, notesInput.value.trim());
  }, 'bld-btn primary'));
  actions.appendChild(button('Cancel', closeModal, 'bld-btn'));
  form.appendChild(actions);
  showModal('Add teammate', form);
}

async function addTeammate(build, characterId, notes) {
  try {
    await activeContext.api.post(`/builds/${encodeURIComponent(getBuildId(build))}/team`, {
      character_id: characterId,
      notes
    });
    closeModal();
    showToast('Teammate added', 'success');
    await reloadBuilds();
  } catch (error) {
    if (error?.status === 409 || error?.statusCode === 409 || error?.response?.status === 409) {
      showToast('Already on the team', 'error');
    } else {
      showToast(error?.message || 'Could not add teammate');
    }
  }
}

function confirmAction(message, onConfirm) {
  const result = activeContext.ui.confirmDialog(message, onConfirm);
  if (result && typeof result.then === 'function') {
    result.then((confirmed) => {
      if (confirmed) onConfirm();
    }).catch(() => {});
  } else if (result === true) {
    onConfirm();
  }
}

function removeTeammate(build, memberId) {
  // build_team_members is the junction table for the many-to-many relationship
  // between builds and characters; deleting a membership removes that association.
  confirmAction('Remove this teammate from the build?', async () => {
    try {
      await activeContext.api.del(`/builds/${encodeURIComponent(getBuildId(build))}/team/${encodeURIComponent(memberId)}`);
      showToast('Teammate removed', 'success');
      await reloadBuilds();
    } catch (error) {
      showToast(error?.message || 'Could not remove teammate');
    }
  });
}

function deleteBuild(build) {
  // Deleting a build cascades to its build_team_members junction rows and damage logs.
  confirmAction('Delete this build? Its team and damage logs will be deleted too.', async () => {
    try {
      await activeContext.api.del(`/builds/${encodeURIComponent(getBuildId(build))}`);
      showToast('Build deleted', 'success');
      await reloadBuilds();
    } catch (error) {
      showToast(error?.message || 'Could not delete build');
    }
  });
}

let currentModal = null;

function showModal(title, content) {
  closeModal();
  const ui = activeContext.ui;
  if (typeof ui.openModal === 'function') {
    currentModal = ui.openModal({ title, body: content });
    return;
  }
  const fallback = el('div', { className: 'bld-modal-fallback' });
  const heading = el('h2', {}, title);
  fallback.appendChild(heading);
  fallback.appendChild(content);
  document.body.appendChild(fallback);
  currentModal = fallback;
}

function closeModal() {
  if (activeContext?.ui?.closeModal) activeContext.ui.closeModal();
  else if (currentModal?.close) currentModal.close();
  else if (currentModal?.dismiss) currentModal.dismiss();
  else if (currentModal instanceof HTMLElement && currentModal.parentNode) currentModal.remove();
  currentModal = null;
}

async function render(root, ctx) {
  activeContext = ctx;
  activeRoot = root;
  addStyles();

  const params = ctx.params || {};
  selectedCharacterId = String(params.character_id ?? selectedCharacterId ?? '');
  selectedBuildId = String(params.build_id ?? '');
  buildError = '';
  referenceError = '';

  root.replaceChildren();
  const page = el('div', { className: 'bld-page' });
  root.appendChild(page);
  const initialLoading = activeContext.ui.skeleton(5);
  page.appendChild(initialLoading);

  try {
    characters = await fetchCharacters();
  } catch (error) {
    page.replaceChildren();
    const errorBox = el('div', { className: 'bld-error', role: 'alert' });
    errorBox.appendChild(textNode('p', 'bld-muted', 'Characters could not be loaded. Check the server/database connection and retry.'));
    errorBox.appendChild(button('Retry', () => render(root, ctx), 'bld-btn'));
    page.appendChild(errorBox);
    return;
  }
  initialLoading.remove();

  if (selectedCharacterId && !characters.some((character) => String(getId(character)) === selectedCharacterId)) {
    selectedCharacterId = '';
  }

  const headerRoot = el('div', {});
  renderHeader(headerRoot);
  page.appendChild(headerRoot);

  const content = el('div', { id: 'builds-content' });
  content.appendChild(activeContext.ui.skeleton());
  page.appendChild(content);

  if (selectedCharacterId) {
    try {
      await loadWeaponsAndArtifacts();
    } catch (error) {
      weapons = [];
      artifacts = [];
      referenceError = 'the API is unavailable';
    }
  }

  headerRoot.replaceChildren();
  renderHeader(headerRoot);

  await reloadBuilds();
}

function destroy() {
  loadToken++;
  closeModal();
  activeContext = null;
  activeRoot = null;
  characters = [];
  weapons = [];
  artifacts = [];
  builds = [];
  selectedCharacterId = '';
  selectedBuildId = '';
  loading = false;
  buildError = '';
  referenceError = '';
}

export { destroy, render };
