import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// COUNT(*) and friends come back as bigint strings by default; our counts are small.
pg.types.setTypeParser(20, (v) => Number.parseInt(v, 10));

/**
 * Fixed-size pool with bounded waits. When every connection is busy and the wait
 * exceeds connectionTimeoutMillis, pg rejects and the error handler returns 503
 * instead of queueing requests indefinitely.
 */
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: config.db.poolMax,
  connectionTimeoutMillis: config.db.connectionTimeoutMs,
  statement_timeout: config.db.statementTimeoutMs,
  idle_in_transaction_session_timeout: config.db.idleInTxTimeoutMs,
  options: `-c lock_timeout=${config.db.lockTimeoutMs}`,
});

pool.on('error', (err) => logger.error('Idle PostgreSQL client error', { error: err.message }));

export const query = (text, params) => pool.query(text, params);
