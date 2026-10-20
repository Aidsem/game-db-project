// app/static/js/views/compare.js
// Compare: demonstrates relational joins, foreign-key relationships, tier ordering,
// aggregate damage comparisons, and how related character/build records are presented.
import { assetImage, characterVisual } from '../assets.js';

let charts = [];
let activeRoot = null;
let activeContext = null;
let renderVersion = 0;
let listeners = [];

const VIEW = 'cmp';
const TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];

function injectStyles() {
  if (document.getElementById('cmp-css')) return;

  const style = document.createElement('style');
  style.id = 'cmp-css';
  style.textContent = `
    .cmp-page {
      display: flex;
      flex-direction: column;
      gap: 20px;
      min-width: 0;
      color: var(--text, #ECEDF2);
    }

    .cmp-head {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .cmp-head h1 {
      margin: 0;
      font-family: Fraunces, Georgia, serif;
      font-size: clamp(1.7rem, 3vw, 2.2rem);
    }

    .cmp-muted {
      color: var(--muted, #8B90A3);
      font-size: 0.84rem;
      line-height: 1.5;
    }

    .cmp-picker {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      gap: 12px;
      align-items: end;
      padding: 16px;
    }

    .cmp-picker-side {
      display: flex;
      flex-direction: column;
      gap: 7px;
      min-width: 0;
    }

    .cmp-picker-side label {
      color: var(--muted, #8B90A3);
      font-size: 0.8rem;
      font-weight: 650;
    }

    .cmp-picker select {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      padding: 10px 12px;
      border: 1px solid var(--border, #2A2E3A);
      border-radius: 8px;
      background: var(--surface-2, #242833);
      color: var(--text, #ECEDF2);
      font: inherit;
      font-size: 0.88rem;
    }

    .cmp-picker select:focus-visible {
      outline: 2px solid var(--teal, #3FC9BE);
      outline-offset: 2px;
    }

    .cmp-picker-actions {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cmp-picker-actions .btn {
      white-space: nowrap;
    }

    .cmp-characters {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 16px;
      align-items: start;
      min-width: 0;
    }

    .cmp-column {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
    }

    .cmp-card {
      padding: 17px;
      min-width: 0;
    }

    .cmp-character-header {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .cmp-character-avatar { width:56px; height:56px; border-radius:50%; }

    .cmp-character-name {
      margin: 0;
      font-family: Fraunces, Georgia, serif;
      font-size: clamp(1.25rem, 2.2vw, 1.65rem);
      overflow-wrap: anywhere;
    }

    .cmp-character-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      align-items: center;
    }

    .cmp-element-chip,
    .cmp-meta-chip,
    .cmp-team-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
      padding: 5px 9px;
      border: 1px solid var(--border, #2A2E3A);
      border-radius: 7px;
      background: var(--surface-2, #242833);
      color: var(--text, #ECEDF2);
      font-size: 0.75rem;
      overflow-wrap: anywhere;
    }

    .cmp-element-swatch {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .cmp-rarity {
      color: var(--amber, #F2A541);
      letter-spacing: 1px;
      font-size: 0.8rem;
      overflow-wrap: anywhere;
    }

    .cmp-subtitle {
      margin: 0 0 10px;
      font-size: 0.95rem;
      font-weight: 700;
    }

    .cmp-detail-section + .cmp-detail-section {
      margin-top: 17px;
      padding-top: 15px;
      border-top: 1px solid var(--border, #2A2E3A);
    }

    .cmp-tier-list {
      display: flex;
      flex-direction: column;
      gap: 9px;
    }

    .cmp-tier-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .cmp-tier-role {
      color: var(--muted, #8B90A3);
      font-size: 0.8rem;
      overflow-wrap: anywhere;
    }

    .cmp-tier-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 27px;
      padding: 4px 7px;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 800;
    }

    .cmp-build-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .cmp-build {
      padding: 12px;
      border: 1px solid var(--border, #2A2E3A);
      border-radius: 9px;
      background: var(--surface-2, #242833);
      min-width: 0;
    }

    .cmp-build-title {
      margin: 0 0 8px;
      font-size: 0.88rem;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .cmp-build-detail {
      margin-top: 5px;
      color: var(--muted, #8B90A3);
      font-size: 0.78rem;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    .cmp-team {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 9px;
    }

    .cmp-team-chip {
      font-size: 0.7rem;
      padding: 4px 7px;
    }

    .cmp-damage {
      margin-top: 9px;
      font-size: 0.84rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .cmp-damage-winner {
      color: var(--teal, #3FC9BE);
    }

    .cmp-best-marker {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-left: 7px;
      color: var(--teal, #3FC9BE);
      font-size: 0.7rem;
      font-weight: 800;
    }

    .cmp-open-lab {
      width: 100%;
      margin-top: 2px;
    }

    .cmp-verdict {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
    }

    .cmp-verdict-title {
      margin: 0;
      text-align: center;
      font-family: Fraunces, Georgia, serif;
      font-size: 1.35rem;
    }

    .cmp-verdict-summary {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
    }

    .cmp-verdict-side {
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 13px;
      border: 1px solid var(--border, #2A2E3A);
      border-radius: 10px;
      background: var(--surface, #1B1E27);
      min-width: 0;
    }

    .cmp-verdict-label {
      color: var(--muted, #8B90A3);
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .cmp-verdict-value {
      font-size: 1rem;
      font-weight: 750;
      overflow-wrap: anywhere;
    }

    .cmp-verdict-value.cmp-winner {
      color: var(--teal, #3FC9BE);
    }

    .cmp-table-wrap {
      width: 100%;
      overflow-x: auto;
      border: 1px solid var(--border, #2A2E3A);
      border-radius: 10px;
      background: var(--surface, #1B1E27);
    }

    .cmp-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.82rem;
    }

    .cmp-table th,
    .cmp-table td {
      padding: 11px 13px;
      border-bottom: 1px solid var(--border, #2A2E3A);
      overflow-wrap: anywhere;
      vertical-align: top;
    }

    .cmp-table thead th {
      color: var(--muted, #8B90A3);
      font-size: 0.75rem;
      font-weight: 700;
      background: var(--surface-2, #242833);
    }

    .cmp-table tbody tr:last-child td {
      border-bottom: none;
    }

    .cmp-table td:first-child {
      color: var(--muted, #8B90A3);
      font-weight: 650;
      width: 31%;
    }

    .cmp-table td.cmp-cell-winner {
      border-left: 3px solid var(--teal, #3FC9BE);
      color: var(--teal, #3FC9BE);
      font-weight: 750;
    }

    .cmp-chart-card {
      padding: 17px;
      min-width: 0;
    }

    .cmp-chart-title {
      margin: 0 0 4px;
      font-size: 1rem;
      font-weight: 700;
    }

    .cmp-chart-container {
      position: relative;
      height: 290px;
      width: 100%;
      min-width: 0;
      margin-top: 13px;
    }

    .cmp-chart-container canvas {
      width: 100% !important;
      height: 290px !important;
      display: block;
    }

    .cmp-empty {
      color: var(--muted, #8B90A3);
      font-size: 0.82rem;
      font-style: italic;
    }

    .cmp-loading {
      padding: 16px;
    }

    .cmp-error {
      padding: 14px;
      color: var(--red, #E76E7A);
    }

    @media (max-width: 800px) {
      .cmp-characters {
        grid-template-columns: minmax(0, 1fr);
      }

      .cmp-picker {
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        gap: 8px;
        padding: 12px;
      }

      .cmp-picker-actions .btn {
        padding-left: 9px;
        padding-right: 9px;
      }

      .cmp-card {
        padding: 14px;
      }

      .cmp-verdict-summary {
        gap: 8px;
      }

      .cmp-table th,
      .cmp-table td {
        padding: 9px 10px;
      }
    }

    @media (max-width: 480px) {
      .cmp-picker {
        grid-template-columns: minmax(0, 1fr);
      }

      .cmp-picker-actions {
        justify-content: stretch;
      }

      .cmp-picker-actions .btn {
        width: 100%;
      }

      .cmp-verdict-summary {
        grid-template-columns: minmax(0, 1fr);
      }

      .cmp-table {
        font-size: 0.76rem;
      }

      .cmp-table th,
      .cmp-table td {
        padding: 8px;
      }
    }
  `;

  document.head.appendChild(style);
}

