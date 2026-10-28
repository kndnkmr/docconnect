// City landing pages ("Best Gynaecologist (Gynecologist) in Bhilai") —
// facts, guide and FAQs come only from real doctor profiles
// (src/utils/cityPage.js). Also the doctor's Google review link check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  cityHeading, citySearchTitle, cityFacts, citySummary, cityGuide, cityFaqs, hoursSummary, nearbyCitySlugs,
} from '../src/utils/cityPage.js';
import { googleReviewLinkOk, profileProblems } from '../src/utils/profileAutosave.js';

const week = (from, to, days) => days.map((day) => ({ day, startTime: from, endTime: to }));
const pooja = { name: 'Pooja Singh', city: 'Bhilai', consultationFee: 300, consultationModes: ['in-person', 'phone'], languagesSpoken: ['Hindi', 'English'],
  availability: week('12:00', '20:00', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']) };
const akash = { name: 'Dr Akash verma', city: 'Durg', consultationFee: 400, consultationModes: ['in-person', 'phone', 'video'], languagesSpoken: ['Hindi'] };
const nearby = [{ citySlug: 'durg', cityName: 'Durg', doctors: [akash] }];
const args = { slug: 'gynaecologist', specTitle: 'Gynaecologist', cityName: 'Bhilai', doctors: [pooja], nearby, conditions: ['Irregular periods', 'PCOD/PCOS', 'Infertility/IVF'] };

test('heading/title use the words people search, both spellings', () => {
  assert.equal(cityHeading('Gynaecologist', 'Bhilai'), 'Best Gynaecologist (Gynecologist) in Bhilai');
  assert.equal(citySearchTitle('Gynaecologist', 'Bhilai'), 'Best Gynaecologist (Gynecologist) in Bhilai – Book Appointment');
});

test('facts: fee range, modes and languages across doctors', () => {
  const f = cityFacts([pooja, akash]);
  assert.deepEqual([f.count, f.feeMin, f.feeMax], [2, 300, 400]);
  assert.deepEqual(f.modes, ['in-person', 'phone', 'video']);
  assert.deepEqual(f.langs, ['Hindi', 'English']);
  assert.equal(cityFacts([]).feeMin, null);
});

test('summary counts city + nearby honestly', () => {
  assert.equal(citySummary(args), '1 verified gynaecologist in Bhilai + 1 nearby (Durg) · fees Rs. 300–400 · clinic, phone or video consultation');
  assert.equal(citySummary({ ...args, nearby: [] }), '1 verified gynaecologist in Bhilai · fees Rs. 300 · clinic or phone consultation');
  assert.match(citySummary({ ...args, lang: 'hi' }), /^Bhilai में 1 सत्यापित/);
});

test('guide keeps medical abbreviations and adds the safety line', () => {
  const g = cityGuide(args);
  assert.ok(g.items.some((i) => i.includes('PCOD/PCOS') && i.includes('Infertility/IVF')));
  assert.match(g.redFlag, /hospital/);
  assert.equal(cityGuide({ ...args, slug: 'dermatologist' }).redFlag, '');
});

test('FAQs name the real doctors and give exact counts', () => {
  const [who, fee, remote] = cityFaqs(args);
  assert.match(who.a, /Dr\. Pooja Singh\. Nearby: Dr\. Akash Verma \(Durg\)/);
  assert.match(fee.a, /Rs\. 300–400/);
  assert.match(remote.a, /^Yes\. 2 doctors here offer phone or video/);
  // No phone/video doctors → no remote question.
  const clinicOnly = cityFaqs({ ...args, doctors: [{ ...pooja, consultationModes: ['in-person'] }], nearby: [] });
  assert.equal(clinicOnly.length, 2);
});

test('hours collapse into ranges', () => {
  assert.equal(hoursSummary(pooja.availability), 'Mon–Sat 12:00 PM–8:00 PM');
  assert.equal(hoursSummary([...week('09:00', '13:00', ['Monday', 'Tuesday']), { day: 'Saturday', startTime: '10:00', endTime: '14:00' }]),
    'Mon–Tue 9:00 AM–1:00 PM, Sat 10:00 AM–2:00 PM');
  assert.equal(hoursSummary([]), '');
});

test('twin cities', () => {
  assert.deepEqual(nearbyCitySlugs('bhilai'), ['durg', 'raipur']);
  assert.deepEqual(nearbyCitySlugs('kochi'), []);
});

test('Google review link: same rule as the server', () => {
  for (const ok of ['https://g.page/r/abc/review', 'https://maps.app.goo.gl/x', 'https://search.google.com/local/writereview?placeid=1']) assert.ok(googleReviewLinkOk(ok), ok);
  for (const bad of ['http://g.page/r/x', 'https://g.page.evil.com/x', 'https://evil.com/?q=g.page', 'https://www.google.com/url?q=https://evil.com', 'javascript:alert(1)']) assert.equal(googleReviewLinkOk(bad), false, bad);
  assert.ok(profileProblems({ googleReviewLink: 'https://evil.com' }).googleReviewLink);
  assert.deepEqual(profileProblems({ googleReviewLink: '' }), {});
});

test('the Google prompt is not gated on stars (Google policy)', () => {
  const src = fs.readFileSync(new URL('../src/pages/Dashboard.jsx', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('const handleRateDoctor'), src.indexOf('// ---- Doctor: Write Prescription'));
  assert.match(block, /setGoogleAsk\(/);
  assert.doesNotMatch(block, /rating\s*(>=|>|===)\s*[3-5][^\n]*setGoogleAsk|if \(rating\s*(>=|>)/);
});
