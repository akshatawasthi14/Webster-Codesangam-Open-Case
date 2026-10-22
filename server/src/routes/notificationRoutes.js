import { Router } from 'express';
import * as notifications from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notificationListQuery } from '../validators/admin.validators.js';
import { notificationParams } from '../validators/common.validators.js';

const router = Router();
router.use(requireAuth);
router.get('/', validate({ query: notificationListQuery }), notifications.list);
router.get('/stream', notifications.stream); // must stay above '/:id'
router.post('/read-all', notifications.markAllRead);
router.post('/:id/read', validate({ params: notificationParams }), notifications.markRead);
export default router;
