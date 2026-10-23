import React, { useState } from 'react';
import {
  FilePlus2,
  ShieldAlert,
  UserCheck,
  UserX,
  Upload,
  X,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { createTicket, createAnonymousTicket } from '../api/tickets.js';
import { ReceiptModal } from '../components/ReceiptModal.jsx';
import { CATEGORIES, CATEGORY_DETAILS, PRIORITIES, PRIORITY_DETAILS } from '../utils/constants.js';
import { formatBytes, generateUUID } from '../utils/formatters.js';
import { validateFileMagicBytes } from '../utils/fileValidation.js';

export function FileTicketPage({ onNavigate }) {
  const { isAuthenticated, isStudent, user } = useAuth();

  // If not authenticated, default to anonymous filing
  const [isAnonymous, setIsAnonymous] = useState(!isAuthenticated);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priority, setPriority] = useState('MEDIUM');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Receipt modal state
  const [receiptData, setReceiptData] = useState(null);

  const handleFileChange = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (files.length + selected.length > 5) {
      setError('You may upload at most 5 attachments per ticket.');
      return;
    }

    const validFiles = [];
    for (const file of selected) {
      const validation = await validateFileMagicBytes(file);
      if (!validation.valid) {
        setError(validation.error);
        return;
      }
      validFiles.push(file);
    }

    setError('');
    setFiles((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (title.trim().length < 5) {
      setError('Title must be at least 5 characters long.');
      return;
    }
    if (description.trim().length < 10) {
      setError('Description must be at least 10 characters long.');
      return;
    }

    if (!isAnonymous && !isAuthenticated) {
      setError('You must sign in to submit a named grievance.');
      return;
    }

    if (!isAnonymous && !isStudent) {
      setError('Only enrolled students may file official named grievances. Officers and Admins evaluate them.');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('category', category);
      formData.append('priority', priority);

      files.forEach((file) => {
        formData.append('attachments', file);
      });

      const idempotencyKey = generateUUID();

      if (isAnonymous) {
        const result = await createAnonymousTicket(formData, idempotencyKey);
        setReceiptData({
          receiptToken: result.receiptToken,
          ticketId: result.ticketId,
          dueAt: result.dueAt,
        });
      } else {
        const result = await createTicket(formData, idempotencyKey);
        onNavigate(`/tickets/${result.ticketId}`);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit grievance. Please verify details and retry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-aubergine-900 tracking-tight">
          File a Grievance
        </h1>
        <p className="text-sm text-silver-600 mt-1">
          Submit your petition for official institutional investigation and resolution.
        </p>
      </div>

      {/* Submission Mode Selector */}
      <div className="bg-white rounded-2xl border border-silver-300 p-2 shadow-sm mb-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setIsAnonymous(false)}
          className={`flex items-start gap-3 p-4 rounded-xl text-left transition-all ${
            !isAnonymous
              ? 'bg-aubergine-800 text-white shadow-md'
              : 'hover:bg-silver-50 text-silver-800'
          }`}
        >
          <div className={`p-2 rounded-lg ${!isAnonymous ? 'bg-aubergine-700 text-marigold-400' : 'bg-silver-100 text-silver-600'}`}>
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">Named Petition</span>
              {!isAnonymous && (
                <span className="text-[10px] bg-marigold-500 text-aubergine-950 font-bold px-1.5 py-0.2 rounded">
                  Selected
                </span>
              )}
            </div>
            <p className={`text-xs mt-0.5 leading-relaxed ${!isAnonymous ? 'text-silver-300' : 'text-silver-500'}`}>
              Linked to your verified student account. Receive direct in-app notifications and officer updates.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setIsAnonymous(true)}
          className={`flex items-start gap-3 p-4 rounded-xl text-left transition-all ${
            isAnonymous
              ? 'bg-aubergine-800 text-white shadow-md'
              : 'hover:bg-silver-50 text-silver-800'
          }`}
        >
          <div className={`p-2 rounded-lg ${isAnonymous ? 'bg-aubergine-700 text-marigold-400' : 'bg-silver-100 text-silver-600'}`}>
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">Anonymous Petition</span>
              {isAnonymous && (
                <span className="text-[10px] bg-marigold-500 text-aubergine-950 font-bold px-1.5 py-0.2 rounded">
                  Selected
                </span>
              )}
            </div>
            <p className={`text-xs mt-0.5 leading-relaxed ${isAnonymous ? 'text-silver-300' : 'text-silver-500'}`}>
              Zero account link, no IP or identity logged. Track with an unrecoverable 256-bit secret receipt token.
            </p>
          </div>
        </button>
      </div>

      {!isAnonymous && !isAuthenticated && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <span>You need to be signed in as a student to file a named grievance.</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg whitespace-nowrap"
          >
            Sign In Now
          </button>
        </div>
      )}

      {/* Main Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-silver-300 p-6 sm:p-8 shadow-sm space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="ticket-title" className="block text-xs font-bold text-silver-800 uppercase tracking-wider">
            Grievance Summary / Title <span className="text-rose-600">*</span>
          </label>
          <input
            id="ticket-title"
            type="text"
            required
            minLength={5}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Unfair grading in EE302 midterm or Broken laboratory equipment..."
            className="w-full px-4 py-2.5 text-sm bg-silver-50 border border-silver-300 rounded-xl focus:border-marigold-500 focus:bg-white focus:ring-1 focus:ring-marigold-500 text-silver-900 transition-colors"
          />
          <span className="text-[11px] text-silver-500">{title.length}/200 characters</span>
        </div>

        {/* Category & Priority Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Category */}
          <div className="space-y-1.5">
            <label htmlFor="ticket-category" className="block text-xs font-bold text-silver-800 uppercase tracking-wider">
              Category <span className="text-rose-600">*</span>
            </label>
            <select
              id="ticket-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-silver-50 border border-silver-300 rounded-xl focus:border-marigold-500 focus:bg-white focus:ring-1 focus:ring-marigold-500 text-silver-900"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_DETAILS[cat]?.label || cat}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label htmlFor="ticket-priority" className="block text-xs font-bold text-silver-800 uppercase tracking-wider">
              Priority & SLA Target <span className="text-rose-600">*</span>
            </label>
            <select
              id="ticket-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-silver-50 border border-silver-300 rounded-xl focus:border-marigold-500 focus:bg-white focus:ring-1 focus:ring-marigold-500 text-silver-900"
            >
              {PRIORITIES.map((p) => {
                const info = PRIORITY_DETAILS[p];
                return (
                  <option key={p} value={p}>
                    {info.label} — SLA target: {info.defaultSla}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label htmlFor="ticket-desc" className="block text-xs font-bold text-silver-800 uppercase tracking-wider">
            Detailed Statement of Facts <span className="text-rose-600">*</span>
          </label>
          <textarea
            id="ticket-desc"
            rows={6}
            required
            minLength={10}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide specific details: dates, locations, persons involved, previous attempts at resolution, and desired outcome..."
            className="w-full px-4 py-3 text-sm bg-silver-50 border border-silver-300 rounded-xl focus:border-marigold-500 focus:bg-white focus:ring-1 focus:ring-marigold-500 text-silver-900 transition-colors resize-y"
          />
          <span className="text-[11px] text-silver-500">{description.length}/5000 characters</span>
        </div>

        {/* Attachments Upload */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-silver-800 uppercase tracking-wider">
            Supporting Evidence / Attachments (Optional)
          </label>
          <div className="border-2 border-dashed border-silver-300 hover:border-marigold-500 rounded-xl p-6 text-center bg-silver-50/50 transition-colors cursor-pointer relative">
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              accept=".pdf,.png,.jpg,.jpeg,.txt"
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <Upload className="w-8 h-8 text-silver-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-silver-800">
              Click or drag files here to upload evidence
            </p>
            <p className="text-[11px] text-silver-500 mt-1">
              PDF, PNG, JPEG, or TXT up to 5MB each (Max 5 files). Hashes are committed to the cryptographic audit chain.
            </p>
          </div>

          {/* Uploaded file chips */}
          {files.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-silver-700">
                Selected Files ({files.length}/5):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {files.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 bg-silver-100 rounded-lg border border-silver-200 text-xs text-silver-800"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-aubergine-700 flex-shrink-0" />
                      <span className="truncate font-medium">{file.name}</span>
                      <span className="text-[10px] text-silver-500 font-mono">
                        ({formatBytes(file.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-silver-400 hover:text-rose-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-silver-200 flex items-center justify-between">
          <div className="text-xs text-silver-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-marigold-600" />
            <span>Target SLA: {PRIORITY_DETAILS[priority]?.defaultSla}</span>
          </div>

          <button
            type="submit"
            disabled={submitting || (!isAnonymous && !isAuthenticated)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-aubergine-800 hover:bg-aubergine-900 active:bg-aubergine-950 text-white font-bold text-sm transition-all shadow-md disabled:opacity-50"
          >
            <FilePlus2 className="w-4 h-4 text-marigold-400" />
            <span>{submitting ? 'Creating Case & Hash Chain...' : isAnonymous ? 'File Anonymously' : 'Submit Official Grievance'}</span>
          </button>
        </div>
      </form>

      {/* Secret Receipt Token Modal on Anonymous Success */}
      {receiptData && (
        <ReceiptModal
          isOpen={Boolean(receiptData)}
          onClose={() => setReceiptData(null)}
          receiptToken={receiptData.receiptToken}
          ticketId={receiptData.ticketId}
          dueAt={receiptData.dueAt}
          onNavigateToTrack={(token) => onNavigate(`/track?token=${encodeURIComponent(token)}`)}
        />
      )}
    </div>
  );
}

