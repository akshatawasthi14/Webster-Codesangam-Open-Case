import crypto from 'node:crypto';
import { ACTOR, AUDIT, ROLES, STATUS } from '../config/constants.js';
import { config } from '../config/index.js';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { conflict, forbidden, notFound, unprocessable } from '../utils/errors.js';
import { sha256File, sha256Hex } from '../utils/hash.js';
import { sanitizeFileName, storedPath } from '../utils/files.js';
import { generateReceiptToken, hashReceiptToken } from '../utils/token.js';
import { appendAuditEvent, getTimeline } from './auditService.js';
import { createNotifications, publishNotifications } from './notificationService.js';
import { clearStatsCache } from './statsService.js';
import { availableTransitions, evaluateTransition } from './workflowService.js';

const HOUR_MS = 3600 * 1000;
const UPDATABLE_COLUMNS = ['status', 'assigned_to', 'resolved_at', 'resolution_note', 'escalated_at', 'escalation_reason', 'due_at'];
const shortId = (id) => id.slice(0, 8);

// ------------------------------------------------------------------ access rules

export function canView(ticket, actor) {
  if (actor.type === ACTOR.ANON) return ticket.is_anonymous && actor.ticketId === ticket.id;
  if (actor.type !== ACTOR.USER) return false;
  switch (actor.role) {
    case ROLES.ADMIN:
      return true;
    case ROLES.OFFICER:
      return ticket.assigned_to === actor.id || ticket.status === STATUS.FILED; // unassigned queue + own cases
    case ROLES.STUDENT:
      return !ticket.is_anonymous && ticket.created_by === actor.id;
    default:
      return false;
  }
}

export function canComment(ticket, actor) {
  if (!canView(ticket, actor)) return false;
  if (actor.type === ACTOR.ANON) return true;
  if (actor.role === ROLES.ADMIN) return true;
  if (actor.role === ROLES.OFFICER) return ticket.assigned_to === actor.id;
  return ticket.created_by === actor.id;
}

/** Who may run the audit verifier: administrators, the assigned officer, and the petitioner. */
export const canVerify = (ticket, actor) =>
  canView(ticket, actor) && (actor.type === ACTOR.ANON || actor.role !== ROLES.OFFICER || ticket.assigned_to === actor.id);

// ------------------------------------------------------------------ DTOs

