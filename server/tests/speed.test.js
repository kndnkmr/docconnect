// ============================================
// Speed: public-list memory + faster doctor list (no DB)
// ============================================
const { test } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const { cachePublic, invalidateOnWrites, invalidatePublic } = require('../utils/publicCache');

function appWithCounter() {
  let hits = 0;
  const app = express();
  app.use(invalidateOnWrites);
  app.get('/api/doctors', cachePublic(), (req, res) => { hits += 1; res.json({ n: hits }); });
  app.post('/api/appointments', (req, res) => res.status(201).json({ ok: true }));
  app.post('/api/appointments/fail', (req, res) => res.status(400).json({ ok: false }));
  app.post('/api/messages', (req, res) => res.json({ ok: true }));
  return { app, hits: () => hits };
}

test('repeat public request is answered from memory', async () => {
  invalidatePublic();
  const { app, hits } = appWithCounter();
  const a = await request(app).get('/api/doctors?limit=10');
  const b = await request(app).get('/api/doctors?limit=10');
  assert.strictEqual(a.headers['x-cache'], 'MISS');
  assert.strictEqual(b.headers['x-cache'], 'HIT');
  assert.deepStrictEqual(b.body, a.body);
  assert.strictEqual(hits(), 1);
  // different query = different entry
  await request(app).get('/api/doctors?limit=5');
  assert.strictEqual(hits(), 2);
});

test('logged-in requests are never served from memory', async () => {
  invalidatePublic();
  const { app, hits } = appWithCounter();
  await request(app).get('/api/doctors').set('Authorization', 'Bearer x');
  await request(app).get('/api/doctors').set('Authorization', 'Bearer x');
  assert.strictEqual(hits(), 2);
});

test('a successful booking/change clears the memory; failed or unrelated ones do not', async () => {
  invalidatePublic();
  const { app, hits } = appWithCounter();
  await request(app).get('/api/doctors');
  await request(app).post('/api/appointments/fail');
  await request(app).post('/api/messages');
  await request(app).get('/api/doctors');
  assert.strictEqual(hits(), 1); // still cached
  await request(app).post('/api/appointments');
  const after = await request(app).get('/api/doctors');
  assert.strictEqual(after.headers['x-cache'], 'MISS');
  assert.strictEqual(hits(), 2);
});

test('doctor list: one ratings query in parallel, ranking + next free slot still correct', async () => {
  const User = require('../models/User');
  const Review = require('../models/Review');
  const Appointment = require('../models/Appointment');
  const { getAllDoctors } = require('../controllers/doctorController');

  const full = { _id: 'd1', name: 'Full', specialization: 'GP', consultationFee: 300, qualification: 'MBBS', experience: 10, bio: 'x', city: 'Delhi', profilePhoto: 'p', availability: [{ day: 'Monday', startTime: '09:00', endTime: '10:00' }], createdAt: new Date('2020-01-01') };
  const empty = { _id: 'd2', name: 'Empty', specialization: 'GP', availability: [], createdAt: new Date('2026-01-01') };
  let selected = '';
  let lean = false;
  User.find = () => ({ select(sel) { selected = sel; return { lean: async () => { lean = true; return [empty, full]; } }; } });
  let aggCalls = 0;
  Review.aggregate = async () => { aggCalls += 1; return [{ _id: 'd1', average: 4.66, count: 3 }]; };
  Appointment.find = () => ({ select: async () => [] });

  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await getAllDoctors({ query: {} }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(aggCalls, 1);                 // ratings fetched once (was twice)
  assert.ok(lean);
  assert.ok(selected.includes('-email') && selected.includes('-upiQrCode'));
  const [first, second] = res.body.doctors;
  assert.strictEqual(first.name, 'Full');           // complete profile ranks first
  assert.deepStrictEqual(first.rating, { average: 4.7, count: 3 });
  assert.deepStrictEqual(second.rating, { average: 0, count: 0 });
  assert.ok('nextAvailable' in first);              // next free slot attached
  assert.strictEqual(res.body.pagination.totalDoctors, 2);
});
