// ============================================
// Daily medicine chart — read a prescription into time-of-day slots
// ============================================
// Pure functions (no browser APIs) so they can be unit-tested in Node.
//
// Doctors type each medicine as free text: "name - frequency - duration -
// instructions" (see Dashboard.jsx handleWritePrescription). This turns the
// common Indian prescription conventions into a chart:
//   1-0-1 / 1-1-1 / ½-0-½      → morning / afternoon / night, as written
//   BD / twice daily           → morning + night
//   TDS / thrice daily         → morning + afternoon + night
//   HS / at bedtime            → night
//   OD / once daily            → "once a day" (the TIME is NOT guessed)
//   SOS / as needed            → "only when needed"
//   weekly / once a week       → same weekday as the prescription, each week
//   QID / 4 times              → "4 times a day" (not spread by us)
// SAFETY: nothing is ever guessed. Anything we can't read confidently goes to
// "Check with your doctor" with the doctor's exact words, and the original
// text is always kept on every item. We add no medical advice of our own.

const DAY = 86400000;

// Calendar day (UTC midnight) of a date in India time — prescriptions are
// written and read in IST.
export function istDay(date) {
  const d = new Date(date);
  const ist = new Date(d.getTime() + 330 * 60000);
  return Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
}

const has = (s, re) => re.test(s);

// ---- Frequency ----
// Returns { kind, slots?, counts?, perDay? } or null if unreadable.
//   kind: 'daily' (slots: ['morning','afternoon','night'] subset), 'once',
//         'sos', 'weekly', 'times' (perDay n, not spread), or null.
export function parseFrequency(raw) {
  const s = ` ${String(raw || '').toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim()} `;
  if (!s.trim()) return null;

  // 1-0-1 style (also 1-0-0-1 with a 4th "evening" slot, ½ and 1/2).
  const m = s.match(/(?:^|[^\d/.])((?:\d|½|1\/2)(?:\s*-\s*(?:\d|½|1\/2)){2,3})(?![\d/.])/);
  if (m) {
    const parts = m[1].split(/\s*-\s*/).map((p) => (p === '½' || p === '1/2' ? 0.5 : Number(p)));
    if (parts.every((n) => Number.isFinite(n) && n >= 0 && n <= 4) && parts.some((n) => n > 0)) {
      const names = parts.length === 4 ? ['morning', 'afternoon', 'evening', 'night'] : ['morning', 'afternoon', 'night'];
      const slots = []; const counts = {};
      parts.forEach((n, i) => { if (n > 0) { slots.push(names[i]); counts[names[i]] = n; } });
      return { kind: 'daily', slots, counts };
    }
  }
  if (has(s, /\b(sos|prn|as needed|as required|when needed|when required|if needed|if required|zaroorat)\b/)) return { kind: 'sos' };
  if (has(s, /\b(weekly|once a week|once weekly|every week|per week|1\s*\/\s*week|hafte me ek)\b/)) return { kind: 'weekly' };
  if (has(s, /\b(qid|qds|four times|4 times)\b/)) return { kind: 'times', perDay: 4 };
  if (has(s, /\b(tds|tid|thrice|three times|3 times)\b/)) return { kind: 'daily', slots: ['morning', 'afternoon', 'night'], counts: {} };
  if (has(s, /\b(bd|bid|twice|two times|2 times)\b/)) return { kind: 'daily', slots: ['morning', 'night'], counts: {} };
  if (has(s, /\b(hs|at bed ?time|bed ?time|at night|night only|before sleep|raat ko)\b/)) return { kind: 'daily', slots: ['night'], counts: {} };
  if (has(s, /\b(od|qd|once daily|once a day|once in a day|one time|1 time|1\s*\/\s*day)\b/)) {
    // "Once a day at night" / "OD after breakfast": the time IS stated.
    const slots = namedSlots(s);
    return slots.length === 1 ? { kind: 'daily', slots, counts: {} } : { kind: 'once' };
  }
  // Plain words that name the time: "morning and night", "before breakfast".
  const slots = namedSlots(s);
  if (slots.length) return { kind: 'daily', slots, counts: {} };
  if (has(s, /\b(daily|every day)\b/)) return { kind: 'once' };
  return null;
}