function listen(target, event, handler) {
  target.addEventListener(event, handler);
  listeners.push(() => target.removeEventListener(event, handler));
}

function destroyCharts() {
  charts.forEach((chart) => {
    try {
      chart.destroy();
    } catch (_) {
      // Ignore charts already disposed during a route change.
    }
  });
  charts = [];
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : 'no data';
}

function validNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function tierRank(tier) {
  const index = TIER_ORDER.indexOf(String(tier || '').toUpperCase());
  return index === -1 ? null : index;
}

function bestCombatTier(character) {
  const tiers = Array.isArray(character?.combat_tiers) ? character.combat_tiers : [];
  if (!tiers.length) return null;

  return tiers
    .filter((entry) => tierRank(entry.tier) !== null)
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier))[0]?.tier || null;
}

function buildAverages(character) {
  const builds = Array.isArray(character?.builds) ? character.builds : [];

  return builds.map((build) => {
    const damageLogs = Array.isArray(build.damage_logs) ? build.damage_logs : [];
    let average = validNumber(build.average_damage);

    if (average === null && damageLogs.length) {
      const values = damageLogs
        .map((log) => validNumber(log.damage_value))
        .filter((value) => value !== null);

      if (values.length) {
        average = values.reduce((sum, value) => sum + value, 0) / values.length;
      }
    }

    return { ...build, _averageDamage: average };
  });
}

