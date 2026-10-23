import { apiRequest } from './client';

export const listHolidays = (params, options) => apiRequest('/holidays', { params, ...options });
export const createHoliday = (body) => apiRequest('/holidays', { method: 'POST', body });
export const updateHoliday = (id, body) => apiRequest(`/holidays/${id}`, { method: 'PATCH', body });
export const deleteHoliday = (id) => apiRequest(`/holidays/${id}`, { method: 'DELETE' });
