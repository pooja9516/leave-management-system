import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import Holiday from '../src/models/Holiday.js';
import { runHolidaySeed } from '../src/seed/seedHolidays.js';
import { seedHolidays } from '../src/seed/seedData.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { makeUser, as } from './helpers/auth.js';

describe('Holidays /api/holidays', () => {
  let adminApi, employeeApi, managerApi;

  before(connectTestDB);
  after(closeTestDB);
  beforeEach(async () => {
    await clearTestDB();
    await Holiday.syncIndexes();
    adminApi = await as(await makeUser({ role: 'admin' }));
    managerApi = await as(await makeUser({ role: 'manager' }));
    employeeApi = await as(await makeUser());
  });

  const add = (name, date) => adminApi.post('/api/holidays', { name, date });

  test('admin creates a holiday stored at UTC midnight', async () => {
    const res = await add('Diwali', '2026-11-08');
    assert.equal(res.status, 201);
    assert.equal(res.body.holiday.name, 'Diwali');
    assert.equal(res.body.holiday.date, '2026-11-08T00:00:00.000Z');
  });

  test('everyone logged in can list; sorted by date; filter by year', async () => {
    await add('Christmas', '2026-12-25');
    await add('New Year', '2027-01-01');
    await add('Republic Day', '2026-01-26');

    for (const api of [employeeApi, managerApi, adminApi]) {
      const res = await api.get('/api/holidays');
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data.map((h) => h.name), ['Republic Day', 'Christmas', 'New Year']);
    }
    const y2026 = await employeeApi.get('/api/holidays?year=2026');
    assert.equal(y2026.body.pagination.total, 2);
    assert.equal((await employeeApi.get('/api/holidays?year=abc')).status, 400);
  });

  test('requires login to list', async () => {
    assert.equal((await request(app).get('/api/holidays')).status, 401);
  });

  test('employee and manager cannot create, edit or delete', async () => {
    const { body } = await add('Diwali', '2026-11-08');
    const id = body.holiday._id;
    for (const api of [employeeApi, managerApi]) {
      assert.equal((await api.post('/api/holidays', { name: 'X', date: '2026-11-09' })).status, 403);
      assert.equal((await api.patch(`/api/holidays/${id}`, { name: 'Y' })).status, 403);
      assert.equal((await api.delete(`/api/holidays/${id}`)).status, 403);
    }
    assert.equal(await Holiday.countDocuments(), 1);
  });

  test('validates name and date', async () => {
    assert.equal((await add('', '2026-11-08')).status, 400);
    assert.match((await add('X', '2026-02-30')).body.message, /YYYY-MM-DD/);
    assert.equal((await add('X', '08/11/2026')).status, 400);
    assert.equal((await add('X')).status, 400);
    assert.equal((await add('A'.repeat(101), '2026-11-08')).status, 400);
  });

  test('duplicate date returns 409', async () => {
    await add('Diwali', '2026-11-08');
    const res = await add('Another', '2026-11-08');
    assert.equal(res.status, 409);
    assert.match(res.body.message, /already exists/);
  });

  test('admin can update name and date; moving onto a taken date returns 409', async () => {
    const a = (await add('Diwali', '2026-11-08')).body.holiday;
    await add('Christmas', '2026-12-25');

    const upd = await adminApi.patch(`/api/holidays/${a._id}`, { name: 'Deepavali', date: '2026-11-09' });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.holiday.name, 'Deepavali');
    assert.equal(upd.body.holiday.date, '2026-11-09T00:00:00.000Z');

    const clash = await adminApi.patch(`/api/holidays/${a._id}`, { date: '2026-12-25' });
    assert.equal(clash.status, 409);
    assert.equal((await adminApi.patch(`/api/holidays/${a._id}`, { date: 'bad' })).status, 400);
  });

  test('admin can delete; unknown id 404, invalid id 400', async () => {
    const a = (await add('Diwali', '2026-11-08')).body.holiday;
    assert.equal((await adminApi.delete(`/api/holidays/${a._id}`)).status, 200);
    assert.equal(await Holiday.countDocuments(), 0);
    assert.equal((await adminApi.delete(`/api/holidays/${a._id}`)).status, 404);
    assert.equal((await adminApi.delete('/api/holidays/bad-id')).status, 400);
  });

  test('holiday seed is idempotent and keeps existing holidays', async () => {
    await add('Custom Day', '2026-06-01');
    const first = await runHolidaySeed();
    assert.equal(first.created.length, seedHolidays.length);
    const second = await runHolidaySeed();
    assert.equal(second.created.length, 0);
    assert.equal(await Holiday.countDocuments(), seedHolidays.length + 1);
  });
});
