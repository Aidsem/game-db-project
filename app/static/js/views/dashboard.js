// app/static/js/views/dashboard.js
// Dashboard: demonstrates database aggregation, grouped analytics, audit logging,
// stored-data summaries, and the relationship between PostgreSQL records and the UI.

let charts = [];
let animationFrames = [];
let activeRoot = null;
let delegatedClickHandler = null;

const VIEW = 'dash';

const STAT_CARDS = [
  { key: 'characters', label: 'Characters', href: '#/characters', icon: '♙' },
  { key: 'weapons', label: 'Weapons', href: '#/weapons', icon: '⚔' },
  { key: 'artifacts', label: 'Artifacts', href: '#/artifacts', icon: '◇' },
  { key: 'builds', label: 'Builds', href: '#/builds', icon: '⌘' },
  { key: 'damage_logs', label: 'Damage logs', href: '#/damage-lab', icon: '↗' },
];

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];

function injectStyles() {
  if (document.getElementById('dash-css')) return;

  const style = document.createElement('style');
  style.id = 'dash-css';
  style.textContent = `
    .dash-page {
      display: flex;
      flex-direction: column;
      gap: 22px;
      width: 100%;
      min-width: 0;
      color: var(--text, #ECEDF2);
    }

    .dash-page-head {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .dash-page-head h1 {
      margin: 0;
      font-family: Fraunces, Georgia, serif;
      font-size: clamp(1.7rem, 3vw, 2.25rem);
      line-height: 1.2;
    }

    .dash-page-subtitle {
      margin: 0;
      color: var(--muted, #8B90A3);
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .dash-stats {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }

    .dash-stat-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      min-height: 112px;
      padding: 17px;
      color: var(--text, #ECEDF2);
      text-decoration: none;
      transition: border-color 160ms ease, transform 160ms ease;
    }

    .dash-stat-card:hover,
    .dash-stat-card:focus-visible {
      border-color: var(--teal, #3FC9BE);
      transform: translateY(-2px);
      outline: none;
    }

    .dash-stat-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .dash-stat-label {
      color: var(--muted, #8B90A3);
      font-size: 0.8rem;
      line-height: 1.4;
    }

    .dash-stat-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 30px;
      height: 30px;
      border-radius: 9px;
      background: var(--surface-2, #242833);
      color: var(--teal, #3FC9BE);
      font-size: 1.1rem;
    }

    .dash-stat-value {
      font-size: clamp(1.45rem, 2.5vw, 2rem);
      font-weight: 750;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }

    .dash-section {
      display: flex;
      flex-direction: column;
      gap: 13px;
      min-width: 0;
    }

    .dash-section-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 8px;
    }

    .dash-section-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
    }

    .dash-section-note {
      color: var(--muted, #8B90A3);
      font-size: 0.8rem;
    }

    .dash-chart-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      align-items: stretch;
    }

    .dash-chart-card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
      padding: 17px;
    }

    .dash-chart-title {
      margin: 0;
      font-size: 0.98rem;
      font-weight: 650;
    }

    .dash-chart-description {
      margin: 4px 0 0;
      color: var(--muted, #8B90A3);
      font-size: 0.78rem;
      line-height: 1.45;
    }

    .dash-chart-container {
      position: relative;
      width: 100%;
      height: 260px;
      min-width: 0;
    }

    .dash-chart-container canvas {
      display: block;
      width: 100% !important;
      height: 260px !important;
      max-width: 100%;
    }

    .dash-chart-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 260px;
    }

    .dash-content-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }

    .dash-panel {
      min-width: 0;
      padding: 18px;
    }

    .dash-build-list,
    .dash-activity-list {
      display: flex;
      flex-direction: column;
      gap: 0;
      min-width: 0;
    }

    .dash-build-row {
      display: grid;
      grid-template-columns: 30px minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 14px 0;
      color: var(--text, #ECEDF2);
      text-decoration: none;
      border-bottom: 1px solid var(--border, #2A2E3A);
      min-width: 0;
    }

    .dash-build-row:last-child {
      border-bottom: none;
    }

    .dash-build-row:hover,
    .dash-build-row:focus-visible {
      outline: none;
    }

    .dash-build-row:hover .dash-build-name,
    .dash-build-row:focus-visible .dash-build-name {
      color: var(--teal, #3FC9BE);
    }

    .dash-rank {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: var(--surface-2, #242833);
      color: var(--muted, #8B90A3);
      font-size: 0.8rem;
      font-weight: 750;
    }

    .dash-build-main {
      min-width: 0;
    }

    .dash-build-name {
      display: block;
      font-weight: 650;
      font-size: 0.9rem;
      overflow-wrap: anywhere;
      transition: color 150ms ease;
    }

    .dash-build-character {
      display: block;
      margin-top: 4px;
      color: var(--muted, #8B90A3);
      font-size: 0.78rem;
      overflow-wrap: anywhere;
    }

    .dash-build-bar-track {
      height: 4px;
      width: 100%;
      margin-top: 9px;
      overflow: hidden;
      border-radius: 99px;
      background: var(--surface-2, #242833);
    }

    .dash-build-bar {
      height: 100%;
      width: 0;
      border-radius: inherit;
      background: var(--teal, #3FC9BE);
      transition: width 300ms ease;
    }

    .dash-build-damage {
      text-align: right;
      font-size: 0.88rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .dash-build-runs {
      display: block;
      margin-top: 4px;
      color: var(--muted, #8B90A3);
      font-size: 0.72rem;
      font-weight: 400;
    }

    .dash-activity-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 11px;
      align-items: start;
      padding: 12px 0;
      border-bottom: 1px solid var(--border, #2A2E3A);
      min-width: 0;
    }

    .dash-activity-row:last-child {
      border-bottom: none;
    }

    .dash-action-chip {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      min-width: 63px;
      padding: 4px 7px;
      border: 1px solid var(--border, #2A2E3A);
      border-radius: 6px;
      font-size: 0.67rem;
      font-weight: 750;
      letter-spacing: 0.04em;
    }

    .dash-action-insert {
      color: #57D99B;
      background: rgba(49, 185, 117, 0.1);
      border-color: rgba(49, 185, 117, 0.25);
    }

    .dash-action-delete {
      color: #FF7D85;
      background: rgba(239, 83, 96, 0.1);
      border-color: rgba(239, 83, 96, 0.25);
    }

    .dash-action-other {
      color: var(--muted, #8B90A3);
      background: var(--surface-2, #242833);
    }

    .dash-activity-main {
      min-width: 0;
    }

    .dash-activity-table {
      font-size: 0.84rem;
      font-weight: 650;
      overflow-wrap: anywhere;
    }

    .dash-activity-details {
      margin-top: 4px;
      color: var(--muted, #8B90A3);
      font-size: 0.78rem;
      line-height: 1.5;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    .dash-activity-time {
      display: block;
      margin-top: 5px;
      color: var(--muted, #8B90A3);
      font-size: 0.72rem;
    }

    .dash-footer-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 15px 18px;
    }

    .dash-footer-title {
      margin: 0;
      font-size: 0.85rem;
      font-weight: 650;
    }

    .dash-footer-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .dash-sdg-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 7px 10px;
      border: 1px solid var(--border, #2A2E3A);
      border-radius: 8px;
      color: var(--text, #ECEDF2);
      background: var(--surface-2, #242833);
      font-size: 0.75rem;
      line-height: 1.4;
    }

    .dash-sdg-number {
      color: var(--teal, #3FC9BE);
      font-weight: 800;
      white-space: nowrap;
    }

    .dash-empty {
      padding: 12px 0;
    }

    @media (max-width: 1050px) {
      .dash-stats {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .dash-chart-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .dash-chart-card:last-child {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 800px) {
      .dash-content-grid {
        grid-template-columns: minmax(0, 1fr);
      }

      .dash-chart-grid {
        grid-template-columns: minmax(0, 1fr);
      }

      .dash-chart-card:last-child {
        grid-column: auto;
      }

      .dash-chart-card {
        padding: 14px;
      }
    }

    @media (max-width: 480px) {
      .dash-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 9px;
      }

      .dash-stat-card {
        padding: 13px;
        min-height: 100px;
      }

      .dash-stat-label {
        font-size: 0.75rem;
      }

      .dash-panel {
        padding: 14px;
      }

      .dash-build-row {
        grid-template-columns: 26px minmax(0, 1fr);
        gap: 9px;
      }

      .dash-rank {
        width: 25px;
        height: 25px;
      }

      .dash-build-damage {
        grid-column: 2;
        text-align: left;
      }

      .dash-footer-card {
        align-items: flex-start;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .dash-stat-card,
      .dash-build-bar,
      .dash-build-name {
        transition: none;
      }
    }
  `;

  document.head.appendChild(style);
}

