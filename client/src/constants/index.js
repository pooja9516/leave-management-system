import { Sun, Thermometer, Plane } from 'lucide-react';

// Mirrors server/src/config/constants.js (yearly allowance in days).
export const LEAVE_TYPES = [
  { key: 'casual', label: 'Casual leave', total: 12, icon: Sun },
  { key: 'sick', label: 'Sick leave', total: 8, icon: Thermometer },
  { key: 'paid', label: 'Paid leave', total: 15, icon: Plane },
];

export const ROLES = {
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
  ADMIN: 'admin',
};

export const ROLE_BADGE_TONE = {
  admin: 'primary',
  manager: 'warning',
  employee: 'neutral',
};

export const LEAVE_STATUSES = [
  { key: 'pending', label: 'Pending', tone: 'warning' },
  { key: 'approved', label: 'Approved', tone: 'success' },
  { key: 'rejected', label: 'Rejected', tone: 'danger' },
  { key: 'cancelled', label: 'Cancelled', tone: 'neutral' },
];

export const leaveTypeLabel = (key) => LEAVE_TYPES.find((t) => t.key === key)?.label ?? key;
