import ApiError from './ApiError.js';
import { toDateOnly } from './dates.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Longest leave a single request may span (calendar days, inclusive).
export const MAX_LEAVE_SPAN_DAYS = 366;

export const isWeekend = (date) => {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
};

/**
 * Counts leave days between two UTC-midnight dates (inclusive), skipping
 * weekends and holidays. Pure function: no database access.
 */
export const calculateLeaveDays = ({ startDate, endDate, halfDay = false, holidayDates = new Set() }) => {
  if (endDate < startDate) throw ApiError.badRequest('End date cannot be before start date');

  const span = Math.round((endDate - startDate) / DAY_MS) + 1;
  if (span > MAX_LEAVE_SPAN_DAYS) {
    throw ApiError.badRequest(`A single leave cannot span more than ${MAX_LEAVE_SPAN_DAYS} days`);
  }
  if (halfDay && span !== 1) throw ApiError.badRequest('Half-day leave must start and end on the same date');

  const working = [];
  const weekends = [];
  const holidays = [];

  for (let i = 0; i < span; i += 1) {
    const day = new Date(startDate.getTime() + i * DAY_MS);
    const key = toDateOnly(day);
    if (isWeekend(day)) weekends.push(key);
    else if (holidayDates.has(key)) holidays.push(key);
    else working.push(key);
  }

  const days = halfDay ? working.length * 0.5 : working.length;
  return { days, workingDates: working, weekendDates: weekends, holidayDates: holidays };
};
