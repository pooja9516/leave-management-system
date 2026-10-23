import User from '../models/User.js';
import { seedUsers, SEED_PASSWORD } from './seedData.js';

// Creates missing seed users only; existing users are never modified or deleted.
export const runSeed = async () => {
  const created = [];
  const skipped = [];

  // Create anyone that others report to first: users without a manager, then managers, then employees.
  const ordered = [...seedUsers].sort(
    (a, b) => Boolean(a.managerEmail) - Boolean(b.managerEmail) || (a.role === 'employee') - (b.role === 'employee')
  );

  for (const { managerEmail, ...data } of ordered) {
    if (await User.exists({ email: data.email })) {
      skipped.push(data.email);
      continue;
    }

    let manager = null;
    if (managerEmail) {
      manager = await User.findOne({ email: managerEmail }).select('_id');
      if (!manager) throw new Error(`Manager ${managerEmail} not found for ${data.email}`);
    }

    await User.create({ ...data, password: SEED_PASSWORD, manager: manager?._id ?? null });
    created.push(data.email);
  }

  return { created, skipped };
};
