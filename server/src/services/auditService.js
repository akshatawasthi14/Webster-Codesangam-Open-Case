import fs from 'node:fs/promises';
import { ACTOR, AUDIT, STATUS } from '../config/constants.js';
import { pool } from '../db/pool.js';
import { withReadSnapshot } from '../db/transaction.js';
import { canonicalJson, sha256File, sha256Hex } from '../utils/hash.js';
import { storedPath } from '../utils/files.js';
import { notFound } from '../utils/errors.js';

/**
 * Hash input. The array form removes any ambiguity between fields; the SAME function is used to
 * write and to verify, and payload/timestamp are stored as the exact strings that were hashed.
 */
export function computeEventHash(e) {
  return sha256Hex(
    JSON.stringify([
      e.ticketId,
      e.sequenceNo,
      e.actorType,
      e.actorId ?? null,
      e.action,
      e.payload,
      e.occurredAt,
      e.prevHash ?? '',
    ]),
  );
}

/**
 * Appends one event to a ticket's chain. MUST be called inside the transaction that holds the
 * ticket row lock (or created the ticket), so sequence numbers are strictly ordered per ticket.
 */
export async function appendAuditEvent(client, { ticketId, actor, action, payload }) {
  const { rows } = await client.query(
    `SELECT sequence_no, event_hash FROM audit_events
     WHERE ticket_id = $1 ORDER BY sequence_no DESC LIMIT 1`,
    [ticketId],
  );
  const last = rows[0];
  const event = {
    ticketId,
    sequenceNo: last ? last.sequence_no + 1 : 1,
    actorType: actor.type,
    actorId: actor.type === ACTOR.USER ? actor.id : null,
    action,
    payload: canonicalJson(payload ?? {}),
    occurredAt: new Date().toISOString(), // millisecond UTC string
    prevHash: last ? last.event_hash : null,
  };
  event.eventHash = computeEventHash(event);

  await client.query(
    `INSERT INTO audit_events
       (ticket_id, sequence_no, actor_type, actor_id, action, payload, occurred_at, prev_hash, event_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [event.ticketId, event.sequenceNo, event.actorType, event.actorId, event.action, event.payload,
      event.occurredAt, event.prevHash, event.eventHash],
  );
  return event;
}

const fail = (sequenceNo, code, reason) => ({ sequenceNo, code, reason });

/**
 * Pure chain check over events ordered by sequence_no (DB row shape). Returns the FIRST failure or null.
 * Detects: modified events, deleted events inside the chain, reordered events.
 */
export function verifyEventChain(events) {
  let expectedSeq = 1;
  let prevHash = null;
  for (const ev of events) {
    if (ev.sequence_no !== expectedSeq) {
      return fail(expectedSeq, 'SEQUENCE_GAP', `Expected event #${expectedSeq} but found #${ev.sequence_no}`);
    }
    if ((ev.prev_hash ?? null) !== prevHash) {
      return fail(ev.sequence_no, 'PREV_HASH_MISMATCH', 'Event does not link to the previous event');
    }
    const recomputed = computeEventHash({
      ticketId: ev.ticket_id,
      sequenceNo: ev.sequence_no,
      actorType: ev.actor_type,
      actorId: ev.actor_id,
      action: ev.action,
      payload: ev.payload,
      occurredAt: ev.occurred_at,
      prevHash: ev.prev_hash,
    });
    if (recomputed !== ev.event_hash) {
      return fail(ev.sequence_no, 'EVENT_HASH_MISMATCH', 'Event contents do not match its recorded hash');
    }
    prevHash = ev.event_hash;
    expectedSeq += 1;
  }
  return null;
}

// Payloads are always JSON objects; anything else (corrupt or hand-written rows) reads as empty, never throws.
const parse = (s) => {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
};

/**
 * Checks things the chain points at: that the ticket's current state, comments and attachments
 * still match what the (already verified) chain recorded. This is what catches a deleted tail event.
 */
