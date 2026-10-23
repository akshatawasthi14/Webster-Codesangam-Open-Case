import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  Settings,
  Layers,
  Clock,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Search,
  Lock,
} from 'lucide-react';
import { listTickets, transitionTicket } from '../api/tickets.js';
import { getOfficers, createStaff, getSlaRules, updateSlaRule } from '../api/admin.js';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { PriorityBadge } from '../components/PriorityBadge.jsx';
import { SlaCountdown } from '../components/SlaCountdown.jsx';
import { TransitionModal } from '../components/TransitionModal.jsx';
import { formatDate, shortId } from '../utils/formatters.js';

export function AdminDashboard({ onNavigate }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('cases'); // 'cases' | 'staff' | 'sla'

  // Cases state
  const [tickets, setTickets] = useState([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [slaUrgencyFilter, setSlaUrgencyFilter] = useState('all'); // 'all' | 'imminent' | 'breached'
  const [error, setError] = useState('');

  // Staff management state
  const [officers, setOfficers] = useState([]);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState('GRIEVANCE_OFFICER');
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [staffMessage, setStaffMessage] = useState({ type: '', text: '' });

  // SLA rules state
  const [slaRules, setSlaRules] = useState([]);
  const [editingSla, setEditingSla] = useState({});
  const [savingSla, setSavingSla] = useState(null);

  // Transition modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchCases = async () => {
    setCasesLoading(true);
    setError('');
    try {
      const data = await listTickets({
        status: statusFilter || undefined,
        limit: 50,
      });
      setTickets(data.items || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch tickets');
    } finally {
      setCasesLoading(false);
    }
  };

  const fetchStaffData = async () => {
    try {
      const list = await getOfficers();
      setOfficers(list || []);
    } catch (err) {
      console.warn('Failed to fetch officers:', err);
    }
  };

  const fetchSlaData = async () => {
    try {
      const rules = await getSlaRules();
      setSlaRules(rules || []);
      const map = {};
      (rules || []).forEach((r) => {
        map[r.priority] = r.slaHours ?? r.sla_hours;
      });
      setEditingSla(map);
    } catch (err) {
      console.warn('Failed to fetch SLA rules:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'cases') fetchCases();
    if (activeTab === 'staff') fetchStaffData();
    if (activeTab === 'sla') fetchSlaData();
  }, [activeTab, statusFilter]);

  // Handle staff user creation
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setStaffMessage({ type: '', text: '' });
    if (staffPassword.length < 10) {
      setStaffMessage({ type: 'error', text: 'Password must be at least 10 characters long.' });
      return;
    }
    setStaffSubmitting(true);
    try {
      await createStaff({
        name: staffName.trim(),
        email: staffEmail.trim(),
        password: staffPassword,
        role: staffRole,
      });
      setStaffMessage({ type: 'success', text: `Staff account created successfully for ${staffEmail}.` });
      setStaffName('');
      setStaffEmail('');
      setStaffPassword('');
      await fetchStaffData();
    } catch (err) {
      setStaffMessage({ type: 'error', text: err.message || 'Staff creation failed.' });
    } finally {
      setStaffSubmitting(false);
    }
  };

  // Handle SLA update
  const handleUpdateSla = async (priority) => {
    const hours = editingSla[priority];
    if (!hours || Number(hours) <= 0) {
      alert('SLA hours must be a positive integer.');
      return;
    }
    setSavingSla(priority);
    try {
      await updateSlaRule(priority, hours);
      await fetchSlaData();
      alert(`SLA deadline for ${priority} updated to ${hours} hours.`);
    } catch (err) {
      alert(`Failed to update SLA: ${err.message}`);
    } finally {
      setSavingSla(null);
    }
  };

  const openTransitionModal = async (ticket, target) => {
    setSelectedTicket(ticket);
    setModalTarget(target);
    if (target === 'ASSIGNED') {
      await fetchStaffData();
    }
    setModalOpen(true);
  };

  const handleModalSubmit = async (payload) => {
    setModalLoading(true);
    try {
      await transitionTicket(selectedTicket.id, payload);
      setModalOpen(false);
      await fetchCases();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setModalLoading(false);
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
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
              Administrative Control
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-aubergine-900 tracking-tight">
            Administrator Console
          </h1>
          <p className="text-sm text-silver-600 mt-1">
            Institutional governance: oversee escalated disputes, allocate personnel, and calibrate SLA policy.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (activeTab === 'cases') fetchCases();
            if (activeTab === 'staff') fetchStaffData();
            if (activeTab === 'sla') fetchSlaData();
          }}
          className="p-2.5 rounded-xl border border-silver-300 bg-white hover:bg-silver-50 text-silver-700 transition-colors shadow-sm self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-silver-300 p-2 shadow-sm flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('cases')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'cases'
              ? 'bg-aubergine-800 text-white shadow-sm'
              : 'text-silver-700 hover:bg-silver-100'
          }`}
        >
          <Layers className="w-4 h-4 text-marigold-400" />
          <span>Case Oversight & Escalations</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'staff'
              ? 'bg-aubergine-800 text-white shadow-sm'
              : 'text-silver-700 hover:bg-silver-100'
          }`}
        >
          <Users className="w-4 h-4 text-marigold-400" />
          <span>Staff Accounts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sla')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'sla'
              ? 'bg-aubergine-800 text-white shadow-sm'
              : 'text-silver-700 hover:bg-silver-100'
          }`}
        >
          <Settings className="w-4 h-4 text-marigold-400" />
          <span>SLA Rules Configuration</span>
        </button>
      </div>

      {/* TAB 1: Case Oversight */}
      {activeTab === 'cases' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-silver-300 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="text-xs font-bold text-silver-800">
                Filter by Status:
              </span>
              <div className="flex flex-wrap gap-2">
                {['', 'ESCALATED', 'FILED', 'ASSIGNED', 'IN_REVIEW', 'RESOLVED'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      statusFilter === s
                        ? 'bg-aubergine-800 text-white border-aubergine-900'
                        : 'bg-silver-50 text-silver-700 border-silver-200 hover:bg-silver-100'
                    }`}
                  >
                    {s || 'All Cases'}
                  </button>
                ))}
              </div>
            </div>

            {/* SLA Urgency Filter Chips */}
            <div className="pt-2 border-t border-silver-200 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-silver-700 uppercase tracking-wider text-[11px] mr-1">
                SLA Urgency:
              </span>
              <button
                type="button"
                onClick={() => setSlaUrgencyFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  slaUrgencyFilter === 'all'
                    ? 'bg-aubergine-800 text-white'
                    : 'bg-silver-50 border border-silver-200 text-silver-700 hover:bg-silver-100'
                }`}
              >
                All ({tickets.length})
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
          </div>

          <div className="bg-white rounded-2xl border border-silver-300 overflow-hidden shadow-sm">
            {casesLoading ? (
              <div className="py-16 text-center text-silver-500 text-sm flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-marigold-500" />
                <span>Loading cases...</span>
              </div>
            ) : displayedTickets.length === 0 ? (
              <div className="py-16 text-center text-silver-500 text-sm">
                No cases found for the selected filter.
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
                        {t.assignee ? (
                          <span className="text-silver-700 font-medium">
                            Assigned: {t.assignee.name}
                          </span>
                        ) : (
                          <span className="text-amber-700 font-semibold">Unassigned</span>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 flex-shrink-0">
                      <SlaCountdown
                        dueAt={t.dueAt}
                        resolvedAt={t.resolvedAt}
                        status={t.status}
                      />

                      <div className="flex items-center gap-2">
                        {t.status === 'ESCALATED' && (
                          <button
                            type="button"
                            onClick={() => openTransitionModal(t, 'IN_REVIEW')}
                            className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-lg transition-colors shadow-sm"
                          >
                            Take Responsibility
                          </button>
                        )}

                        {t.status === 'FILED' && (
                          <button
                            type="button"
                            onClick={() => openTransitionModal(t, 'ASSIGNED')}
                            className="px-3 py-1.5 bg-marigold-500 hover:bg-marigold-600 text-aubergine-950 font-bold text-xs rounded-lg transition-colors shadow-sm"
                          >
                            Assign Officer
                          </button>
                        )}

                        {['FILED', 'ASSIGNED', 'IN_REVIEW'].includes(t.status) && (
                          <button
                            type="button"
                            onClick={() => openTransitionModal(t, 'ESCALATED')}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs rounded-lg transition-colors shadow-sm"
                          >
                            Escalate
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onNavigate(`/tickets/${t.id}`)}
                          className="px-3 py-1.5 bg-aubergine-800 hover:bg-aubergine-900 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
                        >
                          <span>Manage</span>
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
      )}

      {/* TAB 2: Staff Accounts */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Create Staff Form */}
          <div className="bg-white rounded-2xl border border-silver-300 p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-aubergine-800 mb-1">
                <PlusCircle className="w-4 h-4 text-marigold-500" />
                <span>Personnel Provisioning</span>
              </div>
              <h2 className="text-xl font-bold text-aubergine-900">
                Create Institutional Staff Account
              </h2>
              <p className="text-xs text-silver-600 mt-1">
                Designate new Grievance Officers or Administrators. Email must match authorized college domains.
              </p>
            </div>

            {staffMessage.text && (
              <div
                className={`p-3.5 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                  staffMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}
              >
                {staffMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                )}
                <span>{staffMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-silver-800 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="e.g. Prof. Rajesh Sharma"
                  className="w-full px-3.5 py-2.5 text-xs bg-silver-50 border border-silver-300 rounded-xl focus:border-marigold-500 focus:bg-white text-silver-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-silver-800 uppercase tracking-wider">
                  College Email Address
                </label>
                <input
                  type="email"
                  required
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="e.g. staff@college.edu"
                  className="w-full px-3.5 py-2.5 text-xs bg-silver-50 border border-silver-300 rounded-xl focus:border-marigold-500 focus:bg-white text-silver-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-silver-800 uppercase tracking-wider">
                  Temporary Password (min 10 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={10}
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 text-xs bg-silver-50 border border-silver-300 rounded-xl focus:border-marigold-500 focus:bg-white text-silver-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-silver-800 uppercase tracking-wider">
                  Role Assignment
                </label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-silver-50 border border-silver-300 rounded-xl focus:border-marigold-500 focus:bg-white text-silver-900 font-medium"
                >
                  <option value="GRIEVANCE_OFFICER">Grievance Officer</option>
                  <option value="ADMINISTRATOR">Administrator</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={staffSubmitting}
                className="w-full py-2.5 bg-aubergine-800 hover:bg-aubergine-900 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {staffSubmitting ? 'Creating Staff Account...' : 'Provision Staff Account'}
              </button>
            </form>
          </div>

          {/* Existing Officers Directory */}
          <div className="bg-white rounded-2xl border border-silver-300 p-6 sm:p-8 shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-aubergine-900">
              Active Grievance Officers ({officers.length})
            </h2>
            <p className="text-xs text-silver-600">
              Personnel available for assignment to student grievances.
            </p>

            <div className="divide-y divide-silver-200 max-h-96 overflow-y-auto">
              {officers.length === 0 ? (
                <div className="py-8 text-center text-xs text-silver-500">
                  No officers loaded.
                </div>
              ) : (
                officers.map((off) => (
                  <div key={off.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-silver-900">{off.name}</p>
                      <p className="text-[11px] text-silver-500 font-mono">ID: {shortId(off.id)}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-semibold">
                      Officer
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SLA Configuration */}
      {activeTab === 'sla' && (
        <div className="bg-white rounded-2xl border border-silver-300 p-6 sm:p-8 shadow-sm space-y-6 max-w-3xl">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-aubergine-800 mb-1">
              <Clock className="w-4 h-4 text-marigold-500" />
              <span>Response Window Calibration</span>
            </div>
            <h2 className="text-2xl font-bold text-aubergine-900">
              SLA Escalation Rules
            </h2>
            <p className="text-xs text-silver-600 mt-1">
              Configure maximum resolution window (in hours) per priority tier. The background cron job triggers automated escalation upon SLA deadline breach.
            </p>
          </div>

          <div className="divide-y divide-silver-200">
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((priority) => (
              <div key={priority} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={priority} size="xs" />
                    <span className="font-bold text-sm text-silver-900">{priority} Priority</span>
                  </div>
                  <p className="text-xs text-silver-500">
                    {priority === 'CRITICAL' && 'Immediate safety, harassment, or high-risk institutional crises.'}
                    {priority === 'HIGH' && 'Urgent academic deadlines or pressing welfare issues.'}
                    {priority === 'MEDIUM' && 'Standard institutional complaints and residential requests.'}
                    {priority === 'LOW' && 'General suggestions or non-urgent queries.'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={editingSla[priority] || ''}
                      onChange={(e) =>
                        setEditingSla({ ...editingSla, [priority]: e.target.value })
                      }
                      className="w-20 px-2.5 py-1.5 text-xs text-center font-mono font-bold bg-silver-50 border border-silver-300 rounded-lg focus:border-marigold-500"
                    />
                    <span className="text-xs text-silver-600 font-medium">hours</span>
                  </div>

                  <button
                    type="button"
                    disabled={savingSla === priority}
                    onClick={() => handleUpdateSla(priority)}
                    className="px-3.5 py-1.5 bg-aubergine-800 hover:bg-aubergine-900 text-white font-bold text-xs rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  >
                    {savingSla === priority ? 'Saving...' : 'Update SLA'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transition Modal */}
      {modalOpen && selectedTicket && (
        <TransitionModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          targetStatus={modalTarget}
          ticket={selectedTicket}
          officers={officers}
          onSubmit={handleModalSubmit}
          loading={modalLoading}
        />
      )}
    </div>
  );
}

