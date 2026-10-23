export const ROLES = Object.freeze({
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
  ADMIN: 'admin',
});

// Yearly allowance in days for each leave type.
export const LEAVE_TYPES = Object.freeze({
  casual: 12,
  sick: 8,
  paid: 15,
});

export const LEAVE_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
});

// Leaves in these statuses block overlapping requests.
export const ACTIVE_LEAVE_STATUSES = [LEAVE_STATUS.PENDING, LEAVE_STATUS.APPROVED];

export const REASON_MIN = 3;
export const REASON_MAX = 500;
