import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Link as LinkIcon,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Cpu,
  UserX,
  FileText,
  RotateCw,
} from 'lucide-react';
import { formatDate, shortHash } from '../utils/formatters.js';

export function AuditChainVisualizer({
  timeline = [],
  onVerify,
  verifyResult = null,
  verifying = false,
  canVerify = true,
}) {
  const [expandedPayloads, setExpandedPayloads] = useState({});
  const [copiedHash, setCopiedHash] = useState(null);

  const togglePayload = (seq) => {
    setExpandedPayloads((prev) => ({
      ...prev,
      [seq]: !prev[seq],
    }));
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(key);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const getActorIcon = (actorType) => {
    switch (actorType) {
      case 'SYSTEM':
        return <Cpu className="w-3.5 h-3.5 text-aubergine-600" />;
      case 'ANON_PETITIONER':
        return <UserX className="w-3.5 h-3.5 text-marigold-600" />;
      default:
        return <User className="w-3.5 h-3.5 text-silver-700" />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'FILED':
        return 'bg-silver-200 text-silver-900 border-silver-400';
      case 'ASSIGNED':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'IN_REVIEW':
        return 'bg-marigold-100 text-marigold-950 border-marigold-300';
      case 'RESOLVED':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'ESCALATED':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      case 'COMMENT_ADDED':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'ATTACHMENT_ADDED':
        return 'bg-teal-100 text-teal-900 border-teal-300';
      default:
        return 'bg-silver-100 text-silver-800 border-silver-300';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-silver-300 overflow-hidden shadow-sm">
      {/* Header bar */}
      <div className="bg-aubergine-800 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-marigold-400" />
            <h3 className="font-semibold text-lg tracking-tight text-silver-100">
              Cryptographic Audit Chain
            </h3>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-aubergine-900 text-marigold-400 border border-aubergine-700">
              SHA-256
            </span>
          </div>
          <p className="text-xs text-silver-300 mt-1 max-w-xl">
            Immutable, append-only hash sequence. Every event links to the preceding event hash; any modification breaks verification.
          </p>
        </div>

        {canVerify && onVerify && (
          <button
            type="button"
            onClick={onVerify}
            disabled={verifying}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-marigold-500 hover:bg-marigold-600 active:bg-marigold-700 text-aubergine-950 font-semibold text-sm transition-all shadow-sm disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
            <span>{verifying ? 'Computing SHA-256 Hashes...' : 'Verify Chain Integrity'}</span>
          </button>
        )}
      </div>

      {/* Verification Results Banner */}
      {verifyResult && (
        <div
          className={`px-5 py-3.5 border-b transition-all ${
            verifyResult.valid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-start gap-3">
            {verifyResult.valid ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">
                  {verifyResult.valid
                    ? 'Audit Chain Verified & Intact'
                    : 'Audit Chain Integrity Failure Detected'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-white/70 font-mono">
                  {verifyResult.eventsChecked} events verified
                </span>
                <span className="text-xs text-silver-600">
                  Checked at {formatDate(verifyResult.checkedAt)}
                </span>
              </div>
              <p className="text-xs mt-1 opacity-90">{verifyResult.note}</p>
              {verifyResult.firstFailure && (
                <div className="mt-2 p-2 bg-rose-100 rounded text-xs font-mono text-rose-900 border border-rose-200">
                  <strong>First Failure:</strong> Event #{verifyResult.firstFailure.sequenceNo} -{' '}
                  {verifyResult.firstFailure.code}: {verifyResult.firstFailure.reason}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Timeline nodes */}
      <div className="p-5 bg-silver-50">
        {timeline.length === 0 ? (
          <div className="text-center py-8 text-silver-600 text-sm">
            No audit records created yet.
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-silver-300">
            {timeline.map((event, index) => {
              const isFirst = index === 0;
              const isExpanded = expandedPayloads[event.sequenceNo];
              const copyKey = `hash-${event.sequenceNo}`;

              return (
                <div key={event.sequenceNo} className="relative group">
                  {/* Sequence Node Dot */}
                  <div
                    className={`absolute -left-6 top-3.5 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center text-[10px] font-mono font-bold ${
                      isFirst
                        ? 'border-marigold-500 text-marigold-800'
                        : 'border-aubergine-700 text-aubergine-800'
                    }`}
                  >
                    {event.sequenceNo}
                  </div>

                  {/* Card */}
                  <div className="bg-white rounded-lg border border-silver-300 p-4 shadow-sm hover:border-silver-400 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded font-mono font-bold border ${getActionColor(
                            event.action
                          )}`}
                        >
                          {event.action}
                        </span>

                        <div className="flex items-center gap-1 text-xs text-silver-700 bg-silver-100 px-2 py-0.5 rounded border border-silver-200">
                          {getActorIcon(event.actorType)}
                          <span className="font-medium">
                            {event.actorName ||
                              (event.actorType === 'ANON_PETITIONER'
                                ? 'Anonymous Petitioner'
                                : event.actorType)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-silver-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDate(event.occurredAt)}</span>
                      </div>
                    </div>

                    {/* Hashes link view */}
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono bg-silver-100 p-2.5 rounded border border-silver-200">
                      <div>
                        <span className="text-[11px] text-silver-500 block">Previous Hash (H<sub>i-1</sub>):</span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-silver-700">
                          {event.prevHash ? (
                            <>
                              <span className="truncate" title={event.prevHash}>
                                {shortHash(event.prevHash)}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(event.prevHash, `prev-${event.sequenceNo}`)}
                                className="text-silver-400 hover:text-silver-700"
                                title="Copy full SHA-256"
                              >
                                {copiedHash === `prev-${event.sequenceNo}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </>
                          ) : (
                            <span className="text-silver-400 italic">Genesis (None)</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] text-aubergine-700 font-semibold block">
                          Event Hash (H<sub>i</sub>):
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-aubergine-900 font-bold">
                          <span className="truncate" title={event.eventHash}>
                            {shortHash(event.eventHash)}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(event.eventHash, copyKey)}
                            className="text-silver-500 hover:text-aubergine-900"
                            title="Copy full SHA-256"
                          >
                            {copiedHash === copyKey ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Payload Details toggle */}
                    {event.payload && Object.keys(event.payload).length > 0 && (
                      <div className="mt-3 pt-2 border-t border-silver-200">
                        <button
                          type="button"
                          onClick={() => togglePayload(event.sequenceNo)}
                          className="flex items-center gap-1 text-xs text-aubergine-700 hover:text-aubergine-900 font-medium"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isExpanded ? 'Hide Payload Event Data' : 'View Payload Event Data'}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-2.5 bg-silver-900 text-silver-100 rounded text-xs font-mono overflow-x-auto">
                            <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

