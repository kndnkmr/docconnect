// ============================================
// Specialty counts: same matching as the doctor list
// ============================================
const { test } = require('node:test');
const assert = require('node:assert');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const { countBySpecialty, SPECIALTY_NAMES } = require('../utils/specialtyCounts');

const rows = [
  { specialization: 'Obstetrician and Gynaecologist', count: 3 },
  { specialization: 'Gynecologist', count: 2 },
  { specialization: 'gyanecologist', count: 1 },
  { specialization: 'INTERNAL MEDICINE', count: 2 },
  { specialization: 'General Physician', count: 2 },
  { specialization: 'Neurologist', count: 2 },
  { specialization: 'Paediatrician', count: 1 },
  { specialization: 'Pediatrician', count: 1 },
  { specialization: 'Microbiology', count: 1 },
  { specialization: '', count: 4 },
  { specialization: null, count: 1 },
];

test('synonyms and spellings count towards the specialty (like the list)', () => {
  const c = countBySpecialty(rows);
  assert.strictEqual(c.Gynaecologist, 6);
  assert.strictEqual(c['General Physician'], 4);
  assert.strictEqual(c.Neurologist, 2);
  assert.strictEqual(c.Microbiologist, 1);
  // "Pediatrician" is a contains-match, so "Paediatrician" isn't counted —
  // exactly what the doctor list would show for ?specialization=Pediatrician.
  assert.strictEqual(c.Pediatrician, 1);
});

test('specialties without doctors are 0, every known name is present', () => {
  const c = countBySpecialty(rows);
  assert.strictEqual(c.Dermatologist, 0);
  assert.strictEqual(c.Cardiologist, 0);
  assert.deepStrictEqual(Object.keys(c).sort(), [...SPECIALTY_NAMES].sort());
  assert.deepStrictEqual(countBySpecialty([]).Gynaecologist, 0);
});

test('/specialty-counts is routed before /:id (not read as a doctor id)', () => {
  const router = require('../routes/doctor');
  const paths = router.stack.filter((l) => l.route).map((l) => l.route.path);
  assert.ok(paths.includes('/specialty-counts'));
  assert.ok(paths.indexOf('/specialty-counts') < paths.indexOf('/:id'));
});
