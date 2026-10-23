import React from 'react';
import { PRIORITY_DETAILS } from '../utils/constants.js';

export function PriorityBadge({ priority, className = '', showSla = false, size = 'sm' }) {
  const details = PRIORITY_DETAILS[priority] || {
    label: priority || 'Medium',
    defaultSla: '72h',
    color: 'bg-silver-100 text-silver-700 border-silver-300',
    dot: 'bg-silver-400',
  };

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-xs',
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  }[size] || 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${details.color} ${sizeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${details.dot}`} />
      <span>{details.label}</span>
      {showSla && (
        <span className="opacity-70 text-[10px] uppercase font-mono ml-0.5">
          ({details.defaultSla})
        </span>
      )}
    </span>
  );
}