// Times of day named in words (in morning → afternoon → night order).
function namedSlots(s) {
  const out = [];
  if (/\b(morning|subah|breakfast|nashta|naashta)\b/.test(s)) out.push('morning');
  if (/\b(afternoon|lunch|dopahar|dopehar)\b/.test(s)) out.push('afternoon');
  if (/\b(evening|shaam)\b/.test(s)) out.push('evening');
  if (/\b(night|bed ?time|dinner|raat|before sleep)\b/.test(s)) out.push('night');
  return out;
}

// ---- Food timing ----
export function parseFood(...texts) {
  const s = ` ${texts.join(' ').toLowerCase()} `;
  if (has(s, /\b(empty stomach|khaali pet|khali pet)\b/)) return 'empty';
  if (has(s, /\b(before (food|meal|meals|breakfast|lunch|dinner|eating)|ac\b|a\/c|khane se pehle)/)) return 'before';
  if (has(s, /\b(after (food|meal|meals|breakfast|lunch|dinner|eating)|with food|with meals|pc\b|p\/c|khane ke baad)/)) return 'after';
  return null;
}

// ---- Duration → number of days (null if unreadable, Infinity for ongoing) ----
export function parseDuration(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return null;
  if (/\b(continue|ongoing|long ?term|till next visit|until further|lifelong|regular)\b/.test(s)) return Infinity;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(d|day|days|din|w|wk|wks|week|weeks|hafte|m|mo|month|months|mahine)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2];
  if (/^(d|day|days|din)$/.test(unit)) return Math.round(n);
  if (/^(w|wk|wks|week|weeks|hafte)$/.test(unit)) return Math.round(n * 7);
  return Math.round(n * 30);
}

// Pull "1-0-1" / "BD" / "5 days" out of other fields too, because doctors
// sometimes skip a " - " (e.g. "Tab Pan 40 1-0-0 5 days").
function pickFrequency(med) {
  return parseFrequency(`${med.frequency || ''} ${med.instructions || ''}`) || parseFrequency(med.duration)
    || (med.frequency ? null : parseFrequency(med.name));
}
function pickDuration(med) {
  const d = parseDuration(med.duration);
  if (d != null) return d;
  // Duration slipped into the frequency slot (e.g. "OD - 30 days" typed as "OD 30 days").
  return parseDuration(med.frequency) ?? parseDuration(med.instructions);
}

// Original text exactly as the doctor wrote it.
export function originalText(med) {
  return [med.name, med.dosage, med.frequency, med.duration].filter(Boolean).join(' — ')
    + (med.instructions ? ` (${med.instructions})` : '');
}

// Build the chart for one prescription.
// Returns { start, items, groups: { morning, afternoon, evening, night, once, weekly, sos, times, check }, followUpUntil }
export function buildChart(rx, today = istDay(new Date())) {
  const start = istDay(rx.createdAt || Date.now());
  const items = (rx.medicines || []).map((med, i) => {
    const freq = pickFrequency(med);
    const days = pickDuration(med);
    const food = parseFood(med.frequency, med.instructions, med.duration);
    const lastDay = days == null || days === Infinity ? null
      : freq?.kind === 'weekly' ? start + (Math.max(1, Math.round(days / 7)) - 1) * 7 * DAY
        : start + (days - 1) * DAY;
    const dayNo = Math.floor((today - start) / DAY) + 1;
    return {
      key: `${i}-${med.name}`,
      name: med.name,
      dose: med.dosage || '',
      freq, food, days, lastDay,
      ongoing: days === Infinity,
      dayNo: days && days !== Infinity && freq?.kind !== 'weekly' ? Math.min(Math.max(dayNo, 1), days) : null,
      finished: lastDay != null && today > lastDay,
      original: originalText(med),
      instructions: med.instructions || '',
    };
  });
  const groups = { morning: [], afternoon: [], evening: [], night: [], once: [], weekly: [], times: [], sos: [], check: [] };
  for (const it of items) {
    if (!it.freq) { groups.check.push(it); continue; }
    if (it.freq.kind === 'daily') it.freq.slots.forEach((s) => groups[s].push(it));
    else groups[it.freq.kind].push(it);
  }
  const fu = rx.appointment?.followUpDeadline;
  return { start, items, groups, followUpUntil: fu ? istDay(fu) : null, weekday: new Date(start).getUTCDay() };
}

