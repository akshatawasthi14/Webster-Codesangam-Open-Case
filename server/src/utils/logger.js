const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const configured = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'error' : 'info');
const threshold = LEVELS[configured] ?? LEVELS.info;

function write(level, message, meta) {
  if (LEVELS[level] > threshold) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, message, ...meta });
  (level === 'error' ? process.stderr : process.stdout).write(line + '\n');
}

// NOTE: callers must never pass IP addresses or user-agent strings (anonymous filing guarantee).
export const logger = {
  error: (message, meta) => write('error', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  info: (message, meta) => write('info', message, meta),
  debug: (message, meta) => write('debug', message, meta),
};
