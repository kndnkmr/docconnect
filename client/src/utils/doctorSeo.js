// ============================================
// Doctor page: what Google sees (title, description, schema helpers)
// ============================================
// Used by BOTH the build (scripts/prerender.mjs → the HTML Google reads first)
// and the app (DoctorProfile's <SEO>), so the two can never disagree.
//
// Why: doctor pages used to send a Hindi <title> ("डॉ. Pooja Singh — स्त्री एवं
// प्रसूति रोग विशेषज्ञ · Bhilai"). People search in English ("best gynecologist
// in bhilai"), so the page didn't match. Search title/description are now
// English with BOTH spellings of the specialty; WhatsApp/social previews keep
// the Hindi text and card (og: tags, set separately in prerender).
// Guarded by tests/doctorSeo.test.mjs.

import { formatDoctorName } from './formatName.js';

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// Search-friendly specialty label. Doctors type their own specialty (with
// typos like "Gyanecologist"), so recognise the common ones and use the
// spelling people search with, plus the alternate spelling in brackets.
const SPECIALTY_RULES = [
  { re: /gyn|gyan|obst/i, label: 'Gynaecologist (Gynecologist)', schema: ['Gynecologic', 'Obstetric'], short: 'Gynaecologist' },
  { re: /p(a)?ediatr|neonat|child/i, label: 'Paediatrician (Pediatrician)', schema: ['Pediatric'], short: 'Paediatrician' },
  { re: /neurolog/i, label: 'Neurologist', schema: ['Neurologic'], short: 'Neurologist' },
  { re: /cardio/i, label: 'Cardiologist', schema: ['Cardiovascular'], short: 'Cardiologist' },
  { re: /dermat|skin/i, label: 'Dermatologist (Skin Specialist)', schema: ['Dermatologic'], short: 'Dermatologist' },
  { re: /physio/i, label: 'Physiotherapist', schema: ['PhysicalTherapy'], short: 'Physiotherapist' },
  { re: /psychiat/i, label: 'Psychiatrist', schema: ['Psychiatric'], short: 'Psychiatrist' },
  { re: /ortho/i, label: 'Orthopaedic Doctor (Orthopedic)', schema: ['Musculoskeletal'], short: 'Orthopaedic Doctor' },
  // Only clear general-practice wording; "Anesthesiology and physician" keeps
  // the doctor's own text instead of being relabelled.
  { re: /^(internal medicine|general physician|physician|general medicine)$/i, label: 'General Physician', schema: ['PrimaryCare'], short: 'General Physician' },
];

function ruleFor(spec) {
  const s = clean(spec);
  return SPECIALTY_RULES.find((r) => r.re.test(s)) || null;
}

const titleCase = (s) => clean(s).toLowerCase()
  .replace(/\b[a-z]/g, (c) => c.toUpperCase())
  .replace(/\b(And|Of|In|Or)\b/g, (w) => w.toLowerCase());

export function specialtySearchLabel(spec) {
  const r = ruleFor(spec);
  return r ? r.label : (titleCase(spec) || 'Doctor');
}

// schema.org MedicalSpecialty values (only well-known ones; else none).
export function specialtySchema(spec) {
  const r = ruleFor(spec);
  return r ? r.schema : [];
}

export const cleanCity = (city) => titleCase(city);

// "Dr. Pooja Singh – Gynaecologist (Gynecologist) in Bhilai"
// (SEO/prerender add " | ProMedicoz").
export function doctorSearchTitle(d) {
  const name = formatDoctorName(d && d.name);
  const city = cleanCity(d && d.city);
  return `${name} – ${specialtySearchLabel(d && d.specialization)}${city ? ` in ${city}` : ''}`;
}

const MODE_WORDS = { 'in-person': 'in-clinic', video: 'video', phone: 'phone' };

