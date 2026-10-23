import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import User from '../src/models/User.js';
import { runSeed } from '../src/seed/seedUsers.js';
import { seedUsers, SEED_PASSWORD } from '../src/seed/seedData.js';
import { connectTestDB, closeTestDB } from './helpers/db.js';

describe('Seed script', () => {
  before(connectTestDB);
  after(closeTestDB);

  test('creates all seed users with correct roles and managers', async () => {
    const existing = await User.create({ name: 'Real User', email: 'real@company.com', password: 'keepme1' });

    const { created, skipped } = await runSeed();
    assert.equal(created.length, seedUsers.length);
    assert.equal(skipped.length, 0);

    const admin = await User.findOne({ email: 'admin@example.com' }).select('+password');
    assert.equal(admin.role, 'admin');
    assert.equal(await admin.comparePassword(SEED_PASSWORD), true);

    const m1 = await User.findOne({ email: 'manager1@example.com' });
    const e1 = await User.findOne({ email: 'employee1@example.com' });
    assert.equal(e1.manager.toString(), m1._id.toString());

    // Pre-existing data untouched
    assert.ok(await User.exists({ _id: existing._id }));
  });

  test('is safe to run again: skips existing users, changes nothing', async () => {
    const before = await User.countDocuments();
    const admin = await User.findOne({ email: 'admin@example.com' });
    admin.name = 'Renamed Admin';
    await admin.save();

    const { created, skipped } = await runSeed();
    assert.equal(created.length, 0);
    assert.equal(skipped.length, seedUsers.length);
    assert.equal(await User.countDocuments(), before);
    assert.equal((await User.findById(admin._id)).name, 'Renamed Admin');
  });
});

describe('Seed: manager hierarchy', () => {
  before(connectTestDB);
  after(closeTestDB);

  test('Manager Two reports to Manager One (so managers can apply for leave)', async () => {
    await runSeed();
    const m1 = await User.findOne({ email: 'manager1@example.com' });
    const m2 = await User.findOne({ email: 'manager2@example.com' });
    assert.equal(String(m2.manager), String(m1._id));
    assert.equal(m1.manager, null);
  });
});
