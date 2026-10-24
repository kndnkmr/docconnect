// ============================================
// Baby vaccination schedule — shared data, logic + copy
// ============================================
// Plain JS (no JSX) on purpose: imported by BOTH the page component
// (VaccinationSchedule.jsx) and the build-time prerender script, so the text
// crawlers read is exactly the text users see. Edit the schedule/copy here only.
//
// SOURCE: India's National Immunization Schedule under the Universal
// Immunization Programme (UIP, Ministry of Health & Family Welfare), including
// the 2023 addition of a 3rd fractional IPV dose at 9 months and PCV now given
// nationwide. JE is given only in notified endemic districts. Vaccines in
// PRIVATE_EXTRAS are NOT in the free government schedule; they are listed by
// name only (no ages/doses) until a ProMedicoz paediatrician signs them off.
//
// Dates are the EARLIEST recommended date for each visit. Nothing is stored or
// sent: ticks are saved only in this browser (localStorage).

import { parseISODate, todayUTC, toISO, formatDate } from './dueDate.js';

export { todayUTC, toISO, formatDate };
export const TOOL_PATH = '/tools/vaccination-schedule';
export const MAX_AGE_YEARS = 17;
const DAY = 86400000;

// Vaccine names stay the same in both languages (that's how they're written on
// the government MCP card); only the short note is translated.
const V = (id, name, en, hi, extra = {}) => ({ id, name, note: { en, hi }, ...extra });
const NOTE = {
  bcg: ['protects against TB', 'TB se bachaav'],
  opv: ['polio drops', 'polio ki boondein'],
  hepb: ['Hepatitis B (liver infection)', 'Hepatitis B (liver infection)'],
  penta: ['5-in-1 injection: DPT + Hep B + Hib', '5-in-1 injection: DPT + Hep B + Hib'],
  rvv: ['drops against severe diarrhoea', 'tez dast (diarrhoea) se bachaav ki boondein'],
  fipv: ['polio injection (small dose)', 'polio ka injection (chhota dose)'],
  pcv: ['protects against pneumonia', 'pneumonia se bachaav'],
  mr: ['measles (khasra) & rubella', 'khasra (measles) aur rubella'],
  je: ['Japanese encephalitis, only in some districts', 'Japanese encephalitis, sirf kuch zilon mein'],
  vita: ['not a vaccine: vitamin A dose', 'vaccine nahi: vitamin A ki khuraak'],
  dpt: ['diphtheria, whooping cough, tetanus', 'diphtheria, kaali khaansi, tetanus'],
  td: ['tetanus & diphtheria', 'tetanus aur diphtheria'],
};
const v = (id, name, k, extra) => V(id, name, NOTE[k][0], NOTE[k][1], extra);