// One factual English sentence set, from the doctor's own profile only.
export function doctorSearchDescription(d) {
  d = d || {};
  const name = formatDoctorName(d.name);
  const spec = clean(d.specialization) || 'Doctor';
  const city = cleanCity(d.city);
  const bits = [clean(d.qualification), Number(d.experience) > 0 ? `${d.experience} yrs experience` : ''].filter(Boolean);
  const modes = (Array.isArray(d.consultationModes) ? d.consultationModes : [])
    .map((m) => MODE_WORDS[m]).filter(Boolean);
  const modeText = modes.length
    ? `${modes.length > 1 ? `${modes.slice(0, -1).join(', ')} or ${modes[modes.length - 1]}` : modes[0]} consultation`
    : 'consultation';
  const parts = [
    `${name}, ${spec}${city ? ` in ${city}` : ''}${bits.length ? ` (${bits.join(', ')})` : ''}.`,
    `Book ${modeText} online on ProMedicoz.`,
    Number(d.consultationFee) > 0 ? `Fee Rs. ${d.consultationFee}.` : '',
    Array.isArray(d.languagesSpoken) && d.languagesSpoken.length ? `Speaks ${d.languagesSpoken.join(', ')}.` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

// Weekly hours for schema.org openingHoursSpecification, from the doctor's
// availability ([{ day: 'Monday', startTime: '09:00', endTime: '21:00' }]).
export function openingHours(availability) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return (Array.isArray(availability) ? availability : [])
    .filter((a) => a && days.includes(a.day) && /^\d{2}:\d{2}$/.test(a.startTime || '') && /^\d{2}:\d{2}$/.test(a.endTime || ''))
    .map((a) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${a.day}`, opens: a.startTime, closes: a.endTime }));
}

// Twin / neighbouring cities, so a city page can also show doctors close by
// ("Bhilai" patients also go to Durg, and vice versa). Lower-case slugs.
export const NEARBY_CITIES = {
  bhilai: ['durg', 'raipur'],
  durg: ['bhilai', 'raipur'],
  raipur: ['bhilai', 'durg'],
  dehradun: ['rishikesh'],
  rishikesh: ['dehradun'],
  delhi: ['new-delhi'],
  'new-delhi': ['delhi'],
};

// Physician structured data for the doctor page. aggregateRating is included
// only when the doctor has real in-app reviews (never invented).
export function doctorJsonLd(d, SITE = "https://www.promedicoz.in") {
  const name = formatDoctorName(d.name);
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    '@id': `${SITE}/dr/${d.slug}#physician`,
    name,
    url: `${SITE}/dr/${d.slug}`,
    // schema.org specialty values (e.g. Gynecologic + Obstetric) when we
    // recognise the doctor's specialty; otherwise their own text.
    medicalSpecialty: (() => {
      const s = specialtySchema(d.specialization);
      if (s.length) return s.map((v) => `https://schema.org/${v}`);
      return (d.specialization || '').replace(/\s+/g, ' ').trim() || undefined;
    })(),
    description: d.bio || undefined,
    image: d.profilePhoto && String(d.profilePhoto).startsWith('http') ? d.profilePhoto : undefined,
    // Same public fields the profile page already shows (clinic address +
    // city). No phone/UPI here.
    address: d.city ? {
      '@type': 'PostalAddress',
      streetAddress: d.clinicAddress ? String(d.clinicAddress).replace(/\s+/g, ' ').trim() : undefined,
      addressLocality: cleanCity(d.city),
      addressCountry: 'IN',
    } : undefined,
    hasMap: /^https:\/\//.test(d.googleMapsLink || '') ? d.googleMapsLink : undefined,
    // The city plus its twin/neighbouring cities (Bhilai ↔ Durg ↔ Raipur).
    areaServed: d.city ? [cleanCity(d.city), ...(NEARBY_CITIES[String(d.city).trim().toLowerCase().replace(/\s+/g, '-')] || []).map((c) => cleanCity(c.replace(/-/g, ' ')))]
      .map((name) => ({ '@type': 'City', name })) : undefined,
    openingHoursSpecification: openingHours(d.availability).length ? openingHours(d.availability) : undefined,
    isAcceptingNewPatients: true,
    priceRange: Number(d.consultationFee) > 0 ? `Rs. ${d.consultationFee}` : undefined,
    knowsLanguage: Array.isArray(d.languagesSpoken) && d.languagesSpoken.length ? d.languagesSpoken : undefined,
  };
  const rating = d.rating || {};
  if (Number(rating.count) > 0 && Number(rating.average) > 0) {
    obj.aggregateRating = { '@type': 'AggregateRating', ratingValue: rating.average, reviewCount: rating.count, bestRating: 5 };
  }
  // Drop undefined keys for a clean payload.
  return JSON.parse(JSON.stringify(obj));
}

