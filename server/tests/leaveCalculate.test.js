import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import Holiday from '../src/models/Holiday.js';
import { parseDateOnly } from '../src/utils/dates.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { makeUser, as } from './helpers/auth.js';

describe('GET /api/leaves/calculate', () => {
  let api;
  before(connectTestDB);
  after(closeTestDB);
  beforeEach(async () => {
    await clearTestDB();
    api = await as(await makeUser());
    await Holiday.create({ name: 'Test Holiday', date: parseDateOnly('2026-11-04') });
  });

  const calc = (q) => api.get(`/api/leaves/calculate?${new URLSearchParams(q)}`);

  test('excludes weekends and DB holidays, returns holiday names', async () => {
    const res = await calc({ startDate: '2026-11-02', endDate: '2026-11-09' });
    assert.equal(res.status, 200);
    assert.equal(res.body.days, 5);
    assert.deepEqual(res.body.holidays, [{ date: '2026-11-04', name: 'Test Holiday' }]);
    assert.deepEqual(res.body.weekendDates, ['2026-11-07', '2026-11-08']);
  });

  test('half day', async () => {
    const res = await calc({ startDate: '2026-11-05', endDate: '2026-11-05', halfDay: 'true' });
    assert.equal(res.body.days, 0.5);
  });

  test('validation errors return 400 with clear messages', async () => {
    assert.match((await calc({ endDate: '2026-11-05' })).body.message, /Start date/);
    assert.match((await calc({ startDate: '2026-11-05', endDate: 'x' })).body.message, /End date/);
    assert.match(
      (await calc({ startDate: '2026-11-06', endDate: '2026-11-05' })).body.message,
      /cannot be before/
    );
    assert.equal((await calc({ startDate: '2026-11-05', endDate: '2026-11-05', halfDay: 'yes' })).status, 400);
  });

  test('requires login', async () => {
    assert.equal((await request(app).get('/api/leaves/calculate')).status, 401);
  });
});