function bestAverageDamage(character) {
  const builds = buildAverages(character);
  const values = builds
    .map((build) => build._averageDamage)
    .filter((value) => value !== null);

  return values.length ? Math.max(...values) : null;
}

function highestDamageBuildName(character) {
  const builds = buildAverages(character)
    .filter((build) => build._averageDamage !== null)
    .sort((a, b) => b._averageDamage - a._averageDamage);

  return builds[0]?.build_name || 'No data';
}

function getElementColor(theme, element) {
  try {
    return theme.elementColor(element);
  } catch (_) {
    return '#8B90A3';
  }
}

function getTierColor(theme, tier) {
  try {
    return theme.tierColor(tier);
  } catch (_) {
    return '#8B90A3';
  }
}

function elementChip(ui, theme, element) {
  const color = getElementColor(theme, element);

  return ui.el(
    'span',
    { class: 'cmp-element-chip' },
    ui.el('span', {
      class: 'cmp-element-swatch',
      style: { backgroundColor: color },
      'aria-hidden': 'true',
    }),
    element || 'Unknown element'
  );
}

function tierBadge(ui, theme, tier) {
  if (!tier) {
    return ui.el('span', { class: 'cmp-empty' }, 'Unranked');
  }

  const color = getTierColor(theme, tier);
  return ui.el(
    'span',
    {
      class: 'tier-badge cmp-tier-badge',
      style: {
        color,
        backgroundColor: `${color}20`,
        border: `1px solid ${color}60`,
      },
    },
    String(tier).toUpperCase()
  );
}

function emptyText(ui, message = 'No data') {
  return ui.el('span', { class: 'cmp-empty' }, message);
}

function buildCharacterHeader(ui, theme, character) {
  const rarity = Number(character.rarity) || 0;
  let diamonds = '';

  try {
    diamonds = theme.rarityDiamonds(rarity);
  } catch (_) {
    diamonds = '◆'.repeat(Math.max(0, Math.min(5, rarity)));
  }

  return ui.el(
    'div',
    { class: 'cmp-character-header' },
    characterVisual(ui, character, { compact: true, className: 'cmp-character-avatar' }),
    ui.el('h2', { class: 'cmp-character-name' }, character.name || 'Unknown character'),
    ui.el(
      'div',
      { class: 'cmp-character-meta' },
      elementChip(ui, theme, character.element),
      ui.el('span', { class: 'cmp-meta-chip' }, character.weapon_type || 'Unknown weapon'),
      ui.el(
        'span',
        {
          class: 'cmp-rarity',
          title: `${rarity}-star rarity`,
          'aria-label': `${rarity}-star rarity`,
        },
        diamonds || 'No rarity data'
      )
    )
  );
}

