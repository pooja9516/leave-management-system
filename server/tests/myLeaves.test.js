import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Leave from '../src/models/Leave.js';
import User from '../src/models/User.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { makeUser, as } from './helpers/auth.js';
import { futureMonday, addDays } from './helpers/dates.js';

const MON = futureMonday(2);
const DAY = 86_400_000;
const todayUtc = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};

describe('My leaves: list and cancel', () => {
  let manager, employee, api;

  before(connectTestDB);
  after(closeTestDB);
  beforeEach(async () => {
    await clearTestDB();
    manager = await makeUser({ role: 'manager' });
    employee = await makeUser({ manager: manager._id });
    api = await as(employee);
  });

  // Inserts a leave directly (approval flow arrives in Step 9).
  const seedLeave = (data = {}) =>
    Leave.create({
      employee: employee._id,
      leaveType: 'casual',
      startDate: MON,
      endDate: addDays(MON, 1),
      days: 2,
      reason: 'Seeded leave',
      ...data,
    });
  const balance = async (type = 'casual') => (await User.findById(employee._id)).leaveBalance[type];

  describe('GET /api/leaves/my', () => {
    test('returns only my leaves, newest start date first, with canCancel', async () => {
      const other = await makeUser({ manager: manager._id });
      await Leave.create({ employee: other._id, leaveType: 'sick', startDate: MON, endDate: MON, days: 1, reason: 'Not mine' });
      await seedLeave({ startDate: addDays(MON, 7), endDate: addDays(MON, 7), days: 1 });
      await seedLeave({ status: 'rejected' });

      const res = await api.get('/api/leaves/my');
      assert.equal(res.status, 200);
      assert.equal(res.body.pagination.total, 2);
      assert.ok(res.body.data.every((l) => l.employee === String(employee._id)));
      assert.ok(new Date(res.body.data[0].startDate) > new Date(res.body.data[1].startDate));
      assert.deepEqual(res.body.data.map((l) => l.canCancel), [true, false]);
    });

    test('filters by status and leave type; validates filters', async () => {
      await seedLeave({ status: 'approved' });
      await seedLeave({ leaveType: 'sick', startDate: addDays(MON, 7), endDate: addDays(MON, 7), days: 1 });
      await seedLeave({ status: 'cancelled', startDate: addDays(MON, 14), endDate: addDays(MON, 14) });

      assert.equal((await api.get('/api/leaves/my?status=approved')).body.pagination.total, 1);
      assert.equal((await api.get('/api/leaves/my?leaveType=sick')).body.pagination.total, 1);
      assert.equal((await api.get('/api/leaves/my?status=pending&leaveType=casual')).body.pagination.total, 0);
      assert.equal((await api.get('/api/leaves/my?status=done')).status, 400);
      assert.equal((await api.get('/api/leaves/my?leaveType=vacation')).status, 400);
    });

    test('paginates', async () => {
      for (let i = 0; i < 7; i += 1) {
        await seedLeave({ startDate: addDays(MON, i * 7), endDate: addDays(MON, i * 7), days: 1 });
      }
      const p1 = await api.get('/api/leaves/my?limit=5&page=1');
      const p2 = await api.get('/api/leaves/my?limit=5&page=2');
      assert.equal(p1.body.data.length, 5);
      assert.equal(p2.body.data.length, 2);
      assert.deepEqual(p1.body.pagination, { page: 1, limit: 5, total: 7, totalPages: 2 });
    });

    test('populates reviewer name and comment', async () => {
      await seedLeave({ status: 'rejected', reviewedBy: manager._id, managerComment: 'Busy week' });
      const [leave] = (await api.get('/api/leaves/my')).body.data;
      assert.equal(leave.reviewedBy.name, manager.name);
      assert.equal(leave.managerComment, 'Busy week');
    });

    test('admin cannot use it (403)', async () => {
      const adminApi = await as(await makeUser({ role: 'admin' }));
      assert.equal((await adminApi.get('/api/leaves/my')).status, 403);
    });
  });

  describe('PATCH /api/leaves/:id/cancel', () => {
    const cancel = (id, client = api) => client.patch(`/api/leaves/${id}/cancel`, {});

    test('pending -> cancelled; balance unchanged; reserved days freed', async () => {
      const applied = await api.post('/api/leaves', {
        leaveType: 'casual', reason: 'Trip', startDate: MON.toISOString().slice(0, 10), endDate: addDays(MON, 2).toISOString().slice(0, 10),
      });
      let bal = (await api.get('/api/leaves/balance')).body.balance[0];
      assert.equal(bal.available, 9);

      const res = await cancel(applied.body.leave._id);
      assert.equal(res.status, 200);
      assert.equal(res.body.leave.status, 'cancelled');
      assert.ok(res.body.leave.cancelledAt);
      assert.equal(res.body.leave.canCancel, false);
      assert.equal(await balance(), 12);
      bal = (await api.get('/api/leaves/balance')).body.balance[0];
      assert.equal(bal.available, 12);
    });

    test('approved future leave -> cancelled and days restored', async () => {
      await User.updateOne({ _id: employee._id }, { 'leaveBalance.casual': 10 }); // as if 2 days were approved
      const leave = await seedLeave({ status: 'approved', days: 2 });
      const res = await cancel(leave._id);
      assert.equal(res.status, 200);
      assert.equal(res.body.leave.status, 'cancelled');
      assert.equal(await balance(), 12);
    });

    test('half-day approved leave restores 0.5', async () => {
      await User.updateOne({ _id: employee._id }, { 'leaveBalance.sick': 7.5 });
      const leave = await seedLeave({ status: 'approved', leaveType: 'sick', endDate: MON, days: 0.5, halfDay: true });
      await cancel(leave._id);
      assert.equal(await balance('sick'), 8);
    });

    test('approved leave that started today or earlier cannot be cancelled', async () => {
      const today = todayUtc();
      const started = await seedLeave({ status: 'approved', startDate: today, endDate: new Date(today.getTime() + DAY) });
      const past = await seedLeave({ status: 'approved', startDate: new Date(today.getTime() - 10 * DAY), endDate: new Date(today.getTime() - 9 * DAY) });
      for (const l of [started, past]) {
        const res = await cancel(l._id);
        assert.equal(res.status, 400);
        assert.match(res.body.message, /already started/);
      }
      assert.equal(await balance(), 12);
    });

    test('rejected or cancelled leave: final status cannot change', async () => {
      for (const status of ['rejected', 'cancelled']) {
        const l = await seedLeave({ status });
        const res = await cancel(l._id);
        assert.equal(res.status, 400);
        assert.match(res.body.message, /can no longer be changed/);
        assert.equal((await Leave.findById(l._id)).status, status);
      }
    });

    test("cannot cancel someone else's leave (404); bad id 400; unknown 404", async () => {
      const otherApi = await as(await makeUser({ manager: manager._id }));
      const mine = await seedLeave();
      assert.equal((await cancel(mine._id, otherApi)).status, 404);
      assert.equal((await Leave.findById(mine._id)).status, 'pending');
      assert.equal((await cancel('nope')).status, 400);
      assert.equal((await cancel('507f1f77bcf86cd799439011')).status, 404);
    });

    test('double cancel at the same time restores balance only once', async () => {
      await User.updateOne({ _id: employee._id }, { 'leaveBalance.casual': 10 });
      const leave = await seedLeave({ status: 'approved', days: 2 });
      const results = await Promise.all([cancel(leave._id), cancel(leave._id), cancel(leave._id)]);
      assert.equal(results.filter((r) => r.status === 200).length, 1);
      assert.equal(await balance(), 12);
    });

    test('after cancelling, the same dates can be applied for again', async () => {
      const leave = await seedLeave();
      await cancel(leave._id);
      const res = await api.post('/api/leaves', {
        leaveType: 'casual', reason: 'Rebook', startDate: MON.toISOString().slice(0, 10), endDate: MON.toISOString().slice(0, 10),
      });
      assert.equal(res.status, 201);
    });
  });
});
