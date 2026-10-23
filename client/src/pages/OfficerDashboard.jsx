import React, { useState, useEffect } from 'react';
import {
  Inbox,
  UserCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  Search,
  RefreshCw,
  AlertTriangle,
  Briefcase,
} from 'lucide-react';
import { listTickets, transitionTicket } from '../api/tickets.js';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { PriorityBadge } from '../components/PriorityBadge.jsx';
import { SlaCountdown } from '../components/SlaCountdown.jsx';
import { formatDate, shortId } from '../utils/formatters.js';

export function OfficerDashboard({ onNavigate }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('unassigned'); // 'unassigned' | 'my-workload' | 'resolved'
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [slaUrgencyFilter, setSlaUrgencyFilter] = useState('all'); // 'all' | 'imminent' | 'breached'
  const [claimingId, setClaimingId] = useState(null);

  const fetchOfficerTickets = async () => {
    setLoading(true);
    setError('');
    try {
      let statusQuery = undefined;
      if (activeTab === 'unassigned') {
        statusQuery = 'FILED';
      } else if (activeTab === 'resolved') {
        statusQuery = 'RESOLVED';
      }

      const data = await listTickets({
        status: statusQuery,
        priority: priorityFilter || undefined,
        limit: 50,
      });

      let items = data.items || [];

      // For my workload, filter for tickets assigned to me that are not resolved
      if (activeTab === 'my-workload') {
        items = items.filter(
          (t) => t.assignee?.id === user?.id && t.status !== 'RESOLVED'
        );
      }

      setTickets(items);
    } catch (err) {
      setError(err.message || 'Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficerTickets();
  }, [activeTab, priorityFilter]);

  // Fast action: claim case
  const handleClaim = async (ticket) => {
    setClaimingId(ticket.id);
    try {
      await transitionTicket(ticket.id, {
        to: 'ASSIGNED',
        version: ticket.version,
        assigneeId: user.id,
      });
      await fetchOfficerTickets();
    } catch (err) {
      alert(`Claim failed: ${err.message}`);
    } finally {
      setClaimingId(null);
    }
  };

  // Fast action: start review
  const handleStartReview = async (ticket) => {
    setClaimingId(ticket.id);
    try {
      await transitionTicket(ticket.id, {
        to: 'IN_REVIEW',
        version: ticket.version,
      });
      await fetchOfficerTickets();
    } catch (err) {
      alert(`Start review failed: ${err.message}`);
    } finally {
      setClaimingId(null);
    }
  };

  const now = Date.now();
  const imminentCount = tickets.filter(
    (t) =>
      t.status !== 'RESOLVED' &&
      t.dueAt &&
      new Date(t.dueAt).getTime() > now &&
      new Date(t.dueAt).getTime() - now <= 6 * 3600 * 1000
  ).length;

  const breachedCount = tickets.filter(
    (t) => t.status !== 'RESOLVED' && t.dueAt && new Date(t.dueAt).getTime() <= now
  ).length;

  const displayedTickets = tickets.filter((t) => {
    if (slaUrgencyFilter === 'imminent') {
      if (t.status === 'RESOLVED' || !t.dueAt) return false;
      const diff = new Date(t.dueAt).getTime() - now;
      return diff > 0 && diff <= 6 * 3600 * 1000;
    }
    if (slaUrgencyFilter === 'breached') {
      if (t.status === 'RESOLVED' || !t.dueAt) return false;
      return new Date(t.dueAt).getTime() <= now;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Officer Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-aubergine-800 bg-aubergine-50 px-2.5 py-0.5 rounded-full border border-aubergine-200">
              Grievance Officer Console
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-aubergine-900 tracking-tight">
            Officer Case Queue
          </h1>
          <p className="text-sm text-silver-600 mt-1">
            Review petitions, conduct investigations, and deliver timely redressal within statutory deadlines.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchOfficerTickets}
          className="p-2.5 rounded-xl border border-silver-300 bg-white hover:bg-silver-50 text-silver-700 transition-colors shadow-sm self-start sm:self-auto"
          title="Refresh Queue"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-silver-300 p-2 shadow-sm flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('unassigned')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'unassigned'
              ? 'bg-aubergine-800 text-white shadow-sm'
              : 'text-silver-700 hover:bg-silver-100'
          }`}
        >
          <Inbox className="w-4 h-4 text-marigold-400" />
          <span>Unassigned Pool (FILED)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my-workload')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'my-workload'
              ? 'bg-aubergine-800 text-white shadow-sm'
              : 'text-silver-700 hover:bg-silver-100'
          }`}
        >
          <Briefcase className="w-4 h-4 text-marigold-400" />
          <span>My Active Cases</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('resolved')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'resolved'
              ? 'bg-aubergine-800 text-white shadow-sm'
              : 'text-silver-700 hover:bg-silver-100'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>Completed / Resolved</span>
        </button>

        <div className="ml-auto flex items-center pr-2">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs bg-silver-50 border border-silver-200 rounded-lg px-2.5 py-1.5 text-silver-800 font-medium"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical Priority</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>
        </div>
      </div>

      {/* SLA Urgency Triage Filters */}
      {activeTab !== 'resolved' && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-silver-700 uppercase tracking-wider text-[11px] mr-1">
            SLA Urgency:
          </span>
          <button
            type="button"
            onClick={() => setSlaUrgencyFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              slaUrgencyFilter === 'all'
                ? 'bg-aubergine-800 text-white'
                : 'bg-white border border-silver-300 text-silver-700 hover:bg-silver-50'
            }`}
          >
            All Cases ({tickets.length})
          </button>
          <button
            type="button"
            onClick={() => setSlaUrgencyFilter('imminent')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
              slaUrgencyFilter === 'imminent'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-marigold-500" />
            <span>Imminent (&lt; 6h)</span>
            {imminentCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  slaUrgencyFilter === 'imminent'
                    ? 'bg-amber-800 text-white'
                    : 'bg-amber-200 text-amber-900'
                }`}
              >
                {imminentCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSlaUrgencyFilter('breached')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
              slaUrgencyFilter === 'breached'
                ? 'bg-rose-700 text-white'
                : 'bg-rose-50 border border-rose-200 text-rose-900 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Overdue / Breached</span>
            {breachedCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  slaUrgencyFilter === 'breached'
                    ? 'bg-rose-900 text-white'
                    : 'bg-rose-200 text-rose-900'
                }`}
              >
                {breachedCount}
              </span>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tickets List */}
      <div className="bg-white rounded-2xl border border-silver-300 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-silver-500 text-sm flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-marigold-500" />
            <span>Loading cases...</span>
          </div>
        ) : displayedTickets.length === 0 ? (
          <div className="py-16 text-center text-silver-500 space-y-2">
            <Inbox className="w-12 h-12 text-silver-400 mx-auto" />
            <h3 className="font-bold text-silver-800 text-base">No Cases in this Queue</h3>
            <p className="text-xs text-silver-500">
              {activeTab === 'unassigned'
                ? 'All grievances currently have assigned officers.'
                : 'No grievances match this view.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-silver-200">
            {displayedTickets.map((t) => (
              <div
                key={t.id}
                className="p-5 sm:p-6 hover:bg-silver-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div
                  onClick={() => onNavigate(`/tickets/${t.id}`)}
                  className="space-y-2 flex-1 min-w-0 cursor-pointer"
                >
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
                    {t.isAnonymous && (
                      <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300">
                        ANONYMOUS
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-silver-900 hover:text-aubergine-900 transition-colors">
                    {t.title}
                  </h3>

                  <div className="flex items-center gap-4 text-xs text-silver-500 flex-wrap">
                    <span>Filed: {formatDate(t.createdAt)}</span>
                    {t.petitioner ? (
                      <span className="text-silver-700 font-medium">
                        Petitioner: {t.petitioner.name}
                      </span>
                    ) : (
                      <span className="italic text-silver-500">Anonymous Petitioner</span>
                    )}
                    {t.assignee && (
                      <span className="text-aubergine-800 font-semibold">
                        Assigned: {t.assignee.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 flex-shrink-0">
                  <SlaCountdown
                    dueAt={t.dueAt}
                    resolvedAt={t.resolvedAt}
                    status={t.status}
                  />

                  <div className="flex items-center gap-2">
                    {t.status === 'FILED' && (
                      <button
                        type="button"
                        disabled={claimingId === t.id}
                        onClick={() => handleClaim(t)}
                        className="px-3 py-1.5 bg-marigold-500 hover:bg-marigold-600 text-aubergine-950 font-bold text-xs rounded-lg transition-colors shadow-sm disabled:opacity-50"
                      >
                        {claimingId === t.id ? 'Claiming...' : 'Take Case'}
                      </button>
                    )}

                    {t.status === 'ASSIGNED' && t.assignee?.id === user?.id && (
                      <button
                        type="button"
                        disabled={claimingId === t.id}
                        onClick={() => handleStartReview(t)}
                        className="px-3 py-1.5 bg-marigold-500 hover:bg-marigold-600 text-aubergine-950 font-bold text-xs rounded-lg transition-colors shadow-sm disabled:opacity-50"
                      >
                        {claimingId === t.id ? 'Updating...' : 'Start Review'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onNavigate(`/tickets/${t.id}`)}
                      className="px-3 py-1.5 bg-aubergine-800 hover:bg-aubergine-900 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
                    >
                      <span>Examine</span>
                      <ArrowRight className="w-3 h-3 text-marigold-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

