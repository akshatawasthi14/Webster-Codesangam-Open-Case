import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, Clock, ExternalLink } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext.jsx';
import { formatRelativeTime } from '../utils/formatters.js';

export function NotificationDropdown({ onSelectTicket }) {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = (notif) => {
    if (!notif.read) {
      markRead(notif.id);
    }
    if (notif.ticketId && onSelectTicket) {
      onSelectTicket(notif.ticketId);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-aubergine-950 hover:text-marigold-600 hover:bg-aubergine-900/10 transition-colors focus:outline-none"
        aria-label="Notifications"
        title="View Notifications"
      >
        <Bell className="w-5 h-5 stroke-[2.2] text-aubergine-950 hover:text-marigold-600 transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-extrabold bg-marigold-500 text-aubergine-950 rounded-full border-2 border-[#EBEAE5] shadow-sm animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-silver-300 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="bg-aubergine-800 px-4 py-3 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-silver-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-marigold-500 text-aubergine-950 rounded">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-marigold-300 hover:text-marigold-100 flex items-center gap-1 font-medium transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-silver-200">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-silver-500 text-xs">
                No notifications right now.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-3.5 hover:bg-silver-50 cursor-pointer transition-colors flex items-start gap-3 ${
                    notif.read ? 'opacity-70 bg-white' : 'bg-silver-50/80 font-medium'
                  }`}
                >
                  <div className="pt-1">
                    <span
                      className={`block w-2 h-2 rounded-full ${
                        notif.read ? 'bg-silver-300' : 'bg-marigold-500'
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-silver-900 leading-snug break-words">
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-silver-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatRelativeTime(notif.createdAt)}</span>
                      {notif.ticketId && (
                        <span className="text-aubergine-700 font-mono">
                          #{notif.ticketId.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  </div>

                  {!notif.read && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead(notif.id);
                      }}
                      className="p-1 text-silver-400 hover:text-silver-700 rounded"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

