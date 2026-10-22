import { ACTOR, SLA_ACTIVE_STATUSES, STATUS } from '../config/constants.js';
import { config } from '../config/index.js';
import { pool } from '../db/pool.js';
import { transitionTicket } from '../services/ticketService.js';
import { logger } from '../utils/logger.js';

const SYSTEM = Object.freeze({ type: ACTOR.SYSTEM });
const EXPECTED_SKIPS = new Set(['INVALID_TRANSITION', 'SLA_NOT_BREACHED']);

/**
 * One run of the deadline job: finds a small batch of overdue, still-active tickets and escalates each
 * through the SAME validated transition logic as human users, in its OWN short transaction.
 *
 *  - Resumable: all state lives in the database; a restart just runs the next cycle.
 *  - Idempotent: the row is locked and re-validated inside the transaction (SKIP LOCKED), so a ticket that is
 *    already ESCALATED (or being changed by someone else) is skipped. Repeated runs never escalate twice.
 *  - One slow/failing ticket never blocks the rest of the batch.
 */
export async function runSlaCycle({ batchSize = config.sla.batchSize } = {}) {
  const { rows } = await pool.query(
    `SELECT id FROM tickets
     WHERE status = ANY($1::text[]) AND due_at < NOW()
     ORDER BY due_at LIMIT $2`,
    [SLA_ACTIVE_STATUSES, batchSize],
  );

  const result = { candidates: rows.length, escalated: 0, skipped: 0, failed: 0 };
  for (const { id } of rows) {
    try {
      const out = await transitionTicket({ ticketId: id, actor: SYSTEM, to: STATUS.ESCALATED, skipLocked: true });
      if (out) result.escalated += 1;
      else result.skipped += 1; // busy or gone
    } catch (err) {
      if (EXPECTED_SKIPS.has(err.code)) result.skipped += 1;
      else {
        result.failed += 1;
        logger.error('SLA escalation failed', { ticketId: id, code: err.code, error: err.message });
      }
    }
  }
  if (result.candidates) logger.info('SLA cycle finished', result);
  return result;
}

/** Starts the recurring job. Runs never overlap. Returns a stop() function. */
export function startSlaJob() {
  if (!config.sla.enabled) {
    logger.info('SLA job disabled');
    return () => {};
  }
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runSlaCycle();
    } catch (err) {
      logger.error('SLA cycle error', { code: err.code, error: err.message });
    } finally {
      running = false;
    }
  }, config.sla.intervalMs);
  timer.unref();
  logger.info('SLA job started', { intervalMs: config.sla.intervalMs, batchSize: config.sla.batchSize });
  return () => clearInterval(timer);
}
