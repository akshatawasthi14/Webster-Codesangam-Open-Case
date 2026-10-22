import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, createUser, fileTicket, hasDb, login, makeCast, move, pool, resetData, setupDatabase } from '../helpers/db.js';
import { ROLES } from '../../src/config/constants.js';

describe.skipIf(!hasDb)('concurrency, idempotency under races, and load', () => {
  let cast;
  beforeAll(setupDatabase);
  afterAll(closePool);
  beforeEach(async () => {
    await resetData();
    cast = await makeCast();
  });

  it('serialises simultaneous transitions on one ticket: one winner, stale requests get 409, audit stays valid', async () => {
    const { agents, users } = cast;
    const id = (await fileTicket(agents.student)).body.ticketId;

    const attempts = Array.from({ length: 12 }, (_, i) =>
      move(i % 2 ? agents.officer : agents.admin, id, 'ASSIGNED', 1, { assigneeId: users.officer.id }),
    );
    const statuses = (await Promise.all(attempts)).map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(11);

    const events = await pool.query('SELECT sequence_no, action FROM audit_events WHERE ticket_id = $1 ORDER BY sequence_no', [id]);
    expect(events.rows).toEqual([{ sequence_no: 1, action: 'FILED' }, { sequence_no: 2, action: 'ASSIGNED' }]);
    expect((await agents.admin.get(`/api/tickets/${id}/audit/verify`)).body).toMatchObject({ valid: true, eventsChecked: 2 });
    expect((await pool.query('SELECT version FROM tickets WHERE id = $1', [id])).rows[0].version).toBe(2);
  });

  it('keeps the audit sequence valid when comments and transitions race on one ticket', async () => {
    const { agents, users } = cast;
    const id = (await fileTicket(agents.student)).body.ticketId;
    const jobs = [
      move(agents.officer, id, 'ASSIGNED', 1, { assigneeId: users.officer.id }),
      ...Array.from({ length: 8 }, (_, i) => agents.student.post(`/api/tickets/${id}/comments`).send({ body: `comment ${i}` })),
      ...Array.from({ length: 4 }, (_, i) => agents.admin.post(`/api/tickets/${id}/comments`).send({ body: `admin ${i}` })),
    ];
    const results = await Promise.all(jobs);
    expect(results.every((r) => [200, 201].includes(r.status))).toBe(true);
    const { rows } = await pool.query('SELECT sequence_no FROM audit_events WHERE ticket_id = $1 ORDER BY sequence_no', [id]);
    expect(rows.map((r) => r.sequence_no)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect((await agents.admin.get(`/api/tickets/${id}/audit/verify`)).body.valid).toBe(true);
  });

  it('creates exactly one ticket when the same idempotency key is sent concurrently', async () => {
    const key = 'race-key-0123456789abcdef';
    const results = await Promise.all(Array.from({ length: 10 }, () => fileTicket(cast.agents.student, {}, key)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 200)).toHaveLength(9);
    expect(new Set(results.map((r) => r.body.ticketId)).size).toBe(1);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM tickets')).rows[0].n).toBe(1);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM audit_events')).rows[0].n).toBe(1);
  });

  it('measured load: concurrent filings never produce a 500 or an inconsistent ticket/audit pair', async () => {
    const students = [];
    for (let i = 0; i < 5; i++) {
      const u = await createUser(`Load Student ${i}`, ROLES.STUDENT);
      students.push(await login(u.email));
    }
    const TOTAL = 100;
    const started = Date.now();
    const results = await Promise.all(Array.from({ length: TOTAL }, (_, i) => fileTicket(students[i % 5], { title: `Load test ticket ${i}` })));
    const elapsedMs = Date.now() - started;

    const created = results.filter((r) => r.status === 201).length;
    const rejected = results.filter((r) => r.status === 503).length;
    const other = results.filter((r) => ![201, 503].includes(r.status));
    // Honest reporting: conditions + measured outcome (no claimed capacity).
    console.log(`[load] ${TOTAL} concurrent filings, 5 sessions, pool max ${process.env.DB_POOL_MAX ?? 10}, ${elapsedMs} ms total: ${created} created, ${rejected} shed with 503, ${other.length} other`);

    expect(other).toHaveLength(0); // overload may shed (503) but must never 500 or half-succeed
    expect(created).toBeGreaterThan(0);
    const t = (await pool.query('SELECT COUNT(*)::int AS n FROM tickets')).rows[0].n;
    const e = (await pool.query("SELECT COUNT(*)::int AS n FROM audit_events WHERE action = 'FILED'")).rows[0].n;
    expect(t).toBe(created);
    expect(e).toBe(created);
  });
});