// ---- Calendar reminders (.ics) ----
// One repeating daily event per time slot (and weekly for weekly medicines),
// running until the last day of the longest course in that slot. Ongoing
// courses repeat for 30 days (the doctor can renew). Built on the phone and
// downloaded — nothing is sent anywhere.
const pad = (n) => String(n).padStart(2, '0');
const icsDay = (t) => new Date(t).toISOString().slice(0, 10).replace(/-/g, '');
const icsText = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

export function buildIcs(chart, times, labels, today = istDay(new Date()), now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ProMedicoz//Medicine Chart//EN', 'CALSCALE:GREGORIAN'];
  const event = (uid, firstDay, time, rrule, summary, desc) => {
    const [h, m] = time.split(':').map(Number);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}@promedicoz.in`,
      `DTSTAMP:${stamp}`,
      // Floating local time: rings at this clock time on the phone.
      `DTSTART:${icsDay(firstDay)}T${pad(h)}${pad(m)}00`,
      'DURATION:PT10M',
      rrule,
      `SUMMARY:${icsText(summary)}`,
      `DESCRIPTION:${icsText(desc)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(summary)}`, 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT',
    );
  };
  // Last reminder day for a medicine (ongoing / unknown duration: 30 days).
  const endOf = (it) => (it.ongoing || it.lastDay == null ? today + 29 * DAY : it.lastDay);
  // SAFETY: a reminder must only ever list medicines still due on that day.
  // Medicines in the same slot with different end dates get separate events
  // (e.g. a 5-day tablet and a 7-day syrup at 8 AM), so the alarm never shows
  // a medicine after its course has ended.
  for (const slot of ['morning', 'afternoon', 'evening', 'night']) {
    const byEnd = new Map();
    for (const it of chart.groups[slot].filter((x) => !x.finished)) {
      const end = endOf(it);
      if (!byEnd.has(end)) byEnd.set(end, []);
      byEnd.get(end).push(it);
    }
    for (const [end, list] of byEnd) {
      event(`rx-${slot}-${chart.start}-${icsDay(end)}`, today, times[slot], `RRULE:FREQ=DAILY;UNTIL=${icsDay(end)}T235959`,
        labels.reminder(labels.slot[slot]), list.map((it) => `${it.name}${it.food ? ` (${labels.food[it.food]})` : ''}`).join('\n'));
    }
  }
  // Weekly medicines: same weekday as the prescription, split by end date too.
  let first = chart.start;
  while (first < today) first += 7 * DAY; // next occurrence on/after today
  const weeklyByEnd = new Map();
  for (const it of chart.groups.weekly.filter((x) => !x.finished)) {
    const end = endOf(it);
    if (first > end) continue;
    if (!weeklyByEnd.has(end)) weeklyByEnd.set(end, []);
    weeklyByEnd.get(end).push(it);
  }
  for (const [end, list] of weeklyByEnd) {
    event(`rx-weekly-${chart.start}-${icsDay(end)}`, first, times.morning, `RRULE:FREQ=WEEKLY;UNTIL=${icsDay(end)}T235959`,
      labels.reminder(labels.weeklyName), list.map((it) => it.name).join('\n'));
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// ---- Plain-text chart for WhatsApp ----
export function chartText(chart, doctorName, labels, fmt) {
  const out = [labels.shareTitle(doctorName)];
  const line = (it) => `• ${it.name}${it.dose ? ` ${it.dose}` : ''}${it.freq?.counts?.[it._slot] ? ` × ${it.freq.counts[it._slot]}` : ''}${it.food ? ` (${labels.food[it.food]})` : ''}${it.lastDay ? ` — ${labels.till(fmt(it.lastDay))}` : it.ongoing ? ` — ${labels.ongoing}` : ''}`;
  for (const slot of ['morning', 'afternoon', 'evening', 'night']) {
    const list = chart.groups[slot].filter((it) => !it.finished);
    if (list.length) out.push('', `${labels.slotIcon[slot]} ${labels.slot[slot]}`, ...list.map((it) => line({ ...it, _slot: slot })));
  }
  const extra = [['once', labels.onceName], ['weekly', labels.weeklyName], ['times', labels.timesName], ['sos', labels.sosName], ['check', labels.checkName]];
  for (const [g, title] of extra) {
    const list = chart.groups[g].filter((it) => !it.finished);
    if (list.length) out.push('', title, ...list.map((it) => (g === 'check' || g === 'sos' ? `• ${it.original}` : line(it))));
  }
  out.push('', labels.shareFooter);
  return out.join('\n');
}
