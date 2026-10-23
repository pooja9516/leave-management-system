import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateLeaveDays, isWeekend } from '../src/utils/workingDays.js';
import { parseDateOnly } from '../src/utils/dates.js';

// Reference week (Nov 2026): Mon 2, Tue 3, Wed 4, Thu 5, Fri 6, Sat 7, Sun 8, Mon 9
const d = parseDateOnly;
const calc = (start, end, opts = {}) =>
  calculateLeaveDays({ startDate: d(start), endDate: d(end), ...opts });

describe('calculateLeaveDays', () => {
  test('isWeekend detects Saturday and Sunday only', () => {
    assert.equal(isWeekend(d('2026-11-07')), true);
    assert.equal(isWeekend(d('2026-11-08')), true);
    assert.equal(isWeekend(d('2026-11-06')), false);
    assert.equal(isWeekend(d('2026-11-09')), false);
  });

  test('single working day = 1', () => {
    assert.equal(calc('2026-11-04', '2026-11-04').days, 1);
  });

  test('Mon-Fri = 5', () => {
    const r = calc('2026-11-02', '2026-11-06');
    assert.equal(r.days, 5);
    assert.deepEqual(r.weekendDates, []);
  });

  test('Fri to next Mon skips weekend = 2', () => {
    const r = calc('2026-11-06', '2026-11-09');
    assert.equal(r.days, 2);
    assert.deepEqual(r.workingDates, ['2026-11-06', '2026-11-09']);
    assert.deepEqual(r.weekendDates, ['2026-11-07', '2026-11-08']);
  });

  test('weekend-only range = 0', () => {
    assert.equal(calc('2026-11-07', '2026-11-08').days, 0);
  });

  test('holidays are excluded', () => {
    const r = calc('2026-11-02', '2026-11-06', { holidayDates: new Set(['2026-11-04']) });
    assert.equal(r.days, 4);
    assert.deepEqual(r.holidayDates, ['2026-11-04']);
  });

  test('holiday on a weekend is counted once as weekend, not twice', () => {
    const r = calc('2026-11-06', '2026-11-09', { holidayDates: new Set(['2026-11-07']) });
    assert.equal(r.days, 2);
    assert.deepEqual(r.holidayDates, []);
    assert.deepEqual(r.weekendDates, ['2026-11-07', '2026-11-08']);
  });

  test('all days are holidays = 0', () => {
    assert.equal(calc('2026-11-04', '2026-11-04', { holidayDates: new Set(['2026-11-04']) }).days, 0);
  });

  test('half day on a working day = 0.5', () => {
    assert.equal(calc('2026-11-04', '2026-11-04', { halfDay: true }).days, 0.5);
  });

  test('half day on a weekend or holiday = 0', () => {
    assert.equal(calc('2026-11-07', '2026-11-07', { halfDay: true }).days, 0);
    assert.equal(
      calc('2026-11-04', '2026-11-04', { halfDay: true, holidayDates: new Set(['2026-11-04']) }).days,
      0
    );
  });

  test('half day across multiple dates is rejected', () => {
    assert.throws(() => calc('2026-11-04', '2026-11-05', { halfDay: true }), /same date/);
  });

  test('end before start is rejected', () => {
    assert.throws(() => calc('2026-11-05', '2026-11-04'), /cannot be before/);
  });

  test('crosses month and year boundaries correctly', () => {
    // Wed 30 Dec 2026 -> Mon 4 Jan 2027: Wed, Thu, Fri, Mon = 4
    assert.equal(calc('2026-12-30', '2027-01-04').days, 4);
    // Feb 2028 leap day: Mon 28 Feb -> Wed 1 Mar 2028 = 3
    assert.equal(calc('2028-02-28', '2028-03-01').days, 3);
  });

  test('span limit: 366 days ok, 367 rejected', () => {
    assert.doesNotThrow(() => calc('2026-01-01', '2027-01-01'));
    assert.throws(() => calc('2026-01-01', '2027-01-02'), /cannot span more than 366/);
  });
});
