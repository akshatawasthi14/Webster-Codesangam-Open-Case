import { apiRequest } from './client.js';

export async function getPublicStats() {
  return apiRequest('/public/stats');
}

