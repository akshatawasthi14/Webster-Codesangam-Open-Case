import React from 'react';
import { Shield, Lock, CheckCircle2, GitBranch } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function Footer({ onNavigate }) {
  const { isOfficer, isAdmin } = useAuth();
  return (
    <footer className="bg-aubergine-950 text-silver-300 border-t border-aubergine-900 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-aubergine-800 border border-marigold-500/40 flex items-center justify-center text-marigold-400">
                <Shield className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xl text-white tracking-tight">
                Open<span className="text-marigold-400">Case</span>
              </span>
            </div>
            <p className="text-xs text-silver-400 leading-relaxed max-w-md">
              A grievance redressal platform where every case is traceable, every deadline is enforced, and every action leaves a verifiable cryptographic audit trail. Designed with privacy-preserving anonymous reporting by construction.
            </p>
            <div className="flex items-center gap-4 text-xs font-mono text-silver-400 pt-1">
              <span className="flex items-center gap-1.5 text-marigold-300">
                <Lock className="w-3.5 h-3.5" />
                SHA-256 Hash Chains
              </span>
              <span className="flex items-center gap-1.5 text-silver-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                SLA State Engine
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-silver-100">
              Platform Features
            </h4>
            <ul className="space-y-2 text-xs">
              {!isOfficer && !isAdmin && (
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate && onNavigate('/file')}
                    className="text-silver-400 hover:text-marigold-300 transition-colors"
                  >
                    File a Grievance
                  </button>
                </li>
              )}
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('/track')}
                  className="text-silver-400 hover:text-marigold-300 transition-colors"
                >
                  Track with Complaint ID
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('/transparency')}
                  className="text-silver-400 hover:text-marigold-300 transition-colors"
                >
                  Public Transparency & SLA
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('/login')}
                  className="text-silver-400 hover:text-marigold-300 transition-colors"
                >
                  Staff & Officer Sign In
                </button>
              </li>
            </ul>
          </div>

          {/* Institutional Integrity & Governance */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-silver-100 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-marigold-400" />
              Institutional Redressal
            </h4>
            <p className="text-xs text-silver-400 leading-relaxed">
              Standard operating procedures for campus grievance submission, SLA tracking, and resolution auditing.
            </p>
            <div className="pt-1 text-[11px] text-silver-400 space-y-1">
              <p className="text-silver-300 font-semibold">Security & Privacy Controls:</p>
              <p>• Zero-account anonymous reporting</p>
              <p>• SHA-256 tamper-evident audit logs</p>
              <p>• Differential privacy data protection</p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-aubergine-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-silver-500">
          <p>
            © {new Date().getFullYear()} Open Case. Tamper-evident grievance redressal platform.
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-silver-300" title="Ice Silver (#DDE3E8)" />
            <span className="w-2.5 h-2.5 rounded-full bg-aubergine-800" title="Deep Aubergine (#3A0F34)" />
            <span className="w-2.5 h-2.5 rounded-full bg-marigold-500" title="Flavour of Marigold (#EAAA00)" />
          </div>
        </div>
      </div>
    </footer>
  );
}

