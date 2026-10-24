// ============================================
// Pregnancy due-date calculator — shared logic + copy
// ============================================
// Plain JS (no JSX) on purpose: imported by BOTH the page component
// (DueDateCalculator.jsx) and the build-time prerender script, so the text
// crawlers read is exactly the text users see. Edit copy here only.
//
// MEDICAL BASIS (standard, widely used): Naegele's rule — estimated due date =
// first day of the last menstrual period (LMP) + 280 days, shifted by
// (cycle length − 28) days for longer/shorter regular cycles. Gestational age
// is counted the same way. It is an ESTIMATE; an ultrasound (especially in the
// first trimester) is what doctors use to confirm dating. Every result in the
// UI says so. Nothing is stored or sent anywhere — all calculation runs in the
// browser.

export const TOOL_PATH = '/tools/due-date-calculator';
export const MIN_CYCLE = 21;
export const MAX_CYCLE = 35;
const DAY = 86400000;

// Parse "YYYY-MM-DD" as a UTC calendar date (avoids timezone/DST off-by-one).
export function parseISODate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  return d.getUTCMonth() === +m[2] - 1 ? t : null; // rejects 2026-02-31 etc.
}

// Today's calendar date in the user's local time, as a UTC timestamp.
export function todayUTC(now = new Date()) {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

export function toISO(t) {
  return new Date(t).toISOString().slice(0, 10);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// "2027-03" -> "March 2027" (null if malformed). Month names stay English in
// both languages — that is how they are commonly written in Hinglish too.
export function monthLabel(key) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(key || ''));
  if (!m || +m[2] < 1 || +m[2] > 12) return null;
  return `${MONTHS[+m[2] - 1]} ${m[1]}`;
}

