// Future dates for tests, relative to today so tests never go stale.
const DAY = 86_400_000;

const todayUtcMs = () => {
  const n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
};

// Monday of the week `weeksAhead` weeks from now (always in the future).
export const futureMonday = (weeksAhead = 2) => {
  const today = todayUtcMs();
  const dow = new Date(today).getUTCDay(); // 0 Sun .. 6 Sat
  const toMonday = (8 - dow) % 7 || 7;
  return new Date(today + (toMonday + (weeksAhead - 1) * 7) * DAY);
};

export const addDays = (date, n) => new Date(date.getTime() + n * DAY);
export const ymd = (date) => date.toISOString().slice(0, 10);
export const daysAgo = (n) => ymd(new Date(todayUtcMs() - n * DAY));