function stopAnimations() {
  animationFrames.forEach((id) => cancelAnimationFrame(id));
  animationFrames = [];
}

function destroyCharts() {
  charts.forEach((chart) => {
    try {
      chart.destroy();
    } catch (_) {
      // A chart may already have been disposed during navigation.
    }
  });
  charts = [];
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : '0';
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Converts audit timestamps into concise relative times for the activity feed.
function timeAgo(value) {
  const date = safeDate(value);
  if (!date) return 'Time unavailable';

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 45) return 'Just now';
  if (seconds < 90) return '1 min ago';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 120) return '1 hour ago';

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  if (hours < 48) return 'Yesterday';

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} days ago`;
  if (days < 60) return '1 month ago';

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} months ago`;

  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

function getDetailsText(details) {
  if (details === null || details === undefined || details === '') {
    return 'No additional details';
  }

  if (typeof details === 'string') return details;

  try {
    return JSON.stringify(details);
  } catch (_) {
    return String(details);
  }
}

function getChartColors(theme, elements) {
  return elements.map((element) => {
    try {
      return theme.elementColor(element);
    } catch (_) {
      return '#8B90A3';
    }
  });
}

function makeChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    color: '#ECEDF2',
    plugins: {
      legend: {
        labels: {
          color: '#ECEDF2',
          usePointStyle: true,
          padding: 14,
          boxWidth: 9,
          font: { size: 11 },
        },
      },
      tooltip: {
        backgroundColor: '#1B1E27',
        titleColor: '#ECEDF2',
        bodyColor: '#ECEDF2',
        borderColor: '#2A2E3A',
        borderWidth: 1,
        padding: 10,
      },
    },
    scales: {
      x: {
        grid: { color: '#2A2E3A' },
        ticks: { color: '#8B90A3', font: { size: 10 } },
        border: { color: '#2A2E3A' },
      },
      y: {
        grid: { color: '#2A2E3A' },
        ticks: { color: '#8B90A3', font: { size: 10 } },
        border: { color: '#2A2E3A' },
      },
    },
  };
}

