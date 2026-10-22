import bcrypt from 'bcrypt';
import { pool } from './pool.js';
import { config } from '../config/index.js';
import { ROLES } from '../config/constants.js';
import { logger } from '../utils/logger.js';

async function upsertUser(name, email, password, role) {
  const hash = await bcrypt.hash(password, config.bcryptRounds);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING`,
    [name, email.toLowerCase(), hash, role],
  );
}

async function main() {
  const demo = process.argv.includes('--demo');
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create the first administrator');
  }
  await upsertUser('Administrator', adminEmail, adminPassword, ROLES.ADMIN);
  logger.info('Administrator ensured', { email: adminEmail });

  if (demo) {
    if (config.isProd) throw new Error('Refusing to create demo accounts in production');
    const domain = config.collegeEmailDomains[0];
    await upsertUser('Demo Officer', `officer@${domain}`, 'Demo-Officer-123', ROLES.OFFICER);
    await upsertUser('Demo Officer Two', `officer2@${domain}`, 'Demo-Officer-123', ROLES.OFFICER);
    await upsertUser('Demo Student', `student@${domain}`, 'Demo-Student-123', ROLES.STUDENT);
    logger.info('Demo accounts ensured', { officer: `officer@${domain}`, student: `student@${domain}` });
  }
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    logger.error('Seed failed', { error: err.message });
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
