// ============================================
// Internal link map — auto-link key topics between articles
// ============================================
// WHY: Internal links between related articles are one of the strongest, most
// mechanical SEO wins for a content site. They help Google discover and
// understand the whole blog as a connected resource (spreading "authority"
// across pages), and they keep readers moving from article to article instead
// of bouncing after one. The articles already reference each other in prose
// ("see our guide on dengue") — this turns those mentions into real links,
// automatically, without hand-editing 200+ articles.
//
// HOW IT'S USED: BlogArticle's text renderer scans body text for the phrases
// below and turns the FIRST occurrence of each target (that isn't the current
// article) into a link to that article. See linkifyText() in BlogArticle.jsx.
//
// SAFETY / QUALITY RULES (enforced by the renderer, not here):
//   - Never links a phrase to the article you're already on (no self-links).
//   - Links only the FIRST occurrence of each target per article (no spammy
//     repeated links).
//   - Matches whole words only, case-insensitive.
//   - Phrases are hand-curated and specific, so they map unambiguously to one
//     article. We deliberately keep the list conservative — better to miss a
//     link than to create a wrong or confusing one.
//
// MAINTAINING: add an entry as `'phrase': 'slug'`. Longer/more-specific phrases
// are matched first (the renderer sorts by length), so 'high blood pressure'
// wins over a shorter overlapping phrase. Keep phrases distinctive enough that
// they almost always mean the linked topic.

// Map of lowercase phrase -> target article slug.
// One slug can have several phrasings (e.g. "high bp" and "high blood pressure").
export const INTERNAL_LINKS = {
  // Heart & BP
  'high blood pressure': 'high-bp-the-silent-killer',
  'high bp': 'high-bp-the-silent-killer',
  'blood pressure readings': 'understanding-blood-pressure-readings-numbers-guide',
  'heart attack': 'heart-attack-warning-signs',
  'cholesterol': 'cholesterol-explained-good-bad-guide',
  'heart palpitations': 'heart-palpitations-racing-heart-guide',
  'heart disease': 'healthy-heart-preventing-heart-disease-guide',

  // Diabetes & metabolic
  'high blood sugar': 'silent-signs-high-blood-sugar',
  'diabetes diet': 'diabetes-diet-what-to-eat-avoid-guide',
  'hba1c': 'diabetes-tests-hba1c-fasting-sugar-explained-guide',
  'fatty liver': 'fatty-liver-silent-rising-problem-guide',
  'belly fat': 'belly-fat-metabolic-health-india',
  'thyroid': 'thyroid-explained-hypo-hyper-guide',

  // Infections / fever
  'dengue': 'dengue-mosquito-fever-warning-signs-guide',
  'malaria': 'malaria-symptoms-prevention-when-urgent-guide',
  'chikungunya': 'chikungunya-mosquito-fever-joint-pain-guide',
  'typhoid': 'typhoid-fever-symptoms-care-prevention-guide',
  'viral fever': 'viral-fever-symptoms-home-care-when-to-worry-guide',
  'food poisoning': 'food-poisoning-diarrhoea-vomiting-home-care-guide',
  'common cold': 'common-cold-home-care-relief-guide',

  // Emergencies / red flags
  'heat stroke': 'heat-stroke-heat-exhaustion-summer-safety-guide',
  'stroke': 'stroke-fast-warning-signs-guide',
  'choking': 'choking-first-aid-heimlich-what-to-do-guide',
  'seizure': 'seizure-fit-first-aid-what-to-do-guide',
  'snakebite': 'snakebite-first-aid-what-to-do-guide',
  'symptoms you should never ignore': 'symptoms-you-should-never-ignore-guide',

  // Digestive
  'acidity': 'acidity-heartburn-causes-relief',
  'constipation': 'constipation-causes-relief-guide',
  'piles': 'piles-haemorrhoids-causes-relief-guide',
  'gallstones': 'gallstones-symptoms-diet-when-surgery-guide',
  'kidney stones': 'kidney-stones-causes-relief-prevention-guide',

  // Women's health
  'pcos': 'pcos-pcod-irregular-periods-guide',
  'menopause': 'menopause-what-to-expect-guide',
  'irregular periods': 'irregular-periods-menstrual-cycle-basics-guide',
  'early pregnancy signs': 'early-pregnancy-signs-first-trimester-care-guide',
  'pregnancy nutrition': 'pregnancy-diet-nutrition-trimester-guide',
  'postpartum recovery': 'postpartum-recovery-after-delivery-care-guide',

  // Nutrition & lifestyle
  'balanced diet': 'balanced-diet-healthy-eating-simple-plate-guide',
  'hidden sugar': 'hidden-sugar-how-much-is-too-much-guide',
  'quitting tobacco': 'quit-chewing-tobacco-gutka-oral-cancer-guide',
  'quit smoking': 'quit-smoking-what-happens-to-body',
  'preventive check-ups': 'why-preventive-health-checkups-matter',
  'preventive health checkups': 'why-preventive-health-checkups-matter',

  // Deficiencies
  'vitamin d': 'vitamin-d-deficiency-india-guide',
  'vitamin b12': 'vitamin-b12-deficiency-symptoms-causes-guide',
  'iron deficiency': 'iron-deficiency-anaemia-women-guide',

  // Tests / procedures
  'blood test report': 'understanding-blood-test-report-cbc-guide',
  'biopsy': 'what-is-a-biopsy-why-doctors-take-one-guide',
  'endoscopy': 'endoscopy-gastroscopy-what-to-expect-guide',
  'colonoscopy': 'colonoscopy-what-to-expect-screening-guide',

  // Care navigation
  'using antibiotics wisely': 'using-antibiotics-wisely-resistance-guide',
  'online consultation': 'is-online-doctor-consultation-safe',
  'second opinion': 'getting-a-second-opinion-when-and-how-guide',
  'air pollution': 'air-pollution-and-your-lungs-protection-guide',
};
