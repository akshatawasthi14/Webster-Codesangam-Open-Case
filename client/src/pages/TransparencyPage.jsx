import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  RotateCw,
  Info,
  TrendingUp,
  Activity,
  Calendar,
  Percent,
} from 'lucide-react';
import { getPublicStats } from '../api/stats.js';

export function TransparencyPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStats = async (isSilent = false) => {
    if (!isSilent) {
      if (!stats) setLoading(true);
      else setRefreshing(true);
    }
    setError('');
    try {
      const data = await getPublicStats();
      setStats(data);
      setLastRefreshed(new Date());
    } catch (err) {
      if (!isSilent && !stats) {
        setError(err.message || 'Failed to fetch transparency metrics.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // 5-second automatic update interval for real-time responsiveness
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchStats(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const summary = stats?.summary || null;
  const categories = Array.isArray(stats?.categories) ? stats.categories : [];
  const resolution = stats?.resolution || {};
  const avgHoursByCategory = Array.isArray(resolution.avgHoursByCategory) ? resolution.avgHoursByCategory : [];
  const overallAvgHours = resolution.overallAvgHours ?? null;
  const slaCompliance = stats?.slaCompliance || {};
  const trends = stats?.trends || { months: [], series: [] };

  const totalFiled = summary?.total ?? null;
  const underReview = summary?.open ?? null;
  const resolvedCount = summary?.resolved ?? null;
  const escalatedCount = summary?.escalated ?? null;

  // Exact percentage: How many petitions came and how many actually got resolved
  const resolutionRate = summary?.resolutionRate ?? null;

  const slaComplianceRate =
  slaCompliance.rate !== null && slaCompliance.rate !== undefined
    ? `${slaCompliance.rate}%`
    : 'Suppressed';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-marigold-100 text-marigold-900 text-xs font-bold uppercase tracking-wider mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-marigold-700" />
            <span>Public Accountability Report</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-aubergine-900 tracking-tight">
            Transparency & Performance Metrics
          </h1>
          <p className="text-sm text-silver-600 mt-1 max-w-2xl">
            Live institutional grievance statistics directly from the database: volume, active reviews, resolved petitions, and resolution percentage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Live Auto-Refresh Indicator */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors shadow-sm ${
              autoRefresh
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-silver-100 border-silver-300 text-silver-600'
            }`}
            title={autoRefresh ? 'Click to pause automatic polling' : 'Click to enable automatic polling'}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-silver-400'}`} />
            <span>{autoRefresh ? 'Live Auto-Update (5s)' : 'Live Paused'}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchStats(false)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-silver-300 bg-white hover:bg-silver-50 text-silver-800 text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin text-marigold-500' : 'text-silver-600'}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Now'}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      <div className="p-4 bg-aubergine-800 text-white rounded-2xl shadow-sm border border-aubergine-900 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-marigold-500/20 text-marigold-400 flex items-center justify-center flex-shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div className="text-xs space-y-0.5">
            <span className="font-bold text-silver-100 block">
              Live Database Verification
            </span>
            <p className="text-silver-300">
              Showing exact, unsuppressed counts of petitions filed, under review, and completed.
            </p>
          </div>
        </div>
        <div className="text-right text-xs font-mono text-marigold-300 whitespace-nowrap hidden sm:block">
          Last updated: {lastRefreshed.toLocaleTimeString()}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-silver-500">
          <RotateCw className="w-8 h-8 animate-spin mx-auto text-marigold-500 mb-3" />
          <p className="text-sm font-medium">Loading live complaint statistics...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h3 className="font-bold">Failed to load transparency data</h3>
          <p className="text-xs text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => fetchStats(false)}
            className="px-4 py-2 rounded-lg bg-aubergine-800 text-white font-bold text-xs hover:bg-aubergine-900"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="space-y-10 animate-in fade-in duration-200">
          {/* 4 Primary Exact Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. Petitions Filed */}
            <div className="bg-white p-6 rounded-2xl border border-silver-300 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-silver-500">
                Petitions Filed
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-4xl font-extrabold text-silver-900 font-mono">
                  {totalFiled === null ? 'Suppressed' : totalFiled}
                </span>
                <span className="text-xs font-semibold text-aubergine-800 bg-aubergine-50 px-2 py-0.5 rounded border border-aubergine-200">
                  Total
                </span>
              </div>
              <p className="text-[11px] text-silver-500">
                All petitions committed into the institutional audit chain
              </p>
            </div>

            {/* 2. Under Review */}
            <div className="bg-white p-6 rounded-2xl border border-silver-300 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-marigold-700">
                Under Review
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-4xl font-extrabold text-marigold-600 font-mono">
                  {underReview === null ? 'Suppressed' : underReview}
                </span>
                <span className="text-xs font-semibold text-marigold-800 bg-marigold-50 px-2 py-0.5 rounded border border-marigold-200">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-silver-500">
                Petitions currently assigned or in active inquiry
              </p>
            </div>

            {/* 3. Resolved */}
            <div className="bg-white p-6 rounded-2xl border border-silver-300 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Resolved
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-4xl font-extrabold text-emerald-600 font-mono">
                  {resolvedCount === null ? 'Suppressed' : resolvedCount}
                </span>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Concluded
                </span>
              </div>
              <p className="text-[11px] text-silver-500">
                Cases officially closed with formal redressal findings
              </p>
            </div>

            {/* 4. Resolution Percentage: How many came vs how many resolved */}
            <div className="bg-white p-6 rounded-2xl border-2 border-marigold-400/80 shadow-md space-y-2 bg-gradient-to-b from-white to-marigold-50/30">
              <span className="text-xs font-bold uppercase tracking-wider text-aubergine-900 flex items-center justify-between">
                <span>Resolution Success Rate</span>
                <Percent className="w-3.5 h-3.5 text-marigold-600" />
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-4xl font-extrabold text-aubergine-950 font-mono">
                  {resolutionRate}%
                </span>
                <span className="text-xs font-semibold text-aubergine-900 bg-marigold-200/80 px-2.5 py-0.5 rounded-full border border-marigold-400 font-mono">
                  {resolvedCount === null ? 'Suppressed' : resolvedCount} / {totalFiled === null ? 'Suppressed' : totalFiled}
                </span>
              </div>
              <p className="text-[11px] text-silver-600">
                Share of received petitions that have been successfully resolved
              </p>
            </div>
          </div>

          {/* Secondary Performance Indicator: SLA Compliance */}
          <div className="p-4 bg-white rounded-2xl border border-silver-300 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-aubergine-50 border border-aubergine-200 text-aubergine-800 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5 text-aubergine-700" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase text-silver-500 tracking-wider block">
                  Statutory SLA Adherence
                </span>
                <p className="text-sm text-silver-800 font-medium">
                  {slaCompliance.onTime == null ||
                  slaCompliance.casesConsidered == null
                    ? 'SLA counts suppressed'
                    : `${slaCompliance.onTime} of ${slaCompliance.casesConsidered} decided petitions resolved within their original SLA deadline.`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-extrabold font-mono text-aubergine-900">
                {slaComplianceRate}
              </span>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                On-Time Compliance
              </span>
            </div>
          </div>

          {/* Category Breakdown & Resolution Times Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Exact Category Distribution */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-silver-300 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-silver-200">
                <h3 className="font-bold text-base text-aubergine-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-marigold-500" />
                  <span>Petitions by Category</span>
                </h3>
                <span className="text-xs text-silver-500">Distribution</span>
              </div>

              <div className="space-y-4">
                {categories.length === 0 ? (
                  <div className="py-8 text-center text-xs text-silver-500">
                    No petitions logged in any category yet.
                  </div>
                ) : (
                  categories.map((c) => {
                    const count = Number(c.count || 0);
                    const percent = totalFiled > 0 ? Math.round((count / totalFiled) * 100) : 0;
                    return (
                      <div key={c.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-silver-900">{c.category}</span>
                          <span className="font-mono font-bold text-aubergine-900">
                            {count} {count === 1 ? 'case' : 'cases'} ({percent}%)
                          </span>
                        </div>

                        <div className="w-full h-2.5 bg-silver-100 rounded-full overflow-hidden border border-silver-200">
                          <div
                            className="h-full bg-gradient-to-r from-aubergine-800 to-marigold-500 rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Resolution Speed per Category */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-silver-300 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-silver-200">
                <h3 className="font-bold text-base text-aubergine-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-marigold-500" />
                  <span>Mean Resolution Speed</span>
                </h3>
                {overallAvgHours !== null && (
                  <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                    Overall Avg: {overallAvgHours} hrs
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {avgHoursByCategory.length === 0 ? (
                  <div className="py-8 text-center text-xs text-silver-500">
                    No resolution timing data yet.
                  </div>
                ) : (
                  avgHoursByCategory.map((r) => (
                    <div
                      key={r.category}
                      className="p-3.5 bg-silver-50 border border-silver-200 rounded-xl flex items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-0.5">
                        <span className="font-bold text-silver-900 block">{r.category}</span>
                        <span className="text-[10px] text-silver-500">
                          {r.resolvedCount == null
                            ? 'Insufficient data to publish'
                            : r.resolvedCount > 0
                              ? `Based on ${r.resolvedCount} resolved petitions`
                              : 'No resolved cases yet'}
                        </span>
                      </div>

                      <div className="text-right">
                        {r.avgHours != null ? (
                          <div className="flex items-baseline gap-1">
                            <span className="text-base font-extrabold text-aubergine-900 font-mono">
                              {r.avgHours}
                            </span>
                            <span className="text-[10px] text-silver-600 font-semibold">
                              hours
                            </span>
                          </div>
                        ) : (
                          <span className="text-silver-400 font-mono text-[11px]">—</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Monthly Trend Series */}
          {trends.months && trends.months.length > 0 && (
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-silver-300 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-silver-200">
                <div>
                  <h3 className="font-bold text-base text-aubergine-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-marigold-500" />
                    <span>6-Month Historical Filing Trend</span>
                  </h3>
                  <p className="text-xs text-silver-500 mt-0.5">
                    Monthly case volume by category.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-silver-600 font-medium">
                  <Calendar className="w-4 h-4 text-silver-400" />
                  <span>UTC Monthly Aggregates</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-silver-200 bg-silver-50 text-silver-700">
                      <th className="py-2.5 px-3 font-bold">Category</th>
                      {trends.months.map((m) => (
                        <th key={m} className="py-2.5 px-3 font-mono font-semibold">
                          {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-silver-200">
                    {trends.series && trends.series.length > 0 ? (
                      trends.series.map((item) => (
                        <tr key={item.category} className="hover:bg-silver-50/60">
                          <td className="py-3 px-3 font-bold text-silver-900">
                            {item.category}
                          </td>
                          {trends.months.map((m, mIdx) => {
                            const val = item.counts && Array.isArray(item.counts) ? item.counts[mIdx] : null;
                            return (
                              <td key={m} className="py-3 px-3 font-mono text-silver-700">
                                {val == null ? (
                                  <span className="text-silver-400 text-[11px]">
                                    Suppressed
                                  </span>
                                ) : (
                                  <span className="font-bold text-aubergine-900">{val}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={trends.months.length + 1} className="py-6 text-center text-silver-500">
                          No multi-month historical trends logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
