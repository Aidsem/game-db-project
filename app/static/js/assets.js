// Shared renderer for optional, reviewed local character art.
// Keys are stable database character IDs (the importer preserves existing IDs).
// Entry shape: { portrait, splash, variants: { [variantKey]: { portrait, splash } } }.
// Paths must be local /assets/characters/... URLs. Keep this empty until an
// image has a documented license and is added locally.
const approvedCharacterAssets = Object.freeze({});

function assetSlug(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0027\u2019]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function namedAssetPath(kind, value) {
  const slug = assetSlug(value);
  return slug ? `/assets/${kind}/${slug}.png` : null;
}

const ELEMENTS = Object.freeze({
  pyro: { symbol: '✦', color: '#ef765e' },
  hydro: { symbol: '◉', color: '#65b7ee' },
  anemo: { symbol: '〰', color: '#79cbb2' },
  electro: { symbol: 'ϟ', color: '#bb91ec' },
  dendro: { symbol: '❋', color: '#9acb69' },
  cryo: { symbol: '❄', color: '#8ed8e5' },
  geo: { symbol: '⬡', color: '#e5b869' },
  adaptive: { symbol: '◇', color: '#aeb5ca' },
  none: { symbol: '·', color: '#9299a9' }
});

function safeLocalCharacterPath(path) {
  return typeof path === 'string' &&
    /^\/assets\/characters\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9._-]+)*$/.test(path) &&
    !path.split('/').includes('..');
}

/** Resolve a locally hosted image from a reviewed mapping keyed by stable DB ID. */
export function resolveCharacterAsset(character, {
  kind = 'portrait',
  variantKey = '',
  manifest = approvedCharacterAssets
} = {}) {
  if (!character || character.id === null || character.id === undefined) return null;
  const record = manifest?.[String(character.id)];
  if (!record || typeof record !== 'object') {
    return manifest === approvedCharacterAssets && !variantKey
      ? namedAssetPath('characters', character.name)
      : null;
  }

  // When a form is explicitly requested, require its own mapping. Never show
  // another variant's art as a fallback.
  const path = variantKey
    ? record.variants?.[variantKey]?.[kind]
    : record[kind];
  if (safeLocalCharacterPath(path)) return path;
  return manifest === approvedCharacterAssets && !variantKey
    ? namedAssetPath('characters', character.name)
    : null;
}

export function resolveWeaponAsset(weapon) {
  return namedAssetPath('weapons', weapon?.name ?? weapon?.weapon_name);
}

export function resolveArtifactAsset(artifact) {
  return namedAssetPath('artifacts', artifact?.set_name ?? artifact?.name ?? artifact?.artifact_set_name);
}

function characterDetails(character) {
  const name = String(character?.name || 'Unknown character');
  const rarityValue = Number(character?.rarity);
  const rarity = Number.isInteger(rarityValue) && rarityValue >= 1 && rarityValue <= 5
    ? `${rarityValue} star${rarityValue === 1 ? '' : 's'}`
    : 'Rarity unspecified';
  const element = String(character?.element || 'Element unspecified');
  const weapon = String(character?.weapon_type || 'Weapon unspecified');
  const facet = ELEMENTS[element.toLowerCase()] || { symbol: '?', color: '#9299a9' };
  return { name, rarity, element, weapon, facet };
}

/** Character image slot with a metadata-based, CSS-only fallback. */
export function characterVisual(ui, character, {
  className = '',
  variantKey = '',
  kind = 'portrait',
  manifest,
  compact = false
} = {}) {
  const details = characterDetails(character);
  const description = `${details.name}; ${details.rarity}; ${details.element}; ${details.weapon}`;
  const visual = ui.el('div', {
    className: `character-visual${compact ? ' character-visual-compact' : ''}${kind === 'splash' ? ' character-visual-splash' : ''} ${className}`.trim(),
    role: 'img',
    'aria-label': description,
    style: { '--character-accent': details.facet.color }
  });
  const placeholder = ui.el('div', { className: 'character-visual-placeholder', 'aria-hidden': 'true' },
    ui.el('span', { className: 'character-visual-glyph' }, details.facet.symbol),
    ui.el('span', { className: 'character-visual-name' }, details.name),
    ui.el('span', { className: 'character-visual-meta' }, `${details.rarity} · ${details.weapon}`),
    ui.el('span', { className: 'character-visual-element' }, details.element)
  );
  visual.appendChild(placeholder);

  const src = resolveCharacterAsset(character, { kind, variantKey, manifest });
  if (src) {
    visual.classList.add('character-visual-has-art');
    const image = ui.el('img', {
      className: 'character-visual-image',
      src,
      alt: `${details.name} ${kind}`,
      loading: 'lazy',
      decoding: 'async'
    });
    image.addEventListener('error', () => {
      image.remove();
      visual.classList.remove('character-visual-has-art');
    }, { once: true });
    visual.appendChild(image);
  }
  return visual;
}

// Shared, accessible renderer for other optional images (weapons, artifacts, etc.).
export function assetImage(ui, { src, alt, className = '', fallback = 'Image unavailable' }) {
  const wrapper = ui.el('span', {
    className: `asset-image ${className}`.trim()
  });

  if (!src) {
    wrapper.classList.add('asset-image-missing');
    wrapper.setAttribute('role', 'img');
    wrapper.setAttribute('aria-label', alt || fallback);
    wrapper.appendChild(ui.el('span', { className: 'asset-image-fallback' }, fallback));
    return wrapper;
  }

  const image = ui.el('img', {
    src,
    alt: alt || fallback,
    loading: 'lazy',
    decoding: 'async'
  });
  image.addEventListener('error', () => {
    wrapper.classList.add('asset-image-missing');
    image.remove();
    wrapper.setAttribute('role', 'img');
    wrapper.setAttribute('aria-label', alt || fallback);
    wrapper.appendChild(ui.el('span', { className: 'asset-image-fallback' }, fallback));
  }, { once: true });
  wrapper.appendChild(image);
  return wrapper;
}
