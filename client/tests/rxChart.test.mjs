// Patient's daily medicine chart (src/utils/rxChart.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrequency, parseDuration, parseFood, buildChart, buildIcs, chartText, istDay } from '../src/utils/rxChart.js';
import { iso } from './helpers.mjs';

const slots = (s) => {
  const r = parseFrequency(s);
  if (!r) return null;
  return r.kind === 'daily' ? r.slots.join('+') : r.kind + (r.perDay || '');
};

test('1-0-1 style patterns', () => {
  assert.equal(slots('1-0-1'), 'morning+night');
  assert.equal(slots('1-1-1'), 'morning+afternoon+night');
  assert.equal(slots('0-0-1'), 'night');
  assert.equal(slots('1 - 0 - 0'), 'morning');
  assert.equal(slots('½-0-½'), 'morning+night');
  assert.deepEqual(parseFrequency('1/2-0-1/2').counts, { morning: 0.5, night: 0.5 });
  assert.deepEqual(parseFrequency('2-0-2').counts, { morning: 2, night: 2 });
  assert.equal(slots('1-0-0-1'), 'morning+night');
  assert.equal(slots('1-1-1-1'), 'morning+afternoon+evening+night');
  assert.equal(slots('0-0-0'), null);
});

test('abbreviations and words', () => {
  assert.equal(slots('BD'), 'morning+night');
  assert.equal(slots('Twice daily'), 'morning+night');
  assert.equal(slots('TDS'), 'morning+afternoon+night');
  assert.equal(slots('Thrice daily'), 'morning+afternoon+night');
  assert.equal(slots('HS'), 'night');
  assert.equal(slots('at bedtime'), 'night');
  assert.equal(slots('morning and night'), 'morning+night');
  assert.equal(slots('SOS'), 'sos');
  assert.equal(slots('as needed for pain'), 'sos');
  assert.equal(slots('once a week'), 'weekly');
  assert.equal(slots('QID'), 'times4');
});

test('once a day: the time is NOT guessed unless stated', () => {
  assert.equal(slots('OD'), 'once');
  assert.equal(slots('Once daily'), 'once');
  assert.equal(slots('daily'), 'once');
  assert.equal(slots('once a day at night'), 'night');
  assert.equal(slots('OD after breakfast'), 'morning');
});

test('things that are not frequencies', () => {
  assert.equal(slots('after food'), null); // "od" inside "food" must not match
  assert.equal(slots('till 12-08-2026'), null);
  assert.equal(slots('500 mg'), null);
  assert.equal(slots(''), null);
  assert.equal(slots('as discussed'), null);
});

test('durations', () => {
  assert.equal(parseDuration('5 days'), 5);
  assert.equal(parseDuration('1 week'), 7);
  assert.equal(parseDuration('2 wks'), 14);
  assert.equal(parseDuration('1 month'), 30);
  assert.equal(parseDuration('x 5 days'), 5);
  assert.equal(parseDuration('10d'), 10);
  assert.equal(parseDuration('8 weeks'), 56);
  assert.equal(parseDuration('Continue'), Infinity);
  assert.equal(parseDuration(''), null);
});

test('food timing', () => {
  assert.equal(parseFood('after food'), 'after');
  assert.equal(parseFood('before breakfast'), 'before');
  assert.equal(parseFood('', 'empty stomach'), 'empty');
  assert.equal(parseFood('PC'), 'after');
  assert.equal(parseFood('BD'), null);
});

test('India-time day boundaries', () => {
  assert.equal(iso(istDay('2026-08-06T18:00:00Z')), '2026-08-06'); // 11:30 PM IST
  assert.equal(iso(istDay('2026-08-06T19:00:00Z')), '2026-08-07'); // 12:30 AM IST
});

const RX = {
  createdAt: '2026-08-06T05:00:00Z',
  appointment: { followUpDeadline: '2026-08-21T06:00:00Z' },
  medicines: [
    { name: 'Tab Pan 40', frequency: '1-0-0', duration: '5 days', instructions: 'before breakfast' },
    { name: 'Tab Augmentin 625', frequency: 'BD', duration: '5 days', instructions: 'after food' },
    { name: 'Syp Ascoril', frequency: '1-1-1', duration: '7 days', instructions: '' },
    { name: 'Tab Paracetamol 650', frequency: 'SOS', duration: '', instructions: 'if fever above 100' },
    { name: 'Vitamin D3 60K', frequency: 'once a week', duration: '8 weeks', instructions: '' },
    { name: 'Cream XYZ', frequency: 'as discussed', duration: '', instructions: '' },
  ],
};
const DAY6 = Date.UTC(2026, 7, 6);
const DAY11 = Date.UTC(2026, 7, 11);
const LABELS = {
  slot: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' },
  slotIcon: { morning: 'M', afternoon: 'A', evening: 'E', night: 'N' },
  food: { before: 'before food', after: 'after food', empty: 'empty stomach' },
  reminder: (s) => `Medicines: ${s}`,
  weeklyName: 'Once a week', onceName: 'Once a day', timesName: '4 times', sosName: 'When needed', checkName: 'Check',
  till: (d) => `till ${d}`, ongoing: 'continue', shareTitle: (d) => `Chart (Dr. ${d})`, shareFooter: 'Follow your doctor.',
};
const TIMES = { morning: '08:00', afternoon: '14:00', evening: '18:00', night: '21:00' };
const names = (c, g) => c.groups[g].map((i) => i.name);

