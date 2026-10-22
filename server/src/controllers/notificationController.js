import { asyncHandler } from '../utils/asyncHandler.js';
import { addStream } from '../services/sseHub.js';
import * as notifications from '../services/notificationService.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await notifications.listNotifications(req.user.id, req.query));
});

export const markRead = asyncHandler(async (req, res) => {
  res.json({ notification: await notifications.markRead(req.user.id, req.params.id) });
});

export const markAllRead = asyncHandler(async (req, res) => {
  res.json(await notifications.markAllRead(req.user.id));
});

/** Server-Sent Events: one-way, server -> browser. Offline users read stored notifications instead. */
export const stream = (req, res) => {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // do not let nginx buffer the stream
  });
  res.flushHeaders();
  res.write(`retry: 5000\nevent: ready\ndata: {}\n\n`);
  addStream(req.user.id, res);
};
