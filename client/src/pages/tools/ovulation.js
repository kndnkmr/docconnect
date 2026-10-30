// ============================================
// Ovulation & period calculator — shared logic + copy
// ============================================
// Plain JS (no JSX) on purpose: imported by BOTH the page component
// (OvulationCalculator.jsx) and the build-time prerender script, so the text
// crawlers read is exactly the text users see. Edit copy here only.
//
// MEDICAL BASIS (standard calendar method): ovulation usually happens about
// 14 days BEFORE the next period (the luteal phase is fairly constant; the
// first half of the cycle is what varies). The fertile window is the 5 days
// before ovulation plus ovulation day, because sperm can survive up to ~5 days
// and the egg ~1 day. It is an ESTIMATE for regular cycles only and must never
// be used as birth control — every result in the UI says so. Nothing is
// stored or sent: all calculation runs in the browser.

import { parseISODate, todayUTC, toISO } from './dueDate.js';

export { todayUTC, toISO };
export const TOOL_PATH = '/tools/ovulation-calculator';
export const MIN_CYCLE = 21;
export const MAX_CYCLE = 35;
export const MIN_PERIOD = 3;
export const MAX_PERIOD = 7;
export const MAX_LMP_DAYS = 90; // older than this: we ask her to see a doctor
const DAY = 86400000;
const LUTEAL = 14;
const FERTILE_BEFORE = 5;
const LATE_AFTER = 3; // days past the expected period before we flag "late"

const clamp = (n, lo, hi, dflt) => Math.min(hi, Math.max(lo, Number(n) || dflt));

// One cycle starting on `start`.
function cycleAt(start, cycle, periodLen) {
  const nextPeriod = start + cycle * DAY;
  const ovulation = nextPeriod - LUTEAL * DAY;
  return {
    start,
    periodEnd: start + (periodLen - 1) * DAY,
    fertileStart: ovulation - FERTILE_BEFORE * DAY,
    ovulation,
    nextPeriod,
  };
}

// Core calculation. Returns { error } or the full result. All dates are UTC
// midnight timestamps (see parseISODate/todayUTC in dueDate.js).
export function calculate(lmpStr, cycleLen = 28, periodLen = 5, today = todayUTC()) {
  const lmp = parseISODate(lmpStr);
  if (!lmp) return { error: 'invalid' };
  if (lmp > today) return { error: 'future' };
  const daysSince = Math.round((today - lmp) / DAY);
  if (daysSince > MAX_LMP_DAYS) return { error: 'tooOld' };
  const cycle = clamp(cycleLen, MIN_CYCLE, MAX_CYCLE, 28);
  const period = clamp(periodLen, MIN_PERIOD, MAX_PERIOD, 5);

  // Enough cycles to cover 90 days back + the next 3 cycles ahead.
  const cycles = [];
  for (let k = 0; k < 9; k++) cycles.push(cycleAt(lmp + k * cycle * DAY, cycle, period));

  // The next fertile window that hasn't ended yet, and the next period on/after today.
  const fertile = cycles.find((c) => c.ovulation >= today);
  const nextPeriod = cycles.find((c) => c.nextPeriod >= today).nextPeriod;
  const upcoming = cycles.filter((c) => c.start >= nextPeriod).slice(0, 3);

  const expected = lmp + cycle * DAY; // period that should have followed this LMP
  const lateDays = Math.round((today - expected) / DAY);
  return {
    cycle, period,
    fertileStart: fertile.fertileStart,
    ovulation: fertile.ovulation,
    fertileNow: today >= fertile.fertileStart && today <= fertile.ovulation,
    nextPeriod,
    testFrom: nextPeriod,         // a home test is reliable from the missed-period day
    upcoming,                     // next 3 cycles: period date + that cycle's fertile days
    cycles,                       // for the calendar
    late: lateDays >= LATE_AFTER ? { expected, days: lateDays } : null,
  };
}

// What to colour a calendar day: 'ovulation' > 'fertile' > 'period' > null.
export function dayKind(t, cycles) {
  for (const c of cycles) {
    if (t === c.ovulation) return 'ovulation';
    if (t >= c.fertileStart && t < c.ovulation) return 'fertile';
  }
  for (const c of cycles) if (t >= c.start && t <= c.periodEnd) return 'period';
  return null;
}

