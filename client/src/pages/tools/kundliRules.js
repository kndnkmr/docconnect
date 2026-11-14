// ============================================
// Sehat Kundli — family health chart: shared data, logic + copy
// ============================================
// Plain JS (no JSX) on purpose: imported by BOTH the page component
// (SehatKundli.jsx) and the build-time prerender, so the text crawlers read
// is exactly the text users see. Edit the rules/copy here only.
//
// What it does: you tick which relatives have (or had) common conditions; it
// shows which check-ups YOU should do and from what age, earlier where the
// family history calls for it. It is medical screening guidance, NOT
// astrology — "kundli" is only the familiar idea of a chart about your future.
//
// SOURCES (general, conservative): India's NP-NCD population screening (BP,
// sugar, oral, breast, cervical cancer from age 30, free at Ayushman Arogya
// Mandirs); WHO cervical screening (from 30); RSSDI/ADA (earlier diabetes
// screening with a parent/sibling with diabetes); AHA (cholesterol, early
// heart disease in a parent/sibling); ACS/NCCN (breast/ovarian cancer family
// history, genetic counselling); US Multi-Society Task Force (colon cancer in
// a parent/sibling: colonoscopy from 40 or 10 years earlier); AAO (glaucoma
// in the family); ATA (thyroid testing in pregnancy with family history);
// MoHFW thalassaemia guidance (carrier test before marriage/pregnancy).
// Every result says to confirm the plan with a doctor.
//
// PRIVACY: everything is worked out on the phone. Nothing is sent to
// ProMedicoz. The "send to brothers & sisters" link carries the family list
// after "#", which browsers never send to any server.
// Tests: tests/kundliRules.test.mjs
// (Named kundliRules.js, not sehatKundli.js: macOS treats SehatKundli.jsx and
// sehatKundli.js as the same name, which made the app load the wrong file.)

export const TOOL_PATH = '/tools/sehat-kundli';
export const MIN_AGE = 18;
export const MAX_AGE = 90;

// Who in the family. Parents and siblings are "first-degree" (they matter
// most); grandparents/uncles/aunts are "second-degree".
export const RELATIVES = [
  { key: 'mother', code: 'm', label: { en: 'Mother', hi: 'Mummy' } },
  { key: 'father', code: 'f', label: { en: 'Father', hi: 'Papa' } },
  { key: 'sibling', code: 's', label: { en: 'Brother / sister', hi: 'Bhai / behen' } },
  { key: 'grand', code: 'g', label: { en: 'Grandparent, uncle or aunt', hi: 'Dada-dadi, nana-nani, chacha, mama…' } },
];
const FIRST_DEGREE = new Set(['mother', 'father', 'sibling']);

// The conditions asked about. `young` = an extra question that changes the
// advice (e.g. a heart attack in a parent before 55/65).
export const CONDITIONS = [
  { key: 'diabetes', code: 'd', emoji: '🩸', short: { en: 'diabetes', hi: 'diabetes' }, label: { en: 'Diabetes (sugar)', hi: 'Diabetes (sugar ki bimari)' } },
  { key: 'bp', code: 'b', emoji: '💓', short: { en: 'high BP', hi: 'high BP' }, label: { en: 'High BP', hi: 'High BP' } },
  { key: 'heart', code: 'h', emoji: '❤️', short: { en: 'heart disease', hi: 'heart ki bimari' }, label: { en: 'Heart attack or stroke', hi: 'Heart attack ya stroke (lakwa)' },
    young: { en: 'Was it before 55 (men) or 65 (women)?', hi: '55 (mard) ya 65 (aurat) ki umar se pehle hua?' } },
  { key: 'thyroid', code: 't', emoji: '🦋', short: { en: 'thyroid', hi: 'thyroid' }, label: { en: 'Thyroid problem', hi: 'Thyroid' } },
  { key: 'breast', code: 'r', emoji: '🎗️', short: { en: 'breast/ovarian cancer', hi: 'breast/ovary cancer' }, label: { en: 'Breast or ovarian cancer', hi: 'Breast (stan) ya ovary ka cancer' },
    young: { en: 'Was it before age 50?', hi: '50 ki umar se pehle hua?' } },
  { key: 'colon', code: 'c', emoji: '🩺', short: { en: 'colon cancer', hi: 'colon cancer' }, label: { en: 'Bowel (colon) cancer', hi: 'Aant (colon) ka cancer' },
    young: { en: 'Was it before age 60?', hi: '60 ki umar se pehle hua?' } },
  { key: 'kidney', code: 'k', emoji: '🫘', short: { en: 'kidney disease', hi: 'kidney ki bimari' }, label: { en: 'Kidney disease or dialysis', hi: 'Kidney ki bimari ya dialysis' } },
  { key: 'thal', code: 'l', emoji: '🧬', short: { en: 'thalassaemia', hi: 'thalassemia' }, label: { en: 'Thalassaemia', hi: 'Thalassemia' } },
  { key: 'glaucoma', code: 'g', emoji: '👁️', short: { en: 'glaucoma', hi: 'kala motiya' }, label: { en: 'Glaucoma (kala motiya)', hi: 'Kala motiya (glaucoma)' } },
];