function buildTierSection(ui, theme, character) {
  const section = ui.el(
    'section',
    { class: 'cmp-detail-section' },
    ui.el('h3', { class: 'cmp-subtitle' }, 'Combat tiers')
  );

  const combatTiers = Array.isArray(character.combat_tiers) ? character.combat_tiers : [];

  if (!combatTiers.length) {
    section.appendChild(emptyText(ui, 'No combat tier data'));
  } else {
    const tierList = ui.el('div', { class: 'cmp-tier-list' });

    combatTiers.forEach((entry) => {
      tierList.appendChild(
        ui.el(
          'div',
          { class: 'cmp-tier-row' },
          tierBadge(ui, theme, entry.tier),
          ui.el('span', { class: 'cmp-tier-role' }, entry.role || 'Role not specified')
        )
      );
    });

    section.appendChild(tierList);
  }

  const exploration = character.exploration_tier;
  section.appendChild(
    ui.el(
      'div',
      { class: 'cmp-tier-row', style: { marginTop: '11px' } },
      ui.el('span', { class: 'cmp-tier-role' }, 'Exploration'),
      exploration?.tier
        ? tierBadge(ui, theme, exploration.tier)
        : emptyText(ui, 'Unranked')
    )
  );

  return section;
}

function buildBuildSection(ui, character) {
  const section = ui.el(
    'section',
    { class: 'cmp-detail-section' },
    ui.el('h3', { class: 'cmp-subtitle' }, 'Builds')
  );

  const builds = buildAverages(character);

  if (!builds.length) {
    section.appendChild(emptyText(ui, 'No builds available'));
    return section;
  }

  const maxAverage = Math.max(
    0,
    ...builds.map((build) => build._averageDamage ?? 0)
  );

  const list = ui.el('div', { class: 'cmp-build-list' });

  builds.forEach((build) => {
    const team = Array.isArray(build.team_members) ? build.team_members : [];
    const average = build._averageDamage;
    const isBest = average !== null && average === maxAverage && maxAverage > 0;

    const teamContent = team.length
      ? ui.el(
          'div',
          { class: 'cmp-team' },
          team.map((member) =>
            ui.el(
              'span',
              { class: 'cmp-team-chip' },
              member.teammate_name || `Character #${member.character_id}`
            )
          )
        )
      : emptyText(ui, 'No teammates');

    list.appendChild(
      ui.el(
        'article',
        { class: 'cmp-build' },
        ui.el('h4', { class: 'cmp-build-title' }, build.build_name || 'Unnamed build'),
        ui.el(
          'div',
          { class: 'cmp-build-detail' },
          'Weapon: ',
          build.weapon?.name || 'Unknown'
        ),
        ui.el(
          'div',
          { class: 'cmp-build-detail' },
          'Artifact set: ',
          build.artifact?.set_name || 'Unknown'
        ),
        teamContent,
        ui.el(
          'div',
          { class: `cmp-damage${isBest ? ' cmp-damage-winner' : ''}` },
          'Average damage: ',
          average === null ? 'no data' : formatNumber(average),
          isBest
            ? ui.el('span', { class: 'cmp-best-marker' }, '▲ Best')
            : null
        )
      )
    );
  });

  section.appendChild(list);
  return section;
}

function buildCharacterColumn(ui, theme, character, side, bestOverall) {
  const bestAverage = bestAverageDamage(character);
  const isBestOverall =
    bestAverage !== null &&
    bestOverall !== null &&
    bestAverage === bestOverall;

  return ui.el(
    'article',
    { class: 'cmp-column', 'data-character-side': side },
    ui.el(
      'section',
      { class: 'card cmp-card' },
      buildCharacterHeader(ui, theme, character),
      ui.el(
        'div',
        { class: `cmp-damage${isBestOverall ? ' cmp-damage-winner' : ''}`, style: { marginTop: '13px' } },
        'Best average damage: ',
        bestAverage === null ? 'no data' : formatNumber(bestAverage),
        isBestOverall
          ? ui.el('span', { class: 'cmp-best-marker' }, '▲ Higher')
          : null
      )
    ),
    ui.el(
      'section',
      { class: 'card cmp-card' },
      buildTierSection(ui, theme, character),
      buildBuildSection(ui, character)
    ),
    ui.el(
      'a',
      {
        class: 'btn primary cmp-open-lab',
        href: `#/damage-lab?character_id=${encodeURIComponent(character.id)}`,
      },
      'Open in Damage Lab'
    )
  );
}

