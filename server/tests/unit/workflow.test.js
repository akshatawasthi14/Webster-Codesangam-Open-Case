import { describe, expect, it } from 'vitest';
import { ACTOR, ROLES, STATUS } from '../../src/config/constants.js';
import { availableTransitions, evaluateTransition } from '../../src/services/workflowService.js';

const HOUR = 3600 * 1000;
const NOW = new Date('2026-10-22T12:00:00.000Z');
const ctx = (over = {}) => ({ now: NOW, disputeWindowMs: 72 * HOUR, slaHours: { HIGH: 24 }, ...over });

const actors = {
  student: { type: ACTOR.USER, id: 'student-1', role: ROLES.STUDENT },
  otherStudent: { type: ACTOR.USER, id: 'student-2', role: ROLES.STUDENT },
  officer: { type: ACTOR.USER, id: 'officer-1', role: ROLES.OFFICER }, // the assignee
  otherOfficer: { type: ACTOR.USER, id: 'officer-2', role: ROLES.OFFICER },
  admin: { type: ACTOR.USER, id: 'admin-1', role: ROLES.ADMIN },
  system: { type: ACTOR.SYSTEM },
  anon: { type: ACTOR.ANON, ticketId: 't1' },
};

const ticket = (status, over = {}) => ({
  id: 't1',
  status,
  priority: 'HIGH',
  is_anonymous: false,
  created_by: 'student-1',
  assigned_to: 'officer-1',
  due_at: new Date(NOW.getTime() - HOUR), // already overdue
  resolved_at: new Date(NOW.getTime() - HOUR),
  ...over,
});
const anonTicket = (status) => ticket(status, { is_anonymous: true, created_by: null });

const input = { assigneeId: '00000000-0000-4000-8000-000000000001', note: 'Fixed it', reason: 'Not satisfied' };

/** The permitted transitions, written out independently from the code under test (straight from the spec). */
function allowedActors(from, to, anonymous) {
  const petitioner = anonymous ? ['anon'] : ['student'];
  if (from === STATUS.FILED && to === STATUS.ASSIGNED) return ['officer', 'otherOfficer', 'admin'];
  if (from === STATUS.ASSIGNED && to === STATUS.IN_REVIEW) return ['officer'];
  if (from === STATUS.IN_REVIEW && to === STATUS.RESOLVED) return ['officer'];
  if (from === STATUS.RESOLVED && to === STATUS.ESCALATED) return petitioner;
  if ([STATUS.FILED, STATUS.ASSIGNED, STATUS.IN_REVIEW].includes(from) && to === STATUS.ESCALATED) return ['admin', 'system'];
  if (from === STATUS.ESCALATED && to === STATUS.IN_REVIEW) return ['admin'];
  return [];
}

describe('state machine: every (status, target, actor) combination', () => {
  for (const anonymous of [false, true]) {
    for (const from of Object.values(STATUS)) {
      for (const to of Object.values(STATUS)) {
        for (const [name, actor] of Object.entries(actors)) {
          const permitted = allowedActors(from, to, anonymous).includes(name);
          it(`${anonymous ? 'anon ticket' : 'ticket'} ${from} -> ${to} by ${name}: ${permitted ? 'allowed' : 'rejected'}`, () => {
            const t = anonymous ? anonTicket(from) : ticket(from);
            const run = () => evaluateTransition(t, actor, to, input, ctx());
            if (permitted) {
              const out = run();
              expect(out.changes.status).toBe(to);
              expect(out.payload).toMatchObject({ from, to });
            } else {
              expect(run).toThrowError();
              try {
                run();
              } catch (e) {
                expect([403, 422]).toContain(e.status);
              }
            }
          });
        }
      }
    }
  }
});

describe('transition conditions', () => {
  it('a direct jump FILED -> RESOLVED is an invalid transition for everyone', () => {
    for (const actor of Object.values(actors)) {
      expect(() => evaluateTransition(ticket('FILED'), actor, 'RESOLVED', input, ctx())).toThrowError(
        expect.objectContaining({ code: 'INVALID_TRANSITION', status: 422 }),
      );
    }
  });

  it('resolution requires a non-blank note', () => {
    for (const note of [undefined, '', '   ']) {
      expect(() => evaluateTransition(ticket('IN_REVIEW'), actors.officer, 'RESOLVED', { note }, ctx())).toThrowError(
        expect.objectContaining({ code: 'RESOLUTION_NOTE_REQUIRED' }),
      );
    }
  });

  it('assignment requires an assignee', () => {
    expect(() => evaluateTransition(ticket('FILED'), actors.officer, 'ASSIGNED', {}, ctx())).toThrowError(
      expect.objectContaining({ code: 'ASSIGNEE_REQUIRED' }),
    );
  });

  it('dispute needs a reason and must fall inside the window', () => {
    expect(() => evaluateTransition(ticket('RESOLVED'), actors.student, 'ESCALATED', {}, ctx())).toThrowError(
      expect.objectContaining({ code: 'REASON_REQUIRED' }),
    );
    const inside = ticket('RESOLVED', { resolved_at: new Date(NOW.getTime() - 71 * HOUR) });
    expect(evaluateTransition(inside, actors.student, 'ESCALATED', input, ctx()).changes.status).toBe('ESCALATED');
    const outside = ticket('RESOLVED', { resolved_at: new Date(NOW.getTime() - 73 * HOUR) });
    expect(() => evaluateTransition(outside, actors.student, 'ESCALATED', input, ctx())).toThrowError(
      expect.objectContaining({ code: 'DISPUTE_WINDOW_CLOSED' }),
    );
  });

  it('the system escalates only after the SLA deadline has passed', () => {
    const notYet = ticket('FILED', { due_at: new Date(NOW.getTime() + 1000) });
    expect(() => evaluateTransition(notYet, actors.system, 'ESCALATED', {}, ctx())).toThrowError(
      expect.objectContaining({ code: 'SLA_NOT_BREACHED' }),
    );
    const out = evaluateTransition(ticket('FILED'), actors.system, 'ESCALATED', {}, ctx());
    expect(out.payload).toMatchObject({ trigger: 'SLA_BREACH' });
  });

  it('an administrator must record a reason to escalate manually', () => {
    expect(() => evaluateTransition(ticket('FILED'), actors.admin, 'ESCALATED', {}, ctx())).toThrowError(
      expect.objectContaining({ code: 'REASON_REQUIRED' }),
    );
  });

  it('taking over an escalated case assigns the admin and starts a fresh SLA window', () => {
    const out = evaluateTransition(ticket('ESCALATED'), actors.admin, 'IN_REVIEW', {}, ctx());
    expect(out.changes.assigned_to).toBe('admin-1');
    expect(out.changes.due_at.getTime()).toBe(NOW.getTime() + 24 * HOUR);
  });

  it('lists only the transitions an actor could attempt', () => {
    expect(availableTransitions(ticket('FILED'), actors.student)).toEqual([]);
    expect(availableTransitions(ticket('FILED'), actors.officer).map((t) => t.to)).toEqual(['ASSIGNED']);
    expect(availableTransitions(ticket('RESOLVED'), actors.student).map((t) => t.to)).toEqual(['ESCALATED']);
    expect(availableTransitions(ticket('RESOLVED'), actors.otherStudent)).toEqual([]);
  });
});
