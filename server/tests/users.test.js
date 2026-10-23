import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Leave from '../src/models/Leave.js';
import { futureMonday } from './helpers/dates.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { makeUser, as, PASSWORD } from './helpers/auth.js';

describe('Admin user management /api/users', () => {
  let admin, adminApi, manager, manager2, employee;

  before(connectTestDB);
  after(closeTestDB);
  beforeEach(async () => {
    await clearTestDB();
    await User.syncIndexes();
    admin = await makeUser({ role: 'admin', name: 'Alice Admin' });
    manager = await makeUser({ role: 'manager', name: 'Mona Manager' });
    manager2 = await makeUser({ role: 'manager', name: 'Max Manager' });
    employee = await makeUser({ name: 'Eve Employee', manager: manager._id });
    adminApi = await as(admin);
  });

  describe('access control', () => {
    test('employee and manager get 403, no token gets 401', async () => {
      assert.equal((await (await as(employee)).get('/api/users')).status, 403);
      assert.equal((await (await as(manager)).get('/api/users')).status, 403);
      assert.equal((await (await as(manager)).post('/api/users', { name: 'x' })).status, 403);
      assert.equal((await request(app).get('/api/users')).status, 401);
    });
  });

  describe('GET /api/users', () => {
    test('returns paginated list with manager populated and no passwords', async () => {
      const res = await adminApi.get('/api/users?limit=2&page=1');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 2);
      assert.deepEqual(res.body.pagination, { page: 1, limit: 2, total: 4, totalPages: 2 });
      assert.ok(!JSON.stringify(res.body).includes('password'));

      const all = await adminApi.get('/api/users?limit=50');
      const eve = all.body.data.find((u) => u.name === 'Eve Employee');
      assert.equal(eve.manager.name, 'Mona Manager');
    });

    test('page 2 returns the remaining items; out-of-range page is empty', async () => {
      const p2 = await adminApi.get('/api/users?limit=3&page=2');
      assert.equal(p2.body.data.length, 1);
      const p9 = await adminApi.get('/api/users?limit=3&page=9');
      assert.equal(p9.body.data.length, 0);
      assert.equal(p9.body.pagination.total, 4);
    });

    test('bad paging values fall back to safe defaults; limit capped at 100', async () => {
      const res = await adminApi.get('/api/users?page=-5&limit=abc');
      assert.equal(res.body.pagination.page, 1);
      assert.equal(res.body.pagination.limit, 10);
      const big = await adminApi.get('/api/users?limit=5000');
      assert.equal(big.body.pagination.limit, 100);
    });

    test('filters by role, isActive, manager and search', async () => {
      const managers = await adminApi.get('/api/users?role=manager');
      assert.equal(managers.body.pagination.total, 2);

      await User.updateOne({ _id: manager2._id }, { isActive: false });
      const inactive = await adminApi.get('/api/users?isActive=false');
      assert.deepEqual(inactive.body.data.map((u) => u.name), ['Max Manager']);

      const team = await adminApi.get(`/api/users?manager=${manager._id}`);
      assert.deepEqual(team.body.data.map((u) => u.name), ['Eve Employee']);

      const search = await adminApi.get('/api/users?search=mona');
      assert.deepEqual(search.body.data.map((u) => u.name), ['Mona Manager']);
      const byEmail = await adminApi.get(`/api/users?search=${employee.email}`);
      assert.equal(byEmail.body.pagination.total, 1);
    });

    test('search with regex special characters does not crash', async () => {
      const res = await adminApi.get('/api/users?search=' + encodeURIComponent('.*(['));
      assert.equal(res.status, 200);
      assert.equal(res.body.pagination.total, 0);
    });

    test('invalid role or manager filter returns 400', async () => {
      assert.equal((await adminApi.get('/api/users?role=boss')).status, 400);
      assert.equal((await adminApi.get('/api/users?manager=xyz')).status, 400);
    });
  });

  describe('GET /api/users/:id', () => {
    test('returns one user; 404 for unknown id; 400 for invalid id', async () => {
      const res = await adminApi.get(`/api/users/${employee._id}`);
      assert.equal(res.body.user.name, 'Eve Employee');
      assert.equal((await adminApi.get('/api/users/507f1f77bcf86cd799439011')).status, 404);
      assert.equal((await adminApi.get('/api/users/not-an-id')).status, 400);
    });
  });

  describe('POST /api/users', () => {
    const newUser = (extra = {}) => ({
      name: 'New Person',
      email: 'new@test.com',
      password: 'newpass1',
      ...extra,
    });

    test('creates employee with default balance; new user can log in', async () => {
      const res = await adminApi.post('/api/users', newUser({ manager: manager._id }));
      assert.equal(res.status, 201);
      assert.equal(res.body.user.role, 'employee');
      assert.equal(res.body.user.manager.name, 'Mona Manager');
      assert.deepEqual(res.body.user.leaveBalance, { casual: 12, sick: 8, paid: 15 });
      assert.equal(res.body.user.password, undefined);

      const login = await request(app).post('/api/auth/login').send({ email: 'new@test.com', password: 'newpass1' });
      assert.equal(login.status, 200);
    });

    test('ignores leaveBalance and unknown fields sent by client', async () => {
      const res = await adminApi.post('/api/users', newUser({ leaveBalance: { casual: 999 }, foo: 1 }));
      assert.equal(res.status, 201);
      assert.equal(res.body.user.leaveBalance.casual, 12);
      assert.equal(res.body.user.foo, undefined);
    });

    test('duplicate email returns 409', async () => {
      const res = await adminApi.post('/api/users', newUser({ email: employee.email.toUpperCase() }));
      assert.equal(res.status, 409);
      assert.match(res.body.message, /email already exists/);
    });

    test('validation errors return 400 with readable message', async () => {
      const res = await adminApi.post('/api/users', { email: 'bad' });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /Name is required/);
      assert.equal((await adminApi.post('/api/users', newUser({ role: 'boss' }))).status, 400);
    });

    test('manager must be an active user with manager role', async () => {
      assert.equal((await adminApi.post('/api/users', newUser({ manager: employee._id }))).status, 400);
      assert.equal((await adminApi.post('/api/users', newUser({ manager: 'abc' }))).status, 400);
      assert.equal(
        (await adminApi.post('/api/users', newUser({ manager: '507f1f77bcf86cd799439011' }))).status,
        400
      );
      await User.updateOne({ _id: manager2._id }, { isActive: false });
      const res = await adminApi.post('/api/users', newUser({ manager: manager2._id }));
      assert.equal(res.status, 400);
      assert.match(res.body.message, /deactivated/);
    });
  });

  describe('PATCH /api/users/:id', () => {
    test('updates name, role and reassigns manager', async () => {
      const res = await adminApi.patch(`/api/users/${employee._id}`, {
        name: 'Eve Updated',
        manager: manager2._id,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.user.name, 'Eve Updated');
      assert.equal(res.body.user.manager.name, 'Max Manager');
    });

    test('manager can be removed with null', async () => {
      const res = await adminApi.patch(`/api/users/${employee._id}`, { manager: null });
      assert.equal(res.status, 200);
      assert.equal(res.body.user.manager, null);
    });

    test('password reset is hashed and works for login; empty password is ignored', async () => {
      await adminApi.patch(`/api/users/${employee._id}`, { password: 'changed1' });
      const stored = await User.findById(employee._id).select('+password');
      assert.notEqual(stored.password, 'changed1');
      assert.equal(await stored.comparePassword('changed1'), true);

      await adminApi.patch(`/api/users/${employee._id}`, { password: '', name: 'Still Eve' });
      const again = await User.findById(employee._id).select('+password');
      assert.equal(await again.comparePassword('changed1'), true);
    });

    test('leaveBalance cannot be changed through this endpoint', async () => {
      await adminApi.patch(`/api/users/${employee._id}`, { leaveBalance: { casual: 0 } });
      const u = await User.findById(employee._id);
      assert.equal(u.leaveBalance.casual, 12);
    });

    test('cannot be own manager or create a reporting cycle', async () => {
      const self = await adminApi.patch(`/api/users/${manager._id}`, { manager: manager._id });
      assert.equal(self.status, 400);

      await adminApi.patch(`/api/users/${manager2._id}`, { manager: manager._id });
      const cycle = await adminApi.patch(`/api/users/${manager._id}`, { manager: manager2._id });
      assert.equal(cycle.status, 400);
      assert.match(cycle.body.message, /circular/);
    });

    test('manager with active team cannot be demoted or deactivated', async () => {
      const demote = await adminApi.patch(`/api/users/${manager._id}`, { role: 'employee' });
      assert.equal(demote.status, 409);
      assert.match(demote.body.message, /Reassign/);
      const deact = await adminApi.patch(`/api/users/${manager._id}`, { isActive: false });
      assert.equal(deact.status, 409);

      // After reassigning the team it is allowed
      await adminApi.patch(`/api/users/${employee._id}`, { manager: manager2._id });
      const ok = await adminApi.patch(`/api/users/${manager._id}`, { role: 'employee' });
      assert.equal(ok.status, 200);
    });

    test('admin cannot change own role or deactivate self', async () => {
      assert.equal((await adminApi.patch(`/api/users/${admin._id}`, { role: 'employee' })).status, 400);
      assert.equal((await adminApi.patch(`/api/users/${admin._id}`, { isActive: false })).status, 400);
      const ok = await adminApi.patch(`/api/users/${admin._id}`, { name: 'Alice Renamed' });
      assert.equal(ok.status, 200);
    });

    test('deactivated user cannot log in; reactivating restores access', async () => {
      await adminApi.patch(`/api/users/${employee._id}`, { isActive: false });
      const login = () => request(app).post('/api/auth/login').send({ email: employee.email, password: PASSWORD });
      assert.equal((await login()).status, 403);
      await adminApi.patch(`/api/users/${employee._id}`, { isActive: true });
      assert.equal((await login()).status, 200);
    });

    test('404 for unknown user; duplicate email gives 409', async () => {
      assert.equal((await adminApi.patch('/api/users/507f1f77bcf86cd799439011', { name: 'x' })).status, 404);
      const dup = await adminApi.patch(`/api/users/${employee._id}`, { email: manager.email });
      assert.equal(dup.status, 409);
    });

    test('there is no DELETE endpoint (users are deactivated instead)', async () => {
      assert.equal((await adminApi.delete(`/api/users/${employee._id}`)).status, 404);
      assert.ok(await User.exists({ _id: employee._id }));
    });
  });
});

describe('Role change to admin with open leaves', () => {
  before(connectTestDB);
  after(closeTestDB);

  test('blocked while the user has pending or upcoming approved leave; allowed afterwards', async () => {
    const mgr = await makeUser({ role: 'manager' });
    const emp = await makeUser({ manager: mgr._id });
    const adminApi = await as(await makeUser({ role: 'admin' }));
    const mon = futureMonday(2);
    const leave = await Leave.create({ employee: emp._id, leaveType: 'casual', startDate: mon, endDate: mon, days: 1, reason: 'Trip' });

    const blocked = await adminApi.patch(`/api/users/${emp._id}`, { role: 'admin' });
    assert.equal(blocked.status, 409);
    assert.match(blocked.body.message, /pending or upcoming leave/);

    await Leave.updateOne({ _id: leave._id }, { status: 'cancelled', cancelledAt: new Date() });
    const ok = await adminApi.patch(`/api/users/${emp._id}`, { role: 'admin' });
    assert.equal(ok.status, 200);
  });
});
