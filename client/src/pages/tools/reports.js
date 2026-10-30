// ============================================
// Report Samjhao — blood report explained (shared data, logic + copy)
// ============================================
// Plain JS (no JSX) on purpose: imported by the page component
// (ReportSamjhao.jsx), the on-phone photo reader (reportOcr.js) and the
// build-time prerender, so crawlers read exactly what users see.
//
// SAFETY RULES (do not relax without a doctor's sign-off):
//   • We only say Low / Normal range / High (or the standard sugar / vitamin D
//     bands). We never name a disease or give a diagnosis.
//   • Reasons are always "common reasons — your doctor will tell".
//   • Every result ends with "show your doctor"; dangerous values get a
//     "see a doctor today" box at the top.
//   • Adults (18+) only, not for pregnancy — ranges differ for both.
//
// RANGES: typical adult reference ranges printed by most Indian labs, and the
// standard ADA sugar bands. If the user's own report prints a range, we use
// that instead for range-type tests. ⚠ All numbers here must be confirmed by a
// ProMedicoz doctor before launch; changing one is a one-line edit below.
//
// Nothing is stored or sent: everything runs in the browser.

export const TOOL_PATH = '/tools/blood-report';

// ---------- Parameters ----------
// kind 'range': low/high limits (can be replaced by the report's own range)
// kind 'bands': fixed bands, checked top-down ({ max, level, key })
// units: first is canonical; others convert TO canonical with `toBase`.
export const PARAMS = {
  hb: {
    test: 'cbc', name: { en: 'Haemoglobin (Hb)', hi: 'Haemoglobin (Hb)' },
    units: [{ id: 'g/dL', toBase: (v) => v }, { id: 'g/L', toBase: (v) => v / 10 }],
    kind: 'range', range: (sex) => (sex === 'm' ? [13, 17] : [12, 15]),
    plausible: [2, 25],
    urgent: { below: 7 },
    doctor: 'general-physician',
  },
  wbc: {
    test: 'cbc', name: { en: 'Total WBC (white cells)', hi: 'Total WBC (safed koshikayein)' },
    units: [{ id: '/µL', toBase: (v) => v }, { id: '×10³/µL', toBase: (v) => v * 1000 }],
    kind: 'range', range: () => [4000, 11000],
    plausible: [300, 200000],
    urgent: { below: 2000, above: 30000 },
    doctor: 'general-physician',
    format: (v) => `${Math.round(v).toLocaleString('en-IN')} /µL`,
  },
  plt: {
    test: 'cbc', name: { en: 'Platelets', hi: 'Platelets' },
    units: [{ id: 'lakh/µL', toBase: (v) => v }, { id: '×10³/µL', toBase: (v) => v / 100 }, { id: '/µL', toBase: (v) => v / 100000 }],
    kind: 'range', range: () => [1.5, 4.5],
    plausible: [0.05, 15],
    urgent: { below: 0.5 },
    doctor: 'general-physician',
    format: (v) => `${(Math.round(v * 100) / 100).toLocaleString('en-IN')} lakh`,
  },
  tsh: {
    test: 'thyroid', name: { en: 'TSH', hi: 'TSH' },
    units: [{ id: 'mIU/L', toBase: (v) => v }],
    kind: 'range', range: () => [0.4, 4.0],
    plausible: [0.001, 200],
    doctor: 'endocrinologist',
  },
  ft4: {
    test: 'thyroid', name: { en: 'Free T4', hi: 'Free T4' },
    units: [{ id: 'ng/dL', toBase: (v) => v }, { id: 'pmol/L', toBase: (v) => v / 12.87 }],
    kind: 'range', range: () => [0.8, 1.8],
    plausible: [0.05, 10],
    doctor: 'endocrinologist',
  },
  fbs: {
    test: 'sugar', name: { en: 'Fasting sugar', hi: 'Fasting sugar (khaali pet)' },
    units: [{ id: 'mg/dL', toBase: (v) => v }, { id: 'mmol/L', toBase: (v) => v * 18 }],
    kind: 'bands',
    bands: [
      { max: 69, level: 'low', key: 'sugarLow' },
      { max: 99, level: 'ok', key: 'normal' },
      { max: 125, level: 'border', key: 'prediabetes' },
      { max: Infinity, level: 'high', key: 'diabetesRange' },
    ],
    plausible: [20, 800],
    urgent: { below: 54, above: 299 },
    doctor: 'endocrinologist',
  },
  ppbs: {
    test: 'sugar', name: { en: 'Sugar 2 hrs after meal (PP)', hi: 'Khaane ke 2 ghante baad sugar (PP)' },
    units: [{ id: 'mg/dL', toBase: (v) => v }, { id: 'mmol/L', toBase: (v) => v * 18 }],
    kind: 'bands',
    bands: [
      { max: 69, level: 'low', key: 'sugarLow' },
      { max: 139, level: 'ok', key: 'normal' },
      { max: 199, level: 'border', key: 'prediabetes' },
      { max: Infinity, level: 'high', key: 'diabetesRange' },
    ],
    plausible: [20, 900],
    urgent: { below: 54, above: 299 },
    doctor: 'endocrinologist',
  },
  hba1c: {
    test: 'sugar', name: { en: 'HbA1c (3-month average sugar)', hi: 'HbA1c (3 mahine ki average sugar)' },
    units: [{ id: '%', toBase: (v) => v }],
    kind: 'bands',
    bands: [
      { max: 5.69, level: 'ok', key: 'normal' },
      { max: 6.49, level: 'border', key: 'prediabetes' },
      { max: Infinity, level: 'high', key: 'diabetesRange' },
    ],
    plausible: [3, 20],
    doctor: 'endocrinologist',
  },
  vitd: {
    test: 'vitamins', name: { en: 'Vitamin D (25-OH)', hi: 'Vitamin D (25-OH)' },
    units: [{ id: 'ng/mL', toBase: (v) => v }, { id: 'nmol/L', toBase: (v) => v / 2.5 }],
    kind: 'bands',
    bands: [
      { max: 19.99, level: 'low', key: 'low' },
      { max: 29.99, level: 'border', key: 'borderline' },
      { max: 100, level: 'ok', key: 'normal' },
      { max: Infinity, level: 'high', key: 'high' },
    ],
    plausible: [1, 300],
    doctor: 'general-physician',
  },
  b12: {
    test: 'vitamins', name: { en: 'Vitamin B12', hi: 'Vitamin B12' },
    units: [{ id: 'pg/mL', toBase: (v) => v }, { id: 'pmol/L', toBase: (v) => v * 1.355 }],
    kind: 'range', range: () => [200, 900],
    plausible: [30, 5000],
    doctor: 'general-physician',
  },
};

