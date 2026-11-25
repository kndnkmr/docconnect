// Patient payment flow (src/utils/paymentFlow.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paymentStage, bookingStage, needsNewSlot, slotStartMs, buildUpiLink, isMobileDevice, cleanUTR, reminderState, supportMessage } from '../src/utils/paymentFlow.js';

const H = 60 * 60 * 1000;

test('every payment state maps to a box with a way forward', () => {
  assert.equal(paymentStage({ status: 'confirmed', paymentStatus: 'pending' }), 'pay');
  assert.equal(paymentStage({ status: 'confirmed' }), 'pay');
  // The bug: claimed without proof used to show only a text line.
  assert.equal(paymentStage({ status: 'confirmed', paymentStatus: 'patient_claimed' }), 'waiting');
  assert.equal(paymentStage({ status: 'confirmed', paymentStatus: 'patient_claimed', paymentScreenshot: 'x' }), 'proof');
  assert.equal(paymentStage({ status: 'completed', paymentStatus: 'patient_claimed', paymentUTR: '123456789012' }), 'proof');
  assert.equal(paymentStage({ status: 'confirmed', paymentStatus: 'paid' }), 'paid');
  assert.equal(paymentStage({ status: 'pending', paymentStatus: 'pending' }), null);
  assert.equal(paymentStage({ status: 'cancelled', paymentStatus: 'patient_claimed' }), null);
});

test('UPI link: payee, amount, INR and a matchable note', () => {
  const link = buildUpiLink({ upiId: 'anjali@okhdfc', doctorName: 'Anjali Mehta', amount: 500, patientId: 'PT000010', date: '2099-01-01T00:00:00Z' });
  assert.ok(link.startsWith('upi://pay?pa=anjali%40okhdfc&'));
  assert.match(link, /am=500\.00/);
  assert.match(link, /cu=INR/);
  assert.match(decodeURIComponent(link), /tn=ProMedicoz PT000010 1 Jan/);
  assert.equal(buildUpiLink({ upiId: 'not a upi id', amount: 500 }), '');
  assert.equal(buildUpiLink({ upiId: '', amount: 500 }), '');
  assert.doesNotMatch(buildUpiLink({ upiId: 'a@ybl', amount: 0 }), /am=/);
});

test('UPI button only on phones', () => {
  assert.ok(isMobileDevice('Mozilla/5.0 (Linux; Android 14) Mobile'));
  assert.ok(isMobileDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'));
  assert.ok(!isMobileDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'));
});

test('UTR: 12 digits, spaces/dashes allowed', () => {
  assert.equal(cleanUTR('4321 0987 6543'), '432109876543');
  assert.equal(cleanUTR('4321-0987-6543'), '432109876543');
  assert.equal(cleanUTR('12345'), '');
  assert.equal(cleanUTR('abcdefghijkl'), '');
});

test('remind doctor: 2h after claiming, then every 6h', () => {
  const now = Date.now();
  assert.equal(reminderState({ paymentStatus: 'pending' }, now).can, false);
  assert.equal(reminderState({ paymentStatus: 'patient_claimed', paymentClaimedAt: new Date(now - H) }, now).can, false);
  assert.equal(reminderState({ paymentStatus: 'patient_claimed', paymentClaimedAt: new Date(now - 3 * H) }, now).can, true);
  assert.equal(reminderState({ paymentStatus: 'patient_claimed', paymentClaimedAt: new Date(now - 9 * H), paymentReminderSentAt: new Date(now - H) }, now).can, false);
  assert.equal(reminderState({ paymentStatus: 'patient_claimed', paymentClaimedAt: new Date(now - 9 * H), paymentReminderSentAt: new Date(now - 7 * H) }, now).can, true);
  // Old claims (before this feature) have no claim time: allowed right away.
  assert.equal(reminderState({ paymentStatus: 'patient_claimed' }, now).can, true);
});

test('support message carries what support needs', () => {
  const m = supportMessage({ patientName: 'Bharti', patientId: 'PT000010', doctorName: 'Anjali', date: '2099-01-01T00:00:00Z', timeSlot: '10:30 AM - 11:00 AM' });
  assert.match(m, /Bharti \(PT000010\)/);
  assert.match(m, /Dr\. Anjali/);
  assert.match(m, /10:30 AM/);
});

test('booked time passed: patient is asked to pick a new time on the same booking', () => {
  const now = Date.parse('2026-11-22T10:00:00Z'); // 3:30 PM IST on 22 Nov
  const apt = (extra) => ({ status: 'pending', paymentStatus: 'pending', date: '2026-11-22T00:00:00.000Z', timeSlot: '10:00 AM - 10:30 AM', ...extra });
  // 10:00 AM IST = 04:30 UTC
  assert.equal(slotStartMs(apt()), Date.parse('2026-11-22T04:30:00Z'));
  assert.equal(slotStartMs({ date: '2026-11-22T00:00:00.000Z', timeSlot: '12:00 AM - 12:30 AM' }), Date.parse('2026-11-21T18:30:00Z'));
  assert.equal(slotStartMs({ date: '2026-11-22T00:00:00.000Z', timeSlot: '6:00 PM - 6:30 PM' }), Date.parse('2026-11-22T12:30:00Z'));
  assert.equal(slotStartMs({ date: 'x', timeSlot: 'nonsense' }), null);
  // Never confirmed and the time passed
  assert.equal(needsNewSlot(apt(), now), true);
  assert.equal(needsNewSlot(apt({ date: '2026-11-23T00:00:00.000Z' }), now), false, 'future slot');
  // Doctor confirmed late
  assert.equal(needsNewSlot(apt({ status: 'confirmed', confirmedLate: true }), now), true);
  assert.equal(needsNewSlot(apt({ status: 'confirmed', confirmedLate: false }), now), false, 'normal confirmed booking');
  // Once they started paying, or it is paid / done, never prompt
  assert.equal(needsNewSlot(apt({ status: 'confirmed', confirmedLate: true, paymentStatus: 'patient_claimed' }), now), false);
  assert.equal(needsNewSlot(apt({ status: 'confirmed', confirmedLate: true, paymentStatus: 'paid' }), now), false);
  assert.equal(needsNewSlot(apt({ status: 'completed' }), now), false);
  assert.equal(needsNewSlot(apt({ status: 'cancelled' }), now), false);
  assert.equal(needsNewSlot(null), false);
});
test('late-confirmed booking shows pickSlot (not Pay); pay returns after the new time is chosen', () => {
  const late = { status: 'confirmed', paymentStatus: 'pending', confirmedLate: true, date: '2026-11-20T00:00:00.000Z', timeSlot: '10:00 AM - 10:30 AM', doctor: { consultationFee: 300 } };
  assert.equal(paymentStage(late), null, 'must not offer payment for a past slot');
  assert.equal(bookingStage(late), 'pickSlot');
  // After reschedule the server clears the flag and keeps it confirmed
  const after = { ...late, confirmedLate: false, date: '2099-01-01T00:00:00.000Z' };
  assert.equal(paymentStage(after), 'pay');
  assert.equal(bookingStage(after), 'pay');
});
