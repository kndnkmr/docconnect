// Admin "Needs help" helpers (src/utils/needsHelp.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, waLink, ago, messageFor } from '../src/utils/needsHelp.js';

test('groups match the server keys, in urgency order', () => {
  assert.deepEqual(GROUPS.map((g) => g.key), ['paymentDisputed', 'notConfirmed', 'paymentWaiting', 'unpaidSoon', 'unpaidWaiting', 'slotPassedOpen', 'paidCancelled', 'noPhone']);
});

test('WhatsApp links: digits only, India code added, junk refused', () => {
  assert.equal(waLink('+91 98765 43210'), 'https://wa.me/919876543210');
  assert.equal(waLink('9876543210', 'Hi'), 'https://wa.me/919876543210?text=Hi');
  assert.equal(waLink(''), '');
  assert.equal(waLink('123'), '');
});

test('ago labels', () => {
  const now = Date.now();
  assert.equal(ago(new Date(now - 45 * 60000), now), '45 min');
  assert.equal(ago(new Date(now - 26 * 3600000), now), '26h');
  assert.equal(ago(new Date(now - 72 * 3600000), now), '3d');
});

test('messages name the people, slot and UTR', () => {
  const apt = { patient: { name: 'Bharti' }, doctor: { name: 'Anjali' }, date: '2099-01-01T00:00:00Z', timeSlot: '10:30 AM - 11:00 AM', paymentUTR: '432109876543' };
  assert.match(messageFor('notConfirmed', apt, 'doctor'), /Dr\. Anjali.*Bharti.*1 Jan.*10:30 AM.*confirm/);
  assert.match(messageFor('paymentWaiting', apt, 'doctor'), /432109876543/);
  assert.match(messageFor('unpaidSoon', apt, 'patient'), /Hello Bharti.*payment/);
});

test('disputed payment: WhatsApp texts for the doctor and the patient mention the UTR and ask for proof', () => {
  const apt = { patient: { name: 'Usha' }, doctor: { name: 'Pooja' }, date: '2026-11-25T00:00:00Z', timeSlot: '12:30 PM - 1:00 PM', paymentUTR: '412345678901' };
  assert.match(messageFor('paymentDisputed', apt, 'doctor'), /not received.*412345678901/);
  assert.match(messageFor('paymentDisputed', apt, 'patient'), /could not find your payment.*UTR/);
});

test('waiting for payment: the WhatsApp text asks the patient to pay from the dashboard', () => {
  const apt = { patient: { name: 'Usha' }, doctor: { name: 'Pooja' }, date: '2026-11-25T00:00:00Z', timeSlot: '12:30 PM - 1:00 PM' };
  assert.match(messageFor('unpaidWaiting', apt, 'patient'), /confirmed your appointment.*complete the payment/);
});