export const TESTS = [
  { id: 'cbc', label: { en: 'CBC', hi: 'CBC' }, params: ['hb', 'wbc', 'plt'] },
  { id: 'thyroid', label: { en: 'Thyroid', hi: 'Thyroid' }, params: ['tsh', 'ft4'] },
  { id: 'sugar', label: { en: 'Sugar', hi: 'Sugar' }, params: ['fbs', 'ppbs', 'hba1c'] },
  { id: 'vitamins', label: { en: 'Vit D / B12', hi: 'Vit D / B12' }, params: ['vitd', 'b12'] },
];
export const PARAM_ORDER = TESTS.flatMap((t) => t.params);

const round = (v) => Math.round(v * 100) / 100;

// Typed values in the DEFAULT unit are often written in another common scale
// (platelets "40000" or "210" instead of lakh, WBC "7.8" for ×10³, Hb "102"
// in g/L). Detect the scale from the size of the number, like the photo reader
// does, so "40000 platelets" is never read as 40,000 lakh ("High").
export function normalizeTyped(id, v) {
  if (id === 'plt') return v >= 1000 ? v / 100000 : v > 15 ? v / 100 : v;
  if (id === 'wbc') return v < 200 ? v * 1000 : v;
  if (id === 'hb') return v > 30 ? v / 10 : v;
  return v;
}
export const formatValue = (id, v) => (PARAMS[id].format ? PARAMS[id].format(v) : String(round(v)));

