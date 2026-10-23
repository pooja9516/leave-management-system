import Holiday from '../models/Holiday.js';
import ApiError from '../utils/ApiError.js';
import { parseDateOnly, toDateOnly } from '../utils/dates.js';
import { calculateLeaveDays } from '../utils/workingDays.js';

export const parseHalfDay = (value) => {
  if (value === undefined || value === false || value === 'false') return false;
  if (value === true || value === 'true') return true;
  throw ApiError.badRequest('halfDay must be true or false');
};

// Validates raw input and returns the leave-day breakdown, using holidays from the DB.
export const computeLeaveDays = async ({ startDate, endDate, halfDay }) => {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start) throw ApiError.badRequest('Start date must be a valid date in YYYY-MM-DD format');
  if (!end) throw ApiError.badRequest('End date must be a valid date in YYYY-MM-DD format');

  const holidays = end >= start ? await Holiday.find({ date: { $gte: start, $lte: end } }) : [];
  const holidayNames = Object.fromEntries(holidays.map((h) => [toDateOnly(h.date), h.name]));

  const result = calculateLeaveDays({
    startDate: start,
    endDate: end,
    halfDay: parseHalfDay(halfDay),
    holidayDates: new Set(Object.keys(holidayNames)),
  });

  return {
    ...result,
    startDate: start,
    endDate: end,
    holidays: result.holidayDates.map((date) => ({ date, name: holidayNames[date] })),
  };
};