// "19 March 2027" — same format in both languages (month names are commonly
// written in English in Hinglish too).
export function formatDate(t) {
  return new Date(t).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

// Core calculation. Returns { error } or the full result.
export function calculate(lmpStr, cycleLen = 28, today = todayUTC()) {
  const lmp = parseISODate(lmpStr);
  if (!lmp) return { error: 'invalid' };
  const cycle = Math.min(MAX_CYCLE, Math.max(MIN_CYCLE, Number(cycleLen) || 28));
  if (lmp > today) return { error: 'future' };
  const shift = (cycle - 28) * DAY;
  const due = lmp + 280 * DAY + shift;
  const gaDays = Math.floor((today - lmp - shift) / DAY);
  if (gaDays > 44 * 7) return { error: 'tooOld' }; // LMP too long ago to be a current pregnancy
  const weeks = Math.max(0, Math.floor(gaDays / 7));
  const days = Math.max(0, gaDays % 7);
  const trimester = weeks < 14 ? 1 : weeks < 28 ? 2 : 3;
  const d = new Date(due);
  const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return {
    due, weeks, days, trimester, monthKey,
    early: gaDays < 14,            // before conception is even likely
    pastDue: today > due,          // due date already passed
    daysLeft: Math.max(0, Math.round((due - today) / DAY)),
  };
}

// Approximate baby size by week, compared to familiar foods. Deliberately no
// centimetres (they vary by source and measurement method) — just a fun,
// rough comparison, labelled "lagbhag / about". Index = completed weeks.
export const WEEK_SIZES = {
  4: { en: 'a poppy seed', hi: 'khaskhas ka daana' },
  5: { en: 'a sesame seed', hi: 'til ka daana' },
  6: { en: 'a lentil', hi: 'masoor daal ka daana' },
  7: { en: 'a blueberry', hi: 'chhota jamun' },
  8: { en: 'a kidney bean', hi: 'rajma ka daana' },
  9: { en: 'a grape', hi: 'angoor' },
  10: { en: 'a date (khajoor)', hi: 'khajoor' },
  11: { en: 'a fig', hi: 'anjeer' },
  12: { en: 'a lime', hi: 'nimbu' },
  13: { en: 'a pea pod', hi: 'matar ki phali' },
  14: { en: 'a lemon', hi: 'bada nimbu' },
  15: { en: 'an apple', hi: 'seb' },
  16: { en: 'a guava', hi: 'amrood' },
  17: { en: 'a turnip', hi: 'shalgam' },
  18: { en: 'a bell pepper', hi: 'shimla mirch' },
  19: { en: 'a mango', hi: 'aam' },
  20: { en: 'a banana', hi: 'kela' },
  21: { en: 'a carrot', hi: 'gaajar' },
  22: { en: 'a small papaya', hi: 'chhota papita' },
  23: { en: 'a sweet lime (mosambi)', hi: 'mosambi' },
  24: { en: 'an ear of corn', hi: 'bhutta' },
  25: { en: 'a cauliflower', hi: 'phool gobhi' },
  26: { en: 'a small cabbage', hi: 'chhoti patta gobhi' },
  27: { en: 'a cabbage', hi: 'patta gobhi' },
  28: { en: 'a brinjal (aubergine)', hi: 'baingan' },
  29: { en: 'a small pumpkin', hi: 'chhota kaddu' },
  30: { en: 'a large cucumber', hi: 'badi kakdi' },
  31: { en: 'a coconut', hi: 'nariyal' },
  32: { en: 'a pineapple', hi: 'anaanas' },
  33: { en: 'a small melon', hi: 'chhota kharbooja' },
  34: { en: 'a muskmelon', hi: 'kharbooja' },
  35: { en: 'a bottle gourd (lauki)', hi: 'lauki' },
  36: { en: 'a large papaya', hi: 'bada papita' },
  37: { en: 'a bunch of bananas', hi: 'kelon ka guchha' },
  38: { en: 'a pumpkin', hi: 'kaddu' },
  39: { en: 'a small watermelon', hi: 'chhota tarbooz' },
  40: { en: 'a watermelon', hi: 'tarbooz' },
};
export function sizeForWeek(w) {
  if (w < 4) return null;
  return WEEK_SIZES[Math.min(40, w)];
}

// Pregnancy articles to suggest under the result (slugs from blogData.js).
export const RELATED_ARTICLES = [
  'early-pregnancy-signs-first-trimester-care-guide',
  'antenatal-care-pregnancy-checkups-what-to-expect-guide',
  'pregnancy-diet-nutrition-trimester-guide',
  'pregnancy-scans-ultrasound-what-to-expect-guide',
  'vaccines-in-pregnancy-what-is-recommended-guide',
  'gestational-diabetes-pregnancy-sugar-guide',
];

// All visible copy, English + Hinglish (Roman script, same style as the
// blog's Hindi versions).
export const COPY = {
  en: {
    seoTitle: 'Pregnancy Due Date Calculator — Free, in English & Hindi',
    seoDesc: 'Free pregnancy due date calculator: enter the first day of your last period to see your estimated due date, how many weeks pregnant you are, and your trimester. Nothing is stored.',
    kicker: 'ProMedicoz · Free tool',
    title: 'When is my baby due?',
    subtitle: 'Pregnancy due date calculator',
    sharedBanner: (m) => `Someone close to you shared happy news: a little one is expected in ${m}! 🎉 Find your own due date below.`,
    lmpLabel: 'First day of your last period (LMP)',
    cycleLabel: 'How long is your cycle?',
    cycleDays: (n) => `${n} days${n === 28 ? ' (most common)' : ''}`,
    cycleHelp: 'Not sure? Leave it at 28 days.',
    calc: 'Find my due date →',
    errInvalid: 'Please choose a valid date.',
    errFuture: 'This date is in the future. Please choose the first day of your LAST period.',
    errTooOld: 'This date is more than 44 weeks ago, so it can’t be a current pregnancy. Please check the date.',
    resultLabel: 'Your estimated due date',
    weeksNow: (w, d) => `Now: ${w} week${w === 1 ? '' : 's'}${d ? ` ${d} day${d === 1 ? '' : 's'}` : ''}`,
    trimester: (t) => ['', '1st trimester', '2nd trimester', '3rd trimester'][t],
    weekOf: (w) => `Week ${Math.min(w, 40)} of 40`,
    daysLeft: (n) => `About ${n} day${n === 1 ? '' : 's'} to go`,
    size: (s) => `This week your baby is about the size of ${s}`,
    early: 'It may be too early for a home pregnancy test. Tests are most reliable from the day your period is due.',
    pastDue: 'Your estimated due date has passed. Please stay in touch with your doctor.',
    share: '💬 Tell the family',
    doctor: '👩‍⚕️ See a gynaecologist',
    shareMsg: (m, url) => `Happy news! 🎉 Our little one is expected in ${m} 👶\n\nFind your own due date — free, in English & Hindi:\n${url}`,
    copied: 'Message copied — paste it in WhatsApp!',
    safety: 'This is an estimate only. Your doctor confirms the date with an ultrasound. Please see a gynaecologist in the first trimester. If you have bleeding or severe pain, go to the nearest hospital straight away.',
    privacy: 'Private: calculated on your phone. Nothing is stored or sent.',
    readMore: 'Read next',
    faqTitle: 'Frequently asked questions',
    howTitle: 'How the due date is calculated',
    how: 'Doctors estimate the due date by adding 280 days (40 weeks) to the first day of your last period, and adjust it for cycles longer or shorter than 28 days. Pregnancy weeks are counted from that same day — so at conception you are already about 2 weeks pregnant. Only about 1 in 20 babies arrive exactly on the due date; most come within two weeks either side.',
    faq: [
      { q: 'How accurate is a due date calculator?', a: 'It gives a good estimate if your cycles are regular and you remember the date of your last period. An early ultrasound is more accurate, which is why your doctor may change the date after your first scan.' },
      { q: 'How many weeks pregnant am I?', a: 'Pregnancy weeks are counted from the first day of your last period, not from conception. Enter that date above to see your weeks and trimester.' },
      { q: 'What if my periods are irregular?', a: 'With irregular cycles the calculator is less reliable. Your gynaecologist will usually date the pregnancy with an ultrasound instead.' },
      { q: 'When should I first see a doctor?', a: 'As soon as you know you are pregnant, ideally within the first trimester. Your doctor will plan check-ups, tests and supplements such as folic acid.' },
    ],
    langToggleHint: 'हिंदी में देखें',
  },
  hi: {
    seoTitle: 'Meri Due Date Kab Hai? Pregnancy Due Date Calculator (Hindi)',
    seoDesc: 'Free pregnancy due date calculator Hindi mein: aakhri period ka pehla din daalein aur jaanein anumaanit due date, pregnancy kitne hafte ki hai aur kaun si timaahi. Kuch bhi save nahi hota.',
    kicker: 'ProMedicoz · Free tool',
    title: 'Meri due date kab hai? 🤰',
    subtitle: 'Pregnancy due date calculator — Hindi mein',
    sharedBanner: (m) => `Kisi apne ne khushkhabri share ki hai: nanhe mehmaan ${m} mein aane wale hain! 🎉 Neeche apni due date bhi nikaalein.`,
    lmpLabel: 'Aakhri period ka pehla din (LMP)',
    cycleLabel: 'Aapka cycle kitne din ka hai?',
    cycleDays: (n) => `${n} din${n === 28 ? ' (aam taur par)' : ''}`,
    cycleHelp: 'Pata nahi? 28 din rehne dein.',
    calc: 'Due date nikaalein →',
    errInvalid: 'Kripya sahi date chunein.',
    errFuture: 'Yeh date aage ki hai. Kripya AAKHRI period ka pehla din chunein.',
    errTooOld: 'Yeh date 44 hafte se zyaada purani hai, isliye yeh abhi ki pregnancy nahi ho sakti. Date dobara check karein.',
    resultLabel: 'Aapki anumaanit due date',
    weeksNow: (w, d) => `Abhi: ${w} hafte${d ? ` ${d} din` : ''}`,
    trimester: (t) => ['', 'Pehli timaahi (1st)', 'Doosri timaahi (2nd)', 'Teesri timaahi (3rd)'][t],
    weekOf: (w) => `Hafta ${Math.min(w, 40)} / 40`,
    daysLeft: (n) => `Lagbhag ${n} din baaki`,
    size: (s) => `Is hafte baby ka size lagbhag: ${s} jitna`,
    early: 'Abhi ghar par pregnancy test ke liye shaayad jaldi hai. Test period aane ki date se sabse sahi result deta hai.',
    pastDue: 'Aapki anumaanit due date nikal chuki hai. Kripya apne doctor ke sampark mein rahein.',
    share: '💬 Family ko batayein',
    doctor: '👩‍⚕️ Doctor se milein',
    shareMsg: (m, url) => `Khushkhabri! 🎉 Hamare nanhe mehmaan ${m} mein aane wale hain 👶\n\nAap bhi apni due date nikaalein — free, Hindi mein:\n${url}`,
    copied: 'Message copy ho gaya — WhatsApp mein paste karein!',
    safety: 'Yeh sirf anumaan hai. Sahi date doctor ultrasound se batate hain. Pehli timaahi mein gynaecologist se zaroor milein. Khoon aaye ya tez dard ho to turant nazdeeki hospital jaayein.',
    privacy: 'Private: calculation aapke phone par hoti hai. Kuch bhi save ya send nahi hota.',
    readMore: 'Aage padhein',
    faqTitle: 'Aksar poochhe jaane wale sawaal',
    howTitle: 'Due date kaise nikaali jaati hai',
    how: 'Doctor aakhri period ke pehle din mein 280 din (40 hafte) jodkar due date ka anumaan lagaate hain, aur 28 din se lambe ya chhote cycle ke hisaab se ise adjust karte hain. Pregnancy ke hafte bhi usi din se gine jaate hain — isliye conception ke samay aap lagbhag 2 hafte pregnant maani jaati hain. Sirf lagbhag 20 mein se 1 baby theek due date par aata hai; zyaadaatar do hafte aage-peeche aate hain.',
    faq: [
      { q: 'Due date calculator kitna sahi hota hai?', a: 'Agar cycle regular hai aur aakhri period ki date yaad hai, to yeh achchha anumaan deta hai. Shuruaati ultrasound zyaada sahi hota hai, isliye pehle scan ke baad doctor date badal sakte hain.' },
      { q: 'Main kitne hafte pregnant hoon?', a: 'Pregnancy ke hafte aakhri period ke pehle din se gine jaate hain, conception se nahi. Upar woh date daalein aur apne hafte aur timaahi dekhein.' },
      { q: 'Agar periods irregular hain to?', a: 'Irregular cycle mein calculator kam sahi hota hai. Aise mein gynaecologist aam taur par ultrasound se pregnancy ki date tay karte hain.' },
      { q: 'Doctor ko pehli baar kab dikhaayein?', a: 'Pregnancy ka pata chalte hi, behtar hai pehli timaahi mein hi. Doctor check-up, tests aur folic acid jaise supplements plan karenge.' },
    ],
    langToggleHint: 'View in English',
  },
};
