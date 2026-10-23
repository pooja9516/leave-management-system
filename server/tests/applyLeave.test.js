import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Leave from '../src/models/Leave.js';
import Holiday from '../src/models/Holiday.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { makeUser, as } from './helpers/auth.js';
import { futureMonday, addDays, ymd, daysAgo } from './helpers/dates.js';

const MON = futureMonday(2);
const d = (offset) => ymd(addDays(MON, offset)); // 0=Mon .. 4=Fri, 5=Sat, 6=Sun, 7=next Mon

describe('POST /api/leaves (apply)', () => {
  let manager, employee, api;

  before(connectTestDB);
  after(closeTestDB);
  beforeEach(async () => {
    await clearTestDB();
    manager = await makeUser({ role: 'manager' });
    employee = await makeUser({ manager: manager._id });
    api = await as(employee);
  });

  const apply = (body, client = api) =>
    client.post('/api/leaves', { leaveType: 'casual', reason: 'Family function', ...body });

  test('creates a pending leave with working days computed', async () => {
    const res = await apply({ startDate: d(0), endDate: d(4) });
    assert.equal(res.status, 201);
    assert.equal(res.body.leave.status, 'pending');
    assert.equal(res.body.leave.days, 5);
    assert.equal(res.body.leave.employee, String(employee._id));
    assert.equal(res.body.leave.halfDay, false);
  });

  test('balance is NOT deducted on apply (only on approval)', async () => {
    await apply({ startDate: d(0), endDate: d(1) });
    const me = await api.get('/api/auth/me');
    assert.equal(me.body.user.leaveBalance.casual, 12);
  });

  test('weekends and holidays are excluded from days', async () => {
    await Holiday.create({ name: 'Test', date: addDays(MON, 2) });
    const res = await apply({ startDate: d(0), endDate: d(7) }); // Mon..next Mon, minus Wed holiday
    assert.equal(res.body.leave.days, 5);
  });

  test('half day counts 0.5', async () => {
    const res = await apply({ startDate: d(1), endDate: d(1), halfDay: true });
    assert.equal(res.status, 201);
    assert.equal(res.body.leave.days, 0.5);
    assert.equal(res.body.leave.halfDay, true);
  });

  test('admin cannot apply (403); user without a manager can apply (admin reviews it)', async () => {
    const adminApi = await as(await makeUser({ role: 'admin' }));
    assert.equal((await apply({ startDate: d(0), endDate: d(0) }, adminApi)).status, 403);

    const loneApi = await as(await makeUser({ role: 'manager' }));
    const res = await apply({ startDate: d(0), endDate: d(0) }, loneApi);
    assert.equal(res.status, 201);
    assert.equal(res.body.leave.status, 'pending');
  });

  test('validates type, reason and dates', async () => {
    const cases = [
      [{ leaveType: 'vacation', startDate: d(0), endDate: d(0) }, /Leave type/],
      [{ reason: 'ab', startDate: d(0), endDate: d(0) }, /at least 3/],
      [{ reason: '   ', startDate: d(0), endDate: d(0) }, /at least 3/],
      [{ reason: 'x'.repeat(501), startDate: d(0), endDate: d(0) }, /at most 500/],
      [{ startDate: '', endDate: d(0) }, /Start date/],
      [{ startDate: d(0), endDate: '2026-02-30' }, /End date/],
      [{ startDate: d(2), endDate: d(1) }, /cannot be before/],
      [{ startDate: d(0), endDate: d(1), halfDay: true }, /same date/],
      [{ startDate: daysAgo(3), endDate: d(0) }, /past/],
      [{ startDate: d(5), endDate: d(6) }, /weekends or holidays/],
    ];
    for (const [body, msg] of cases) {
      const res = await apply(body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.match(res.body.message, msg);
    }
    assert.equal(await Leave.countDocuments(), 0);
  });

  test('ignores fields the client must not set (status, days, employee)', async () => {
    const other = await makeUser();
    const res = await apply({ startDate: d(0), endDate: d(0), status: 'approved', days: 0.5, employee: other._id });
    assert.equal(res.body.leave.status, 'pending');
    assert.equal(res.body.leave.days, 1);
    assert.equal(res.body.leave.employee, String(employee._id));
  });

  test('overlapping pending or approved leave is rejected (409)', async () => {
    await apply({ startDate: d(0), endDate: d(2) });
    for (const [s, e] of [[d(2), d(3)], [d(1), d(1)], [d(0), d(4)]]) {
      const res = await apply({ startDate: s, endDate: e });
      assert.equal(res.status, 409, `${s}..${e}`);
      assert.match(res.body.message, /overlap/);
    }
    await Leave.updateMany({}, { status: 'approved' });
    assert.equal((await apply({ startDate: d(1), endDate: d(1) })).status, 409);
    // Adjacent dates are fine
    assert.equal((await apply({ startDate: d(3), endDate: d(3) })).status, 201);
  });

  test('rejected and cancelled leaves do not block the same dates', async () => {
    await apply({ startDate: d(0), endDate: d(0) });
    await Leave.updateMany({}, { status: 'rejected' });
    assert.equal((await apply({ startDate: d(0), endDate: d(0) })).status, 201);
    await Leave.updateMany({}, { status: 'cancelled' });
    assert.equal((await apply({ startDate: d(0), endDate: d(0) })).status, 201);
  });

  test("another employee's leave on the same dates does not block", async () => {
    const otherApi = await as(await makeUser({ manager: manager._id }));
    await apply({ startDate: d(0), endDate: d(0) }, otherApi);
    assert.equal((await apply({ startDate: d(0), endDate: d(0) })).status, 201);
  });

  test('pending requests reserve balance; types are independent', async () => {
    // Sick = 8: Mon-Fri (5) then next Mon-Thu (4) would need 9
    assert.equal((await apply({ leaveType: 'sick', startDate: d(0), endDate: d(4) })).status, 201);
    const tooMuch = await apply({ leaveType: 'sick', startDate: d(7), endDate: d(10) });
    assert.equal(tooMuch.status, 400);
    assert.match(tooMuch.body.message, /only 3 available \(5 more days are awaiting approval\)/);
    // Exactly the remaining 3 is fine
    assert.equal((await apply({ leaveType: 'sick', startDate: d(7), endDate: d(9) })).status, 201);
    // Casual is unaffected
    assert.equal((await apply({ leaveType: 'casual', startDate: d(14), endDate: d(14) })).status, 201);
  });

  test('cannot exceed stored balance', async () => {
    await employee.updateOne({ 'leaveBalance.paid': 1 });
    const res = await apply({ leaveType: 'paid', startDate: d(0), endDate: d(1) });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /only 1 available/);
    assert.equal((await apply({ leaveType: 'paid', startDate: d(0), endDate: d(0), halfDay: true })).status, 201);
  });

  test('concurrent identical requests: exactly one succeeds', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => apply({ startDate: d(0), endDate: d(2) }))
    );
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409, 409, 409, 409]);
    assert.equal(await Leave.countDocuments(), 1);
  });

  test('concurrent requests cannot overspend balance together', async () => {
    await employee.updateOne({ 'leaveBalance.sick': 2 });
    // Three non-overlapping 1-day requests with only 2 days available
    const results = await Promise.all([0, 1, 2].map((i) => apply({ leaveType: 'sick', startDate: d(i), endDate: d(i) })));
    assert.equal(results.filter((r) => r.status === 201).length, 2);
    assert.equal(results.filter((r) => r.status === 400).length, 1);
  });
});

describe('GET /api/leaves/balance', () => {
  before(connectTestDB);
  after(closeTestDB);

  test('shows total, balance, pending and available per type', async () => {
    const manager = await makeUser({ role: 'manager' });
    const employee = await makeUser({ manager: manager._id });
    const api = await as(employee);
    await api.post('/api/leaves', { leaveType: 'casual', reason: 'Trip', startDate: d(0), endDate: d(1) });

    const res = await api.get('/api/leaves/balance');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.balance, [
      { type: 'casual', total: 12, balance: 12, pending: 2, available: 10 },
      { type: 'sick', total: 8, balance: 8, pending: 0, available: 8 },
      { type: 'paid', total: 15, balance: 15, pending: 0, available: 15 },
    ]);
  });
});
