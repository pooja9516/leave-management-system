import mongoose from 'mongoose';
import { LEAVE_TYPES, LEAVE_STATUS, REASON_MIN, REASON_MAX } from '../config/constants.js';

const leaveSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    leaveType: {
      type: String,
      enum: { values: Object.keys(LEAVE_TYPES), message: 'Invalid leave type' },
      required: [true, 'Leave type is required'],
    },
    // Calendar dates stored at UTC midnight (see utils/dates.js).
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    halfDay: { type: Boolean, default: false },
    // Working days charged, fixed at application time (weekends/holidays excluded).
    days: { type: Number, required: true, min: 0.5 },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
      minlength: [REASON_MIN, `Reason must be at least ${REASON_MIN} characters`],
      maxlength: [REASON_MAX, `Reason must be at most ${REASON_MAX} characters`],
    },
    status: {
      type: String,
      enum: Object.values(LEAVE_STATUS),
      default: LEAVE_STATUS.PENDING,
    },
    managerComment: { type: String, trim: true, maxlength: 500, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

leaveSchema.index({ employee: 1, status: 1, startDate: 1 });
leaveSchema.index({ status: 1, createdAt: -1 });

leaveSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Leave', leaveSchema);
