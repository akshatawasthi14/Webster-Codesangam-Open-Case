import { apiRequest } from './client.js';

export async function login({ email, password }) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  return data.user;
}

export async function register({ name, email, password }) {
  const data = await apiRequest('/auth/register', {
    method: 'POST',
    body: { name, email, password },
  });
  return data.user;
}

export async function logout() {
  await apiRequest('/auth/logout', { method: 'POST' });
}

export async function getMe() {
  const data = await apiRequest('/auth/me');
  return data.user;
}

