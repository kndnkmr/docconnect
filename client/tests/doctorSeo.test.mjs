// Doctor pages: what Google reads (src/utils/doctorSeo.js).
// Bug this guards: doctor pages sent a HINDI <title>, so English searches
// like "best gynecologist in bhilai" didn't match the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  doctorSearchTitle, doctorSearchDescription, specialtySearchLabel, specialtySchema, openingHours, doctorJsonLd,
} from '../src/utils/doctorSeo.js';

const pooja = {
  name: 'Pooja Singh', slug: 'pooja-singh', city: 'Bhilai ', specialization: 'Obstetrician and Gynaecologist ',
  qualification: 'MBBS, MS', experience: 7, consultationFee: 300, consultationModes: ['in-person', 'phone'],
  languagesSpoken: ['Hindi', 'English'], clinicAddress: 'Clinic road', googleMapsLink: 'https://maps.app.goo.gl/x',
  availability: [{ day: 'Monday', startTime: '12:00', endTime: '20:00' }], rating: { average: 0, count: 0 },
};

test('title: English, both specialty spellings, city — no Hindi', () => {
  const t = doctorSearchTitle(pooja);
  assert.equal(t, 'Dr. Pooja Singh – Gynaecologist (Gynecologist) in Bhilai');
  assert.doesNotMatch(t, /[\u0900-\u097F]/);
});

test('specialty typos and variants map to what people search', () => {
  assert.equal(specialtySearchLabel('Gyanecologist'), 'Gynaecologist (Gynecologist)');
  assert.equal(specialtySearchLabel('Pediatrician neonatologist'), 'Paediatrician (Pediatrician)');
  assert.equal(specialtySearchLabel('General physician '), 'General Physician');
  assert.equal(specialtySearchLabel('INTERNAL MEDICINE'), 'General Physician');
  // Unusual specialty keeps the doctor's own words (not relabelled).
  assert.equal(specialtySearchLabel('Anesthesiology and physician'), 'Anesthesiology and Physician');
  assert.equal(specialtySearchLabel(''), 'Doctor');
});

test('description: factual, English, from profile fields only', () => {
  const d = doctorSearchDescription(pooja);
  assert.match(d, /^Dr\. Pooja Singh, Obstetrician and Gynaecologist in Bhilai \(MBBS, MS, 7 yrs experience\)\./);
  assert.match(d, /in-clinic or phone consultation/);
  assert.match(d, /Fee Rs\. 300\./);
  assert.doesNotMatch(d, /[\u0900-\u097F]/);
});

test('schema: one consistent Physician with /dr/ url, city, hours, nearby cities', () => {
  const j = doctorJsonLd(pooja);
  assert.equal(j['@id'], 'https://www.promedicoz.in/dr/pooja-singh#physician');
  assert.equal(j.url, 'https://www.promedicoz.in/dr/pooja-singh');
  assert.deepEqual(j.medicalSpecialty, ['https://schema.org/Gynecologic', 'https://schema.org/Obstetric']);
  assert.equal(j.address.addressLocality, 'Bhilai');
  assert.deepEqual(j.areaServed.map((c) => c.name), ['Bhilai', 'Durg', 'Raipur']);
  assert.equal(j.openingHoursSpecification.length, 1);
  assert.equal(j.aggregateRating, undefined, 'no rating invented when there are no reviews');
  assert.equal(JSON.stringify(j).includes('phone'), false, 'no phone/UPI in schema');
  const rated = doctorJsonLd({ ...pooja, rating: { average: 4.8, count: 5 } });
  assert.equal(rated.aggregateRating.reviewCount, 5);
});

test('opening hours ignore malformed rows', () => {
  assert.equal(openingHours([{ day: 'Funday', startTime: '09:00', endTime: '10:00' }, { day: 'Monday', startTime: '9', endTime: '10:00' }]).length, 0);
  assert.deepEqual(specialtySchema('Microbiology'), []);
});

test('build uses English for Google and keeps Hindi only for WhatsApp previews', () => {
  const src = fs.readFileSync(new URL('../scripts/prerender.mjs', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf("path: `/dr/${d.slug}`"), src.indexOf("path: `/dr/${d.slug}`") + 900);
  assert.match(block, /title: doctorSearchTitle\(d\)/);
  assert.match(block, /description: doctorSearchDescription\(d\)/);
  assert.match(block, /ogTitle:/);
});
