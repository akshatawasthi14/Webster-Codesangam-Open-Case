import { Router } from 'express';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sessionMiddleware } from '../middleware/auth.js';
import adminRoutes, { userRouter } from './adminRoutes.js';
import anonymousRoutes from './anonymousRoutes.js';
import authRoutes from './authRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import publicRoutes from './publicRoutes.js';
import ticketRoutes from './ticketRoutes.js';

const router = Router();

/** Health endpoint for the process supervisor / load balancer. A broken database is reported, never hidden. */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', time: new Date().toISOString() });
  }),
);

// ---- Routes that must never see a session (anonymous + public) -------------
router.use('/anonymous', anonymousRoutes);
router.use('/public', publicRoutes);

// ---- Everything below is for signed-in users -------------------------------
router.use(sessionMiddleware);
router.use('/auth', authRoutes);
router.use('/tickets', ticketRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRouter); // GET /users/officers
router.use('/admin', adminRoutes); // POST /admin/users, /admin/sla-rules

export default router;
