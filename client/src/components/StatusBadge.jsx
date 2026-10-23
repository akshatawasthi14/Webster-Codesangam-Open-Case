import React from 'react';
import { STATUS, STATUS_DETAILS } from '../utils/constants.js';

export function StatusBadge({ status, className = '', showDot = true, size = 'sm' }) {
  const details = STATUS_DETAILS[status] || {
    label: status || 'Unknown',
    color: 'bg-silver-200 text-silver-800 border-silver-400',
    indicator: 'bg-silver-500',
  };

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-xs',
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base font-medium',
  }[size] || 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${details.color} ${sizeClasses} ${className}`}
      title={details.description}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full ${details.indicator} animate-pulse`} />
      )}
      <span>{details.label}</span>
    </span>
  );
}

