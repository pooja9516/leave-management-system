const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

// Parses a strict "YYYY-MM-DD" string into a Date at UTC midnight.
// Returns null for anything else, including impossible dates like 2026-02-30.
export const parseDateOnly = (value) => {
  if (typeof value !== 'string') return null;
  const match = DATE_ONLY.exec(value.trim());
  if (!match) return null;

  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
};

// Formats a Date as "YYYY-MM-DD" (UTC).
export const toDateOnly = (date) => date.toISOString().slice(0, 10);

export const yearRange = (year) => ({
  $gte: new Date(Date.UTC(year, 0, 1)),
  $lt: new Date(Date.UTC(year + 1, 0, 1)),
});

// Today's date at UTC midnight.
export const todayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};
