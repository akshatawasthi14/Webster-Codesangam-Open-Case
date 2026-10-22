import { realpathSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pool } from './pool.js';
import { logger } from '../utils/logger.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

/** Applies every *.sql file in ./migrations once, in filename order, each inside its own transaction. */
export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(7264001)'); // one migrator at a time
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    const applied = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    const ran = [];
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        ran.push(file);
        logger.info('Applied migration', { file });
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }
    return ran;
  } finally {
    await client.query('SELECT pg_advisory_unlock(7264001)').catch(() => undefined);
    client.release();
  }
}

// pathToFileURL handles Windows drive letters, spaces and symlinks; a hand-built `file://` string does not.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isMain) {
  migrate()
    .then((ran) => {
      logger.info(ran.length ? `Applied ${ran.length} migration(s)` : 'Database already up to date');
      return pool.end();
    })
    .catch(async (err) => {
      logger.error('Migration failed', { error: err.message });
      await pool.end().catch(() => undefined);
      process.exit(1);
    });
}