const L = (en, hi) => ({ en, hi });

// family = { diabetes: ['mother', 'sibling'], heart: ['father'], ..., young: { heart: true } }
// Returns the personal plan:
//   due     — check-ups that apply at your age now (family ones first)
//   later   — check-ups that start at a later age, soonest first
//   moments — "at a special time" advice (pregnancy, before marriage, …)
//   familyConditions — conditions anyone ticked (for the share picture)
//   secondOnly — conditions only in grandparents/uncles/aunts
//   doctors — which specialists to discuss it with ('gp', 'gynae')
export function buildKundli({ age, sex, family = {} } = {}) {
  const a = Number(age);
  if (!Number.isFinite(a) || a < MIN_AGE || a > MAX_AGE) return { error: 'age' };
  if (sex !== 'f' && sex !== 'm') return { error: 'sex' };
  const woman = sex === 'f';
  const rel = (k) => (Array.isArray(family[k]) ? family[k].filter((r) => RELATIVES.some((x) => x.key === r)) : []);
  const first = (k) => rel(k).some((r) => FIRST_DEGREE.has(r));
  const young = (k) => Boolean(family.young && family.young[k]) && first(k);

  const items = [];
  const add = (it) => items.push({ every: null, family: false, why: null, doctor: 'gp', ...it });
  const famWhy = (k) => { const c = CONDITIONS.find((x) => x.key === k); return L(`Because of ${c.short.en} in your family`, `Parivaar mein ${c.short.hi} hone ki wajah se`); };

  // BP
  const bpFam = first('bp') || young('heart');
  add({ id: 'bp', startAge: bpFam ? 20 : 30, family: bpFam, why: bpFam ? famWhy(first('bp') ? 'bp' : 'heart') : null,
    title: L('BP check', 'BP check'), every: L('every year', 'har saal') });

  // Sugar
  const sugarFam = first('diabetes');
  add({ id: 'sugar', startAge: sugarFam ? 25 : 30, family: sugarFam, why: sugarFam ? famWhy('diabetes') : null,
    title: L('Sugar test (fasting sugar or HbA1c)', 'Sugar test (fasting sugar ya HbA1c)'),
    every: sugarFam ? L('every year, earlier if overweight', 'har saal, vazan zyada ho to aur pehle') : L('every year', 'har saal') });

  // Cholesterol / heart
  if (young('heart')) {
    add({ id: 'lipid', startAge: 20, family: true, why: L('Early heart attack or stroke in a parent or sibling', 'Maa-baap ya bhai-behen ko kam umar mein heart attack/stroke'),
      title: L('Cholesterol test (lipid profile) + heart risk check with a doctor', 'Cholesterol test (lipid profile) + doctor se heart risk check'),
      every: L('every year', 'har saal') });
  } else if (first('heart')) {
    add({ id: 'lipid', startAge: 25, family: true, why: famWhy('heart'),
      title: L('Cholesterol test (lipid profile)', 'Cholesterol test (lipid profile)'), every: L('every 2–3 years', 'har 2–3 saal') });
  } else {
    add({ id: 'lipid', startAge: 30, title: L('Cholesterol test (lipid profile)', 'Cholesterol test (lipid profile)'), every: L('every 5 years', 'har 5 saal') });
  }

  // Kidney
  if (first('kidney')) {
    add({ id: 'kidney', startAge: 30, family: true, why: famWhy('kidney'),
      title: L('Kidney test (creatinine + urine protein)', 'Kidney test (creatinine + urine protein)'), every: L('every year', 'har saal') });
  }

  // Eyes
  const eyeFam = first('glaucoma');
  add({ id: 'eye', startAge: 40, family: eyeFam, why: eyeFam ? famWhy('glaucoma') : null,
    title: eyeFam ? L('Eye pressure check for glaucoma (kala motiya)', 'Aankh ka pressure check (kala motiya)') : L('Eye check-up', 'Aankhon ki jaanch'),
    every: eyeFam ? L('every 1–2 years, earlier if your relative got it young', 'har 1–2 saal, rishtedaar ko kam umar mein hua ho to pehle') : L('every 2 years', 'har 2 saal') });

  // Colon
  if (first('colon')) {
    add({ id: 'colon', startAge: 40, family: true, why: famWhy('colon'),
      title: L('Colon check (colonoscopy), or 10 years before the age your relative got it, whichever is earlier',
        'Colon check (colonoscopy), ya rishtedaar ki umar se 10 saal pehle, jo bhi pehle ho'),
      every: young('colon') ? L('every 5 years', 'har 5 saal') : L('as your doctor advises (often every 5–10 years)', 'doctor ki salaah se (aksar har 5–10 saal)') });
  } else {
    add({ id: 'colon', startAge: 45, title: L('Ask a doctor about a colon check', 'Doctor se colon check ke baare mein poochhein'), every: null });
  }

  // Women: cervix + breast
  if (woman) {
    add({ id: 'cervix', startAge: 30, doctor: 'gynae', title: L('Cervical screening (HPV test or VIA)', 'Cervical screening (HPV test ya VIA)'),
      every: L('every 5 years, free in govt. screening', 'har 5 saal, sarkari screening mein free') });
    const breastStrong = first('breast') && (young('breast') || rel('breast').length >= 2);
    if (breastStrong) {
      add({ id: 'breast-gene', startAge: 25, family: true, doctor: 'gynae', why: famWhy('breast'),
        title: L('Genetic counselling (BRCA test) + an earlier breast screening plan', 'Genetic counselling (BRCA test) + jaldi breast screening ka plan'),
        every: L('plan with a gynaecologist', 'gynaecologist ke saath plan') });
      add({ id: 'breast', startAge: 30, family: true, doctor: 'gynae', why: famWhy('breast'),
        title: L('Breast screening (doctor exam + scan as advised)', 'Breast screening (doctor ki jaanch + scan salaah ke anusaar)'),
        every: L('every year', 'har saal') });
    } else {
      add({ id: 'breast', startAge: 30, doctor: 'gynae', title: L('Breast check by a doctor or health worker', 'Doctor ya health worker se breast check'),
        every: L('every year, free in govt. screening', 'har saal, sarkari screening mein free') });
      add({ id: 'mammo', startAge: first('breast') ? 40 : 45, family: first('breast'), doctor: 'gynae', why: first('breast') ? famWhy('breast') : null,
        title: L('Mammogram (ask your gynaecologist)', 'Mammogram (gynaecologist se poochhein)'), every: L('every 1–2 years', 'har 1–2 saal') });
    }
  }

  // Special moments (no fixed age)
  const moments = [];
  if (rel('thal').length) {
    moments.push({ id: 'thal', family: true, doctor: 'gp', title: L('Thalassaemia carrier test (HPLC) before marriage or pregnancy, for you and your partner',
      'Shaadi ya pregnancy se pehle Thalassemia carrier test (HPLC), aapka aur partner ka') });
  }
  if (first('thyroid')) {
    moments.push(woman
      ? { id: 'thyroid', family: true, doctor: 'gynae', title: L('Thyroid test (TSH) when planning a pregnancy or early in pregnancy', 'Pregnancy plan karte samay ya shuru mein thyroid test (TSH)') }
      : { id: 'thyroid', family: true, doctor: 'gp', title: L('Thyroid test (TSH) if you feel very tired, or notice weight change or hair fall', 'Bahut thakaan, vazan badalna ya baal jhadna ho to thyroid test (TSH)') });
  }
  if (woman && first('diabetes')) {
    moments.push({ id: 'gdm', family: true, doctor: 'gynae', title: L('In pregnancy, ask for an early sugar test (diabetes in the family raises the risk of pregnancy sugar)',
      'Pregnancy mein jaldi sugar test karayein (parivaar mein diabetes se pregnancy sugar ka khatra badhta hai)') });
  }
  if (!woman && first('breast')) {
    moments.push({ id: 'brca-man', family: true, doctor: 'gp', title: L('Tell your doctor: breast or ovarian cancer in the family can be linked to genes (BRCA) that also affect men',
      'Doctor ko batayein: parivaar mein breast/ovary cancer genes (BRCA) se juda ho sakta hai, jo mardon ko bhi prabhavit karte hain') });
  }
  if (young('heart')) {
    moments.push({ id: 'kids-chol', family: true, doctor: 'gp', title: L('Ask a paediatrician whether your children need a cholesterol test',
      'Paediatrician se poochhein ki kya bachchon ka cholesterol test zaroori hai') });
  }

  const byAge = (x, y) => (x.startAge - y.startAge) || (y.family - x.family);
  const due = items.filter((x) => x.startAge <= a).sort((x, y) => (y.family - x.family) || (x.startAge - y.startAge));
  const later = items.filter((x) => x.startAge > a).sort(byAge);
  const familyConditions = CONDITIONS.filter((c) => rel(c.key).length).map((c) => c.key);
  const secondOnly = familyConditions.filter((k) => !first(k));
  const doctors = new Set(['gp']);
  [...items, ...moments].forEach((x) => { if (x.family && x.doctor === 'gynae') doctors.add('gynae'); });
  if (woman) doctors.add('gynae');
  return { age: a, sex, due, later, moments, familyConditions, secondOnly, doctors: [...doctors], familyItems: [...items, ...moments].filter((x) => x.family).length };
}