function compareValues(a, b, kind) {
  if (a === null || a === undefined || b === null || b === undefined) {
    return null;
  }

  if (kind === 'tier') {
    const rankA = tierRank(a);
    const rankB = tierRank(b);
    if (rankA === null || rankB === null || rankA === rankB) return null;
    return rankA < rankB ? 'a' : 'b';
  }

  if (typeof a === 'number' && typeof b === 'number') {
    if (a === b) return null;
    return a > b ? 'a' : 'b';
  }

  return null;
}

function buildComparisonTable(ui, characterA, characterB) {
  const bestA = bestAverageDamage(characterA);
  const bestB = bestAverageDamage(characterB);
  const tierA = bestCombatTier(characterA);
  const tierB = bestCombatTier(characterB);
  const buildsA = Array.isArray(characterA.builds) ? characterA.builds.length : 0;
  const buildsB = Array.isArray(characterB.builds) ? characterB.builds.length : 0;

  const rows = [
    {
      metric: 'Rarity',
      a: validNumber(characterA.rarity),
      b: validNumber(characterB.rarity),
      displayA: characterA.rarity ? `${characterA.rarity}★` : 'No data',
      displayB: characterB.rarity ? `${characterB.rarity}★` : 'No data',
      winner: compareValues(validNumber(characterA.rarity), validNumber(characterB.rarity)),
    },
    {
      metric: 'Element',
      a: characterA.element,
      b: characterB.element,
      displayA: characterA.element || 'No data',
      displayB: characterB.element || 'No data',
      winner: null,
    },
    {
      metric: 'Weapon type',
      a: characterA.weapon_type,
      b: characterB.weapon_type,
      displayA: characterA.weapon_type || 'No data',
      displayB: characterB.weapon_type || 'No data',
      winner: null,
    },
    {
      metric: 'Best combat tier',
      a: tierA,
      b: tierB,
      displayA: tierA || 'Unranked',
      displayB: tierB || 'Unranked',
      winner: compareValues(tierA, tierB, 'tier'),
    },
    {
      metric: 'Number of builds',
      a: buildsA,
      b: buildsB,
      displayA: String(buildsA),
      displayB: String(buildsB),
      winner: compareValues(buildsA, buildsB),
    },
    {
      metric: 'Best average damage',
      a: bestA,
      b: bestB,
      displayA: bestA === null ? 'No data' : formatNumber(bestA),
      displayB: bestB === null ? 'No data' : formatNumber(bestB),
      winner: compareValues(bestA, bestB),
    },
    {
      metric: 'Highest-damage build',
      a: highestDamageBuildName(characterA),
      b: highestDamageBuildName(characterB),
      displayA: highestDamageBuildName(characterA),
      displayB: highestDamageBuildName(characterB),
      winner: null,
    },
  ];

  const table = ui.el(
    'div',
    { class: 'cmp-table-wrap' },
    ui.el(
      'table',
      { class: 'cmp-table' },
      ui.el(
        'thead',
        {},
        ui.el(
          'tr',
          {},
          ui.el('th', { scope: 'col' }, 'Metric'),
          ui.el('th', { scope: 'col' }, characterA.name || 'Character A'),
          ui.el('th', { scope: 'col' }, characterB.name || 'Character B')
        )
      ),
      ui.el(
        'tbody',
        {},
        rows.map((row) =>
          ui.el(
            'tr',
            {},
            ui.el('td', {}, row.metric),
            ui.el(
              'td',
              {
                class: row.winner === 'a' ? 'cmp-cell-winner' : '',
              },
              row.displayA
            ),
            ui.el(
              'td',
              {
                class: row.winner === 'b' ? 'cmp-cell-winner' : '',
              },
              row.displayB
            )
          )
        )
      )
    )
  );

  return ui.el(
    'section',
    { class: 'cmp-verdict' },
    ui.el('h2', { class: 'cmp-verdict-title' }, 'Verdict'),
    ui.el(
      'div',
      { class: 'cmp-verdict-summary' },
      buildVerdictSide(ui, 'Character A', bestA, bestB, 'a'),
      buildVerdictSide(ui, 'Character B', bestB, bestA, 'b')
    ),
    table
  );
}

