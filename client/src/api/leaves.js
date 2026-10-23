import { apiRequest } from './client';

export const calculateLeaveDays = (params, options) => apiRequest('/leaves/calculate', { params, ...options });
export const getMyBalance = (options) => apiRequest('/leaves/balance', options);
export const applyLeave = (body) => apiRequest('/leaves', { method: 'POST', body });
export const listMyLeaves = (params, options) => apiRequest('/leaves/my', { params, ...options });
export const cancelLeave = (id) => apiRequest(`/leaves/${id}/cancel`, { method: 'PATCH' });
export const listTeamLeaves = (params, options) => apiRequest('/leaves/team', { params, ...options });
export const approveLeave = (id, comment) => apiRequest(`/leaves/${id}/approve`, { method: 'PATCH', body: { comment } });
export const rejectLeave = (id, comment) => apiRequest(`/leaves/${id}/reject`, { method: 'PATCH', body: { comment } });

// Fired after a manager approves/rejects, so counters (e.g. sidebar badge) can refresh.
export const TEAM_LEAVES_CHANGED = 'team-leaves:changed';
export const listAllLeaves = (params, options) => apiRequest('/leaves/all', { params, ...options });
