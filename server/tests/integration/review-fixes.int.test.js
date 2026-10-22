import crypto from 'node:crypto';
import fs from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  advance, app, closePool, createUser, fileAnonymous, fileTicket, hasDb, login, makeCast, move, pool, request,
  resetData, setupDatabase, PASSWORD,
} from '../helpers/db.js';

const UPLOADS = './uploads-test';
const stored = () => (fs.existsSync(UPLOADS) ? fs.readdirSync(UPLOADS).filter((f) => f.endsWith('.bin')) : []);
const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const txt = (s = 'receipt for the repair') => Buffer.from(s);
const attach = (req, buf = txt(), filename = 'note.txt', contentType = 'text/plain') => req.attach('attachments', buf, { filename, contentType });

describe.skipIf(!hasDb)('code-review regression tests', () => {
  let cast;
  beforeAll(setupDatabase);
  afterAll(closePool);
  beforeEach(async () => {
    await resetData();
    for (const f of stored()) fs.unlinkSync(`${UPLOADS}/${f}`);
    cast = await makeCast();
  });

  const verify = async (id) => (await cast.agents.admin.get(`/api/tickets/${id}/audit/verify`)).body;

  // ------------------------------------------------------------------ A / D: audit verifier
  describe('audit verifier detects missing and altered records', () => {
    async function withCommentAndAttachment() {
      const res = await attach(fileTicket(cast.agents.student));
      const id = res.body.ticketId;
      await cast.agents.student.post(`/api/tickets/${id}/comments`).send({ body: 'Please look at this soon' });
      expect((await verify(id)).valid).toBe(true);
      return id;
    }

    it('reports a comment row deleted directly in PostgreSQL', async () => {
      const id = await withCommentAndAttachment();
      await pool.query('DELETE FROM comments WHERE ticket_id = $1', [id]);
      expect((await verify(id)).firstFailure).toMatchObject({ sequenceNo: 3, code: 'MISSING_COMMENT_RECORD' });
    });

    it('reports an attachment row deleted directly in PostgreSQL', async () => {
      const id = await withCommentAndAttachment();
      await pool.query('DELETE FROM attachments WHERE ticket_id = $1', [id]);
      expect((await verify(id)).firstFailure).toMatchObject({ sequenceNo: 2, code: 'MISSING_ATTACHMENT_RECORD' });
    });

    it('reports a changed stored attachment hash, changed bytes on disk, and a missing file', async () => {
      let id = await withCommentAndAttachment();
      await pool.query('UPDATE attachments SET sha256 = $1 WHERE ticket_id = $2', ['0'.repeat(64), id]);
      expect((await verify(id)).firstFailure).toMatchObject({ code: 'ATTACHMENT_RECORD_MISMATCH' });

      id = await withCommentAndAttachment();
      const { rows } = await pool.query('SELECT stored_name FROM attachments WHERE ticket_id = $1', [id]);
      fs.appendFileSync(`${UPLOADS}/${rows[0].stored_name}`, 'x');
      expect((await verify(id)).firstFailure).toMatchObject({ code: 'ATTACHMENT_FILE_MISMATCH' });
      fs.unlinkSync(`${UPLOADS}/${rows[0].stored_name}`);
      expect((await verify(id)).firstFailure).toMatchObject({ code: 'ATTACHMENT_FILE_MISSING' });
    });
  });

  // ------------------------------------------------------------------ B: upload cleanup
  describe('uploaded files are cleaned up exactly when no ticket owns them', () => {
    it('removes files when validation fails after a successful upload', async () => {
      const res = await attach(fileTicket(cast.agents.student, { title: 'abc' }));
      expect(res.status).toBe(400);
      expect(stored()).toHaveLength(0);
    });

    it('removes files when the database transaction fails', async () => {
      await pool.query(`CREATE FUNCTION test_fail_filing() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'forced filing failure'; END; $$`);
      await pool.query('CREATE TRIGGER test_fail_filing BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION test_fail_filing()');
      try {
        const res = await attach(fileTicket(cast.agents.student));
        expect(res.status).toBe(500);
        expect(stored()).toHaveLength(0);
        expect((await pool.query('SELECT COUNT(*)::int AS n FROM tickets')).rows[0].n).toBe(0);
      } finally {
        await pool.query('DROP TRIGGER test_fail_filing ON audit_events');
        await pool.query('DROP FUNCTION test_fail_filing()');
      }
    });

    it('keeps files after a successful filing, and never touches them on a later failure', async () => {
      const res = await attach(fileTicket(cast.agents.student));
      expect(res.status).toBe(201);
      expect(stored()).toHaveLength(1);
      const failing = await attach(fileTicket(cast.agents.student, { priority: 'URGENT' }), txt('another file'));
      expect(failing.status).toBe(400);
      expect(stored()).toHaveLength(1); // the first ticket's evidence is still there
      expect((await verify(res.body.ticketId)).valid).toBe(true);
    });

    it('on an idempotent replay removes the duplicate upload but keeps the original', async () => {
      const key = crypto.randomUUID();
      const first = await attach(fileTicket(cast.agents.student, {}, key));
      const replay = await attach(fileTicket(cast.agents.student, {}, key));
      expect(first.status).toBe(201);
      expect(replay.status).toBe(200);
      expect(stored()).toHaveLength(1);
      expect((await verify(first.body.ticketId)).valid).toBe(true);
    });
  });

  // ------------------------------------------------------------------ C / F: idempotency collisions
  describe('idempotency keys are not credentials', () => {
    it('anonymous retry of the SAME submission is acknowledged without disclosing the ticket', async () => {
      const key = crypto.randomUUID();
      const first = await fileAnonymous({}, key);
      const retry = await fileAnonymous({}, key);
      expect(first.status).toBe(201);
      expect(first.body.receiptToken).toBeTruthy();
      expect(retry.status).toBe(200);
      expect(retry.body.replayed).toBe(true);
      expect(retry.body).not.toHaveProperty('ticketId');
      expect(retry.body).not.toHaveProperty('status');
      expect(retry.body).not.toHaveProperty('receiptToken');
      expect((await pool.query('SELECT COUNT(*)::int AS n FROM tickets')).rows[0].n).toBe(1);
    });

    it('a DIFFERENT anonymous submission reusing a key is rejected, not dropped and not leaked', async () => {
      const key = crypto.randomUUID();
      await fileAnonymous({ title: 'Victim complaint about the library' }, key);
      const clash = await fileAnonymous({ title: 'Someone else entirely' }, key);
      expect(clash.status).toBe(409);
      expect(clash.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
      expect(JSON.stringify(clash.body)).not.toMatch(/Victim|ticketId|receipt/);
      expect((await pool.query('SELECT COUNT(*)::int AS n FROM tickets')).rows[0].n).toBe(1);
      const fresh = await fileAnonymous({ title: 'Someone else entirely' }, crypto.randomUUID());
      expect(fresh.status).toBe(201); // retrying with a new key works
    });

    it('fails closed on legacy keys that have no stored fingerprint', async () => {
      const key = crypto.randomUUID();
      const first = await fileAnonymous({}, key);
      await pool.query('UPDATE tickets SET idempotency_fingerprint = NULL'); // simulate a pre-migration row
      const again = await fileAnonymous({}, key); // even the identical submission is refused
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
      expect(JSON.stringify(again.body)).not.toMatch(/ticketId|receipt|status"/);
      const reg = crypto.randomUUID();
      await fileTicket(cast.agents.student, {}, reg);
      await pool.query('UPDATE tickets SET idempotency_fingerprint = NULL');
      expect((await fileTicket(cast.agents.student, {}, reg)).status).toBe(409);
      expect((await pool.query('SELECT COUNT(*)::int AS n FROM tickets')).rows[0].n).toBe(2);
      void first;
    });

    it('requires a high-entropy key for anonymous filing', async () => {
      const res = await fileAnonymous({}, 'short-key-1234567');
      expect(res.status).toBe(400);
    });

    it('registered users: keys are per account, and reuse with different content is a 409', async () => {
      const key = crypto.randomUUID();
      const a = await fileTicket(cast.agents.student, {}, key);
      const b = await fileTicket(cast.agents.student2, {}, key); // other account, same key: independent
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(a.body.ticketId).not.toBe(b.body.ticketId);
      const clash = await fileTicket(cast.agents.student, { title: 'A completely different grievance' }, key);
      expect(clash.status).toBe(409);
      expect(clash.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });
  });

  // ------------------------------------------------------------------ E: visibility and assignment
  describe('assignment and visibility rules', () => {
    it('an officer who assigns a case to a colleague gets their result but loses access afterwards', async () => {
      const { agents, users } = cast;
      const id = (await fileTicket(agents.student)).body.ticketId;
      const res = await move(agents.officer2, id, 'ASSIGNED', 1, { assigneeId: users.officer.id });
      expect(res.status).toBe(200); // the committed change is reported back
      expect(res.body.ticket.assignee.id).toBe(users.officer.id);
      expect((await agents.officer2.get(`/api/tickets/${id}`)).status).toBe(404);
      expect((await agents.officer.get(`/api/tickets/${id}`)).status).toBe(200);
    });

    it('students cannot assign or resolve through the API, and cannot read others\' tickets by id', async () => {
      const { agents, users } = cast;
      const id = (await fileTicket(agents.student)).body.ticketId;
      expect((await move(agents.student, id, 'ASSIGNED', 1, { assigneeId: users.officer.id })).status).toBe(403);
      await advance(cast, id, 'IN_REVIEW');
      expect((await move(agents.student, id, 'RESOLVED', 3, { note: 'self-resolved' })).status).toBe(403);
      expect((await agents.student2.get(`/api/tickets/${id}`)).status).toBe(404);
      expect((await move(agents.student2, id, 'RESOLVED', 3, { note: 'x' })).status).toBe(404);
    });

    it('administrators can assign, escalate with a reason, and take over', async () => {
      const { agents, users } = cast;
      const id = (await fileTicket(agents.student)).body.ticketId;
      expect((await move(agents.admin, id, 'ASSIGNED', 1, { assigneeId: users.officer.id })).status).toBe(200);
      expect((await move(agents.admin, id, 'ESCALATED', 2, {})).status).toBe(422); // reason required
      expect((await move(agents.admin, id, 'ESCALATED', 2, { reason: 'Officer on leave' })).status).toBe(200);
      expect((await move(agents.admin, id, 'IN_REVIEW', 3)).body.ticket.assignee.id).toBe(users.admin.id);
    });

    it('a receipt token only ever opens its own case', async () => {
      const a = (await fileAnonymous()).body;
      const b = (await fileAnonymous({ title: 'Second anonymous complaint' })).body;
      const viewA = await request(app).get('/api/anonymous/case').set('X-Receipt-Token', a.receiptToken);
      const viewB = await request(app).get('/api/anonymous/case').set('X-Receipt-Token', b.receiptToken);
      expect(viewA.body.ticket.id).toBe(a.ticketId);
      expect(viewB.body.ticket.id).toBe(b.ticketId);
      expect(viewA.body.ticket.id).not.toBe(viewB.body.ticket.id);
      // The URL has no ticket id to tamper with, and the registered API does not accept receipt tokens.
      expect((await request(app).get(`/api/tickets/${b.ticketId}`).set('X-Receipt-Token', a.receiptToken)).status).toBe(401);
      for (const bad of ['', 'x', `${a.receiptToken}A`, 'A'.repeat(43)]) {
        expect((await request(app).get('/api/anonymous/case').set('X-Receipt-Token', bad)).status).toBe(401);
      }
    });

    it('an attachment cannot be downloaded through a different ticket\'s URL', async () => {
      const { agents } = cast;
      const one = (await attach(fileTicket(agents.student))).body.ticketId;
      const two = (await fileTicket(agents.student)).body.ticketId;
      const att = (await agents.student.get(`/api/tickets/${one}`)).body.attachments[0];
      expect((await agents.student.get(`/api/tickets/${one}/attachments/${att.id}`)).status).toBe(200);
      expect((await agents.student.get(`/api/tickets/${two}/attachments/${att.id}`)).status).toBe(404);
      expect((await agents.student2.get(`/api/tickets/${one}/attachments/${att.id}`)).status).toBe(404);
    });
  });

  // ------------------------------------------------------------------ G: notifications
  describe('stored notifications are the authoritative record', () => {
    it('a committed change leaves a stored notification even with no SSE client connected', async () => {
      const { agents, users } = cast;
      const id = (await fileTicket(agents.student)).body.ticketId;
      await move(agents.officer, id, 'ASSIGNED', 1, { assigneeId: users.officer.id });
      const list = (await agents.student.get('/api/notifications')).body;
      expect(list.unreadCount).toBe(1);
      expect(list.items[0].ticketId).toBe(id);
      // "Reconnect": a fresh login reads the same server-side truth.
      const again = await login(users.student.email);
      expect((await again.get('/api/notifications')).body.unreadCount).toBe(1);
    });
  });

  // ------------------------------------------------------------------ I: sessions
  describe('session and role security', () => {
    it('logout invalidates the session, even for a copied cookie', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: cast.users.student.email, password: PASSWORD });
      const cookie = res.headers['set-cookie'][0].split(';')[0];
      expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(200);
      await request(app).post('/api/auth/logout').set('Cookie', cookie);
      expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
    });

    it('role changes apply to existing sessions immediately', async () => {
      const { agents, users } = cast;
      expect((await agents.student.get('/api/admin/sla-rules')).status).toBe(403);
      await pool.query("UPDATE users SET role = 'ADMINISTRATOR' WHERE id = $1", [users.student.id]);
      expect((await agents.student.get('/api/admin/sla-rules')).status).toBe(200);
      await pool.query("UPDATE users SET role = 'STUDENT' WHERE id = $1", [users.student.id]);
      expect((await agents.student.get('/api/admin/sla-rules')).status).toBe(403);
    });

    it('rejects state-changing requests from an unlisted browser origin', async () => {
      const res = await cast.agents.student.post('/api/auth/logout').set('Origin', 'https://evil.example');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('BAD_ORIGIN');
      expect((await cast.agents.student.get('/api/auth/me')).status).toBe(200); // session untouched
    });

    it('a deleted user\'s session stops working', async () => {
      const temp = await createUser('Temp Person', 'STUDENT');
      const agent = await login(temp.email);
      await pool.query('DELETE FROM users WHERE id = $1', [temp.id]);
      expect((await agent.get('/api/auth/me')).status).toBe(401);
    });
  });

  // ------------------------------------------------------------------ J: content sniffing
  describe('attachments must match their declared type', () => {
    it('accepts genuine files', async () => {
      const png = await attach(fileTicket(cast.agents.student), PNG_BYTES, 'photo.png', 'image/png');
      expect(png.status).toBe(201);
      const pdf = await attach(fileTicket(cast.agents.student), Buffer.from('%PDF-1.4\n%%EOF'), 'a.pdf', 'application/pdf');
      expect(pdf.status).toBe(201);
    });

    it('rejects empty uploads and leaves nothing behind', async () => {
      for (const type of ['text/plain', 'application/pdf', 'image/png']) {
        const res = await attach(fileTicket(cast.agents.student), Buffer.alloc(0), 'empty.bin', type);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('EMPTY_FILE');
      }
      // a mixed request is rejected as a whole, including its valid file
      const mixed = await attach(attach(fileTicket(cast.agents.student), txt('fine')), Buffer.alloc(0), 'empty.txt');
      expect(mixed.status).toBe(400);
      expect(stored()).toHaveLength(0);
      expect((await pool.query('SELECT COUNT(*)::int AS n FROM tickets')).rows[0].n).toBe(0);
    });

    it('rejects disguised content and leaves nothing behind', async () => {
      const cases = [
        [txt('<script>alert(1)</script>'), 'evil.png', 'image/png'],
        [Buffer.from('MZ\x90\x00\x03'), 'tool.pdf', 'application/pdf'],
        [Buffer.from([0x00, 0x01, 0x02, 0xff]), 'bin.txt', 'text/plain'],
        [PNG_BYTES, 'real-png-claiming-jpeg.jpg', 'image/jpeg'],
      ];
      for (const [buf, name, type] of cases) {
        const res = await attach(fileTicket(cast.agents.student), buf, name, type);
        expect(res.status).toBe(415);
        expect(res.body.error.code).toBe('FILE_CONTENT_MISMATCH');
      }
      expect(stored()).toHaveLength(0);
      expect((await pool.query('SELECT COUNT(*)::int AS n FROM tickets')).rows[0].n).toBe(0);
    });
  });
});
