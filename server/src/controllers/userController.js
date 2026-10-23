import mongoose from 'mongoose';
import User from '../models/User.js';
import Leave from '../models/Leave.js';
import { todayUtc } from '../utils/dates.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parsePagination, paginated, escapeRegex } from '../utils/pagination.js';
import { ROLES, LEAVE_STATUS } from '../config/constants.js';

const MANAGER_FIELDS = 'name email role isActive';
// leaveBalance is intentionally not editable here; it only changes through leave approval/cancellation.
const EDITABLE_FIELDS = ['name', 'email', 'password', 'role', 'manager', 'isActive'];

const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

// Throws if `managerId` can't be assigned as manager of `userId`.
const validateManager = async (managerId, userId) => {
  if (managerId === null || managerId === '') return null;
  if (!mongoose.isValidObjectId(managerId)) throw ApiError.badRequest('Invalid manager');
  if (userId && String(managerId) === String(userId)) {
    throw ApiError.badRequest('A user cannot be their own manager');
  }

  const manager = await User.findById(managerId).select('role isActive manager');
  if (!manager) throw ApiError.badRequest('Manager not found');
  if (manager.role !== ROLES.MANAGER) throw ApiError.badRequest('Assigned manager must have the manager role');
  if (!manager.isActive) throw ApiError.badRequest('Assigned manager is deactivated');

  // Walk up the chain to prevent cycles (A manages B, B manages A).
  if (userId) {
    const seen = new Set();
    let current = manager;
    while (current?.manager && !seen.has(String(current.manager))) {
      if (String(current.manager) === String(userId)) {
        throw ApiError.badRequest('This assignment would create a circular reporting line');
      }
      seen.add(String(current.manager));
      current = await User.findById(current.manager).select('manager');
    }
  }
  return manager._id;
};

export const listUsers = asyncHandler(async (req, res) => {
  const { role, isActive, manager, search } = req.query;
  const filter = {};

  if (role) {
    if (!Object.values(ROLES).includes(role)) throw ApiError.badRequest('Invalid role filter');
    filter.role = role;
  }
  if (isActive === 'true' || isActive === 'false') filter.isActive = isActive === 'true';
  if (manager) {
    if (!mongoose.isValidObjectId(manager)) throw ApiError.badRequest('Invalid manager filter');
    filter.manager = manager;
  }
  if (typeof search === 'string' && search.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const paging = parsePagination(req.query);
  const [users, total] = await Promise.all([
    User.find(filter)
      .populate('manager', MANAGER_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .skip(paging.skip)
      .limit(paging.limit),
    User.countDocuments(filter),
  ]);

  res.json(paginated(users, total, paging));
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate('manager', MANAGER_FIELDS);
  if (!user) throw ApiError.notFound('User not found');
  res.json({ user });
});

export const createUser = asyncHandler(async (req, res) => {
  const data = pick(req.body || {}, EDITABLE_FIELDS);
  data.manager = await validateManager(data.manager ?? null);

  const user = await User.create(data);
  await user.populate('manager', MANAGER_FIELDS);
  res.status(201).json({ user });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  const updates = pick(req.body || {}, EDITABLE_FIELDS);
  const isSelf = String(user._id) === String(req.user._id);

  if (isSelf && updates.role !== undefined && updates.role !== user.role) {
    throw ApiError.badRequest('You cannot change your own role');
  }
  if (isSelf && updates.isActive === false) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }
  if (updates.password === '') delete updates.password;

  if ('manager' in updates) updates.manager = await validateManager(updates.manager, user._id);

  // A manager with team members must keep the role and stay active.
  const losingManagerRole = user.role === ROLES.MANAGER && updates.role && updates.role !== ROLES.MANAGER;
  const beingDeactivated = user.isActive && updates.isActive === false;
  if ((losingManagerRole || beingDeactivated) && user.role === ROLES.MANAGER) {
    const teamSize = await User.countDocuments({ manager: user._id, isActive: true });
    if (teamSize > 0) {
      throw ApiError.conflict(
        `This manager has ${teamSize} active team member(s). Reassign them to another manager first.`
      );
    }
  }

  // Admins can't apply for or cancel leave, so their open leaves would be stranded.
  if (updates.role === ROLES.ADMIN && user.role !== ROLES.ADMIN) {
    const openLeaves = await Leave.countDocuments({
      employee: user._id,
      $or: [{ status: LEAVE_STATUS.PENDING }, { status: LEAVE_STATUS.APPROVED, startDate: { $gt: todayUtc() } }],
    });
    if (openLeaves > 0) {
      throw ApiError.conflict(
        `${user.name} has ${openLeaves} pending or upcoming leave(s). Resolve or cancel them before making them an admin.`
      );
    }
  }

  user.set(updates);
  await user.save();
  await user.populate('manager', MANAGER_FIELDS);
  res.json({ user });
});
