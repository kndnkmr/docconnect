// Locked-screen alert fixes by phone brand + "their phone didn't ring" logic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPhone, alertFixSteps } from '../src/utils/alertFixSteps.js';
import { otherAlertProblem, slotTimes } from '../src/utils/callAlarm.js';

const UA = {
  redmi: 'Mozilla/5.0 (Linux; Android 13; Redmi Note 12) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36',
  xiaomi: 'Mozilla/5.0 (Linux; Android 14; 23021RAA2Y) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36',
  realme: 'Mozilla/5.0 (Linux; Android 13; RMX3630) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36',
  vivo: 'Mozilla/5.0 (Linux; Android 13; vivo V2250) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36',
  pixel: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/129 Safari/537.36',
};

test('brand detection', () => {
  assert.equal(detectPhone(UA.redmi), 'xiaomi');
  assert.equal(detectPhone(UA.xiaomi), 'xiaomi');
  assert.equal(detectPhone(UA.samsung), 'samsung');
  assert.equal(detectPhone(UA.realme), 'oppo');
  assert.equal(detectPhone(UA.vivo), 'vivo');
  assert.equal(detectPhone(UA.pixel), 'android');
  assert.equal(detectPhone(UA.iphone), 'iphone');
  assert.equal(detectPhone(UA.mac), 'other');
});

test('every brand gets battery + Do Not Disturb + notification steps', () => {
  for (const ua of Object.values(UA)) {
    const r = alertFixSteps(ua);
    assert.ok(r.steps.length >= 2, r.brand);
    if (r.brand !== 'other') assert.ok(r.steps.some((s) => /Do Not Disturb|Focus/.test(s)), r.brand);
  }
  assert.ok(alertFixSteps(UA.redmi).steps.some((s) => /Autostart/.test(s)));
  assert.ok(alertFixSteps(UA.iphone).steps.some((s) => /Home Screen/.test(s)));
});

// A confirmed+paid video appointment; call times from the shared helper.
const apt = (callAlerts, extra = {}) => ({
  status: 'confirmed', paymentStatus: 'paid', consultationType: 'video',
  date: '2099-01-01T00:00:00.000Z', timeSlot: '10:30 AM - 11:00 AM', callAlerts, ...extra,
});
const T = slotTimes('2099-01-01T00:00:00.000Z', '10:30 AM - 11:00 AM');
const S = 1000; const MIN = 60 * S;

test('their phone did not get the ring → shown ~45 s after it was sent', () => {
  const sent = new Date(T.start + 5 * S).toISOString();
  const a = apt({ patient: { sentAt: sent, devices: 1 } });
  assert.equal(otherAlertProblem(a, 'doctor', T.start + 20 * S), null, 'too early');
  assert.equal(otherAlertProblem(a, 'doctor', T.start + 60 * S), 'not-received');
  assert.equal(otherAlertProblem(apt({ patient: { sentAt: sent, seenAt: sent } }), 'doctor', T.start + 60 * S), null, 'received → fine');
  assert.equal(otherAlertProblem(apt({ patient: { sentAt: sent, devices: 0 } }), 'doctor', T.start + 60 * S), 'no-alerts');
  assert.equal(otherAlertProblem({ ...a, callStartedAt: new Date(T.start + 30 * S).toISOString() }, 'doctor', T.start + 60 * S), null, 'already joined');
});

test('before the call: other side not ready (from the 30-min check)', () => {
  const a = apt({ patient: { ready: 'not-tested' } });
  assert.equal(otherAlertProblem(a, 'doctor', T.start - 20 * MIN), 'not-ready');
  assert.equal(otherAlertProblem(apt({ patient: { ready: 'ok' } }), 'doctor', T.start - 20 * MIN), null);
  assert.equal(otherAlertProblem(apt({ doctor: { ready: 'no-alerts' } }), 'patient', T.start - 20 * MIN), 'not-ready');
  assert.equal(otherAlertProblem(apt({ patient: { ready: 'no-alerts' } }, { consultationType: 'in-person' }), 'doctor', T.start - 20 * MIN), null, 'clinic visit: no call');
  assert.equal(otherAlertProblem(a, 'doctor', T.end + MIN), null, 'slot over');
});
