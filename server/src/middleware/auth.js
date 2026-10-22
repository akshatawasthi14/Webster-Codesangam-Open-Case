import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { ACTOR } from '../config/constants.js';
import { config } from '../config/index.js';
import { pool, query } from '../db/pool.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, forbidden, unauthorized } from '../utils/errors.js';
import { findTicketByReceipt } from '../services/ticketService.js';
import { isValidReceiptFormat } from '../utils/token.js';

const PgStore = connectPgSimple(session);

/** Database-backed sessions. Only mounted on routes for signed-in users (anonymous routes never touch it). */
export const sessionMiddleware = session({
  store: new PgStore({ pool, tableName: 'session', createTableIfMissing: false }),
  name: 'oc.sid',
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false, // no session row or cookie until someone actually logs in
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.session.cookieSecure,
    maxAge: config.session.ttlMs,
  },
});

/**
 * Blocks cross-site state-changing requests: if the browser sent an Origin header it must be one of ours.
 * (Complements SameSite=Lax cookies. Non-browser clients send no Origin and are unaffected.)
 */
export function originCheck(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('Origin');
  if (origin && !config.clientOrigins.includes(origin)) {
    return next(new AppError(403, 'BAD_ORIGIN', 'Cross-origin request rejected'));
  }
  next();
}

export const userActor = (user) => ({ type: ACTOR.USER, id: user.id, role: user.role, name: user.name });

/** Loads the signed-in user fresh from the database on each request, so role changes apply immediately. */
export const requireAuth = asyncHandler(async (req, res, next) => {
  const userId = req.session?.userId;
  if (!userId) throw unauthorized();
  const { rows } = await query('SELECT id, name, email, role FROM users WHERE id = $1', [userId]);
  if (!rows[0]) {
    await new Promise((resolve) => req.session.destroy(resolve));
    throw unauthorized();
  }
  req.user = rows[0];
  req.actor = userActor(rows[0]);
  next();
});

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(forbidden());

/**
 * Anonymous petitioner access: the receipt token travels in the X-Receipt-Token header (never in a URL,
 * so it cannot leak into logs or history). Only its SHA-256 hash is looked up.
 */
export const requireReceipt = asyncHandler(async (req, res, next) => {
  const token = req.get('X-Receipt-Token');
  if (!isValidReceiptFormat(token)) throw unauthorized('A valid receipt token is required', 'INVALID_RECEIPT');
  const ticketId = await findTicketByReceipt(token);
  if (!ticketId) throw unauthorized('A valid receipt token is required', 'INVALID_RECEIPT');
  req.actor = { type: ACTOR.ANON, ticketId };
  next();
});
