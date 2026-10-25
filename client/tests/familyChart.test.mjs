// Family medicine view (src/utils/familyChart.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personOf, peopleOf, personEmoji, hasFamilyPrescriptions, buildFamilyDay, buildFamilyIcs, familyDayText, isEmptyDay } from '../src/utils/familyChart.js';
import { iso } from './helpers.mjs';

const TODAY = Date.UTC(2026, 7, 6); // Thu 6 Aug 2026
const appt = (bookedFor, familyMemberName = '', extra = {}) => ({ bookedFor, familyMemberName, ...extra });

const MUMMY = {
  _id: 'm1', createdAt: '2026-08-06T05:00:00Z', doctor: { name: 'Mehta' },
  appointment: appt('family', 'Mummy', { followUpDeadline: '2026-08-21T06:00:00Z' }),
  testsRecommended: ['CBC'],
  medicines: [
    { name: 'Tab Telma 40', frequency: '1-0-0', duration: 'Continue', instructions: '' },
    { name: 'Tab Glycomet 500', frequency: '1-0-1', duration: 'Continue', instructions: 'After food' },
  ],
};
const PAPA = {
  _id: 'p1', createdAt: '2026-08-02T05:00:00Z', doctor: { name: 'Sharma' },
  appointment: appt('family', 'Papa'),
  medicines: [
    { name: 'Tab Zerodol-P', frequency: '1-0-1', duration: '5 days', instructions: 'After food' },
    { name: 'Calcium + D3', frequency: '0-0-1', duration: '30 days', instructions: '' },
  ],
};
const ME_OLD = {
  _id: 's1', createdAt: '2026-07-20T05:00:00Z', doctor: { name: 'Mehta' }, appointment: appt('self'),
  medicines: [{ name: 'Tab Allegra 120', frequency: 'OD', duration: '5 days', instructions: '' }],
};
const FAMILY = [
  { name: 'Mummy', relationship: 'parent', gender: 'female' },
  { name: 'Papa', relationship: 'parent', gender: 'male' },
  { name: 'Riya', relationship: 'child', gender: 'female' },
];

test('who a prescription is for', () => {
  assert.equal(personOf(MUMMY), 'Mummy');
  assert.equal(personOf(ME_OLD), 'self');
  assert.equal(personOf({ appointment: appt('family', '  ') }), 'self'); // blank name -> self
  assert.equal(personOf({}), 'self');
  assert.equal(hasFamilyPrescriptions([ME_OLD]), false);
  assert.equal(hasFamilyPrescriptions([ME_OLD, PAPA]), true);
});

test('people order: self first; names matched case-insensitively', () => {
  const people = peopleOf([MUMMY, PAPA, ME_OLD, { ...PAPA, appointment: appt('family', 'papa ') }]);
  assert.deepEqual(people.map((p) => p.key), ['self', 'mummy', 'papa']);
});

test('emoji from the saved family member', () => {
  assert.equal(personEmoji('Mummy', FAMILY), '👵');
  assert.equal(personEmoji('papa', FAMILY), '👴');
  assert.equal(personEmoji('Riya', FAMILY), '🧒');
  assert.equal(personEmoji('Unknown', FAMILY), '👤');
  assert.equal(personEmoji('self', FAMILY), '🙂');
});

test("today's family view, grouped by time and person", () => {
  const day = buildFamilyDay([MUMMY, PAPA, ME_OLD], TODAY);
  const p = Object.fromEntries(day.people.map((x) => [x.key, x]));
  assert.deepEqual(p.mummy.slots.morning.map((i) => i.name), ['Tab Telma 40', 'Tab Glycomet 500']);
  assert.deepEqual(p.mummy.slots.night.map((i) => i.name), ['Tab Glycomet 500']);
  assert.deepEqual(p.papa.slots.morning.map((i) => i.name), ['Tab Zerodol-P']);
  assert.deepEqual(p.papa.slots.night.map((i) => i.name), ['Tab Zerodol-P', 'Calcium + D3']);
  // my Allegra course (20–24 Jul) is finished, so nothing for me today
  assert.equal(p.self.once.length, 0);
  assert.equal(isEmptyDay(day), false);
});

