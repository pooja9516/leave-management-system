import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Holiday name is required'],
      trim: true,
      maxlength: [100, 'Holiday name is too long'],
    },
    // Always stored at UTC midnight (see utils/dates.js).
    date: { type: Date, required: [true, 'Date is required'], unique: true },
  },
  { timestamps: true }
);

holidaySchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Holiday', holidaySchema);
