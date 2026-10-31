// ============================================
// Specialties with doctors first (no "No doctors found" dead ends)
// ============================================
// The server tells us how many live doctors each specialty has
// (GET /api/doctors/specialty-counts — same matching as the doctor list).
// From that, everywhere we list specialties:
//   • specialties WITH doctors come first, most doctors first,
//   • the rest are "Coming soon" (still linked — their pages keep their
//     content — but never presented as bookable),
//   • a patient who lands on an empty specialty gets the closest specialty
//     that HAS doctors (e.g. Skin → General Physician).
// Nothing is hard-coded about which specialties have doctors: when the
// first Dermatologist goes live, Skin moves up by itself.
// While counts are unknown (first visit, offline, server slow) everything
// behaves exactly as before — nothing is hidden or greyed.
// Tests: tests/specialtyAvailability.test.mjs
import { specializationData } from '../pages/specializationData.js';

// Who can help when a specialty has no doctors yet, in order of preference.
// General Physician is the safe first stop for most everyday problems.
const GP = 'General Physician';
const FALLBACKS = {
  Dermatologist: [GP],
  'ENT Specialist': [GP],
  Pulmonologist: [GP],
  Gastroenterologist: [GP],
  Cardiologist: [GP],
  Urologist: [GP],
  Nephrologist: [GP],
  Ophthalmologist: [GP],
  Endocrinologist: [GP],
  Rheumatologist: [GP],
  Orthopedic: [GP],
  Physiotherapist: [GP],
  Oncologist: [GP],
  Surgeon: [GP],
  Dentist: [GP],
  Dietitian: [GP],
  Sexologist: [GP],
  Homeopathy: [GP],
  Ayurveda: [GP],
  Psychiatrist: [GP, 'Neurologist'],
  Neurologist: [GP],
  Pediatrician: [GP],
  Gynaecologist: [GP],
  'Internal Medicine': [GP],
  [GP]: ['Internal Medicine'],
};

const norm = (s) => String(s || '').trim().toLowerCase();

// Live doctor count for a specialty name (case-insensitive), or undefined
// when we don't know (no counts yet / a name the server doesn't count).
export function countFor(spec, counts) {
  if (!counts || !spec) return undefined;
  if (Object.prototype.hasOwnProperty.call(counts, spec)) return Number(counts[spec]) || 0;
  const key = Object.keys(counts).find((k) => norm(k) === norm(spec));
  return key === undefined ? undefined : Number(counts[key]) || 0;
}

// true = has doctors, false = known to have none, null = don't know.
export function hasDoctors(spec, counts) {
  const n = countFor(spec, counts);
  return n === undefined ? null : n > 0;
}

// Split a list into { live, soon }. live: has doctors (or unknown), most
// doctors first; ties keep the original order. soon: known to have none,
// original order. Without counts: { live: items, soon: [] } (unchanged).
export function splitByDoctors(items, counts, specOf = (x) => x) {
  if (!counts) return { live: [...items], soon: [] };
  const live = [];
  const soon = [];
  items.forEach((item, i) => {
    const n = countFor(specOf(item), counts);
    if (n === 0) soon.push(item);
    else live.push({ item, i, n: n === undefined ? -1 : n });
  });
  live.sort((a, b) => (b.n - a.n) || (a.i - b.i));
  return { live: live.map((x) => x.item), soon };
}

// Same order as splitByDoctors, as one list (live first, then soon).
export function orderByDoctors(items, counts, specOf) {
  const { live, soon } = splitByDoctors(items, counts, specOf);
  return [...live, ...soon];
}

// The specialty to offer instead of an empty one, or null when none is
// needed (it has doctors) or none is known. Never returns the same name.
// A name the server doesn't count (free text like "cardio") still gets one —
// callers only ask after the list came back empty.
export function fallbackFor(spec, counts) {
  if (!counts) return null;
  if ((countFor(spec, counts) || 0) > 0) return null;
  const tried = [...(FALLBACKS[spec] || []), GP];
  for (const alt of tried) {
    if (norm(alt) !== norm(spec) && (countFor(alt, counts) || 0) > 0) return alt;
  }
  // Last resort: whichever specialty has the most doctors.
  const best = Object.entries(counts)
    .filter(([k, n]) => Number(n) > 0 && norm(k) !== norm(spec))
    .sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}

// Specialty name → its /specialization/<slug> page (or null).
const SLUG_BY_TITLE = Object.fromEntries(
  Object.entries(specializationData).map(([slug, d]) => [norm(d.title), slug])
);
export function slugForName(spec) {
  return SLUG_BY_TITLE[norm(spec)] || null;
}
export function titleForSlug(slug) {
  return (specializationData[slug] && specializationData[slug].title) || null;
}

// Where to send a patient for a specialty: its page if we have one,
// otherwise the filtered doctor list.
export function specialtyHref(spec) {
  const slug = slugForName(spec);
  return slug ? `/specialization/${slug}` : `/doctors?specialization=${encodeURIComponent(spec)}`;
}

// "Dermatologist" → "Dermatologists", "Ayurveda" → "Ayurveda doctors".
export function pluralSpec(spec) {
  const s = String(spec || '').trim();
  return /(ist|ian|eon|er|or)$/i.test(s) ? `${s}s` : `${s} doctors`;
}

// Pre-filled WhatsApp "Notify me" message (we learn who to onboard next).
export function notifyMeText(spec, city) {
  return `Hi ProMedicoz, please tell me when a ${spec}${city ? ` in ${city}` : ''} joins.`;
}

// Saved copy of the counts (so a returning visitor sees the right order at
// once, before the network answers). Plain object; ignored after a week.
const KEY = 'pmz_spec_counts';
const MAX_AGE = 7 * 24 * 3600 * 1000;
export function readSavedCounts(storage, now = Date.now()) {
  try {
    const v = JSON.parse(storage.getItem(KEY) || 'null');
    if (v && v.counts && typeof v.counts === 'object' && now - Number(v.at) < MAX_AGE) return v.counts;
  } catch { /* ignore broken storage */ }
  return null;
}
export function saveCounts(storage, counts, now = Date.now()) {
  try { storage.setItem(KEY, JSON.stringify({ at: now, counts })); } catch { /* private mode */ }
}
