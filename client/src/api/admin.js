import { apiRequest } from './client.js';

export async function getOfficers() {
  const data = await apiRequest('/users/officers');
  return data.officers;
}

export async function createStaff({ name, email, password, role }) {
  const data = await apiRequest('/admin/users', {
    method: 'POST',
    body: { name, email, password, role },
  });
  return data.user;
}

export async function getSlaRules() {
  const data = await apiRequest('/admin/sla-rules');
  return data.rules;
}

export async function updateSlaRule(priority, slaHours) {
  const data = await apiRequest(`/admin/sla-rules/${priority}`, {
    method: 'PUT',
    body: { slaHours: Number(slaHours) },
  });
  return data.rule;
}