function toTicketDto(row, viewer) {
  const showPetitioner = !row.is_anonymous && row.petitioner_name && viewer.type === ACTOR.USER;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    version: row.version,
    isAnonymous: row.is_anonymous,
    petitioner: showPetitioner ? { id: row.created_by, name: row.petitioner_name } : null,
    assignee: row.assigned_to ? { id: row.assigned_to, name: row.assignee_name } : null,
    dueAt: row.due_at,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
    escalatedAt: row.escalated_at,
    escalationReason: row.escalation_reason,
    disputeWindowClosesAt:
      row.status === STATUS.RESOLVED && row.resolved_at
        ? new Date(new Date(row.resolved_at).getTime() + config.dispute.windowHours * HOUR_MS).toISOString()
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_TICKET = `
  SELECT t.*, c.name AS petitioner_name, a.name AS assignee_name
  FROM tickets t
  LEFT JOIN users c ON c.id = t.created_by
  LEFT JOIN users a ON a.id = t.assigned_to`;

async function loadTicketWithNames(db, id) {
  const { rows } = await db.query(`${SELECT_TICKET} WHERE t.id = $1`, [id]);
  return rows[0] ?? null;
}

// ------------------------------------------------------------------ helpers inside transactions

async function lockTicket(client, id, { skipLocked = false } = {}) {
  const { rows } = await client.query(
    `SELECT * FROM tickets WHERE id = $1 FOR UPDATE${skipLocked ? ' SKIP LOCKED' : ''}`,
    [id],
  );
  return rows[0] ?? null;
}

async function staffIds(client, roles) {
  const { rows } = await client.query('SELECT id FROM users WHERE role = ANY($1::text[])', [roles]);
  return rows.map((r) => r.id);
}

// ------------------------------------------------------------------ create

/**
 * Files a grievance. Everything (ticket row, SLA deadline, FILED audit event, attachment rows + events,
 * notifications) happens in ONE transaction. Uploaded files are already on disk and hashed before it starts,
 * so a slow upload can never hold a row lock.
 *
 * actor === null  => anonymous submission: no creator account is associated and a receipt token is minted.
 */
export async function createTicket({ actor, data, files = [], idempotencyKey = null }) {
  const anonymous = actor === null;

  const evidence = await Promise.all(
    files.map(async (f) => ({
      fileName: sanitizeFileName(f.originalname),
      storedName: f.filename,
      mimeType: f.mimetype,
      sizeBytes: f.size,
      sha256: await sha256File(f.path),
    })),
  );

  // Binds an idempotency key to the exact submission it was first used with.
  const fingerprint = idempotencyKey
    ? sha256Hex(JSON.stringify([data.title, data.description, data.category, data.priority, evidence.map((e) => e.sha256)]))
    : null;

  const customTicketId = crypto.randomUUID();
  // The tracking receipt ID and complaint ID are the exact same identifier
  const receiptToken = anonymous ? customTicketId : null;
  const receiptHash = anonymous ? hashReceiptToken(receiptToken) : null;
  const now = new Date();

  const result = await withTransaction(async (client) => {
    const rule = await client.query('SELECT sla_hours FROM escalation_rules WHERE priority = $1', [data.priority]);
    if (!rule.rows[0]) throw new Error(`No SLA rule configured for priority ${data.priority}`);
    const dueAt = new Date(now.getTime() + rule.rows[0].sla_hours * HOUR_MS);

    const inserted = await client.query(
      `INSERT INTO tickets
         (id, title, description, category, priority, status, is_anonymous, receipt_token_hash,
          created_by, idempotency_key, idempotency_fingerprint, original_due_at, due_at, created_at, updated_at)
       VALUES ($12, $1, $2, $3, $4, 'FILED', $5, $6, $7, $8, $11, $9, $9, $10, $10)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [data.title, data.description, data.category, data.priority, anonymous, receiptHash,
        anonymous ? null : actor.id, idempotencyKey, dueAt, now, fingerprint, customTicketId],
    );

    if (!inserted.rows[0]) {
      // Same idempotency key seen before.
      const existing = await client.query(
        anonymous
          ? 'SELECT id, status, idempotency_fingerprint FROM tickets WHERE is_anonymous AND idempotency_key = $1'
          : 'SELECT id, status, idempotency_fingerprint FROM tickets WHERE created_by = $1 AND idempotency_key = $2',
        anonymous ? [idempotencyKey] : [actor.id, idempotencyKey],
      );
      const prior = existing.rows[0];
      if (!prior) throw conflict('CREATE_CONFLICT', 'Ticket could not be created; please retry');
      // A key is not a credential. Only an identical resubmission is treated as a retry; anything else is a
      // collision and must neither be dropped silently nor reveal anything about the existing ticket.
      // Fail closed: a row without a fingerprint predates migration 002, so its content cannot be compared.
      if (!prior.idempotency_fingerprint || prior.idempotency_fingerprint !== fingerprint) {
        throw conflict(
          'IDEMPOTENCY_KEY_REUSED',
          'This Idempotency-Key was already used for a different submission. Generate a new key and submit again.',
        );
      }
      // Anonymous replays disclose nothing about the original ticket (no id, no status): the petitioner already
      // holds the receipt token from the first response, and nobody else may learn that the ticket exists.
      return anonymous
        ? { replayed: true }
        : { replayed: true, ticketId: prior.id, status: prior.status };
    }

    const ticket = inserted.rows[0];
    const auditActor = anonymous ? { type: ACTOR.ANON } : actor;

    await appendAuditEvent(client, {
      ticketId: ticket.id,
      actor: auditActor,
      action: STATUS.FILED,
      payload: {
        to: STATUS.FILED,
        category: ticket.category,
        priority: ticket.priority,
        isAnonymous: anonymous,
        dueAt: dueAt.toISOString(),
        contentHash: sha256Hex(JSON.stringify([ticket.title, ticket.description])),
      },
    });

    for (const ev of evidence) {
      const att = await client.query(
        `INSERT INTO attachments (ticket_id, file_name, stored_name, mime_type, size_bytes, sha256)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [ticket.id, ev.fileName, ev.storedName, ev.mimeType, ev.sizeBytes, ev.sha256],
      );
      await appendAuditEvent(client, {
        ticketId: ticket.id,
        actor: auditActor,
        action: AUDIT.ATTACHMENT_ADDED,
        payload: { attachmentId: att.rows[0].id, fileName: ev.fileName, sizeBytes: ev.sizeBytes, sha256: ev.sha256 },
      });
    }

    const recipients = await staffIds(client, [ROLES.OFFICER, ROLES.ADMIN]);
    const notifications = await createNotifications(client, {
      ticketId: ticket.id,
      userIds: recipients,
      message: `New ${ticket.priority} priority grievance filed (#${shortId(ticket.id)}): "${ticket.title}"`,
    });

    return { replayed: false, ticket, notifications };
  });

  if (result.replayed) return result;
  publishNotifications(result.notifications); // only after COMMIT
  clearStatsCache();
  return {
    replayed: false,
    ticketId: result.ticket.id,
    status: result.ticket.status,
    dueAt: result.ticket.due_at,
    receiptToken: anonymous ? result.ticket.id : null, // Complaint ID and tracking receipt token are identical
  };
}

