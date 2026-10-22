import { z } from 'zod';
import { PRIORITIES } from '../config/constants.js';

export const slaParams = z.object({ priority: z.enum(PRIORITIES) });
export const slaBody = z.object({ slaHours: z.number().int().min(1).max(24 * 365) });
export const notificationListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
  unreadOnly: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});