test('chart groups', () => {
  const c = buildChart(RX, DAY6);
  assert.deepEqual(names(c, 'morning'), ['Tab Pan 40', 'Tab Augmentin 625', 'Syp Ascoril']);
  assert.deepEqual(names(c, 'afternoon'), ['Syp Ascoril']);
  assert.deepEqual(names(c, 'night'), ['Tab Augmentin 625', 'Syp Ascoril']);
  assert.deepEqual(names(c, 'sos'), ['Tab Paracetamol 650']);
  assert.deepEqual(names(c, 'weekly'), ['Vitamin D3 60K']);
  assert.deepEqual(names(c, 'check'), ['Cream XYZ']); // unreadable -> ask the doctor
});

test('course end dates, day numbers, follow-up', () => {
  const c = buildChart(RX, DAY6);
  assert.equal(iso(c.items[0].lastDay), '2026-08-10');
  assert.equal(iso(c.items[2].lastDay), '2026-08-12');
  assert.equal(iso(c.items[4].lastDay), '2026-09-24'); // 8 weekly doses
  assert.equal(c.items[0].dayNo, 1);
  assert.equal(c.items[0].food, 'before');
  assert.equal(c.items[1].food, 'after');
  assert.equal(iso(c.followUpUntil), '2026-08-21');
  assert.equal(c.weekday, 4); // Thursday
  const later = buildChart(RX, DAY11);
  assert.equal(later.items[0].finished, true);
  assert.equal(later.items[2].dayNo, 6);
  assert.equal(later.items[2].finished, false);
});

test("the doctor's exact words are always kept", () => {
  assert.equal(buildChart(RX, DAY6).items[5].original, 'Cream XYZ — as discussed');
});

test('shorthand typed into the name field is still read', () => {
  const c = buildChart({ createdAt: RX.createdAt, medicines: [{ name: 'Tab Pan 40 1-0-0 5 days', frequency: '', duration: '' }] }, DAY6);
  assert.equal(c.groups.morning.length, 1);
});

test('reminders: one event per slot AND end date', () => {
  const ics = buildIcs(buildChart(RX, DAY6), TIMES, LABELS, DAY6, new Date('2026-08-06T06:00:00Z'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 6);
  assert.ok(ics.includes('DTSTART:20260806T080000'));
  assert.ok(ics.includes('DTSTART:20260806T210000'));
  assert.ok(ics.includes('RRULE:FREQ=WEEKLY;UNTIL=20260924T235959'));
  assert.ok(ics.includes('\r\n'));
});

test('SAFETY: a reminder never lists a medicine after its course ends', () => {
  const ics = buildIcs(buildChart(RX, DAY6), TIMES, LABELS, DAY6, new Date('2026-08-06T06:00:00Z'));
  const events = ics.split('BEGIN:VEVENT').slice(1);
  const find = (until, time) => events.find((e) => e.includes(`UNTIL=${until}`) && e.includes(`T${time}00\r`));
  const m10 = find('20260810T235959', '0800');
  const m12 = find('20260812T235959', '0800');
  assert.ok(m10.includes('Tab Pan 40') && !m10.includes('Ascoril'));
  assert.ok(m12.includes('Syp Ascoril') && !m12.includes('Pan 40') && !m12.includes('Augmentin'));
  const n10 = find('20260810T235959', '2100');
  assert.ok(n10.includes('Augmentin') && !n10.includes('Ascoril'));
  const later = buildIcs(buildChart(RX, DAY11), TIMES, LABELS, DAY11);
  assert.ok(!later.includes('Pan 40'));
  assert.ok(later.includes('Syp Ascoril'));
  assert.ok(later.includes('DTSTART:20260811T080000')); // starts today, not in the past
  assert.ok(later.includes('DTSTART:20260813T080000')); // next weekly dose (Thursday)
});

test('family share text', () => {
  const txt = chartText(buildChart(RX, DAY6), 'Mehta', LABELS, iso);
  assert.ok(txt.includes('• Cream XYZ — as discussed'));
  assert.ok(txt.includes('Tab Pan 40 × 1 (before food)'));
});
