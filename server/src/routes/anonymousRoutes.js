import { Router } from 'express';
import * as tickets from '../controllers/ticketController.js';
import { requireReceipt } from '../middleware/auth.js';
import { anonymousFilingLimiter, receiptLimiter } from '../middleware/rateLimit.js';
import { uploadAttachments } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { anonAttachmentParams } from '../validators/common.validators.js';
import { commentBody, createTicketBody, disputeBody } from '../validators/ticket.validators.js';

/**
 * Mounted WITHOUT the session middleware: anonymous requests never read or create a session,
 * so nothing links them to an account. Access afterwards is by receipt token (X-Receipt-Token header).
 */
const router = Router();

router.post('/tickets', anonymousFilingLimiter, uploadAttachments, validate({ body: createTicketBody }), tickets.createAnonymous);

router.use('/case', receiptLimiter, requireReceipt);
router.get('/case', tickets.get);
router.post('/case/comments', validate({ body: commentBody }), tickets.comment);
router.post('/case/dispute', validate({ body: disputeBody }), tickets.dispute);
router.get('/case/audit/verify', tickets.verifyAudit);
router.get('/case/attachments/:attachmentId', validate({ params: anonAttachmentParams }), tickets.downloadAttachment);

export default router;
