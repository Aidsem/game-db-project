import test from 'node:test';
import assert from 'node:assert/strict';
import { characterFacets, filterCharacterCatalog } from '../app/static/js/characterCatalog.mjs';

const characters = [
  { id: 1, name: 'Traveler', variants: [{ name: 'Aether' }, { name: 'Lumine' }], aliases: ['Aether'], element: 'Adaptive', weapon_type: 'Sword', rarity: 5, release_order: 2 },
  { id: 2, name: 'Miliastra Avatar', variants: [{ name: 'Manekin' }, { name: 'Manekina' }], aliases: ['Manekin'], element: 'None', weapon_type: 'Sword', rarity: 5, release_order: 3 },
  { id: 3, name: 'Amber', variants: [], aliases: [], element: 'Pyro', weapon_type: 'Bow', rarity: 4, release_order: 1 },
  { id: 4, name: 'Aino', description: null }
];

test('search resolves reviewed aliases and variants without duplicate cards', () => {
  assert.deepEqual(filterCharacterCatalog(characters, { q: 'Lumine' }).map(row => row.id), [1]);
  assert.deepEqual(filterCharacterCatalog(characters, { q: 'Manekin' }).map(row => row.id), [2]);
  assert.equal(filterCharacterCatalog(characters, {}).length, 4);
});

test('element, weapon, and rarity filters compose and visible count is filtered count', () => {
  const filtered = filterCharacterCatalog(characters, { element: 'Adaptive', weapon_type: 'Sword', rarity: '5' });
  assert.deepEqual(filtered.map(row => row.name), ['Traveler']);
  assert.equal(filtered.length, 1);
});

test('sorting handles standard and missing optional data deterministically', () => {
  assert.deepEqual(filterCharacterCatalog(characters, { sort: 'name' }).map(row => row.name), ['Aino', 'Amber', 'Miliastra Avatar', 'Traveler']);
  assert.deepEqual(filterCharacterCatalog(characters, { sort: 'rarity_desc' }).map(row => row.name), ['Traveler', 'Miliastra Avatar', 'Amber', 'Aino']);
});

test('filter facets come from available catalog records, including adaptive and mode-only values', () => {
  assert.deepEqual(characterFacets(characters, 'element'), ['Adaptive', 'None', 'Pyro']);
  assert.deepEqual(characterFacets(characters, 'weapon_type'), ['Bow', 'Sword']);
  assert.deepEqual(characterFacets(characters, 'rarity'), ['4', '5']);
});
