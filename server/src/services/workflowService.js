import { ACTOR, ROLES, STATUS } from '../config/constants.js';
import { forbidden, unprocessable } from '../utils/errors.js';

/**
 * The server-side state machine. Pure functions only (no I/O), so every combination of
 * (status, target, actor) can be tested exhaustively. Anything not listed here is rejected.
 *
 * Actors:  { type: 'USER', id, role } | { type: 'ANON_PETITIONER', ticketId } | { type: 'SYSTEM' }
 * Context: { now: Date, disputeWindowMs: number, slaHours: { [priority]: number } }
 */

const isUser = (a) => a?.type === ACTOR.USER;
const isSystem = (a) => a?.type === ACTOR.SYSTEM;
const isStaff = (a) => isUser(a) && (a.role === ROLES.OFFICER || a.role === ROLES.ADMIN);
const isAdmin = (a) => isUser(a) && a.role === ROLES.ADMIN;
const isAssignee = (t, a) => isUser(a) && t.assigned_to === a.id;
const isPetitioner = (t, a) =>
  (isUser(a) && !t.is_anonymous && t.created_by === a.id) ||
  (a?.type === ACTOR.ANON && t.is_anonymous && a.ticketId === t.id);

const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

export const TRANSITIONS = Object.freeze([
  {
    from: [STATUS.FILED],
    to: STATUS.ASSIGNED,
    requires: ['assigneeId'],
    permits: (t, a) => isStaff(a),
    validate: (t, a, input) => {
      if (!input.assigneeId) throw unprocessable('ASSIGNEE_REQUIRED', 'An assignee is required');
    },
    apply: (t, a, input) => ({
      changes: { assigned_to: input.assigneeId },
      payload: { assigneeId: input.assigneeId },
    }),
  },
  {
    from: [STATUS.ASSIGNED],
    to: STATUS.IN_REVIEW,
    requires: [],
    permits: (t, a) => isAssignee(t, a),
    validate: () => {},
    apply: () => ({ changes: {}, payload: {} }),
  },
  {
    from: [STATUS.IN_REVIEW],
    to: STATUS.RESOLVED,
    requires: ['note'],
    permits: (t, a) => isAssignee(t, a),
    validate: (t, a, input) => {
      if (!nonEmpty(input.note)) {
        throw unprocessable('RESOLUTION_NOTE_REQUIRED', 'A resolution note is mandatory');
      }
    },
    apply: (t, a, input, ctx) => ({
      changes: { resolved_at: ctx.now, resolution_note: input.note.trim() },
      payload: { resolutionNote: input.note.trim() },
    }),
  },
  {
    from: [STATUS.RESOLVED],
    to: STATUS.ESCALATED,
    requires: ['reason'],
    permits: (t, a) => isPetitioner(t, a),
    validate: (t, a, input, ctx) => {
      if (!nonEmpty(input.reason)) throw unprocessable('REASON_REQUIRED', 'A reason is required to dispute a resolution');
      const closesAt = t.resolved_at ? new Date(t.resolved_at).getTime() + ctx.disputeWindowMs : 0;
      if (ctx.now.getTime() > closesAt) {
        throw unprocessable('DISPUTE_WINDOW_CLOSED', 'The dispute window for this resolution has closed');
      }
    },
    apply: (t, a, input, ctx) => ({
      changes: { escalated_at: ctx.now, escalation_reason: input.reason.trim() },
      payload: { reason: input.reason.trim(), trigger: 'PETITIONER_DISPUTE' },
    }),
  },
  {
    from: [STATUS.FILED, STATUS.ASSIGNED, STATUS.IN_REVIEW],
    to: STATUS.ESCALATED,
    requires: ['reason'],
    permits: (t, a) => isSystem(a) || isAdmin(a),
    validate: (t, a, input, ctx) => {
      if (isSystem(a)) {
        if (!(ctx.now.getTime() > new Date(t.due_at).getTime())) {
          throw unprocessable('SLA_NOT_BREACHED', 'The SLA deadline has not passed');
        }
      } else if (!nonEmpty(input.reason)) {
        throw unprocessable('REASON_REQUIRED', 'An administrator must record a reason for escalation');
      }
    },
    apply: (t, a, input, ctx) => {
      const system = isSystem(a);
      const reason = system ? 'SLA deadline breached' : input.reason.trim();
      return {
        changes: { escalated_at: ctx.now, escalation_reason: reason },
        payload: { reason, trigger: system ? 'SLA_BREACH' : 'ADMINISTRATOR', dueAt: new Date(t.due_at).toISOString() },
      };
    },
  },
  {
    from: [STATUS.ESCALATED],
    to: STATUS.IN_REVIEW,
    requires: [],
    permits: (t, a) => isAdmin(a),
    validate: (t, a, input, ctx) => {
      if (!ctx.slaHours?.[t.priority]) throw new Error(`No SLA rule for priority ${t.priority}`);
    },
    // The administrator takes responsibility (becomes the assignee) and a fresh SLA window starts,
    // otherwise the deadline job would immediately re-escalate the same overdue ticket.
    apply: (t, a, input, ctx) => {
      const dueAt = new Date(ctx.now.getTime() + ctx.slaHours[t.priority] * 3600 * 1000);
      return {
        changes: { assigned_to: a.id, due_at: dueAt },
        payload: { takenBy: a.id, newDueAt: dueAt.toISOString() },
      };
    },
  },
]);

const find = (from, to) => TRANSITIONS.find((r) => r.to === to && r.from.includes(from));

/**
 * Validates a requested transition and returns what to change. Throws:
 *   422 INVALID_TRANSITION       - not in the table (e.g. FILED -> RESOLVED)
 *   403 FORBIDDEN                - transition exists but this actor may not perform it
 *   422 <rule-specific code>     - a condition failed (missing note/reason, window closed, SLA not breached...)
 */
export function evaluateTransition(ticket, actor, to, input = {}, ctx) {
  const rule = find(ticket.status, to);
  if (!rule) {
    throw unprocessable('INVALID_TRANSITION', `Transition ${ticket.status} -> ${to} is not allowed`);
  }
  if (!rule.permits(ticket, actor)) {
    throw forbidden(`You may not move a ticket from ${ticket.status} to ${to}`);
  }
  rule.validate(ticket, actor, input, ctx);
  const { changes, payload } = rule.apply(ticket, actor, input, ctx);
  return {
    changes: { ...changes, status: to },
    payload: { from: ticket.status, to, ...payload },
  };
}

/** Transitions this actor could attempt right now (conditions such as notes/windows are checked on submit). */
export function availableTransitions(ticket, actor) {
  return TRANSITIONS.filter((r) => r.from.includes(ticket.status) && r.permits(ticket, actor)).map((r) => ({
    to: r.to,
    requires: r.requires,
  }));
}
