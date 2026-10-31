// ============================================
// How many live doctors each specialty has
// ============================================
// Powers "specialties with doctors first" on the website: the home page,
// filter chips and empty pages ask GET /api/doctors/specialty-counts and
// show specialties that have doctors first (others as "Coming soon").
//
// Counting uses EXACTLY the same matching as the doctor list
// (getAllDoctors): the specialty name and its synonyms, as a
// case-insensitive "contains" match on the doctor's own specialty text.
// So a count of 0 here means the list for that specialty would be empty,
// and a count > 0 means tapping it shows doctors.
const { getSpecializationSynonyms } = require('./specializationSynonyms');
const { safeContainsRegex } = require('./queryHelpers');

// Every specialty name the website links to or suggests.
const SPECIALTY_NAMES = [
  'Gynaecologist', 'General Physician', 'Neurologist', 'Pediatrician',
  'Dermatologist', 'Cardiologist', 'Orthopedic', 'Dentist', 'Ophthalmologist',
  'Psychiatrist', 'ENT Specialist', 'Gastroenterologist', 'Pulmonologist',
  'Urologist', 'Endocrinologist', 'Oncologist', 'Nephrologist', 'Rheumatologist',
  'Surgeon', 'Physiotherapist', 'Sexologist', 'Homeopathy', 'Ayurveda',
  'Dietitian', 'Microbiologist', 'Internal Medicine', 'Radiologist',
  'Anesthesiologist', 'Plastic Surgeon',
];

// rows: [{ specialization: 'Obstetrician and Gynaecologist', count: 3 }, …]
// (doctors grouped by their exact specialty text). Returns { name: count }.
function countBySpecialty(rows, names = SPECIALTY_NAMES) {
  const out = {};
  for (const name of names) {
    const tests = getSpecializationSynonyms(name).map((s) => safeContainsRegex(s));
    out[name] = rows.reduce((n, r) => (
      r && r.specialization && tests.some((re) => re.test(r.specialization)) ? n + (Number(r.count) || 0) : n
    ), 0);
  }
  return out;
}

module.exports = { countBySpecialty, SPECIALTY_NAMES };
