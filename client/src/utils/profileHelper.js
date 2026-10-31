// ============================================
// Admin → Manage doctor: help a thin profile look good
// ============================================
// Many doctors send only basic details and ask ProMedicoz to "make the page
// look good". This gives the admin:
//   • profileChecklist — "Profile strength X/9" + what's missing,
//   • draftBio — a ready-to-edit bio written ONLY from the doctor's own
//     details plus what their specialty usually covers (never invented
//     awards, hospitals or claims), in a warm / short / Hindi version,
//   • lookupLinks — Google, Google Maps and the NMC register, opened in a
//     new tab so the admin can check facts and find the review link.
// Nothing is fetched from the internet automatically: the admin reads,
// checks with the doctor, edits, and saves.
// Tests: tests/profileHelper.test.mjs

import { specializationData, specializationHi } from '../pages/specializationData.js';
import { specialtySlugFor } from './doctorPageExtras.js';
import { formatDoctorName } from './formatName.js';
import { cleanCity } from './doctorSeo.js';

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const tidy = (s) => (s && s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s);
const listEn = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const listHi = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} और ${a[a.length - 1]}`);
// "Irregular periods" → "irregular periods"; keeps "PCOD/PCOS", "IVF".
const lc = (c) => (/^[A-Z][a-z]/.test(c) ? c[0].toLowerCase() + c.slice(1) : c);
const article = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const isPerson = (s) => /(ist|ian|surgeon|physician|eon)\b/i.test(s);
const MODES = {
  en: { 'in-person': 'in person at the clinic', video: 'on video', phone: 'on phone' },
  hi: { 'in-person': 'क्लिनिक पर', video: 'वीडियो', phone: 'फ़ोन' },
};
export const GOOD_BIO = 150; // characters — about 3 lines

// "Profile strength": 9 things that make a doctor page trustworthy.
export function profileChecklist(d) {
  d = d || {};
  const has = (v) => clean(v).length > 0;
  const items = [
    { key: 'photo', label: 'Photo', done: has(d.profilePhoto), tab: 'images' },
    { key: 'qualification', label: 'Specialty & degree', done: has(d.specialization) && has(d.qualification) },
    { key: 'experience', label: 'Years of experience', done: Number(d.experience) > 0 },
    { key: 'registration', label: 'Registration no.', done: has(d.medicalRegistrationNo) },
    { key: 'bio', label: `Bio (${GOOD_BIO}+ letters)`, done: clean(d.bio).length >= GOOD_BIO },
    { key: 'clinic', label: 'City & clinic address', done: has(d.city) && has(d.clinicAddress) },
    { key: 'languages', label: 'Languages', done: Array.isArray(d.languagesSpoken) && d.languagesSpoken.length > 0 },
    { key: 'fee', label: 'Fee & consult types', done: Number(d.consultationFee) > 0 && Array.isArray(d.consultationModes) && d.consultationModes.length > 0 },
    { key: 'review', label: 'Google review link', done: has(d.googleReviewLink) },
  ];
  const score = items.filter((i) => i.done).length;
  return { items, score, total: items.length, missing: items.filter((i) => !i.done) };
}

// A page that still looks thin to a patient (admin "Needs a better page").
export function needsBetterPage(d) {
  return profileChecklist(d).score < 7;
}

// Bio draft from facts only. tone: 'warm' | 'short'; lang: 'en' | 'hi'.
export function draftBio(d, { tone = 'warm', lang = 'en' } = {}) {
  d = d || {};
  const name = formatDoctorName(d.name) || 'The doctor';
  const spec = tidy(clean(d.specialization));
  const city = cleanCity(d.city);
  const qual = clean(d.qualification);
  const exp = Number(d.experience) > 0 ? Math.round(Number(d.experience)) : 0;
  const fee = Number(d.consultationFee) > 0 ? Number(d.consultationFee) : 0;
  const modes = (Array.isArray(d.consultationModes) ? d.consultationModes : []).filter((m) => MODES.en[m]);
  const langs = (Array.isArray(d.languagesSpoken) ? d.languagesSpoken : []).map(clean).filter(Boolean);
  const slug = specialtySlugFor(spec);
  const hi = lang === 'hi';
  const conds = ((hi && slug && specializationHi[slug]?.conditions) || (slug && specializationData[slug]?.conditions) || []).slice(0, 4);
  const specWord = spec ? (isPerson(spec) ? spec : hi ? `${spec} विशेषज्ञ` : `${spec} specialist`) : (hi ? 'डॉक्टर' : 'doctor');

  if (hi) {
    const parts = [
      `${name}${city ? ` ${city} में` : ''} ${specWord} हैं${exp ? ` और उन्हें ${exp} साल का अनुभव है` : ''}।`,
      qual ? `योग्यता: ${qual}।` : '',
      conds.length ? `वे ${listHi(conds)} जैसी आम समस्याओं में मरीज़ों की मदद करते हैं।` : '',
      tone === 'short' ? '' : (modes.length ? `ProMedicoz पर ${listHi(modes.map((m) => MODES.hi[m]))} से परामर्श ले सकते हैं${langs.length ? `; ${listHi(langs)} में बात करते हैं` : ''}।` : ''),
      tone === 'short' || !fee ? '' : `परामर्श फ़ीस Rs. ${fee}, सीधे डॉक्टर को।`,
    ];
    return parts.filter(Boolean).join(' ');
  }

  if (tone === 'short') {
    return [
      `${name} is ${article(specWord)} ${specWord}${city ? ` in ${city}` : ''}${exp ? ` with ${exp} years of experience` : ''}${qual ? ` (${qual})` : ''}.`,
      conds.length ? `Helps with ${listEn(conds.map(lc))}.` : '',
    ].filter(Boolean).join(' ');
  }
  return [
    `${name} is ${article(specWord)} ${specWord}${city ? ` based in ${city}` : ''}${exp ? ` with ${exp} years of experience` : ''}.`,
    qual ? `Qualifications: ${qual}.` : '',
    conds.length ? `Patients consult ${name} for common concerns such as ${listEn(conds.map(lc))}.` : '',
    modes.length ? `You can consult ${listEn(modes.map((m) => MODES.en[m]))} through ProMedicoz${langs.length ? `, in ${listEn(langs)}` : ''}.` : '',
    fee ? `Consultation fee: Rs. ${fee}, paid directly to the doctor.` : '',
  ].filter(Boolean).join(' ');
}

// One-click look-ups (open in a new tab). The admin checks; nothing is copied
// automatically.
export function lookupLinks(d) {
  d = d || {};
  const name = formatDoctorName(d.name);
  const spec = clean(d.specialization);
  const city = clean(d.city);
  const q = (s) => encodeURIComponent(s.replace(/\s+/g, ' ').trim());
  return [
    { key: 'google', label: '🔎 Google', title: 'Search Google for this doctor', href: `https://www.google.com/search?q=${q(`"${name}" ${spec} ${city}`)}` },
    { key: 'maps', label: '📍 Google Maps', title: 'Find the clinic on Google Maps (map link + review link)', href: `https://www.google.com/maps/search/?api=1&query=${q(`${name} ${clean(d.clinicAddress)} ${city}`)}` },
    { key: 'nmc', label: '🪪 NMC register', title: 'Check the registration number on the NMC Indian Medical Register', href: 'https://www.nmc.org.in/information-desk/indian-medical-register/' },
  ];
}
