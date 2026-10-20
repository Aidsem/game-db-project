const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function searchableNames(character) {
  return [
    character.name,
    ...(Array.isArray(character.aliases) ? character.aliases : []),
    ...(Array.isArray(character.variants) ? character.variants.map(variant => variant?.name) : [])
  ].filter(value => typeof value === 'string' && value.length);
}

export function filterCharacterCatalog(characters, filters = {}) {
  const query = String(filters.q || '').trim().toLocaleLowerCase();
  const list = (Array.isArray(characters) ? characters : []).filter(character => {
    if (!character || typeof character.name !== 'string') return false;
    if (query && !searchableNames(character).some(name => name.toLocaleLowerCase().includes(query))) return false;
    if (filters.element && String(character.element) !== String(filters.element)) return false;
    if (filters.weapon_type && String(character.weapon_type) !== String(filters.weapon_type)) return false;
    if (filters.rarity && String(character.rarity) !== String(filters.rarity)) return false;
    return true;
  });

  if (filters.sort === 'name') {
    list.sort((a, b) => collator.compare(a.name, b.name));
  } else if (filters.sort === 'rarity_desc') {
    list.sort((a, b) => (Number(b.rarity) || 0) - (Number(a.rarity) || 0)
      || (Number(a.release_order) || Number.MAX_SAFE_INTEGER) - (Number(b.release_order) || Number.MAX_SAFE_INTEGER)
      || collator.compare(a.name, b.name));
  } else {
    list.sort((a, b) => (Number(a.release_order) || Number.MAX_SAFE_INTEGER) - (Number(b.release_order) || Number.MAX_SAFE_INTEGER)
      || collator.compare(a.name, b.name));
  }
  return list;
}

export function characterFacets(characters, field) {
  return [...new Set((Array.isArray(characters) ? characters : [])
    .map(character => character?.[field])
    .filter(value => value !== null && value !== undefined && String(value).length)
    .map(String))]
    .sort((a, b) => field === 'rarity' ? Number(a) - Number(b) : collator.compare(a, b));
}
