// Admin profile helper: strength checklist, facts-only bio drafts, look-ups.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileChecklist, needsBetterPage, draftBio, lookupLinks, GOOD_BIO } from '../src/utils/profileHelper.js';

const thin = { name: 'pooja singh', specialization: 'Obstetrician and Gynaecologist', city: 'bhilai', phone: '9999999999' };
const full = {
  ...thin, profilePhoto: 'p.jpg', qualification: 'MBBS, MS', experience: 12, medicalRegistrationNo: 'CG-123',
  bio: 'x'.repeat(GOOD_BIO), clinicAddress: 'Sector 6', languagesSpoken: ['Hindi', 'English'],
  consultationFee: 500, consultationModes: ['in-person', 'video'], googleReviewLink: 'https://g.page/r/x/review',
};

test('profile strength counts 9 things and names what is missing', () => {
  const t = profileChecklist(thin);
  assert.equal(t.total, 9);
  assert.equal(t.score, 0);
  assert.equal(t.missing.length, 9);
  const f = profileChecklist(full);
  assert.equal(f.score, 9);
  assert.equal(f.missing.length, 0);
  assert.equal(profileChecklist({ ...full, bio: 'short' }).missing[0].key, 'bio');
  assert.equal(needsBetterPage(thin), true);
  assert.equal(needsBetterPage(full), false);
  assert.equal(needsBetterPage({ ...full, bio: '', googleReviewLink: '' }), false, '7/9 is fine');
  assert.equal(needsBetterPage({ ...full, bio: '', googleReviewLink: '', profilePhoto: '' }), true);
  assert.equal(profileChecklist(null).score, 0);
});

test('warm English draft uses only their details + what the specialty covers', () => {
  const b = draftBio(full, { tone: 'warm' });
  assert.equal(b, 'Dr. Pooja Singh is an Obstetrician and Gynaecologist based in Bhilai with 12 years of experience. Qualifications: MBBS, MS. Patients consult Dr. Pooja Singh for common concerns such as irregular periods, PCOD/PCOS, pregnancy care and infertility/IVF. You can consult in person at the clinic and on video through ProMedicoz, in Hindi and English. Consultation fee: Rs. 500, paid directly to the doctor.');
});

test('short and Hindi drafts', () => {
  assert.equal(draftBio(full, { tone: 'short' }), 'Dr. Pooja Singh is an Obstetrician and Gynaecologist in Bhilai with 12 years of experience (MBBS, MS). Helps with irregular periods, PCOD/PCOS, pregnancy care and infertility/IVF.');
  const h = draftBio(full, { lang: 'hi' });
  assert.match(h, /^Dr\. Pooja Singh Bhilai में Obstetrician and Gynaecologist हैं और उन्हें 12 साल का अनुभव है।/);
  assert.match(h, /गर्भावस्था देखभाल/);
  assert.match(h, /Rs\. 500/);
});

test('thin details → short, true draft (no made-up facts)', () => {
  const b = draftBio({ name: 'Ravi Kumar', specialization: 'MICROBIOLOGY' });
  assert.match(b, /^Dr\. Ravi Kumar is a Microbiology specialist\./);
  assert.doesNotMatch(b, /years|Rs\.|undefined|null/);
  assert.equal(draftBio({ name: 'A B' }), 'Dr. A B is a doctor.');
});

test('look-up links are safe, encoded and open known sites', () => {
  const l = lookupLinks({ ...full, name: 'Dr. A&B "X"' });
  assert.deepEqual(l.map((x) => x.key), ['google', 'maps', 'nmc']);
  assert.ok(l[0].href.startsWith('https://www.google.com/search?q='));
  assert.ok(!l[0].href.includes('&B'), 'name is encoded');
  assert.ok(l[1].href.startsWith('https://www.google.com/maps/search/?api=1&query='));
  assert.ok(l[2].href.startsWith('https://www.nmc.org.in/'));
});