function animateCount(element, target) {
  const endValue = Math.max(0, Number(target) || 0);
  const duration = 600;
  const start = performance.now();

  const update = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(endValue * eased);

    element.textContent = current.toLocaleString();

    if (progress < 1) {
      animationFrames.push(requestAnimationFrame(update));
    } else {
      element.textContent = endValue.toLocaleString();
    }
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    element.textContent = endValue.toLocaleString();
    return;
  }

  animationFrames.push(requestAnimationFrame(update));
}

function buildStatCards(ui, counts) {
  return ui.el(
    'div',
    { class: 'dash-stats', 'aria-label': 'Database record counts' },
    STAT_CARDS.map((stat) => {
      const value = Math.max(0, Number(counts?.[stat.key]) || 0);

      const number = ui.el(
        'div',
        {
          class: 'dash-stat-value',
          'data-count-target': value,
          'aria-label': `${stat.label}: ${formatNumber(value)}`,
        },
        '0'
      );

      const card = ui.el(
        'a',
        {
          class: 'card dash-stat-card',
          href: stat.href,
          'aria-label': `Open ${stat.label}`,
        },
        ui.el(
          'div',
          { class: 'dash-stat-top' },
          ui.el('span', { class: 'stat-label dash-stat-label' }, stat.label),
          ui.el('span', { class: 'dash-stat-icon', 'aria-hidden': 'true' }, stat.icon)
        ),
        ui.el('div', { class: 'stat dash-stat-value-wrap' }, number)
      );

      return card;
    })
  );
}

function buildChartCard(ui, title, description, canvasId) {
  return ui.el(
    'section',
    { class: 'card dash-chart-card' },
    ui.el(
      'div',
      {},
      ui.el('h3', { class: 'dash-chart-title' }, title),
      ui.el('p', { class: 'dash-chart-description' }, description)
    ),
    ui.el(
      'div',
      { class: 'dash-chart-container', 'data-chart-container': canvasId },
      ui.el('canvas', {
        id: canvasId,
        role: 'img',
        'aria-label': title,
      })
    )
  );
}