// The 5 most useful lines for the share picture: family-driven first.
export function topForCard(k, n = 5) {
  if (!k || k.error) return [];
  return [...k.due.filter((x) => x.family), ...k.later.filter((x) => x.family), ...k.moments,
    ...k.due.filter((x) => !x.family), ...k.later.filter((x) => !x.family)].slice(0, n);
}

// ---- Share link for brothers & sisters: family list in the URL hash ----
// "d:mf,h:f!" = diabetes in mother+father, heart in father (young).
export function encodeFamily(family = {}) {
  return CONDITIONS.map((c) => {
    const list = Array.isArray(family[c.key]) ? family[c.key] : [];
    const codes = RELATIVES.filter((r) => list.includes(r.key)).map((r) => r.code).join('');
    if (!codes) return '';
    return `${c.code}:${codes}${family.young && family.young[c.key] ? '!' : ''}`;
  }).filter(Boolean).join(',');
}
export function decodeFamily(str) {
  const family = { young: {} };
  String(str || '').slice(0, 200).split(',').forEach((part) => {
    const m = /^([a-z]):([mfsg]{1,4})(!?)$/.exec(part.trim());
    if (!m) return;
    const c = CONDITIONS.find((x) => x.code === m[1]);
    if (!c) return;
    const keys = RELATIVES.filter((r) => m[2].includes(r.code)).map((r) => r.key);
    if (keys.length) family[c.key] = keys;
    if (m[3] && c.young) family.young[c.key] = true;
  });
  return family;
}
export const familyIsEmpty = (family = {}) => !CONDITIONS.some((c) => Array.isArray(family[c.key]) && family[c.key].length);

