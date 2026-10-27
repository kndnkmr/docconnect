// ============================================
// Double-booking guard index (utils/fixIndexes.js fixSlotIndex) — no DB
// ============================================
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const Appointment = require('../models/Appointment');
const { fixSlotIndex, describeSlotGuard } = require('../utils/fixIndexes');

const FILTER = Appointment.ACTIVE_SLOT_FILTER;
const ID = { v: 2, key: { _id: 1 }, name: '_id_' };
const PLAIN = { v: 2, key: { doctor: 1, date: 1, timeSlot: 1 }, name: 'doctor_1_date_1_timeSlot_1' };
const PATIENT = { v: 2, key: { patient: 1, date: -1 }, name: 'patient_1_date_-1' };
const DOCTOR = { v: 2, key: { doctor: 1, date: -1 }, name: 'doctor_1_date_-1' };

let indexes; let dropped; let created; let dups;
beforeEach(() => {
  indexes = [ID, PATIENT, DOCTOR, PLAIN]; // what Atlas showed: 4 indexes, no guard
  dropped = []; created = null; dups = [];
  Appointment.collection.indexes = async () => indexes;
  Appointment.collection.dropIndex = async (name) => { dropped.push(name); indexes = indexes.filter((i) => i.name !== name); };
  Appointment.collection.createIndex = async (key, opts) => {
    created = { key, opts };
    indexes = [...indexes, { v: 2, key, name: opts.name, unique: opts.unique, partialFilterExpression: opts.partialFilterExpression }];
  };
  Appointment.aggregate = async () => dups;
});

test('filter covers exactly the active statuses (alphabetical trick)', () => {
  const statuses = Appointment.schema.path('status').enumValues;
  const active = statuses.filter((s) => s > FILTER.status.$gt).sort();
  assert.deepStrictEqual(active, ['completed', 'confirmed', 'pending']);
  assert.ok(!('$ne' in FILTER.status) && !('$in' in FILTER.status)); // operators MongoDB rejects here
});

test('missing guard: drops the blocking plain index and creates unique_active_slot', async () => {
  const r = await fixSlotIndex();
  assert.strictEqual(r.on, true);
  assert.deepStrictEqual(dropped, ['doctor_1_date_1_timeSlot_1']);
  assert.deepStrictEqual(created.key, { doctor: 1, date: 1, timeSlot: 1 });
  assert.strictEqual(created.opts.unique, true);
  assert.deepStrictEqual(created.opts.partialFilterExpression, FILTER);
  assert.ok(!dropped.includes('patient_1_date_-1') && !dropped.includes('doctor_1_date_-1') && !dropped.includes('_id_'));
});

test('already on: does nothing', async () => {
  indexes = [ID, PATIENT, DOCTOR, { v: 2, key: { doctor: 1, date: 1, timeSlot: 1 }, name: 'unique_active_slot', unique: true, partialFilterExpression: FILTER }];
  const r = await fixSlotIndex();
  assert.strictEqual(r.on, true);
  assert.strictEqual(r.changed, false);
  assert.deepStrictEqual(dropped, []);
  assert.strictEqual(created, null);
});

test('real duplicate bookings: refuses to build and lists them', async () => {
  dups = [{ _id: { doctor: 'd1', date: new Date('2099-01-01'), timeSlot: '10:30 AM - 11:00 AM' }, count: 2, ids: ['a1', 'a2'] }];
  const r = await fixSlotIndex();
  assert.strictEqual(r.on, false);
  assert.match(r.error, /Duplicate active bookings/);
  assert.deepStrictEqual(r.duplicates[0].appointmentIds, ['a1', 'a2']);
  assert.deepStrictEqual(dropped, []); // nothing touched
});

test('an old guard with the wrong filter is replaced', async () => {
  indexes = [ID, { v: 2, key: { doctor: 1, date: 1, timeSlot: 1 }, name: 'unique_active_slot', unique: true, partialFilterExpression: { status: 'pending' } }];
  assert.strictEqual(describeSlotGuard(indexes, FILTER).on, false);
  const r = await fixSlotIndex();
  assert.strictEqual(r.on, true);
  assert.deepStrictEqual(dropped, ['unique_active_slot']);
});

test('never throws: a database error is reported', async () => {
  Appointment.collection.indexes = async () => { throw new Error('connection lost'); };
  const r = await fixSlotIndex();
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /connection lost/);
});
