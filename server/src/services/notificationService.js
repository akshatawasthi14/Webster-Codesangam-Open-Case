import { pool } from '../db/pool.js';
import { notFound } from '../utils/errors.js';
import { sendToUser } from './sseHub.js';

const toDto = (r) => ({
  id: r.id,
  ticketId: r.ticket_id,
  message: r.message,
  read: r.read_at !== null,
  readAt: r.read_at,
  createdAt: r.created_at,
});

/**
 * Inserts notification rows INSIDE the caller's transaction, so they exist only if the change commits.
 * Returns the rows; the caller publishes them over SSE after COMMIT.
 */
export async function createNotifications(client, { ticketId, userIds, message }) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const { rows } = await client.query(
    `INSERT INTO notifications (user_id, ticket_id, message)
     SELECT u, $2, $3 FROM unnest($1::uuid[]) AS u
     RETURNING *`,
    [unique, ticketId, message],
  );
  return rows;
}

/** Real-time delivery for connected users. Call only after the transaction has committed. */
export function publishNotifications(rows) {
  for (const row of rows) sendToUser(row.user_id, 'notification', toDto(row));
}

export async function listNotifications(userId, { limit = 30, offset = 0, unreadOnly = false } = {}) {
  const [list, unread] = await Promise.all([
    pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1 AND ($2::boolean = FALSE OR read_at IS NULL)
       ORDER BY created_at DESC, id LIMIT $3 OFFSET $4`,
      [userId, unreadOnly, limit, offset],
    ),
    pool.query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [userId]),
  ]);
  return { unreadCount: unread.rows[0].n, items: list.rows.map(toDto) };
}

export async function markRead(userId, notificationId) {
  const { rows } = await pool.query(
    `UPDATE notifications SET read_at = COALESCE(read_at, NOW())
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [notificationId, userId],
  );
  if (!rows[0]) throw notFound('Notification not found');
  return toDto(rows[0]);
}

export async function markAllRead(userId) {
  const { rowCount } = await pool.query(
    'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
    [userId],
  );
  return { updated: rowCount };
}