function buildVerdictSide(ui, label, ownAverage, otherAverage, side) {
  const wins =
    ownAverage !== null &&
    otherAverage !== null &&
    (side === 'a' ? ownAverage > otherAverage : ownAverage > otherAverage);

  return ui.el(
    'div',
    { class: 'cmp-verdict-side' },
    ui.el('span', { class: 'cmp-verdict-label' }, label),
    ui.el(
      'span',
      { class: `cmp-verdict-value${wins ? ' cmp-winner' : ''}` },
      ownAverage === null ? 'No damage data' : formatNumber(ownAverage)
    ),
    ui.el(
      'span',
      { class: 'cmp-muted' },
      ownAverage === null || otherAverage === null
        ? 'Average damage comparison unavailable'
        : ownAverage === otherAverage
          ? 'Average damage tied'
          : wins
            ? 'Higher average damage'
            : 'Lower average damage'
    )
  );
}

function buildDamageChart(ui, theme, characterA, characterB) {
  const buildsA = buildAverages(characterA).filter((build) => build._averageDamage !== null);
  const buildsB = buildAverages(characterB).filter((build) => build._averageDamage !== null);

  if (!buildsA.length && !buildsB.length) return null;
  if (typeof Chart === 'undefined') return null;

  const colorA = getElementColor(theme, characterA.element);
  const colorB = getElementColor(theme, characterB.element);

  const chartCard = ui.el(
    'section',
    { class: 'card cmp-chart-card' },
    ui.el('h2', { class: 'cmp-chart-title' }, 'Average damage by build'),
    ui.el(
      'p',
      { class: 'cmp-muted' },
      'Only builds with recorded average damage are shown.'
    ),
    ui.el(
      'div',
      { class: 'cmp-chart-container' },
      ui.el('canvas', {
        id: 'cmp-damage-chart',
        role: 'img',
        'aria-label': 'Average damage by build for both selected characters',
      })
    )
  );

  const labelsA = buildsA.map((build) => `${characterA.name}: ${build.build_name || 'Unnamed build'}`);
  const labelsB = buildsB.map((build) => `${characterB.name}: ${build.build_name || 'Unnamed build'}`);
  const labels = [...labelsA, ...labelsB];

  const dataA = [
    ...buildsA.map((build) => build._averageDamage),
    ...buildsB.map(() => null),
  ];
  const dataB = [
    ...buildsA.map(() => null),
    ...buildsB.map((build) => build._averageDamage),
  ];

  const canvas = chartCard.querySelector('#cmp-damage-chart');

  charts.push(
    new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: characterA.name || 'Character A',
            data: dataA,
            backgroundColor: colorA,
            borderRadius: 5,
            maxBarThickness: 36,
          },
          {
            label: characterB.name || 'Character B',
            data: dataB,
            backgroundColor: colorB,
            borderRadius: 5,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        color: '#ECEDF2',
        plugins: {
          legend: {
            labels: {
              color: '#ECEDF2',
              usePointStyle: true,
              padding: 14,
              font: { size: 11 },
            },
          },
          tooltip: {
            backgroundColor: '#1B1E27',
            titleColor: '#ECEDF2',
            bodyColor: '#ECEDF2',
            borderColor: '#2A2E3A',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            grid: { color: '#2A2E3A' },
            ticks: {
              color: '#8B90A3',
              maxRotation: 45,
              minRotation: 0,
              autoSkip: false,
              font: { size: 10 },
            },
            border: { color: '#2A2E3A' },
          },
          y: {
            beginAtZero: true,
            grid: { color: '#2A2E3A' },
            ticks: { color: '#8B90A3' },
            border: { color: '#2A2E3A' },
          },
        },
      },
    })
  );

  return chartCard;
}

function parseInitialId(value) {
  if (value === null || value === undefined || value === '') return '';
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? String(id) : '';
}

