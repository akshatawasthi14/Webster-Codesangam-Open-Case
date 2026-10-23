import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';
import * as notifApi from '../api/notifications.js';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastReceived, setLastReceived] = useState(null);
  const eventSourceRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    try {
      const data = await notifApi.listNotifications({ limit: 30 });
      setNotifications(data.items || []);
      setUnreadCount(Number(data.unreadCount) || 0);
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications();

    const sseUrl = notifApi.getSseUrl();
    let es;
    try {
      es = new EventSource(sseUrl, { withCredentials: true });
      eventSourceRef.current = es;

      es.addEventListener('notification', (event) => {
        try {
          const item = JSON.parse(event.data);
          setNotifications((prev) => [item, ...prev.filter((p) => p.id !== item.id)]);
          setUnreadCount((c) => c + 1);
          setLastReceived(item);
        } catch (e) {
          console.error('Failed to parse SSE notification:', e);
        }
      });

      es.onerror = (err) => {
        console.warn('SSE notification stream error (retrying automatically):', err);
      };
    } catch (e) {
      console.error('EventSource initialization failed:', e);
    }

    return () => {
      if (es) {
        es.close();
      }
      if (eventSourceRef.current === es) {
        eventSourceRef.current = null;
      }
    };
  }, [isAuthenticated, user?.id, fetchNotifications]);

  const markRead = async (id) => {
    try {
      await notifApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await notifApi.markAllRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const clearToast = () => setLastReceived(null);

  const value = {
    notifications,
    unreadCount,
    loading,
    lastReceived,
    clearToast,
    fetchNotifications,
    markRead,
    markAllRead,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

