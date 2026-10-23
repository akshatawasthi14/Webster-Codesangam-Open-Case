import React, { useState, useEffect } from 'react';
import {
  Search,
  Shield,
  Clock,
  Download,
  MessageSquare,
  Send,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Lock,
  RotateCcw,
  Copy,
  Check,
} from 'lucide-react';
import {
  getAnonymousCase,
  addAnonymousComment,
  disputeAnonymousTicket,
  verifyAnonymousAudit,
  downloadAttachmentFile,
} from '../api/tickets.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { PriorityBadge } from '../components/PriorityBadge.jsx';
import { SlaCountdown } from '../components/SlaCountdown.jsx';
import { AuditChainVisualizer } from '../components/AuditChainVisualizer.jsx';
import { DisputeModal } from '../components/DisputeModal.jsx';
import { formatDate, formatBytes, shortHash } from '../utils/formatters.js';

export function TrackCasePage({ initialToken = '', onNavigate }) {
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [activeToken, setActiveToken] = useState(initialToken);
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Comment state
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Dispute state
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // Audit verify state
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [nowTime, setNowTime] = useState(Date.now());
  const [copiedTicketId, setCopiedTicketId] = useState(false);

  const handleCopyComplaintId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedTicketId(true);
    setTimeout(() => setCopiedTicketId(false), 2000);
  };

  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (initialToken) {
      setTokenInput(initialToken);
      setActiveToken(initialToken);
      fetchCase(initialToken);
    } else {
      try {
        const saved = localStorage.getItem('opencase_saved_receipt');
        if (saved) {
          setTokenInput(saved);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [initialToken]);

  const fetchCase = async (tokenToUse) => {
    if (!tokenToUse || tokenToUse.trim().length === 0) return;
    setLoading(true);
    setError('');
    setVerifyResult(null);

    try {
      const data = await getAnonymousCase(tokenToUse.trim());
      setCaseData(data);
      setActiveToken(tokenToUse.trim());
    } catch (err) {
      setCaseData(null);
      setError(
        err.status === 401
          ? 'Invalid or unrecognized receipt token. Check that you pasted the exact 43-character token.'
          : err.message || 'Failed to fetch case details.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = (e) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError('Please enter your secret receipt token.');
      return;
    }
    fetchCase(tokenInput.trim());
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await addAnonymousComment(activeToken, commentText.trim());
      setCommentText('');
      // Reload ticket detail
      await fetchCase(activeToken);
    } catch (err) {
      alert(`Failed to add comment: ${err.message}`);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDispute = async ({ version, reason }) => {
    setSubmittingDispute(true);
    try {
      await disputeAnonymousTicket(activeToken, { version, reason });
      setIsDisputeOpen(false);
      await fetchCase(activeToken);
    } catch (err) {
      alert(`Dispute submission failed: ${err.message}`);
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleVerifyAudit = async () => {
    setVerifying(true);
    try {
      const result = await verifyAnonymousAudit(activeToken);
      setVerifyResult(result);
    } catch (err) {
      alert(`Audit verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleDownloadAttachment = async (att) => {
    try {
      await downloadAttachmentFile({
        attachmentId: att.id,
        fileName: att.fileName,
        receiptToken: activeToken,
      });
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const ticket = caseData?.ticket;
  const comments = caseData?.comments || [];
  const attachments = caseData?.attachments || [];
  const timeline = caseData?.timeline || [];

  const isResolved = ticket?.status === 'RESOLVED';
  const remainingDisputeMs = ticket?.disputeWindowClosesAt
    ? new Date(ticket.disputeWindowClosesAt).getTime() - nowTime
    : 0;
  const disputeOpen = isResolved && remainingDisputeMs > 0;
  const disputeHoursLeft = Math.floor(remainingDisputeMs / (1000 * 60 * 60));
  const disputeMinsLeft = Math.floor((remainingDisputeMs % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Lookup Header */}
      <div className="bg-white rounded-2xl border border-silver-300 p-6 sm:p-8 shadow-sm">
        <div className="max-w-2xl mb-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-marigold-700 bg-marigold-100 px-3 py-1 rounded-full w-fit mb-3">
            <Lock className="w-3.5 h-3.5" />
            <span>Complaint Tracking Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-aubergine-900 tracking-tight">
            Track Anonymous Complaint
          </h1>
          <p className="text-xs sm:text-sm text-silver-600 mt-1 leading-relaxed">
            Enter your secret 43-character receipt token to view your complaint status, officer communications, and audit records.
          </p>
        </div>

        <form onSubmit={handleLookup} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste your secret receipt token..."
                required
                className="w-full pl-4 pr-10 py-3 text-sm font-mono bg-silver-50 border border-silver-300 rounded-xl focus:border-marigold-500 focus:bg-white focus:ring-1 focus:ring-marigold-500 text-silver-900"
              />
              {tokenInput && (
                <button
                  type="button"
                  onClick={() => setTokenInput('')}
                  className="absolute right-3 top-3 text-silver-400 hover:text-silver-700 text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-aubergine-800 hover:bg-aubergine-900 text-white font-bold text-sm shadow-md transition-all whitespace-nowrap disabled:opacity-50"
            >
              <Search className="w-4 h-4 text-marigold-400" />
              <span>{loading ? 'Locating Case...' : 'Track Grievance'}</span>
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>
      </div>

      {/* Case Details View */}
      {caseData && ticket && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Main Case Summary Card */}
          <div className="bg-white rounded-2xl border border-silver-300 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-silver-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 font-mono text-xs bg-silver-100 text-aubergine-950 px-2.5 py-1 rounded-md border border-silver-300 font-bold">
                    <span className="font-sans text-[10px] uppercase font-bold text-silver-600 tracking-wider">
                      Complaint ID:
                    </span>
                    <span className="select-all">{ticket.id}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyComplaintId(ticket.id)}
                      className="p-1 hover:text-aubergine-900 text-silver-500 rounded transition-colors ml-0.5"
                      title="Copy Complaint ID"
                    >
                      {copiedTicketId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <StatusBadge status={ticket.status} size="sm" />
                  <PriorityBadge priority={ticket.priority} showSla size="sm" />
                  <span className="text-xs bg-aubergine-50 text-aubergine-800 font-semibold px-2.5 py-1 rounded-full border border-aubergine-200">
                    {ticket.category}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                    ANONYMOUS
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-silver-900 pt-2">
                  {ticket.title}
                </h2>
              </div>

              <div className="flex flex-col sm:items-end gap-1.5">
                <SlaCountdown
                  dueAt={ticket.dueAt}
                  resolvedAt={ticket.resolvedAt}
                  status={ticket.status}
                />
                <span className="text-[11px] text-silver-500">
                  Filed on {formatDate(ticket.createdAt)}
                </span>
              </div>
            </div>

            {/* Dispute Callout Banner if applicable */}
            {isResolved && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950">
                        Official Case Resolution
                      </h4>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Concluded at {formatDate(ticket.resolvedAt)}
                      </p>
                    </div>
                  </div>

                  {disputeOpen && (
                    <button
                      type="button"
                      onClick={() => setIsDisputeOpen(true)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-marigold-300" />
                      <span>Dispute Resolution</span>
                    </button>
                  )}
                </div>

                {ticket.resolutionNote && (
                  <div className="bg-white p-3.5 rounded-lg border border-emerald-200 text-xs text-silver-800 font-mono leading-relaxed">
                    <strong>Official Resolution Note:</strong>
                    <p className="mt-1 font-sans text-silver-900">{ticket.resolutionNote}</p>
                  </div>
                )}

                {disputeOpen ? (
                  <p className="text-[11px] text-emerald-800 font-medium">
                    Dispute window closes on <strong>{formatDate(ticket.disputeWindowClosesAt)}</strong> ({disputeHoursLeft}h {disputeMinsLeft}m remaining). If unsatisfied, you may dispute this resolution to escalate directly to senior administrators.
                  </p>
                ) : (
                  <p className="text-[11px] text-silver-500">
                    The 72-hour dispute window for this grievance is now closed.
                  </p>
                )}
              </div>
            )}

            {/* Escalation details if applicable */}
            {ticket.status === 'ESCALATED' && ticket.escalationReason && (
              <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-1 text-xs text-rose-950">
                <div className="flex items-center gap-2 font-bold text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Administrative Escalation Active</span>
                </div>
                <p>
                  <strong>Reason:</strong> {ticket.escalationReason}
                </p>
                <p className="text-[11px] text-rose-800 opacity-90">
                  Escalated at {formatDate(ticket.escalatedAt)}
                </p>
              </div>
            )}

            {/* Complaint Information Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-silver-50 p-4 rounded-xl border border-silver-200 text-xs">
              <div>
                <span className="text-silver-500 font-bold uppercase text-[10px] tracking-wider block">
                  Complaint ID:
                </span>
                <span className="font-mono font-bold text-aubergine-950 break-all select-all block mt-0.5">
                  {ticket.id}
                </span>
              </div>

              <div>
                <span className="text-silver-500 font-bold uppercase text-[10px] tracking-wider block">
                  Classification & Priority:
                </span>
                <span className="font-semibold text-silver-900 block mt-0.5">
                  {ticket.category} · {ticket.priority} Priority
                </span>
              </div>

              <div>
                <span className="text-silver-500 font-bold uppercase text-[10px] tracking-wider block">
                  Petitioner Status:
                </span>
                <span className="font-semibold text-silver-900 block mt-0.5">
                  Anonymous Student (Secured via SHA-256 Token)
                </span>
              </div>
            </div>

            {/* Statement of Facts */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-silver-700">
                Statement of Facts
              </h3>
              <div className="bg-silver-50 p-4 rounded-xl border border-silver-200 text-sm text-silver-800 whitespace-pre-wrap leading-relaxed">
                {ticket.description}
              </div>
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-silver-700">
                  Attached Evidence ({attachments.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="p-3 bg-silver-50 border border-silver-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-aubergine-700 flex-shrink-0" />
                        <div className="truncate">
                          <p className="font-semibold text-silver-900 truncate">{att.fileName}</p>
                          <p className="text-[10px] text-silver-500 font-mono">
                            {formatBytes(att.sizeBytes)} · SHA: {shortHash(att.sha256)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadAttachment(att)}
                        className="p-1.5 bg-white border border-silver-300 hover:border-silver-400 rounded-lg text-aubergine-800 hover:bg-silver-50 transition-colors"
                        title="Download file securely"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Comments & Discussion */}
          <div className="bg-white rounded-2xl border border-silver-300 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-aubergine-800" />
                <h3 className="font-bold text-lg text-silver-900">
                  Case Communication ({comments.length})
                </h3>
              </div>
              <span className="text-xs text-silver-500">
                All comments are committed into the SHA-256 audit chain
              </span>
            </div>

            {/* Comments list */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <div className="py-6 text-center text-xs text-silver-500">
                  No comments or messages posted yet.
                </div>
              ) : (
                comments.map((comm) => (
                  <div
                    key={comm.id}
                    className="p-4 bg-silver-50 border border-silver-200 rounded-xl text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-aubergine-900">
                          {comm.authorName ||
                            (comm.authorType === 'ANON_PETITIONER'
                              ? 'Anonymous Petitioner (You)'
                              : comm.authorType)}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-silver-200 text-silver-700 rounded">
                          {comm.authorType}
                        </span>
                      </div>
                      <span className="text-silver-500 text-[11px]">
                        {formatDate(comm.createdAt)}
                      </span>
                    </div>
                    <p className="text-silver-800 whitespace-pre-wrap leading-relaxed">
                      {comm.body}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Add anonymous comment form */}
            <form onSubmit={handleAddComment} className="pt-4 border-t border-silver-200 space-y-3">
              <label htmlFor="anon-comment-body" className="block text-xs font-bold text-silver-800 uppercase tracking-wider">
                Post Additional Information or Reply
              </label>
              <textarea
                id="anon-comment-body"
                rows={3}
                required
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                maxLength={4000}
                placeholder="Submit additional clarifications or query the assigned staff..."
                className="w-full px-4 py-2.5 text-sm bg-silver-50 border border-silver-300 rounded-xl focus:border-marigold-500 focus:bg-white focus:ring-1 focus:ring-marigold-500 text-silver-900 resize-y"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-silver-500">
                  {commentText.length}/4000 characters
                </span>
                <button
                  type="submit"
                  disabled={submittingComment || !commentText.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-aubergine-800 hover:bg-aubergine-900 text-white font-bold text-xs transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-marigold-400" />
                  <span>{submittingComment ? 'Posting...' : 'Post Anonymous Comment'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Cryptographic Audit Trail Visualizer */}
          <AuditChainVisualizer
            timeline={timeline}
            onVerify={handleVerifyAudit}
            verifyResult={verifyResult}
            verifying={verifying}
            canVerify={caseData.canVerifyAudit}
          />
        </div>
      )}

      {/* Dispute Modal */}
      {isDisputeOpen && ticket && (
        <DisputeModal
          isOpen={isDisputeOpen}
          onClose={() => setIsDisputeOpen(false)}
          ticket={ticket}
          onSubmit={handleDispute}
          loading={submittingDispute}
        />
      )}
    </div>
  );
}

