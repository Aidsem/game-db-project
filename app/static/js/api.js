// js/api.js - fetch wrapper. Paths are WITHOUT the /api prefix: api.get('/characters')
const BASE = '/api';

async function request(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(BASE + path, opts);
  } catch (e) {
    throw new Error('Cannot reach the server. Is `python app.py` running?');
  }
  let data = null;
  const text = await res.text();
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!res.ok) {
    const msg = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body ?? {}),
  del: (path) => request('DELETE', path),
};

// PNG graph URLs. kind: 'build' (one build's logs) | 'compare' (all builds of a character)
export function graphUrl(kind, id) {
  return `${BASE}/damage-logs/graph/${kind}/${id}?t=${Date.now()}`;  // ?t= busts the cache
}