export async function verifyReferences({ ticket, events, comments, attachments }) {
  const last = events[events.length - 1];
  if (!last) return fail(null, 'EMPTY_CHAIN', 'Ticket has no audit events');

  // 1. Head status: the last status-bearing event must agree with the ticket row.
  const statusEvents = events.filter((e) => 'to' in parse(e.payload));
  const lastStatus = statusEvents[statusEvents.length - 1];
  if (!lastStatus || parse(lastStatus.payload).to !== ticket.status) {
    return fail(last.sequence_no, 'HEAD_STATUS_MISMATCH', 'Ticket status is not supported by the end of the audit chain');
  }

  // 2. Original filing content.
  const filed = events.find((e) => e.action === STATUS.FILED);
  const expectedContent = sha256Hex(JSON.stringify([ticket.title, ticket.description]));
  if (filed && parse(filed.payload).contentHash !== expectedContent) {
    return fail(filed.sequence_no, 'CONTENT_MISMATCH', 'Ticket title/description differ from what was filed');
  }

  // 3. Comments: every comment has an event and the body still matches its recorded hash.
  const commentEvents = new Map(
    events.filter((e) => e.action === AUDIT.COMMENT_ADDED).map((e) => [parse(e.payload).commentId, e]),
  );
  for (const c of comments) {
    const ev = commentEvents.get(c.id);
    if (!ev) return fail(last.sequence_no, 'UNRECORDED_COMMENT', 'A comment exists without an audit event');
    if (parse(ev.payload).bodyHash !== sha256Hex(c.body)) {
      return fail(ev.sequence_no, 'COMMENT_MISMATCH', 'Comment text differs from what was recorded');
    }
  }

  // 3b. Reverse direction: every recorded comment event must still have its comment row.
  const commentIds = new Set(comments.map((c) => c.id));
  for (const [commentId, ev] of commentEvents) {
    if (!commentIds.has(commentId)) {
      return fail(ev.sequence_no, 'MISSING_COMMENT_RECORD', 'A comment recorded in the audit trail no longer exists');
    }
  }

  // 4. Attachments: every file has an event and the bytes on disk still match the recorded SHA-256.
  const attachmentEvents = new Map(
    events.filter((e) => e.action === AUDIT.ATTACHMENT_ADDED).map((e) => [parse(e.payload).attachmentId, e]),
  );
  for (const a of attachments) {
    const ev = attachmentEvents.get(a.id);
    if (!ev) return fail(last.sequence_no, 'UNRECORDED_ATTACHMENT', 'An attachment exists without an audit event');
    if (parse(ev.payload).sha256 !== a.sha256) {
      return fail(ev.sequence_no, 'ATTACHMENT_RECORD_MISMATCH', 'Attachment hash differs from the audit record');
    }
    try {
      await fs.access(storedPath(a.stored_name));
      if ((await sha256File(storedPath(a.stored_name))) !== a.sha256) {
        return fail(ev.sequence_no, 'ATTACHMENT_FILE_MISMATCH', 'Attachment file content has changed');
      }
    } catch (err) {
      if (err?.code === 'ENOENT') {
        return fail(ev.sequence_no, 'ATTACHMENT_FILE_MISSING', 'Attachment file is missing from storage');
      }
      throw err;
    }
  }

  // 4b. Reverse direction: every recorded attachment event must still have its attachment row.
  const attachmentIds = new Set(attachments.map((a) => a.id));
  for (const [attachmentId, ev] of attachmentEvents) {
    if (!attachmentIds.has(attachmentId)) {
      return fail(ev.sequence_no, 'MISSING_ATTACHMENT_RECORD', 'An attachment recorded in the audit trail no longer exists');
    }
  }
  return null;
}

/** Full verification for one ticket, on a consistent snapshot. Reports the first failing event. */
export async function verifyTicketAudit(ticketId) {
  const data = await withReadSnapshot(async (client) => {
    const t = await client.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);
    if (!t.rows[0]) return null;
    // One client runs one query at a time, so these are sequential on purpose.
    const events = await client.query('SELECT * FROM audit_events WHERE ticket_id = $1 ORDER BY sequence_no', [ticketId]);
    const comments = await client.query('SELECT id, body FROM comments WHERE ticket_id = $1', [ticketId]);
    const attachments = await client.query('SELECT id, stored_name, sha256 FROM attachments WHERE ticket_id = $1', [ticketId]);
    return { ticket: t.rows[0], events: events.rows, comments: comments.rows, attachments: attachments.rows };
  });
  if (!data) throw notFound('Ticket not found');

  const firstFailure = verifyEventChain(data.events) ?? (await verifyReferences(data));
  return {
    ticketId,
    valid: firstFailure === null,
    eventsChecked: data.events.length,
    firstFailure,
    checkedAt: new Date().toISOString(),
    note: 'Tamper-evident, not tamper-proof: a privileged database administrator could rewrite and re-hash a whole chain.',
  };
}

/** Timeline for display (actor names resolved; anonymous/system actors carry no identity). */
export async function getTimeline(ticketId, db = pool) {
  const { rows } = await db.query(
    `SELECT e.sequence_no, e.actor_type, u.name AS actor_name, e.action, e.payload,
            e.occurred_at, e.prev_hash, e.event_hash
     FROM audit_events e LEFT JOIN users u ON u.id = e.actor_id
     WHERE e.ticket_id = $1 ORDER BY e.sequence_no`,
    [ticketId],
  );
  return rows.map((r) => ({
    sequenceNo: r.sequence_no,
    actorType: r.actor_type,
    actorName: r.actor_name,
    action: r.action,
    payload: parse(r.payload),
    occurredAt: r.occurred_at,
    prevHash: r.prev_hash,
    eventHash: r.event_hash,
  }));
}
