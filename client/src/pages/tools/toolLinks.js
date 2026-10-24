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

export const REPORT_PATH = '/tools/blood-report';
export const reportPath = (lang) => (lang === 'hi' ? `${REPORT_PATH}/hi` : REPORT_PATH);

// Lab-test articles that show the "Understand your report" card.
export const REPORT_ARTICLE_SLUGS = new Set([
  'understanding-blood-test-report-cbc-guide',
  'blood-tests-explained-which-test-for-what-guide',
  'iron-deficiency-anaemia-women-guide',
  'anaemia-tiredness-weakness-causes-guide',
  'thyroid-explained-hypo-hyper-guide',
  'diabetes-tests-hba1c-fasting-sugar-explained-guide',
  'prediabetes-warning-stage-reverse-guide',
  'silent-signs-high-blood-sugar',
  'diabetes-thyroid-endocrinologist',
  'vitamin-d-deficiency-india-guide',
  'vitamin-b12-deficiency-symptoms-causes-guide',
  'dengue-mosquito-fever-warning-signs-guide',
]);

export const VACCINE_PATH = '/tools/vaccination-schedule';
export const vaccinePath = (lang) => (lang === 'hi' ? `${VACCINE_PATH}/hi` : VACCINE_PATH);

// Baby / child-health articles that show the "Baby's vaccine dates" card.
export const BABY_ARTICLE_SLUGS = new Set([
  'childhood-vaccines-schedule-why-they-matter-guide',
  'new-parent-baby-first-year-health-guide',
  'newborn-baby-common-concerns-guide',
  'newborn-jaundice-yellow-baby-when-to-worry-guide',
  'teething-in-babies-signs-soothing-what-to-avoid-guide',
  'fever-in-children-when-to-worry-guide',
  'child-sick-when-to-see-pediatrician',
  'diarrhoea-vomiting-in-children-ors-care-guide',
  'measles-khasra-children-symptoms-vaccine-guide',
  'mumps-swollen-cheeks-jaw-children-vaccine-guide',
  'whooping-cough-pertussis-severe-cough-babies-vaccine-guide',
]);

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

// Does it look like a baby-vaccine search? Used for the vaccine suggestion.
export const isVaccineQuery = matches([
  'vaccin', 'vacin', 'vaccen', 'immuniz', 'immunis', 'teeka', 'teeke', 'tikakaran', 'teekakaran',
  'tika kab', 'tika lag', 'tike lag', 'bcg', 'polio', 'pentavalent', 'rotavirus',
  'टीका', 'टीके', 'टीकाकरण', 'वैक्सीन', 'पोलियो',
]);

// Does it look like a lab-report search? Used for the Report Samjhao suggestion.
export const isReportQuery = matches([
  'report', 'cbc', 'blood test', 'haemoglobin', 'hemoglobin', 'hb level', 'platelet', 'wbc',
  'tsh', 'thyroid test', 'thyroid report', 'hba1c', 'a1c', 'sugar test', 'sugar report', 'fasting sugar',
  'vitamin d', 'vit d', 'b12', 'lab test', 'samjhao',
  'रिपोर्ट', 'खून की जांच', 'हीमोग्लोबिन', 'प्लेटलेट', 'शुगर टेस्ट', 'थायराइड',
]);
