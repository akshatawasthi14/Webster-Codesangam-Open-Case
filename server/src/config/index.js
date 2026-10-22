import 'dotenv/config';

const env = process.env;

function int(key, fallback) {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`Environment variable ${key} must be an integer`);
  return n;
}

function bool(key, fallback) {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function list(key, fallback) {
  const raw = env[key];
  const value = raw === undefined || raw === '' ? fallback : raw;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function trustProxy() {
  const raw = env.TRUST_PROXY;
  if (raw === undefined || raw === '' || raw === 'false') return false;
  if (raw === 'true') return true;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? raw : n;
}

const nodeEnv = env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

const databaseUrl = env.DATABASE_URL;
if (!databaseUrl) throw new Error('Missing required environment variable DATABASE_URL');

const sessionSecret = env.SESSION_SECRET;
if (!sessionSecret) throw new Error('Missing required environment variable SESSION_SECRET');
if (isProd && sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters in production');
}

export const config = Object.freeze({
  env: nodeEnv,
  isProd,
  isTest: nodeEnv === 'test',
  port: int('PORT', 4000),
  databaseUrl,
  db: Object.freeze({
    poolMax: int('DB_POOL_MAX', 10),
    connectionTimeoutMs: int('DB_CONNECT_TIMEOUT_MS', 3000),
    statementTimeoutMs: int('DB_STATEMENT_TIMEOUT_MS', 10000),
    lockTimeoutMs: int('DB_LOCK_TIMEOUT_MS', 5000),
    idleInTxTimeoutMs: int('DB_IDLE_IN_TX_TIMEOUT_MS', 15000),
  }),
  session: Object.freeze({
    secret: sessionSecret,
    ttlMs: int('SESSION_TTL_HOURS', 12) * 3600 * 1000,
    cookieSecure: bool('COOKIE_SECURE', isProd),
  }),
  trustProxy: trustProxy(),
  clientOrigins: list('CLIENT_ORIGIN', 'http://localhost:5173'),
  collegeEmailDomains: list('COLLEGE_EMAIL_DOMAINS', 'college.edu').map((d) => d.toLowerCase()),
  bcryptRounds: int('BCRYPT_ROUNDS', 12),
  uploads: Object.freeze({
    dir: env.UPLOAD_DIR || './uploads',
    maxFileBytes: int('MAX_FILE_BYTES', 5 * 1024 * 1024),
    maxFiles: int('MAX_FILES_PER_TICKET', 5),
  }),
  dispute: Object.freeze({ windowHours: int('DISPUTE_WINDOW_HOURS', 72) }),
  sla: Object.freeze({
    enabled: bool('SLA_JOB_ENABLED', true),
    intervalMs: int('SLA_JOB_INTERVAL_MS', 60000),
    batchSize: int('SLA_JOB_BATCH_SIZE', 25),
  }),
  stats: Object.freeze({
    minCount: int('STATS_MIN_COUNT', 5),
    cacheTtlMs: int('STATS_CACHE_TTL_MS', 60000),
  }),
  rateLimit: Object.freeze({
    globalPerMin: int('RATE_LIMIT_GLOBAL_PER_MIN', 300),
    authPer15Min: int('RATE_LIMIT_AUTH_PER_15MIN', 20),
    anonFilingPerHour: int('RATE_LIMIT_ANON_FILING_PER_HOUR', 10),
    receiptPer15Min: int('RATE_LIMIT_RECEIPT_PER_15MIN', 60),
  }),
});
