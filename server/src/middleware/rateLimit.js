import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import { AppError } from '../utils/errors.js';

// Counters live in process memory only (never persisted), so rate limiting does not store IPs on disk.
const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please slow down')),
};

export const globalLimiter = rateLimit({ ...base, windowMs: 60_000, limit: config.rateLimit.globalPerMin });

// Brute-force protection for login/registration (successful logins do not count).
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: config.rateLimit.authPer15Min,
  skipSuccessfulRequests: true,
});

export const anonymousFilingLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: config.rateLimit.anonFilingPerHour,
});

// Makes guessing receipt tokens impractical (they are 256-bit anyway).
export const receiptLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: config.rateLimit.receiptPer15Min });
