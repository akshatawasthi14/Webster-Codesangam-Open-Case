import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate, registerStudent } from '../services/authService.js';

const regenerate = (req) => new Promise((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve())));
const save = (req) => new Promise((resolve, reject) => req.session.save((e) => (e ? reject(e) : resolve())));
const destroy = (req) => new Promise((resolve, reject) => req.session.destroy((e) => (e ? reject(e) : resolve())));

async function startSession(req, user) {
  await regenerate(req); // new session id on login prevents session fixation
  req.session.userId = user.id;
  await save(req);
}

export const register = asyncHandler(async (req, res) => {
  const user = await registerStudent(req.body);
  await startSession(req, user);
  res.status(201).json({ user });
});

export const login = asyncHandler(async (req, res) => {
  const user = await authenticate(req.body);
  await startSession(req, user);
  res.json({ user });
});

export const logout = asyncHandler(async (req, res) => {
  await destroy(req);
  res.clearCookie('oc.sid');
  res.status(204).end();
});

export const me = (req, res) => res.json({ user: req.user });
