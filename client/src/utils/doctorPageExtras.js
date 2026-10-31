// ============================================
// Doctor page: extra, factual content (for patients AND Google)
// ============================================
// Doctor pages are the ones that should rank for "gynaecologist in Bhilai",
// but had only 50–67 words. This builds more from what we already know —
// the doctor's own profile, their hours, and our specialty pages — never
// anything invented. Used by BOTH DoctorProfile.jsx (what people see) and
// scripts/prerender.mjs (what Google reads first), so the two always match
// (text only in the hidden crawler copy could count as hidden text).
// Tests: tests/doctorPageExtras.test.mjs

import { specializationData, specializationHi } from '../pages/specializationData.js';
import { hoursSummary, modesText } from './cityPage.js';
import { formatDoctorName } from './formatName.js';
import { cleanCity } from './doctorSeo.js';

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// Doctor's own specialty text → our specialty page. Doctors type it freely
// ("Obstetrician and gynaecologist", "Gyanecologist", "INTERNAL MEDICINE").
// Unclear combinations ("Anesthesiology and physician") get no page.
const SLUG_RULES = [
  [/gyn|gyan|obst/i, 'gynaecologist'],
  [/p(a)?ediatr|neonat/i, 'pediatrician'],
  [/neurolog/i, 'neurologist'],
  [/cardio/i, 'cardiologist'],
  [/dermat|skin/i, 'dermatologist'],
  [/physio/i, 'physiotherapist'],
  [/psychiat/i, 'psychiatrist'],
  [/ortho/i, 'orthopedic'],
  [/dent/i, 'dentist'],
  [/\bent\b|otolaryng|ear,? nose/i, 'ent-specialist'],
  [/microbio/i, 'microbiologist'],
  [/gastro/i, 'gastroenterologist'],
  [/pulmo/i, 'pulmonologist'],
  [/endocrin|diabetolog/i, 'endocrinologist'],
  [/ophthal/i, 'ophthalmologist'],
  [/urolog/i, 'urologist'],
  [/nephro/i, 'nephrologist'],
  [/^(internal medicine|general physician|physician|general medicine|family medicine|family physician)$/i, 'general-physician'],
];
export function specialtySlugFor(spec) {
  const s = clean(spec);
  if (!s) return null;
  const hit = SLUG_RULES.find(([re]) => re.test(s));
  return hit && specializationData[hit[1]] ? hit[1] : null;
}

