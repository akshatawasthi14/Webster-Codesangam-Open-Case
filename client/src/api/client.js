const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  constructor(status, code, message, details = null, retryAfter = null) {
    super(message || 'An unexpected error occurred');
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
    this.isStaleVersion = code === 'STALE_VERSION' || status === 409;
  }
}

export async function apiRequest(endpoint, {
  method = 'GET',
  body = null,
  headers = {},
  receiptToken = null,
  idempotencyKey = null,
} = {}) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  
  const reqHeaders = { ...headers };

  if (receiptToken) {
    reqHeaders['X-Receipt-Token'] = receiptToken;
  }

  if (idempotencyKey) {
    reqHeaders['Idempotency-Key'] = idempotencyKey;
  }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isFormData && body && !reqHeaders['Content-Type']) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers: reqHeaders,
    body: isFormData ? body : (body ? JSON.stringify(body) : null),
    credentials: 'include',
  });

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  let data = null;
  if (isJson) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorPayload = data && typeof data === 'object' && data.error ? data.error : null;
    const code = errorPayload?.code || (data?.code) || `HTTP_${response.status}`;
    const message = errorPayload?.message || (data?.message) || (typeof data === 'string' ? data : response.statusText);
    const details = errorPayload?.details || data?.details || null;
    
    // Extract Retry-After if rate limited
    const retryHeader = response.headers.get('Retry-After');
    const retryAfter = retryHeader ? Number.parseInt(retryHeader, 10) || null : null;

    throw new ApiError(response.status, code, message, details, retryAfter);
  }

  return data;
}
