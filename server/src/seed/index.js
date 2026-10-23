import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { runSeed } from './seedUsers.js';
import { runHolidaySeed } from './seedHolidays.js';
import { SEED_PASSWORD } from './seedData.js';

const report = (label, { created, skipped }) => {
  console.log(`${label} created (${created.length}):`, created.join(', ') || '-');
  console.log(`${label} skipped, already exist (${skipped.length}):`, skipped.join(', ') || '-');
};

await connectDB(env.MONGO_URI);

try {
  report('Users', await runSeed());
  report('Holidays', await runHolidaySeed());
  console.log(`Password for seeded users: ${SEED_PASSWORD}`);
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
