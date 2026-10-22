import { Router } from 'express';
import { publicStats } from '../controllers/statsController.js';

const router = Router();
router.get('/stats', publicStats); // aggregate only; small counts suppressed
export default router;