// Each visit: when it falls (days OR months after birth), optional end of the
// recommended window, and its vaccines. `optional` items (district-only) don't
// count towards "done".
export const SCHEDULE = [
  { key: 'birth', days: 0, label: { en: 'At birth', hi: 'Janm par' },
    vaccines: [v('bcg', 'BCG', 'bcg'), v('opv0', 'OPV-0', 'opv'), v('hepb0', 'Hepatitis B (birth dose)', 'hepb')] },
  { key: '6w', days: 42, label: { en: '6 weeks', hi: '6 hafte' },
    vaccines: [v('opv1', 'OPV-1', 'opv'), v('penta1', 'Pentavalent-1', 'penta'), v('rvv1', 'Rotavirus-1', 'rvv'), v('fipv1', 'fIPV-1', 'fipv'), v('pcv1', 'PCV-1', 'pcv')] },
  { key: '10w', days: 70, label: { en: '10 weeks', hi: '10 hafte' },
    vaccines: [v('opv2', 'OPV-2', 'opv'), v('penta2', 'Pentavalent-2', 'penta'), v('rvv2', 'Rotavirus-2', 'rvv')] },
  { key: '14w', days: 98, label: { en: '14 weeks', hi: '14 hafte' },
    vaccines: [v('opv3', 'OPV-3', 'opv'), v('penta3', 'Pentavalent-3', 'penta'), v('fipv2', 'fIPV-2', 'fipv'), v('rvv3', 'Rotavirus-3', 'rvv'), v('pcv2', 'PCV-2', 'pcv')] },
  { key: '9m', months: 9, untilMonths: 12, label: { en: '9–12 months', hi: '9–12 mahine' },
    vaccines: [v('mr1', 'MR-1', 'mr'), v('pcvb', 'PCV booster', 'pcv'), v('fipv3', 'fIPV-3', 'fipv'), v('vita1', 'Vitamin A (1st dose)', 'vita'), v('je1', 'JE-1', 'je', { optional: true })] },
  { key: '16m', months: 16, untilMonths: 24, label: { en: '16–24 months', hi: '16–24 mahine' },
    vaccines: [v('mr2', 'MR-2', 'mr'), v('dptb1', 'DPT booster-1', 'dpt'), v('opvb', 'OPV booster', 'opv'), v('vita2', 'Vitamin A (2nd dose, then every 6 months till 5 years)', 'vita'), v('je2', 'JE-2', 'je', { optional: true })] },
  { key: '5y', months: 60, untilMonths: 72, label: { en: '5–6 years', hi: '5–6 saal' },
    vaccines: [v('dptb2', 'DPT booster-2', 'dpt')] },
  { key: '10y', months: 120, label: { en: '10 years', hi: '10 saal' },
    vaccines: [v('td10', 'Td', 'td')] },
  { key: '16y', months: 192, label: { en: '16 years', hi: '16 saal' },
    vaccines: [v('td16', 'Td', 'td')] },
];

// Not in the free government schedule — names only, no dates (see header).
export const PRIVATE_EXTRAS = ['Flu (influenza, yearly)', 'Typhoid', 'Hepatitis A', 'Chickenpox (varicella)', 'MMR', 'HPV (girls & boys, 9+ years)'];

// Add calendar months, clamping the day (31 Aug + 6 months -> 28/29 Feb).
export function addMonths(t, n) {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(d.getUTCDate(), last));
}

