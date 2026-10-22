import { asyncHandler } from '../utils/asyncHandler.js';
import { createStaffUser, listOfficers } from '../services/authService.js';
import { listRules, updateRule } from '../services/slaService.js';

export const officers = asyncHandler(async (req, res) => res.json({ officers: await listOfficers() }));

export const createStaff = asyncHandler(async (req, res) => {
  res.status(201).json({ user: await createStaffUser(req.body) });
});

export const slaRules = asyncHandler(async (req, res) => res.json({ rules: await listRules() }));

export const setSlaRule = asyncHandler(async (req, res) => {
  res.json({ rule: await updateRule(req.params.priority, req.body.slaHours) });
});
