// ============================================
// Booking page helpers (pure, tested in tests/bookingUi.test.mjs)
// ============================================
// Day tiles, time groups, and specialty-matched problem chips for
// pages/BookAppointment.jsx. All dates are IST.

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// 'YYYY-MM-DD' for an IST day, `offset` days from now.
export function istDate(now = Date.now(), offset = 0) {
  const d = new Date(now + 330 * 60000 + offset * 864e5);
  return d.toISOString().slice(0, 10);
}

// Next `count` days as tiles. A day is "off" when the doctor has no weekly
// hours on that weekday or has blocked that date (leave). Today counts as
// off once all of today's hours are over.
export function dayTiles({ availability = [], blockedDates = [], now = Date.now(), count = 14 } = {}) {
  const blocked = new Set((blockedDates || []).map((b) => b && b.date));
  const nowMin = (() => { const d = new Date(now + 330 * 60000); return d.getUTCHours() * 60 + d.getUTCMinutes(); })();
  const toMin = (t) => { const [h, m] = String(t || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const out = [];
  for (let i = 0; i < count; i++) {
    const date = istDate(now, i);
    const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
    const sessions = (availability || []).filter((a) => a && a.day === DAYS[wd]);
    let off = sessions.length === 0 || blocked.has(date);
    if (!off && i === 0) {
      const lastEnd = Math.max(...sessions.map((s) => (toMin(s.endTime) || 24 * 60)));
      if (lastEnd <= nowMin) off = true;
    }
    out.push({ date, weekday: wd, dayNum: Number(date.slice(8, 10)), month: Number(date.slice(5, 7)) - 1, rel: i === 0 ? 'today' : i === 1 ? 'tomorrow' : null, off });
  }
  return out;
}

// "12:00 PM - 12:15 PM" → minutes since midnight of the start (or null).
export function slotStartMin(slot) {
  const m = String(slot || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
}

// Short start label: "12:00 PM - 12:15 PM" → "12:00 PM" (leading 0 dropped).
export const slotStart = (slot) => String(slot || '').split(' - ')[0].replace(/^0/, '');

// Group slots into Morning (before 12) / Afternoon (12–5) / Evening (5–9) / Night.
export function groupSlots(slots = []) {
  const groups = [
    { key: 'morning', icon: '🌅', items: [] },
    { key: 'afternoon', icon: '☀️', items: [] },
    { key: 'evening', icon: '🌆', items: [] },
    { key: 'night', icon: '🌙', items: [] },
  ];
  for (const s of slots) {
    const m = slotStartMin(s);
    const g = m == null ? 1 : m < 12 * 60 ? 0 : m < 17 * 60 ? 1 : m < 21 * 60 ? 2 : 3;
    groups[g].items.push(s);
  }
  return groups.filter((g) => g.items.length);
}

// Problem chips matched to the doctor's specialty. The stored value (and what
// the doctor sees) is always the English `en`.
const GENERAL = [
  { en: 'Fever', hi: 'बुखार' }, { en: 'Cough', hi: 'खांसी' }, { en: 'Cold', hi: 'सर्दी' },
  { en: 'Headache', hi: 'सिरदर्द' }, { en: 'Body Ache', hi: 'बदन दर्द' }, { en: 'Fatigue', hi: 'थकान' },
  { en: 'Nausea/Vomiting', hi: 'मतली / उल्टी' }, { en: 'Diarrhea', hi: 'दस्त' }, { en: 'Stomach Pain', hi: 'पेट दर्द' },
  { en: 'Chest Pain', hi: 'सीने में दर्द' }, { en: 'Shortness of Breath', hi: 'सांस लेने में तकलीफ' }, { en: 'Sore Throat', hi: 'गले में खराश' },
  { en: 'Skin Rash', hi: 'त्वचा पर चकत्ते' }, { en: 'Dizziness', hi: 'चक्कर आना' }, { en: 'Joint Pain', hi: 'जोड़ों का दर्द' },
  { en: 'Back Pain', hi: 'कमर दर्द' },
];
const BY_SPECIALTY = [
  { re: /gyn|gyan|obst/i, list: [
    { en: 'Irregular periods', hi: 'माहवारी अनियमित' }, { en: 'Period pain', hi: 'माहवारी में दर्द' },
    { en: 'Heavy bleeding', hi: 'ज़्यादा खून आना' }, { en: 'PCOD/PCOS', hi: 'PCOD/PCOS' },
    { en: 'Pregnancy check-up', hi: 'प्रेग्नेंसी जाँच' }, { en: 'Trying to conceive', hi: 'बच्चा नहीं हो रहा' },
    { en: 'White discharge', hi: 'सफ़ेद पानी' }, { en: 'Lower belly pain', hi: 'पेट के नीचे दर्द' },
    { en: 'Menopause problems', hi: 'मेनोपॉज़ की परेशानी' }, { en: 'Breast pain/lump', hi: 'स्तन में दर्द/गांठ' },
  ] },
  { re: /p(a)?ediatr|neonat|child/i, list: [
    { en: 'Fever', hi: 'बुखार' }, { en: 'Cough & cold', hi: 'खांसी-जुकाम' }, { en: 'Loose motions', hi: 'दस्त' },
    { en: 'Vomiting', hi: 'उल्टी' }, { en: 'Not eating well', hi: 'ठीक से नहीं खा रहा' }, { en: 'Vaccination', hi: 'टीका' },
    { en: 'Skin rash', hi: 'त्वचा पर दाने' }, { en: 'Growth/weight concern', hi: 'वज़न/बढ़त की चिंता' },
  ] },
  { re: /neuro/i, list: [
    { en: 'Headache/Migraine', hi: 'सिरदर्द / माइग्रेन' }, { en: 'Dizziness', hi: 'चक्कर आना' },
    { en: 'Fits/Seizures', hi: 'दौरे पड़ना' }, { en: 'Numbness/Tingling', hi: 'सुन्नपन / झनझनाहट' },
    { en: 'Weakness in arm/leg', hi: 'हाथ-पैर में कमज़ोरी' }, { en: 'Neck/back pain', hi: 'गर्दन / कमर दर्द' },
    { en: 'Memory problems', hi: 'याददाश्त कमज़ोर' }, { en: 'Sleep problems', hi: 'नींद की परेशानी' },
  ] },
  { re: /dermat|skin/i, list: [
    { en: 'Acne/Pimples', hi: 'मुंहासे' }, { en: 'Hair fall', hi: 'बाल झड़ना' }, { en: 'Itching/Rash', hi: 'खुजली / दाने' },
    { en: 'Fungal infection', hi: 'फंगल इन्फेक्शन / दाद' }, { en: 'Pigmentation', hi: 'दाग-धब्बे' }, { en: 'Dandruff', hi: 'रूसी' },
  ] },
];
export function symptomsFor(specialization) {
  const hit = BY_SPECIALTY.find((s) => s.re.test(String(specialization || '')));
  return hit ? hit.list : GENERAL;
}

// What's still missing before booking (first one), or null. The problem
// step (symptom chips + note) is optional: many patients don't want to
// write it, and the server fills the reason from the chips or "Not
// specified".
export function missingStep({ date, timeSlot, consent, bookedFor, familyMemberName }) {
  if (!date || !timeSlot) return 'time';
  if (bookedFor === 'family' && !familyMemberName) return 'who';
  if (!consent) return 'consent';
  return null;
}
