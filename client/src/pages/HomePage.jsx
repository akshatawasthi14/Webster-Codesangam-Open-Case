import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Search,
  Shield,
  Lock,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Sparkles,
  FileText,
  UserCheck,
  ChevronRight,
  Hash,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getPublicStats } from '../api/stats.js';

export function HomePage({ onNavigate }) {
  const { isAuthenticated, user, isStudent, isOfficer, isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [quickTrackId, setQuickTrackId] = useState('');
  const [quickTrackError, setQuickTrackError] = useState('');

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getPublicStats();
        setStats(data);
      } catch (err) {
        console.warn('Public stats unavailable:', err);
      }
    }
    loadStats();
    const timer = setInterval(loadStats, 5000);
    return () => clearInterval(timer);
  }, []);

  const getDashboardPath = () => {
    if (isStudent) return '/dashboard';
    if (isOfficer) return '/officer';
    if (isAdmin) return '/admin';
    return '/';
  };

  const handleQuickTrack = (e) => {
    e.preventDefault();
    const trimmed = quickTrackId.trim();
    if (!trimmed) {
      setQuickTrackError('Please enter a Complaint ID or Receipt Token');
      return;
    }
    setQuickTrackError('');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    if (isUuid && isAuthenticated) {
      onNavigate(`/tickets/${trimmed}`);
      return;
    }
    onNavigate(`/track?token=${encodeURIComponent(trimmed)}`);
  };

  const summary = stats?.summary || null;
  const totalCount = summary?.total !== undefined && summary?.total !== null ? Number(summary.total) : 0;
  const openCount = summary?.open !== undefined && summary?.open !== null ? Number(summary.open) : 0;
  const resolvedCount = summary?.resolved !== undefined && summary?.resolved !== null ? Number(summary.resolved) : 0;
  const resolutionRate =
    summary?.resolutionRate !== undefined && summary?.resolutionRate !== null
      ? summary.resolutionRate
      : (totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 100);

  return (
    <div className="editorial-grid-bg min-h-screen text-aubergine-950 selection:bg-marigold-200 selection:text-aubergine-950">
      
      {/* HERO SECTION - Hand merged seamlessly into background matching reference layout */}
      <section className="relative overflow-hidden w-full border-b border-aubergine-900/15 min-h-[580px] sm:min-h-[660px] lg:min-h-[720px] flex flex-col justify-between">
        
        {/* Seamless Background Illustration (Raised fist, crowd & marigold dust with all text removed) */}
        <div
          className="absolute inset-0 pointer-events-none bg-no-repeat bg-contain sm:bg-contain lg:bg-cover mix-blend-multiply opacity-90 transition-opacity"
          style={{
            backgroundImage: `url('/hero-fist-bg.jpg')`,
            backgroundPosition: 'right bottom',
          }}
          aria-hidden="true"
        />

        {/* Foreground Content Container */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-12 pt-8 sm:pt-12 pb-16 lg:pb-24 flex-1 flex flex-col justify-between">
          
          {/* Top Row: Annotations on Left and Right exactly like reference */}
          <div className="flex items-start justify-between w-full select-none">
            {/* Top-left: YOUR VOICE MATTERS */}
            <div className="space-y-1">
              <span className="block text-[11px] font-bold tracking-[0.28em] uppercase text-aubergine-950/80 font-mono">
                YOUR VOICE
              </span>
              <span className="block text-[11px] font-bold tracking-[0.28em] uppercase text-aubergine-950/80 font-mono">
                MATTERS
              </span>
              <div className="w-10 h-[2px] bg-aubergine-950/70 mt-1" />
            </div>

            {/* Top-right: REAL ISSUES · REAL PEOPLE · REAL CHANGE */}
            <div className="space-y-0.5 text-right">
              <span className="block text-[10px] font-bold tracking-[0.28em] uppercase text-aubergine-950/80 font-mono">
                REAL
              </span>
              <span className="block text-[10px] font-bold tracking-[0.28em] uppercase text-aubergine-950/80 font-mono">
                ISSUES
              </span>
              <span className="block text-[10px] font-bold tracking-[0.28em] uppercase text-aubergine-950/80 font-mono">
                REAL
              </span>
              <span className="block text-[10px] font-bold tracking-[0.28em] uppercase text-aubergine-950/80 font-mono">
                PEOPLE
              </span>
              <span className="block text-[10px] font-bold tracking-[0.28em] uppercase text-aubergine-950/80 font-mono">
                REAL
              </span>
              <span className="block text-[10px] font-bold tracking-[0.28em] uppercase text-aubergine-950/80 font-mono">
                CHANGE
              </span>
              <div className="w-8 h-[2px] bg-aubergine-950/70 mt-1 ml-auto" />
            </div>
          </div>

          {/* Main Hero Copy & Actions */}
          <div className="max-w-2xl py-6 sm:py-10 space-y-6 sm:space-y-8">
            
            {/* Giant Expressive Charcoal / Stencil Headline */}
            <div className="space-y-1 sm:space-y-2">
              <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-[5.75rem] xl:text-[6.75rem] font-black text-aubergine-950 tracking-tight leading-[0.9] font-display">
                <span className="block headline-spray select-none">Speak</span>
                <span className="block headline-spray select-none">Up</span>
              </h1>
              <div className="pt-2 sm:pt-4">
                <span className="block text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-extrabold tracking-tight text-aubergine-950/90 leading-tight">
                  for a Better
                </span>
                <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-6xl font-black tracking-tight text-aubergine-950 leading-tight">
                  Tomorrow
                </span>
              </div>
            </div>

            {/* Subtitle paragraph */}
            <p className="text-sm sm:text-base text-aubergine-900/80 max-w-lg font-medium leading-relaxed">
              File your grievance. Track the progress. Be a part of a more transparent, responsive campus.
            </p>

            {/* Actions: Circular Arrow CTA & Secondary Links */}
            <div className="pt-2 sm:pt-4 flex flex-wrap items-center gap-6 sm:gap-8">
              {!isOfficer && !isAdmin ? (
                <button
                  type="button"
                  onClick={() => onNavigate('/file')}
                  className="group inline-flex items-center gap-3.5 text-aubergine-950 font-extrabold text-xs sm:text-sm tracking-[0.22em] uppercase hover:text-marigold-600 transition-all select-none"
                >
                  <span className="w-11 h-11 rounded-full border-2 border-aubergine-950 group-hover:border-marigold-600 group-hover:bg-marigold-500/10 flex items-center justify-center transition-all shadow-sm">
                    <ArrowRight className="w-4 h-4 text-aubergine-950 group-hover:text-marigold-600 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                  <span>SUBMIT A GRIEVANCE</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate(getDashboardPath())}
                  className="group inline-flex items-center gap-3.5 text-aubergine-950 font-extrabold text-xs sm:text-sm tracking-[0.22em] uppercase hover:text-marigold-600 transition-all select-none"
                >
                  <span className="w-11 h-11 rounded-full border-2 border-aubergine-950 group-hover:border-marigold-600 group-hover:bg-marigold-500/10 flex items-center justify-center transition-all shadow-sm">
                    <ArrowRight className="w-4 h-4 text-aubergine-950 group-hover:text-marigold-600 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                  <span>{isOfficer ? 'OPEN OFFICER QUEUE' : 'OPEN ADMIN CONSOLE'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onNavigate('/track')}
                className="group inline-flex items-center gap-2.5 text-aubergine-900/80 font-bold text-xs sm:text-sm tracking-[0.18em] uppercase hover:text-aubergine-950 transition-colors select-none py-2"
              >
                <Search className="w-4 h-4 text-marigold-600" />
                <span>TRACK COMPLAINT ID</span>
              </button>
            </div>

            {/* Bottom-left brutalist/editorial ticker */}
            <div className="flex items-center gap-2 pt-4 text-aubergine-950/40 select-none">
              <div className="flex gap-1 text-sm font-mono tracking-tighter">
                <span>|</span>
                <span>|</span>
                <span>|</span>
                <span>|</span>
                <span>|</span>
              </div>
              <div className="w-6 h-[1.5px] bg-aubergine-950/40" />
            </div>

          </div>
        </div>
      </section>

      {/* ARCHITECTURAL METRICS RIBBON - Clean Database Synchronised Data */}
      <section className="border-b border-aubergine-900/15 bg-white/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-[10px] font-mono font-bold tracking-[0.25em] uppercase text-marigold-700 block">
                LIVE METRICS · DATABASE SYNCHRONISED
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-aubergine-950 tracking-tight font-display">
                Public Transparency Status
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/transparency')}
              className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] uppercase text-aubergine-900 hover:text-marigold-600 transition-colors"
            >
              <span>VIEW FULL SLA AUDIT & CHARTS</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Metric 1 */}
            <div className="bg-white/90 border border-aubergine-900/15 rounded-xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-aubergine-900/60">
                  01 / TOTAL FILED
                </span>
                <span className="w-2 h-2 rounded-full bg-aubergine-700" />
              </div>
              <p className="text-3xl sm:text-4xl font-black font-mono text-aubergine-950">
                {totalCount}
              </p>
              <p className="text-[11px] text-aubergine-900/70 font-medium">
                Official petitions registered in system
              </p>
            </div>

            {/* Metric 2 */}
            <div className="bg-white/90 border border-aubergine-900/15 rounded-xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-marigold-700">
                  02 / UNDER REVIEW
                </span>
                <span className="w-2 h-2 rounded-full bg-marigold-500 animate-pulse" />
              </div>
              <p className="text-3xl sm:text-4xl font-black font-mono text-marigold-600">
                {openCount}
              </p>
              <p className="text-[11px] text-aubergine-900/70 font-medium">
                Active officer investigations in progress
              </p>
            </div>

            {/* Metric 3 */}
            <div className="bg-white/90 border border-aubergine-900/15 rounded-xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-emerald-800">
                  03 / RESOLVED
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <p className="text-3xl sm:text-4xl font-black font-mono text-emerald-800">
                {resolvedCount}
              </p>
              <p className="text-[11px] text-aubergine-900/70 font-medium">
                Cases successfully concluded with resolution note
              </p>
            </div>

            {/* Metric 4 */}
            <div className="bg-white/90 border border-aubergine-900/15 rounded-xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-marigold-700">
                  04 / RESOLUTION RATE
                </span>
                <span className="w-2 h-2 rounded-full bg-marigold-500" />
              </div>
              <p className="text-3xl sm:text-4xl font-black font-mono text-aubergine-950">
                {resolutionRate}%
              </p>
              <p className="text-[11px] text-aubergine-900/70 font-medium">
                Proportion of submitted petitions resolved
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK COMPLAINT LOOKUP BAR */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-10">
        <div className="bg-white border border-aubergine-900/15 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-5 space-y-2">
              <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-marigold-700 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                <span>FAST LOOKUP</span>
              </span>
              <h3 className="text-xl font-black text-aubergine-950 font-display">
                Already Filed? Track with Complaint ID
              </h3>
              <p className="text-xs text-aubergine-900/70 leading-relaxed">
                Enter your secret 43-character receipt token (or Complaint ID if signed in) to check current stage, assigned officer, SLA deadlines, and audit history.
              </p>
            </div>

            <div className="lg:col-span-7">
              <form onSubmit={handleQuickTrack} className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-aubergine-900/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={quickTrackId}
                      onChange={(e) => {
                        setQuickTrackId(e.target.value);
                        setQuickTrackError('');
                      }}
                      placeholder="Paste secret receipt token or Complaint ID..."
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-silver-50 border border-aubergine-900/20 text-xs sm:text-sm font-mono text-aubergine-950 placeholder-silver-500 focus:outline-none focus:ring-2 focus:ring-marigold-500/50 focus:border-marigold-500 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-aubergine-950 hover:bg-aubergine-900 text-silver-100 font-bold text-xs tracking-[0.15em] uppercase transition-all shadow-sm select-none"
                  >
                    <span>TRACK NOW</span>
                    <ArrowRight className="w-3.5 h-3.5 text-marigold-400" />
                  </button>
                </div>
                {quickTrackError && (
                  <p className="text-xs text-rose-600 font-medium pl-1">{quickTrackError}</p>
                )}
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* THE THREE GUARANTEES - High Integrity Architecture */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-12 border-t border-aubergine-900/10">
        <div className="text-center space-y-2 mb-12">
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-marigold-700 bg-marigold-500/15 px-3 py-1 rounded-full border border-marigold-500/30">
            SYSTEM FOUNDATION
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-aubergine-950 tracking-tight font-display">
            The Three Guarantees
          </h2>
          <p className="text-xs sm:text-sm text-aubergine-900/70 max-w-xl mx-auto">
            Where traditional complaint portals rely on promises, Open Case enforces integrity through database constraints and cryptography.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Guarantee 1: Traceability */}
          <div className="bg-white rounded-2xl border border-aubergine-900/15 p-6 sm:p-7 shadow-sm hover:border-marigold-500 transition-all">
            <div className="w-12 h-12 rounded-xl bg-aubergine-900 text-marigold-400 flex items-center justify-center mb-5 shadow-sm">
              <Clock className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-marigold-700 uppercase block mb-1">
              GUARANTEE 01
            </span>
            <h3 className="text-lg font-black text-aubergine-950 mb-2 font-display">
              Total Traceability
            </h3>
            <p className="text-xs text-aubergine-900/70 leading-relaxed">
              Every petition receives a permanent Complaint ID, a rigorous state machine progression, and real-time updates over Server-Sent Events. No grievance ever languishes in an unmonitored mailbox.
            </p>
          </div>

          {/* Guarantee 2: Server Enforcement */}
          <div className="bg-white rounded-2xl border border-aubergine-900/15 p-6 sm:p-7 shadow-sm hover:border-marigold-500 transition-all">
            <div className="w-12 h-12 rounded-xl bg-marigold-500 text-aubergine-950 flex items-center justify-center mb-5 shadow-sm">
              <Shield className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-marigold-700 uppercase block mb-1">
              GUARANTEE 02
            </span>
            <h3 className="text-lg font-black text-aubergine-950 mb-2 font-display">
              Server-Enforced SLAs
            </h3>
            <p className="text-xs text-aubergine-900/70 leading-relaxed">
              State transitions are governed by PostgreSQL ACID constraints. Mandatory steps like resolution notes cannot be skipped, and automated background jobs escalate overdue cases directly.
            </p>
          </div>

          {/* Guarantee 3: Cryptographic Verifiability */}
          <div className="bg-white rounded-2xl border border-aubergine-900/15 p-6 sm:p-7 shadow-sm hover:border-marigold-500 transition-all">
            <div className="w-12 h-12 rounded-xl bg-aubergine-950 text-white flex items-center justify-center mb-5 shadow-sm">
              <Lock className="w-6 h-6 text-marigold-400" />
            </div>
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-marigold-700 uppercase block mb-1">
              GUARANTEE 03
            </span>
            <h3 className="text-lg font-black text-aubergine-950 mb-2 font-display">
              Cryptographic Audit Chains
            </h3>
            <p className="text-xs text-aubergine-900/70 leading-relaxed">
              Every transition and message is hashed with SHA-256 into a tamper-evident chain. Any retroactive alteration or deletion breaks the hash validation and is mathematically proven invalid.
            </p>
          </div>
        </div>
      </section>

      {/* ENFORCED CASE LIFECYCLE STEPPER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-12">
        <div className="bg-white rounded-2xl border border-aubergine-900/15 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-aubergine-900/10">
            <div>
              <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-marigold-700 uppercase block mb-1">
                LIFECYCLE PIPELINE
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-aubergine-950 font-display">
                Enforced Case Lifecycle
              </h3>
              <p className="text-xs text-aubergine-900/70 mt-1">
                Every grievance moves through strict stages governed by role authorization and preconditions.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-aubergine-900/80 bg-silver-100 px-3 py-1.5 rounded-lg border border-aubergine-900/10">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Row-Level Locked Under Concurrency</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl bg-silver-50 border border-aubergine-900/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-aubergine-900/60">STAGE 01</span>
                <span className="w-2 h-2 rounded-full bg-silver-400" />
              </div>
              <h4 className="font-black text-xs sm:text-sm text-aubergine-950 font-display">FILED</h4>
              <p className="text-[11px] text-aubergine-900/70 leading-relaxed">
                Registered anonymously or by student. SLA countdown starts.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-blue-700">STAGE 02</span>
                <span className="w-2 h-2 rounded-full bg-blue-600" />
              </div>
              <h4 className="font-black text-xs sm:text-sm text-blue-950 font-display">ASSIGNED</h4>
              <p className="text-[11px] text-blue-900/80 leading-relaxed">
                Designated to an authorized officer by routing policy or admin.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-marigold-50/60 border border-marigold-300/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-marigold-800">STAGE 03</span>
                <span className="w-2 h-2 rounded-full bg-marigold-500" />
              </div>
              <h4 className="font-black text-xs sm:text-sm text-marigold-950 font-display">IN REVIEW</h4>
              <p className="text-[11px] text-marigold-900/90 leading-relaxed">
                Investigation actively conducted by the assigned officer.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-emerald-700">STAGE 04</span>
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
              </div>
              <h4 className="font-black text-xs sm:text-sm text-emerald-950 font-display">RESOLVED</h4>
              <p className="text-[11px] text-emerald-900/90 leading-relaxed">
                Concluded with mandatory official note. 72h dispute window opens.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-rose-700">BRANCH</span>
                <span className="w-2 h-2 rounded-full bg-rose-600" />
              </div>
              <h4 className="font-black text-xs sm:text-sm text-rose-950 font-display">ESCALATED</h4>
              <p className="text-[11px] text-rose-900/90 leading-relaxed">
                Triggered automatically upon SLA breach, admin action, or student dispute.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ANONYMOUS PRIVACY BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 pb-16">
        <div className="bg-aubergine-950 text-white rounded-2xl p-8 sm:p-10 border border-aubergine-900 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-marigold-500/20 text-marigold-300 text-xs font-semibold border border-marigold-500/30">
              <Lock className="w-3.5 h-3.5" />
              <span>Zero-Account Privacy</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-silver-100 font-display">
              Anonymous Reporting by Construction
            </h3>
            <p className="text-xs sm:text-sm text-silver-300 leading-relaxed">
              Complainants facing sensitive concerns report with absolute protection. The system creates zero account links, logs zero IP addresses, and secures access using your unique 43-character secret receipt token.
            </p>
            <div className="pt-2 flex flex-wrap gap-4">
              {!isOfficer && !isAdmin && (
                <button
                  type="button"
                  onClick={() => onNavigate('/file')}
                  className="px-5 py-2.5 rounded-xl bg-marigold-500 hover:bg-marigold-600 text-aubergine-950 font-bold text-xs tracking-[0.15em] uppercase transition-all shadow-sm"
                >
                  File Anonymously Now
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigate('/track')}
                className="px-5 py-2.5 rounded-xl bg-aubergine-900 hover:bg-aubergine-800 text-silver-100 font-bold text-xs tracking-[0.15em] uppercase border border-silver-400/30 transition-all"
              >
                Track Complaint
              </button>
            </div>
          </div>

          <div className="bg-aubergine-900/80 rounded-xl p-5 border border-aubergine-800 space-y-3 font-mono text-xs">
            <div className="text-marigold-400 font-bold flex items-center justify-between pb-2 border-b border-aubergine-800">
              <span>ANONYMITY CONSTRAINTS (PostgreSQL)</span>
              <span className="text-emerald-400">CHECK_OK</span>
            </div>
            <p className="text-silver-400 text-[11px] leading-relaxed">
              CONSTRAINT tickets_anonymity_chk CHECK (<br/>
              &nbsp;&nbsp;(is_anonymous AND created_by IS NULL AND receipt_token_hash IS NOT NULL)<br/>
              &nbsp;&nbsp;OR (NOT is_anonymous AND created_by IS NOT NULL AND receipt_token_hash IS NULL)<br/>
              )
            </p>
            <div className="pt-2 text-[11px] text-silver-300 font-sans space-y-1">
              <p>✓ Receipt token provides exclusive anonymous access</p>
              <p>✓ Token shown once on filing; only SHA-256 hash stored on server</p>
              <p>✓ Public statistics update automatically with live database sync</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
