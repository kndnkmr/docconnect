// Doctor page extra content: facts only, both languages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { specialtySlugFor, doctorExtras } from '../src/utils/doctorPageExtras.js';

test('doctor-typed specialties map to our specialty pages', () => {
  const cases = {
    'Obstetrician and gynaecologist': 'gynaecologist', 'Gyanecologist': 'gynaecologist', 'Gynecologist and Obstetrician': 'gynaecologist',
    'Obstetrician and Gynaecologist, Fertility specialist': 'gynaecologist', 'INTERNAL MEDICINE': 'general-physician', 'General physician': 'general-physician',
    'Microbiology': 'microbiologist', 'Pediatrician neonatologist': 'pediatrician', 'Neurologist': 'neurologist',
  };
  for (const [typed, slug] of Object.entries(cases)) assert.equal(specialtySlugFor(typed), slug, typed);
  assert.equal(specialtySlugFor('Anesthesiology and physician'), null, 'unclear → no page');
  assert.equal(specialtySlugFor(''), null);
});

const noBio = {
  name: 'harinder singh', specialization: 'Microbiology', city: 'nabha', qualification: 'PhD', experience: 10, consultationFee: 200,
  consultationModes: ['in-person', 'video', 'phone'], languagesSpoken: ['Punjabi', 'English', 'Hindi'], clinicAddress: 'Main Road, Nabha',
  availability: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => ({ day, startTime: '09:00', endTime: '17:00' })), bio: '',
};

test('English: about from real facts (only without a bio), hours, reasons, questions', () => {
  const x = doctorExtras(noBio, 'en');
  assert.equal(x.about, 'Dr. Harinder Singh is a Microbiology specialist in Nabha with 10 years of experience (PhD). Consults in person at the clinic, on video and on phone, in Punjabi, English and Hindi. Consultation fee: Rs. 200, paid directly to the doctor.');
  assert.equal(x.hours, 'Mon–Fri 9:00 AM–5:00 PM');
  assert.equal(x.specSlug, 'microbiologist');
  assert.ok(x.reasons.length > 0 && x.reasonsTitle.startsWith('Common reasons to see a Microbiologist'));
  const qs = x.faqs.map((f) => f.q);
  assert.deepEqual(qs, [
    "What is Dr. Harinder Singh's consultation fee?", 'Can I consult Dr. Harinder Singh online?', 'Which languages does Dr. Harinder Singh speak?',
    "Where is Dr. Harinder Singh's clinic?", 'When is Dr. Harinder Singh available?', 'How do I book an appointment with Dr. Harinder Singh?',
  ]);
  assert.match(x.faqs[0].a, /^Rs\. 200\./);
  assert.match(x.faqs[1].a, /^Yes/);
  assert.equal(x.faqs[3].a, 'Main Road, Nabha.', 'city not repeated when already in the address');
  // A real bio → no generated "about"
  assert.equal(doctorExtras({ ...noBio, bio: 'I have treated infections and advised on lab tests for over a decade in Punjab.' }).about, '');
});

test('wording: job titles stay, subjects become "specialist", capitals tidied', () => {
  const about = (spec) => doctorExtras({ name: 'a b', specialization: spec }).about;
  assert.match(about('Obstetrician and gynaecologist'), /is an Obstetrician and gynaecologist\./);
  assert.match(about('INTERNAL MEDICINE'), /is an Internal Medicine specialist\./);
  assert.match(about('General Physician'), /is a General Physician\./);
  assert.match(about('Pediatrician neonatologist'), /is a Pediatrician neonatologist\./);
  assert.match(about('Anesthesiology and physician'), /is an Anesthesiology and physician\./);
});

test('only facts that exist: no fee/languages/address/hours questions without them; clinic-only doctor', () => {
  const x = doctorExtras({ name: 'test doc', specialization: 'Neurologist', consultationModes: ['in-person'] }, 'en');
  assert.deepEqual(x.faqs.map((f) => f.q), ['Can I consult Dr. Test Doc online?', 'How do I book an appointment with Dr. Test Doc?']);
  assert.match(x.faqs[0].a, /in person at the clinic/);
  assert.equal(x.hours, '');
  const none = doctorExtras({ name: 'x y', specialization: 'Anesthesiology and physician' });
  assert.equal(none.specSlug, null);
  assert.deepEqual(none.reasons, []);
  assert.equal(none.reasonsTitle, '');
});

test('Hindi version', () => {
  const x = doctorExtras(noBio, 'hi');
  assert.match(x.about, /Nabha में Microbiology विशेषज्ञ हैं और उन्हें 10 साल का अनुभव है/);
  assert.match(x.about, /क्लिनिक, वीडियो या फ़ोन पर परामर्श देते हैं/);
  assert.equal(x.hours, 'सोम–शुक्र 9:00 AM–5:00 PM');
  assert.ok(x.reasons.length > 0);
  assert.match(x.faqs[0].q, /परामर्श फ़ीस कितनी है/);
});
