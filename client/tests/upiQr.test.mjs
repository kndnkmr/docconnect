// Reading the UPI ID out of a doctor's QR code text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUpiUri, isValidUpiId, sameUpi, classifyQrText } from '../src/utils/upiQr.js';

test('reads UPI ID + name from the formats the big apps use', () => {
  // Shapes copied from real GPay / PhonePe / Paytm / bank QRs (IDs made up).
  assert.deepEqual(parseUpiUri('upi://pay?pa=drtest@okicici&pn=Test%20Singh&aid=uGICAgICN9768DA'), { upiId: 'drtest@okicici', name: 'Test Singh' });
  assert.deepEqual(parseUpiUri('upi://pay?pa=9800000000@ybl&pn=TEST%20%20DUTT&mc=0000&mode=02&purpose=00'), { upiId: '9800000000@ybl', name: 'TEST DUTT' });
  assert.deepEqual(parseUpiUri('upi://pay?ver=01&mode=01&purpose=00&mc=0000&qrMedium=02&pa=9100000000@hdfc&pn=AKSHAY TEST'), { upiId: '9100000000@hdfc', name: 'AKSHAY TEST' });
  assert.deepEqual(parseUpiUri('UPI://PAY?PA=paytm.s1@pthdfc&PN=Clinic+Name'), { upiId: 'paytm.s1@pthdfc', name: 'Clinic Name' });
  assert.equal(parseUpiUri('upi://pay?pa=xy@ybl').name, '', 'name is optional');
});

test('anything that is not a UPI payment QR is rejected', () => {
  assert.equal(parseUpiUri('https://www.promedicoz.in/dr/test'), null);
  assert.equal(parseUpiUri('upi://pay?pn=No%20ID'), null);
  assert.equal(parseUpiUri('upi://pay?pa=not-an-id&pn=X'), null);
  assert.equal(parseUpiUri(''), null);
  assert.deepEqual(classifyQrText(null), { kind: 'none' });
  assert.deepEqual(classifyQrText('WIFI:S:clinic;T:WPA;P:secret;;'), { kind: 'other' });
  assert.equal(classifyQrText('upi://pay?pa=a1@oksbi').kind, 'upi');
});

test('UPI ID format + case-insensitive compare', () => {
  for (const ok of ['drname@okicici', '9876543210@ybl', 'a.b-c_d@paytm']) assert.ok(isValidUpiId(ok), ok);
  for (const bad of ['', 'drname', '@ybl', 'dr name@ybl', 'x@1bank', 'https://x.com']) assert.equal(isValidUpiId(bad), false, bad);
  assert.ok(sameUpi(' DrName@OKICICI ', 'drname@okicici'));
  assert.equal(sameUpi('a@ybl', 'a@axl'), false);
});
