import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as tickets from '../controllers/ticketController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadAttachments } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { attachmentParams, idParams } from '../validators/common.validators.js';
import { commentBody, createTicketBody, listQuery, transitionBody } from '../validators/ticket.validators.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate({ query: listQuery }), tickets.list);
// Only students file grievances. Upload -> validate -> create (files are cleaned up on any failure).
router.post('/', requireRole(ROLES.STUDENT), uploadAttachments, validate({ body: createTicketBody }), tickets.create);

router.get('/:id', validate({ params: idParams }), tickets.get);
router.post('/:id/comments', validate({ params: idParams, body: commentBody }), tickets.comment);
router.post('/:id/transitions', validate({ params: idParams, body: transitionBody }), tickets.transition);
router.get('/:id/audit/verify', validate({ params: idParams }), tickets.verifyAudit);
router.get('/:id/attachments/:attachmentId', validate({ params: attachmentParams }), tickets.downloadAttachment);

export default router;