function currentUrlParams() {
  const hash = window.location.hash || '#/';
  const queryIndex = hash.indexOf('?');
  const search = queryIndex >= 0 ? hash.slice(queryIndex + 1) : '';
  return new URLSearchParams(search);
}

function updateHashParams(a, b) {
  const hash = window.location.hash || '#/compare';
  const route = hash.split('?')[0] || '#/compare';
  const params = currentUrlParams();

  if (a) params.set('a', String(a));
  else params.delete('a');

  if (b) params.set('b', String(b));
  else params.delete('b');

  const query = params.toString();
  const nextHash = query ? `${route}?${query}` : route;

  if (nextHash !== hash) {
    history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}${nextHash}`);
  }
}

function buildPicker(ui, characters, selectedA, selectedB) {
  const picker = ui.el('div', { class: 'card cmp-picker' });

  const makeSelect = (label, id, selected) => {
    const select = ui.el(
      'select',
      { id, name: id, 'aria-label': label },
      ui.el('option', { value: '' }, 'Select a character'),
      characters.map((character) =>
        ui.el(
          'option',
          {
            value: String(character.id),
            selected: String(character.id) === String(selected),
          },
          character.name || `Character #${character.id}`
        )
      )
    );

    return ui.el(
      'div',
      { class: 'cmp-picker-side' },
      ui.el('label', { htmlFor: id }, label),
      select
    );
  };

  picker.appendChild(makeSelect('Character A', 'cmp-select-a', selectedA));
  picker.appendChild(
    ui.el(
      'div',
      { class: 'cmp-picker-actions' },
      ui.el('button', { class: 'btn ghost', type: 'button', id: 'cmp-swap' }, 'Swap')
    )
  );
  picker.appendChild(makeSelect('Character B', 'cmp-select-b', selectedB));

  return picker;
}

function characterNotFound(ui, side) {
  return ui.el(
    'div',
    { class: 'card cmp-card cmp-error' },
    `Character ${side} could not be loaded. Choose another character.`
  );
}

function renderSelectionPrompt(ui) {
  return ui.el(
    'div',
    { class: 'card cmp-card' },
    ui.emptyState('Choose two characters above to compare their tiers, builds, and damage data.')
  );
}

function buildFullComparison(ui, theme, characterA, characterB) {
  const averageA = bestAverageDamage(characterA);
  const averageB = bestAverageDamage(characterB);
  const overallBest =
    averageA === null ? averageB : averageB === null ? averageA : Math.max(averageA, averageB);

  const comparison = ui.el(
    'div',
    { class: 'cmp-page' },
    ui.el(
      'div',
      { class: 'cmp-characters' },
      buildCharacterColumn(ui, theme, characterA, 'a', overallBest),
      buildCharacterColumn(ui, theme, characterB, 'b', overallBest)
    ),
    buildComparisonTable(ui, characterA, characterB)
  );

  const chart = buildDamageChart(ui, theme, characterA, characterB);
  if (chart) comparison.appendChild(chart);

  return comparison;
}

async function loadComparison(root, ctx, characters, selectedA, selectedB, status) {
  const version = ++renderVersion;
  destroyCharts();

  updateHashParams(selectedA, selectedB);

  const existing = root.querySelector('.cmp-results');
  if (existing) existing.replaceChildren(ctx.ui.skeleton(4));

  if (!selectedA || !selectedB) {
    if (existing) existing.replaceChildren(renderSelectionPrompt(ctx.ui));
    return;
  }

  if (String(selectedA) === String(selectedB)) {
    ctx.ui.toast('Choose two different characters to compare.', 'info');
    if (existing) existing.replaceChildren(renderSelectionPrompt(ctx.ui));
    return;
  }

  if (!existing) return;

  existing.replaceChildren(ctx.ui.skeleton(6));

  try {
    // Fetch both character records concurrently to compare their related rows.
    const [characterA, characterB] = await Promise.all([
      ctx.api.get(`/characters/${encodeURIComponent(selectedA)}`),
      ctx.api.get(`/characters/${encodeURIComponent(selectedB)}`),
    ]);

    if (version !== renderVersion || activeRoot !== root) return;

    existing.replaceChildren(
      buildFullComparison(ctx.ui, ctx.theme, characterA, characterB)
    );
  } catch (err) {
    if (version !== renderVersion || activeRoot !== root) return;

    existing.replaceChildren(
      ctx.ui.el(
        'div',
        { class: 'card cmp-card cmp-error' },
        'Unable to load comparison data. Select the characters again or retry.'
      )
    );

    ctx.ui.toast(err?.message || 'Failed to load character comparison.', 'error');
  }
}

