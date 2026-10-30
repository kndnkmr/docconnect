// ============================================
// Blog search: by problem, in English, Hinglish or Hindi (pure, tested)
// ============================================
// People search the way they talk: "pet dard", "पेट दर्द", "stomach pain",
// "sugar". Articles are titled in medical English ("Acidity", "Peptic
// Ulcers", "Diabetes"), so a literal word match finds almost nothing.
// So we:
//   1. map Devanagari health words to English (Hindi keyboard / 🎤 voice),
//   2. expand each word to its family of related words (stomach ↔ pet ↔
//      acidity ↔ gas ↔ ulcer…),
//   3. treat words like "pain", "dard", "problem", "kya" as optional — they
//      boost the ranking but are not required.
// Tests: tests/blogSearch.test.mjs.

const HI_WORDS = [
  [/पेट/, 'stomach'], [/दर्द/, 'pain'], [/बुखार/, 'fever'], [/खांसी|खाँसी/, 'cough'], [/जुकाम|सर्दी/, 'cold'],
  [/सिर ?दर्द|सिर/, 'headache'], [/माइग्रेन/, 'migraine'], [/शुगर|डायबिटीज|मधुमेह/, 'diabetes'],
  [/बीपी|ब्लड ?प्रेशर|रक्तचाप/, 'bp'], [/दिल|हार्ट|हृदय/, 'heart'], [/सीने|छाती/, 'chest'],
  [/गर्भ|प्रेग्नें|प्रेग्नेंसी|गर्भावस्था/, 'pregnancy'], [/माहवारी|पीरियड|मासिक/, 'period'],
  [/पीसीओडी|पीसीओएस/, 'pcos'], [/थायरा?इड/, 'thyroid'], [/त्वचा|स्किन/, 'skin'], [/बाल/, 'hair'],
  [/मुंहासे|मुहांसे|पिंपल/, 'acne'], [/आंख|आँख|नज़र|नजर/, 'eye'], [/दांत|दाँत/, 'tooth'], [/कान/, 'ear'],
  [/बच्च|शिशु|बेबी/, 'child'], [/टीका|वैक्सीन/, 'vaccine'], [/नींद/, 'sleep'], [/तनाव|टेंशन|चिंता/, 'stress'],
  [/उदास|डिप्रेशन/, 'depression'], [/कमर/, 'back'], [/घुटन/, 'knee'], [/जोड़/, 'joint'], [/हड्डी/, 'bone'],
  [/गैस|एसिडिटी|जलन/, 'acidity'], [/दस्त|लूज़ मोशन/, 'diarrhea'], [/कब्ज/, 'constipation'], [/उल्टी/, 'vomiting'],
  [/सांस|साँस|दमा|अस्थमा/, 'asthma'], [/किडनी|गुर्दा/, 'kidney'], [/पेशाब|यूरिन/, 'urine'],
  [/पथरी/, 'stone'], [/एलर्जी/, 'allergy'], [/वज़न|वजन|मोटापा/, 'weight'], [/खून की कमी|एनीमिया/, 'anaemia'],
  [/कैंसर/, 'cancer'], [/लिवर|जिगर/, 'liver'], [/चक्कर/, 'dizziness'], [/कोलेस्ट्रॉल/, 'cholesterol'],
];

// Families of words that mean (roughly) the same problem. Any one matching
// counts. Terms match from the start of a word ("back" ≠ "feedback");
// short ones (≤3 letters) must be the whole word ("gas" ≠ "gastric").
const FAMILIES = [
  ['stomach', 'pet', 'gut', 'abdomen', 'abdominal', 'belly', 'digestion', 'digestive', 'acidity', 'gas', 'peptic', 'ibs', 'bloating', 'gastritis', 'indigestion'],
  ['diabetes', 'sugar', 'diabetic', 'glucose', 'madhumeh', 'hba1c', 'insulin'],
  ['bp', 'blood pressure', 'hypertension', 'pressure'],
  ['heart', 'dil', 'cardiac', 'chest'],
  ['fever', 'bukhar', 'dengue', 'malaria', 'typhoid', 'viral'],
  ['cough', 'khansi', 'cold', 'jukam', 'flu', 'sore throat', 'throat'],
  ['headache', 'sir dard', 'migraine'],
  ['period', 'menstrual', 'menstruation', 'mahwari', 'pcos', 'pcod'],
  ['pregnancy', 'pregnant', 'garbh', 'garbhavastha', 'prenatal', 'trimester'],
  ['child', 'children', 'kids', 'kid', 'baby', 'babies', 'bachcha', 'bacche', 'bachche', 'infant', 'newborn', 'toddler'],
  ['vaccine', 'vaccination', 'teeka', 'tika', 'immunization'],
  ['skin', 'twacha', 'acne', 'pimple', 'rash', 'eczema'],
  ['hair', 'baal', 'hairfall', 'dandruff', 'baldness'],
  ['weight', 'obesity', 'motapa', 'belly fat', 'vajan', 'wajan'],
  ['stress', 'anxiety', 'tension', 'chinta', 'mental', 'panic'],
  ['depression', 'udaas', 'udas', 'sad', 'mood'],
  ['sleep', 'neend', 'insomnia'],
  ['back', 'kamar', 'spine', 'slip disc', 'sciatica'],
  ['joint', 'knee', 'ghutna', 'ghutne', 'arthritis', 'bone', 'haddi', 'osteoporosis'],
  ['kidney', 'gurda', 'urine', 'peshab', 'uti', 'urinary'],
  ['stone', 'pathri'],
  ['eye', 'eyes', 'aankh', 'aankhen', 'vision', 'nazar'],
  ['ear', 'kaan', 'hearing'],
  ['tooth', 'teeth', 'dental', 'daant', 'gum', 'gums'],
  ['thyroid'],
  ['liver', 'fatty liver', 'jigar', 'hepatitis', 'jaundice', 'piliya'],
  ['asthma', 'breath', 'breathing', 'saans', 'lungs', 'dama'],
  ['vomiting', 'ulti', 'nausea'],
  ['diarrhea', 'diarrhoea', 'loose motion', 'loose motions', 'dast'],
  ['constipation', 'kabz', 'kabj', 'qabz'],
  ['anaemia', 'anemia', 'khoon ki kami', 'haemoglobin', 'hemoglobin'],
  ['cholesterol', 'lipid'],
  ['dizziness', 'chakkar', 'vertigo'],
  ['allergy', 'allergic'],
];

