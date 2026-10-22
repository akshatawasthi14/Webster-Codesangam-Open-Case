import { pool } from '../db/pool.js';
import { notFound } from '../utils/errors.js';

export async function listRules() {
  const { rows } = await pool.query(
    `SELECT priority, sla_hours FROM escalation_rules
     ORDER BY CASE priority WHEN 'LOW' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'HIGH' THEN 3 ELSE 4 END`,
  );
  return rows.map((r) => ({ priority: r.priority, slaHours: r.sla_hours }));
}

/** Changes apply to tickets filed afterwards; existing deadlines are never silently moved. */
export async function updateRule(priority, slaHours) {
  const { rows } = await pool.query(
    'UPDATE escalation_rules SET sla_hours = $2 WHERE priority = $1 RETURNING priority, sla_hours',
    [priority, slaHours],
  );
  if (!rows[0]) throw notFound('SLA rule not found');
  return { priority: rows[0].priority, slaHours: rows[0].sla_hours };
}
