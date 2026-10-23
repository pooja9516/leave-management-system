import Holiday from '../models/Holiday.js';
import { parseDateOnly } from '../utils/dates.js';
import { seedHolidays } from './seedData.js';

// Creates missing seed holidays only; existing holidays are never modified or deleted.
export const runHolidaySeed = async () => {
  const created = [];
  const skipped = [];

  for (const { name, date } of seedHolidays) {
    const day = parseDateOnly(date);
    if (await Holiday.exists({ date: day })) {
      skipped.push(date);
      continue;
    }
    await Holiday.create({ name, date: day });
    created.push(date);
  }

  return { created, skipped };
};
