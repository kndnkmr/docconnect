// ============================================
// City landing pages (/specialization/:slug/:city) — shared facts & copy
// ============================================
// Used by BOTH the app (SpecializationPage) and the build
// (scripts/prerender.mjs → the HTML Google reads), so what a visitor sees and
// what Google indexes are the same. Every fact comes from the doctors' own
// profiles (fees, consult types, languages, hours) — nothing invented, no
// fake "best" claims about a specific doctor.
// Guarded by tests/cityPage.test.mjs.

import { specialtySearchLabel, NEARBY_CITIES } from './doctorSeo.js';
import { formatDoctorName } from './formatName.js';

export const cityToSlug = (city) => String(city || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
export const slugToCityName = (slug) => String(slug || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// "Best Gynaecologist (Gynecologist) in Bhilai" — the page's <h1> and title.
export function cityHeading(specTitle, cityName) {
  return `Best ${specialtySearchLabel(specTitle)} in ${cityName}`;
}
export function citySearchTitle(specTitle, cityName) {
  return `${cityHeading(specTitle, cityName)} – Book Appointment`;
}

const MODE = {
  en: { 'in-person': 'clinic', phone: 'phone', video: 'video' },
  hi: { 'in-person': 'क्लिनिक', phone: 'फ़ोन', video: 'वीडियो' },
};
const listJoin = (arr, lang) => {
  const and = lang === 'hi' ? ' या ' : ' or ';
  if (arr.length <= 1) return arr.join('');
  return `${arr.slice(0, -1).join(', ')}${and}${arr[arr.length - 1]}`;
};

// Counts, fee range, consult types, languages across a list of doctors.
export function cityFacts(doctors) {
  const list = Array.isArray(doctors) ? doctors : [];
  const fees = list.map((d) => Number(d.consultationFee)).filter((f) => f > 0);
  const modes = ['in-person', 'phone', 'video'].filter((m) => list.some((d) => (d.consultationModes || []).includes(m)));
  const langs = [...new Set(list.flatMap((d) => (Array.isArray(d.languagesSpoken) ? d.languagesSpoken : [])).map((l) => String(l).trim()).filter(Boolean))];
  return {
    count: list.length,
    feeMin: fees.length ? Math.min(...fees) : null,
    feeMax: fees.length ? Math.max(...fees) : null,
    modes,
    langs,
  };
}

export function feeText(f, lang = 'en') {
  if (f.feeMin == null) return '';
  return f.feeMin === f.feeMax ? `Rs. ${f.feeMin}` : `Rs. ${f.feeMin}–${f.feeMax}`;
}
export function modesText(modes, lang = 'en') {
  return listJoin((modes || []).map((m) => MODE[lang][m]).filter(Boolean), lang);
}

// Weekly hours in one short line: "Mon–Sat 12:00 PM–8:00 PM".
// Different hours on different days → "Mon–Thu 12:00 PM–8:00 PM, Sat 10:00 AM–2:00 PM".
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT = { en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], hi: ['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'] };
const t12 = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
};
export function hoursSummary(availability, lang = 'en') {
  const rows = (Array.isArray(availability) ? availability : [])
    .filter((a) => a && DAYS.includes(a.day) && /^\d{2}:\d{2}$/.test(a.startTime || '') && /^\d{2}:\d{2}$/.test(a.endTime || ''));
  if (!rows.length) return '';
  const byDay = DAYS.map((d) => rows.find((r) => r.day === d) || null);
  const groups = [];
  byDay.forEach((r, i) => {
    if (!r) return;
    const key = `${r.startTime}-${r.endTime}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key && last.end === i - 1) last.end = i;
    else groups.push({ key, start: i, end: i, from: r.startTime, to: r.endTime });
  });
  return groups.map((g) => {
    const days = g.start === g.end ? SHORT[lang][g.start] : `${SHORT[lang][g.start]}–${SHORT[lang][g.end]}`;
    return `${days} ${t12(g.from)}–${t12(g.to)}`;
  }).join(', ');
}

export const nearbyCitySlugs = (citySlug) => NEARBY_CITIES[citySlug] || [];

// One line under the heading: "1 verified gynaecologist in Bhilai + 3 nearby (Durg, Raipur) · Rs. 300–500 · clinic, phone or video".
export function citySummary({ specTitle, cityName, doctors, nearby = [], lang = 'en' }) {
  const all = [...doctors, ...nearby.flatMap((n) => n.doctors)];
  const f = cityFacts(all);
  const spec = specTitle.toLowerCase();
  const n = doctors.length;
  const nearN = all.length - n;
  const nearNames = nearby.filter((x) => x.doctors.length).map((x) => x.cityName);
  if (lang === 'hi') {
    const parts = [`${cityName} में ${n} सत्यापित ${specTitle}${nearN ? ` + आस-पास ${nearN} (${nearNames.join(', ')})` : ''}`];
    if (f.feeMin != null) parts.push(`फ़ीस ${feeText(f)}`);
    if (f.modes.length) parts.push(`${modesText(f.modes, 'hi')} पर परामर्श`);
    return parts.join(' · ');
  }
  const parts = [`${n} verified ${n === 1 ? spec : `${spec}s`} in ${cityName}${nearN ? ` + ${nearN} nearby (${nearNames.join(', ')})` : ''}`];
  if (f.feeMin != null) parts.push(`fees ${feeText(f)}`);
  if (f.modes.length) parts.push(`${modesText(f.modes)} consultation`);
  return parts.join(' · ');
}

// Short, factual guide for the city. `conditions` come from the page's own
// specialty data. A safety line is added for specialties with clear red flags.
const RED_FLAGS = {
  gynaecologist: {
    en: 'Heavy bleeding, severe belly pain, or fainting — especially in pregnancy — go to the nearest hospital now.',
    hi: 'बहुत ज़्यादा खून आना, पेट में तेज़ दर्द या बेहोशी — ख़ासकर प्रेग्नेंसी में — तुरंत नज़दीकी अस्पताल जाएं।',
  },
  pediatrician: {
    en: 'A baby with breathing trouble, fits, or very high fever — go to the nearest hospital now.',
    hi: 'बच्चे को सांस में दिक्कत, दौरे या बहुत तेज़ बुखार हो तो तुरंत नज़दीकी अस्पताल जाएं।',
  },
};
export function cityGuide({ slug, specTitle, cityName, doctors, nearby = [], conditions = [], lang = 'en' }) {
  const all = [...doctors, ...nearby.flatMap((n) => n.doctors)];
  const f = cityFacts(all);
  const areas = [cityName, ...nearby.filter((x) => x.doctors.length).map((x) => x.cityName)];
  const items = [];
  if (lang === 'hi') {
    if (f.feeMin != null) items.push(`यहां ProMedicoz पर फ़ीस: ${feeText(f)} प्रति परामर्श। पैसे सीधे डॉक्टर को, कोई कमीशन नहीं।`);
    if (f.modes.length) items.push(`${modesText(f.modes, 'hi')} पर परामर्श (${areas.join(', ')})।`);
    if (conditions.length) items.push(`इनके लिए दिखाएं: ${conditions.slice(0, 6).join(', ')}।`);
    if (f.langs.length) items.push(`डॉक्टर बोलते हैं: ${f.langs.join(', ')}।`);
  } else {
    if (f.feeMin != null) items.push(`Fees on ProMedicoz here: ${feeText(f)} per consultation, paid directly to the doctor (no commission).`);
    if (f.modes.length) items.push(`Consult by ${modesText(f.modes)} (${areas.join(', ')}).`);
    if (conditions.length) items.push(`See one for: ${conditions.slice(0, 6).join(', ')}.`);
    if (f.langs.length) items.push(`Doctors speak: ${f.langs.join(', ')}.`);
  }
  const flag = RED_FLAGS[slug] && RED_FLAGS[slug][lang];
  return {
    title: lang === 'hi' ? `${cityName} में ${specTitle} को दिखाना` : `Seeing a ${specTitle.toLowerCase()} in ${cityName}`,
    items,
    redFlag: flag || '',
  };
}

// City-specific questions, answered only from real profile data.
export function cityFaqs({ specTitle, cityName, doctors, nearby = [], lang = 'en' }) {
  const all = [...doctors, ...nearby.flatMap((n) => n.doctors)];
  const f = cityFacts(all);
  const names = doctors.map((d) => formatDoctorName(d.name));
  const nearbyNames = nearby.flatMap((n) => n.doctors.map((d) => `${formatDoctorName(d.name)} (${n.cityName})`));
  const spec = specTitle.toLowerCase();
  const remoteModes = f.modes.filter((m) => m !== 'in-person');
  const remoteCount = all.filter((d) => (d.consultationModes || []).some((m) => m !== 'in-person')).length;
  const out = [];
  if (lang === 'hi') {
    if (names.length) out.push({ q: `${cityName} में कौन से ${specTitle} ऑनलाइन बुक कर सकते हैं?`, a: `ProMedicoz पर ${cityName} में: ${names.join(', ')}।${nearbyNames.length ? ` आस-पास: ${nearbyNames.join(', ')}।` : ''} प्रोफ़ाइल पर योग्यता, अनुभव, फ़ीस और समय देखें और सीधे बुक करें।` });
    if (f.feeMin != null) out.push({ q: `${cityName} में ${specTitle} की फ़ीस कितनी है?`, a: `ProMedicoz पर ${cityName} और आस-पास ${feeText(f)} प्रति परामर्श। फ़ीस हर डॉक्टर की प्रोफ़ाइल पर लिखी है और सीधे डॉक्टर को दी जाती है।` });
    if (remoteCount) out.push({ q: `क्या ${cityName} से फ़ोन या वीडियो पर परामर्श हो सकता है?`, a: `हां, यहां ${remoteCount} डॉक्टर ${modesText(remoteModes, 'hi')} पर परामर्श देते हैं — घर बैठे बात करें, ज़रूरत हो तो क्लिनिक जाएं।` });
    return out;
  }
  if (names.length) out.push({ q: `Which ${spec}s in ${cityName} can I book online?`, a: `On ProMedicoz in ${cityName}: ${names.join(', ')}.${nearbyNames.length ? ` Nearby: ${nearbyNames.join(', ')}.` : ''} Each profile shows qualification, experience, fee and timings, and you can book directly.` });
  if (f.feeMin != null) out.push({ q: `What is the ${spec} consultation fee in ${cityName}?`, a: `On ProMedicoz, ${spec}s in and around ${cityName} charge ${feeText(f)} per consultation. The fee is shown on each doctor's profile and paid directly to the doctor.` });
  if (remoteCount) out.push({ q: `Can I consult a ${spec} from ${cityName} by phone or video?`, a: `Yes. ${remoteCount === 1 ? '1 doctor here offers' : `${remoteCount} doctors here offer`} ${modesText(remoteModes)} consultations, so you can talk from home and visit the clinic only if needed.` });
  return out;
}