// Help the ranking but never required on their own.
const OPTIONAL = new Set(['pain', 'pains', 'ache', 'dard', 'problem', 'problems', 'issue', 'symptom', 'symptoms', 'sign', 'signs',
  'treatment', 'cure', 'ilaj', 'ilaaj', 'jhadna', 'jhadte', 'girna', 'girte', 'nahi', 'aati', 'aata', 'remedy', 'remedies', 'home', 'causes', 'cause', 'tips']);
// Too common to mean anything.
const STOP = new Set(['kya', 'hai', 'ka', 'ki', 'ke', 'ko', 'me', 'mein', 'se', 'aur', 'and', 'the', 'of', 'in', 'for', 'how', 'to',
  'what', 'is', 'my', 'a', 'an', 'on', 'with', 'kaise', 'kyu', 'kyon', 'hota', 'hoti', 'mera', 'meri', 'mujhe']);

const FAMILY_OF = new Map();
for (const fam of FAMILIES) for (const w of fam) FAMILY_OF.set(w, fam);
const PHRASES = FAMILIES.flat().filter((w) => w.includes(' ')).sort((a, b) => b.length - a.length);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasTerm = (text, term) => new RegExp(`\\b${escapeRe(term)}${term.length <= 3 ? "\\b" : ""}`).test(text);

// Query → plain search words (kept for tests / debugging).
export function searchWords(query) {
  let q = String(query || '').trim();
  if (!q) return [];
  const extra = [];
  for (const [re, en] of HI_WORDS) if (re.test(q)) extra.push(en);
  q = q.replace(/[\u0900-\u097F]+/g, ' '); // Devanagari handled by the map above
  return [...q.toLowerCase().split(/[^a-z0-9]+/), ...extra]
    .filter((w) => w.length >= 2 && !STOP.has(w))
    .filter((w, i, a) => a.indexOf(w) === i);
}

// Query → groups of alternatives: [{ terms: [...], optional }].
export function searchGroups(query) {
  let q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const groups = [];
  const seen = new Set();
  const addFam = (fam, typed, optional = false) => {
    const key = fam.join("|");
    if (!seen.has(key)) { seen.add(key); groups.push({ terms: fam, typed, optional }); }
  };
  // Multi-word phrases first ("loose motion", "blood pressure").
  for (const p of PHRASES) {
    if (q.includes(p)) { addFam(FAMILY_OF.get(p), p); q = q.split(p).join(' '); }
  }
  for (const w of searchWords(q)) {
    if (OPTIONAL.has(w)) { addFam([w, ...(w === "dard" || w.startsWith("pain") || w === "ache" ? ["pain", "ache", "dard"] : [])], w, true); continue; }
    // Exact family word, or a plural/ending of one ("periods" → period).
    const fam = FAMILY_OF.get(w) || (w.length >= 5 && FAMILY_OF.get(w.replace(/(es|s)$/, '')));
    addFam(fam || [w], w);
  }
  return groups;
}

// Score how well an article matches (0 = no match). Title words count most.
export function scoreArticle(a, groups, titleHi = '') {
  if (!groups.length) return 0;
  const title = `${a.title} ${titleHi}`.toLowerCase();
  const rest = `${a.description || ''} ${a.specialization || ''}`.toLowerCase();
  const required = groups.filter((g) => !g.optional);
  const mustAll = required.length ? required : groups; // "pain" alone → required
  let score = 0; let hits = 0;
  for (const g of groups) {
    // The exact word typed beats a related word.
    const exact = g.typed || g.terms[0];
    const inTitle = g.terms.some((t) => hasTerm(title, t));
    const inRest = !inTitle && g.terms.some((t) => hasTerm(rest, t));
    if (inTitle) score += hasTerm(title, exact) ? 4 : 3; else if (inRest) score += 1;
    if ((inTitle || inRest) && mustAll.includes(g)) hits += 1;
  }
  // Need every real word for 1–2 word searches, most of them for longer ones.
  const need = mustAll.length <= 2 ? mustAll.length : Math.ceil(mustAll.length * 0.6);
  return hits >= need ? score : 0;
}

export function searchArticles(articles, query, titlesHi = {}) {
  const groups = searchGroups(query);
  if (!groups.length) return [];
  return articles
    .map((a) => ({ a, s: scoreArticle(a, groups, titlesHi[a.slug] || '') }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || new Date(y.a.publishedDate) - new Date(x.a.publishedDate))
    .map((x) => x.a);
}
