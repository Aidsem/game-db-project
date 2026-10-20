
import { assetImage, characterVisual, resolveArtifactAsset, resolveWeaponAsset } from '../assets.js';

export function initSearch({ api, ui, theme }) {
  if (document.documentElement.dataset.globalSearchInitialized === 'true') return;
  document.documentElement.dataset.globalSearchInitialized = 'true';
  let modal = null;
  let paletteRoot = null;
  let input = null;
  let resultsRoot = null;
  let debounceTimer = null;
  let requestCounter = 0;
  let results = [];
  let highlightedIndex = -1;
  let isOpen = false;

  const styles = `
    .srch-palette { display:flex; flex-direction:column; gap:14px; min-width:0; }
    .srch-input { width:100%; box-sizing:border-box; border:1px solid var(--border); border-radius:10px; padding:13px 14px; background:var(--surface-2); color:var(--text); font:inherit; font-size:1rem; outline:none; }
    .srch-input:focus { border-color:var(--teal); }
    .srch-results { display:flex; flex-direction:column; gap:15px; max-height:60vh; overflow-y:auto; }
    .srch-group { display:flex; flex-direction:column; gap:5px; }
    .srch-group-title { margin:0 0 3px; color:var(--muted); font-size:.76rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
    .srch-row { width:100%; display:flex; align-items:center; gap:10px; border:1px solid transparent; border-radius:8px; background:transparent; color:var(--text); padding:10px; text-align:left; cursor:pointer; font:inherit; min-width:0; }
    .srch-row:hover, .srch-row.highlighted { background:var(--surface-2); border-color:var(--border); }
    .srch-row-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
    .srch-row-name { overflow-wrap:anywhere; font-size:.92rem; }
    .srch-row-subtitle { color:var(--muted); font-size:.8rem; }
    .srch-row-meta { color:var(--muted); font-size:.82rem; white-space:nowrap; }
    .srch-swatch { width:10px; height:10px; border-radius:50%; flex-shrink:0; border:1px solid var(--border); }
    .srch-item-image { width:34px; height:34px; border-radius:7px; }
    .srch-rarity { color:var(--amber); font-size:.8rem; letter-spacing:1px; white-space:nowrap; }
    .srch-message { padding:20px 10px; color:var(--muted); text-align:center; font-size:.88rem; }
    .srch-hint { color:var(--muted); font-size:.8rem; padding:0 2px; }
    .srch-loading { color:var(--muted); font-size:.88rem; padding:12px 4px; }
    @media(max-width:600px) { .srch-results { max-height:65vh; } .srch-row { padding:12px 8px; } }
  `;

  if (!document.getElementById('global-search-css')) {
    const style = document.createElement('style');
    style.id = 'global-search-css';
    style.textContent = styles;
    document.head.appendChild(style);
  }

  function el(tag, attrs = {}, children = []) {
    return ui.el(tag, attrs, children);
  }

  function textNode(tag, className, value) {
    return el(tag, { className }, value == null ? '' : String(value));
  }

  function toast(message) {
    ui.toast(message, 'error');
  }

  function rarityDiamonds(rarity) {
    if (typeof theme?.rarityDiamonds === 'function') {
      try {
        return String(theme.rarityDiamonds(rarity));
      } catch (_) {
        // Use the simple fallback below if the theme helper cannot format this rarity.
      }
    }
    const count = Number(rarity);
    return Number.isFinite(count) && count > 0 && count <= 5 ? '◆'.repeat(count) : '';
  }

  function elementColor(element) {
    if (typeof theme?.elementColor === 'function') {
      try {
        return theme.elementColor(element) || 'var(--muted)';
      } catch (_) {
        return 'var(--muted)';
      }
    }
    return 'var(--muted)';
  }

  function closePalette() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = null;
    requestCounter++;
    isOpen = false;

    const currentModal = modal;
    modal = null;
    paletteRoot = null;
    input = null;
    resultsRoot = null;
    results = [];
    highlightedIndex = -1;

    if (typeof ui.closeModal === 'function') {
      ui.closeModal();
    } else if (currentModal && typeof currentModal.close === 'function') {
      currentModal.close();
    } else if (currentModal && typeof currentModal.dismiss === 'function') {
      currentModal.dismiss();
    }
  }

  function openItem(item) {
    if (!item) return;

    if (item.kind === 'character') {
      window.location.hash = `#/characters?open=${encodeURIComponent(item.id)}`;
    } else if (item.kind === 'weapon') {
      window.location.hash = '#/weapons';
    } else if (item.kind === 'artifact') {
      window.location.hash = '#/artifacts';
    } else if (item.kind === 'build') {
      window.location.hash = `#/builds?character_id=${encodeURIComponent(item.character_id)}&build_id=${encodeURIComponent(item.id)}`;
    }

    closePalette();
  }

  function rowForItem(item, index) {
    const row = el('button', {
      type: 'button',
      className: `srch-row${index === highlightedIndex ? ' highlighted' : ''}`,
      role: 'option',
      'aria-selected': index === highlightedIndex ? 'true' : 'false'
    });

    if (item.kind === 'character') {
      row.appendChild(characterVisual(ui, item, { compact: true, className: 'srch-item-image' }));
    } else {
      const imageUrl = item.kind === 'build'
        ? item.assets?.portrait_url || item.assets?.image_url
        : item.kind === 'weapon'
          ? item.assets?.image_url || resolveWeaponAsset(item)
          : item.assets?.icon_url || resolveArtifactAsset(item);
      row.appendChild(assetImage(ui, {
        src: imageUrl,
        alt: `${item.name} ${item.kind} image`,
        className: 'srch-item-image',
        fallback: '?'
      }));
    }

    if (item.kind === 'character') {
      const swatch = el('span', { className: 'srch-swatch' });
      swatch.style.backgroundColor = elementColor(item.element);
      row.appendChild(swatch);
    }

    const main = el('span', { className: 'srch-row-main' });
    main.appendChild(textNode('span', 'srch-row-name', item.name));

    if (item.kind === 'weapon') {
      main.appendChild(textNode('span', 'srch-row-subtitle', item.type || 'Weapon'));
    } else if (item.kind === 'artifact') {
      main.appendChild(textNode('span', 'srch-row-subtitle', 'Artifact set'));
    } else if (item.subtitle) {
      main.appendChild(textNode('span', 'srch-row-subtitle', item.subtitle));
    } else if (item.element) {
      main.appendChild(textNode('span', 'srch-row-subtitle', item.element));
    }

    row.appendChild(main);

    if (item.kind === 'character') {
      row.appendChild(textNode('span', 'srch-rarity', rarityDiamonds(item.rarity)));
    } else if (item.kind === 'weapon') {
      row.appendChild(textNode('span', 'srch-rarity', rarityDiamonds(item.rarity)));
    }

    row.addEventListener('mouseenter', () => {
      highlightedIndex = index;
      renderResults();
    });

    row.addEventListener('click', () => openItem(item));
    return row;
  }

  function allGroups(data) {
    const characters = (data?.characters || []).map((item) => ({
      kind: 'character',
      id: item.id,
      name: String(item.name ?? 'Unnamed character'),
      element: item.element,
      rarity: item.rarity,
      assets: item.assets
    }));

    const weapons = (data?.weapons || []).map((item) => ({
      kind: 'weapon',
      id: item.id,
      name: String(item.name ?? 'Unnamed weapon'),
      type: item.type,
      rarity: item.rarity,
      assets: item.assets
    }));

    const artifacts = (data?.artifacts || []).map((item) => ({
      kind: 'artifact',
      id: item.id,
      name: String(item.set_name ?? 'Unnamed artifact set'),
      assets: item.assets
    }));
    const builds = (data?.builds || []).map((item) => ({
      kind: 'build', id: item.id, character_id: item.character_id,
      name: `${item.character_name} — ${item.build_name}`,
      subtitle: `Build for ${item.character_name}`, assets: item.assets
    }));

    return [
      { title: 'Characters', items: characters },
      { title: 'Weapons', items: weapons },
      { title: 'Artifacts', items: artifacts },
      { title: 'Builds', items: builds }
    ];
  }

  function renderResults(data = null, message = null) {
    if (!resultsRoot) return;
    resultsRoot.replaceChildren();
    results = [];

    if (message) {
      resultsRoot.appendChild(textNode('div', 'srch-message', message));
      return;
    }

    const groups = allGroups(data);
    groups.forEach((group) => {
      if (!group.items.length) return;

      const section = el('section', { className: 'srch-group' });
      section.appendChild(textNode('h3', 'srch-group-title', group.title));

      group.items.forEach((item) => {
        const index = results.length;
        results.push(item);
        section.appendChild(rowForItem(item, index));
      });

      resultsRoot.appendChild(section);
    });

    if (!results.length) {
      resultsRoot.appendChild(textNode('div', 'srch-message', 'No matching characters, weapons, artifact sets, or builds.'));
    } else if (highlightedIndex >= results.length) {
      highlightedIndex = results.length - 1;
    }
  }

  async function search(query) {
    const q = query.trim();
    const requestId = ++requestCounter;

    if (q.length < 2) {
      highlightedIndex = -1;
      renderResults(null, 'Type at least 2 characters');
      return;
    }

    if (resultsRoot) {
      resultsRoot.replaceChildren(textNode('div', 'srch-loading', 'Searching…'));
    }

    try {
      const data = await api.get(`/search?q=${encodeURIComponent(q)}`);
      if (!isOpen || requestId !== requestCounter) return;
      highlightedIndex = -1;
      renderResults(data);
    } catch (error) {
      if (!isOpen || requestId !== requestCounter) return;
      renderResults(null, 'Search failed. Try again.');
      toast(error?.message || 'Search failed');
    }
  }

  function onInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    requestCounter++;
    const query = input?.value ?? '';
    if (query.trim().length < 2) {
      requestCounter++;
      highlightedIndex = -1;
      renderResults(null, 'Type at least 2 characters');
      return;
    }

    debounceTimer = setTimeout(() => {
      search(query);
    }, 250);
  }

  function onKeyDown(event) {
    if (!isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!results.length) return;
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      if (highlightedIndex === -1) {
        highlightedIndex = direction === 1 ? 0 : results.length - 1;
      } else {
        highlightedIndex = (highlightedIndex + direction + results.length) % results.length;
      }
      renderResultsFromCurrent();
      return;
    }

    if (event.key === 'Enter' && highlightedIndex >= 0 && results[highlightedIndex]) {
      event.preventDefault();
      openItem(results[highlightedIndex]);
    }
  }

  function renderResultsFromCurrent() {
    if (!resultsRoot) return;

    const query = input?.value?.trim() ?? '';
    if (query.length < 2) {
      renderResults(null, 'Type at least 2 characters');
      return;
    }

    // Re-render the last result groups with the current keyboard highlight.
    // The current result list is flattened in the same order as Characters, Weapons, Artifacts.
    const oldResults = results.slice();
    resultsRoot.replaceChildren();

    const kindTitles = [
      ['character', 'Characters'],
      ['weapon', 'Weapons'],
      ['artifact', 'Artifacts'],
      ['build', 'Builds']
    ];

    kindTitles.forEach(([kind, title]) => {
      const items = oldResults.filter((item) => item.kind === kind);
      if (!items.length) return;

      const section = el('section', { className: 'srch-group' });
      section.appendChild(textNode('h3', 'srch-group-title', title));

      items.forEach((item) => {
        const index = oldResults.indexOf(item);
        section.appendChild(rowForItem(item, index));
      });

      resultsRoot.appendChild(section);
    });
  }

  function onGlobalKeyDown(event) {
    const combo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    if (combo) {
      const target = event.target;
      const editable = target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || '');
      if (editable && !isOpen) return;
      event.preventDefault();
      if (isOpen) {
        input?.focus();
      } else {
        openPalette();
      }
      return;
    }

    if (isOpen) onKeyDown(event);
  }

  function openPalette() {
    if (isOpen) {
      input?.focus();
      return;
    }

    isOpen = true;
    const content = el('div', { className: 'srch-palette' });
    input = el('input', {
      type: 'search',
      className: 'srch-input',
      placeholder: 'Search characters, weapons, artifacts, builds…',
      'aria-label': 'Search characters, weapons, artifacts, and builds',
      autoFocus: true
    });

    resultsRoot = el('div', { className: 'srch-results', role: 'listbox' });
    content.appendChild(input);
    content.appendChild(resultsRoot);
    content.appendChild(textNode('div', 'srch-hint', '↑ ↓ to navigate · Enter to open · Esc to close'));

    input.addEventListener('input', onInput);
    renderResults(null, 'Type at least 2 characters');

    modal = ui.openModal({ title: 'Search', body: content, onClose: () => {
      if (!isOpen) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = null;
      requestCounter++;
      isOpen = false;
      modal = paletteRoot = input = resultsRoot = null;
      results = [];
      highlightedIndex = -1;
    } });

    // Focus after the modal has been mounted.
    queueMicrotask(() => {
      if (isOpen && input) input.focus();
    });
  }

  function onSearchButtonClick(event) {
    event?.preventDefault?.();
    openPalette();
  }

  document.addEventListener('keydown', onGlobalKeyDown);
  const searchButton = document.getElementById('search-btn');
  searchButton?.addEventListener('click', onSearchButtonClick);
  const shortcutLabel = searchButton?.querySelector('kbd');
  if (shortcutLabel && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '')) shortcutLabel.textContent = '⌘ K';

  // initSearch is intentionally boot-time only; retain no page-view render/destroy exports.
}
