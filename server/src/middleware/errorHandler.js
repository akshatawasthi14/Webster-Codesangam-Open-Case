import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { removeFiles } from '../utils/files.js';
import { logger } from '../utils/logger.js';
import { zodToAppError } from './validate.js';

export function notFoundHandler(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Route not found'));
}

function toAppError(err) {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return zodToAppError(err);

  // body-parser
  if (err.type === 'entity.too.large') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  if (err.type === 'entity.parse.failed') return new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON');

  if (err.type === 'request.aborted') return new AppError(400, 'REQUEST_ABORTED', 'The request was cancelled before it finished');
  if (err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') {
    return new AppError(415, 'UNSUPPORTED_ENCODING', 'Unsupported content encoding or charset');
  }

  // Data that slipped past validation but the database refuses: a client problem, not a server fault.
  // 22P02 malformed value (e.g. bad UUID), 22001 too long, 22003 out of range, 22021 invalid bytes (e.g. NUL character)
  if (['22P02', '22001', '22003', '22021'].includes(err.code)) {
    return new AppError(400, 'INVALID_INPUT', 'A submitted value is malformed or too large');
  }
  if (err.code === '23505') return new AppError(409, 'DUPLICATE', 'That record already exists');
  if (err.code === '23503') return new AppError(409, 'REFERENCE_INVALID', 'A referenced record does not exist');

  // PostgreSQL / pool pressure -> 503, never a fake success
  const msg = String(err.message || '');
  if (err.code === '57014') return new AppError(503, 'DB_TIMEOUT', 'The database took too long to respond. Please retry.');
  if (err.code === '55P03') return new AppError(503, 'LOCK_TIMEOUT', 'The case is busy. Please retry shortly.');
  if (err.code === '40001' || err.code === '40P01') return new AppError(503, 'DB_RETRY', 'Please retry the request.');
  if (err.code === '53300' || /timeout exceeded when trying to connect/i.test(msg)) {
    return new AppError(503, 'SERVER_BUSY', 'The server is busy. Please retry shortly.');
  }
  if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(err.code) || /^(08|57P|53)/.test(String(err.code))) {
    return new AppError(503, 'DB_UNAVAILABLE', 'The database is unavailable.');
  }
  return new AppError(500, 'INTERNAL_ERROR', 'Something went wrong on our side');
}

// eslint-disable-next-line no-unused-vars
export async function errorHandler(err, req, res, next) {
  const mapped = toAppError(err);
  if (mapped.status >= 500) {
    logger.error('Unhandled error', { route: req.route?.path ?? '(unmatched)', code: err.code, error: err.message, stack: err.stack });
  }

  // Uploaded files are orphaned if the request failed before a ticket took ownership of them.
  // Cleanup finishes BEFORE the response is sent, and a cleanup problem can neither hide the original
  // error nor cause a second response.
  try {
    const failed = await removeFiles(req.files);
    req.files = [];
    for (const f of failed) logger.error('Could not remove orphaned upload', f);
  } catch (cleanupErr) {
    logger.error('Upload cleanup failed', { error: cleanupErr.message });
  }

  if (res.headersSent) return res.end();
  if (mapped.status === 503) res.set('Retry-After', '5');
  res.status(mapped.status).json({
    error: { code: mapped.code, message: mapped.message, ...(mapped.details ? { details: mapped.details } : {}) },
  });
}
