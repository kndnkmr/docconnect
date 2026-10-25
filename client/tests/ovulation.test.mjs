// Ovulation & period calculator (src/pages/tools/ovulation.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, dayKind, monthGrid, buildIcs } from '../src/pages/tools/ovulation.js';
import { U, iso } from './helpers.mjs';

test('28-day cycle: ovulation 14 days before the next period, 6-day fertile window', () => {
  const r = calculate('2026-07-22', 28, 5, U('2026-08-03'));
  assert.equal(iso(r.ovulation), '2026-08-05');
  assert.equal(iso(r.fertileStart), '2026-07-31');
  assert.equal(iso(r.nextPeriod), '2026-08-19');
  assert.equal(r.fertileNow, true);
});

test('after ovulation the next window moves on, but the test date stays this cycle', () => {
  const r = calculate('2026-07-22', 28, 5, U('2026-08-06'));
  assert.equal(iso(r.ovulation), '2026-09-02');
  assert.equal(iso(r.nextPeriod), '2026-08-19');
  assert.equal(iso(r.testFrom), '2026-08-19');
});

test('next 3 cycles', () => {
  const r = calculate('2026-07-22', 28, 5, U('2026-08-06'));
  assert.deepEqual(r.upcoming.map((c) => iso(c.start)), ['2026-08-19', '2026-09-16', '2026-10-14']);
  assert.equal(iso(r.upcoming[0].fertileStart), '2026-08-28');
  assert.equal(iso(r.upcoming[0].ovulation), '2026-09-02');
});

test('short cycle (21 days): ovulation on day 8', () => {
  assert.equal(iso(calculate('2026-08-01', 21, 5, U('2026-08-01')).ovulation), '2026-08-08');
});

test('cycle and period length are clamped', () => {
  const r = calculate('2026-08-01', 99, 99, U('2026-08-06'));
  assert.equal(r.cycle, 35);
  assert.equal(r.period, 7);
});

test('late period is flagged after 3+ days', () => {
  assert.equal(calculate('2026-07-01', 28, 5, U('2026-08-06')).late.days, 8);
  assert.equal(calculate('2026-07-08', 28, 5, U('2026-08-06')).late, null); // only 1 day late
});

test('errors', () => {
  assert.equal(calculate('2026-08-07', 28, 5, U('2026-08-06')).error, 'future');
  assert.equal(calculate('2026-02-31', 28, 5, U('2026-08-06')).error, 'invalid');
  assert.equal(calculate('2026-04-01', 28, 5, U('2026-08-06')).error, 'tooOld');
  assert.equal(calculate('2026-05-08', 28, 5, U('2026-08-06')).error, undefined); // exactly 90 days
});

test('calendar day colours: ovulation > fertile > period', () => {
  const r = calculate('2026-07-22', 28, 5, U('2026-08-03'));
  assert.equal(dayKind(U('2026-08-05'), r.cycles), 'ovulation');
  assert.equal(dayKind(U('2026-07-31'), r.cycles), 'fertile');
  assert.equal(dayKind(U('2026-08-19'), r.cycles), 'period');
  assert.equal(dayKind(U('2026-08-23'), r.cycles), 'period');
  assert.equal(dayKind(U('2026-08-24'), r.cycles), null);
  assert.equal(dayKind(U('2026-08-06'), r.cycles), null);
});

test('month grid starts on Monday', () => {
  const g = monthGrid(2026, 7); // August 2026 starts on a Saturday
  assert.equal(g[0].filter((x) => x === null).length, 5);
  assert.equal(new Date(g[0][5]).getUTCDate(), 1);
});

test('calendar file: 4 cycles × (fertile + period), all-day, CRLF', () => {
  const r = calculate('2026-07-22', 28, 5, U('2026-08-03'));
  const ics = buildIcs(r, 'en', new Date('2026-08-03T10:00:00Z'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 8);
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20260731'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20260806'));
  assert.ok(ics.includes('\r\n'));
});
