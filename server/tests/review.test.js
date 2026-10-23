import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Leave from '../src/models/Leave.js';
import User from '../src/models/User.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { makeUser, as } from './helpers/auth.js';
import { futureMonday, addDays, ymd } from './helpers/dates.js';

const MON = futureMonday(2);
const d = (n) => ymd(addDays(MON, n));

describe('Manager review: team list, approve, reject', () => {
  let mgr, mgrApi, otherMgr, otherMgrApi, emp, empApi, outsider;

  before(connectTestDB);
  after(closeTestDB);
  beforeEach(async () => {
    await clearTestDB();
    mgr = await makeUser({ role: 'manager', name: 'Mona Manager' });
    otherMgr = await makeUser({ role: 'manager', name: 'Otto Manager' });
    emp = await makeUser({ name: 'Eve Employee', manager: mgr._id });
    outsider = await makeUser({ name: 'Oscar Outsider', manager: otherMgr._id });
    [mgrApi, otherMgrApi, empApi] = await Promise.all([as(mgr), as(otherMgr), as(emp)]);
  });

  const apply = async (client, body = {}) =>
    (await client.post('/api/leaves', { leaveType: 'casual', reason: 'Family event', startDate: d(0), endDate: d(1), ...body })).body.leave;
  const approve = (id, comment, client = mgrApi) => client.patch(`/api/leaves/${id}/approve`, comment === undefined ? {} : { comment });
  const reject = (id, comment, client = mgrApi) => client.patch(`/api/leaves/${id}/reject`, comment === undefined ? {} : { comment });
  const balance = async (u = emp, type = 'casual') => (await User.findById(u._id)).leaveBalance[type];

  describe('GET /api/leaves/team', () => {
    test("lists only my team's leaves with employee details", async () => {
      await apply(empApi);
      await apply(await as(outsider));
      const res = await mgrApi.get('/api/leaves/team');
      assert.equal(res.status, 200);
      assert.equal(res.body.pagination.total, 1);
      const [leave] = res.body.data;
      assert.equal(leave.employee.name, 'Eve Employee');
      assert.deepEqual(leave.employee.leaveBalance, { casual: 12, sick: 8, paid: 15 });
      assert.equal(leave.employee.password, undefined);
    });

    test('pending list is soonest-first; filters by status, type and search', async () => {
      const emp2 = await makeUser({ name: 'Zed Zebra', email: 'zed@test.com', manager: mgr._id });
      const late = await apply(empApi, { startDate: d(7), endDate: d(7) });
      const soon = await apply(await as(emp2), { startDate: d(0), endDate: d(0), leaveType: 'sick' });

      const pending = await mgrApi.get('/api/leaves/team?status=pending');
      assert.deepEqual(pending.body.data.map((l) => l._id), [soon._id, late._id]);
      assert.equal((await mgrApi.get('/api/leaves/team?leaveType=sick')).body.pagination.total, 1);
      assert.equal((await mgrApi.get('/api/leaves/team?search=zebra')).body.pagination.total, 1);
      assert.equal((await mgrApi.get('/api/leaves/team?search=ZED@TEST')).body.pagination.total, 1);
      assert.equal((await mgrApi.get('/api/leaves/team?search=' + encodeURIComponent('.*('))).body.pagination.total, 0);
      assert.equal((await mgrApi.get('/api/leaves/team?status=nope')).status, 400);
    });

    test('team follows the current manager assignment', async () => {
      await apply(empApi);
      await User.updateOne({ _id: emp._id }, { manager: otherMgr._id });
      assert.equal((await mgrApi.get('/api/leaves/team')).body.pagination.total, 0);
      assert.equal((await otherMgrApi.get('/api/leaves/team')).body.pagination.total, 1);
    });

    test('employees cannot review (403); the team list is for managers only', async () => {
      const adminApi = await as(await makeUser({ role: 'admin' }));
      const leave = await apply(empApi);
      assert.equal((await empApi.get('/api/leaves/team')).status, 403);
      assert.equal((await approve(leave._id, undefined, empApi)).status, 403);
      assert.equal((await reject(leave._id, 'nope', empApi)).status, 403);
      assert.equal((await adminApi.get('/api/leaves/team')).status, 403);
      assert.equal((await Leave.findById(leave._id)).status, 'pending');
    });
  });

  describe('approve', () => {
    test('approves, deducts balance, records reviewer and optional comment', async () => {
      const leave = await apply(empApi);
      const res = await approve(leave._id, '  Enjoy  ');
      assert.equal(res.status, 200);
      assert.equal(res.body.leave.status, 'approved');
      assert.equal(res.body.leave.managerComment, 'Enjoy');
      assert.equal(res.body.leave.reviewedBy.name, 'Mona Manager');
      assert.ok(res.body.leave.reviewedAt);
      assert.equal(await balance(), 10);

      const bal = (await empApi.get('/api/leaves/balance')).body.balance[0];
      assert.deepEqual(bal, { type: 'casual', total: 12, balance: 10, pending: 0, available: 10 });
    });

    test('comment is optional on approval; half day deducts 0.5', async () => {
      const leave = await apply(empApi, { startDate: d(2), endDate: d(2), halfDay: true, leaveType: 'sick' });
      assert.equal((await approve(leave._id)).status, 200);
      assert.equal(await balance(emp, 'sick'), 7.5);
    });

    test("cannot approve another team's leave (404) and nothing changes", async () => {
      const leave = await apply(await as(outsider));
      const res = await approve(leave._id);
      assert.equal(res.status, 404);
      assert.equal((await Leave.findById(leave._id)).status, 'pending');
      assert.equal(await balance(outsider), 12);
    });

    test('refuses if balance no longer covers the leave', async () => {
      const leave = await apply(empApi);
      await User.updateOne({ _id: emp._id }, { 'leaveBalance.casual': 1 });
      const res = await approve(leave._id);
      assert.equal(res.status, 400);
      assert.match(res.body.message, /no longer has enough casual leave/);
      assert.equal((await Leave.findById(leave._id)).status, 'pending');
      assert.equal(await balance(), 1);
    });

    test('bad id 400, unknown id 404', async () => {
      assert.equal((await approve('bad')).status, 400);
      assert.equal((await approve('507f1f77bcf86cd799439011')).status, 404);
    });
  });

  describe('reject', () => {
    test('rejects with a required comment; balance untouched; reservation released', async () => {
      const leave = await apply(empApi);
      const res = await reject(leave._id, 'Release week, sorry');
      assert.equal(res.status, 200);
      assert.equal(res.body.leave.status, 'rejected');
      assert.equal(res.body.leave.managerComment, 'Release week, sorry');
      assert.equal(await balance(), 12);
      const bal = (await empApi.get('/api/leaves/balance')).body.balance[0];
      assert.equal(bal.available, 12);
    });

    test('rejection without a meaningful comment is refused', async () => {
      const leave = await apply(empApi);
      for (const c of [undefined, '', '  ', 'no']) {
        const res = await reject(leave._id, c);
        assert.equal(res.status, 400, JSON.stringify(c));
        assert.match(res.body.message, /comment/);
      }
      assert.equal((await reject(leave._id, 'x'.repeat(501))).status, 400);
      assert.equal((await reject(leave._id, 123)).status, 400);
      assert.equal((await Leave.findById(leave._id)).status, 'pending');
    });
  });

  describe('admin review', () => {
    test("admin can approve any team's leave (balance deducted, admin recorded)", async () => {
      const admin = await makeUser({ role: 'admin', name: 'Ada Admin' });
      const adminApi = await as(admin);
      const leave = await apply(await as(outsider));
      const res = await approve(leave._id, 'Approved by admin', adminApi);
      assert.equal(res.status, 200);
      assert.equal(res.body.leave.reviewedBy.name, 'Ada Admin');
      assert.equal(await balance(outsider), 10);
    });

    test('admin reviews leave of a user without a manager; rejection still needs a comment', async () => {
      const adminApi = await as(await makeUser({ role: 'admin' }));
      const leave = await apply(mgrApi); // Mona Manager has no manager
      assert.equal((await reject(leave._id, '', adminApi)).status, 400);
      const res = await reject(leave._id, 'Team offsite that week', adminApi);
      assert.equal(res.status, 200);
      assert.equal(res.body.leave.status, 'rejected');
      assert.equal(await balance(mgr), 12);
    });

    test('final-status and balance rules apply to admins too', async () => {
      const adminApi = await as(await makeUser({ role: 'admin' }));
      const leave = await apply(empApi);
      await approve(leave._id);
      const again = await reject(leave._id, 'Changing my mind', adminApi);
      assert.equal(again.status, 400);
      assert.match(again.body.message, /can no longer be changed/);
      assert.equal(await balance(), 10);
    });

    test("a manager still can't review another team, nor their own leave", async () => {
      // Mona's own request goes to admins; Mona can't approve it herself.
      const own = await apply(mgrApi);
      assert.equal((await approve(own._id)).status, 404);
      const other = await apply(await as(outsider));
      assert.equal((await approve(other._id)).status, 404);
    });
  });

  describe('final status cannot change', () => {
    test('approved, rejected and cancelled leaves cannot be reviewed again', async () => {
      const a = await apply(empApi, { startDate: d(0), endDate: d(0) });
      const r = await apply(empApi, { startDate: d(1), endDate: d(1) });
      const c = await apply(empApi, { startDate: d(2), endDate: d(2) });
      await approve(a._id);
      await reject(r._id, 'Not this time');
      await empApi.patch(`/api/leaves/${c._id}/cancel`, {});

      for (const [id, status] of [[a._id, 'approved'], [r._id, 'rejected'], [c._id, 'cancelled']]) {
        const ap = await approve(id);
        const rj = await reject(id, 'Changing my mind');
        assert.equal(ap.status, 400);
        assert.equal(rj.status, 400);
        assert.match(ap.body.message, /can no longer be changed/);
        assert.equal((await Leave.findById(id)).status, status);
      }
      assert.equal(await balance(), 11); // only the one approved day was deducted
    });
  });

  describe('end-to-end with cancellation', () => {
    test('approve then employee cancels future leave: balance fully restored', async () => {
      const leave = await apply(empApi);
      await approve(leave._id);
      assert.equal(await balance(), 10);
      const res = await empApi.patch(`/api/leaves/${leave._id}/cancel`, {});
      assert.equal(res.status, 200);
      assert.equal(await balance(), 12);
    });
  });

  describe('races', () => {
    test('double approve at the same time deducts once', async () => {
      const leave = await apply(empApi);
      const results = await Promise.all([approve(leave._id), approve(leave._id), approve(leave._id)]);
      assert.equal(results.filter((r) => r.status === 200).length, 1);
      assert.equal(await balance(), 10);
    });

    test('approve vs reject at the same time: exactly one wins', async () => {
      const leave = await apply(empApi);
      const [ap, rj] = await Promise.all([approve(leave._id), reject(leave._id, 'Conflicting call')]);
      assert.equal([ap, rj].filter((r) => r.status === 200).length, 1);
      const final = await Leave.findById(leave._id);
      assert.equal(await balance(), final.status === 'approved' ? 10 : 12);
    });

    test('approve vs employee cancel at the same time: balance stays consistent', async () => {
      const leave = await apply(empApi);
      await Promise.all([approve(leave._id), empApi.patch(`/api/leaves/${leave._id}/cancel`, {})]);
      const final = await Leave.findById(leave._id);
      // Either approved (2 deducted) or cancelled (nothing deducted) - never cancelled with a deduction.
      assert.ok(['approved', 'cancelled'].includes(final.status));
      assert.equal(await balance(), final.status === 'approved' ? 10 : 12);
    });
  });
});

