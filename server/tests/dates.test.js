import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDateOnly, toDateOnly } from '../src/utils/dates.js';

test('parseDateOnly accepts valid YYYY-MM-DD as UTC midnight', () => {
  const d = parseDateOnly('2026-11-01');
  assert.equal(d.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(toDateOnly(d), '2026-11-01');
  assert.equal(toDateOnly(parseDateOnly('2028-02-29')), '2028-02-29'); // leap year
});

test('parseDateOnly rejects impossible dates and other formats', () => {
  for (const bad of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-00-10', '2026-1-5',
    '01-11-2026', '2026/11/01', '2026-11-01T10:00:00Z', '', 'abc', null, undefined, 20261101, {}]) {
    assert.equal(parseDateOnly(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
});
