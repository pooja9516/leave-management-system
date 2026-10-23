import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import User from '../src/models/User.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';

const base = { name: 'Test User', email: 'Test@Example.com', password: 'secret123' };

describe('User model', () => {
  before(connectTestDB);
  after(closeTestDB);
  beforeEach(async () => {
    await clearTestDB();
    await User.syncIndexes();
  });

  test('applies defaults: employee role, no manager, full leave balance', async () => {
    const user = await User.create(base);
    assert.equal(user.role, 'employee');
    assert.equal(user.manager, null);
    assert.equal(user.isActive, true);
    assert.deepEqual(user.leaveBalance.toObject(), { casual: 12, sick: 8, paid: 15 });
    assert.equal(user.email, 'test@example.com');
  });

  test('hashes the password and compares correctly', async () => {
    const user = await User.create(base);
    const stored = await User.findById(user._id).select('+password');
    assert.notEqual(stored.password, 'secret123');
    assert.match(stored.password, /^\$2[aby]\$/);
    assert.equal(await stored.comparePassword('secret123'), true);
    assert.equal(await stored.comparePassword('wrong'), false);
  });

  test('does not re-hash password when other fields change', async () => {
    const user = await User.create(base);
    const first = (await User.findById(user._id).select('+password')).password;
    const doc = await User.findById(user._id).select('+password');
    doc.name = 'Changed';
    await doc.save();
    const second = (await User.findById(user._id).select('+password')).password;
    assert.equal(first, second);
  });

  test('never returns password in queries or JSON', async () => {
    const user = await User.create(base);
    assert.equal(JSON.stringify(user).includes('password'), false);
    const found = await User.findById(user._id);
    assert.equal(found.password, undefined);
  });

  test('rejects duplicate email (case-insensitive)', async () => {
    await User.create(base);
    await assert.rejects(User.create({ ...base, email: 'test@example.com' }), { code: 11000 });
  });

  test('validates required fields, email format, role and password length', async () => {
    await assert.rejects(User.create({}), /Name is required/);
    await assert.rejects(User.create({ ...base, email: 'bad' }), /Email is invalid/);
    await assert.rejects(User.create({ ...base, role: 'boss' }), /Invalid role/);
    await assert.rejects(User.create({ ...base, password: '123' }), /at least 6/);
  });

  test('rejects negative leave balance', async () => {
    await assert.rejects(
      User.create({ ...base, leaveBalance: { casual: -1 } }),
      /casual balance cannot be negative/
    );
  });
});