// Interpret one value (already in the canonical unit).
//   reportRange: optional [low, high] from the user's own report (canonical
//   unit), used instead of our typical range for 'range' tests.
// Returns { level: 'low'|'ok'|'border'|'high', key, range, usedReportRange, urgent, implausible }
export function interpret(id, value, sex = 'f', reportRange = null) {
  const p = PARAMS[id];
  const v = Number(value);
  if (!p || !Number.isFinite(v) || v < 0) return null;
  const implausible = v < p.plausible[0] || v > p.plausible[1];
  const urgent = Boolean(p.urgent && ((p.urgent.below != null && v < p.urgent.below) || (p.urgent.above != null && v > p.urgent.above)));
  if (p.kind === 'bands') {
    const band = p.bands.find((b) => v <= b.max);
    return { level: band.level, key: band.key, bands: p.bands, urgent, implausible, usedReportRange: false };
  }
  const validReport = Array.isArray(reportRange) && reportRange.length === 2
    && Number.isFinite(reportRange[0]) && Number.isFinite(reportRange[1]) && reportRange[0] < reportRange[1];
  const range = validReport ? reportRange : p.range(sex);
  const level = v < range[0] ? 'low' : v > range[1] ? 'high' : 'ok';
  return { level, key: level === 'ok' ? 'normal' : level, range, urgent, implausible, usedReportRange: validReport };
}

// Text shown for a band/range result, e.g. "Prediabetes range".
export function levelLabel(r, lang) {
  return (COPY[lang] || COPY.en).levels[r.key] || r.key;
}

