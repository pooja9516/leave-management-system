import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signToken } from '../utils/token.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  // Strings only: blocks query-operator injection like { "$gt": "" }.
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw ApiError.badRequest('Email and password are required');
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');

  // Same message for unknown email and wrong password, so emails can't be probed.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated');

  res.json({ token: signToken(user), user });
});

export const me = asyncHandler(async (req, res) => {
  await req.user.populate('manager', 'name email');
  res.json({ user: req.user });
});
