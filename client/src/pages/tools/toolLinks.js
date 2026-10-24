// ============================================
// Where to surface the free tools (due date + ovulation)
// ============================================
// Kept tiny and separate from dueDate.js / ovulation.js (which carry all the
// tools' copy) so that Home / BlogArticle / SpecializationPage can import this
// without pulling the tools' text into their bundles.

export const DUE_DATE_PATH = '/tools/due-date-calculator';
export const dueDatePath = (lang) => (lang === 'hi' ? `${DUE_DATE_PATH}/hi` : DUE_DATE_PATH);

export const OVULATION_PATH = '/tools/ovulation-calculator';
export const ovulationPath = (lang) => (lang === 'hi' ? `${OVULATION_PATH}/hi` : OVULATION_PATH);

// Pregnancy articles that show the "Pregnant? Find your due date" card.
export const PREGNANCY_ARTICLE_SLUGS = new Set([
  'early-pregnancy-signs-first-trimester-care-guide',
  'pregnancy-diet-nutrition-trimester-guide',
  'pregnancy-scans-ultrasound-what-to-expect-guide',
  'antenatal-care-pregnancy-checkups-what-to-expect-guide',
  'vaccines-in-pregnancy-what-is-recommended-guide',
  'gestational-diabetes-pregnancy-sugar-guide',
  'when-to-visit-a-gynaecologist',
]);

// Period / fertility articles that show the "Find your fertile days" card.
// (Deliberately not the puberty, menopause or contraception articles.)
export const CYCLE_ARTICLE_SLUGS = new Set([
  'trying-to-conceive-fertility-basics-guide',
  'irregular-periods-menstrual-cycle-basics-guide',
  'pcos-pcod-irregular-periods-guide',
  'pms-premenstrual-syndrome-symptoms-relief-guide',
  'painful-periods-cramps-relief-guide',
  'heavy-periods-menorrhagia-causes-relief-guide',
  'menstrual-hygiene-period-products-guide',
]);

const matches = (terms) => (text) => {
  const q = String(text || '').toLowerCase();
  return q.length > 2 && terms.some((t) => q.includes(t));
};

// Does a home-search query look pregnancy-related? (English, Hinglish incl.
// common misspellings, and Devanagari.) Used to show the due-date suggestion.
export const isPregnancyQuery = matches([
  'pregnan', 'pregnen', 'pregnent', 'pragnan', 'garbh', 'due date',
  'period late', 'periods late', 'period miss', 'missed period', 'period nahi aaya',
  'periods nahi aaye', 'mahina nahi aaya', 'mahwari nahi',
  'गर्भ', 'प्रेग्नेंसी', 'प्रेगनेंसी', 'पीरियड नहीं', 'माहवारी नहीं', 'महीना नहीं आया',
]);

// Does it look like cycle / fertility tracking? Used for the ovulation suggestion.
export const isCycleQuery = matches([
  'ovulat', 'ovulaton', 'fertile', 'fertility', 'conceiv', 'baby plan', 'trying for baby',
  'period kab', 'periods kab', 'next period', 'period date', 'period cycle', 'menstrual cycle',
  'irregular period', 'mahwari kab',
  'ओव्यूलेशन', 'पीरियड कब', 'अगला पीरियड', 'माहवारी कब',
]);
