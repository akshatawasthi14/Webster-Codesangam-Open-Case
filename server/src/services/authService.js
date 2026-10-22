import bcrypt from 'bcrypt';
import { ROLES } from '../config/constants.js';
import { config } from '../config/index.js';
import { pool } from '../db/pool.js';
import { conflict, forbidden, unauthorized } from '../utils/errors.js';

const toUser = (r) => ({ id: r.id, name: r.name, email: r.email, role: r.role });

// Compared against when the email is unknown, so login timing does not reveal which emails exist.
let dummyHash;
const getDummyHash = async () => (dummyHash ??= await bcrypt.hash('not-a-real-password', config.bcryptRounds));

export function assertCollegeEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || !config.collegeEmailDomains.includes(domain)) {
    throw forbidden(`Registration is limited to college email addresses (${config.collegeEmailDomains.map((d) => '@' + d).join(', ')})`);
  }
}

async function insertUser({ name, email, password, role }) {
  const hash = await bcrypt.hash(password, config.bcryptRounds);
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, hash, role],
    );
    return toUser(rows[0]);
  } catch (err) {
    if (err.code === '23505') throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
    throw err;
  }
}

/** Self-registration always creates a STUDENT; staff accounts are created by administrators. */
export async function registerStudent({ name, email, password }) {
  assertCollegeEmail(email);
  return insertUser({ name, email, password, role: ROLES.STUDENT });
}

export async function createStaffUser({ name, email, password, role }) {
  assertCollegeEmail(email);
  return insertUser({ name, email, password, role });
}

export async function authenticate({ email, password }) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : await getDummyHash());
  if (!user || !ok) throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  return toUser(user);
}

export async function listOfficers() {
  const { rows } = await pool.query('SELECT id, name FROM users WHERE role = $1 ORDER BY name', [ROLES.OFFICER]);
  return rows;
}