// ------------------------------------------------------------------ transitions

/**
 * Moves a ticket through the state machine. Row lock + version check make concurrent changes to the
 * same ticket strictly ordered; the loser gets 409. Ticket update, audit event and notifications commit together.
 *
 * Returns null only when skipLocked is set and the row was busy/missing (used by the SLA job).
 */
export async function transitionTicket({ ticketId, actor, to, expectedVersion, input = {}, skipLocked = false }) {
  const outcome = await withTransaction(async (client) => {
    const ticket = await lockTicket(client, ticketId, { skipLocked });
    if (!ticket) {
      if (skipLocked) return null;
      throw notFound('Ticket not found');
    }
    if (actor.type !== ACTOR.SYSTEM && !canView(ticket, actor)) throw notFound('Ticket not found');

    if (actor.type !== ACTOR.SYSTEM && ticket.version !== expectedVersion) {
      throw conflict('STALE_VERSION', 'This ticket was changed by someone else. Reload and try again.', {
        currentVersion: ticket.version,
        currentStatus: ticket.status,
      });
    }

    let slaHours = {};
    if (ticket.status === STATUS.ESCALATED) {
      const rules = await client.query('SELECT priority, sla_hours FROM escalation_rules');
      slaHours = Object.fromEntries(rules.rows.map((r) => [r.priority, r.sla_hours]));
    }
    const now = new Date();
    const { changes, payload } = evaluateTransition(ticket, actor, to, input, {
      now,
      disputeWindowMs: config.dispute.windowHours * HOUR_MS,
      slaHours,
    });

    if (to === STATUS.ASSIGNED) {
      const assignee = await client.query('SELECT id FROM users WHERE id = $1 AND role = $2', [
        input.assigneeId,
        ROLES.OFFICER,
      ]);
      if (!assignee.rows[0]) throw unprocessable('INVALID_ASSIGNEE', 'The assignee must be an existing grievance officer');
    }

    const values = [ticket.id];
    const sets = [];
    for (const col of UPDATABLE_COLUMNS) {
      if (col in changes) {
        values.push(changes[col]);
        sets.push(`${col} = $${values.length}`);
      }
    }
    values.push(now);
    sets.push(`updated_at = $${values.length}`);
    const updated = (
      await client.query(`UPDATE tickets SET ${sets.join(', ')}, version = version + 1 WHERE id = $1 RETURNING *`, values)
    ).rows[0];

    await appendAuditEvent(client, { ticketId: ticket.id, actor, action: to, payload });

    // Relevant users: the petitioner (if registered), the current assignee, and all administrators on escalation.
    const recipients = [updated.created_by, updated.assigned_to];
    if (to === STATUS.ESCALATED) recipients.push(...(await staffIds(client, [ROLES.ADMIN])));
    const actorId = actor.type === ACTOR.USER ? actor.id : null;
    const message =
      to === STATUS.ASSIGNED
        ? `Case #${shortId(ticket.id)} "${ticket.title}" was assigned for handling`
        : `Case #${shortId(ticket.id)} "${ticket.title}" moved from ${ticket.status} to ${to}`;
    const notifications = await createNotifications(client, {
      ticketId: ticket.id,
      userIds: recipients.filter((id) => id && id !== actorId),
      message,
    });

    return { ticketId: ticket.id, notifications };
  });

  if (!outcome) return null;
  publishNotifications(outcome.notifications); // only after COMMIT
  clearStatsCache();
  if (actor.type === ACTOR.SYSTEM) return { ticketId: outcome.ticketId, status: to };
  // The actor just passed every access check inside the transaction; e.g. an officer who assigns a case to a
  // colleague no longer "sees" it afterwards, but must still receive the result of the change they committed.
  return getTicketDetail(actor, outcome.ticketId, { skipAccessCheck: true });
}

// ------------------------------------------------------------------ comments

export async function addComment({ ticketId, actor, body }) {
  const text = body.trim();
  const outcome = await withTransaction(async (client) => {
    const ticket = await lockTicket(client, ticketId); // serialises the audit sequence for this ticket
    if (!ticket || !canView(ticket, actor)) throw notFound('Ticket not found');
    if (!canComment(ticket, actor)) throw forbidden('You may not comment on this ticket');

    const comment = (
      await client.query(
        `INSERT INTO comments (ticket_id, author_type, author_id, body) VALUES ($1, $2, $3, $4) RETURNING *`,
        [ticket.id, actor.type, actor.type === ACTOR.USER ? actor.id : null, text],
      )
    ).rows[0];

    await appendAuditEvent(client, {
      ticketId: ticket.id,
      actor,
      action: AUDIT.COMMENT_ADDED,
      payload: { commentId: comment.id, bodyHash: sha256Hex(text) },
    });

    const actorId = actor.type === ACTOR.USER ? actor.id : null;
    const notifications = await createNotifications(client, {
      ticketId: ticket.id,
      userIds: [ticket.created_by, ticket.assigned_to].filter((id) => id && id !== actorId),
      message: `New comment on case #${shortId(ticket.id)} "${ticket.title}"`,
    });
    return { comment, notifications };
  });

  publishNotifications(outcome.notifications);
  return {
    id: outcome.comment.id,
    authorType: outcome.comment.author_type,
    authorName: actor.type === ACTOR.USER ? actor.name ?? null : null,
    body: outcome.comment.body,
    createdAt: outcome.comment.created_at,
  };
}

