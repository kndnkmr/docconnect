// Call alarm rules (src/utils/callAlarm.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotTimes, wantsCallAlerts, callAlertState, isIOSDevice, showNoShowHelp } from '../src/utils/callAlarm.js';

const DATE = '2099-01-01T00:00:00.000Z';
const SLOT = '10:30 AM - 11:00 AM';
const t = slotTimes(DATE, SLOT);
const H = 3600 * 1000;

test('slot times are IST', () => {
  assert.equal(new Date(t.start).toISOString(), '2099-01-01T05:00:00.000Z');
  assert.equal(t.end - t.start, 30 * 60000);
  assert.equal(slotTimes(DATE, '11:30 PM - 12:00 AM').end - slotTimes(DATE, '11:30 PM - 12:00 AM').start, 30 * 60000);
  assert.equal(slotTimes(DATE, 'whenever'), null);
});

test('call-alert box: video/phone, active, within 48 h', () => {
  const a = { consultationType: 'video', status: 'confirmed', date: DATE, timeSlot: SLOT };
  assert.equal(wantsCallAlerts(a, t.start - 24 * H), true);
  assert.equal(wantsCallAlerts(a, t.start - 72 * H), false);
  assert.equal(wantsCallAlerts({ ...a, consultationType: 'in-person' }, t.start - H), false);
  assert.equal(wantsCallAlerts({ ...a, status: 'completed' }, t.start - H), false);
  assert.equal(wantsCallAlerts(a, t.end + 1), false);
});

test('call-alert state per device', () => {
  assert.equal(callAlertState({ supported: true, permission: 'granted' }), 'on');
  assert.equal(callAlertState({ supported: true, permission: 'default' }), 'off');
  assert.equal(callAlertState({ supported: true, permission: 'denied' }), 'blocked');
  assert.equal(callAlertState({ supported: false, permission: 'default', isIOS: true, standalone: false }), 'ios-install');
  assert.equal(callAlertState({ supported: true, permission: 'granted', isIOS: true, standalone: true }), 'on');
  assert.equal(callAlertState({ supported: false }), 'unsupported');
  assert.ok(isIOSDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 5));
  assert.ok(isIOSDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 5)); // iPad desktop mode
  assert.ok(!isIOSDevice('Mozilla/5.0 (Linux; Android 14)', 5));
});

test('"not joined yet" help: 2 min after start until the end', () => {
  const a = { consultationType: 'phone', status: 'confirmed', paymentStatus: 'paid', date: DATE, timeSlot: SLOT };
  assert.equal(showNoShowHelp(a, t.start + 60000), false);
  assert.equal(showNoShowHelp(a, t.start + 3 * 60000), true);
  assert.equal(showNoShowHelp(a, t.end + 1), false);
  assert.equal(showNoShowHelp({ ...a, paymentStatus: 'pending' }, t.start + 3 * 60000), false);
});
