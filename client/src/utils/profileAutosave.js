// ============================================
// Doctor profile autosave helpers (pure, tested in tests/profileAutosave.test.mjs)
// ============================================
// The profile saves itself to the server ~1s after the doctor stops typing.
// Only changed fields are sent. A field with an obvious problem (e.g. a
// 9-digit phone) is shown inline and held back until fixed; the rest save.
// Same rules as the server (server/controllers/doctorController.js).

// Saved by their own upload buttons, never by autosave.
const NOT_AUTOSAVED = new Set(['profilePhoto', 'upiQrCode']);

// What a doctor needs before patients can book them (same list as the
// onboarding checklist).
export const PROFILE_REQUIRED = [
  { key: 'specialization', label: 'specialization' },
  { key: 'qualification', label: 'qualification' },
  { key: 'medicalRegistrationNo', label: 'registration no.' },
  { key: 'experience', label: 'experience' },
  { key: 'consultationFee', label: 'fee' },
  { key: 'clinicAddress', label: 'clinic address' },
  { key: 'city', label: 'city' },
  { key: 'phone', label: 'phone' },
];

const same = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');

// Fields in `current` that differ from what the server has (`saved`).
export function diffProfile(current, saved) {
  const out = {};
  for (const k of Object.keys(current || {})) {
    if (NOT_AUTOSAVED.has(k)) continue;
    if (!same(current[k], saved ? saved[k] : undefined)) out[k] = current[k];
  }
  return out;
}

const digits = (v) => String(v || '').replace(/\D/g, '');
const isIndianMobile = (v) => {
  let d = digits(v);
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d);
};

// { field: message } for changed fields that can't be saved as typed.
export function profileProblems(changes) {
  const p = {};
  if ('phone' in changes) {
    if (!String(changes.phone || '').trim()) p.phone = 'Phone is needed (patients and ProMedicoz use it to reach you).';
    else if (!isIndianMobile(changes.phone)) p.phone = 'Enter a 10-digit Indian mobile number (starting 6-9).';
  }
  if ('whatsappNumber' in changes && String(changes.whatsappNumber || '').trim() && !isIndianMobile(changes.whatsappNumber)) {
    p.whatsappNumber = 'Enter a 10-digit mobile number, or leave it empty.';
  }
  if ('consultationFee' in changes && changes.consultationFee !== '') {
    const n = Number(changes.consultationFee);
    if (!Number.isFinite(n) || n < 0 || n > 100000) p.consultationFee = 'Fee must be between 0 and 100000.';
  }
  if ('experience' in changes && changes.experience !== '') {
    const n = Number(changes.experience);
    if (!Number.isFinite(n) || n < 0 || n > 70) p.experience = 'Experience must be between 0 and 70 years.';
  }
  if ('googleMapsLink' in changes) {
    const v = String(changes.googleMapsLink || '').trim();
    if (v && /^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https?:\/\//i.test(v)) p.googleMapsLink = 'Paste a link starting with https://';
  }
  return p;
}

// Empty number fields are sent as null (so "cleared" means cleared, not 0
// or a cast error); everything else as typed.
export function payloadFor(changes) {
  const out = { ...changes };
  for (const k of ['experience', 'consultationFee']) if (out[k] === '') out[k] = null;
  return out;
}

// { done, total, missing: [labels] } for the "5 of 8 done" line.
export function profileProgress(data) {
  const missing = PROFILE_REQUIRED.filter((f) => !String(data?.[f.key] ?? '').trim()).map((f) => f.label);
  return { done: PROFILE_REQUIRED.length - missing.length, total: PROFILE_REQUIRED.length, missing };
}
