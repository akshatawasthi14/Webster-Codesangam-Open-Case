import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { advance, closePool, detail, fileTicket, hasDb, makeCast, move, pool, resetData, setupDatabase, tamper } from '../helpers/db.js';

describe.skipIf(!hasDb)('audit trail integrity and atomicity', () => {
  let cast;
  beforeAll(setupDatabase);
  afterAll(closePool);
  beforeEach(async () => {
    await resetData();
    cast = await makeCast();
  });

  const verify = async (id) => (await cast.agents.admin.get(`/api/tickets/${id}/audit/verify`)).body;

  async function ticketWithHistory() {
    const id = (await fileTicket(cast.agents.student)).body.ticketId;
    await advance(cast, id, 'IN_REVIEW'); // FILED, ASSIGNED, IN_REVIEW
    await cast.agents.student.post(`/api/tickets/${id}/comments`).send({ body: 'Any update?' }); // 4th event
    return id;
  }

  it('verifies an untouched chain', async () => {
    const id = await ticketWithHistory();
    expect(await verify(id)).toMatchObject({ valid: true, eventsChecked: 4, firstFailure: null });
  });

  it('refuses ordinary UPDATE, DELETE and TRUNCATE on the audit table', async () => {
    const id = await ticketWithHistory();
    await expect(pool.query("UPDATE audit_events SET action = 'X' WHERE ticket_id = $1", [id])).rejects.toThrow(/append-only/);
    await expect(pool.query('DELETE FROM audit_events WHERE ticket_id = $1', [id])).rejects.toThrow(/append-only/);
    await expect(pool.query('TRUNCATE audit_events')).rejects.toThrow(/append-only/);
    expect((await verify(id)).valid).toBe(true);
  });

  it('detects a modified event payload and names the failing event', async () => {
    const id = await ticketWithHistory();
    await tamper((c) => c.query("UPDATE audit_events SET payload = '{\"to\":\"ASSIGNED\",\"assigneeId\":\"forged\"}' WHERE ticket_id = $1 AND sequence_no = 2", [id]));
    expect((await verify(id)).firstFailure).toMatchObject({ sequenceNo: 2, code: 'EVENT_HASH_MISMATCH' });
  });

  it('detects a deleted event inside the chain', async () => {
    const id = await ticketWithHistory();
    await tamper((c) => c.query('DELETE FROM audit_events WHERE ticket_id = $1 AND sequence_no = 2', [id]));
    const result = await verify(id);
    expect(result.valid).toBe(false);
    expect(result.firstFailure).toMatchObject({ sequenceNo: 2, code: 'SEQUENCE_GAP' });
  });

  it('detects reordered events', async () => {
    const id = await ticketWithHistory();
    await tamper(async (c) => {
      await c.query('UPDATE audit_events SET sequence_no = 99 WHERE ticket_id = $1 AND sequence_no = 2', [id]);
      await c.query('UPDATE audit_events SET sequence_no = 2 WHERE ticket_id = $1 AND sequence_no = 3', [id]);
      await c.query('UPDATE audit_events SET sequence_no = 3 WHERE ticket_id = $1 AND sequence_no = 99', [id]);
    });
    expect((await verify(id)).firstFailure).toMatchObject({ sequenceNo: 2, code: 'PREV_HASH_MISMATCH' });
  });

  it('detects a deleted last event via the ticket state / recorded references', async () => {
    const id = await ticketWithHistory();
    await tamper((c) => c.query('DELETE FROM audit_events WHERE ticket_id = $1 AND sequence_no = 4', [id])); // the comment event
    expect((await verify(id)).firstFailure).toMatchObject({ code: 'UNRECORDED_COMMENT' });

    const id2 = (await fileTicket(cast.agents.student)).body.ticketId;
    await advance(cast, id2, 'ASSIGNED');
    await tamper((c) => c.query('DELETE FROM audit_events WHERE ticket_id = $1 AND sequence_no = 2', [id2])); // the status event
    expect((await verify(id2)).firstFailure).toMatchObject({ code: 'HEAD_STATUS_MISMATCH' });
  });

  it('reports empty or malformed audit payloads as a clear failure, never a server error', async () => {
    for (const bad of ['', 'not json {', 'null', '[1,2]']) {
      const id = await ticketWithHistory();
      await tamper((c) => c.query('UPDATE audit_events SET payload = $1 WHERE ticket_id = $2 AND sequence_no = 2', [bad, id]));
      const res = await cast.agents.admin.get(`/api/tickets/${id}/audit/verify`);
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.firstFailure).toMatchObject({ sequenceNo: 2, code: 'EVENT_HASH_MISMATCH' });
      // the ticket page still renders despite the corrupt row
      expect((await cast.agents.admin.get(`/api/tickets/${id}`)).status).toBe(200);
    }
  });

  it('detects edits to comment text and to the filed title', async () => {
    const id = await ticketWithHistory();
    await pool.query("UPDATE comments SET body = 'Nothing to see' WHERE ticket_id = $1", [id]);
    expect((await verify(id)).firstFailure).toMatchObject({ sequenceNo: 4, code: 'COMMENT_MISMATCH' });

    const id2 = (await fileTicket(cast.agents.student)).body.ticketId;
    await pool.query("UPDATE tickets SET title = 'Quietly rewritten title' WHERE id = $1", [id2]);
    expect((await verify(id2)).firstFailure).toMatchObject({ sequenceNo: 1, code: 'CONTENT_MISMATCH' });
  });

  it('rolls the ticket update back when the audit insert fails (atomicity)', async () => {
    const id = (await fileTicket(cast.agents.student)).body.ticketId;
    const { officer } = cast.users;
    await move(cast.agents.officer, id, 'ASSIGNED', 1, { assigneeId: officer.id });
    const before = await pool.query('SELECT status, version, updated_at FROM tickets WHERE id = $1', [id]);
    const notesBefore = (await pool.query('SELECT COUNT(*)::int AS n FROM notifications')).rows[0].n;

    await pool.query(`CREATE FUNCTION test_force_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action = 'IN_REVIEW' THEN RAISE EXCEPTION 'forced audit failure'; END IF; RETURN NEW; END; $$`);
    await pool.query('CREATE TRIGGER test_force_audit_failure BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION test_force_audit_failure()');
    try {
      const res = await move(cast.agents.officer, id, 'IN_REVIEW', 2);
      expect(res.status).toBe(500); // an error, never a false success
      expect(res.body.error.code).toBe('INTERNAL_ERROR');

      const after = await pool.query('SELECT status, version, updated_at FROM tickets WHERE id = $1', [id]);
      expect(after.rows[0]).toEqual(before.rows[0]); // ticket untouched
      expect((await pool.query('SELECT COUNT(*)::int AS n FROM audit_events WHERE ticket_id = $1', [id])).rows[0].n).toBe(2);
      expect((await pool.query('SELECT COUNT(*)::int AS n FROM notifications')).rows[0].n).toBe(notesBefore); // no phantom notification
    } finally {
      await pool.query('DROP TRIGGER test_force_audit_failure ON audit_events');
      await pool.query('DROP FUNCTION test_force_audit_failure()');
    }

    const retry = await move(cast.agents.officer, id, 'IN_REVIEW', 2);
    expect(retry.status).toBe(200);
    expect((await verify(id)).valid).toBe(true);
    expect((await detail(cast.agents.admin, id)).ticket.version).toBe(3);
  });
});
