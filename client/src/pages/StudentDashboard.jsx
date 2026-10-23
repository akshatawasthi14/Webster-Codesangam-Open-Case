import React, { useState, useEffect } from 'react';
import {
  FilePlus2,
  Filter,
  Search,
  Clock,
  ArrowRight,
  Shield,
  AlertCircle,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import { listTickets } from '../api/tickets.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { PriorityBadge } from '../components/PriorityBadge.jsx';
import { SlaCountdown } from '../components/SlaCountdown.jsx';
import { CATEGORIES, STATUS } from '../utils/constants.js';
import { formatDate, shortId } from '../utils/formatters.js';

export function StudentDashboard({ onNavigate }) {
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Pagination
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchStudentTickets = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listTickets({
        status: selectedStatus || undefined,
        category: selectedCategory || undefined,
        page,
        limit: pageSize,
      });
      setTickets(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load grievances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [selectedStatus, selectedCategory]);

  useEffect(() => {
    fetchStudentTickets();
  }, [selectedStatus, selectedCategory, page]);

  const filteredTickets = tickets.filter((t) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.title.toLowerCase().includes(term) ||
      t.id.toLowerCase().includes(term) ||
      t.category.toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-aubergine-900 tracking-tight">
            My Grievances
          </h1>
          <p className="text-sm text-silver-600 mt-1">
            Track and monitor the status of your submitted petitions and responses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchStudentTickets}
            className="p-2.5 rounded-xl border border-silver-300 bg-white hover:bg-silver-50 text-silver-700 transition-colors shadow-sm"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/file')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-aubergine-800 hover:bg-aubergine-900 active:bg-aubergine-950 text-white font-bold text-sm shadow-md transition-all"
          >
            <FilePlus2 className="w-4 h-4 text-marigold-400" />
            <span>File New Grievance</span>
          </button>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="bg-white rounded-2xl border border-silver-300 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-silver-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search my cases by title or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-silver-50 border border-silver-200 rounded-lg focus:border-marigold-500 focus:bg-white focus:ring-1 focus:ring-marigold-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs bg-silver-50 border border-silver-200 rounded-lg text-silver-800 font-medium"
          >
            <option value="">All Statuses</option>
            {Object.values(STATUS).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs bg-silver-50 border border-silver-200 rounded-lg text-silver-800 font-medium"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grievances list */}
      <div className="bg-white rounded-2xl border border-silver-300 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-silver-500 text-sm flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-marigold-500" />
            <span>Loading grievances...</span>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="py-16 text-center text-silver-500 space-y-3">
            <Inbox className="w-12 h-12 text-silver-400 mx-auto" />
            <h3 className="font-bold text-silver-800 text-base">No Grievances Found</h3>
            <p className="text-xs text-silver-500 max-w-sm mx-auto">
              {searchTerm || selectedStatus || selectedCategory
                ? 'No grievances matched your active search or filters.'
                : 'You have not submitted any named grievances yet.'}
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/file')}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-marigold-500 hover:bg-marigold-600 text-aubergine-950 font-bold text-xs rounded-lg transition-colors"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>Submit a Grievance Now</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-silver-200">
            {filteredTickets.map((t) => (
              <div
                key={t.id}
                onClick={() => onNavigate(`/tickets/${t.id}`)}
                className="p-5 sm:p-6 hover:bg-silver-50/80 cursor-pointer transition-colors group flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-silver-700 bg-silver-100 px-2.5 py-0.5 rounded border border-silver-300" title={`Full Complaint ID: ${t.id}`}>
                      <span className="font-sans font-bold text-[10px] text-silver-500 mr-1 uppercase">Complaint ID:</span>
                      #{shortId(t.id)}
                    </span>
                    <StatusBadge status={t.status} size="xs" />
                    <PriorityBadge priority={t.priority} size="xs" />
                    <span className="text-[11px] font-medium text-aubergine-800 bg-aubergine-50 px-2 py-0.5 rounded">
                      {t.category}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-silver-900 group-hover:text-aubergine-900 transition-colors truncate">
                    {t.title}
                  </h3>

                  <div className="flex items-center gap-4 text-xs text-silver-500 flex-wrap">
                    <span>Filed: {formatDate(t.createdAt)}</span>
                    {t.assignee && (
                      <span className="text-silver-700 font-medium">
                        Officer: {t.assignee.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 flex-shrink-0">
                  <SlaCountdown
                    dueAt={t.dueAt}
                    resolvedAt={t.resolvedAt}
                    status={t.status}
                  />
                  <div className="flex items-center gap-1 text-xs text-aubergine-800 font-bold group-hover:translate-x-1 transition-transform">
                    <span>View Case</span>
                    <ArrowRight className="w-3.5 h-3.5 text-marigold-500" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Bar */}
        {total > pageSize && (
          <div className="p-4 bg-silver-50 border-t border-silver-200 flex items-center justify-between text-xs">
            <span className="text-silver-600">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} grievances
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-silver-300 bg-white hover:bg-silver-100 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <span className="font-mono font-bold text-silver-800">
                Page {page} of {Math.ceil(total / pageSize)}
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(total / pageSize)}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-silver-300 bg-white hover:bg-silver-100 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