export async function render(root, ctx) {
  destroy();

  activeRoot = root;
  activeContext = ctx;
  injectStyles();

  const ui = ctx.ui;

  root.appendChild(ui.skeleton(6));

  try {
    // The character directory is fetched once; detail requests happen only after selection.
    const response = await ctx.api.get('/characters');
    if (activeRoot !== root) return;

    const characters = (Array.isArray(response) ? response : [])
      .slice()
      .sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), undefined, {
          sensitivity: 'base',
        })
      );

    root.replaceChildren();

    const selectedA = parseInitialId(ctx.params?.a);
    const selectedB = parseInitialId(ctx.params?.b);

    const validIds = new Set(characters.map((character) => String(character.id)));
    const initialA = validIds.has(selectedA) ? selectedA : '';
    const initialB = validIds.has(selectedB) ? selectedB : '';

    const page = ui.el(
      'div',
      { class: 'cmp-page' },
      ui.el(
        'header',
        { class: 'cmp-head' },
        ui.el('h1', {}, 'Compare'),
        ui.el(
          'p',
          { class: 'cmp-muted' },
          'Compare character stats, combat rankings, recommended builds, and recorded damage.'
        )
      ),
      buildPicker(ui, characters, initialA, initialB),
      ui.el('div', { class: 'cmp-results' }, renderSelectionPrompt(ui))
    );

    root.appendChild(page);

    const selectA = root.querySelector('#cmp-select-a');
    const selectB = root.querySelector('#cmp-select-b');
    const swap = root.querySelector('#cmp-swap');
    const results = root.querySelector('.cmp-results');

    if (!characters.length) {
      results.replaceChildren(ui.emptyState('No characters found in the database.'));
      return;
    }

    const getSelection = () => ({
      a: selectA.value,
      b: selectB.value,
    });

    const refresh = async () => {
      const selection = getSelection();
      await loadComparison(root, ctx, characters, selection.a, selection.b);
    };

    listen(selectA, 'change', () => {
      const selection = getSelection();
      if (selection.a && selection.a === selection.b) {
        ui.toast('Choose two different characters to compare.', 'info');
        updateHashParams(selection.a, '');
        results.replaceChildren(renderSelectionPrompt(ui));
        return;
      }
      refresh();
    });

    listen(selectB, 'change', () => {
      const selection = getSelection();
      if (selection.a && selection.a === selection.b) {
        ui.toast('Choose two different characters to compare.', 'info');
        updateHashParams('', selection.b);
        results.replaceChildren(renderSelectionPrompt(ui));
        return;
      }
      refresh();
    });

    listen(swap, 'click', () => {
      const previousA = selectA.value;
      selectA.value = selectB.value;
      selectB.value = previousA;

      const selection = getSelection();
      if (selection.a && selection.a === selection.b) {
        ui.toast('Choose two different characters to compare.', 'info');
        return;
      }

      refresh();
    });

    if (initialA && initialB && initialA === initialB) {
      ui.toast('Choose two different characters to compare.', 'info');
      updateHashParams(initialA, '');
      selectB.value = '';
    }

    if (initialA && initialB && initialA !== initialB) {
      await refresh();
    } else {
      updateHashParams(initialA, initialB);
    }
  } catch (err) {
    if (activeRoot !== root) return;

    root.replaceChildren(
      ui.emptyState('Could not load characters. Check your database connection and try again.')
    );
    ui.toast(err?.message || 'Failed to load characters.', 'error');
  }
}

export function destroy() {
  renderVersion += 1;
  destroyCharts();

  listeners.forEach((remove) => {
    try {
      remove();
    } catch (_) {
      // Listener cleanup should not interrupt route changes.
    }
  });
  listeners = [];

  activeRoot = null;
  activeContext = null;
}
