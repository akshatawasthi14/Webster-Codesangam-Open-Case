import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runSlaCycle } from '../../src/jobs/slaJob.js';
import { closePool, detail, fileTicket, hasDb, makeCast, move, pool, resetData, setupDatabase } from '../helpers/db.js';

describe.skipIf(!hasDb)('SLA deadline job and notifications', () => {
  let cast;
  beforeAll(setupDatabase);
  afterAll(closePool);
  beforeEach(async () => {
    await resetData();
    cast = await makeCast();
  });

  const setDue = (id, sqlExpr) => pool.query(`UPDATE tickets SET due_at = ${sqlExpr} WHERE id = $1`, [id]);
  const escalations = async (id) =>
    (await pool.query("SELECT actor_type FROM audit_events WHERE ticket_id = $1 AND action = 'ESCALATED'", [id])).rows;

  it('escalates only after the deadline and never twice', async () => {
    const id = (await fileTicket(cast.agents.student, { priority: 'CRITICAL' })).body.ticketId;
    const stored = await pool.query('SELECT due_at, created_at FROM tickets WHERE id = $1', [id]);
    expect(stored.rows[0].due_at.getTime() - stored.rows[0].created_at.getTime()).toBe(8 * 3600 * 1000); // CRITICAL = 8h

    await setDue(id, "NOW() + INTERVAL '1 second'");
    expect(await runSlaCycle()).toMatchObject({ candidates: 0, escalated: 0 });
    expect((await detail(cast.agents.admin, id)).ticket.status).toBe('FILED');

    await new Promise((r) => setTimeout(r, 1300)); // now just past the deadline
    expect(await runSlaCycle()).toMatchObject({ candidates: 1, escalated: 1 });
    expect((await detail(cast.agents.admin, id)).ticket).toMatchObject({ status: 'ESCALATED', version: 2 });
    expect(await escalations(id)).toEqual([{ actor_type: 'SYSTEM' }]);

    // Repeated runs are harmless.
    expect(await runSlaCycle()).toMatchObject({ candidates: 0, escalated: 0 });
    expect(await runSlaCycle()).toMatchObject({ escalated: 0 });
    expect(await escalations(id)).toHaveLength(1);
    expect((await cast.agents.admin.get(`/api/tickets/${id}/audit/verify`)).body.valid).toBe(true);
  });

  it('notifies administrators and the petitioner only for the committed escalation', async () => {
    const id = (await fileTicket(cast.agents.student)).body.ticketId;
    const before = (await pool.query('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1', [cast.users.admin.id])).rows[0].n;
    await setDue(id, "NOW() - INTERVAL '1 minute'");
    await runSlaCycle();
    const adminNotes = (await cast.agents.admin.get('/api/notifications')).body;
    expect(adminNotes.items.length).toBe(before + 1);
    expect(adminNotes.items[0].message).toMatch(/FILED to ESCALATED/);
    const studentNotes = (await cast.agents.student.get('/api/notifications')).body;
    expect(studentNotes.items.some((n) => /ESCALATED/.test(n.message))).toBe(true);

    // Read state works.
    const read = await cast.agents.admin.post(`/api/notifications/${adminNotes.items[0].id}/read`);
    expect(read.body.notification.read).toBe(true);
    expect((await cast.agents.admin.post('/api/notifications/read-all')).status).toBe(200);
    expect((await cast.agents.admin.get('/api/notifications')).body.unreadCount).toBe(0);
  });

  it('skips resolved tickets and does not re-escalate a case an administrator has taken over', async () => {
    const { agents, users } = cast;
    const resolved = (await fileTicket(agents.student)).body.ticketId;
    await move(agents.officer, resolved, 'ASSIGNED', 1, { assigneeId: users.officer.id });
    await move(agents.officer, resolved, 'IN_REVIEW', 2);
    await move(agents.officer, resolved, 'RESOLVED', 3, { note: 'ok' });
    await setDue(resolved, "NOW() - INTERVAL '1 day'");

    const overdue = (await fileTicket(agents.student)).body.ticketId;
    await setDue(overdue, "NOW() - INTERVAL '1 day'");
    expect(await runSlaCycle()).toMatchObject({ candidates: 1, escalated: 1 });
    expect((await detail(agents.admin, resolved)).ticket.status).toBe('RESOLVED');

    const taken = await move(agents.admin, overdue, 'IN_REVIEW', 2);
    expect(taken.status).toBe(200);
    expect(new Date(taken.body.ticket.dueAt).getTime()).toBeGreaterThan(Date.now());
    expect(await runSlaCycle()).toMatchObject({ candidates: 0, escalated: 0 });
  });

  it('processes only a small batch per run and resumes on the next run', async () => {
    const ids = [];
    for (let i = 0; i < 5; i++) ids.push((await fileTicket(cast.agents.student)).body.ticketId);
    await pool.query("UPDATE tickets SET due_at = NOW() - INTERVAL '1 hour'");
    expect(await runSlaCycle({ batchSize: 3 })).toMatchObject({ candidates: 3, escalated: 3 });
    expect(await runSlaCycle({ batchSize: 3 })).toMatchObject({ candidates: 2, escalated: 2 });
    expect(await runSlaCycle({ batchSize: 3 })).toMatchObject({ candidates: 0 });
  });
});
