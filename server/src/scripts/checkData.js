// Read-only data integrity report: `npm run check:data`. Never modifies the database.
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { runDataChecks } from './dataChecks.js';

await connectDB(env.MONGO_URI);

try {
  const { errors, warnings, stats } = await runDataChecks();
  console.log('\nDatabase:', mongoose.connection.name);
  console.log(
    `Users: ${stats.users} (${stats.activeUsers} active) | Leaves: ${stats.leaves} ` +
      `(pending ${stats.pending}, approved ${stats.approved}, rejected ${stats.rejected}, cancelled ${stats.cancelled}) | ` +
      `Holidays: ${stats.holidays}\n`
  );
  console.log(`Checks: users & reporting lines, leave records, overlaps, balances (= yearly total - approved days),`);
  console.log(`        pending vs available, holidays.\n`);

  warnings.forEach((w) => console.log(`  WARNING  ${w}`));
  errors.forEach((e) => console.log(`  ERROR    ${e}`));

  if (!errors.length) {
    console.log(`\nAll data checks passed${warnings.length ? ` (${warnings.length} warning(s) above)` : ''}.`);
  } else {
    console.log(`\n${errors.length} problem(s) found.`);
    process.exitCode = 1;
  }
} catch (err) {
  console.error('Data check failed:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
