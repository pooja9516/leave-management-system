import mongoose from 'mongoose';
import Leave from '../models/Leave.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { todayUtc } from '../utils/dates.js';
import { computeLeaveDays, parseHalfDay } from './leaveDays.js';
import {
  ROLES,
  LEAVE_TYPES,
  LEAVE_STATUS,
  ACTIVE_LEAVE_STATUSES,
  REASON_MIN,
  REASON_MAX,
} from '../config/constants.js';

// Sum of pending days per leave type, e.g. { casual: 2, sick: 0, paid: 0.5 }.
export const getPendingDays = async (employeeId, session = null) => {
  const rows = await Leave.aggregate([
    { $match: { employee: new mongoose.Types.ObjectId(String(employeeId)), status: LEAVE_STATUS.PENDING } },
    { $group: { _id: '$leaveType', days: { $sum: '$days' } } },
  ]).session(session);

  const pending = Object.fromEntries(Object.keys(LEAVE_TYPES).map((type) => [type, 0]));
  rows.forEach(({ _id, days }) => {
    pending[_id] = days;
  });
  return pending;
};

// Per type: yearly total, current balance, days reserved by pending requests, and what is still available.
export const getBalanceSummary = async (user) => {
  const pending = await getPendingDays(user._id);
  return Object.entries(LEAVE_TYPES).map(([type, total]) => {
    const balance = user.leaveBalance?.[type] ?? 0;
    return { type, total, balance, pending: pending[type], available: Math.max(0, balance - pending[type]) };
  });
};

const validateInput = ({ leaveType, reason }) => {
  if (!Object.hasOwn(LEAVE_TYPES, leaveType)) {
    throw ApiError.badRequest(`Leave type must be one of: ${Object.keys(LEAVE_TYPES).join(', ')}`);
  }
  if (typeof reason !== 'string' || reason.trim().length < REASON_MIN) {
    throw ApiError.badRequest(`Please give a reason (at least ${REASON_MIN} characters)`);
  }
  if (reason.trim().length > REASON_MAX) {
    throw ApiError.badRequest(`Reason must be at most ${REASON_MAX} characters`);
  }
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateLabel = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

// e.g. "2 Nov 2026" or "2 Nov 2026 to 4 Nov 2026"
const formatRange = (leave) => {
  const start = dateLabel(leave.startDate);
  const end = dateLabel(leave.endDate);
  return start === end ? start : `${start} to ${end}`;
};

// The user's first pending/approved leave overlapping [startDate, endDate], or null.
export const findOverlappingLeave = (employeeId, startDate, endDate, session = null) =>
  Leave.findOne({
    employee: employeeId,
    status: { $in: ACTIVE_LEAVE_STATUSES },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  }).session(session);

export const overlapMessage = (leave) =>
  `These dates overlap with your ${leave.status} ${leave.leaveType} leave (${formatRange(leave)})`;

/**
 * Creates a pending leave request after validating dates, balance and overlaps.
 * Runs in a transaction that also bumps the user's leaveLock, so two concurrent
 * requests for the same user cannot both pass the overlap/balance checks.
 */
export const applyLeave = async (user, body = {}) => {
  // Users without a manager can still apply; their requests are reviewed by an admin.
  validateInput(body);

  const { days, startDate, endDate } = await computeLeaveDays(body);
  if (startDate < todayUtc()) throw ApiError.badRequest('Start date cannot be in the past');
  if (days === 0) {
    throw ApiError.badRequest('The selected dates fall on weekends or holidays. Please choose working days.');
  }

  const { leaveType } = body;
  const session = await mongoose.startSession();
  try {
    let leave;
    await session.withTransaction(async () => {
      await User.updateOne({ _id: user._id }, { $inc: { leaveLock: 1 } }, { session });
      const fresh = await User.findById(user._id).session(session);

      const overlap = await findOverlappingLeave(user._id, startDate, endDate, session);
      if (overlap) throw ApiError.conflict(overlapMessage(overlap));

      const pending = (await getPendingDays(user._id, session))[leaveType];
      const available = fresh.leaveBalance[leaveType] - pending;
      if (days > available) {
        const pendingNote = pending ? ` (${pending} more ${pending === 1 ? 'day is' : 'days are'} awaiting approval)` : '';
        throw ApiError.badRequest(
          `Not enough ${leaveType} leave: you requested ${days} but only ${Math.max(0, available)} available${pendingNote}`
        );
      }

      [leave] = await Leave.create(
        [
          {
            employee: user._id,
            leaveType,
            startDate,
            endDate,
            halfDay: parseHalfDay(body.halfDay),
            days,
            reason: body.reason,
          },
        ],
        { session }
      );
    });
    return leave;
  } finally {
    await session.endSession();
  }
};

// A leave can be cancelled while pending, or when approved and not yet started.
export const isCancellable = (leave) =>
  leave.status === LEAVE_STATUS.PENDING ||
  (leave.status === LEAVE_STATUS.APPROVED && leave.startDate > todayUtc());

/**
 * Cancels the employee's own leave. Approved (future) leaves give their days back.
 * The status-guarded update inside a transaction means a concurrent approve/cancel
 * can't both succeed, and balance is restored at most once.
 */
export const cancelLeave = async (user, leaveId) => {
  if (!mongoose.isValidObjectId(leaveId)) throw ApiError.badRequest('Invalid leave id');

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const leave = await Leave.findOne({ _id: leaveId, employee: user._id }).session(session);
      // 404 (not 403) so users can't probe other people's leave ids.
      if (!leave) throw ApiError.notFound('Leave not found');

      if (leave.status === LEAVE_STATUS.REJECTED || leave.status === LEAVE_STATUS.CANCELLED) {
        throw ApiError.badRequest(`This leave is already ${leave.status}; its status can no longer be changed`);
      }
      if (!isCancellable(leave)) {
        throw ApiError.badRequest('This leave has already started, so it can no longer be cancelled');
      }

      const wasApproved = leave.status === LEAVE_STATUS.APPROVED;
      result = await Leave.findOneAndUpdate(
        { _id: leave._id, status: leave.status },
        { status: LEAVE_STATUS.CANCELLED, cancelledAt: new Date() },
        { new: true, session }
      );
      if (!result) throw ApiError.conflict('This leave was just updated. Please refresh and try again.');

      if (wasApproved) {
        await User.updateOne(
          { _id: user._id },
          { $inc: { [`leaveBalance.${leave.leaveType}`]: leave.days, leaveLock: 1 } },
          { session }
        );
      }
    });
    return result;
  } finally {
    await session.endSession();
  }
};

