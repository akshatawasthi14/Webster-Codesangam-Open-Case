import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

export function DisputeModal({ isOpen, onClose, ticket, onSubmit, loading = false }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setError('Please provide a meaningful explanation for disputing the resolution (at least 5 characters).');
      return;
    }
    onSubmit({
      version: ticket.version,
      reason: reason.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aubergine-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispute-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-silver-300 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-rose-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-marigold-400" />
            <h2 id="dispute-modal-title" className="font-semibold text-lg text-white">
              Dispute Case Resolution
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-rose-200 hover:text-white rounded-lg p-1 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1">
            <p className="font-bold">What happens when you dispute?</p>
            <p>
              Your grievance will be escalated directly to the Senior Administration for reconsideration. The officer's resolution will be audited, and the escalation will be permanently recorded in the cryptographic audit trail.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-100 border border-rose-300 text-rose-900 text-xs rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="dispute-reason" className="block text-xs font-semibold text-silver-800 uppercase tracking-wider">
                Reason for Dispute <span className="text-rose-600">*</span>
              </label>
              <textarea
                id="dispute-reason"
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                maxLength={2000}
                placeholder="Explain why the current resolution is unsatisfactory or what aspects were overlooked..."
                className="w-full px-3 py-2 text-sm bg-white border border-silver-300 rounded-lg focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-silver-900 resize-y"
              />
              <span className="text-xs text-silver-500">
                Disputes are valid within 72 hours of the resolution decision.
              </span>
            </div>

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
                className="px-5 py-2 text-xs font-bold rounded-lg bg-rose-700 hover:bg-rose-800 text-white shadow-sm transition-all disabled:opacity-50"
              >
                {loading ? 'Submitting Dispute...' : 'Confirm Dispute & Escalate'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

