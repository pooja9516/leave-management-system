import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import User from '../src/models/User.js';
import Leave from '../src/models/Leave.js';
import Holiday from '../src/models/Holiday.js';
import { runDataChecks } from '../src/scripts/dataChecks.js';
import { runSeed } from '../src/seed/seedUsers.js';
import { runHolidaySeed } from '../src/seed/seedHolidays.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { SEED_PASSWORD } from '../src/seed/seedData.js';
import { futureMonday, addDays, ymd } from './helpers/dates.js';
import request from 'supertest';
import app from '../src/app.js';

const MON = futureMonday(2);
const d = (n) => ymd(addDays(MON, n));
const loginAs = async (email) => {
  const { body } = await request(app).post('/api/auth/login').send({ email, password: SEED_PASSWORD });
  const auth = (r) => r.set('Authorization', `Bearer ${body.token}`);
  return {
    post: (u, b) => auth(request(app).post(u)).send(b),
    patch: (u, b) => auth(request(app).patch(u)).send(b),
    get: (u) => auth(request(app).get(u)),
  };
};

describe('Data integrity checks (npm run check:data)', () => {
  before(connectTestDB);
  after(closeTestDB);
  beforeEach(async () => {
    await clearTestDB();
    await Holiday.syncIndexes();
    await runSeed();
    await runHolidaySeed();
  });

  test('seeded data passes', async () => {
    const { errors, stats } = await runDataChecks();
    assert.deepEqual(errors, []);
    assert.equal(stats.users, 7);
  });

  test('data produced through the real API (apply/approve/reject/cancel) passes', async () => {
    const emp = await loginAs('employee1@example.com');
    const mgr = await loginAs('manager1@example.com');
    const a = (await emp.post('/api/leaves', { leaveType: 'casual', reason: 'Trip', startDate: d(0), endDate: d(2) })).body.leave;
    const b = (await emp.post('/api/leaves', { leaveType: 'sick', reason: 'Doctor', startDate: d(7), endDate: d(7), halfDay: true })).body.leave;
    const c = (await emp.post('/api/leaves', { leaveType: 'paid', reason: 'Holiday', startDate: d(14), endDate: d(15) })).body.leave;
    await mgr.patch(`/api/leaves/${a._id}/approve`, {});
    await mgr.patch(`/api/leaves/${b._id}/reject`, { comment: 'Busy day' });
    await mgr.patch(`/api/leaves/${c._id}/approve`, {});
    await emp.patch(`/api/leaves/${c._id}/cancel`, {});
    await emp.post('/api/leaves', { leaveType: 'casual', reason: 'Later', startDate: d(21), endDate: d(21) });

    const { errors, stats } = await runDataChecks();
    assert.deepEqual(errors, []);
    assert.deepEqual([stats.pending, stats.approved, stats.rejected, stats.cancelled], [1, 1, 1, 1]);
  });

  test('detects corrupted data', async () => {
    const emp = await User.findOne({ email: 'employee1@example.com' });
    await User.updateOne({ _id: emp._id }, { $set: { 'leaveBalance.casual': 5 } }); // no approved leave explains this
    const base = { employee: emp._id, leaveType: 'sick', reason: 'x', days: 1, status: 'approved' };
    await Leave.collection.insertMany([
      { ...base, startDate: addDays(MON, 0), endDate: addDays(MON, 0), reviewedBy: null },
      { ...base, startDate: addDays(MON, 0), endDate: addDays(MON, 1), status: 'pending', days: 2 },
      { ...base, startDate: addDays(MON, 3), endDate: addDays(MON, 3), status: 'rejected', reviewedBy: emp._id, reviewedAt: new Date(), managerComment: '' },
    ]);
    const { errors } = await runDataChecks();
    const text = errors.join('\n');
    assert.match(text, /casual balance is 5 but 12 - 0 approved = 12/);
    assert.match(text, /sick balance is 8 but 8 - 1 approved = 7/);
    assert.match(text, /overlapping leaves/);
    assert.match(text, /no reviewer recorded/);
    assert.match(text, /rejected without a comment/);
  });
});
