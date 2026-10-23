import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Clock,
  Download,
  MessageSquare,
  Send,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Shield,
  User,
  ArrowRight,
  RotateCw,
  Copy,
  Check,
} from 'lucide-react';
import {
  getTicket,
  addComment,
  transitionTicket,
  verifyAudit,
  downloadAttachmentFile,
} from '../api/tickets.js';
import { getOfficers } from '../api/admin.js';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { PriorityBadge } from '../components/PriorityBadge.jsx';
import { SlaCountdown } from '../components/SlaCountdown.jsx';
import { AuditChainVisualizer } from '../components/AuditChainVisualizer.jsx';
import { TransitionModal } from '../components/TransitionModal.jsx';
import { DisputeModal } from '../components/DisputeModal.jsx';
import { formatDate, formatBytes, shortHash } from '../utils/formatters.js';

export function TicketDetailPage({ ticketId, onNavigate }) {
  const { user, isStudent, isOfficer, isAdmin } = useAuth();

  const [ticketData, setTicketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Comment state
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Transition state
  const [isTransitionOpen, setIsTransitionOpen] = useState(false);
  const [targetTransition, setTargetTransition] = useState('');
  const [officers, setOfficers] = useState([]);
  const [transitionLoading, setTransitionLoading] = useState(false);

  // Dispute state
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [disputeLoading, setDisputeLoading] = useState(false);

  // Audit verify state
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [copiedTicketId, setCopiedTicketId] = useState(false);

  const handleCopyComplaintId = () => {
    if (!ticketId) return;
    navigator.clipboard.writeText(ticketId);
    setCopiedTicketId(true);
    setTimeout(() => setCopiedTicketId(false), 2000);
  };

  const fetchTicket = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getTicket(ticketId);
      setTicketData(data);
    } catch (err) {
      setError(err.message || 'Failed to load case details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) fetchTicket();
  }, [ticketId]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await addComment(ticketId, commentText.trim());
      setCommentText('');
      await fetchTicket();
    } catch (err) {
      alert(`Failed to add comment: ${err.message}`);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleOpenTransition = async (target) => {
    setTargetTransition(target);
    if (target === 'ASSIGNED') {
      try {
        const offs = await getOfficers();
        setOfficers(offs);
      } catch (e) {
        console.warn('Could not load officers:', e);
      }
    }
    setIsTransitionOpen(true);
  };

  const handleTransitionSubmit = async (payload) => {
    setTransitionLoading(true);
    try {
      await transitionTicket(ticketId, payload);
      setIsTransitionOpen(false);
      await fetchTicket();
    } catch (err) {
      if (err.isStaleVersion) {
        alert('This case was updated by another team member just now. Automatically refreshing with the latest case version...');
        setIsTransitionOpen(false);
        await fetchTicket();
      } else {
        alert(`Action failed: ${err.message}`);
      }
    } finally {
      setTransitionLoading(false);
    }
  };

  const handleDisputeSubmit = async ({ version, reason }) => {
    setDisputeLoading(true);
    try {
      await transitionTicket(ticketId, {
        to: 'ESCALATED',
        version,
        reason,
      });
      setIsDisputeOpen(false);
      await fetchTicket();
    } catch (err) {
      alert(`Dispute failed: ${err.message}`);
    } finally {
      setDisputeLoading(false);
    }
  };

  const handleVerifyAudit = async () => {
    setVerifying(true);
    try {
      const result = await verifyAudit(ticketId);
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
        ticketId: ticket.id,
        attachmentId: att.id,
        fileName: att.fileName,
      });
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center text-silver-500">
        <RotateCw className="w-8 h-8 animate-spin mx-auto text-marigold-500 mb-3" />
        <p className="text-sm">Retrieving case record & audit chain...</p>
      </div>
    );
  }

  if (error || !ticketData) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-silver-900">Case Not Found</h2>
        <p className="text-xs text-silver-600">{error || 'This grievance could not be retrieved.'}</p>
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="px-4 py-2 bg-aubergine-800 text-white rounded-lg text-xs font-bold"
        >
          Return Home
        </button>
      </div>
    );
  }

  const { ticket, comments, attachments, timeline, availableTransitions = [], canComment, canVerifyAudit } = ticketData;

  const isResolved = ticket.status === 'RESOLVED';
  const remainingDisputeMs = ticket.disputeWindowClosesAt
    ? new Date(ticket.disputeWindowClosesAt).getTime() - Date.now()
    : 0;
  const disputeOpen = isResolved && remainingDisputeMs > 0;
  const disputeHoursLeft = Math.floor(remainingDisputeMs / (1000 * 60 * 60));
  const disputeMinsLeft = Math.floor((remainingDisputeMs % (1000 * 60 * 60)) / (1000 * 60));

  const isPetitioner = ticket.petitioner?.id === user?.id;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top bar back button */}
      <button
        type="button"
        onClick={() => {
          if (isStudent) onNavigate('/dashboard');
          else if (isOfficer) onNavigate('/officer');
          else if (isAdmin) onNavigate('/admin');
          else onNavigate('/');
        }}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-silver-600 hover:text-aubergine-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Case Queue</span>
      </button>

      {/* Main Ticket Card */}
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
                  onClick={handleCopyComplaintId}
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
              {ticket.isAnonymous && (
                <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                  ANONYMOUS
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-silver-900 pt-2">
              {ticket.title}
            </h1>
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

        {/* Complaint Information & Stakeholder attribution */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-silver-50 p-4 rounded-xl border border-silver-200 text-xs">
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
              Classification:
            </span>
            <span className="font-semibold text-silver-900 block mt-0.5">
              {ticket.category} · {ticket.priority}
            </span>
          </div>

          <div>
            <span className="text-silver-500 font-bold uppercase text-[10px] tracking-wider block">
              Petitioner:
            </span>
            <span className="font-semibold text-silver-900 block mt-0.5">
              {ticket.petitioner ? ticket.petitioner.name : 'Anonymous Student (Privacy Preserved)'}
            </span>
          </div>

          <div>
            <span className="text-silver-500 font-bold uppercase text-[10px] tracking-wider block">
              Assigned Staff / Officer:
            </span>
            <span className="font-semibold text-silver-900 block mt-0.5">
              {ticket.assignee ? ticket.assignee.name : 'Unassigned (Awaiting Review)'}
            </span>
          </div>
        </div>

        {/* Action Controls for Staff / Admin / Petitioner */}
        {(availableTransitions.length > 0 || (isPetitioner && disputeOpen)) && (
          <div className="p-4 bg-aubergine-50 border border-aubergine-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-aubergine-900">
                Authorized Actions:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {availableTransitions.map((tr) => (
                <button
                  key={tr.to}
                  type="button"
                  onClick={() => handleOpenTransition(tr.to)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all ${
                    tr.to === 'RESOLVED'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : tr.to === 'ESCALATED'
                      ? 'bg-rose-700 hover:bg-rose-800 text-white'
                      : tr.to === 'IN_REVIEW'
                      ? 'bg-marigold-500 hover:bg-marigold-600 text-aubergine-950'
                      : 'bg-aubergine-800 hover:bg-aubergine-900 text-white'
                  }`}
                >
                  {tr.to === 'ASSIGNED' && 'Assign Officer'}
                  {tr.to === 'IN_REVIEW' && (ticket.status === 'ESCALATED' ? 'Take Responsibility' : 'Start Review')}
                  {tr.to === 'RESOLVED' && 'Resolve Grievance'}
                  {tr.to === 'ESCALATED' && 'Escalate to Admin'}
                </button>
              ))}

              {isPetitioner && disputeOpen && (
                <button
                  type="button"
                  onClick={() => setIsDisputeOpen(true)}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-marigold-300" />
                  <span>Dispute Resolution</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Official Resolution Callout if applicable */}
        {isResolved && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h4 className="text-sm font-bold text-emerald-950">
                Case Officially Resolved
              </h4>
              <span className="text-xs text-emerald-800">
                ({formatDate(ticket.resolvedAt)})
              </span>
            </div>
            {ticket.resolutionNote && (
              <div className="p-3 bg-white rounded-lg border border-emerald-200 text-xs text-silver-900 whitespace-pre-wrap leading-relaxed font-sans">
                {ticket.resolutionNote}
              </div>
            )}
            {disputeOpen ? (
              <p className="text-[11px] text-emerald-800 font-medium">
                {isPetitioner ? (
                  <>
                    Dispute window closes on <strong>{formatDate(ticket.disputeWindowClosesAt)}</strong> ({disputeHoursLeft}h {disputeMinsLeft}m remaining). If unsatisfied with this resolution, you may submit a dispute to escalate directly to senior administration.
                  </>
                ) : (
                  <>
                    72-hour dispute window is active until <strong>{formatDate(ticket.disputeWindowClosesAt)}</strong> ({disputeHoursLeft}h {disputeMinsLeft}m remaining for petitioner dispute).
                  </>
                )}
              </p>
            ) : (
              <p className="text-[11px] text-silver-500">
                The 72-hour dispute window for this grievance is now closed.
              </p>
            )}
          </div>
        )}

        {/* Escalation Callout if applicable */}
        {ticket.status === 'ESCALATED' && ticket.escalationReason && (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-1 text-xs text-rose-950">
            <div className="flex items-center gap-2 font-bold text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Administrative Escalation Active</span>
            </div>
            <p><strong>Reason:</strong> {ticket.escalationReason}</p>
            <p className="text-[11px] text-rose-800 opacity-90">
              Escalated at {formatDate(ticket.escalatedAt)}
            </p>
          </div>
        )}

        {/* Statement of Facts (Description) */}
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

      {/* Case Discussion / Comments */}
      <div className="bg-white rounded-2xl border border-silver-300 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-aubergine-800" />
            <h3 className="font-bold text-lg text-silver-900">
              Case Messages & Discussion ({comments.length})
            </h3>
          </div>
          <span className="text-xs text-silver-500">
            Immutable dialogue recorded into audit chain
          </span>
        </div>

        <div className="space-y-4">
          {comments.length === 0 ? (
            <div className="py-6 text-center text-xs text-silver-500">
              No comments posted on this case yet.
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
                      {comm.authorName || comm.authorType}
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

        {canComment && (
          <form onSubmit={handleAddComment} className="pt-4 border-t border-silver-200 space-y-3">
            <label htmlFor="auth-comment-body" className="block text-xs font-bold text-silver-800 uppercase tracking-wider">
              Add Investigation Note / Reply
            </label>
            <textarea
              id="auth-comment-body"
              rows={3}
              required
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={4000}
              placeholder="Record official inquiry notes, student responses, or staff directives..."
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
                <span>{submittingComment ? 'Posting...' : 'Post Message'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Cryptographic Audit Trail Visualizer */}
      <AuditChainVisualizer
        timeline={timeline}
        onVerify={handleVerifyAudit}
        verifyResult={verifyResult}
        verifying={verifying}
        canVerify={canVerifyAudit}
      />

      {/* Modals */}
      {isTransitionOpen && (
        <TransitionModal
          isOpen={isTransitionOpen}
          onClose={() => setIsTransitionOpen(false)}
          targetStatus={targetTransition}
          ticket={ticket}
          officers={officers}
          onSubmit={handleTransitionSubmit}
          loading={transitionLoading}
        />
      )}

      {isDisputeOpen && (
        <DisputeModal
          isOpen={isDisputeOpen}
          onClose={() => setIsDisputeOpen(false)}
          ticket={ticket}
          onSubmit={handleDisputeSubmit}
          loading={disputeLoading}
        />
      )}
    </div>
  );
}

