// Old unclosed appointments: which ones get expired / completed / closed. No database.
const { test } = require('node:test');
const assert = require('node:assert');
const { oldAction } = require('../utils/oldAppointments');
const DAY = 864e5;
const now = Date.now();
const on = (daysAgo) => new Date(`${new Date(now - daysAgo * DAY).toISOString().slice(0, 10)}T00:00:00Z`);
const apt = (daysAgo, extra = {}) => ({ status: 'pending', paymentStatus: 'pending', date: on(daysAgo), timeSlot: '10:00 AM - 10:30 AM', ...extra });
test('pending request: expires 3+ days after its time, not before', () => {
  assert.strictEqual(oldAction(apt(5), now), 'expire-pending');
  assert.strictEqual(oldAction(apt(1), now), null, 'the patient still has time to pick a new slot');
  assert.strictEqual(oldAction(apt(-2), now), null, 'future');
});
test('confirmed visit: left alone for 14 days (the "Did they come?" check handles it)', () => {
  assert.strictEqual(oldAction(apt(10, { status: 'confirmed', paymentStatus: 'paid' }), now), null);
});
test('confirmed and old: paid / free / follow-up / call held count as happened', () => {
  const base = { status: 'confirmed' };
  assert.strictEqual(oldAction(apt(30, { ...base, paymentStatus: 'paid' }), now, { fee: 300 }), 'complete');
  assert.strictEqual(oldAction(apt(30, { ...base, isFollowUp: true }), now, { fee: 300 }), 'complete');
  assert.strictEqual(oldAction(apt(30, base), now, { fee: 0 }), 'complete', 'free consultation');
  assert.strictEqual(oldAction(apt(30, base), now, { fee: 300, callHeld: true }), 'complete');
});
test('confirmed, old, unpaid, no call: closed as probably not happened', () => {
  assert.strictEqual(oldAction(apt(30, { status: 'confirmed' }), now, { fee: 300 }), 'close-unpaid');
});
test('completed, cancelled and unreadable slots are never touched', () => {
  assert.strictEqual(oldAction(apt(30, { status: 'completed' }), now), null);
  assert.strictEqual(oldAction(apt(30, { status: 'cancelled' }), now), null);
  assert.strictEqual(oldAction({ ...apt(30), timeSlot: 'whenever' }, now), null);
  assert.strictEqual(oldAction(null, now), null);
});
