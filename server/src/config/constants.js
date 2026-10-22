export const ROLES = Object.freeze({
  STUDENT: 'STUDENT',
  OFFICER: 'GRIEVANCE_OFFICER',
  ADMIN: 'ADMINISTRATOR',
});

export const STATUS = Object.freeze({
  FILED: 'FILED',
  ASSIGNED: 'ASSIGNED',
  IN_REVIEW: 'IN_REVIEW',
  RESOLVED: 'RESOLVED',
  ESCALATED: 'ESCALATED',
});

export const ACTOR = Object.freeze({
  USER: 'USER',
  ANON: 'ANON_PETITIONER',
  SYSTEM: 'SYSTEM',
});

export const PRIORITIES = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const CATEGORIES = Object.freeze([
  'ACADEMIC',
  'HOSTEL',
  'HARASSMENT',
  'ADMINISTRATION',
  'FINANCE',
  'INFRASTRUCTURE',
  'OTHER',
]);

// Statuses in which the SLA clock is running (the deadline job only looks at these).
export const SLA_ACTIVE_STATUSES = Object.freeze([STATUS.FILED, STATUS.ASSIGNED, STATUS.IN_REVIEW]);

// Audit actions. Status changes use the target status name as the action.
export const AUDIT = Object.freeze({
  COMMENT_ADDED: 'COMMENT_ADDED',
  ATTACHMENT_ADDED: 'ATTACHMENT_ADDED',
});

export const ALLOWED_UPLOAD_MIME = Object.freeze([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
]);