// ------------------------------------------------------------------ reads

export async function listTickets(actor, { status, category, priority, page = 1, limit = 20 } = {}) {
  const where = [];
  const values = [];
  const add = (sql, v) => {
    values.push(v);
    where.push(sql.replace('?', `$${values.length}`));
  };

  if (actor.role === ROLES.STUDENT) add('t.created_by = ?', actor.id);
  else if (actor.role === ROLES.OFFICER) {
    values.push(actor.id);
    where.push(`(t.assigned_to = $${values.length} OR t.status = 'FILED')`);
  }
  if (status) add('t.status = ?', status);
  if (category) add('t.category = ?', category);
  if (priority) add('t.priority = ?', priority);

  values.push(limit, (page - 1) * limit);
  const { rows } = await pool.query(
    `${SELECT_TICKET.replace('SELECT t.*,', 'SELECT t.*, COUNT(*) OVER() AS total_count,')}
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY t.created_at DESC, t.id
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return {
    page,
    limit,
    total: rows[0]?.total_count ?? 0,
    items: rows.map((r) => {
      const { description, ...summary } = toTicketDto(r, actor);
      return summary; // list view omits the long description
    }),
  };
}

export async function getTicketDetail(actor, ticketId, { skipAccessCheck = false } = {}) {
  const row = await loadTicketWithNames(pool, ticketId);
  const viewer = actor;
  if (!row || (!skipAccessCheck && !canView(row, viewer))) throw notFound('Ticket not found');

  const [comments, attachments, timeline] = await Promise.all([
    pool.query(
      `SELECT c.id, c.author_type, u.name AS author_name, c.body, c.created_at
       FROM comments c LEFT JOIN users u ON u.id = c.author_id
       WHERE c.ticket_id = $1 ORDER BY c.created_at, c.id`,
      [ticketId],
    ),
    pool.query(
      'SELECT id, file_name, mime_type, size_bytes, sha256, created_at FROM attachments WHERE ticket_id = $1 ORDER BY created_at, id',
      [ticketId],
    ),
    getTimeline(ticketId),
  ]);

  return {
    ticket: toTicketDto(row, viewer),
    comments: comments.rows.map((c) => ({
      id: c.id,
      authorType: c.author_type,
      authorName: c.author_name,
      body: c.body,
      createdAt: c.created_at,
    })),
    attachments: attachments.rows.map((a) => ({
      id: a.id,
      fileName: a.file_name,
      mimeType: a.mime_type,
      sizeBytes: a.size_bytes,
      sha256: a.sha256,
      createdAt: a.created_at,
    })),
    timeline,
    availableTransitions: availableTransitions(row, viewer),
    canComment: canComment(row, viewer),
    canVerifyAudit: canVerify(row, viewer),
  };
}

export async function getTicketForActor(actor, ticketId) {
  const { rows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);
  if (!rows[0] || !canView(rows[0], actor)) throw notFound('Ticket not found');
  return rows[0];
}

export async function getAttachmentFile(actor, ticketId, attachmentId) {
  await getTicketForActor(actor, ticketId);
  const { rows } = await pool.query(
    'SELECT file_name, stored_name, mime_type FROM attachments WHERE id = $1 AND ticket_id = $2',
    [attachmentId, ticketId],
  );
  if (!rows[0]) throw notFound('Attachment not found');
  return { path: storedPath(rows[0].stored_name), fileName: rows[0].file_name, mimeType: rows[0].mime_type };
}

export async function findTicketByReceipt(token) {
  const trimmed = typeof token === 'string' ? token.trim() : '';
  if (!trimmed) return null;

  // 1. Direct search by Complaint ID (UUID)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  if (isUuid) {
    const { rows } = await pool.query('SELECT id FROM tickets WHERE id = $1', [trimmed]);
    if (rows[0]?.id) return rows[0].id;
  }

  // 2. Search by receipt_token_hash
  const { rows } = await pool.query(
    'SELECT id FROM tickets WHERE receipt_token_hash = $1',
    [hashReceiptToken(trimmed)],
  );
  return rows[0]?.id ?? null;
}
