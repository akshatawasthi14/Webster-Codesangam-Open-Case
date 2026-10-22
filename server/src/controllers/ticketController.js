import { ACTOR, STATUS } from '../config/constants.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { removeFiles } from '../utils/files.js';
import { readIdempotencyKey } from '../validators/ticket.validators.js';
import { verifyTicketAudit } from '../services/auditService.js';
import * as tickets from '../services/ticketService.js';
import { forbidden } from '../utils/errors.js';

/**
 * These handlers serve BOTH registered users (/api/tickets/:id/...) and anonymous petitioners
 * (/api/anonymous/case/...). req.actor is set by requireAuth or requireReceipt; for anonymous routes
 * the ticket id comes from the receipt token, never from the URL.
 */
const ticketIdOf = (req) => req.params.id ?? req.actor.ticketId;

async function fileTicket(req, res, actor) {
  const { replayed, ...result } = await tickets.createTicket({
    actor,
    data: req.body,
    files: req.files ?? [],
    idempotencyKey: readIdempotencyKey(req, { minLength: actor === null ? 32 : 16 }),
  });
  if (replayed) {
    await removeFiles(req.files); // the original ticket already owns its evidence
    req.files = [];
    return res.status(200).json({
      replayed: true,
      ticketId: result.ticketId,
      status: result.status,
      ...(actor === null
        ? { note: 'This filing was already received. The receipt token was shown only once, with the first response, and cannot be recovered.' }
        : {}),
    });
  }
  req.files = []; // ownership of the files moved to the ticket; do not clean them up
  res.status(201).json(result);
}

export const create = asyncHandler((req, res) => fileTicket(req, res, req.actor));

/** Anonymous filing: no session, no account, no IP/user-agent persisted. */
export const createAnonymous = asyncHandler((req, res) => fileTicket(req, res, null));

export const list = asyncHandler(async (req, res) => {
  res.json(await tickets.listTickets(req.actor, req.query));
});

export const get = asyncHandler(async (req, res) => {
  res.json(await tickets.getTicketDetail(req.actor, ticketIdOf(req)));
});

export const comment = asyncHandler(async (req, res) => {
  const created = await tickets.addComment({ ticketId: ticketIdOf(req), actor: req.actor, body: req.body.body });
  res.status(201).json({ comment: created });
});

export const transition = asyncHandler(async (req, res) => {
  const { to, version, assigneeId, note, reason } = req.body;
  const detail = await tickets.transitionTicket({
    ticketId: ticketIdOf(req),
    actor: req.actor,
    to,
    expectedVersion: version,
    input: { assigneeId, note, reason },
  });
  res.json(detail);
});

/** Petitioner disputes a resolution (registered petitioners or receipt-token holders). */
export const dispute = asyncHandler(async (req, res) => {
  const detail = await tickets.transitionTicket({
    ticketId: ticketIdOf(req),
    actor: req.actor,
    to: STATUS.ESCALATED,
    expectedVersion: req.body.version,
    input: { reason: req.body.reason },
  });
  res.json(detail);
});

export const verifyAudit = asyncHandler(async (req, res) => {
  const ticket = await tickets.getTicketForActor(req.actor, ticketIdOf(req));
  if (!tickets.canVerify(ticket, req.actor)) throw forbidden('You may not verify this ticket\'s audit chain');
  res.json(await verifyTicketAudit(ticket.id));
});

export const downloadAttachment = asyncHandler(async (req, res) => {
  const file = await tickets.getAttachmentFile(req.actor, ticketIdOf(req), req.params.attachmentId);
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Cache-Control', 'private, no-store');
  res.download(file.path, file.fileName); // Content-Disposition: attachment, so uploads are never rendered in-page
});

export const isAnonymousActor = (req) => req.actor?.type === ACTOR.ANON;
