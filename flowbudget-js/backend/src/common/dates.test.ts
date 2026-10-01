import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, addMonths, daysOfMonth, diffDays, isValidDateStr, monthEnd, monthsBetween, monthStart, weekStart } from './dates.js';

test('month arithmetic crosses year boundaries', () => {
  assert.equal(addMonths('2026-11-15', 2), '2027-01-01');
  assert.equal(addMonths('2026-01-31', -1), '2025-12-01');
  assert.equal(monthStart('2026-10-17'), '2026-10-01');
  assert.equal(monthEnd('2028-02-03'), '2028-02-29');
  assert.deepEqual(monthsBetween('2026-11-20', '2027-01-02'), ['2026-11-01', '2026-12-01', '2027-01-01']);
});

test('day helpers', () => {
  assert.equal(daysOfMonth('2026-09-10').length, 30);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(diffDays('2026-10-01', '2026-11-01'), 31);
  assert.equal(weekStart('2026-10-04'), '2026-09-28');
});

test('date validation', () => {
  assert.ok(isValidDateStr('2028-02-29'));
  assert.ok(!isValidDateStr('2026-02-29'));
  assert.ok(!isValidDateStr('2026-10-01T00:00:00Z'));
});
