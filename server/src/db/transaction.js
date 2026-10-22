import { pool } from './pool.js';

async function run(beginSql, fn) {
  const client = await pool.connect();
  let destroy = false;
  try {
    await client.query(beginSql);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      destroy = true; // connection state unknown; do not return it to the pool
    }
    throw err;
  } finally {
    client.release(destroy);
  }
}

/**
 * Runs fn(client) inside BEGIN/COMMIT. Success is only reported after COMMIT returns;
 * any thrown error (including a failed COMMIT) rolls everything back and is re-thrown.
 */
export const withTransaction = (fn) => run('BEGIN', fn);

/** Consistent read-only snapshot, so concurrent writes cannot cause false alarms in the audit verifier. */
export const withReadSnapshot = (fn) => run('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY', fn);
