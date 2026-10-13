// js/main.js - hash router + boot. FIXED CONTRACT: change only after telling the team.
import { api, graphUrl } from './api.js';
import * as ui from './ui.js';
import * as theme from './theme.js';

const ROUTES = {
  '/': 'dashboard',
  '/characters': 'characters',
  '/weapons': 'weapons',
  '/artifacts': 'artifacts',
  '/tiers': 'tiers',
  '/builds': 'builds',
  '/damage-lab': 'damageLab',
  '/compare': 'compare',
  '/sql': 'sqlExplorer',
};

let current = null;           // currently mounted view module
let renderToken = 0;          // ignores slow views that finish after the user navigated away

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  return { path: path || '/', params };
}

function highlightNav(path) {
  document.querySelectorAll('#nav a[data-route]').forEach((a) =>
    a.classList.toggle('active', a.dataset.route === path));
}

async function route() {
  const { path, params } = parseHash();
  const root = document.getElementById('view');
  const token = ++renderToken;
  highlightNav(path);
  ui.closeDrawer();
  if (current && typeof current.destroy === 'function') { try { current.destroy(); } catch (e) { console.error(e); } }
  current = null;

  const name = ROUTES[path];
  if (!name) { root.replaceChildren(ui.emptyState('Page not found.')); return; }

  root.replaceChildren(ui.skeleton(5));
  try {
    const mod = await import(`./views/${name}.js`);
    if (token !== renderToken) return;
    current = mod;
    root.replaceChildren();
    await mod.render(root, { api, ui, theme, params, graphUrl });
  } catch (err) {
    if (token !== renderToken) return;
    console.error(err);
    const missing = /Failed to fetch dynamically imported module|Cannot find module|Importing a module script failed/i.test(String(err.message));
    root.replaceChildren(ui.emptyState(missing
      ? `The page "${name}" has not been added yet (js/views/${name}.js).`
      : `Something went wrong: ${err.message}`));
    if (!missing) ui.toast(err.message, 'error');
  }
}

async function checkConnection() {
  const dot = document.getElementById('conn-dot');
  const txt = document.getElementById('conn-text');
  try {
    const h = await api.get('/health');
    if (dot) dot.className = 'dot ok';
    if (txt) txt.textContent = h.engine ? h.engine.split(' ').slice(0, 2).join(' ') : 'connected';
  } catch (e) {
    if (dot) dot.className = 'dot bad';
    if (txt) txt.textContent = 'offline';
  }
}

async function boot() {
  window.addEventListener('hashchange', route);
  checkConnection();
  // Optional global search palette (Ctrl+K) provided by views/search.js
  try {
    const search = await import('./views/search.js');
    if (typeof search.initSearch === 'function') search.initSearch({ api, ui, theme });
  } catch (e) { /* search.js not added yet - fine */ }
  route();
}
boot();
