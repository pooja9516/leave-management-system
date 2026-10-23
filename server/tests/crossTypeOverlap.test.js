import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Leave from '../src/models/Leave.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { makeUser, as } from './helpers/auth.js';
import { futureMonday, addDays, ymd } from './helpers/dates.js';

const MON = futureMonday(2);
const d = (n) => ymd(addDays(MON, n));

// Overlap rule is across ALL leave types: an approved/pending casual leave blocks sick/paid on the same dates.
describe('Overlap across leave types', () => {
  let mgrApi, empApi;
  before(connectTestDB);
  after(closeTestDB);
  beforeEach(async () => {
    await clearTestDB();
    const mgr = await makeUser({ role: 'manager' });
    mgrApi = await as(mgr);
    empApi = await as(await makeUser({ manager: mgr._id }));
  });

  const apply = (body) => empApi.post('/api/leaves', { reason: 'Some reason', ...body });

  test('approved casual blocks sick (full day and half day) and paid on the same date', async () => {
    const casual = (await apply({ leaveType: 'casual', startDate: d(0), endDate: d(0) })).body.leave;
    assert.equal((await mgrApi.patch(`/api/leaves/${casual._id}/approve`, {})).status, 200);

    for (const body of [
      { leaveType: 'sick', startDate: d(0), endDate: d(0) },
      { leaveType: 'sick', startDate: d(0), endDate: d(0), halfDay: true },
      { leaveType: 'paid', startDate: d(0), endDate: d(2) },
    ]) {
      const res = await apply(body);
      assert.equal(res.status, 409, JSON.stringify(body));
      assert.match(res.body.message, /overlap with your approved casual leave/);
    }
    assert.equal(await Leave.countDocuments(), 1);
  });

  test('pending sick blocks casual on overlapping dates', async () => {
    await apply({ leaveType: 'sick', startDate: d(1), endDate: d(3) });
    const res = await apply({ leaveType: 'casual', startDate: d(3), endDate: d(4) });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /pending sick leave/);
  });
});

describe('GET /api/leaves/calculate reports overlaps before submitting', () => {
  let empApi, mgrApi;
  before(connectTestDB);
  after(closeTestDB);
  beforeEach(async () => {
    await clearTestDB();
    const mgr = await makeUser({ role: 'manager' });
    mgrApi = await as(mgr);
    empApi = await as(await makeUser({ manager: mgr._id }));
  });

  const calc = (q) => empApi.get(`/api/leaves/calculate?${new URLSearchParams(q)}`);

  test('no overlap -> overlap: null', async () => {
    const res = await calc({ startDate: d(0), endDate: d(0) });
    assert.equal(res.status, 200);
    assert.equal(res.body.overlap, null);
  });

  test('approved casual is reported when previewing sick on the same date', async () => {
    const casual = (await empApi.post('/api/leaves', { leaveType: 'casual', reason: 'Trip', startDate: d(0), endDate: d(0) })).body.leave;
    await mgrApi.patch(`/api/leaves/${casual._id}/approve`, {});
    const res = await calc({ startDate: d(0), endDate: d(1) });
    assert.equal(res.body.overlap.status, 'approved');
    assert.equal(res.body.overlap.leaveType, 'casual');
    assert.match(res.body.overlap.message, /overlap with your approved casual leave/);
  });

  test("cancelled/rejected leaves and other people's leaves are not reported", async () => {
    const mine = (await empApi.post('/api/leaves', { leaveType: 'casual', reason: 'Trip', startDate: d(0), endDate: d(0) })).body.leave;
    await empApi.patch(`/api/leaves/${mine._id}/cancel`, {});
    const otherApi = await as(await makeUser());
    await otherApi.post('/api/leaves', { leaveType: 'casual', reason: 'Trip', startDate: d(0), endDate: d(0) });
    assert.equal((await calc({ startDate: d(0), endDate: d(0) })).body.overlap, null);
  });
});
