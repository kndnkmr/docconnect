// ============================================
// Specialization synonyms
// ============================================
// Doctors type their specialization as free text, so equivalent specialties
// get worded differently — most commonly "Internal Medicine" (and "GP",
// "Family Medicine") for what patients search as "General Physician". Because
// doctor search is a plain substring match on the specialization string, an
// "Internal Medicine" doctor would never surface for a "General Physician"
// search even though they treat the same everyday problems (fever, body pain,
// thyroid, arthritis, etc.).
//
// This maps a searched term to the FULL set of equivalent terms, so the
// backend can match any of them. Editing this one list fixes every search
// path at once (home symptom search, the specialization tiles, the doctor-list
// filter, and the /specialization/:slug pages all funnel through the same
// backend specialization filter).
//
// Each inner array is a group of interchangeable terms. Matching is
// case-insensitive and substring-based (same as the existing search), so
// "General Physician" already catches "General Physician / Diabetologist" etc.

const SYNONYM_GROUPS = [
  // General/family medicine — the big one the owner hit.
  ['General Physician', 'Internal Medicine', 'Internal Medicine Specialist',
   'Physician', 'General Medicine', 'Family Medicine', 'Family Physician', 'GP'],

  // Lab/infection specialty — doctors write either the person ("Microbiologist")
  // or the field ("Microbiology"); substring search wouldn't otherwise match
  // one against the other. This is a LAB specialty, kept separate from clinical
  // GP care on purpose (a microbiologist is not a substitute general physician).
  ['Microbiologist', 'Microbiology'],
];

// Given a searched specialization term, return the list of equivalent terms
// (including the original). If the term isn't part of any synonym group, just
// returns [term] so behaviour is unchanged for everything else.
const getSpecializationSynonyms = (term) => {
  if (!term) return [];
  const norm = String(term).trim().toLowerCase();
  for (const group of SYNONYM_GROUPS) {
    if (group.some((t) => t.toLowerCase() === norm)) {
      return group;
    }
  }
  return [term];
};

module.exports = { getSpecializationSynonyms, SYNONYM_GROUPS };
