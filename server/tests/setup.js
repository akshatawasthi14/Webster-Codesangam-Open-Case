// Runs before every test file, before any application module reads process.env.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://unused:unused@127.0.0.1:5432/unused';
process.env.SESSION_SECRET = 'test-session-secret-test-session-secret';
process.env.BCRYPT_ROUNDS = '4';
process.env.UPLOAD_DIR = './uploads-test';
process.env.COLLEGE_EMAIL_DOMAINS = 'college.edu';
process.env.DISPUTE_WINDOW_HOURS = '72';
process.env.SLA_JOB_ENABLED = 'false';
process.env.STATS_MIN_COUNT = '2';
process.env.STATS_CACHE_TTL_MS = '0';
process.env.RATE_LIMIT_GLOBAL_PER_MIN = '1000000';
process.env.RATE_LIMIT_AUTH_PER_15MIN = '1000000';
process.env.RATE_LIMIT_ANON_FILING_PER_HOUR = '1000000';
process.env.RATE_LIMIT_RECEIPT_PER_15MIN = '1000000';

if (!process.env.TEST_DATABASE_URL) {
  const bar = '='.repeat(78);
  console.warn(`\n${bar}\n  WARNING: TEST_DATABASE_URL is not set - the INTEGRATION TESTS WILL BE SKIPPED.\n  Only unit tests are running. Point TEST_DATABASE_URL at a throwaway PostgreSQL\n  database (tests truncate its tables) and run again before trusting a green result.\n${bar}\n`);
}
