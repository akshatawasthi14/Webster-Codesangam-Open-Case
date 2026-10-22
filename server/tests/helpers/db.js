import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { ROLES } from '../../src/config/constants.js';
import { pool } from '../../src/db/pool.js';
import { migrate } from '../../src/db/migrate.js';

export const hasDb = Boolean(process.env.TEST_DATABASE_URL);
// CI sets REQUIRE_INTEGRATION_TESTS=true so a missing database fails the build instead of silently skipping.
if (!hasDb && process.env.REQUIRE_INTEGRATION_TESTS === 'true') {
  throw new Error('REQUIRE_INTEGRATION_TESTS is set but TEST_DATABASE_URL is missing: refusing to skip integration tests');
}
export const PASSWORD = 'Passw0rd-for-tests';
export const app = createApp();
export { pool, request };

export async function setupDatabase() {
  await migrate();
}

/** Wipes all data. The audit table is append-only, so its triggers are disabled for the wipe only. */
export async function resetData() {
  const c = await pool.connect();
  try {
    await c.query('ALTER TABLE audit_events DISABLE TRIGGER USER');
    await c.query('TRUNCATE notifications, comments, attachments, audit_events, tickets, users, session RESTART IDENTITY CASCADE');
  } finally {
    await c.query('ALTER TABLE audit_events ENABLE TRIGGER USER');
    c.release();
  }
}

/** Runs fn(client) with the append-only trigger switched off (simulates a privileged DB admin tampering). */
export async function tamper(fn) {
  const c = await pool.connect();
  try {
    await c.query('ALTER TABLE audit_events DISABLE TRIGGER USER');
    await fn(c);
  } finally {
    await c.query('ALTER TABLE audit_events ENABLE TRIGGER USER');
    c.release();
  }
}

export async function createUser(name, role, email = `${name.toLowerCase().replace(/\W+/g, '.')}@college.edu`) {
  const hash = await bcrypt.hash(PASSWORD, 4);
  const { rows } = await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
    [name, email, hash, role],
  );
  return rows[0];
}

export async function login(email) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  return agent;
}

/** A small cast: two students, two officers, one admin - each with a logged-in agent. */
export async function makeCast() {
  const users = {
    student: await createUser('Stella Student', ROLES.STUDENT),
    student2: await createUser('Sam Student', ROLES.STUDENT),
    officer: await createUser('Olive Officer', ROLES.OFFICER),
    officer2: await createUser('Owen Officer', ROLES.OFFICER),
    admin: await createUser('Ada Admin', ROLES.ADMIN),
  };
  const agents = {};
  for (const [key, u] of Object.entries(users)) agents[key] = await login(u.email);
  return { users, agents };
}

export const validTicket = {
  title: 'Broken hostel water heater',
  description: 'The geyser in block C has not worked for two weeks.',
  category: 'HOSTEL',
  priority: 'HIGH',
};

function applyFields(req, fields) {
  for (const [k, v] of Object.entries(fields)) req.field(k, v);
  return req;
}

export const fileTicket = (agent, fields = {}, key = crypto.randomUUID()) =>
  applyFields(agent.post('/api/tickets').set('Idempotency-Key', key), { ...validTicket, ...fields });

export const fileAnonymous = (fields = {}, key = crypto.randomUUID()) =>
  applyFields(request(app).post('/api/anonymous/tickets').set('Idempotency-Key', key), { ...validTicket, ...fields });

export const move = (agent, id, to, version, extra = {}) =>
  agent.post(`/api/tickets/${id}/transitions`).send({ to, version, ...extra });

export const detail = async (agent, id) => (await agent.get(`/api/tickets/${id}`)).body;

/** Drives a fresh ticket up to the given status and returns { id, version }. */
export async function advance(cast, id, upTo) {
  const { officer, admin } = cast.users;
  const order = ['ASSIGNED', 'IN_REVIEW', 'RESOLVED'];
  let version = 1;
  for (const to of order) {
    const agent = to === 'ASSIGNED' ? cast.agents.officer : cast.agents.officer;
    const extra = to === 'ASSIGNED' ? { assigneeId: officer.id } : to === 'RESOLVED' ? { note: 'Replaced the heater.' } : {};
    const res = await move(agent, id, to, version, extra);
    if (res.status !== 200) throw new Error(`advance to ${to} failed: ${res.status} ${JSON.stringify(res.body)}`);
    version = res.body.ticket.version;
    if (to === upTo) break;
  }
  void admin;
  return { id, version };
}

export async function closePool() {
  await pool.end();
}
