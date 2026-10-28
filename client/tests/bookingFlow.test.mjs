// Live booking page: after booking, the patient always sees the next step —
// and the PAY step appears on the same page as soon as the doctor confirms.
// (src/utils/paymentFlow.js bookingStage + src/pages/BookingConfirmation.jsx)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bookingStage, BOOKING_STEP } from '../src/utils/paymentFlow.js';

const doc = { consultationFee: 300 };
const apt = (x) => ({ status: 'pending', paymentStatus: 'pending', doctor: doc, ...x });

test('each booking state maps to one clear next step', () => {
  assert.equal(bookingStage(apt({})), 'confirming');
  assert.equal(bookingStage(apt({ status: 'confirmed' })), 'pay');
  assert.equal(bookingStage(apt({ status: 'confirmed', paymentStatus: 'patient_claimed' })), 'checking');
  assert.equal(bookingStage(apt({ status: 'confirmed', paymentStatus: 'patient_claimed', paymentScreenshot: 'x.jpg' })), 'checking');
  assert.equal(bookingStage(apt({ status: 'confirmed', paymentStatus: 'paid' })), 'ready');
  assert.equal(bookingStage(apt({ status: 'completed', paymentStatus: 'paid' })), 'done');
  assert.equal(bookingStage(apt({ status: 'cancelled' })), 'cancelled');
  assert.equal(bookingStage(null), null);
});

test('free consultation: confirmed means ready (no pay step)', () => {
  assert.equal(bookingStage(apt({ status: 'confirmed', doctor: { consultationFee: 0 } })), 'ready');
});

test('steps move forward in order', () => {
  const order = ['confirming', 'pay', 'checking', 'ready'].map((s) => BOOKING_STEP[s]);
  assert.deepEqual(order, [0, 1, 2, 3]);
});

test('page shows the payment box when confirmed, stays live, and the booking passes its id', () => {
  const page = fs.readFileSync(new URL('../src/pages/BookingConfirmation.jsx', import.meta.url), 'utf8');
  assert.match(page, /<PaymentBox /);
  assert.match(page, /s === 'pay' \|\| s === 'checking'/);
  assert.match(page, /socket\.on\('appointment-updated'/);
  assert.match(page, /appointmentAPI\.getById\(id\)/);
  assert.doesNotMatch(page, /Your booking is confirmed\. Waiting for doctor/, 'no self-contradicting "confirmed / waiting" line');
  const book = fs.readFileSync(new URL('../src/pages/BookAppointment.jsx', import.meta.url), 'utf8');
  assert.match(book, /\/booking-confirmation\?id=\$\{newId\}/);
});

test('doctor-confirmed alert + email open the booking at the Pay step', () => {
  const ctl = fs.readFileSync(new URL('../../server/controllers/appointmentController.js', import.meta.url), 'utf8');
  assert.match(ctl, /url: `\/booking-confirmation\?id=\$\{appointment\._id\}`/);
  const mail = fs.readFileSync(new URL('../../server/utils/sendEmail.js', import.meta.url), 'utf8');
  assert.match(mail, /booking-confirmation\?id=\$\{appointment\._id\}/);
});