const MODES_EN = { 'in-person': 'in person at the clinic', video: 'on video', phone: 'on phone' };
const listEn = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const article = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
// The doctor's specialty as a person: "Gynaecologist" stays; a subject
// ("Microbiology", "INTERNAL MEDICINE") becomes "Microbiology specialist".
// ALL-CAPS text is tidied. Hindi: subject → "<subject> विशेषज्ञ".
const tidy = (s) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s);
const isPerson = (s) => /(ist|ian|er|or|eon|ian)s?\b[^,]*$/i.test(s.split(/[,(]/)[0].trim()) || /ist|ian|surgeon|physician/i.test(s);
const asPerson = (s, hi) => (isPerson(s) ? s : hi ? `${s} विशेषज्ञ` : `${s} specialist`);

// Everything the page/crawler copy needs, in English or Hindi.
export function doctorExtras(d, lang = 'en') {
  d = d || {};
  const hi = lang === 'hi';
  const name = formatDoctorName(d.name);
  const spec = tidy(clean(d.specialization));
  const city = cleanCity(d.city);
  const fee = Number(d.consultationFee) > 0 ? Number(d.consultationFee) : 0;
  const exp = Number(d.experience) > 0 ? Number(d.experience) : 0;
  const qual = clean(d.qualification);
  const modes = (Array.isArray(d.consultationModes) ? d.consultationModes : []).filter((m) => MODES_EN[m]);
  const online = modes.filter((m) => m !== 'in-person');
  const langs = (Array.isArray(d.languagesSpoken) ? d.languagesSpoken : []).map(clean).filter(Boolean);
  const hours = hoursSummary(d.availability, hi ? 'hi' : 'en');
  const slug = specialtySlugFor(spec);
  const sd = slug ? specializationData[slug] : null;
  const sh = slug && hi ? specializationHi[slug] : null;
  const address = clean(d.clinicAddress);
  const hasBio = clean(d.bio).length >= 40;

  // About — only when the doctor hasn't written a real bio.
  let about = '';
  if (!hasBio && spec) {
    if (hi) {
      about = [
        `${name}${city ? ` ${city} में` : ''} ${asPerson(spec, true)} हैं${exp ? ` और उन्हें ${exp} साल का अनुभव है` : ''}${qual ? ` (${qual})` : ''}।`,
        modes.length ? `${modesText(modes, 'hi')} पर परामर्श देते हैं${langs.length ? `; ${langs.join(', ')} में बात कर सकते हैं` : ''}।` : '',
        fee ? `परामर्श फ़ीस Rs. ${fee}, सीधे डॉक्टर को।` : '',
      ].filter(Boolean).join(' ');
    } else {
      about = [
        `${name} is ${article(asPerson(spec))} ${asPerson(spec)}${city ? ` in ${city}` : ''}${exp ? ` with ${exp} years of experience` : ''}${qual ? ` (${qual})` : ''}.`,
        modes.length ? `Consults ${listEn(modes.map((m) => MODES_EN[m]))}${langs.length ? `, in ${listEn(langs)}` : ''}.` : '',
        fee ? `Consultation fee: Rs. ${fee}, paid directly to the doctor.` : '',
      ].filter(Boolean).join(' ');
    }
  }

  // Common reasons people see this kind of specialist (what the specialty
  // covers — not a promise about this doctor).
  const reasons = (sh && Array.isArray(sh.conditions) ? sh.conditions : sd ? sd.conditions : []) || [];
  const reasonsTitle = sd
    ? (hi ? `${sd.title} से इन कारणों से मिलते हैं` : `Common reasons to see ${article(sd.title)} ${sd.title}`)
    : '';

  // Questions patients ask — every answer from the doctor's own details.
  const faqs = [];
  if (hi) {
    if (fee) faqs.push({ q: `${name} की परामर्श फ़ीस कितनी है?`, a: `Rs. ${fee}। फ़ीस सीधे डॉक्टर को दी जाती है (ProMedicoz कोई कमीशन नहीं लेता)। डॉक्टर के बुकिंग कन्फ़र्म करने के बाद भुगतान करें।` });
    if (modes.length) faqs.push(online.length
      ? { q: `क्या ${name} से ऑनलाइन परामर्श ले सकते हैं?`, a: `हाँ — ${name} ${modesText(modes, 'hi')} पर परामर्श देते हैं। वीडियो/फ़ोन परामर्श ProMedicoz में ही होता है, कोई ऐप डाउनलोड नहीं करना पड़ता।` }
      : { q: `क्या ${name} से ऑनलाइन परामर्श ले सकते हैं?`, a: `${name} क्लिनिक पर मरीज़ देखते हैं${city ? ` (${city})` : ''}। ऑनलाइन बुक करके क्लिनिक जाएं।` });
    if (langs.length) faqs.push({ q: `${name} किन भाषाओं में बात करते हैं?`, a: `${langs.join(', ')}।` });
    if (address) faqs.push({ q: `${name} का क्लिनिक कहाँ है?`, a: `${address}${city && !address.toLowerCase().includes(city.toLowerCase()) ? `, ${city}` : ''}।` });
    if (hours) faqs.push({ q: `${name} कब उपलब्ध हैं?`, a: `${hours}। खाली समय इसी पेज पर दिखता है।` });
    faqs.push({ q: `${name} से अपॉइंटमेंट कैसे बुक करें?`, a: 'इसी पेज पर दिन और समय चुनें और बुक करें। डॉक्टर कन्फ़र्म करते हैं, फिर UPI से सीधे डॉक्टर को भुगतान करें।' });
  } else {
    if (fee) faqs.push({ q: `What is ${name}'s consultation fee?`, a: `Rs. ${fee}. The fee is paid directly to the doctor (ProMedicoz takes no commission). You pay after the doctor confirms your booking.` });
    if (modes.length) faqs.push(online.length
      ? { q: `Can I consult ${name} online?`, a: `Yes — ${name} consults ${listEn(modes.map((m) => MODES_EN[m]))}. Video and phone consultations happen inside ProMedicoz; there's no app to download.` }
      : { q: `Can I consult ${name} online?`, a: `${name} sees patients in person at the clinic${city ? ` in ${city}` : ''}. You can book the visit online.` });
    if (langs.length) faqs.push({ q: `Which languages does ${name} speak?`, a: `${listEn(langs)}.` });
    if (address) faqs.push({ q: `Where is ${name}'s clinic?`, a: `${address}${city && !address.toLowerCase().includes(city.toLowerCase()) ? `, ${city}` : ''}.` });
    if (hours) faqs.push({ q: `When is ${name} available?`, a: `${hours}. Free times are shown on this page.` });
    faqs.push({ q: `How do I book an appointment with ${name}?`, a: 'Pick a day and time on this page and tap Book. The doctor confirms, then you pay the doctor directly by UPI.' });
  }

  return {
    name, about, hours, reasons, reasonsTitle, faqs,
    specSlug: slug, specTitle: sd ? sd.title : '', specialtyArticlesKey: sd ? sd.title : '',
  };
}
