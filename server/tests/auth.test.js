import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { env } from '../src/config/env.js';
import { protect, authorize } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/error.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';

const PASSWORD = 'secret123';
const createUser = (data = {}) =>
  User.create({ name: 'Emp', email: 'emp@test.com', password: PASSWORD, ...data });
const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

describe('POST /api/auth/login', () => {
  before(connectTestDB);
  after(closeTestDB);
  beforeEach(clearTestDB);

  test('returns token and user (without password) for valid credentials', async () => {
    await createUser();
    const res = await login('emp@test.com', PASSWORD);
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, 'emp@test.com');
    assert.equal(res.body.user.role, 'employee');
    assert.equal(res.body.user.password, undefined);
    const payload = jwt.verify(res.body.token, env.JWT_SECRET);
    assert.equal(payload.role, 'employee');
  });

  test('email is case-insensitive and trimmed', async () => {
    await createUser();
    const res = await login('  EMP@Test.com ', PASSWORD);
    assert.equal(res.status, 200);
  });

  test('wrong password and unknown email give the same 401 message', async () => {
    await createUser();
    const a = await login('emp@test.com', 'wrongpass');
    const b = await login('nobody@test.com', PASSWORD);
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.message, 'Invalid email or password');
    assert.equal(b.body.message, a.body.message);
  });

  test('missing fields return 400', async () => {
    assert.equal((await login('', PASSWORD)).status, 400);
    assert.equal((await login('emp@test.com', '')).status, 400);
    assert.equal((await request(app).post('/api/auth/login')).status, 400);
  });

  test('rejects query-operator injection in email/password', async () => {
    await createUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $gt: '' }, password: { $gt: '' } });
    assert.equal(res.status, 400);
  });

  test('deactivated user cannot log in', async () => {
    await createUser({ isActive: false });
    const res = await login('emp@test.com', PASSWORD);
    assert.equal(res.status, 403);
  });
});

describe('GET /api/auth/me', () => {
  before(connectTestDB);
  after(closeTestDB);
  beforeEach(clearTestDB);

  const me = (token) => {
    const req = request(app).get('/api/auth/me');
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  test('returns current user with manager populated', async () => {
    const mgr = await createUser({ email: 'mgr@test.com', name: 'Boss', role: 'manager' });
    await createUser({ manager: mgr._id });
    const { body } = await login('emp@test.com', PASSWORD);
    const res = await me(body.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'emp@test.com');
    assert.equal(res.body.user.manager.name, 'Boss');
    assert.equal(res.body.user.password, undefined);
  });

  test('401 without token, with malformed header, or with bad token', async () => {
    assert.equal((await me()).status, 401);
    assert.equal((await request(app).get('/api/auth/me').set('Authorization', 'Token abc')).status, 401);
    assert.equal((await me('not.a.jwt')).status, 401);
    const forged = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, 'wrong-secret');
    assert.equal((await me(forged)).status, 401);
  });

  test('401 with expired token', async () => {
    const user = await createUser();
    const expired = jwt.sign({ sub: user._id.toString() }, env.JWT_SECRET, { expiresIn: -10 });
    const res = await me(expired);
    assert.equal(res.status, 401);
    assert.match(res.body.message, /expired/);
  });

  test('401 if user was deleted or deactivated after login', async () => {
    const user = await createUser();
    const { body } = await login('emp@test.com', PASSWORD);
    await User.updateOne({ _id: user._id }, { isActive: false });
    assert.equal((await me(body.token)).status, 401);
    await User.deleteOne({ _id: user._id });
    assert.equal((await me(body.token)).status, 401);
  });
});

describe('authorize() role guard', () => {
  before(connectTestDB);
  after(closeTestDB);
  beforeEach(clearTestDB);

  const guarded = express();
  guarded.get('/admin-only', protect, authorize('admin'), (req, res) => res.json({ ok: true }));
  guarded.get('/staff', protect, authorize('manager', 'admin'), (req, res) => res.json({ ok: true }));
  guarded.use(errorHandler);

  const tokenFor = async (role) => {
    await createUser({ email: `${role}@test.com`, role });
    return (await login(`${role}@test.com`, PASSWORD)).body.token;
  };
  const call = (path, token) => request(guarded).get(path).set('Authorization', `Bearer ${token}`);

  test('allows and blocks by role', async () => {
    const emp = await tokenFor('employee');
    const mgr = await tokenFor('manager');
    const adm = await tokenFor('admin');

    assert.equal((await call('/admin-only', emp)).status, 403);
    assert.equal((await call('/admin-only', mgr)).status, 403);
    assert.equal((await call('/admin-only', adm)).status, 200);
    assert.equal((await call('/staff', emp)).status, 403);
    assert.equal((await call('/staff', mgr)).status, 200);
    assert.equal((await call('/staff', adm)).status, 200);
  });

  test('uses current role from DB, not the role inside the token', async () => {
    const token = await tokenFor('admin');
    await User.updateOne({ email: 'admin@test.com' }, { role: 'employee' });
    assert.equal((await call('/admin-only', token)).status, 403);
  });
});
