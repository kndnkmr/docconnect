// Baby vaccination schedule (src/pages/tools/vaccines.js)
// The schedule follows India's government UIP; these tests pin it so an
// accidental edit to a date or vaccine is caught before deploy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, visitStatuses, addMonths, buildIcs, SCHEDULE, COPY } from '../src/pages/tools/vaccines.js';
import { U, iso } from './helpers.mjs';

const T = U('2026-08-06');
const dateOf = (r, key) => iso(r.visits.find((x) => x.key === key).date);

test('visit dates from date of birth', () => {
  const r = calculate('2026-05-10', T);
  assert.equal(dateOf(r, 'birth'), '2026-05-10');
  assert.equal(dateOf(r, '6w'), '2026-06-21');
  assert.equal(dateOf(r, '10w'), '2026-07-19');
  assert.equal(dateOf(r, '14w'), '2026-08-16');
  assert.equal(dateOf(r, '9m'), '2027-02-10');
  assert.equal(dateOf(r, '16m'), '2027-09-10');
  assert.equal(dateOf(r, '5y'), '2031-05-10');
  assert.equal(dateOf(r, '10y'), '2036-05-10');
  assert.equal(dateOf(r, '16y'), '2042-05-10');
});

test('the government schedule (UIP) is unchanged', () => {
  const byKey = Object.fromEntries(SCHEDULE.map((s) => [s.key, s.vaccines.map((v) => v.id)]));
  assert.deepEqual(byKey, {
    birth: ['bcg', 'opv0', 'hepb0'],
    '6w': ['opv1', 'penta1', 'rvv1', 'fipv1', 'pcv1'],
    '10w': ['opv2', 'penta2', 'rvv2'],
    '14w': ['opv3', 'penta3', 'fipv2', 'rvv3', 'pcv2'],
    '9m': ['mr1', 'pcvb', 'fipv3', 'vita1', 'je1'],
    '16m': ['mr2', 'dptb1', 'opvb', 'vita2', 'je2'],
    '5y': ['dptb2'],
    '10y': ['td10'],
    '16y': ['td16'],
  });
  const optional = SCHEDULE.flatMap((s) => s.vaccines.filter((v) => v.optional).map((v) => v.id));
  assert.deepEqual(optional, ['je1', 'je2']); // JE: some districts only
});

test('vaccine ids are unique', () => {
  const all = SCHEDULE.flatMap((s) => s.vaccines.map((v) => v.id));
  assert.equal(new Set(all).size, all.length);
});

test('age text', () => {
  assert.deepEqual(calculate('2026-05-10', T).age, { kind: 'weeks', w: 12, d: 4 });
  assert.equal(COPY.en.age(calculate('2026-05-10', T).age), 'Baby is 12 weeks 4 days old');
  assert.deepEqual(calculate('2025-02-06', T).age, { kind: 'months', m: 18 });
  assert.deepEqual(calculate('2020-01-15', T).age, { kind: 'years', y: 6, m: 6 });
});

test('statuses: done / check / next / later', () => {
  const r = calculate('2026-05-10', T);
  const ticked = new Set(['bcg', 'opv0', 'hepb0', 'opv1', 'penta1', 'rvv1', 'fipv1', 'pcv1']);
  assert.deepEqual(visitStatuses(r.visits, ticked, T), ['done', 'done', 'check', 'next', 'later', 'later', 'later', 'later', 'later']);
});

test('district-only JE does not block "done"', () => {
  const r = calculate('2025-08-01', T);
  assert.equal(visitStatuses(r.visits, new Set(['mr1', 'pcvb', 'fipv3', 'vita1']), T)[4], 'done');
});

test('"now" inside a recommended window', () => {
  const r = calculate('2025-02-06', T); // 18 months
  const s = visitStatuses(r.visits, new Set(), T);
  assert.equal(s[5], 'now');
  assert.equal(s[6], 'next');
});

test('born today: birth visit is next', () => {
  assert.equal(visitStatuses(calculate('2026-08-06', T).visits, new Set(), T)[0], 'next');
});

test('month arithmetic clamps the day', () => {
  assert.equal(iso(addMonths(U('2025-08-31'), 6)), '2026-02-28');
  assert.equal(iso(addMonths(U('2027-08-31'), 6)), '2028-02-29');
});

test('errors', () => {
  assert.equal(calculate('2026-08-07', T).error, 'future');
  assert.equal(calculate('2026-13-01', T).error, 'invalid');
  assert.equal(calculate('2009-01-01', T).error, 'tooOld');
  assert.equal(calculate('2010-01-01', T).error, undefined);
});

test('calendar file only has upcoming visits, with escaped commas', () => {
  const r = calculate('2026-05-10', T);
  const ics = buildIcs(r, 'en', T, new Date('2026-08-06T10:00:00Z'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 6);
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20260816'));
  assert.ok(ics.includes('OPV-3\\, Pentavalent-3'));
});
