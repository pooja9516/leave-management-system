import Holiday from '../models/Holiday.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { parseDateOnly, yearRange } from '../utils/dates.js';

const readDate = (value) => {
  const date = parseDateOnly(value);
  if (!date) throw ApiError.badRequest('Date must be a valid date in YYYY-MM-DD format');
  return date;
};

const duplicateDate = (err) => {
  if (err.code === 11000) throw ApiError.conflict('A holiday already exists on this date');
  throw err;
};

export const listHolidays = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.year !== undefined) {
    const year = Number(req.query.year);
    if (!Number.isInteger(year) || year < 1970 || year > 9999) throw ApiError.badRequest('Invalid year');
    filter.date = yearRange(year);
  }

  const paging = parsePagination(req.query, 50);
  const [holidays, total] = await Promise.all([
    Holiday.find(filter).sort({ date: 1 }).skip(paging.skip).limit(paging.limit),
    Holiday.countDocuments(filter),
  ]);
  res.json(paginated(holidays, total, paging));
});

export const createHoliday = asyncHandler(async (req, res) => {
  const { name, date } = req.body || {};
  const holiday = await Holiday.create({ name, date: readDate(date) }).catch(duplicateDate);
  res.status(201).json({ holiday });
});

export const updateHoliday = asyncHandler(async (req, res) => {
  const holiday = await Holiday.findById(req.params.id);
  if (!holiday) throw ApiError.notFound('Holiday not found');

  const { name, date } = req.body || {};
  if (name !== undefined) holiday.name = name;
  if (date !== undefined) holiday.date = readDate(date);

  await holiday.save().catch(duplicateDate);
  res.json({ holiday });
});

export const deleteHoliday = asyncHandler(async (req, res) => {
  const holiday = await Holiday.findByIdAndDelete(req.params.id);
  if (!holiday) throw ApiError.notFound('Holiday not found');
  res.json({ message: 'Holiday deleted' });
});
