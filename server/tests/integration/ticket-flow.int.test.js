import crypto from 'node:crypto';
import fs from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app, advance, closePool, detail, fileAnonymous, fileTicket, hasDb, makeCast, move, pool, request, resetData, setupDatabase, tamper } from '../helpers/db.js';

describe.skipIf(!hasDb)('ticket lifecycle, authorization, idempotency, anonymity', () => {
  let cast;
  beforeAll(setupDatabase);
  afterAll(closePool);
  beforeEach(async () => {
    await resetData();
    cast = await makeCast();
  });

  it('runs the full workflow and records every step in a valid audit chain', async () => {
    const { agents, users } = cast;
    const filed = await fileTicket(agents.student);
    expect(filed.status).toBe(201);
    const id = filed.body.ticketId;

    let res = await move(agents.officer, id, 'ASSIGNED', 1, { assigneeId: users.officer.id });
    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({ status: 'ASSIGNED', version: 2, assignee: { id: users.officer.id } });

    res = await move(agents.officer, id, 'IN_REVIEW', 2);
    expect(res.status).toBe(200);
    res = await move(agents.officer, id, 'RESOLVED', 3, { note: 'Replaced the heater.' });
    expect(res.body.ticket).toMatchObject({ status: 'RESOLVED', resolutionNote: 'Replaced the heater.' });
    expect(res.body.ticket.disputeWindowClosesAt).toBeTruthy();

    res = await agents.student.post(`/api/tickets/${id}/transitions`).send({ to: 'ESCALATED', version: 4, reason: 'Still broken' });
    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe('ESCALATED');

    res = await move(agents.admin, id, 'IN_REVIEW', 5);
    expect(res.status).toBe(200);
    expect(res.body.ticket.assignee.id).toBe(users.admin.id);

    const d = await detail(agents.student, id);
    expect(d.timeline.map((e) => e.action)).toEqual(['FILED', 'ASSIGNED', 'IN_REVIEW', 'RESOLVED', 'ESCALATED', 'IN_REVIEW']);

    const verify = await agents.student.get(`/api/tickets/${id}/audit/verify`);
    expect(verify.status).toBe(200);
    expect(verify.body).toMatchObject({ valid: true, eventsChecked: 6, firstFailure: null });

    // The petitioner and the assignee were notified about committed changes.
    const notes = await agents.student.get('/api/notifications');
    expect(notes.body.unreadCount).toBe(4); // ASSIGNED, IN_REVIEW, RESOLVED and the admin takeover (own dispute excluded)
  });

  it('rejects status jumps and wrong roles on the server, whatever the client sends', async () => {
    const { agents, users } = cast;
    const id = (await fileTicket(agents.student)).body.ticketId;

    let res = await move(agents.officer, id, 'RESOLVED', 1, { note: 'x' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');

    res = await move(agents.student, id, 'ASSIGNED', 1, { assigneeId: users.officer.id });
    expect(res.status).toBe(403);

    res = await move(agents.officer, id, 'ASSIGNED', 1, { assigneeId: users.student.id });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_ASSIGNEE');

    res = await move(agents.officer, id, 'BOGUS', 1);
    expect(res.status).toBe(400);

    const { rows } = await pool.query('SELECT status, version FROM tickets WHERE id = $1', [id]);
    expect(rows[0]).toMatchObject({ status: 'FILED', version: 1 });
  });

  it('requires a resolution note and answers stale versions with 409', async () => {
    const { agents, users } = cast;
    const id = (await fileTicket(agents.student)).body.ticketId;
    await move(agents.officer, id, 'ASSIGNED', 1, { assigneeId: users.officer.id });
    await move(agents.officer, id, 'IN_REVIEW', 2);

    let res = await move(agents.officer, id, 'RESOLVED', 3, { note: '   ' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RESOLUTION_NOTE_REQUIRED');

    res = await move(agents.officer, id, 'RESOLVED', 2, { note: 'done' }); // stale: ticket is at version 3
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'STALE_VERSION', details: { currentVersion: 3 } });
  });

  it('enforces role-based access to tickets', async () => {
    const { agents, users } = cast;
    const id = (await fileTicket(agents.student)).body.ticketId;

    expect((await request(app).get(`/api/tickets/${id}`)).status).toBe(401);
    expect((await agents.student2.get(`/api/tickets/${id}`)).status).toBe(404); // not even revealed
    expect((await agents.student.get(`/api/tickets/${id}`)).status).toBe(200);
    expect((await agents.admin.get(`/api/tickets/${id}`)).status).toBe(200);

    expect((await fileTicket(agents.officer)).status).toBe(403); // only students file
    expect((await agents.student.get('/api/admin/sla-rules')).status).toBe(403);
    expect((await agents.officer.get('/api/admin/sla-rules')).status).toBe(403);
    expect((await agents.admin.get('/api/admin/sla-rules')).status).toBe(200);
    expect((await agents.student.get('/api/users/officers')).status).toBe(403);

    // Unassigned officer sees the FILED queue but cannot comment or verify; after assignment to someone else, loses sight.
    expect((await agents.officer2.get(`/api/tickets/${id}`)).status).toBe(200);
    expect((await agents.officer2.post(`/api/tickets/${id}/comments`).send({ body: 'hi' })).status).toBe(403);
    expect((await agents.officer2.get(`/api/tickets/${id}/audit/verify`)).status).toBe(403);
    await move(agents.officer, id, 'ASSIGNED', 1, { assigneeId: users.officer.id });
    expect((await agents.officer2.get(`/api/tickets/${id}`)).status).toBe(404);

    const list = await agents.student2.get('/api/tickets');
    expect(list.body.total).toBe(0);
  });

  it('only lets @college email addresses register, and always as students', async () => {
    let res = await request(app).post('/api/auth/register').send({ name: 'Eve', email: 'eve@gmail.com', password: 'a-long-password' });
    expect(res.status).toBe(403);
    res = await request(app).post('/api/auth/register').send({ name: 'New Kid', email: 'kid@college.edu', password: 'a-long-password', role: 'ADMINISTRATOR' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('STUDENT');
    const { rows } = await pool.query("SELECT password_hash FROM users WHERE email = 'kid@college.edu'");
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/); // bcrypt, never plaintext
    expect((await request(app).post('/api/auth/login').send({ email: 'kid@college.edu', password: 'wrong-password' })).status).toBe(401);
  });

  it('is idempotent: repeating a filing with the same key returns the original ticket', async () => {
    const key = crypto.randomUUID();
    const first = await fileTicket(cast.agents.student, {}, key);
    const second = await fileTicket(cast.agents.student, {}, key);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ replayed: true, ticketId: first.body.ticketId });
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM tickets');
    expect(rows[0].n).toBe(1);
    const ev = await pool.query('SELECT COUNT(*)::int AS n FROM audit_events');
    expect(ev.rows[0].n).toBe(1);
  });

  it('validates input at the API boundary', async () => {
    const res = await fileTicket(cast.agents.student, { title: 'abc', priority: 'URGENT' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM tickets')).rows[0].n).toBe(0);
  });

  describe('anonymous reporting', () => {
    it('creates a ticket with no creator-account association and a one-time receipt token', async () => {
      const UA = 'TestAgent/9.9 (identifying-string)';
      const res = await fileAnonymous().set('User-Agent', UA);
      expect(res.status).toBe(201);
      const { ticketId, receiptToken } = res.body;
      expect(receiptToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(res.headers['set-cookie']).toBeUndefined(); // no session was created

      const { rows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);
      expect(rows[0].created_by).toBeNull();
      expect(rows[0].is_anonymous).toBe(true);
      expect(rows[0].receipt_token_hash).toBe(crypto.createHash('sha256').update(receiptToken).digest('hex'));

      // Nothing in the database (any table, any column) contains the token, the user agent or the client address.
      const tables = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).rows.map((r) => r.tablename);
      for (const t of tables) {
        const dump = JSON.stringify((await pool.query(`SELECT to_json(x) AS j FROM ${t} x`)).rows);
        expect(dump).not.toContain(receiptToken);
        expect(dump).not.toContain('TestAgent');
        expect(dump).not.toContain('127.0.0.1');
        expect(dump).not.toContain('::1');
      }
      const cols = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'")).rows.map((r) => r.column_name);
      for (const banned of ['ip', 'ip_address', 'remote_addr', 'user_agent', 'ua']) expect(cols).not.toContain(banned);

      const ev = await pool.query('SELECT actor_type, actor_id FROM audit_events WHERE ticket_id = $1', [ticketId]);
      expect(ev.rows).toEqual([{ actor_type: 'ANON_PETITIONER', actor_id: null }]);
    });

    it('stays anonymous even if the request carries a logged-in session', async () => {
      const res = await fileAnonymous().set('Cookie', cast.agents.student.jar?.getCookies?.({ path: '/', domain: '127.0.0.1', script: false, secure: false })?.toValueString?.() ?? '');
      expect(res.status).toBe(201);
      const { rows } = await pool.query('SELECT created_by FROM tickets WHERE id = $1', [res.body.ticketId]);
      expect(rows[0].created_by).toBeNull();
      expect((await cast.agents.student.get('/api/tickets')).body.total).toBe(0);
    });

    it('lets the receipt holder track, comment, verify and dispute - and nobody else', async () => {
      const { agents, users } = cast;
      const { ticketId, receiptToken } = (await fileAnonymous()).body;
      const asHolder = (r) => r.set('X-Receipt-Token', receiptToken);

      let res = await asHolder(request(app).get('/api/anonymous/case'));
      expect(res.status).toBe(200);
      expect(res.body.ticket).toMatchObject({ id: ticketId, isAnonymous: true, petitioner: null });
      expect(res.body.ticket).not.toHaveProperty('createdBy');
      expect(JSON.stringify(res.body)).not.toMatch(/receipt/i);

      expect((await request(app).get('/api/anonymous/case')).status).toBe(401);
      expect((await request(app).get('/api/anonymous/case').set('X-Receipt-Token', crypto.randomBytes(32).toString('base64url'))).status).toBe(401);
      expect((await agents.student.get(`/api/tickets/${ticketId}`)).status).toBe(404); // no account owns it

      res = await asHolder(request(app).post('/api/anonymous/case/comments')).send({ body: 'Extra detail from the petitioner' });
      expect(res.status).toBe(201);

      await move(agents.officer, ticketId, 'ASSIGNED', 1, { assigneeId: users.officer.id });
      await move(agents.officer, ticketId, 'IN_REVIEW', 2);
      await move(agents.officer, ticketId, 'RESOLVED', 3, { note: 'Handled.' });

      const state = await asHolder(request(app).get('/api/anonymous/case'));
      res = await asHolder(request(app).post('/api/anonymous/case/dispute')).send({ version: state.body.ticket.version, reason: 'Not actually handled' });
      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe('ESCALATED');

      res = await asHolder(request(app).get('/api/anonymous/case/audit/verify'));
      expect(res.body).toMatchObject({ valid: true });
      const actors = (await asHolder(request(app).get('/api/anonymous/case'))).body.timeline.map((e) => e.actorType);
      expect(actors).toContain('ANON_PETITIONER');
    });

    it('records attachment hashes and detects a file changed on disk', async () => {
      const content = Buffer.from('evidence: the geyser invoice');
      const res = await fileAnonymous().attach('attachments', content, { filename: 'invoice.txt', contentType: 'text/plain' });
      expect(res.status).toBe(201);
      const { ticketId, receiptToken } = res.body;
      const d = (await request(app).get('/api/anonymous/case').set('X-Receipt-Token', receiptToken)).body;
      expect(d.attachments).toHaveLength(1);
      expect(d.attachments[0].sha256).toBe(crypto.createHash('sha256').update(content).digest('hex'));
      expect(d.timeline.map((e) => e.action)).toEqual(['FILED', 'ATTACHMENT_ADDED']);

      const dl = await request(app).get(`/api/anonymous/case/attachments/${d.attachments[0].id}`).set('X-Receipt-Token', receiptToken);
      expect(dl.status).toBe(200);
      expect(dl.headers['content-disposition']).toMatch(/attachment/);

      const verify = () => request(app).get('/api/anonymous/case/audit/verify').set('X-Receipt-Token', receiptToken);
      expect((await verify()).body.valid).toBe(true);

      const { rows } = await pool.query('SELECT stored_name FROM attachments WHERE ticket_id = $1', [ticketId]);
      const file = `./uploads-test/${rows[0].stored_name}`;
      fs.appendFileSync(file, 'tampered');
      const after = (await verify()).body;
      expect(after.valid).toBe(false);
      expect(after.firstFailure).toMatchObject({ sequenceNo: 2, code: 'ATTACHMENT_FILE_MISMATCH' });
    });

    it('rejects disallowed file types and removes nothing-but-clean state', async () => {
      const res = await fileAnonymous().attach('attachments', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/x-msdownload' });
      expect(res.status).toBe(415);
      expect((await pool.query('SELECT COUNT(*)::int AS n FROM tickets')).rows[0].n).toBe(0);
    });
  });

  it('serves the public dashboard with small counts suppressed', async () => {
    const { agents } = cast;
    await fileTicket(agents.student, { category: 'HOSTEL' });
    let stats = (await request(app).get('/api/public/stats')).body;
    expect(stats.summary.total).toBeNull(); // 1 < STATS_MIN_COUNT (2)
    expect(JSON.stringify(stats)).not.toMatch(/student|stella|@/i);

    for (let i = 0; i < 2; i++) await fileTicket(agents.student, { category: 'HOSTEL' });
    await fileTicket(agents.student, { category: 'FINANCE' });
    stats = (await request(app).get('/api/public/stats')).body;
    expect(stats.summary.total).toBe(4);
    // FINANCE (1) is below k, so it is pooled into OTHER. A pool of 1 would be recoverable as total (4) - HOSTEL (3),
    // so HOSTEL is folded into the pool as well: nothing visible can be subtracted to expose a small count.
    expect(stats.categories.find((c) => c.category === 'HOSTEL')).toBeUndefined();
    expect(stats.categories.find((c) => c.category === 'FINANCE')).toBeUndefined();
    expect(stats.categories.find((c) => c.category === 'OTHER')).toMatchObject({ count: 4, suppressed: false });

    await advance(cast, (await fileTicket(agents.student)).body.ticketId, 'RESOLVED');
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});