// ---------- Explanations (what it is, common reasons) ----------
// Always "common reasons" — never "you have X".
export const EXPLAIN = {
  hb: {
    en: {
      what: 'The part of your blood that carries oxygen around the body.',
      low: 'Common reasons: iron deficiency (the most common), heavy periods, low vitamin B12 or folate, blood loss, or a long-term illness. Your doctor will find the cause.',
      high: 'Common reasons: smoking, not drinking enough water, living at high altitude, or some lung or heart problems. Less often a bone-marrow problem. Your doctor will check.',
    },
    hi: {
      what: 'Khoon ka woh hissa jo poore shareer mein oxygen pahunchata hai.',
      low: 'Aam kaaran: iron ki kami (sabse aam), heavy periods, vitamin B12 ya folate ki kami, khoon jaana, ya koi lambi beemari. Asli kaaran doctor batayenge.',
      high: 'Aam kaaran: smoking, paani kam peena, pahaadi ilaake mein rehna, ya fefdon ya dil ki kuch takleef. Kabhi-kabhi bone-marrow ki samasya. Doctor jaanch karenge.',
    },
  },
  wbc: {
    en: {
      what: 'White blood cells fight infections.',
      low: 'Common reasons: some viral fevers (like dengue), certain medicines, low vitamin B12 or folate, or immune problems. Your doctor will check.',
      high: 'Common reasons: an infection, inflammation, stress or steroid medicines. Less often a blood problem. Your doctor will check.',
    },
    hi: {
      what: 'Safed koshikayein (WBC) infection se ladti hain.',
      low: 'Aam kaaran: kuch viral bukhaar (jaise dengue), kuch dawaiyan, vitamin B12 ya folate ki kami, ya immunity ki samasya. Doctor jaanch karenge.',
      high: 'Aam kaaran: koi infection, sujan (inflammation), tanaav ya steroid dawaiyan. Kabhi-kabhi khoon ki samasya. Doctor jaanch karenge.',
    },
  },
  plt: {
    en: {
      what: 'Platelets are tiny cells that help blood clot and stop bleeding.',
      low: 'Common reasons: viral fevers such as dengue, some medicines, or liver problems. Sometimes the sample clumps in the lab, so doctors often repeat the test.',
      high: 'Common reasons: an infection or inflammation, iron deficiency, or after an operation. Less often a bone-marrow problem. Your doctor will check.',
    },
    hi: {
      what: 'Platelets chhoti koshikayein hain jo khoon jamaane aur bleeding rokne mein madad karti hain.',
      low: 'Aam kaaran: dengue jaise viral bukhaar, kuch dawaiyan, ya liver ki takleef. Kabhi lab mein sample jam jaata hai, isliye doctor aksar test dobara karwaate hain.',
      high: 'Aam kaaran: infection ya sujan, iron ki kami, ya operation ke baad. Kabhi-kabhi bone-marrow ki samasya. Doctor jaanch karenge.',
    },
  },
  tsh: {
    en: {
      what: 'TSH is a signal from the brain telling your thyroid gland how hard to work. A high TSH usually means the thyroid is working slowly; a low TSH usually means it is working too fast.',
      low: 'Often seen when the thyroid is working too fast, or when the thyroid medicine dose is too high. Your doctor will read it together with Free T4.',
      high: 'Often seen when the thyroid is working slowly, or when the thyroid medicine dose is too low. A mild rise can be temporary, so doctors often repeat the test after a few weeks.',
    },
    hi: {
      what: 'TSH dimaag ka signal hai jo thyroid gland ko batata hai ki kitna kaam kare. TSH zyaada ho to aksar thyroid dheere kaam kar raha hota hai; kam ho to aksar zyaada tez.',
      low: 'Aksar tab dikhta hai jab thyroid zyaada tez kaam kar raha ho, ya thyroid ki dawai ka dose zyaada ho. Doctor ise Free T4 ke saath dekhenge.',
      high: 'Aksar tab dikhta hai jab thyroid dheere kaam kar raha ho, ya thyroid ki dawai ka dose kam ho. Halki badhat kabhi-kabhi kuch samay ki hoti hai, isliye doctor aksar kuch hafton baad test dobara karwaate hain.',
    },
  },
  ft4: {
    en: {
      what: 'Free T4 is the main thyroid hormone in your blood.',
      low: 'Can mean the thyroid is working slowly. It is read together with TSH, so please show both to your doctor.',
      high: 'Can mean the thyroid is working too fast, or the thyroid medicine dose is high. It is read together with TSH.',
    },
    hi: {
      what: 'Free T4 khoon mein thyroid ka mukhya hormone hai.',
      low: 'Iska matlab ho sakta hai ki thyroid dheere kaam kar raha hai. Ise TSH ke saath dekha jaata hai, isliye dono doctor ko dikhayein.',
      high: 'Iska matlab ho sakta hai ki thyroid zyaada tez kaam kar raha hai, ya dawai ka dose zyaada hai. Ise TSH ke saath dekha jaata hai.',
    },
  },
  fbs: {
    en: { what: 'Blood sugar after at least 8 hours without food (usually tested in the morning).' },
    hi: { what: 'Kam se kam 8 ghante kuch na khaane ke baad ki blood sugar (aam taur par subah).' },
  },
  ppbs: {
    en: { what: 'Blood sugar about 2 hours after a meal.' },
    hi: { what: 'Khaane ke lagbhag 2 ghante baad ki blood sugar.' },
  },
  hba1c: {
    en: { what: 'Your average blood sugar over the last 2–3 months. It does not change much from day to day.' },
    hi: { what: 'Pichhle 2–3 mahine ki average blood sugar. Yeh roz-roz zyaada nahi badalti.' },
  },
  vitd: {
    en: {
      what: 'Vitamin D keeps bones and muscles strong. Most of it comes from sunlight on the skin.',
      low: 'Very common in India. Common reasons: little sun on the skin, staying indoors, darker skin, or diet. Your doctor may suggest a supplement. Please don’t take high doses on your own.',
      high: 'Above the usual range, usually from taking high-dose supplements. Please ask your doctor before taking more.',
    },
    hi: {
      what: 'Vitamin D haddiyon aur maanspeshiyon ko mazboot rakhta hai. Zyaadaatar yeh dhoop se milta hai.',
      low: 'Bharat mein bahut aam hai. Aam kaaran: dhoop kam lagna, ghar ke andar rehna, saanwli twacha, ya khaana. Doctor supplement de sakte hain. Khud se zyaada dose na lein.',
      high: 'Aam range se zyaada, aksar zyaada dose ke supplement lene se. Aur lene se pehle doctor se poochhein.',
    },
  },
  b12: {
    en: {
      what: 'Vitamin B12 is needed for healthy blood and nerves. It comes mainly from milk, curd, paneer, eggs, meat and fish.',
      low: 'Common in vegetarians, and in people taking metformin or acidity medicines for a long time. It can cause tiredness and tingling. Your doctor will advise on treatment.',
      high: 'Usually from supplements or B12 injections and not harmful on its own. Please tell your doctor.',
    },
    hi: {
      what: 'Vitamin B12 swasth khoon aur nason ke liye zaroori hai. Yeh mukhya roop se doodh, dahi, paneer, ande, meat aur machhli se milta hai.',
      low: 'Shaakahaari logon mein, aur lambe samay tak metformin ya acidity ki dawai lene walon mein aam hai. Isse thakaan aur jhunjhunahat ho sakti hai. Ilaaj doctor batayenge.',
      high: 'Aksar supplement ya B12 injection se, aur akele mein nuksaandeh nahi. Doctor ko zaroor batayein.',
    },
  },
};

