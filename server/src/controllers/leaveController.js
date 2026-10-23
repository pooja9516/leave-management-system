import Leave from '../models/Leave.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parsePagination, paginated, escapeRegex } from '../utils/pagination.js';
import { computeLeaveDays } from '../services/leaveDays.js';
import {
  applyLeave,
  cancelLeave,
  getBalanceSummary,
  isCancellable,
  reviewLeave,
  findOverlappingLeave,
  overlapMessage,
} from '../services/leaveService.js';
import { LEAVE_TYPES, LEAVE_STATUS } from '../config/constants.js';

const REVIEWER_FIELDS = 'name email';
const EMPLOYEE_FIELDS = 'name email leaveBalance isActive';

const leaveFilters = ({ status, leaveType }) => {
  const filter = {};
  if (status) {
    if (!Object.values(LEAVE_STATUS).includes(status)) throw ApiError.badRequest('Invalid status filter');
    filter.status = status;
  }
  if (leaveType) {
    if (!Object.hasOwn(LEAVE_TYPES, leaveType)) throw ApiError.badRequest('Invalid leave type filter');
    filter.leaveType = leaveType;
  }
  return filter;
};

// Adds `canCancel` so the client never has to re-implement the rule.
const withActions = (leave) => ({ ...leave.toJSON(), canCancel: isCancellable(leave) });

// Preview for the apply form: working days used, plus any of the user's own
// pending/approved leaves that would clash (so the form can block before submitting).
export const calculateDays = asyncHandler(async (req, res) => {
  const { days, workingDates, weekendDates, holidays, startDate, endDate } = await computeLeaveDays(req.query);
  const clash = await findOverlappingLeave(req.user._id, startDate, endDate);
  const overlap = clash && {
    _id: clash._id,
    leaveType: clash.leaveType,
    status: clash.status,
    startDate: clash.startDate,
    endDate: clash.endDate,
    message: overlapMessage(clash),
  };
  res.json({ days, workingDates, weekendDates, holidays, overlap: overlap || null });
});

export const getMyBalance = asyncHandler(async (req, res) => {
  res.json({ balance: await getBalanceSummary(req.user) });
});

export const createLeave = asyncHandler(async (req, res) => {
  const leave = await applyLeave(req.user, req.body);
  res.status(201).json({ leave });
});

export const listMyLeaves = asyncHandler(async (req, res) => {
  const filter = { employee: req.user._id, ...leaveFilters(req.query) };

  const paging = parsePagination(req.query);
  const [leaves, total] = await Promise.all([
    Leave.find(filter)
      .populate('reviewedBy', REVIEWER_FIELDS)
      .sort({ startDate: -1, _id: -1 })
      .skip(paging.skip)
      .limit(paging.limit),
    Leave.countDocuments(filter),
  ]);

  res.json(paginated(leaves.map(withActions), total, paging));
});

export const cancelMyLeave = asyncHandler(async (req, res) => {
  const leave = await cancelLeave(req.user, req.params.id);
  await leave.populate('reviewedBy', REVIEWER_FIELDS);
  res.json({ leave: withActions(leave) });
});

// Lists leaves of employees matching `userFilter` (+ optional name/email search).
// Pending requests are listed soonest-first; everything else newest-first.
const listLeavesFor = async (userFilter, query) => {
  const filter = leaveFilters(query);
  const { search } = query;
  const scoped = Object.keys(userFilter).length > 0;
  const searching = typeof search === 'string' && search.trim();
  if (scoped || searching) {
    const users = { ...userFilter };
    if (searching) {
      const rx = new RegExp(escapeRegex(search.trim()), 'i');
      users.$or = [{ name: rx }, { email: rx }];
    }
    filter.employee = { $in: await User.find(users).distinct('_id') };
  }
  const sort = filter.status === LEAVE_STATUS.PENDING ? { startDate: 1, _id: 1 } : { startDate: -1, _id: -1 };

  const paging = parsePagination(query);
  const [leaves, total] = await Promise.all([
    Leave.find(filter)
      .populate('employee', EMPLOYEE_FIELDS)
      .populate('reviewedBy', REVIEWER_FIELDS)
      .sort(sort)
      .skip(paging.skip)
      .limit(paging.limit),
    Leave.countDocuments(filter),
  ]);
  return paginated(leaves, total, paging);
};

export const listTeamLeaves = asyncHandler(async (req, res) => {
  res.json(await listLeavesFor({ manager: req.user._id }, req.query));
});

// Admin: every leave in the organisation.
export const listAllLeaves = asyncHandler(async (req, res) => {
  res.json(await listLeavesFor({}, req.query));
});

const review = (decision) =>
  asyncHandler(async (req, res) => {
    const leave = await reviewLeave(req.user, req.params.id, { decision, comment: req.body?.comment });
    await leave.populate([
      { path: 'employee', select: EMPLOYEE_FIELDS },
      { path: 'reviewedBy', select: REVIEWER_FIELDS },
    ]);
    res.json({ leave });
  });

export const approveLeave = review(LEAVE_STATUS.APPROVED);
export const rejectLeave = review(LEAVE_STATUS.REJECTED);