function buildCharts(ui, theme, summary) {
  const elements = Array.isArray(summary.by_element) ? summary.by_element : [];
  const tiers = Array.isArray(summary.combat_tiers) ? summary.combat_tiers : [];
  const weaponTypes = Array.isArray(summary.by_weapon_type)
    ? summary.by_weapon_type
    : [];

  const chartGrid = ui.el(
    'div',
    { class: 'dash-chart-grid' },
    buildChartCard(
      ui,
      'Characters by element',
      'Distribution of characters across the seven elements.',
      'dash-element-chart'
    ),
    buildChartCard(
      ui,
      'Combat tier distribution',
      'Character entries grouped from S tier to D tier.',
      'dash-tier-chart'
    ),
    buildChartCard(
      ui,
      'Weapons by type',
      'Number of weapon records for each weapon type.',
      'dash-weapon-chart'
    )
  );

  if (typeof Chart === 'undefined') {
    chartGrid.replaceChildren(
      ui.emptyState('Chart.js is unavailable. Check that its CDN script loads before the view.')
    );
    return chartGrid;
  }

  // A missing category is a valid database state, not a rendering error.
  if (!elements.length) {
    const container = chartGrid.querySelector('[data-chart-container="dash-element-chart"]');
    if (container) {
      container.replaceChildren(
        ui.el('div', { class: 'dash-chart-empty' }, ui.emptyState('No character data yet.'))
      );
    }
  } else {
    const canvas = chartGrid.querySelector('#dash-element-chart');
    const labels = elements.map((item) => String(item.element ?? 'Unknown'));
    const data = elements.map((item) => Number(item.total) || 0);

    charts.push(
      new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: getChartColors(theme, labels),
              borderColor: '#1B1E27',
              borderWidth: 3,
              hoverOffset: 5,
            },
          ],
        },
        options: {
          ...makeChartOptions(),
          cutout: '63%',
          plugins: {
            ...makeChartOptions().plugins,
            legend: {
              position: 'bottom',
              labels: makeChartOptions().plugins.legend.labels,
            },
          },
        },
      })
    );
  }

  const orderedTiers = TIER_ORDER.map((tier) => {
    const found = tiers.find((item) => String(item.tier).toUpperCase() === tier);
    return { tier, total: Number(found?.total) || 0 };
  });

  if (!tiers.length) {
    const container = chartGrid.querySelector('[data-chart-container="dash-tier-chart"]');
    if (container) {
      container.replaceChildren(
        ui.el('div', { class: 'dash-chart-empty' }, ui.emptyState('No combat tier entries yet.'))
      );
    }
  } else {
    const canvas = chartGrid.querySelector('#dash-tier-chart');

    charts.push(
      new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: orderedTiers.map((item) => item.tier),
          datasets: [
            {
              label: 'Characters',
              data: orderedTiers.map((item) => item.total),
              backgroundColor: orderedTiers.map((item) => {
                try {
                  return theme.tierColor(item.tier);
                } catch (_) {
                  return '#8B90A3';
                }
              }),
              borderRadius: 6,
              maxBarThickness: 42,
            },
          ],
        },
        options: {
          ...makeChartOptions(),
          plugins: {
            ...makeChartOptions().plugins,
            legend: { display: false },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                color: '#8B90A3',
                font: { size: 12, weight: 'bold' },
              },
              border: { color: '#2A2E3A' },
            },
            y: {
              beginAtZero: true,
              ticks: {
                color: '#8B90A3',
                precision: 0,
                stepSize: 1,
              },
              grid: { color: '#2A2E3A' },
              border: { color: '#2A2E3A' },
            },
          },
        },
      })
    );
  }

  if (!weaponTypes.length) {
    const container = chartGrid.querySelector('[data-chart-container="dash-weapon-chart"]');
    if (container) {
      container.replaceChildren(
        ui.el('div', { class: 'dash-chart-empty' }, ui.emptyState('No weapon data yet.'))
      );
    }
  } else {
    const canvas = chartGrid.querySelector('#dash-weapon-chart');
    const palette = Array.isArray(theme.CHART_COLORS) && theme.CHART_COLORS.length
      ? theme.CHART_COLORS
      : ['#3FC9BE', '#F2A541', '#8B7FD8', '#62A8EA', '#E67F9A'];

    charts.push(
      new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: weaponTypes.map((item) => String(item.weapon_type ?? 'Unknown')),
          datasets: [
            {
              label: 'Weapons',
              data: weaponTypes.map((item) => Number(item.total) || 0),
              backgroundColor: weaponTypes.map((_, index) => palette[index % palette.length]),
              borderRadius: 5,
              maxBarThickness: 30,
            },
          ],
        },
        options: {
          ...makeChartOptions(),
          indexAxis: 'y',
          plugins: {
            ...makeChartOptions().plugins,
            legend: { display: false },
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                color: '#8B90A3',
                precision: 0,
                stepSize: 1,
              },
              grid: { color: '#2A2E3A' },
              border: { color: '#2A2E3A' },
            },
            y: {
              ticks: { color: '#8B90A3', font: { size: 10 } },
              grid: { display: false },
              border: { color: '#2A2E3A' },
            },
          },
        },
      })
    );
  }

  return chartGrid;
}

