import React, { useState } from 'react';
import { ShieldCheck, Copy, Check, Download, ArrowRight, AlertTriangle, Key } from 'lucide-react';
import { formatDate } from '../utils/formatters.js';

export function ReceiptModal({
  isOpen,
  onClose,
  receiptToken,
  ticketId,
  dueAt,
  onNavigateToTrack,
}) {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [rememberLocal, setRememberLocal] = useState(true);

  if (!isOpen || !receiptToken) return null;

  const handleCopyToken = () => {
    navigator.clipboard.writeText(receiptToken);
    setCopiedToken(true);
    setHasSaved(true);
    setTimeout(() => setCopiedToken(false), 2500);
  };

  const handleCopyTicketId = () => {
    if (!ticketId) return;
    navigator.clipboard.writeText(ticketId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleDownloadTxt = () => {
    const textContent = `OPEN CASE - ANONYMOUS PETITION RECEIPT
==================================================
Date Filed: ${new Date().toUTCString()}
Complaint ID: ${ticketId || 'N/A'}
SLA Resolution Due: ${formatDate(dueAt)}

YOUR SECRET RECEIPT TOKEN:
${receiptToken}

==================================================
IMPORTANT PRIVACY NOTICE:
This token is your ONLY proof of ownership for this grievance.
The platform does not know who you are and stores only a one-way
SHA-256 cryptographic hash of this token. No IP or account is linked.

If you lose this token, you will NOT be able to track your case,
view officer comments, or verify the audit trail.
`;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `open-case-receipt-${ticketId ? ticketId.slice(0, 8) : 'anonymous'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setHasSaved(true);
  };

  const handleProceed = () => {
    if (rememberLocal) {
      try {
        localStorage.setItem('opencase_saved_receipt', receiptToken);
      } catch (e) {
        console.warn('localStorage not accessible:', e);
      }
    }
    onClose();
    if (onNavigateToTrack) onNavigateToTrack(receiptToken);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aubergine-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-marigold-300 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Banner */}
        <div className="bg-aubergine-800 text-white px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-marigold-500/20 border border-marigold-400 flex items-center justify-center text-marigold-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 id="receipt-modal-title" className="font-bold text-lg text-white">
              Anonymous Grievance Filed
            </h2>
            <p className="text-xs text-silver-300">
              Cryptographic Receipt Generated · Zero Account Association
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Critical Warning */}
          <div className="p-4 bg-amber-50 border-l-4 border-marigold-500 rounded-r-lg text-xs text-amber-950 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-marigold-600 flex-shrink-0" />
              <span>Shown Once Only · Irrecoverable if Lost</span>
            </div>
            <p className="text-amber-800">
              Open Case stores strictly the <strong>SHA-256 digest</strong> of this receipt token. If you leave this page without copying or downloading it, you will never be able to access or follow up on this grievance.
            </p>
          </div>

          {/* Secret Receipt Token Display */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-aubergine-900 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-marigold-600" />
                <span>Secret Receipt Token (Your Private Access Key)</span>
              </span>
              <span className="text-[10px] font-mono text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded">
                43 Characters
              </span>
            </div>
            <div className="p-3 bg-aubergine-950 border-2 border-marigold-500/70 rounded-xl font-mono text-sm break-all select-all flex items-center justify-between gap-3 text-marigold-300 font-bold shadow-inner">
              <span className="tracking-wide select-all">{receiptToken}</span>
              <button
                type="button"
                onClick={handleCopyToken}
                className="flex-shrink-0 px-3 py-1.5 text-aubergine-950 bg-marigold-400 hover:bg-marigold-300 rounded-lg transition-colors flex items-center gap-1 text-xs font-sans font-bold shadow-sm"
                title="Copy Secret Receipt Token"
              >
                {copiedToken ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-800" />
                    <span className="text-emerald-950 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Token</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-silver-600">
              Use this exact secret token on the <strong>Track Grievance</strong> page to monitor responses and audit trails.
            </p>
          </div>

          {/* Safe retention checkbox */}
          <div className="bg-silver-50 p-3 rounded-xl border border-silver-200 space-y-2 text-xs">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberLocal}
                onChange={(e) => setRememberLocal(e.target.checked)}
                className="mt-0.5 rounded border-silver-300 text-aubergine-800 focus:ring-marigold-500"
              />
              <span className="text-silver-700">
                <strong>Remember token on this browser:</strong> Automatically prefill this token on the tracking page for quick lookup on this device.
              </span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1 border-t border-silver-200">
              <input
                type="checkbox"
                checked={hasSaved}
                onChange={(e) => setHasSaved(e.target.checked)}
                className="mt-0.5 rounded border-silver-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-silver-800 font-medium">
                I confirm that I have safely copied or downloaded my receipt token.
              </span>
            </label>
          </div>

          {/* Complaint Reference Information */}
          {ticketId && (
            <div className="p-3 bg-silver-50 rounded-xl border border-silver-200 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-silver-500 font-bold uppercase text-[10px] tracking-wider block">
                    Complaint ID (Public Reference):
                  </span>
                  <span className="font-mono font-bold text-aubergine-950 select-all">
                    {ticketId}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyTicketId}
                  className="px-2.5 py-1 text-xs font-sans font-semibold text-aubergine-800 bg-white border border-silver-300 hover:bg-silver-100 rounded-lg flex items-center gap-1 transition-colors"
                  title="Copy Complaint ID"
                >
                  {copiedId ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy ID</span>
                    </>
                  )}
                </button>
              </div>
              <div className="pt-2 border-t border-silver-200 flex items-center justify-between text-[11px]">
                <span className="text-silver-500 font-medium">SLA Resolution Target:</span>
                <span className="font-semibold text-silver-900">{formatDate(dueAt)}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-silver-400 bg-white hover:bg-silver-100 text-silver-800 text-xs font-semibold transition-colors shadow-sm"
            >
              <Download className="w-4 h-4 text-silver-600" />
              <span>Download Receipt File (.txt)</span>
            </button>

            <button
              type="button"
              onClick={handleProceed}
              disabled={!hasSaved}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-aubergine-800 hover:bg-aubergine-900 active:bg-aubergine-950 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
            >
              <span>Track This Case Now</span>
              <ArrowRight className="w-4 h-4 text-marigold-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
