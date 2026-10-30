// Booking page: day tiles, time groups, problem chips, missing step
// (src/utils/bookingUi.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayTiles, groupSlots, slotStart, slotStartMin, symptomsFor, missingStep, istDate } from '../src/utils/bookingUi.js';

// Fri 30 Oct 2026, 10:00 IST
const NOW = Date.parse('2026-10-30T04:30:00Z');
const AV = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => ({ day, startTime: '12:00', endTime: '20:00' }));

test('day tiles: 14 IST days, Today/Tomorrow, Sunday off, leave off', () => {
  const t = dayTiles({ availability: AV, blockedDates: [{ date: '2026-11-03' }], now: NOW });
  assert.equal(t.length, 14);
  assert.deepEqual([t[0].date, t[0].rel, t[0].off], ['2026-10-30', 'today', false]);
  assert.deepEqual([t[1].date, t[1].rel], ['2026-10-31', 'tomorrow']);
  assert.equal(t[2].date, '2026-11-01'); assert.equal(t[2].off, true, 'Sunday not worked');
  assert.equal(t.find((x) => x.date === '2026-11-03').off, true, 'leave day');
  assert.equal(t.find((x) => x.date === '2026-11-02').off, false);
});

test('today counts as off once its hours are over', () => {
  const late = Date.parse('2026-10-30T15:00:00Z'); // 8:30 PM IST
  assert.equal(dayTiles({ availability: AV, now: late })[0].off, true);
  assert.equal(istDate(late), '2026-10-30');
});

test('times: start label and grouping', () => {
  assert.equal(slotStart('09:15 AM - 09:30 AM'), '9:15 AM');
  assert.equal(slotStartMin('12:00 PM - 12:15 PM'), 720);
  assert.equal(slotStartMin('12:15 AM - 12:30 AM'), 15);
  const g = groupSlots(['09:00 AM - 09:15 AM', '12:00 PM - 12:15 PM', '05:30 PM - 05:45 PM', '09:30 PM - 09:45 PM']);
  assert.deepEqual(g.map((x) => [x.key, x.items.length]), [['morning', 1], ['afternoon', 1], ['evening', 1], ['night', 1]]);
  assert.deepEqual(groupSlots([]), []);
});

test('problem chips follow the specialty; stored value is English', () => {
  assert.ok(symptomsFor('Obstetrician and Gynaecologist').some((s) => s.en === 'PCOD/PCOS'));
  assert.ok(symptomsFor('Gyanecologist').some((s) => s.en === 'Irregular periods'));
  assert.ok(symptomsFor('Pediatrician neonatologist').some((s) => s.en === 'Vaccination'));
  assert.ok(symptomsFor('Neurologist').some((s) => s.en === 'Headache/Migraine'));
  assert.ok(symptomsFor('General Physician').some((s) => s.en === 'Fever'));
  for (const s of symptomsFor('Gynaecologist')) assert.match(s.en, /^[\x20-\x7E]+$/, 'English value');
});

test('missing step is reported in page order', () => {
  const ok = { date: '2026-10-30', timeSlot: 'x', reason: 'pain', consent: true, bookedFor: 'self' };
  assert.equal(missingStep(ok), null);
  assert.equal(missingStep({ ...ok, timeSlot: '' }), 'time');
  assert.equal(missingStep({ ...ok, bookedFor: 'family', familyMemberName: '' }), 'who');
  assert.equal(missingStep({ ...ok, reason: '  ' }), 'reason');
  assert.equal(missingStep({ ...ok, consent: false }), 'consent');
});
