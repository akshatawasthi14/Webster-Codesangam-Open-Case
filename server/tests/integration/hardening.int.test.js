import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app, closePool, fileTicket, hasDb, makeCast, request, resetData, setupDatabase } from '../helpers/db.js';

const ORIGIN = 'http://localhost:5173'; // the default CLIENT_ORIGIN

describe('CORS for the React dev server', () => {
  it('answers a preflight for an allowed origin, including the custom headers the API uses', async () => {
    const res = await request(app)
      .options('/api/anonymous/tickets')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'idempotency-key, x-receipt-token, content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-headers']).toMatch(/Idempotency-Key.*X-Receipt-Token/);
  });

  it('gives nothing to an origin that is not listed', async () => {
    const res = await request(app).options('/api/health').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    const post = await request(app).post('/api/auth/login').set('Origin', 'https://evil.example').send({ email: 'a@college.edu', password: 'x' });
    expect(post.status).toBe(403);
    expect(post.body.error.code).toBe('BAD_ORIGIN');
  });
});

describe('migration entrypoint', () => {
  it('runs when started through a symlink or a path containing spaces', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'open case '));
    try {
      const real = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src');
      try {
        fs.symlinkSync(real, path.join(tmp, 'src'), 'dir');
      } catch {
        return; // symlinks unavailable (e.g. Windows without privileges): nothing to check
      }
      const out = execFileSync(process.execPath, [path.join(tmp, 'src/db/migrate.js')], {
        env: { ...process.env, LOG_LEVEL: 'info' },
        encoding: 'utf8',
      });
      expect(out).toMatch(/up to date|Applied/); // the old `file://${argv[1]}` check printed nothing at all
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!hasDb)('input hardening', () => {
  let cast;
  beforeAll(setupDatabase);
  afterAll(closePool);
  beforeEach(async () => {
    await resetData();
    cast = await makeCast();
  });

  it('rejects passwords bcrypt would silently truncate', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Long Pass', email: 'long@college.edu', password: 'a'.repeat(73) });
    expect(res.status).toBe(400);
    const multibyte = await request(app).post('/api/auth/register').send({ name: 'Emoji Pass', email: 'emoji@college.edu', password: '\u{1F512}'.repeat(19) });
    expect(multibyte.status).toBe(400); // 19 characters but 76 bytes
    const ok = await request(app).post('/api/auth/register').send({ name: 'Fine Pass', email: 'fine@college.edu', password: 'a'.repeat(72) });
    expect(ok.status).toBe(201);
  });

  it('does not let a visible total minus visible cells expose a small status count', async () => {
    const { agents } = cast;
    for (let i = 0; i < 3; i++) await fileTicket(agents.student, { category: 'HOSTEL' });
    const { body } = await request(app).get('/api/public/stats');
    // 3 FILED tickets only: resolved/escalated are 0, so nothing is derivable and open is shown.
    expect(body.summary).toMatchObject({ total: 3, open: 3, resolved: null, escalated: null });
  });
});
