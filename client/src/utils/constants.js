export const ROLES = Object.freeze({
  STUDENT: 'STUDENT',
  OFFICER: 'GRIEVANCE_OFFICER',
  ADMIN: 'ADMINISTRATOR',
});

export const ROLE_LABELS = Object.freeze({
  [ROLES.STUDENT]: 'Student',
  [ROLES.OFFICER]: 'Grievance Officer',
  [ROLES.ADMIN]: 'Administrator',
});

export const STATUS = Object.freeze({
  FILED: 'FILED',
  ASSIGNED: 'ASSIGNED',
  IN_REVIEW: 'IN_REVIEW',
  RESOLVED: 'RESOLVED',
  ESCALATED: 'ESCALATED',
});

export const STATUS_DETAILS = Object.freeze({
  [STATUS.FILED]: {
    label: 'Filed',
    description: 'Submitted and logged into immutable audit chain. Pending officer assignment.',
    color: 'bg-silver-200 text-silver-800 border-silver-400',
    indicator: 'bg-silver-500',
  },
  [STATUS.ASSIGNED]: {
    label: 'Assigned',
    description: 'Assigned to a designated grievance officer. Pending review commencement.',
    color: 'bg-blue-50 text-blue-800 border-blue-200',
    indicator: 'bg-blue-500',
  },
  [STATUS.IN_REVIEW]: {
    label: 'In Review',
    description: 'Active investigation underway by responsible staff member.',
    color: 'bg-marigold-100 text-marigold-900 border-marigold-300',
    indicator: 'bg-marigold-500',
  },
  [STATUS.RESOLVED]: {
    label: 'Resolved',
    description: 'Formal redress concluded with official resolution note.',
    color: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    indicator: 'bg-emerald-500',
  },
  [STATUS.ESCALATED]: {
    label: 'Escalated',
    description: 'Elevated for immediate administrative intervention due to SLA breach or petitioner dispute.',
    color: 'bg-rose-50 text-rose-800 border-rose-300',
    indicator: 'bg-rose-500',
  },
});

export const PRIORITIES = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const PRIORITY_DETAILS = Object.freeze({
  LOW: {
    label: 'Low',
    defaultSla: '7 days (168h)',
    color: 'bg-silver-100 text-silver-700 border-silver-300',
    badge: 'border-silver-400 text-silver-700',
    dot: 'bg-silver-400',
  },
  MEDIUM: {
    label: 'Medium',
    defaultSla: '3 days (72h)',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    badge: 'border-blue-400 text-blue-700',
    dot: 'bg-blue-500',
  },
  HIGH: {
    label: 'High',
    defaultSla: '24 hours',
    color: 'bg-amber-50 text-amber-800 border-amber-300',
    badge: 'border-amber-500 text-amber-800',
    dot: 'bg-amber-500',
  },
  CRITICAL: {
    label: 'Critical',
    defaultSla: '8 hours',
    color: 'bg-rose-50 text-rose-800 border-rose-300',
    badge: 'border-rose-500 text-rose-800 font-bold',
    dot: 'bg-rose-600',
  },
});

export const CATEGORIES = Object.freeze([
  'ACADEMIC',
  'HOSTEL',
  'HARASSMENT',
  'ADMINISTRATION',
  'FINANCE',
  'INFRASTRUCTURE',
  'OTHER',
]);

export const CATEGORY_DETAILS = Object.freeze({
  ACADEMIC: { label: 'Academic & Curriculum', icon: 'GraduationCap' },
  HOSTEL: { label: 'Hostel & Residential Life', icon: 'Home' },
  HARASSMENT: { label: 'Harassment & Safety', icon: 'ShieldAlert' },
  ADMINISTRATION: { label: 'Administrative & Staff', icon: 'Briefcase' },
  FINANCE: { label: 'Finance & Fee Accounts', icon: 'CreditCard' },
  INFRASTRUCTURE: { label: 'Campus Infrastructure', icon: 'Building' },
  OTHER: { label: 'General / Other Grievances', icon: 'HelpCircle' },
});

