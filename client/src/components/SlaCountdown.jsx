import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatDate, formatRelativeTime } from '../utils/formatters.js';

export function SlaCountdown({ dueAt, resolvedAt, status, className = '' }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000); // update every minute
    return () => clearInterval(timer);
  }, []);

  if (!dueAt) return null;

  const dueTime = new Date(dueAt).getTime();
  const isResolved = status === 'RESOLVED';
  const resolveTime = resolvedAt ? new Date(resolvedAt).getTime() : null;

  if (isResolved) {
    const resolvedOnTime = resolveTime && resolveTime <= dueTime;
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
        resolvedOnTime
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-amber-50 text-amber-800 border-amber-200'
      } ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>{resolvedOnTime ? 'Resolved within SLA' : 'Resolved after deadline'}</span>
      </div>
    );
  }

  const diffMs = dueTime - now;
  const isBreached = diffMs < 0;
  const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
  const isUrgent = !isBreached && hoursLeft <= 12;

  let badgeStyle = 'bg-silver-100 text-silver-700 border-silver-300';
  let Icon = Clock;

  if (isBreached) {
    badgeStyle = 'bg-rose-50 text-rose-800 border-rose-300 font-semibold';
    Icon = AlertTriangle;
  } else if (isUrgent) {
    badgeStyle = 'bg-marigold-100 text-marigold-900 border-marigold-400 font-medium';
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${badgeStyle} ${className}`}
      title={`Target SLA Deadline: ${formatDate(dueAt)}`}
    >
      <Icon className={`w-3.5 h-3.5 ${isBreached ? 'animate-bounce text-rose-600' : ''}`} />
      <span>
        {isBreached ? `SLA Breached (${formatRelativeTime(dueAt)})` : `Due: ${formatRelativeTime(dueAt)}`}
      </span>
    </div>
  );
}

