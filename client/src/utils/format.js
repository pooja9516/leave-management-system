// Server stores calendar dates at UTC midnight, so always format them in UTC
// to avoid showing the previous day in negative-offset timezones.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long' });

// Fixed month names: Intl's en-GB uses "Sept", which is inconsistent with the other months.
export const formatMonth = (value) => MONTHS[new Date(value).getUTCMonth()];
export const formatDate = (value) => {
  const d = new Date(value);
  return `${d.getUTCDate()} ${formatMonth(d)} ${d.getUTCFullYear()}`;
};
export const formatWeekday = (value) => weekdayFmt.format(new Date(value));
export const dayOfMonth = (value) => new Date(value).getUTCDate();

// Today's calendar date in the user's local timezone, as YYYY-MM-DD.
export const todayKey = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const dateKey = (value) => new Date(value).toISOString().slice(0, 10);

// Whole days from today (local) until a YYYY-MM-DD date.
export const daysUntil = (value) => {
  const toUtc = (key) => Date.parse(`${key}T00:00:00Z`);
  return Math.round((toUtc(dateKey(value)) - toUtc(todayKey())) / 86_400_000);
};

export const relativeDays = (value) => {
  const n = daysUntil(value);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return `In ${n} days`;
};

export const formatDays = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';

export const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

// "2 Nov 2026" or "2 – 4 Nov 2026" / "30 Dec 2026 – 2 Jan 2027"
export const formatDateRange = (start, end) => {
  const a = new Date(start);
  const b = new Date(end);
  if (a.getTime() === b.getTime()) return formatDate(a);
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  const sameMonth = sameYear && a.getUTCMonth() === b.getUTCMonth();
  if (sameMonth) return `${a.getUTCDate()} – ${formatDate(b)}`;
  if (sameYear) return `${a.getUTCDate()} ${formatMonth(a)} – ${formatDate(b)}`;
  return `${formatDate(a)} – ${formatDate(b)}`;
};