export const RELATED_ARTICLES = [
  'health-checks-by-age-what-tests-when-guide',
  'why-preventive-health-checkups-matter',
  'silent-signs-high-blood-sugar',
  'cervical-cancer-hpv-prevention-screening-guide',
  'breast-health-self-awareness-when-to-check-guide',
  'thalassemia-what-it-is-prevention-guide',
];

export const COPY = {
  en: {
    seoTitle: 'Sehat Kundli: Free Family Health History Check-up Planner (Hindi & English)',
    seoDesc: 'Free family health chart: tick which relatives have diabetes, BP, heart disease, thyroid, cancer or thalassaemia, and see which check-ups you need and from what age. Medical guidance, not astrology. Works on your phone, nothing is saved.',
    kicker: 'ProMedicoz · Free · Medical guidance, not astrology',
    title: 'Sehat Kundli',
    subtitle: "Your family's health history, turned into your own check-up plan",
    aboutYou: 'About you',
    ageLabel: 'Your age (years)',
    sexLabel: 'You are',
    woman: 'Woman', man: 'Man',
    familyTitle: 'Who in your family has (or had)…',
    familyHint: 'Tap everyone who applies. Leave blank if no one, or if you are not sure.',
    make: 'Make my Sehat Kundli →',
    errAge: `Please enter your age (${MIN_AGE}–${MAX_AGE}). For children, ask a paediatrician.`,
    errSex: 'Please choose woman or man (some check-ups differ).',
    prefilled: 'Your family history was filled in from the link. Just add your own age and choose woman or man.',
    resultTitle: (age) => `Your Sehat Kundli (age ${age})`,
    familyCount: (n) => (n ? `${n} check-up${n === 1 ? '' : 's'} start earlier or are extra because of your family` : 'No family conditions ticked: your routine plan is below'),
    dueTitle: 'Due now',
    laterTitle: 'Coming up',
    fromAge: (n) => `from ${n}`,
    momentsTitle: 'At special times',
    famTag: 'Family',
    secondOnly: (list) => `Only in grandparents, uncles or aunts: ${list}. This matters less than parents or siblings, so the routine plan applies. Do mention it to your doctor.`,
    free: 'BP, sugar, and breast, cervical and oral cancer screening are free for everyone 30+ at government Ayushman Arogya Mandirs (health and wellness centres).',
    discussGp: '🩺 Discuss with a General Physician',
    discussGynae: '🌸 Discuss with a Gynaecologist',
    sharePic: '📤 Share my Kundli picture',
    sharePicNote: 'The picture shows the conditions in your family. Share it only with family.',
    shareFamily: '👨‍👩‍👧 Send to brothers & sisters',
    shareFamilyMsg: (url) => `I made my Sehat Kundli (free family health chart). Our family history is the same, so yours is already filled in. Just add your age:\n${url}`,
    shareToolMsg: (url) => `Sehat Kundli: a free family health chart. Tick who in the family has sugar, BP, heart disease or cancer, and see which tests you need and from what age:\n${url}`,
    picTitle: 'My Sehat Kundli',
    picFamily: 'In my family',
    picTests: 'My check-up plan',
    picMake: 'Make yours free',
    picNote: 'Medical guidance, not astrology',
    startOver: 'Start again',
    safety: 'General guidance from public screening guidelines, not a diagnosis. Your doctor may advise a different plan. If you have symptoms, see a doctor now; do not wait for a test date.',
    privacy: 'Your answers stay on your phone. They are worked out right here and never sent to ProMedicoz or anyone else.',
    readMore: 'Read next',
    howTitle: 'How Sehat Kundli works',
    how: "Many health problems, like diabetes, high BP, early heart disease and some cancers, run in families. If a parent, brother or sister has one, your own risk is higher, and doctors usually advise starting some check-ups earlier. Sehat Kundli takes the conditions in your family, your age and whether you are a woman or a man, and shows which check-ups you need and from what age, using public screening guidelines. Parents and siblings count the most; grandparents, uncles and aunts count less. It is called a 'kundli' because it is a chart about your future that the whole family can look at, but it is medical guidance, not astrology.",
    faqTitle: 'Frequently asked questions',
    faq: [
      { q: 'Is this astrology?', a: 'No. "Kundli" is only the familiar idea of a chart about your future. Everything here comes from medical screening guidelines (for example India\'s NCD screening programme and international guidelines on family history).' },
      { q: 'Is my family\'s information saved?', a: 'No. Everything is worked out on your phone and nothing is sent to ProMedicoz. If you send the link to your brothers and sisters, the family list travels inside the link itself, after the "#", which is never sent to any server.' },
      { q: 'Why do parents and siblings matter more?', a: 'You share about half your genes with each parent, brother and sister, and often the same food and habits. Grandparents, uncles and aunts share less, so they raise your risk less.' },
      { q: 'I don\'t know my family history. What should I do?', a: 'Ask your parents or older relatives, or tick only what you are sure about. If you know nothing, follow the routine plan, which starts BP and sugar checks at 30.' },
      { q: 'Where can I get these tests?', a: 'BP, sugar and some cancer screening are free for people 30+ at government Ayushman Arogya Mandirs. Other tests can be done at any lab. A doctor can tell you which ones you need first.' },
    ],
  },
  hi: {
    seoTitle: 'Sehat Kundli: Parivaar Ki Health History Se Apna Check-up Plan (Free, Hindi)',
    seoDesc: 'Free Sehat Kundli: chunein parivaar mein kise sugar, BP, heart, thyroid, cancer ya thalassemia hai, aur dekhein aapko kaunse test kis umar se karane chahiye. Medical salaah, jyotish nahi. Phone par hi chalta hai, kuch save nahi hota.',
    kicker: 'ProMedicoz · Free · Medical salaah, jyotish nahi',
    title: 'Sehat Kundli 🪔',
    subtitle: 'Parivaar ki health history se aapka apna check-up plan',
    aboutYou: 'Aapke baare mein',
    ageLabel: 'Aapki umar (saal)',
    sexLabel: 'Aap hain',
    woman: 'Aurat', man: 'Mard',
    familyTitle: 'Parivaar mein kise hai (ya tha)…',
    familyHint: 'Jo-jo hain, sab par tap karein. Kisi ko nahi hai ya pakka nahi pata to khaali chhod dein.',
    make: 'Meri Sehat Kundli banaayein →',
    errAge: `Kripya apni umar daalein (${MIN_AGE}–${MAX_AGE}). Bachchon ke liye paediatrician se poochhein.`,
    errSex: 'Kripya aurat ya mard chunein (kuch test alag hote hain).',
    prefilled: 'Parivaar ki jaankari link se bhar di gayi hai. Bas apni umar daalein aur aurat ya mard chunein.',
    resultTitle: (age) => `Aapki Sehat Kundli (umar ${age})`,
    familyCount: (n) => (n ? `Parivaar ki wajah se ${n} check-up jaldi shuru ya extra hain` : 'Parivaar mein koi bimari nahi chuni: neeche aapka aam plan hai'),
    dueTitle: 'Abhi karaayein',
    laterTitle: 'Aage aane wale',
    fromAge: (n) => `${n} saal se`,
    momentsTitle: 'Khaas samay par',
    famTag: 'Parivaar',
    secondOnly: (list) => `Sirf dada-dadi, chacha-mama ya bua-mausi mein: ${list}. Yeh maa-baap ya bhai-behen se kam asar karta hai, isliye aam plan hi laagu hai. Doctor ko zaroor batayein.`,
    free: 'BP, sugar, aur breast, cervical aur munh ke cancer ki screening 30+ umar ke sabhi logon ke liye sarkari Ayushman Arogya Mandir mein free hai.',
    discussGp: '🩺 General Physician se baat karein',
    discussGynae: '🌸 Gynaecologist se baat karein',
    sharePic: '📤 Meri Kundli ki photo share karein',
    sharePicNote: 'Photo mein parivaar ki bimariyan dikhti hain. Sirf parivaar ke saath share karein.',
    shareFamily: '👨‍👩‍👧 Bhai-behen ko bhejein',
    shareFamilyMsg: (url) => `Maine apni Sehat Kundli banayi (free family health chart). Hamare parivaar ki history same hai, isliye tumhari bhi bhar di hai. Bas apni umar daalo:\n${url}`,
    shareToolMsg: (url) => `Sehat Kundli: free family health chart. Chuno parivaar mein kise sugar, BP, heart ya cancer hai, aur dekho kaunse test kis umar se zaroori hain:\n${url}`,
    picTitle: 'Meri Sehat Kundli',
    picFamily: 'Mere parivaar mein',
    picTests: 'Mera check-up plan',
    picMake: 'Apni free banaayein',
    picNote: 'Medical salaah, jyotish nahi',
    startOver: 'Dobara shuru karein',
    safety: 'Yeh public screening guidelines par aadhaarit aam salaah hai, diagnosis nahi. Doctor aapke liye alag plan bata sakte hain. Koi lakshan ho to abhi doctor ko dikhayein, test ki date ka intezaar na karein.',
    privacy: 'Aapke jawaab aapke phone par hi rehte hain. Sab yahin calculate hota hai aur ProMedicoz ya kisi aur ko nahi bheja jaata.',
    readMore: 'Aage padhein',
    howTitle: 'Sehat Kundli kaise kaam karti hai',
    how: "Kai bimariyan, jaise diabetes, high BP, kam umar mein heart ki bimari aur kuch cancer, parivaar mein chalti hain. Agar maa-baap ya bhai-behen ko hai, to aapka khatra bhi zyada hota hai, aur doctor aksar kuch test jaldi shuru karne ki salaah dete hain. Sehat Kundli parivaar ki bimariyan, aapki umar aur aap aurat hain ya mard, yeh dekh kar public screening guidelines ke hisaab se batati hai ki kaunse test kis umar se zaroori hain. Maa-baap aur bhai-behen sabse zyada maayne rakhte hain; dada-dadi, chacha-mama kam. Ise 'kundli' isliye kehte hain kyunki yeh aapke aage ka chart hai jise poora parivaar dekh sakta hai, lekin yeh medical salaah hai, jyotish nahi.",
    faqTitle: 'Aksar poochhe jaane wale sawaal',
    faq: [
      { q: 'Kya yeh jyotish hai?', a: 'Nahi. "Kundli" sirf aage ke chart ka jaana-pehchaana idea hai. Yahan sab kuch medical screening guidelines se hai (jaise India ka NCD screening programme aur family history par international guidelines).' },
      { q: 'Kya parivaar ki jaankari save hoti hai?', a: 'Nahi. Sab aapke phone par calculate hota hai aur ProMedicoz ko kuch nahi bheja jaata. Agar aap bhai-behen ko link bhejte hain, to parivaar ki list link ke andar hi "#" ke baad jaati hai, jo kisi server ko nahi bheji jaati.' },
      { q: 'Maa-baap aur bhai-behen zyada kyun maayne rakhte hain?', a: 'Har maa-baap aur bhai-behen ke saath aapke lagbhag aadhe genes milte hain, aur aksar khaana-peena aur aadatein bhi. Dada-dadi, chacha-mama ke saath kam milte hain, isliye unse khatra kam badhta hai.' },
      { q: 'Mujhe parivaar ki history nahi pata. Kya karein?', a: 'Maa-baap ya bade rishtedaaron se poochhein, ya sirf wahi chunein jo pakka pata ho. Kuch nahi pata to aam plan follow karein, jismein BP aur sugar check 30 saal se shuru hote hain.' },
      { q: 'Yeh test kahan karayein?', a: 'BP, sugar aur kuch cancer screening 30+ logon ke liye sarkari Ayushman Arogya Mandir mein free hai. Baaki test kisi bhi lab mein ho sakte hain. Doctor bata sakte hain ki pehle kaunse zaroori hain.' },
    ],
  },
};
