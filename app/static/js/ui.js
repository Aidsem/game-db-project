// js/ui.js - DOM + toast/modal/drawer helpers shared by every view.

/** el('div', {class:'card', onclick: fn, dataset:{id:1}}, 'text', childNode, [more]) */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class' || k === 'className') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;            // only for trusted, static strings
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return node;
}

const $ = (sel) => document.querySelector(sel);

export function toast(message, type = 'info') {
  const root = $('#toasts');
  if (!root) return console.log(`[${type}]`, message);
  const t = el('div', { class: `toast toast-${type}`, role: 'status' }, message);
  root.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3500);
}

// ---------- modal ----------
let modalOnClose = null;
export function openModal({ title = '', body = '', onClose } = {}) {
  closeModal();
  const root = $('#modal-root');
  modalOnClose = onClose || null;
  const content = body instanceof Node ? body : el('div', {}, String(body));
  const box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
    el('div', { class: 'modal-head' },
      el('h3', {}, title),
      el('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: closeModal }, '✕')),
    el('div', { class: 'modal-body' }, content));
  const backdrop = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) closeModal(); } }, box);
  root.appendChild(backdrop);
  document.addEventListener('keydown', escHandler);
  const first = box.querySelector('input,select,textarea,button.primary');
  if (first) first.focus();
}
function escHandler(e) { if (e.key === 'Escape') { closeModal(); closeDrawer(); } }
export function closeModal() {
  const root = $('#modal-root');
  if (!root || !root.firstChild) return;
  root.innerHTML = '';
  document.removeEventListener('keydown', escHandler);
  const cb = modalOnClose; modalOnClose = null;
  if (cb) cb();
}

export function confirmDialog(message) {
  return new Promise((resolve) => {
    let answered = false;
    const done = (v) => { answered = true; closeModal(); resolve(v); };
    openModal({
      title: 'Please confirm',
      body: el('div', {},
        el('p', {}, message),
        el('div', { class: 'form-actions' },
          el('button', { class: 'btn', onclick: () => done(false) }, 'Cancel'),
          el('button', { class: 'btn danger primary', onclick: () => done(true) }, 'Confirm'))),
      onClose: () => { if (!answered) resolve(false); },
    });
  });
}

// ---------- drawer ----------
export function openDrawer({ title = '', body = '' } = {}) {
  const d = $('#drawer');
  d.innerHTML = '';
  d.appendChild(el('div', { class: 'drawer-head' },
    el('h3', {}, title),
    el('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: closeDrawer }, '✕')));
  d.appendChild(el('div', { class: 'drawer-body' }, body instanceof Node ? body : String(body)));
  d.classList.add('open');
  document.addEventListener('keydown', escHandler);
}
export function closeDrawer() { const d = $('#drawer'); if (d) d.classList.remove('open'); }

// ---------- small helpers ----------
export function skeleton(rows = 4) {
  return el('div', { class: 'skeleton-wrap', 'aria-busy': 'true' },
    Array.from({ length: rows }, () => el('div', { class: 'skeleton' })));
}
export function emptyState(message = 'Nothing here yet.') {
  return el('div', { class: 'empty' }, el('div', { class: 'empty-icon' }, '◇'), el('p', {}, message));
}
export function debounce(fn, ms = 250) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** table([{key,label}], rows, {sortable:true}) -> Node (click a header to sort) */
export function table(columns, rows, opts = {}) {
  const { sortable = true, onRowClick } = opts;
  let data = rows.slice(); let sortKey = null; let asc = true;
  const tbody = el('tbody');
  const fmt = (v) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : v);
  const draw = () => {
    tbody.innerHTML = '';
    data.forEach((r) => {
      const tr = el('tr', { onclick: onRowClick ? () => onRowClick(r) : null, class: onRowClick ? 'clickable' : '' },
        columns.map((c) => el('td', {}, c.render ? c.render(r) : fmt(r[c.key]))));
      tbody.appendChild(tr);
    });
  };
  const head = el('tr', {}, columns.map((c) => el('th', {
    class: sortable ? 'sortable' : '',
    onclick: sortable ? () => {
      asc = sortKey === c.key ? !asc : true; sortKey = c.key;
      data.sort((a, b) => {
        const x = a[c.key], y = b[c.key];
        if (x === y) return 0; if (x === null || x === undefined) return 1; if (y === null || y === undefined) return -1;
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * (asc ? 1 : -1);
      });
      draw();
    } : null,
  }, c.label)));
  draw();
  return el('div', { class: 'table-wrap' }, el('table', { class: 'data-table' }, el('thead', {}, head), tbody));
}

export function downloadCsv(filename, rows) {
  if (!rows || !rows.length) return toast('No rows to export', 'error');
  const cols = Object.keys(rows[0]);
  const esc = (v) => { const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