// Sugar band texts (shared by fasting, PP and HbA1c).
const SUGAR = {
  en: {
    sugarLow: 'Lower than normal. This can happen after a long fast, with some diabetes medicines or with alcohol. If you feel shaky, sweaty or confused, eat or drink something sugary now and see a doctor.',
    prediabetes: 'In the prediabetes range: higher than normal, but not in the diabetes range. Healthy food, daily activity and weight loss can often bring it back to normal. Your doctor will guide you.',
    diabetesRange: 'In the diabetes range. One test is not enough: doctors confirm with a repeat test or HbA1c. Please see a doctor soon.',
  },
  hi: {
    sugarLow: 'Normal se kam. Lambe samay tak bhookhe rehne, diabetes ki kuch dawaiyon ya sharaab se ho sakta hai. Agar kaanpna, paseena ya ghabrahat ho to abhi kuch meetha khaayein ya piyein aur doctor se milein.',
    prediabetes: 'Prediabetes range mein: normal se zyaada, par diabetes range mein nahi. Achchha khaana, roz exercise aur vajan kam karne se aksar yeh wapas normal ho jaata hai. Doctor raah dikhayenge.',
    diabetesRange: 'Diabetes range mein. Ek test kaafi nahi hota: doctor dobara test ya HbA1c se confirm karte hain. Jaldi doctor se milein.',
  },
};

// Reason text for a result (null when normal).
export function reasonText(id, r, lang) {
  const L = lang === 'hi' ? 'hi' : 'en';
  if (!r || r.level === 'ok') return null;
  if (['fbs', 'ppbs', 'hba1c'].includes(id)) return SUGAR[L][r.key] || null;
  if (id === 'vitd' && r.key === 'borderline') return (COPY[L]).vitdBorder;
  return EXPLAIN[id][L][r.level === 'border' ? 'low' : r.level] || null;
}

// "See a doctor today" text for dangerous values.
export function urgentText(id, value, lang) {
  const c = COPY[lang] || COPY.en;
  const p = PARAMS[id];
  const low = p.urgent?.below != null && value < p.urgent.below;
  return c.urgent(p.name[lang] || p.name.en, formatValue(id, value), low, id);
}

// Articles suggested under the result (slugs from blogData.js; missing ones are skipped).
export const RELATED_ARTICLES = [
  'understanding-blood-test-report-cbc-guide',
  'iron-deficiency-anaemia-women-guide',
  'thyroid-explained-hypo-hyper-guide',
  'diabetes-tests-hba1c-fasting-sugar-explained-guide',
  'vitamin-d-deficiency-india-guide',
  'vitamin-b12-deficiency-symptoms-causes-guide',
];

// Related articles per test — shown under the matching results.
export const TEST_ARTICLES = {
  cbc: ['understanding-blood-test-report-cbc-guide', 'anaemia-tiredness-weakness-causes-guide', 'dengue-mosquito-fever-warning-signs-guide'],
  thyroid: ['thyroid-explained-hypo-hyper-guide'],
  sugar: ['diabetes-tests-hba1c-fasting-sugar-explained-guide', 'prediabetes-warning-stage-reverse-guide', 'diabetes-diet-what-to-eat-avoid-guide'],
  vitamins: ['vitamin-d-deficiency-india-guide', 'vitamin-b12-deficiency-symptoms-causes-guide'],
};

