// Pregnancy due-date calculator (src/pages/tools/dueDate.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, sizeForWeek, monthLabel, parseISODate } from '../src/pages/tools/dueDate.js';
import { U, iso } from './helpers.mjs';

const T = U('2026-08-06');

test('due date = LMP + 280 days for a 28-day cycle', () => {
  const r = calculate('2026-01-01', 28, T);
  assert.equal(iso(r.due), '2026-10-08');
  assert.equal(r.monthKey, '2026-10');
});

test('due date shifts by (cycle - 28) days', () => {
  assert.equal(iso(calculate('2026-01-01', 30, T).due), '2026-10-10');
  assert.equal(iso(calculate('2026-01-01', 21, T).due), '2026-10-01');
});

test('cycle length is clamped to 21–35', () => {
  assert.equal(iso(calculate('2026-01-01', 99, T).due), iso(calculate('2026-01-01', 35, T).due));
  assert.equal(iso(calculate('2026-01-01', 5, T).due), iso(calculate('2026-01-01', 21, T).due));
});

test('weeks, days and trimester', () => {
  const r = calculate('2026-01-01', 28, T); // 217 days
  assert.equal(r.weeks, 31);
  assert.equal(r.days, 0);
  assert.equal(r.trimester, 3);
  assert.equal(calculate('2026-06-01', 28, T).trimester, 1); // 9 weeks
  assert.equal(calculate('2026-03-15', 28, T).trimester, 2); // 20 weeks
});

test('trimester boundaries at 14 and 28 weeks', () => {
  assert.equal(calculate(iso(T - 13 * 7 * 86400000), 28, T).trimester, 1);
  assert.equal(calculate(iso(T - 14 * 7 * 86400000), 28, T).trimester, 2);
  assert.equal(calculate(iso(T - 28 * 7 * 86400000), 28, T).trimester, 3);
});

test('early flag before day 14, past-due flag after the due date', () => {
  assert.equal(calculate('2026-07-30', 28, T).early, true);
  assert.equal(calculate('2026-07-01', 28, T).early, false);
  assert.equal(calculate('2025-10-20', 28, T).pastDue, true);
});

test('errors: invalid, future, too old', () => {
  assert.equal(calculate('2026-02-31', 28, T).error, 'invalid');
  assert.equal(calculate('nonsense', 28, T).error, 'invalid');
  assert.equal(calculate('2026-08-07', 28, T).error, 'future');
  assert.equal(calculate('2025-09-01', 28, T).error, 'tooOld'); // > 44 weeks
  assert.equal(calculate('2025-10-10', 28, T).error, undefined); // 300 days ago
  // exact edge: 44 weeks (308 days) is allowed, 309 days is too old
  assert.equal(calculate(iso(T - 308 * 86400000), 28, T).error, undefined);
  assert.equal(calculate(iso(T - 309 * 86400000), 28, T).error, 'tooOld');
});

test('parseISODate rejects impossible dates', () => {
  assert.equal(parseISODate('2026-02-29'), null); // 2026 is not a leap year
  assert.notEqual(parseISODate('2028-02-29'), null);
});

test('baby size by week', () => {
  assert.equal(sizeForWeek(3), null);
  assert.equal(sizeForWeek(4).en, 'a poppy seed');
  assert.equal(sizeForWeek(45).en, 'a watermelon'); // capped at 40
});

test('monthLabel', () => {
  assert.equal(monthLabel('2027-03'), 'March 2027');
  assert.equal(monthLabel('2027-13'), null);
  assert.equal(monthLabel('x'), null);
});
