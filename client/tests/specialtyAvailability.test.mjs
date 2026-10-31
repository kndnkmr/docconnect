// Specialties with doctors first; no dead-end "No doctors found".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countFor, hasDoctors, splitByDoctors, orderByDoctors, fallbackFor,
  slugForName, titleForSlug, specialtyHref, notifyMeText, pluralSpec, readSavedCounts, saveCounts,
} from '../src/utils/specialtyAvailability.js';

const live = {
  Gynaecologist: 8, 'General Physician': 4, Neurologist: 2, Pediatrician: 2, Microbiologist: 1,
  Dermatologist: 0, Cardiologist: 0, Psychiatrist: 0, 'ENT Specialist': 0, 'Internal Medicine': 1,
};

test('counts are read case-insensitively; unknown names are "don\'t know"', () => {
  assert.equal(countFor('gynaecologist', live), 8);
  assert.equal(countFor('Dermatologist', live), 0);
  assert.equal(countFor('Cardio', live), undefined);
  assert.equal(countFor('Gynaecologist', null), undefined);
  assert.equal(hasDoctors('Neurologist', live), true);
  assert.equal(hasDoctors('Dermatologist', live), false);
  assert.equal(hasDoctors('Dermatologist', null), null);
});

test('specialties with doctors first, most doctors first, ties keep order', () => {
  const items = ['Dermatologist', 'Pediatrician', 'Cardiologist', 'Neurologist', 'General Physician', 'Gynaecologist'];
  const { live: l, soon } = splitByDoctors(items, live);
  assert.deepEqual(l, ['Gynaecologist', 'General Physician', 'Pediatrician', 'Neurologist']);
  assert.deepEqual(soon, ['Dermatologist', 'Cardiologist']);
  assert.deepEqual(orderByDoctors(items, live), [...l, ...soon]);
});

test('without counts nothing changes (nothing hidden or greyed)', () => {
  const items = [{ s: 'Dermatologist' }, { s: 'Gynaecologist' }];
  const r = splitByDoctors(items, null, (x) => x.s);
  assert.deepEqual(r.live, items);
  assert.deepEqual(r.soon, []);
});

test('names the server does not count stay in the live list (never wrongly greyed)', () => {
  const r = splitByDoctors(['Dietitian', 'Dermatologist', 'Gynaecologist'], live);
  assert.deepEqual(r.live, ['Gynaecologist', 'Dietitian']);
  assert.deepEqual(r.soon, ['Dermatologist']);
});

test('empty specialty → closest specialty that has doctors', () => {
  assert.equal(fallbackFor('Dermatologist', live), 'General Physician');
  assert.equal(fallbackFor('ENT Specialist', live), 'General Physician');
  assert.equal(fallbackFor('Psychiatrist', live), 'General Physician');
  assert.equal(fallbackFor('Psychiatrist', { ...live, 'General Physician': 0, 'Internal Medicine': 0 }), 'Neurologist');
  assert.equal(fallbackFor('cardio', live), 'General Physician', 'free text still gets help');
  // Has doctors → no fallback needed; unknown counts → none offered.
  assert.equal(fallbackFor('Gynaecologist', live), null);
  assert.equal(fallbackFor('Dermatologist', null), null);
  // No GP at all → the specialty with most doctors, never itself.
  assert.equal(fallbackFor('Dermatologist', { Dermatologist: 0, Neurologist: 2, Gynaecologist: 5 }), 'Gynaecologist');
  assert.equal(fallbackFor('General Physician', { 'General Physician': 0, 'Internal Medicine': 0, Neurologist: 1 }), 'Neurologist');
  assert.equal(fallbackFor('Dermatologist', { Dermatologist: 0 }), null);
});

test('specialty pages and links', () => {
  assert.equal(slugForName('General Physician'), 'general-physician');
  assert.equal(slugForName('ent specialist'), 'ent-specialist');
  assert.equal(slugForName('Dietitian'), null);
  assert.equal(titleForSlug('pediatrician'), 'Pediatrician');
  assert.equal(specialtyHref('Neurologist'), '/specialization/neurologist');
  assert.equal(specialtyHref('Ayurveda'), '/doctors?specialization=Ayurveda');
  assert.match(notifyMeText('Dermatologist', 'Bhilai'), /Dermatologist in Bhilai joins/);
});

test('saved counts are reused for a week, broken storage is ignored', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  saveCounts(storage, live, 1000);
  assert.deepEqual(readSavedCounts(storage, 2000), live);
  assert.equal(readSavedCounts(storage, 1000 + 8 * 24 * 3600 * 1000), null);
  mem.set('pmz_spec_counts', '{oops');
  assert.equal(readSavedCounts(storage), null);
  assert.equal(readSavedCounts({ getItem() { throw new Error('blocked'); } }), null);
});

test('plural names read naturally', () => {
  assert.equal(pluralSpec('Dermatologist'), 'Dermatologists');
  assert.equal(pluralSpec('General Physician'), 'General Physicians');
  assert.equal(pluralSpec('ENT Specialist'), 'ENT Specialists');
  assert.equal(pluralSpec('Ayurveda'), 'Ayurveda doctors');
  assert.equal(pluralSpec('Orthopedic'), 'Orthopedic doctors');
});
