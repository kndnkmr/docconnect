// ============================================
// Health watch: error-spike + database-down alert emails
// ============================================
const { test } = require('node:test');
const assert = require('node:assert');
const { createWatch, routeKey } = require('../utils/healthWatch');

const MIN = 60 * 1000;
function setup(opts = {}) {
  let t = 1_000_000;
  const sent = [];
  const w = createWatch({ now: () => t, send: (m) => sent.push(m), ...opts });
  return { w, sent, tick: (ms) => { t += ms; } };
}

test('routeKey hides ids and query strings', () => {
  assert.strictEqual(routeKey('/api/appointments/66a1f0c2b3d4e5f6a7b8c9d0/pay?x=1'), '/api/appointments/:id/pay');
  assert.strictEqual(routeKey('/api/x/123'), '/api/x/:n');
});

test('ignores normal responses and 4xx', () => {
  const { w, sent } = setup();
  for (let i = 0; i < 50; i++) { w.recordStatus(200, '/a'); w.recordStatus(404, '/b'); w.recordStatus(401, '/c'); }
  assert.strictEqual(sent.length, 0);
});

test('9 errors: no alert; 10th within 10 min: one alert listing routes', () => {
  const { w, sent, tick } = setup();
  for (let i = 0; i < 9; i++) { w.recordStatus(500, '/api/appointments/66a1f0c2b3d4e5f6a7b8c9d0'); tick(30 * 1000); }
  assert.strictEqual(sent.length, 0);
  const a = w.recordStatus(503, '/api/doctors');
  assert.ok(a);
  assert.strictEqual(sent.length, 1);
  assert.match(sent[0].subject, /10 server errors/);
  assert.match(sent[0].html, /\/api\/appointments\/:id — 9/);
});

test('errors spread over more than 10 min do not alert', () => {
  const { w, sent, tick } = setup();
  for (let i = 0; i < 30; i++) { w.recordStatus(500, '/x'); tick(2 * MIN); }
  assert.strictEqual(sent.length, 0);
});

test('error alert at most once an hour', () => {
  const { w, sent, tick } = setup();
  for (let i = 0; i < 40; i++) w.recordStatus(500, '/x');
  assert.strictEqual(sent.length, 1);
  tick(30 * MIN);
  for (let i = 0; i < 40; i++) w.recordStatus(500, '/x');
  assert.strictEqual(sent.length, 1);
  tick(31 * MIN);
  for (let i = 0; i < 10; i++) w.recordStatus(500, '/x');
  assert.strictEqual(sent.length, 2);
});

test('database: brief blip does not alert', () => {
  const { w, sent, tick } = setup();
  w.checkDb(false); tick(MIN); w.checkDb(false); tick(MIN); w.checkDb(true);
  assert.strictEqual(sent.length, 0);
});

test('database: down 3+ min alerts once, then "back" when it recovers', () => {
  const { w, sent, tick } = setup();
  w.checkDb(false);
  for (let i = 0; i < 20; i++) { tick(30 * 1000); w.checkDb(false); }
  assert.strictEqual(sent.length, 1);
  assert.match(sent[0].subject, /database disconnected/);
  w.checkDb(true);
  assert.strictEqual(sent.length, 2);
  assert.match(sent[1].subject, /database is back/);
  w.checkDb(true);
  assert.strictEqual(sent.length, 2);
});

test('a failing sender never throws into the request', () => {
  const w = createWatch({ send: () => Promise.reject(new Error('mail down')), threshold: 1 });
  assert.doesNotThrow(() => w.recordStatus(500, '/x'));
  const w2 = createWatch({ send: () => { throw new Error('boom'); }, threshold: 1 });
  assert.doesNotThrow(() => w2.recordStatus(500, '/x'));
});