function monthsBetween(a, b) {
  const x = new Date(a); const y = new Date(b);
  return (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + (y.getUTCMonth() - x.getUTCMonth()) - (y.getUTCDate() < x.getUTCDate() ? 1 : 0);
}

// Core calculation. Returns { error } or { dob, age, visits }.
export function calculate(dobStr, today = todayUTC()) {
  const dob = parseISODate(dobStr);
  if (!dob) return { error: 'invalid' };
  if (dob > today) return { error: 'future' };
  if (addMonths(dob, MAX_AGE_YEARS * 12) < today) return { error: 'tooOld' };
  const days = Math.round((today - dob) / DAY);
  const months = monthsBetween(dob, today);
  const age = days < 98
    ? { kind: 'weeks', w: Math.floor(days / 7), d: days % 7 }
    : months < 24 ? { kind: 'months', m: months } : { kind: 'years', y: Math.floor(months / 12), m: months % 12 };
  const visits = SCHEDULE.map((s) => {
    const date = s.months != null ? addMonths(dob, s.months) : dob + s.days * DAY;
    const until = s.untilMonths != null ? addMonths(dob, s.untilMonths) : null;
    return { ...s, date, until };
  });
  return { dob, age, visits };
}

// Status of each visit given the set of ticked vaccine ids:
//   done    all required vaccines ticked
//   now     inside a recommended window (e.g. 16–24 months) and not done
//   check   date has passed and not all ticked (given? tick; missed? see doctor)
//   next    the first upcoming visit
//   later   everything after that
export function visitStatuses(visits, ticked, today = todayUTC()) {
  let nextFound = false;
  return visits.map((x) => {
    const required = x.vaccines.filter((vac) => !vac.optional);
    if (required.every((vac) => ticked.has(vac.id))) return 'done';
    if (x.until && today >= x.date && today <= x.until) return 'now';
    if (x.date < today) return 'check';
    if (!nextFound) { nextFound = true; return 'next'; }
    return 'later';
  });
}

// Calendar file (.ics): one all-day event per upcoming visit, with a reminder
// the evening before. Built on the phone and downloaded — nothing is sent.
const icsDate = (t) => toISO(t).replace(/-/g, '');
const icsText = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`);
export function buildIcs(result, lang = 'en', today = todayUTC(), now = new Date()) {
  const c = COPY[lang] || COPY.en;
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ProMedicoz//Vaccination Schedule//EN', 'CALSCALE:GREGORIAN'];
  for (const x of result.visits) {
    if (x.date < today) continue;
    const summary = icsText(c.icsTitle(x.label[lang] || x.label.en));
    lines.push(
      'BEGIN:VEVENT',
      `UID:vax-${x.key}-${icsDate(result.dob)}@promedicoz.in`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(x.date)}`,
      `DTEND;VALUE=DATE:${icsDate(x.date + DAY)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${icsText(x.vaccines.map((vac) => vac.name).join(', '))}\\n${icsText(c.icsNote)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${summary}`, 'TRIGGER:-PT15H', 'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// Articles suggested under the result (slugs from blogData.js).
export const RELATED_ARTICLES = [
  'childhood-vaccines-schedule-why-they-matter-guide',
  'new-parent-baby-first-year-health-guide',
  'newborn-baby-common-concerns-guide',
  'fever-in-children-when-to-worry-guide',
  'measles-khasra-children-symptoms-vaccine-guide',
  'whooping-cough-pertussis-severe-cough-babies-vaccine-guide',
];

export const COPY = {
  en: {
    seoTitle: 'Baby Vaccination Schedule India — Vaccine Dates by Birth Date (Free, Hindi & English)',
    seoDesc: "Free baby vaccination chart for India: enter your baby's date of birth to see every vaccine in the government schedule (UIP) with its exact date, from birth to 16 years. Tick doses as they're given. Private — nothing is sent.",
    kicker: 'ProMedicoz · Free · Govt. schedule (UIP)',
    title: 'Baby Vaccination Schedule',
    subtitle: 'Every vaccine with its exact date',
    dobLabel: "Baby's date of birth",
    calc: 'Show vaccine dates →',
    errInvalid: 'Please choose a valid date.',
    errFuture: 'This date is in the future. Please enter the date of birth.',
    errTooOld: 'This schedule is for children up to 16 years. For adult vaccines, please talk to a doctor.',
    age: (a) => a.kind === 'weeks'
      ? `Baby is ${a.w} week${a.w === 1 ? '' : 's'}${a.d ? ` ${a.d} day${a.d === 1 ? '' : 's'}` : ''} old`
      : a.kind === 'months' ? `Baby is ${a.m} month${a.m === 1 ? '' : 's'} old`
        : `Child is ${a.y} year${a.y === 1 ? '' : 's'}${a.m ? ` ${a.m} month${a.m === 1 ? '' : 's'}` : ''} old`,
    nextLabel: 'Next vaccines due',
    nowLabel: 'Vaccines due now',
    nowUntil: (d) => `Recommended by ${d}`,
    inDays: (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`),
    countVaccines: (n) => `${n} vaccine${n === 1 ? '' : 's'}`,
    allDone: 'All vaccines in the schedule are ticked. Well done!',
    unticked: (n) => `${n} earlier visit${n === 1 ? '' : 's'} not ticked yet`,
    tickAllPast: 'All earlier vaccines given? Tick them all',
    from: (d) => `from ${d}`,
    nextTag: 'NEXT',
    nowTag: 'DUE NOW',
    checkNote: 'Given? Tick them. Missed? Most can still be given, see a doctor.',
    districts: 'only in some districts',
    extrasTitle: 'Also offered privately (ask your doctor)',
    extrasText: 'Not in the free government schedule, but many paediatricians recommend them:',
    addCal: '📅 Add all reminders to my calendar',
    calDone: 'Calendar file downloaded — open it to add the reminders.',
    share: '💬 Share this free tool',
    shareMsg: (url) => `Free baby vaccination schedule 💉 Enter the date of birth and see every vaccine date (govt. schedule). Hindi + English, nothing is saved:\n${url}`,
    doctor: '👶 See a paediatrician',
    tickSaved: 'Ticks are saved only on this phone, never sent to us.',
    icsTitle: (l) => `Baby vaccines: ${l} visit`,
    icsNote: 'From the ProMedicoz vaccination schedule (govt. UIP). Confirm with your doctor.',
    safety: "Based on India's government schedule (UIP). Your paediatrician may adjust it for your child. Missed a dose? Most vaccines can still be given, so please see a doctor. Government vaccines are free at government health centres and Anganwadis.",
    privacy: 'Private: calculated on your phone. Nothing is stored or sent.',
    readMore: 'Read next',
    faqTitle: 'Frequently asked questions',
    howTitle: 'About this schedule',
    how: "This is India's National Immunization Schedule under the Universal Immunization Programme (UIP). It protects children against diseases like TB, polio, diphtheria, whooping cough, tetanus, hepatitis B, Hib, pneumonia, rotavirus diarrhoea, measles and rubella. The dates shown are the earliest recommended date for each visit, counted from your baby's date of birth. Keep your child's Mother and Child Protection (MCP) card and take it to every visit.",
    faq: [
      { q: 'Are these vaccines free?', a: 'Yes. All vaccines in the government schedule (UIP) are free at government hospitals, health centres and Anganwadi sessions. Private hospitals charge for them.' },
      { q: 'What if my baby missed a vaccine?', a: "Don't worry. Most vaccines can still be given late as a catch-up dose. Show your child's vaccination card to a doctor or health worker and they will plan the missed doses." },
      { q: 'Is it normal for my baby to get fever after a vaccine?', a: 'A mild fever, fussiness or a sore spot for a day or two is common. See a doctor if the fever is high, lasts more than two days, or your baby seems very unwell.' },
      { q: 'Can several vaccines be given on the same day?', a: 'Yes. Giving them together at the same visit is safe and recommended. It means fewer trips and protects your baby sooner.' },
      { q: 'Are private vaccines needed?', a: 'Some extra vaccines such as flu, typhoid, hepatitis A and chickenpox are available privately. Ask your paediatrician which ones suit your child.' },
    ],
  },
  hi: {
    seoTitle: 'Baby Ko Teeka Kab Lagega? Vaccination Chart India (Hindi)',
    seoDesc: 'Free baby vaccination chart Hindi mein: baby ki janm tithi daalein aur sarkari teekakaran schedule (UIP) ka har teeka uski date ke saath dekhein, janm se 16 saal tak. Kuch bhi save ya send nahi hota.',
    kicker: 'ProMedicoz · Free · Sarkari schedule (UIP)',
    title: 'Baby ko teeka kab lagega? 💉',
    subtitle: 'Har vaccine ki sahi date — Hindi mein',
    dobLabel: 'Baby ki janm tithi (date of birth)',
    calc: 'Vaccine ki dates dekhein →',
    errInvalid: 'Kripya sahi date chunein.',
    errFuture: 'Yeh date aage ki hai. Kripya janm tithi daalein.',
    errTooOld: 'Yeh schedule 16 saal tak ke bachchon ke liye hai. Badon ke vaccine ke liye doctor se baat karein.',
    age: (a) => a.kind === 'weeks'
      ? `Baby ${a.w} hafte${a.d ? ` ${a.d} din` : ''} ka hai`
      : a.kind === 'months' ? `Baby ${a.m} mahine ka hai`
        : `Bachcha ${a.y} saal${a.m ? ` ${a.m} mahine` : ''} ka hai`,
    nextLabel: 'Agle teeke',
    nowLabel: 'Abhi lagne wale teeke',
    nowUntil: (d) => `${d} tak lagwa lein`,
    inDays: (n) => (n === 0 ? 'aaj' : n === 1 ? 'kal' : `${n} din mein`),
    countVaccines: (n) => `${n} vaccine`,
    allDone: 'Schedule ke saare teeke tick ho gaye. Bahut badhiya!',
    unticked: (n) => `${n} pichhli visit abhi tick nahi hui`,
    tickAllPast: 'Pichhle saare teeke lag chuke hain? Sab tick karein',
    from: (d) => `${d} se`,
    nextTag: 'AGLA',
    nowTag: 'ABHI',
    checkNote: 'Lag gaye? Tick karein. Chhoot gaye? Zyaadaatar baad mein bhi lag sakte hain, doctor se milein.',
    districts: 'sirf kuch zilon mein',
    extrasTitle: 'Private mein bhi milte hain (doctor se poochhein)',
    extrasText: 'Yeh free sarkari schedule mein nahi hain, par kai bachchon ke doctor inki salah dete hain:',
    addCal: '📅 Saare reminder calendar mein lagayein',
    calDone: 'Calendar file download ho gayi — reminder ke liye use kholein.',
    share: '💬 Yeh free tool share karein',
    shareMsg: (url) => `Baby ke teekon ka free schedule 💉 Janm tithi daalein aur har vaccine ki date dekhein (sarkari schedule). Hindi mein bhi, kuch bhi save nahi hota:\n${url}`,
    doctor: '👶 Bachchon ke doctor se milein',
    tickSaved: 'Tick sirf is phone par save hote hain, hamein kabhi nahi bheje jaate.',
    icsTitle: (l) => `Baby ke teeke: ${l}`,
    icsNote: 'ProMedicoz vaccination schedule (sarkari UIP) se. Doctor se confirm karein.',
    safety: 'Yeh Bharat sarkar ke schedule (UIP) par aadhaarit hai. Aapke bachche ke doctor ise badal sakte hain. Koi teeka chhoot gaya? Zyaadaatar teeke baad mein bhi lag sakte hain, doctor se milein. Sarkari teeke sarkari health centre aur Anganwadi mein free lagte hain.',
    privacy: 'Private: calculation aapke phone par hoti hai. Kuch bhi save ya send nahi hota.',
    readMore: 'Aage padhein',
    faqTitle: 'Aksar poochhe jaane wale sawaal',
    howTitle: 'Is schedule ke baare mein',
    how: 'Yeh Universal Immunization Programme (UIP) ke tahat Bharat ka National Immunization Schedule hai. Yeh bachchon ko TB, polio, diphtheria, kaali khaansi, tetanus, hepatitis B, Hib, pneumonia, rotavirus dast, khasra aur rubella jaisi beemariyon se bachaata hai. Dikhaayi gayi dates har visit ki sabse pehli salah di gayi date hain, jo baby ki janm tithi se gini jaati hain. Bachche ka Mother and Child Protection (MCP) card sambhaal kar rakhein aur har visit par saath le jaayein.',
    faq: [
      { q: 'Kya yeh teeke free hain?', a: 'Haan. Sarkari schedule (UIP) ke saare teeke sarkari hospital, health centre aur Anganwadi mein free lagte hain. Private hospital inke paise lete hain.' },
      { q: 'Agar baby ka koi teeka chhoot gaya to?', a: 'Chinta na karein. Zyaadaatar teeke baad mein catch-up dose ki tarah lag sakte hain. Bachche ka vaccination card doctor ya health worker ko dikhayein, woh chhoote hue teekon ka plan banayenge.' },
      { q: 'Teeke ke baad bukhaar aana normal hai?', a: 'Halka bukhaar, chidchidapan ya teeke ki jagah par dard ek-do din tak aam baat hai. Agar bukhaar tez ho, do din se zyaada rahe, ya baby bahut beemar lage to doctor ko dikhayein.' },
      { q: 'Kya ek din mein kai teeke lag sakte hain?', a: 'Haan. Ek hi visit mein saath lagwana surakshit hai aur iski salah di jaati hai. Isse chakkar kam lagte hain aur baby jaldi surakshit hota hai.' },
      { q: 'Kya private teeke zaroori hain?', a: 'Flu, typhoid, hepatitis A aur chickenpox jaise kuch extra teeke private mein milte hain. Apne bachche ke doctor se poochhein ki kaun se aapke bachche ke liye theek hain.' },
    ],
  },
};
