import React, { useState, useEffect } from 'react';
import { X, ArrowRight, AlertCircle } from 'lucide-react';
import { STATUS_DETAILS } from '../utils/constants.js';

export function TransitionModal({
  isOpen,
  onClose,
  targetStatus,
  ticket,
  officers = [],
  onSubmit,
  loading = false,
}) {
  const [assigneeId, setAssigneeId] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAssigneeId(ticket?.assignee?.id || (officers.length > 0 ? officers[0].id : ''));
      setNote('');
      setReason('');
      setValidationError('');
    }
  }, [isOpen, targetStatus, ticket, officers]);

  if (!isOpen || !targetStatus) return null;

  const targetInfo = STATUS_DETAILS[targetStatus] || { label: targetStatus, description: '' };

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    if (targetStatus === 'ASSIGNED' && !assigneeId) {
      setValidationError('Please select a grievance officer to assign this case.');
      return;
    }

    if (targetStatus === 'RESOLVED' && !note.trim()) {
      setValidationError('A comprehensive resolution note is mandatory before marking a grievance as resolved.');
      return;
    }

    if (targetStatus === 'ESCALATED' && reason.trim().length < 5) {
      setValidationError('Please provide a specific reason for escalation (at least 5 characters).');
      return;
    }

    onSubmit({
      to: targetStatus,
      version: ticket.version,
      assigneeId: targetStatus === 'ASSIGNED' ? assigneeId : undefined,
      note: targetStatus === 'RESOLVED' ? note.trim() : undefined,
      reason: targetStatus === 'ESCALATED' ? reason.trim() : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aubergine-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transition-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-silver-300 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-aubergine-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 id="transition-modal-title" className="font-semibold text-lg text-silver-100">
              Advance Case Status
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-silver-300 hover:text-white rounded-lg p-1 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transition Summary Bar */}
        <div className="bg-silver-100 px-6 py-3 border-b border-silver-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-silver-600 font-medium">Current Status:</span>
            <span className="font-bold text-silver-900">{ticket.status}</span>
          </div>
          <ArrowRight className="w-4 h-4 text-silver-400" />
          <div className="flex items-center gap-2">
            <span className="text-silver-600 font-medium">New Status:</span>
            <span className="font-bold text-aubergine-800 bg-aubergine-50 px-2 py-0.5 rounded border border-aubergine-200">
              {targetInfo.label}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Form fields based on target status */}
          {targetStatus === 'ASSIGNED' && (
            <div className="space-y-1.5">
              <label htmlFor="assignee-select" className="block text-xs font-semibold text-silver-800 uppercase tracking-wider">
                Select Grievance Officer <span className="text-rose-600">*</span>
              </label>
              <select
                id="assignee-select"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-silver-300 rounded-lg focus:border-marigold-500 focus:ring-1 focus:ring-marigold-500 text-silver-900"
              >
                <option value="" disabled>-- Select an officer --</option>
                {officers.map((off) => (
                  <option key={off.id} value={off.id}>
                    {off.name} ({off.email || 'Officer'})
                  </option>
                ))}
              </select>
              <p className="text-xs text-silver-500">
                The designated officer will receive responsibility and be notified immediately.
              </p>
            </div>
          )}

          {targetStatus === 'RESOLVED' && (
            <div className="space-y-1.5">
              <label htmlFor="resolution-note" className="block text-xs font-semibold text-silver-800 uppercase tracking-wider">
                Official Resolution Note <span className="text-rose-600">*</span>
              </label>
              <textarea
                id="resolution-note"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                maxLength={5000}
                placeholder="Explain the findings, actions taken, corrective measures, and conclusion of this grievance redressal..."
                className="w-full px-3 py-2 text-sm bg-white border border-silver-300 rounded-lg focus:border-marigold-500 focus:ring-1 focus:ring-marigold-500 text-silver-900 resize-y"
              />
              <p className="text-xs text-silver-500">
                Mandatory by server policy. This note will be recorded into the cryptographic audit trail and visible to the petitioner.
              </p>
            </div>
          )}

          {targetStatus === 'ESCALATED' && (
            <div className="space-y-1.5">
              <label htmlFor="escalation-reason" className="block text-xs font-semibold text-silver-800 uppercase tracking-wider">
                Reason for Administrative Escalation <span className="text-rose-600">*</span>
              </label>
              <textarea
                id="escalation-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                maxLength={2000}
                placeholder="Specify why administrative intervention is required (e.g., policy conflict, critical severity, officer escalation)..."
                className="w-full px-3 py-2 text-sm bg-white border border-silver-300 rounded-lg focus:border-marigold-500 focus:ring-1 focus:ring-marigold-500 text-silver-900 resize-y"
              />
              <p className="text-xs text-silver-500">
                Server enforces a non-empty reason for all manual escalations.
              </p>
            </div>
          )}

          {targetStatus === 'IN_REVIEW' && (
            <div className="p-4 bg-marigold-50 border border-marigold-200 rounded-lg text-xs text-marigold-950 space-y-1">
              <p className="font-semibold">Review Commitment</p>
              <p className="text-marigold-900">
                {ticket.status === 'ESCALATED'
                  ? 'As an Administrator, moving this escalated grievance to In Review assigns responsibility to you and resets the SLA countdown window.'
                  : 'Commencing review confirms that you have taken charge of evaluating and redressing this petition.'}
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-silver-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-silver-700 hover:text-silver-900 hover:bg-silver-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-aubergine-800 hover:bg-aubergine-900 text-white shadow-sm transition-all disabled:opacity-50"
            >
              {loading ? 'Processing...' : `Confirm: Move to ${targetInfo.label}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

