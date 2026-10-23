import React, { useEffect } from 'react';
import { Bell, X, ArrowRight } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext.jsx';

export function LiveNotificationToast({ onSelectTicket }) {
  const { lastReceived, clearToast } = useNotifications();

  useEffect(() => {
    if (lastReceived) {
      const timer = setTimeout(() => {
        clearToast();
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [lastReceived, clearToast]);

  if (!lastReceived) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-aubergine-900 text-white rounded-xl shadow-2xl border border-marigold-400/50 p-4 animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-marigold-500 text-aubergine-950 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bell className="w-4 h-4 animate-bounce" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-marigold-400">
              Live Notification
            </span>
            <button
              type="button"
              onClick={clearToast}
              className="text-silver-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-silver-100 mt-1 font-medium leading-relaxed">
            {lastReceived.message}
          </p>
          {lastReceived.ticketId && onSelectTicket && (
            <button
              type="button"
              onClick={() => {
                onSelectTicket(lastReceived.ticketId);
                clearToast();
              }}
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-marigold-300 hover:text-marigold-200 font-semibold"
            >
              <span>Open Case #{lastReceived.ticketId.slice(0, 8)}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

