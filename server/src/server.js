import { config } from './config/index.js';
import { pool } from './db/pool.js';
import { startSlaJob } from './jobs/slaJob.js';
import { closeAllStreams } from './services/sseHub.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

const app = createApp();
const server = app.listen(config.port, () => {
  logger.info('Open Case API listening', { port: config.port, env: config.env });
});
// Long-lived SSE connections must not be cut by the default request timeouts.
server.requestTimeout = 0;
server.keepAliveTimeout = 65_000;

const stopSlaJob = startSlaJob();

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Shutting down', { signal });
  stopSlaJob();
  closeAllStreams();
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  server.closeIdleConnections?.();
  server.close(async () => {
    await pool.end().catch(() => undefined);
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// State is in PostgreSQL, so crash-and-restart under a process supervisor (systemd/pm2/docker) is safe.
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection', { error: String(err?.message ?? err) });
  process.exit(1);
});
