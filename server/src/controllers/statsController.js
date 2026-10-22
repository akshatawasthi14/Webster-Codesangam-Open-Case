import { asyncHandler } from '../utils/asyncHandler.js';
import { getPublicStats } from '../services/statsService.js';

export const publicStats = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=30');
  res.json(await getPublicStats());
});
