import { apiRequest } from './client';

export const listUsers = (params, options) => apiRequest('/users', { params, ...options });
export const createUser = (body) => apiRequest('/users', { method: 'POST', body });
export const updateUser = (id, body) => apiRequest(`/users/${id}`, { method: 'PATCH', body });