test('coming up: last course day, free follow-up, advised tests', () => {
  const day = buildFamilyDay([MUMMY, PAPA, ME_OLD], TODAY);
  const ends = day.comingUp.find((c) => c.kind === 'ends' && c.name === 'Tab Zerodol-P');
  assert.equal(iso(ends.date), '2026-08-06');
  assert.equal(ends.today, true);
  const fu = day.comingUp.find((c) => c.kind === 'followUp');
  assert.equal(fu.person, 'Mummy');
  assert.equal(iso(fu.date), '2026-08-21');
  assert.deepEqual(day.comingUp.find((c) => c.kind === 'tests').tests, ['CBC']);
  assert.equal(day.comingUp.some((c) => c.name === 'Calcium + D3'), false); // ends 31 Aug, not within 3 days
});

test('SAFETY: an old "Continue" medicine (> 90 days) is not shown as today’s', () => {
  const old = { ...MUMMY, _id: 'm0', createdAt: '2026-03-01T05:00:00Z' };
  const day = buildFamilyDay([old], TODAY);
  assert.equal(isEmptyDay(day), true);
  const ics = buildFamilyIcs(day, { morning: '08:00', afternoon: '14:00', evening: '18:00', night: '21:00' }, LABELS, TODAY);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 0);
});

test('SAFETY: the same medicine from two doctors stays as two entries, each with its doctor', () => {
  const second = { ...MUMMY, _id: 'm2', doctor: { name: 'Gupta' }, medicines: [{ name: 'Tab Telma 40', frequency: '1-0-0', duration: '30 days', instructions: '' }] };
  const day = buildFamilyDay([MUMMY, second], TODAY);
  const mummy = day.people.find((p) => p.key === 'mummy');
  assert.equal(mummy.multi, true);
  const telma = mummy.slots.morning.filter((i) => i.name === 'Tab Telma 40');
  assert.deepEqual(telma.map((i) => i.doctor), ['Mehta', 'Gupta']);
  assert.ok(familyDayText(day, LABELS, iso).includes('Tab Telma 40 — Dr. Gupta'));
});

test('weekly medicine only on its weekday', () => {
  const weekly = { ...PAPA, _id: 'w1', createdAt: '2026-08-06T05:00:00Z', medicines: [{ name: 'Vit D3 60K', frequency: 'once a week', duration: '8 weeks' }] };
  assert.equal(buildFamilyDay([weekly], TODAY).people[0].weekly.length, 1); // Thursday
  assert.equal(buildFamilyDay([weekly], TODAY + 86400000).people[0].weekly.length, 0); // Friday
});

const LABELS = {
  self: 'You', slot: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' },
  slotIcon: { morning: 'M', afternoon: 'A', evening: 'E', night: 'N' },
  food: { before: 'before food', after: 'after food', empty: 'empty stomach' },
  reminder: (s) => `Medicines: ${s}`, weeklyName: 'Once a week', onceName: 'Once a day', sosName: 'When needed',
  shareTitle: (d) => `Family medicines ${d}`, shareFooter: 'Follow the doctor.',
};

test('one calendar file for everyone, titled with the person, unique IDs', () => {
  const day = buildFamilyDay([MUMMY, PAPA], TODAY);
  const ics = buildFamilyIcs(day, { morning: '08:00', afternoon: '14:00', evening: '18:00', night: '21:00' }, LABELS, TODAY, new Date('2026-08-06T06:00:00Z'));
  assert.equal(ics.split('BEGIN:VCALENDAR').length - 1, 1);
  assert.ok(ics.includes('SUMMARY:Medicines: Mummy · Morning'));
  assert.ok(ics.includes('SUMMARY:Medicines: Papa · Night'));
  const uids = ics.match(/UID:[^\r]+/g);
  assert.equal(new Set(uids).size, uids.length);
  // Papa's 5-day course ends today: its reminder must not run past today
  const papaEvents = ics.split('BEGIN:VEVENT').filter((e) => e.includes('Zerodol'));
  assert.ok(papaEvents.every((e) => e.includes('UNTIL=20260806T235959')));
});
