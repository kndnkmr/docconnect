// Which writes clear the 30-second public cache? Only ones that can change
// what the public lists show. No database required.
const { test } = require('node:test');
const assert = require('node:assert');
const { invalidateOnWrites, HARMLESS_WRITES, _store } = require('../utils/publicCache');
const clears = (method, path) => {
  _store.set('probe', { at: Date.now(), body: {} });
  const handlers = {};
  const res = { statusCode: 200, on: (ev, fn) => { handlers[ev] = fn; } };
  invalidateOnWrites({ method, path }, res, () => {});
  if (handlers.finish) handlers.finish();
  const cleared = !_store.has('probe');
  _store.clear();
  return cleared;
};
test('writes that change public data still clear the cache', () => {
  for (const [m, p] of [
    ['POST', '/api/appointments'], ['PUT', '/api/appointments/abc/status'], ['PUT', '/api/appointments/abc/cancel'],
    ['PUT', '/api/appointments/abc/reschedule'], ['PUT', '/api/appointments/abc/payment'],
    ['POST', '/api/auth/register'], ['PUT', '/api/auth/update-account'], ['POST', '/api/reviews'],
    ['PUT', '/api/availability'], ['PUT', '/api/doctors/profile'], ['PUT', '/api/admin/users/abc/suspension'],
  ]) assert.strictEqual(clears(m, p), true, `${m} ${p} must clear the cache`);
});
test('logging in, ringing a call and payment proofs no longer throw the cache away', () => {
  for (const [m, p] of [
    ['POST', '/api/auth/login'], ['POST', '/api/auth/forgot-password'], ['PUT', '/api/auth/reset-password/tok123'],
    ['PUT', '/api/appointments/abc/call'], ['POST', '/api/appointments/abc/call-log'], ['PUT', '/api/appointments/abc/call-log/def/end'],
    ['PUT', '/api/appointments/abc/payment-screenshot'], ['PUT', '/api/appointments/abc/notify-payment'],
    ['PUT', '/api/appointments/abc/undo-payment-claim'], ['POST', '/api/appointments/abc/payment-reminder'],
    ['PUT', '/api/appointments/abc/payment-not-received'], ['PUT', '/api/appointments/abc/ask-prescription'],
  ]) assert.strictEqual(clears(m, p), false, `${m} ${p} should keep the cache`);
});
test('reads never clear it, and a failed write does not either', () => {
  assert.strictEqual(clears('GET', '/api/appointments/my'), false);
  _store.set('probe', { at: Date.now(), body: {} });
  const handlers = {};
  invalidateOnWrites({ method: 'POST', path: '/api/appointments' }, { statusCode: 400, on: (ev, fn) => { handlers[ev] = fn; } }, () => {});
  handlers.finish();
  assert.ok(_store.has('probe'));
  _store.clear();
  assert.ok(HARMLESS_WRITES instanceof RegExp);
});
