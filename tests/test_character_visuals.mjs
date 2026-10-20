import test from 'node:test';
import assert from 'node:assert/strict';
import { characterVisual, resolveArtifactAsset, resolveCharacterAsset, resolveWeaponAsset } from '../app/static/js/assets.js';

class FakeElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.style = {};
    this.className = '';
    this.parentNode = null;
    this.classList = {
      add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => name && !names.includes(name)).join(' '); },
      contains: name => this.className.split(/\s+/).includes(name)
    };
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
  }
}

const ui = {
  el(tag, attrs = {}, ...children) {
    const node = new FakeElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'class' || key === 'className') node.className = value;
      else if (key === 'style') node.style = { ...value };
      else node.setAttribute(key, value);
    }
    children.flat(Infinity).filter(child => child != null).forEach(child => {
      if (typeof child === 'string') node.appendChild({ textContent: child, parentNode: null });
      else node.appendChild(child);
    });
    return node;
  }
};

function find(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.children || []) {
    const result = find(child, predicate);
    if (result) return result;
  }
  return null;
}

test('missing character name renders a metadata placeholder when optional fields are absent', () => {
  const visual = characterVisual(ui, { id: 44 });
  assert.equal(visual.classList.contains('character-visual-has-art'), false);
  assert.equal(visual.attributes.role, 'img');
  assert.match(visual.attributes['aria-label'], /Unknown character; Rarity unspecified; Element unspecified; Weapon unspecified/);
  assert.ok(find(visual, node => node.className === 'character-visual-glyph'));
});

test('unknown character remains a labeled safe placeholder', () => {
  const visual = characterVisual(ui, null);
  assert.match(visual.attributes['aria-label'], /Unknown character/);
  assert.equal(resolveCharacterAsset({ id: 9999 }), null);
});

test('catalog asset paths normalize names consistently across item punctuation', () => {
  assert.equal(resolveCharacterAsset({ id: 12, name: 'Hu Tao' }), '/assets/characters/hu-tao.png');
  assert.equal(resolveWeaponAsset({ name: "Wolf's Gravestone" }), '/assets/weapons/wolfs-gravestone.png');
  assert.equal(resolveArtifactAsset({ set_name: "Gladiator's Finale" }), '/assets/artifacts/gladiators-finale.png');
});

test('resolver accepts only local paths and uses the explicitly requested variant mapping', () => {
  const character = { id: 7, name: 'Traveler' };
  const manifest = {
    7: {
      portrait: '/assets/characters/7/traveler.webp',
      variants: {
        aether: { portrait: '/assets/characters/7/aether.webp' },
        lumine: { portrait: '/assets/characters/7/lumine.webp' }
      }
    }
  };
  assert.equal(resolveCharacterAsset(character, { manifest }), '/assets/characters/7/traveler.webp');
  assert.equal(resolveCharacterAsset(character, { manifest, variantKey: 'aether' }), '/assets/characters/7/aether.webp');
  assert.equal(resolveCharacterAsset(character, { manifest, variantKey: 'lumine' }), '/assets/characters/7/lumine.webp');
  assert.equal(resolveCharacterAsset(character, { manifest, variantKey: 'unknown' }), null);
  assert.equal(resolveCharacterAsset(character, { manifest: { 7: { portrait: 'https://example.com/art.png' } } }), null);
  assert.equal(resolveCharacterAsset(character, { manifest: { 7: { portrait: '/assets/characters/../private.png' } } }), null);
});

test('variant visuals never borrow another form image and splash uses its own asset kind', () => {
  const character = { id: 7, name: 'Traveler', rarity: 5, element: 'Adaptive', weapon_type: 'Sword' };
  const manifest = {
    7: {
      variants: { lumine: { portrait: '/assets/characters/7/lumine.webp' } },
      splash: '/assets/characters/7/traveler-splash.webp'
    }
  };
  const lumine = characterVisual(ui, character, { variantKey: 'lumine', manifest });
  assert.equal(find(lumine, node => node.tagName === 'IMG')?.attributes.src, '/assets/characters/7/lumine.webp');
  const aether = characterVisual(ui, character, { variantKey: 'aether', manifest });
  assert.equal(find(aether, node => node.tagName === 'IMG'), null);
  const splash = characterVisual(ui, character, { kind: 'splash', manifest });
  assert.equal(find(splash, node => node.tagName === 'IMG')?.attributes.src, '/assets/characters/7/traveler-splash.webp');
  assert.equal(splash.classList.contains('character-visual-splash'), true);
});

test('a failed local image reveals the CSS placeholder instead of a broken image', () => {
  const visual = characterVisual(ui, { id: 1, name: 'Amber', rarity: 4, element: 'Pyro', weapon_type: 'Bow' }, {
    manifest: { 1: { portrait: '/assets/characters/1/portrait.webp' } }
  });
  const image = find(visual, node => node.tagName === 'IMG');
  assert.ok(image);
  assert.equal(visual.classList.contains('character-visual-has-art'), true);
  image.listeners.error();
  assert.equal(find(visual, node => node.tagName === 'IMG'), null);
  assert.equal(visual.classList.contains('character-visual-has-art'), false);
  assert.ok(find(visual, node => node.className === 'character-visual-placeholder'));
});
