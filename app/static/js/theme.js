// js/theme.js - colours and small display helpers ("colour is data")
export const ELEMENT_COLORS = {
  Pyro: '#E2622C', Hydro: '#4F8FD9', Electro: '#8B7FD8', Cryo: '#6FD3E6',
  Dendro: '#6FBF7A', Geo: '#E0B84C', Anemo: '#5FD1B0',
};
export const TIER_COLORS = { S: '#E2622C', A: '#F2A541', B: '#6FBF7A', C: '#4F8FD9', D: '#8B90A3' };
export const CHART_COLORS = ['#3FC9BE', '#F2A541', '#8B7FD8', '#E2622C', '#4F8FD9', '#6FBF7A', '#C6485E'];

// Stable colour for element names that are not in ELEMENT_COLORS
export function elementColor(name) {
  if (ELEMENT_COLORS[name]) return ELEMENT_COLORS[name];
  let h = 0;
  for (const ch of String(name || '?')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 60% 62%)`;
}

export function tierColor(t) { return TIER_COLORS[t] || '#8B90A3'; }

// 5 -> "◆◆◆◆◆", 4 -> "◆◆◆◆"
export function rarityDiamonds(n) { return '◆'.repeat(Math.max(0, Math.min(5, Number(n) || 0))); }
