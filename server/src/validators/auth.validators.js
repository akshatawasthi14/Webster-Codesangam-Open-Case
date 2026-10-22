import { z } from 'zod';
import { ROLES } from '../config/constants.js';

const email = z.string().trim().toLowerCase().email().max(254);
// bcrypt silently ignores everything after 72 bytes, so longer passwords would give a false sense of strength.
const password = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(72, 'Password must be at most 72 characters')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password must be at most 72 bytes');

export const registerBody = z.object({
  name: z.string().trim().min(1).max(120),
  email,
  password,
});

export const loginBody = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const createStaffBody = z.object({
  name: z.string().trim().min(1).max(120),
  email,
  password,
  role: z.enum([ROLES.OFFICER, ROLES.ADMIN]),
});
