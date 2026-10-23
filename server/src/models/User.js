import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, LEAVE_TYPES } from '../config/constants.js';

const SALT_ROUNDS = 10;

const balanceFields = Object.fromEntries(
  Object.entries(LEAVE_TYPES).map(([type, days]) => [
    type,
    { type: Number, default: days, min: [0, `${type} balance cannot be negative`] },
  ])
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 100 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email is invalid'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: { values: Object.values(ROLES), message: 'Invalid role' },
      default: ROLES.EMPLOYEE,
    },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: true },
    leaveBalance: { type: new mongoose.Schema(balanceFields, { _id: false }), default: () => ({}) },
    // Bumped inside leave transactions so concurrent requests for the same user conflict.
    leaveLock: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

userSchema.index({ manager: 1 });
userSchema.index({ role: 1 });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.leaveLock;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
