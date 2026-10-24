// ============================================
// Where to surface the due-date calculator
// ============================================
// Kept tiny and separate from dueDate.js (which carries all the tool's copy) so
// that Home / BlogArticle / SpecializationPage can import this without pulling
// the tool's text into their bundles.

export const DUE_DATE_PATH = '/tools/due-date-calculator';
export const dueDatePath = (lang) => (lang === 'hi' ? `${DUE_DATE_PATH}/hi` : DUE_DATE_PATH);

// Pregnancy articles that show the "Pregnant? Find your due date" card.
export const PREGNANCY_ARTICLE_SLUGS = new Set([
  'early-pregnancy-signs-first-trimester-care-guide',
  'pregnancy-diet-nutrition-trimester-guide',
  'pregnancy-scans-ultrasound-what-to-expect-guide',
  'antenatal-care-pregnancy-checkups-what-to-expect-guide',
  'vaccines-in-pregnancy-what-is-recommended-guide',
  'gestational-diabetes-pregnancy-sugar-guide',
  'trying-to-conceive-fertility-basics-guide',
  'when-to-visit-a-gynaecologist',
]);

// Does a home-search query look pregnancy-related? (English, Hinglish incl.
// common misspellings, and Devanagari.) Used to show the due-date suggestion.
const PREGNANCY_TERMS = [
  'pregnan', 'pregnen', 'pregnent', 'pragnan', 'garbh', 'due date', 'conceiv',
  'period late', 'periods late', 'period miss', 'missed period', 'period nahi aaya',
  'periods nahi aaye', 'mahina nahi aaya', 'mahwari nahi', 'baby plan',
  'गर्भ', 'प्रेग्नेंसी', 'प्रेगनेंसी', 'पीरियड नहीं', 'माहवारी नहीं', 'महीना नहीं आया',
];
export function isPregnancyQuery(text) {
  const q = String(text || '').toLowerCase();
  return q.length > 2 && PREGNANCY_TERMS.some((t) => q.includes(t));
}
