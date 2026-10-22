import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as admin from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { slaBody, slaParams } from '../validators/admin.validators.js';
import { createStaffBody } from '../validators/auth.validators.js';

const router = Router();
router.use(requireAuth);

router.post('/users', requireRole(ROLES.ADMIN), validate({ body: createStaffBody }), admin.createStaff);
router.get('/sla-rules', requireRole(ROLES.ADMIN), admin.slaRules);
router.put('/sla-rules/:priority', requireRole(ROLES.ADMIN), validate({ params: slaParams, body: slaBody }), admin.setSlaRule);
export default router;

/** Mounted at /api/users: the assignment dialog needs the officer list (officers and administrators assign tickets). */
export const userRouter = Router();
userRouter.use(requireAuth);
userRouter.get('/officers', requireRole(ROLES.OFFICER, ROLES.ADMIN), admin.officers);
