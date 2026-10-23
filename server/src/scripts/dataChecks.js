import User from '../models/User.js';
import Leave from '../models/Leave.js';
import Holiday from '../models/Holiday.js';
import { LEAVE_TYPES, LEAVE_STATUS, ACTIVE_LEAVE_STATUSES, ROLES } from '../config/constants.js';
import { toDateOnly } from '../utils/dates.js';

const isUtcMidnight = (d) => d instanceof Date && d.getTime() % 86_400_000 === 0;
const label = (u) => (u ? `${u.name} <${u.email}>` : 'unknown user');
const range = (l) => `${l.leaveType} ${toDateOnly(l.startDate)}..${toDateOnly(l.endDate)} (${l.status})`;

/**
 * Read-only consistency checks over users, leaves and holidays.
 * Returns { errors: string[], warnings: string[], stats }. Never writes.
 */
export const runDataChecks = async () => {
  const errors = [];
  const warnings = [];

  const [users, leaves, holidays] = await Promise.all([
    User.find().lean(),
    Leave.find().sort({ startDate: 1 }).lean(),
    Holiday.find().lean(),
  ]);
  const byId = new Map(users.map((u) => [String(u._id), u]));

  // Users
  if (!users.some((u) => u.role === ROLES.ADMIN && u.isActive)) errors.push('No active admin user exists');
  for (const u of users) {
    if (!Object.values(ROLES).includes(u.role)) errors.push(`${label(u)} has invalid role "${u.role}"`);
    if (u.manager) {
      const m = byId.get(String(u.manager));
      if (!m) errors.push(`${label(u)} reports to a manager that does not exist`);
      else if (String(m._id) === String(u._id)) errors.push(`${label(u)} is their own manager`);
      else if (m.role !== ROLES.MANAGER) errors.push(`${label(u)} reports to ${label(m)}, who is not a manager`);
      else if (!m.isActive && u.isActive) warnings.push(`${label(u)} reports to deactivated manager ${label(m)}`);
    }
    // Reporting cycle (A -> B -> A)
    const seen = new Set([String(u._id)]);
    let cur = u.manager && byId.get(String(u.manager));
    while (cur) {
      if (seen.has(String(cur._id))) {
        errors.push(`Circular reporting line involving ${label(u)}`);
        break;
      }
      seen.add(String(cur._id));
      cur = cur.manager && byId.get(String(cur.manager));
    }
  }

  // Leaves
  const approvedDays = new Map(); // userId -> { type: days }
  const pendingDays = new Map();
  const activeByUser = new Map();
  for (const l of leaves) {
    const emp = byId.get(String(l.employee));
    if (!emp) {
      errors.push(`Leave ${l._id} belongs to a user that does not exist`);
      continue;
    }
    if (!Object.hasOwn(LEAVE_TYPES, l.leaveType)) errors.push(`Leave ${l._id} has invalid type "${l.leaveType}"`);
    if (!Object.values(LEAVE_STATUS).includes(l.status)) errors.push(`Leave ${l._id} has invalid status "${l.status}"`);
    if (l.startDate > l.endDate) errors.push(`${label(emp)}: ${range(l)} ends before it starts`);
    if (!isUtcMidnight(l.startDate) || !isUtcMidnight(l.endDate)) errors.push(`${label(emp)}: ${range(l)} dates are not calendar dates`);
    if (!(l.days > 0) || (l.days * 2) % 1 !== 0) errors.push(`${label(emp)}: ${range(l)} has invalid day count ${l.days}`);
    if (l.halfDay && (l.days !== 0.5 || toDateOnly(l.startDate) !== toDateOnly(l.endDate))) {
      errors.push(`${label(emp)}: ${range(l)} is a half day but not 0.5 day on a single date`);
    }
    if ([LEAVE_STATUS.APPROVED, LEAVE_STATUS.REJECTED].includes(l.status)) {
      if (!l.reviewedBy || !l.reviewedAt) errors.push(`${label(emp)}: ${range(l)} has no reviewer recorded`);
      else if (!byId.get(String(l.reviewedBy))) warnings.push(`${label(emp)}: ${range(l)} reviewer no longer exists`);
    }
    if (l.status === LEAVE_STATUS.REJECTED && !(l.managerComment || '').trim()) {
      errors.push(`${label(emp)}: ${range(l)} was rejected without a comment`);
    }
    if (l.status === LEAVE_STATUS.CANCELLED && !l.cancelledAt) errors.push(`${label(emp)}: ${range(l)} is cancelled but has no cancelledAt`);

    const key = String(emp._id);
    const add = (map) => {
      const t = map.get(key) || {};
      t[l.leaveType] = (t[l.leaveType] || 0) + l.days;
      map.set(key, t);
    };
    if (l.status === LEAVE_STATUS.APPROVED) add(approvedDays);
    if (l.status === LEAVE_STATUS.PENDING) add(pendingDays);
    if (ACTIVE_LEAVE_STATUSES.includes(l.status)) {
      const list = activeByUser.get(key) || [];
      for (const other of list) {
        if (other.startDate <= l.endDate && other.endDate >= l.startDate) {
          errors.push(`${label(emp)}: overlapping leaves ${range(other)} and ${range(l)}`);
        }
      }
      list.push(l);
      activeByUser.set(key, list);
    }
  }

  // Balances: balance must equal yearly total minus approved days
  for (const u of users) {
    const approved = approvedDays.get(String(u._id)) || {};
    const pending = pendingDays.get(String(u._id)) || {};
    for (const [type, total] of Object.entries(LEAVE_TYPES)) {
      const bal = u.leaveBalance?.[type];
      if (typeof bal !== 'number') {
        errors.push(`${label(u)}: missing ${type} balance`);
        continue;
      }
      if (bal < 0) errors.push(`${label(u)}: negative ${type} balance (${bal})`);
      if (bal > total) errors.push(`${label(u)}: ${type} balance ${bal} is above the yearly ${total}`);
      const expected = total - (approved[type] || 0);
      if (bal !== expected) {
        errors.push(`${label(u)}: ${type} balance is ${bal} but ${total} - ${approved[type] || 0} approved = ${expected}`);
      }
      if ((pending[type] || 0) > bal) {
        errors.push(`${label(u)}: ${pending[type]} pending ${type} days exceed the ${bal} available`);
      }
    }
  }

  // Holidays
  const holidayDates = new Set();
  for (const h of holidays) {
    if (!isUtcMidnight(h.date)) errors.push(`Holiday "${h.name}" is not stored as a calendar date`);
    const k = toDateOnly(h.date);
    if (holidayDates.has(k)) errors.push(`Two holidays on ${k}`);
    holidayDates.add(k);
    if (!(h.name || '').trim()) errors.push(`Holiday on ${k} has no name`);
  }

  const count = (s) => leaves.filter((l) => l.status === s).length;
  return {
    errors,
    warnings,
    stats: {
      users: users.length,
      activeUsers: users.filter((u) => u.isActive).length,
      leaves: leaves.length,
      pending: count(LEAVE_STATUS.PENDING),
      approved: count(LEAVE_STATUS.APPROVED),
      rejected: count(LEAVE_STATUS.REJECTED),
      cancelled: count(LEAVE_STATUS.CANCELLED),
      holidays: holidays.length,
    },
  };
};