function buildTopBuilds(ui, topBuilds) {
  const section = ui.el(
    'section',
    { class: 'dash-section' },
    ui.el(
      'div',
      { class: 'dash-section-head' },
      ui.el('h2', { class: 'dash-section-title' }, 'Top builds by average damage'),
      ui.el('span', { class: 'dash-section-note' }, 'Ranked by average recorded damage')
    )
  );

  if (!topBuilds.length) {
    section.appendChild(
      ui.el('div', { class: 'card dash-panel dash-empty' },
        ui.emptyState('No damage logs yet. Add some in Damage Lab')
      )
    );
    return section;
  }

  const ranked = topBuilds
    .slice()
    .sort((a, b) => (Number(b.avg_damage) || 0) - (Number(a.avg_damage) || 0))
    .slice(0, 5);

  const maxAverage = Math.max(0, ...ranked.map((item) => Number(item.avg_damage) || 0));

  const list = ui.el('div', { class: 'dash-build-list' });

  ranked.forEach((build, index) => {
    const average = Math.max(0, Number(build.avg_damage) || 0);
    const width = maxAverage > 0 ? (average / maxAverage) * 100 : 0;
    const href = '#/damage-lab';

    const row = ui.el(
      'a',
      {
        class: 'dash-build-row',
        href,
        'aria-label': `Open Damage Lab. Rank ${index + 1}: ${build.character_name || 'Unknown character'}, ${build.build_name || 'Unnamed build'}`,
        title: 'Open Damage Lab',
      },
      ui.el('span', { class: 'dash-rank' }, String(index + 1)),
      ui.el(
        'div',
        { class: 'dash-build-main' },
        ui.el('span', { class: 'dash-build-name' }, build.build_name || 'Unnamed build'),
        ui.el('span', { class: 'dash-build-character' }, build.character_name || 'Unknown character'),
        ui.el(
          'div',
          {
            class: 'dash-build-bar-track',
            role: 'progressbar',
            'aria-label': 'Relative average damage',
            'aria-valuemin': '0',
            'aria-valuemax': String(maxAverage),
            'aria-valuenow': String(average),
          },
          ui.el('div', {
            class: 'dash-build-bar',
            style: { width: `${width}%` },
          })
        )
      ),
      ui.el(
        'div',
        { class: 'dash-build-damage' },
        formatNumber(average),
        ui.el('span', { class: 'dash-build-runs' }, `${Number(build.runs) || 0} runs`)
      )
    );

    list.appendChild(row);
  });

  section.appendChild(ui.el('div', { class: 'card dash-panel' }, list));
  return section;
}

function buildActivity(ui, auditRows) {
  const section = ui.el(
    'section',
    { class: 'dash-section' },
    ui.el(
      'div',
      { class: 'dash-section-head' },
      ui.el('h2', { class: 'dash-section-title' }, 'Recent activity'),
      ui.el('span', { class: 'dash-section-note' }, 'Latest database audit events')
    )
  );

  if (!auditRows.length) {
    section.appendChild(
      ui.el('div', { class: 'card dash-panel dash-empty' },
        ui.emptyState('No audit activity recorded yet.')
      )
    );
    return section;
  }

  const list = ui.el('div', { class: 'dash-activity-list' });

  auditRows.slice(0, 5).forEach((row) => {
    const action = String(row.action || 'UNKNOWN').toUpperCase();
    const actionClass = action === 'INSERT'
      ? 'dash-action-insert'
      : action === 'DELETE'
        ? 'dash-action-delete'
        : 'dash-action-other';

    list.appendChild(
      ui.el(
        'div',
        { class: 'dash-activity-row' },
        ui.el('span', { class: `dash-action-chip ${actionClass}` }, action),
        ui.el(
          'div',
          { class: 'dash-activity-main' },
          ui.el('div', { class: 'dash-activity-table' }, row.table_name || 'Unknown table'),
          ui.el('div', { class: 'dash-activity-details' }, getDetailsText(row.details)),
          ui.el('time', {
            class: 'dash-activity-time',
            dateTime: row.logged_at || '',
            title: row.logged_at ? String(row.logged_at) : '',
          }, timeAgo(row.logged_at))
        )
      )
    );
  });

  section.appendChild(ui.el('div', { class: 'card dash-panel' }, list));
  return section;
}

