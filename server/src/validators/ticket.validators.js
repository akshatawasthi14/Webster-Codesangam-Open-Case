import { z } from 'zod';
import { CATEGORIES, PRIORITIES, STATUS } from '../config/constants.js';
import { badRequest } from '../utils/errors.js';

// Multipart fields arrive as strings, which is exactly what these schemas expect.
export const createTicketBody = z.object({
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(5000),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
});

const version = z.number().int().positive();

export const transitionBody = z.object({
  to: z.enum(Object.values(STATUS)),
  version,
  assigneeId: z.string().uuid().optional(),
  note: z.string().trim().max(5000).optional(),
  reason: z.string().trim().max(2000).optional(),
});

export const disputeBody = z.object({
  version,
  reason: z.string().trim().min(5).max(2000),
});

export const commentBody = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const listQuery = z.object({
  status: z.enum(Object.values(STATUS)).optional(),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const IDEMPOTENCY_FORMAT = /^[A-Za-z0-9_-]{1,128}$/;

/** Reads the optional Idempotency-Key header (use a random UUID per filing attempt). */
export function readIdempotencyKey(req, { minLength = 16 } = {}) {
  const raw = req.get('Idempotency-Key');
  if (raw === undefined) return null;
  if (!IDEMPOTENCY_FORMAT.test(raw) || raw.length < minLength) {
    throw badRequest(`Idempotency-Key must be ${minLength}-128 characters of letters, digits, "-" or "_" (a random UUID works)`);
  }
  return raw;
}
