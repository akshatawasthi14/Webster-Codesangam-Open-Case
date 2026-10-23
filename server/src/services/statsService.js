import { CATEGORIES } from '../config/constants.js';
import { config } from '../config/index.js';
import { pool } from '../db/pool.js';

/**
 * Public transparency dashboard. Aggregates are computed in SQL.
 * When STATS_MIN_COUNT is 0 (or 1), exact raw numbers are returned without suppression.
 * When STATS_MIN_COUNT is >= 5, cells with fewer than STATS_MIN_COUNT cases are suppressed.
 * The result is cached briefly in memory so a surge of visitors does not become a surge of queries.
 */

let cache = { at: 0, value: null };
let inflight = null;

const hide = (n, k) => (n >= k ? n : null);

/**
 * Primary suppression hides any cell below k. Complementary suppression stops "total minus visible cells"
 * from revealing a hidden one.
 */
function suppressCells(cells, k) {
  const out = {};
  const visible = [];
  let hiddenSum = 0;
  for (const [key, n] of Object.entries(cells)) {
    if (n >= k) visible.push([key, n]);
    else {
      out[key] = null;
      hiddenSum += n;
    }
  }
  visible.sort((a, b) => a[1] - b[1]);
  while (hiddenSum > 0 && hiddenSum < k && visible.length) {
    const [key, n] = visible.shift();
    out[key] = null;
    hiddenSum += n;
  }
  for (const [key, n] of visible) out[key] = n;
  return out;
}

const round1 = (x) => (x === null || x === undefined ? null : Math.round(Number(x) * 10) / 10);

async function compute() {
  const k = config.stats.minCount;

  const [summary, byCategory, resolution, sla, trends] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total,
                       COUNT(*) FILTER (WHERE status IN ('FILED','ASSIGNED','IN_REVIEW')) AS open,
                       COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved,
                       COUNT(*) FILTER (WHERE status = 'ESCALATED') AS escalated
                FROM tickets`),
    pool.query('SELECT category, COUNT(*) AS n FROM tickets GROUP BY category'),
    pool.query(`SELECT category, COUNT(*) AS n,
                       AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) AS avg_hours
                FROM tickets WHERE resolved_at IS NOT NULL GROUP BY category`),
    pool.query(`SELECT COUNT(*) AS decided,
                       COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at <= original_due_at) AS on_time
                FROM tickets WHERE resolved_at IS NOT NULL OR original_due_at < NOW()`),
    pool.query(`SELECT category, to_char(date_trunc('month', created_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS month,
                       COUNT(*) AS n
                FROM tickets
                WHERE created_at >= (date_trunc('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '5 months') AT TIME ZONE 'UTC'
                GROUP BY 1, 2`),
  ]);

  const catCounts = new Map(byCategory.rows.map((r) => [r.category, Number(r.n)]));
  let categories;
  let visible;
  if (k <= 1) {
    visible = new Set(CATEGORIES);
    categories = CATEGORIES.map((c) => ({
      category: c,
      count: catCounts.get(c) ?? 0,
      suppressed: false,
    }));
  } else {
    const counts = CATEGORIES.map((c) => ({ category: c, n: catCounts.get(c) ?? 0 }));
    const shown = counts.filter((c) => c.n >= k).sort((a, b) => a.n - b.n);
    let pooled = counts.filter((c) => c.n < k).reduce((sum, c) => sum + c.n, 0);
    while (pooled > 0 && pooled < k && shown.length) pooled += shown.shift().n;
    visible = new Set(shown.map((c) => c.category));
    categories = CATEGORIES.filter((c) => visible.has(c)).map((c) => ({ category: c, count: catCounts.get(c) }));
    if (pooled > 0) {
      categories.push({ category: 'OTHER', count: hide(pooled, k), suppressed: pooled < k });
    }
  }

  // Resolution time per visible category.
  const resByCat = new Map(resolution.rows.map((r) => [r.category, r]));
  const avgHoursByCategory = [...visible].map((c) => {
    const r = resByCat.get(c);
    const n = Number(r?.n || 0);
    const enough = k <= 1 ? true : n >= k;
    return {
      category: c,
      resolvedCount: enough ? n : null,
      avgHours: enough && n > 0 ? round1(r.avg_hours) : null,
      suppressed: !enough,
    };
  });
  const totalResolved = resolution.rows.reduce((s, r) => s + Number(r.n), 0);
  const weighted = resolution.rows.reduce((s, r) => s + Number(r.avg_hours) * Number(r.n), 0);

  // Monthly trend series for visible categories.
  const months = [];
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - 5);
  for (let i = 0; i < 6; i++) {
    months.push(`${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`);
    start.setUTCMonth(start.getUTCMonth() + 1);
  }
  const cell = new Map(trends.rows.map((r) => [`${r.category}|${r.month}`, Number(r.n)]));
  const series = [...visible].map((c) => ({
    category: c,
    counts: months.map((m) => (k <= 1 ? (cell.get(`${c}|${m}`) ?? 0) : hide(cell.get(`${c}|${m}`) ?? 0, k))),
  }));

  const s = summary.rows[0];
  const total = Number(s?.total || 0);
  const open = Number(s?.open || 0);
  const resolved = Number(s?.resolved || 0);
  const escalated = Number(s?.escalated || 0);

  const status =
    k <= 1
      ? { open, resolved, escalated }
      : suppressCells({ open, resolved, escalated }, k);

  const totalVisible = k <= 1 || total >= k;
  const resolvedVisible = k <= 1 || resolved >= k;

  const resolutionRate =
    totalVisible && resolvedVisible && total > 0
      ? Math.round((resolved / total) * 1000) / 10
      : null;


  const decided = Number(sla.rows[0]?.decided || 0);
  const onTime = Number(sla.rows[0]?.on_time || 0);

  const slaVisible =
    k <= 1 || (decided >= k && onTime >= k);

  const complianceRate =
    decided > 0
    ? Math.round((onTime / decided) * 1000) / 10
    : null;
  return {
    generatedAt: new Date().toISOString(),
    minCount: k,
    summary: {
      total: k <= 1 ? total : hide(total, k),
      open: status.open,
      resolved: status.resolved,
      escalated: status.escalated,
      resolutionRate,
    },
    resolution: {
      overallAvgHours: (k <= 1 || totalResolved >= k) && totalResolved > 0
    ? round1(weighted / totalResolved)
    : null,
      avgHoursByCategory,
    },
    slaCompliance: {
      rate: slaVisible ? complianceRate : null,
      casesConsidered: k <= 1 ? decided : hide(decided, k),
      onTime: k <= 1 ? onTime : hide(onTime, k),
      definition:
        'Share of resolved or overdue cases that were resolved within their original SLA deadline',
    },
    categories,
    trends: { months, series },
  };
}

export async function getPublicStats() {
  const ttl = config.stats.cacheTtlMs;
  if (cache.value && Date.now() - cache.at < ttl) return cache.value;
  inflight ??= compute()
    .then((value) => {
      cache = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function clearStatsCache() {
  cache = { at: 0, value: null };
}