function buildFooter(ui) {
  return ui.el(
    'footer',
    { class: 'card dash-footer-card' },
    ui.el('p', { class: 'dash-footer-title' }, 'Project alignment'),
    ui.el(
      'div',
      { class: 'dash-footer-chips' },
      ui.el(
        'span',
        { class: 'dash-sdg-chip' },
        ui.el('span', { class: 'dash-sdg-number' }, 'SDG 9'),
        'Industry, Innovation and Infrastructure'
      ),
      ui.el(
        'span',
        { class: 'dash-sdg-chip' },
        ui.el('span', { class: 'dash-sdg-number' }, 'SDG 4'),
        'Quality Education'
      )
    )
  );
}

function buildHeader(ui) {
  return ui.el(
    'header',
    { class: 'dash-page-head' },
    ui.el('h1', {}, 'Dashboard'),
    ui.el(
      'p',
      { class: 'dash-page-subtitle' },
      'Fan-made Genshin Impact reference database — PostgreSQL on Neon'
    )
  );
}

function renderDashboard(ui, theme, summary, auditRows) {
  const page = ui.el(
    'div',
    { class: 'dash-page' },
    buildHeader(ui),
    buildStatCards(ui, summary.counts || {}),
    ui.el(
      'section',
      { class: 'dash-section' },
      ui.el(
        'div',
        { class: 'dash-section-head' },
        ui.el('h2', { class: 'dash-section-title' }, 'Database analytics'),
        ui.el('span', { class: 'dash-section-note' }, 'Live aggregates from PostgreSQL')
      ),
      buildCharts(ui, theme, summary)
    ),
    ui.el(
      'div',
      { class: 'dash-content-grid' },
      buildTopBuilds(ui, Array.isArray(summary.top_builds) ? summary.top_builds : []),
      buildActivity(ui, auditRows)
    ),
    buildFooter(ui)
  );

  return page;
}

export async function render(root, ctx) {
  destroy();

  activeRoot = root;
  injectStyles();

  const ui = ctx.ui;
  const theme = ctx.theme;

  // Show a loading skeleton until both independent API reads have completed.
  root.appendChild(ui.skeleton(8));

  try {
    const [summary, auditRows] = await Promise.all([
      ctx.api.get('/analytics/summary'),
      ctx.api.get('/audit-log'),
    ]);

    if (activeRoot !== root) return;

    root.replaceChildren();

    if (!summary || typeof summary !== 'object') {
      root.appendChild(ui.emptyState('Dashboard analytics are unavailable.'));
      return;
    }

    const normalizedSummary = {
      counts: summary.counts || {},
      by_element: Array.isArray(summary.by_element) ? summary.by_element : [],
      by_weapon_type: Array.isArray(summary.by_weapon_type) ? summary.by_weapon_type : [],
      combat_tiers: Array.isArray(summary.combat_tiers) ? summary.combat_tiers : [],
      top_builds: Array.isArray(summary.top_builds) ? summary.top_builds : [],
    };

    const normalizedAudit = Array.isArray(auditRows) ? auditRows.slice(0, 5) : [];

    root.appendChild(
      renderDashboard(ui, theme, normalizedSummary, normalizedAudit)
    );

    root.querySelectorAll('[data-count-target]').forEach((element) => {
      animateCount(element, element.getAttribute('data-count-target'));
    });
  } catch (err) {
    if (activeRoot !== root) return;

    root.replaceChildren(
      ui.emptyState('Could not load the dashboard. Check your database connection and try again.')
    );

    ui.toast(err?.message || 'Failed to load dashboard data.', 'error');
  }
}

export function destroy() {
  stopAnimations();
  destroyCharts();

  if (activeRoot && delegatedClickHandler) {
    activeRoot.removeEventListener('click', delegatedClickHandler);
  }

  activeRoot = null;
  delegatedClickHandler = null;
}