const COMMENT_MAX = 500;

/**
 * Approves or rejects a pending leave. Managers may review only their own team;
 * admins may review any leave (e.g. for users without a manager).
 * Approval deducts the balance; both run in a transaction with a status guard,
 * so a leave can't be reviewed twice or approved while it is being cancelled.
 */
export const reviewLeave = async (reviewer, leaveId, { decision, comment }) => {
  if (!mongoose.isValidObjectId(leaveId)) throw ApiError.badRequest('Invalid leave id');
  const text = typeof comment === 'string' ? comment.trim() : '';
  if (comment !== undefined && comment !== null && typeof comment !== 'string') {
    throw ApiError.badRequest('Comment must be text');
  }
  if (decision === LEAVE_STATUS.REJECTED && text.length < REASON_MIN) {
    throw ApiError.badRequest(`Please add a comment explaining the rejection (at least ${REASON_MIN} characters)`);
  }
  if (text.length > COMMENT_MAX) throw ApiError.badRequest(`Comment must be at most ${COMMENT_MAX} characters`);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const leave = await Leave.findById(leaveId).session(session);
      const employee = leave && (await User.findById(leave.employee).session(session));
      const isAdmin = reviewer.role === ROLES.ADMIN;
      // Not found and "not your team" look the same, so managers can't probe other teams.
      if (!leave || !employee || (!isAdmin && String(employee.manager) !== String(reviewer._id))) {
        throw ApiError.notFound('Leave not found');
      }
      if (String(employee._id) === String(reviewer._id)) {
        throw ApiError.forbidden('You cannot review your own leave');
      }
      if (leave.status !== LEAVE_STATUS.PENDING) {
        throw ApiError.badRequest(`This leave is already ${leave.status}; its status can no longer be changed`);
      }

      if (decision === LEAVE_STATUS.APPROVED) {
        // Deduct only if the balance still covers it (guarded, atomic).
        const { modifiedCount } = await User.updateOne(
          { _id: employee._id, [`leaveBalance.${leave.leaveType}`]: { $gte: leave.days } },
          { $inc: { [`leaveBalance.${leave.leaveType}`]: -leave.days, leaveLock: 1 } },
          { session }
        );
        if (!modifiedCount) {
          throw ApiError.badRequest(
            `${employee.name} no longer has enough ${leave.leaveType} leave (${employee.leaveBalance[leave.leaveType]} left, ${leave.days} requested)`
          );
        }
      } else {
        await User.updateOne({ _id: employee._id }, { $inc: { leaveLock: 1 } }, { session });
      }

      result = await Leave.findOneAndUpdate(
        { _id: leave._id, status: LEAVE_STATUS.PENDING },
        { status: decision, managerComment: text, reviewedBy: reviewer._id, reviewedAt: new Date() },
        { new: true, session }
      );
      if (!result) throw ApiError.conflict('This leave was just updated. Please refresh and try again.');
    });
    return result;
  } finally {
    await session.endSession();
  }
};
