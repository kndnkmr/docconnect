// ============================================
// API smoke tests (no database required)
// ============================================
// These use the exported Express app directly (supertest), so they run fast
// and don't need MongoDB. They verify the app is wired correctly:
//   - public routes respond
//   - unknown routes 404
//   - protected routes reject unauthenticated requests (401)
//
// Run with:  npm test    (from the server/ folder)

const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

const app = require('../server');

test('GET / returns API welcome (200)', async () => {
  const res = await request(app).get('/');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.message, 'expected a welcome message');
});

test('GET /api/health returns OK (200)', async () => {
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'OK');
});

test('Unknown route returns 404', async () => {
  const res = await request(app).get('/api/this-route-does-not-exist');
  assert.strictEqual(res.status, 404);
});

// Protected routes must reject requests without a valid token.
// The auth middleware runs before any controller/DB access, so these are
// deterministic and need no database.
const protectedRoutes = [
  ['get', '/api/appointments/my'],
  ['get', '/api/appointments/incoming-calls'],
  ['get', '/api/appointments/someid/video-token'],
  ['get', '/api/messages/unread/count'],
  ['get', '/api/admin/stats'],
  ['get', '/api/admin/users'],
  ['get', '/api/family-members']
];

for (const [method, path] of protectedRoutes) {
  test(`${method.toUpperCase()} ${path} requires auth (401)`, async () => {
    const res = await request(app)[method](path);
    assert.strictEqual(
      res.status,
      401,
      `expected 401 for ${path}, got ${res.status}`
    );
  });
}

// Admin-only routes must also reject a logged-in NON-admin, but that needs a
// token/DB, so it's covered by manual testing. These smoke tests intentionally
// stay database-free for speed and reliability.