// Month grid (Monday first) for year/month (0-based): array of weeks, each an
// array of 7 UTC timestamps or null for padding.
export function monthGrid(year, month) {
  const first = Date.UTC(year, month, 1);
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const cells = Array.from({ length: lead }, () => null);
  for (let d = 0; d < days; d++) cells.push(first + d * DAY);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// "5 Aug" / "Wed, 5 Aug" — month names stay English in Hinglish too.
export const shortDate = (t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const dayDate = (t) => new Date(t).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
export const monthTitle = (y, m) => new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export function rangeLabel(a, b) {
  const sameMonth = new Date(a).getUTCMonth() === new Date(b).getUTCMonth();
  return sameMonth ? `${new Date(a).getUTCDate()} – ${shortDate(b)}` : `${shortDate(a)} – ${shortDate(b)}`;
}

// Calendar file (.ics) with all-day events for the next 3 cycles. Built on
// the phone and downloaded — nothing is sent to us.
const icsDate = (t) => toISO(t).replace(/-/g, '');
export function buildIcs(result, lang = 'en', now = new Date()) {
  const c = COPY[lang] || COPY.en;
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const ev = (uid, start, endExclusive, summary) => [
    'BEGIN:VEVENT',
    `UID:${uid}-${icsDate(start)}@promedicoz.in`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${icsDate(start)}`,
    `DTEND;VALUE=DATE:${icsDate(endExclusive)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${c.icsNote}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${summary}`, 'TRIGGER:-PT15H', 'END:VALARM',
    'END:VEVENT',
  ];
  // The current fertile window (if still ahead) + the next 3 cycles.
  const list = [];
  const first = result.cycles.find((x) => x.ovulation === result.ovulation);
  for (const x of [first, ...result.upcoming]) {
    if (!x || list.some((y) => y.start === x.start)) continue;
    list.push(x);
  }
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ProMedicoz//Ovulation Calculator//EN', 'CALSCALE:GREGORIAN'];
  for (const x of list) {
    lines.push(...ev('fertile', x.fertileStart, x.ovulation + DAY, c.icsFertile));
    lines.push(...ev('period', x.nextPeriod, x.nextPeriod + DAY, c.icsPeriod));
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// Articles suggested under the result (slugs from blogData.js).
export const RELATED_ARTICLES = [
  'trying-to-conceive-fertility-basics-guide',
  'irregular-periods-menstrual-cycle-basics-guide',
  'pcos-pcod-irregular-periods-guide',
  'pms-premenstrual-syndrome-symptoms-relief-guide',
  'painful-periods-cramps-relief-guide',
  'early-pregnancy-signs-first-trimester-care-guide',
];

// All visible copy, English + Hinglish (Roman script, same style as the
// blog's Hindi versions).
export const COPY = {
  en: {
    seoTitle: 'Ovulation & Period Calculator — Fertile Days, Free in Hindi & English',
    seoDesc: 'Free ovulation calculator: enter the first day of your last period to see your fertile days, likely ovulation day and next period date for the next 3 months. Your dates stay on your phone — ProMedicoz never sees or saves them.',
    kicker: 'ProMedicoz · Free · Private',
    title: 'Ovulation & Period Calculator',
    subtitle: 'Find your fertile days and next period date',
    lmpLabel: 'First day of your last period',
    cycleLabel: 'Cycle length',
    cycleDays: (n) => `${n} days`,
    periodLabel: 'Period lasts',
    periodDays: (n) => `${n} days`,
    help: 'Not sure? Keep 28 days and 5 days.',
    calc: 'Show my fertile days →',
    errInvalid: 'Please choose a valid date.',
    errFuture: 'This date is in the future. Please choose the first day of your LAST period.',
    errTooOld: 'Please choose a date in the last 3 months. If it has been longer since your last period, please see a gynaecologist.',
    fertileLabel: 'Your next fertile days',
    fertileNow: 'You are in your fertile window now',
    ovulation: (d) => `Likely ovulation: ${d}`,
    nextPeriod: (d) => `Next period: ${d}`,
    testFrom: (d) => `A pregnancy test works from ${d}`,
    lateTitle: 'Is your period late?',
    lateText: (d, n) => `Your period was expected around ${d} (${n} days ago). If it hasn't started, a home pregnancy test can give a result now.`,
    lateLink: 'Check your due date →',
    legendFertile: 'Fertile',
    legendOvulation: 'Ovulation',
    legendPeriod: 'Period',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    nextThree: 'Next 3 months',
    colPeriod: 'Period',
    colFertile: 'Fertile days',
    addCal: '📅 Add reminders to my calendar',
    calDone: 'Calendar file downloaded — open it to add the reminders.',
    share: '💬 Share this free tool',
    shareMsg: (url) => `I found a free ovulation & period calculator 🌷 Hindi + English, and your dates stay on your phone:\n${url}`,
    copied: 'Link copied — paste it in WhatsApp!',
    doctor: '👩‍⚕️ Talk to a gynaecologist',
    doctorNote: 'Trying for over a year (6 months if you are over 35), or periods irregular? A gynaecologist can help.',
    icsFertile: 'Fertile days (estimate)',
    icsPeriod: 'Period expected (estimate)',
    icsNote: 'Estimate from the ProMedicoz ovulation calculator. Not birth control.',
    safety: 'This is an estimate for regular cycles. Please do not use it as birth control. If your periods are irregular, very painful or very heavy, see a gynaecologist.',
    privacy: 'Your dates stay on your phone. They are worked out right here and are never sent to ProMedicoz, never saved and never shared with anyone.',
    readMore: 'Read next',
    faqTitle: 'Frequently asked questions',
    howTitle: 'How fertile days are calculated',
    how: 'In most women, ovulation happens about 14 days before the next period. The fertile window is the 5 days before ovulation and ovulation day itself, because sperm can live for up to 5 days and the egg for about a day. So with a 28-day cycle, ovulation is around day 14 and the most fertile days are about days 9 to 14. The first day of your period is day 1.',
    faq: [
      { q: 'When am I most likely to get pregnant?', a: 'In the 2–3 days before ovulation and on ovulation day. Having sex every 2–3 days through the fertile window gives the best chance.' },
      { q: 'How accurate is an ovulation calculator?', a: 'It is a good estimate if your cycles are regular. Ovulation can shift with stress, illness or travel. Ovulation test kits or a scan by your doctor are more exact.' },
      { q: 'Can I use this to avoid pregnancy?', a: 'No. Calendar estimates are not reliable as birth control. Please talk to a doctor about contraception.' },
      { q: 'What if my periods are irregular?', a: 'If your cycle often changes by more than 7–9 days, this calculator will be less accurate. Irregular periods can have causes like PCOS or thyroid problems, so it is worth seeing a gynaecologist.' },
      { q: 'When should I see a doctor about getting pregnant?', a: 'If you have been trying for a year (or 6 months if you are over 35), or sooner if your periods are irregular or very painful.' },
    ],
  },
  hi: {
    seoTitle: 'Ovulation Kab Hota Hai? Ovulation & Period Calculator (Hindi)',
    seoDesc: 'Free ovulation calculator Hindi mein: aakhri period ka pehla din daalein aur jaanein fertile days, ovulation ka din aur agla period kab aayega — agle 3 mahine ke liye. Aapki dates aapke phone par hi rehti hain.',
    kicker: 'ProMedicoz · Free · Private',
    title: 'Ovulation kab hai? 🌷',
    subtitle: 'Fertile days aur agla period — Hindi mein',
    lmpLabel: 'Aakhri period ka pehla din',
    cycleLabel: 'Cycle kitne din ka hai',
    cycleDays: (n) => `${n} din`,
    periodLabel: 'Period kitne din rehta hai',
    periodDays: (n) => `${n} din`,
    help: 'Pata nahi? 28 din aur 5 din rehne dein.',
    calc: 'Mere fertile days dikhayein →',
    errInvalid: 'Kripya sahi date chunein.',
    errFuture: 'Yeh date aage ki hai. Kripya AAKHRI period ka pehla din chunein.',
    errTooOld: 'Kripya pichhle 3 mahine ki date chunein. Agar period aaye isse zyaada samay ho gaya hai, to gynaecologist se zaroor milein.',
    fertileLabel: 'Aapke agle fertile days',
    fertileNow: 'Abhi aapke fertile days chal rahe hain',
    ovulation: (d) => `Ovulation ka anumaanit din: ${d}`,
    nextPeriod: (d) => `Agla period: ${d}`,
    testFrom: (d) => `Pregnancy test ${d} se sahi result dega`,
    lateTitle: 'Kya period late hai?',
    lateText: (d, n) => `Aapka period lagbhag ${d} ko aana tha (${n} din pehle). Agar abhi tak nahi aaya, to ghar par pregnancy test ab result de sakta hai.`,
    lateLink: 'Apni due date dekhein →',
    legendFertile: 'Fertile',
    legendOvulation: 'Ovulation',
    legendPeriod: 'Period',
    prevMonth: 'Pichhla mahina',
    nextMonth: 'Agla mahina',
    nextThree: 'Agle 3 mahine',
    colPeriod: 'Period',
    colFertile: 'Fertile days',
    addCal: '📅 Calendar mein reminder lagayein',
    calDone: 'Calendar file download ho gayi — reminder ke liye use kholein.',
    share: '💬 Yeh free tool share karein',
    shareMsg: (url) => `Yeh free ovulation aur period calculator mila 🌷 Hindi mein bhi hai, aur aapki dates aapke phone par hi rehti hain:\n${url}`,
    copied: 'Link copy ho gaya — WhatsApp mein paste karein!',
    doctor: '👩‍⚕️ Gynaecologist se baat karein',
    doctorNote: 'Ek saal se koshish kar rahe hain (35 se zyaada umar ho to 6 mahine), ya periods irregular hain? Gynaecologist madad kar sakti hain.',
    icsFertile: 'Fertile days (anumaan)',
    icsPeriod: 'Period aane ki sambhaavna (anumaan)',
    icsNote: 'ProMedicoz ovulation calculator ka anumaan. Birth control ke liye nahi.',
    safety: 'Yeh regular cycle ke liye sirf anumaan hai. Ise birth control ki tarah use na karein. Periods irregular hain, bahut dard ya bahut zyaada bleeding hoti hai, to gynaecologist se milein.',
    privacy: 'Aapki dates aapke phone par hi rehti hain. Hisaab yahin hota hai — ProMedicoz ko kuch nahi bheja jaata, kuch save nahi hota aur kisi ke saath share nahi hota.',
    readMore: 'Aage padhein',
    faqTitle: 'Aksar poochhe jaane wale sawaal',
    howTitle: 'Fertile days kaise nikaale jaate hain',
    how: 'Zyaadaatar mahilaon mein ovulation agle period se lagbhag 14 din pehle hota hai. Fertile window ovulation se pehle ke 5 din aur ovulation ka din hota hai, kyunki sperm 5 din tak aur egg lagbhag 1 din tak jeevit rehta hai. Isliye 28 din ke cycle mein ovulation lagbhag 14ve din hota hai, aur sabse fertile din lagbhag 9 se 14 tak hote hain. Period ka pehla din, din 1 maana jaata hai.',
    faq: [
      { q: 'Pregnant hone ke chances kab sabse zyaada hote hain?', a: 'Ovulation se 2–3 din pehle aur ovulation ke din. Fertile window mein har 2–3 din par sambandh banane se sabse achchha mauka milta hai.' },
      { q: 'Ovulation calculator kitna sahi hota hai?', a: 'Agar cycle regular hai to yeh achchha anumaan deta hai. Tension, beemari ya safar se ovulation aage-peeche ho sakta hai. Ovulation test kit ya doctor ka scan zyaada sahi batata hai.' },
      { q: 'Kya ise pregnancy rokne ke liye use kar sakte hain?', a: 'Nahi. Calendar ka anumaan birth control ke liye bharosemand nahi hai. Contraception ke liye doctor se baat karein.' },
      { q: 'Agar periods irregular hain to?', a: 'Agar cycle aksar 7–9 din se zyaada badalta hai, to yeh calculator kam sahi hoga. Irregular periods ke peeche PCOS ya thyroid jaise kaaran ho sakte hain, isliye gynaecologist se milna achchha hai.' },
      { q: 'Pregnancy ke liye doctor se kab milein?', a: 'Agar ek saal se koshish kar rahe hain (35 se zyaada umar ho to 6 mahine), ya periods irregular ya bahut dard wale hain to pehle hi.' },
    ],
  },
};