export const COPY = {
  en: {
    seoTitle: 'Report Samjhao — Understand Your Blood Test Report (CBC, Thyroid, Sugar, Vitamin D, B12)',
    seoDesc: 'Free tool to understand your blood report in simple English or Hindi: CBC (haemoglobin, WBC, platelets), thyroid (TSH, T4), sugar (fasting, PP, HbA1c), vitamin D and B12. Take a photo or type values. Your report stays on your phone — ProMedicoz never sees, saves or shares it.',
    kicker: 'ProMedicoz · Free · Private',
    title: 'Report Samjhao',
    subtitle: 'Your blood report in simple words',
    scope: 'Adults (18+) · not for pregnancy or children',
    photoTitle: 'Take a photo of your report',
    photoSub: 'or choose an image from your gallery',
    openCamera: 'Open camera',
    or: 'or',
    typeInstead: '⌨️ Type the values myself',
    tipsTitle: 'For a good photo',
    tips: ['Printed lab report (handwriting won’t work)', 'Flat on a table, good light, no shadow', 'Only the results table in the frame', 'You can crop out your name and address', 'One page at a time'],
    photoPrivacyTitle: '🔒 Your photo stays on your phone',
    photoPrivacy: 'It is read right here in your browser. It is not uploaded to ProMedicoz or any other company (no AI service sees it), not saved, and gone when you close this page.',
    reading: 'Reading your report…',
    readingSlow: 'First time only: downloading the reader (about 7 MB). Next time it is faster.',
    readDone: (n) => `Found ${n} value${n === 1 ? '' : 's'}. Please check each one against your paper.`,
    readNone: 'Couldn’t read any values. Please type them below, or try a clearer, flat photo.',
    readFail: 'The reader couldn’t start on this phone. Please type the values below.',
    unsure: 'Not sure, please check this number',
    reportRange: (r) => `Report range: ${r}`,
    sexLabel: 'I am',
    woman: 'Woman',
    man: 'Man',
    pickTest: 'Which test?',
    unitLabel: 'Unit',
    blankHint: 'Leave blank what is not on your report.',
    useReportRange: 'Use the normal range printed on my report',
    rangeLow: 'From',
    rangeHigh: 'To',
    confirm: 'I checked these numbers against my report',
    confirmNeeded: 'Please tick the box to confirm the numbers first.',
    explain: 'Samjhao →',
    noValues: 'Please enter at least one value.',
    resultsTitle: 'What your report says',
    yours: 'Yours',
    normalRange: (r) => `Normal range: ${r}`,
    yourRange: (r) => `Your report’s range: ${r}`,
    typicalNote: 'Typical adult range. Labs differ a little.',
    whatIs: 'What is it?',
    showDoctor: (spec) => `👩‍⚕️ Show this to a ${spec} →`,
    specNames: { 'general-physician': 'general physician', endocrinologist: 'endocrinologist' },
    consult: '👩‍⚕️ Show your report to a doctor (online)',
    share: '💬 Share this free tool',
    shareMsg: (url) => `Free tool to understand your blood report in simple Hindi or English 🧪 CBC, thyroid, sugar, vitamin D, B12. Your report stays on your phone:\n${url}`,
    implausible: 'This number looks unusual. Please check it against your report and the unit.',
    levels: {
      low: 'Low', normal: 'Normal range', high: 'High', borderline: 'Borderline',
      prediabetes: 'Prediabetes range', diabetesRange: 'Diabetes range', sugarLow: 'Low',
    },
    vitdBorder: 'A little below the ideal range. Common reasons: little sun on the skin or diet. Ask your doctor whether you need a supplement.',
    urgentTitle: '🚨 Please see a doctor today',
    urgent: (name, val, low, id) => `${name} ${val} is ${low ? 'very low' : 'very high'}.${id === 'fbs' || id === 'ppbs' ? (low ? ' If you feel shaky, sweaty or confused, eat something sugary now.' : ' If you feel very thirsty, drowsy, are vomiting or breathing fast, go to a hospital now.') : ' If you have fever, bleeding, breathlessness or feel very weak, go to the nearest hospital now. Don’t wait.'}`,
    again: '↺ Check another report',
    safety: 'This tool explains your numbers; it does not diagnose. Only a doctor can read your report together with your symptoms, history and medicines. Please show your report to a doctor.',
    privacy: 'Your report stays on your phone. The photo and numbers are read right here in your browser. They are never sent to ProMedicoz, never saved and never shared with anyone. Close the page and they are gone.',
    readMore: 'Read next',
    faqTitle: 'Frequently asked questions',
    howTitle: 'How it works',
    how: 'Pick a test or take a photo of your printed report. The photo is read on your phone by an open-source text reader, and you check the numbers. We then compare each value with the normal range printed on your report (or a typical adult range) and explain in simple words what it means and when to see a doctor.',
    faq: [
      { q: 'Is my report uploaded anywhere?', a: 'No. The photo is read inside your phone’s browser and never leaves your phone. ProMedicoz does not receive, save or share your report or its numbers, and neither does any other company.' },
      { q: 'Why is my lab’s normal range different?', a: 'Each lab uses slightly different machines and methods, so ranges vary a little. If you tick “use the range printed on my report”, we use your lab’s range.' },
      { q: 'One value is a little outside the range. Should I worry?', a: 'Small differences are common and often not serious. Your doctor will look at it together with your symptoms and other results, and may repeat the test.' },
      { q: 'Can I use this for my child or during pregnancy?', a: 'No. Normal ranges are different for children and in pregnancy. Please ask a paediatrician or your gynaecologist.' },
      { q: 'Can it read handwritten reports or prescriptions?', a: 'No. It reads printed lab reports only. For a prescription, please ask your doctor or chemist.' },
    ],
  },
  hi: {
    seoTitle: 'Report Samjhao — Blood Test Report Hindi Mein Samjhein (CBC, Thyroid, Sugar)',
    seoDesc: 'Apni blood report aasaan Hindi mein samjhein: CBC (haemoglobin, WBC, platelets), thyroid (TSH, T4), sugar (fasting, PP, HbA1c), vitamin D aur B12. Photo lein ya values type karein. Report aapke phone par hi rehti hai — ProMedicoz na ise dekhta hai, na save karta hai, na kisi ko deta hai.',
    kicker: 'ProMedicoz · Free · Private',
    title: 'Report Samjhao 🧪',
    subtitle: 'Apni blood report aasaan shabdon mein',
    scope: 'Sirf vayask (18+) · pregnancy ya bachchon ke liye nahi',
    photoTitle: 'Apni report ki photo lein',
    photoSub: 'ya gallery se photo chunein',
    openCamera: 'Camera kholein',
    or: 'ya',
    typeInstead: '⌨️ Values khud type karein',
    tipsTitle: 'Achchhi photo ke liye',
    tips: ['Printed lab report (haath se likhi nahi chalegi)', 'Table par seedhi rakhein, achchhi roshni, parchhaai nahi', 'Frame mein sirf results ki table', 'Naam aur pata crop kar sakte hain', 'Ek baar mein ek page'],
    photoPrivacyTitle: '🔒 Aapki photo aapke phone par hi rehti hai',
    photoPrivacy: 'Yeh yahin aapke browser mein padhi jaati hai. Yeh ProMedicoz ya kisi aur company (kisi AI service) ko nahi bheji jaati, save nahi hoti, aur page band karte hi mit jaati hai.',
    reading: 'Aapki report padhi ja rahi hai…',
    readingSlow: 'Sirf pehli baar: reader download ho raha hai (lagbhag 7 MB). Agli baar jaldi hoga.',
    readDone: (n) => `${n} value mili. Kripya har ek ko apni report se milaayein.`,
    readNone: 'Koi value nahi padh paaye. Kripya neeche type karein, ya saaf aur seedhi photo lein.',
    readFail: 'Is phone par reader shuru nahi ho paaya. Kripya values neeche type karein.',
    unsure: 'Pakka nahi, yeh number check karein',
    reportRange: (r) => `Report ki range: ${r}`,
    sexLabel: 'Main hoon',
    woman: 'Mahila',
    man: 'Purush',
    pickTest: 'Kaun sa test?',
    unitLabel: 'Unit',
    blankHint: 'Jo report mein nahi hai, use khaali chhod dein.',
    useReportRange: 'Meri report mein likhi normal range use karein',
    rangeLow: 'Se',
    rangeHigh: 'Tak',
    confirm: 'Maine yeh numbers apni report se mila liye hain',
    confirmNeeded: 'Pehle box tick karke numbers confirm karein.',
    explain: 'Samjhao →',
    noValues: 'Kam se kam ek value daalein.',
    resultsTitle: 'Aapki report kya kehti hai',
    yours: 'Aapka',
    normalRange: (r) => `Normal range: ${r}`,
    yourRange: (r) => `Aapki report ki range: ${r}`,
    typicalNote: 'Vayaskon ki aam range. Labs mein thoda farak hota hai.',
    whatIs: 'Yeh kya hai?',
    showDoctor: (spec) => `👩‍⚕️ ${spec} ko dikhayein →`,
    specNames: { 'general-physician': 'General physician', endocrinologist: 'Endocrinologist' },
    consult: '👩‍⚕️ Report doctor ko dikhayein (online)',
    share: '💬 Yeh free tool share karein',
    shareMsg: (url) => `Apni blood report aasaan Hindi mein samjhein 🧪 CBC, thyroid, sugar, vitamin D, B12. Report aapke phone par hi rehti hai:\n${url}`,
    implausible: 'Yeh number alag lag raha hai. Kripya report aur unit dobara check karein.',
    levels: {
      low: 'Kam (Low)', normal: 'Normal range', high: 'Zyaada (High)', borderline: 'Thoda kam',
      prediabetes: 'Prediabetes range', diabetesRange: 'Diabetes range', sugarLow: 'Kam (Low)',
    },
    vitdBorder: 'Sahi range se thoda kam. Aam kaaran: dhoop kam lagna ya khaana. Doctor se poochhein ki supplement chahiye ya nahi.',
    urgentTitle: '🚨 Aaj hi doctor ko dikhayein',
    urgent: (name, val, low, id) => `${name} ${val} bahut ${low ? 'kam' : 'zyaada'} hai.${id === 'fbs' || id === 'ppbs' ? (low ? ' Agar kaanpna, paseena ya ghabrahat ho to abhi kuch meetha khaayein.' : ' Agar bahut pyaas, neend, ulti ya tez saans ho to abhi hospital jaayein.') : ' Agar bukhaar, khoon aana, saans phoolna ya bahut kamzori hai to turant nazdeeki hospital jaayein. Intezaar na karein.'}`,
    again: '↺ Doosri report dekhein',
    safety: 'Yeh tool aapke numbers samjhaata hai; beemari nahi batata. Sirf doctor aapke lakshan, history aur dawaiyon ke saath report padh sakte hain. Kripya report doctor ko zaroor dikhayein.',
    privacy: 'Aapki report aapke phone par hi rehti hai. Photo aur numbers yahin aapke browser mein padhe jaate hain. Inhe ProMedicoz ko nahi bheja jaata, save nahi kiya jaata aur kisi ke saath share nahi kiya jaata. Page band karte hi sab mit jaata hai.',
    readMore: 'Aage padhein',
    faqTitle: 'Aksar poochhe jaane wale sawaal',
    howTitle: 'Yeh kaise kaam karta hai',
    how: 'Test chunein ya apni printed report ki photo lein. Photo aapke phone par ek open-source text reader padhta hai, aur aap numbers check karte hain. Phir hum har value ko aapki report mein likhi normal range (ya vayaskon ki aam range) se milaate hain aur aasaan shabdon mein batate hain ki iska matlab kya hai aur doctor ko kab dikhayein.',
    faq: [
      { q: 'Kya meri report kahin upload hoti hai?', a: 'Nahi. Photo aapke phone ke browser mein hi padhi jaati hai aur phone se bahar nahi jaati. ProMedicoz aapki report ya uske numbers na leta hai, na save karta hai, na kisi ko deta hai — koi aur company bhi nahi.' },
      { q: 'Meri lab ki normal range alag kyun hai?', a: 'Har lab thodi alag machine aur tareeka use karti hai, isliye range thodi badalti hai. “Meri report ki range use karein” tick karne par hum aapki lab ki range use karte hain.' },
      { q: 'Ek value range se thodi bahar hai. Kya chinta karun?', a: 'Chhote farak aam hain aur aksar gambhir nahi hote. Doctor ise aapke lakshan aur baaki results ke saath dekhenge, aur test dobara karwa sakte hain.' },
      { q: 'Kya ise bachche ke liye ya pregnancy mein use kar sakte hain?', a: 'Nahi. Bachchon aur pregnancy mein normal range alag hoti hai. Kripya bachchon ke doctor ya gynaecologist se poochhein.' },
      { q: 'Kya yeh haath se likhi report ya parchi padh sakta hai?', a: 'Nahi. Yeh sirf printed lab report padhta hai. Dawai ki parchi ke liye doctor ya chemist se poochhein.' },
    ],
  },
};
