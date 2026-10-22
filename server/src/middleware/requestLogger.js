import { logger } from '../utils/logger.js';

/**
 * Logs method, ROUTE PATTERN, status and duration only. It deliberately never records IP addresses,
 * user-agent strings, URLs with ids/tokens, headers or bodies (anonymous filing guarantee).
 */
export function requestLogger(req, res, next) {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : '(unmatched)';
    logger.info('request', { method: req.method, route, status: res.statusCode, ms: Math.round(ms) });
  });
  next();
}
