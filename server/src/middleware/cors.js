import { config } from '../config/index.js';

const ALLOWED_HEADERS = 'Content-Type, Idempotency-Key, X-Receipt-Token';

/**
 * Minimal CORS for the React dev server (a different origin from the API). Only origins listed in
 * CLIENT_ORIGIN get headers; everything else is left alone (and non-GET requests are still rejected by originCheck).
 */
export function cors(req, res, next) {
  const origin = req.get('Origin');
  if (!origin || !config.clientOrigins.includes(origin)) return next();

  res.vary('Origin');
  res.set({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'Retry-After, Content-Disposition',
  });
  if (req.method === 'OPTIONS') {
    res.set({
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': ALLOWED_HEADERS,
      'Access-Control-Max-Age': '600',
    });
    return res.status(204).end();
  }
  next();
}
