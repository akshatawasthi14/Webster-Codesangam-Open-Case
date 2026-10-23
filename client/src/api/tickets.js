import { apiRequest } from './client.js';

export async function listTickets({ status, category, priority, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (category) params.append('category', category);
  if (priority) params.append('priority', priority);
  if (page) params.append('page', page);
  if (limit) params.append('limit', limit);

  const queryStr = params.toString();
  return apiRequest(`/tickets${queryStr ? `?${queryStr}` : ''}`);
}

export async function getTicket(id) {
  return apiRequest(`/tickets/${id}`);
}

export async function createTicket(formData, idempotencyKey = null) {
  return apiRequest('/tickets', {
    method: 'POST',
    body: formData,
    idempotencyKey,
  });
}

export async function createAnonymousTicket(formData, idempotencyKey = null) {
  return apiRequest('/anonymous/tickets', {
    method: 'POST',
    body: formData,
    idempotencyKey,
  });
}

export async function getAnonymousCase(receiptToken) {
  return apiRequest('/anonymous/case', {
    method: 'GET',
    receiptToken,
  });
}

export async function addComment(ticketId, body) {
  return apiRequest(`/tickets/${ticketId}/comments`, {
    method: 'POST',
    body: { body },
  });
}

export async function addAnonymousComment(receiptToken, body) {
  return apiRequest('/anonymous/case/comments', {
    method: 'POST',
    body: { body },
    receiptToken,
  });
}

export async function transitionTicket(ticketId, { to, version, assigneeId, note, reason }) {
  return apiRequest(`/tickets/${ticketId}/transitions`, {
    method: 'POST',
    body: { to, version, assigneeId, note, reason },
  });
}

export async function disputeAnonymousTicket(receiptToken, { version, reason }) {
  return apiRequest('/anonymous/case/dispute', {
    method: 'POST',
    body: { version, reason },
    receiptToken,
  });
}

export async function verifyAudit(ticketId) {
  return apiRequest(`/tickets/${ticketId}/audit/verify`);
}

export async function verifyAnonymousAudit(receiptToken) {
  return apiRequest('/anonymous/case/audit/verify', {
    method: 'GET',
    receiptToken,
  });
}

export async function downloadAttachmentFile({ ticketId, attachmentId, fileName, receiptToken = null }) {
  const base = import.meta.env.VITE_API_BASE_URL || '/api';
  const endpoint = receiptToken
    ? `${base}/anonymous/case/attachments/${attachmentId}`
    : `${base}/tickets/${ticketId}/attachments/${attachmentId}`;

  const headers = {};
  if (receiptToken) {
    headers['X-Receipt-Token'] = receiptToken;
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to download attachment (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName || 'attachment';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}