describe('Admin: GET /api/leaves/all', () => {
  before(connectTestDB);
  after(closeTestDB);

  test('admin sees every team, can filter and search; others get 403', async () => {
    const m1 = await makeUser({ role: 'manager' });
    const m2 = await makeUser({ role: 'manager' });
    const e1 = await makeUser({ name: 'Alpha Person', manager: m1._id });
    const e2 = await makeUser({ name: 'Beta Person', manager: m2._id });
    for (const e of [e1, e2]) {
      await (await as(e)).post('/api/leaves', { leaveType: 'casual', reason: 'Trip', startDate: d(0), endDate: d(0) });
    }
    const adminApi = await as(await makeUser({ role: 'admin' }));
    const all = await adminApi.get('/api/leaves/all');
    assert.equal(all.status, 200);
    assert.equal(all.body.pagination.total, 2);
    assert.equal((await adminApi.get('/api/leaves/all?search=beta')).body.pagination.total, 1);
    assert.equal((await adminApi.get('/api/leaves/all?status=approved')).body.pagination.total, 0);
    assert.ok(all.body.data[0].employee.name);
    assert.equal((await (await as(m1)).get('/api/leaves/all')).status, 403);
    assert.equal((await (await as(e1)).get('/api/leaves/all')).status, 403);
  });
});
