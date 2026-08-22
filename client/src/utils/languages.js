// ============================================
// Languages — single source of truth
// ============================================
// The master list of languages used across ProMedicoz. Kept here (frontend)
// on purpose so adding a language is a one-line change with no backend
// schema/migration — the doctor's `languagesSpoken` field is a plain string
// array and the doctor-search `?language=` filter matches by name.
//
// Two distinct uses share this list:
//   1. "Languages a doctor can consult in" — doctors pick from these in Edit
//      Profile; patients see them ("Speaks: ...") and can filter doctors by
//      them. (Feature 2 — live now.)
//   2. Patient UI language options — the language the patient reads the app
//      in. (Feature 1 — infrastructure to follow; not every language here has
//      a full UI translation yet.)
//
// `code`   — stable short id (used for the patient-UI language key + storage)
// `english`— English name (what we store in a doctor's languagesSpoken and
//            match on in search, so the data stays consistent/searchable)
// `native` — the language's own name, shown to users so they recognize it

export const LANGUAGES = [
  { code: 'en', english: 'English', native: 'English' },
  { code: 'hi', english: 'Hindi', native: 'हिंदी' },
  { code: 'bn', english: 'Bengali', native: 'বাংলা' },
  { code: 'te', english: 'Telugu', native: 'తెలుగు' },
  { code: 'or', english: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'kn', english: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ta', english: 'Tamil', native: 'தமிழ்' },
  { code: 'mr', english: 'Marathi', native: 'मराठी' },
  { code: 'gu', english: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'pa', english: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'ml', english: 'Malayalam', native: 'മലയാളം' },
];

// The names doctors choose from for "languages I can consult in". We store the
// English name (searchable, consistent) but show "English (native)" so a
// doctor recognizes it. e.g. { value: 'Bengali', label: 'Bengali (বাংলা)' }
export const SPOKEN_LANGUAGE_OPTIONS = LANGUAGES.map((l) => ({
  value: l.english,
  label: l.native === l.english ? l.english : `${l.english} (${l.native})`,
}));
