import { apiRequest } from './client.js';

export async function listNotifications({ limit = 30, offset = 0, unreadOnly = false } = {}) {
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit);
  if (offset) params.append('offset', offset);
  if (unreadOnly) params.append('unreadOnly', 'true');

  const queryStr = params.toString();
  return apiRequest(`/notifications${queryStr ? `?${queryStr}` : ''}`);
}

export async function markRead(notificationId) {
  return apiRequest(`/notifications/${notificationId}/read`, {
    method: 'POST',
  });
}

export async function markAllRead() {
  return apiRequest('/notifications/read-all', {
    method: 'POST',
  });
}

export function getSseUrl() {
  const base = import.meta.env.VITE_API_BASE_URL || '/api';
  return `${base}/notifications/stream`;
}
