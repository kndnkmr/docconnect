// ============================================
// Family medicine view — "Parivaar ki dawai" (pure logic, unit-tested)
// ============================================
// For an account that books for family members, groups TODAY's medicines from
// all running prescriptions by time of day and by person. Built on the same
// reading rules as the single-prescription chart (rxChart.js): nothing is
// guessed, finished courses drop off, the doctor's words are kept.
//
// Who a prescription is for comes from its appointment ("booked for": self or
// a family member's name), which every family booking already stores.
//
// SAFETY choices:
//   • "Continue"/no-duration medicines only count from prescriptions written
//     in the last 90 days, so a years-old "continue" never shows as today's
//     medicine. The UI tells people to follow the doctor if anything changed.
//   • When one person has more than one running prescription, every item
//     shows its doctor, so the same medicine from two doctors is visible as
//     two entries — never silently merged (no hidden double-dosing).

import { buildChart, buildIcs, istDay } from './rxChart.js';

const DAY = 86400000;
export const ONGOING_MAX_AGE_DAYS = 90;
const SLOTS = ['morning', 'afternoon', 'evening', 'night'];

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Who is this prescription for? 'self' or the family member's name as booked.
export function personOf(rx) {
  const a = rx.appointment;
  return a && a.bookedFor === 'family' && a.familyMemberName && a.familyMemberName.trim() ? a.familyMemberName.trim() : 'self';
}
export const personKey = (rx) => norm(personOf(rx));

export function hasFamilyPrescriptions(prescriptions) {
  return (prescriptions || []).some((rx) => personOf(rx) !== 'self');
}

// Emoji for a person, from the saved family member (relationship + gender).
export function personEmoji(name, familyMembers = []) {
  if (name === 'self') return '🙂';
  const m = familyMembers.find((f) => norm(f.name) === norm(name));
  if (!m) return '👤';
  if (m.relationship === 'parent') return m.gender === 'female' ? '👵' : m.gender === 'male' ? '👴' : '🧓';
  if (m.relationship === 'child') return '🧒';
  if (m.relationship === 'spouse') return '💑';
  if (m.relationship === 'sibling') return '🧑';
  return '👤';
}

// People in the order: self first, then family by first appearance.
export function peopleOf(prescriptions) {
  const seen = new Map();
  for (const rx of prescriptions || []) {
    const k = personKey(rx);
    if (!seen.has(k)) seen.set(k, personOf(rx));
  }
  const list = [...seen.entries()].map(([key, name]) => ({ key, name }));
  return list.sort((a, b) => (a.key === 'self' ? -1 : b.key === 'self' ? 1 : 0));
}

// Is this chart item still to be taken today?
function activeToday(it, chart, today) {
  if (it.finished) return false;
  if (it.ongoing || it.lastDay == null) {
    return today - chart.start <= ONGOING_MAX_AGE_DAYS * DAY;
  }
  return true;
}

// Build the family view for `today` (UTC-midnight IST day).
// Returns { people: [{ key, name, slots:{morning..night:[item]}, once, weekly, sos, check, multi }],
//           comingUp: [{ person, kind, ... }], charts: [{ rx, chart, person }] }
export function buildFamilyDay(prescriptions, today = istDay(new Date())) {
  const charts = (prescriptions || [])
    .filter((rx) => rx.medicines && rx.medicines.length)
    .map((rx) => ({ rx, chart: buildChart(rx, today), person: personOf(rx), key: personKey(rx) }));

  const byPerson = new Map();
  const bucket = (key, name) => {
    if (!byPerson.has(key)) {
      byPerson.set(key, { key, name, slots: { morning: [], afternoon: [], evening: [], night: [] }, once: [], weekly: [], times: [], sos: [], check: [], rxCount: 0 });
    }
    return byPerson.get(key);
  };

  for (const { rx, chart, person, key } of charts) {
    const p = bucket(key, person);
    const doctor = rx.doctor?.name || '';
    const tag = (it) => ({ ...it, doctor, rxId: rx._id });
    let counted = false;
    for (const s of SLOTS) {
      for (const it of chart.groups[s]) if (activeToday(it, chart, today)) { p.slots[s].push(tag(it)); counted = true; }
    }
    for (const it of chart.groups.once) if (activeToday(it, chart, today)) { p.once.push(tag(it)); counted = true; }
    for (const it of chart.groups.times) if (activeToday(it, chart, today)) { p.times.push(tag(it)); counted = true; }
    // Weekly: only on the prescription's weekday.
    if (new Date(today).getUTCDay() === chart.weekday) {
      for (const it of chart.groups.weekly) if (activeToday(it, chart, today)) { p.weekly.push(tag(it)); counted = true; }
    } else if (chart.groups.weekly.some((it) => activeToday(it, chart, today))) counted = true;
    for (const it of chart.groups.sos) if (activeToday(it, chart, today)) { p.sos.push(tag(it)); counted = true; }
    for (const it of chart.groups.check) if (activeToday(it, chart, today) && today - chart.start <= ONGOING_MAX_AGE_DAYS * DAY) { p.check.push(tag(it)); counted = true; }
    if (counted) p.rxCount += 1;
  }
  for (const p of byPerson.values()) p.multi = p.rxCount > 1;

  // Coming up: courses ending within 3 days, free follow-ups still open,
  // tests the doctor advised in the last 30 days.
  const comingUp = [];
  for (const { rx, chart, person } of charts) {
    for (const it of chart.items) {
      if (!it.finished && it.lastDay != null && it.lastDay - today <= 3 * DAY) {
        comingUp.push({ person, kind: 'ends', name: it.name, date: it.lastDay, today: it.lastDay === today });
      }
    }
    if (chart.followUpUntil && chart.followUpUntil >= today) {
      comingUp.push({ person, kind: 'followUp', doctor: rx.doctor?.name || '', date: chart.followUpUntil });
    }
    if (rx.testsRecommended?.length && today - chart.start <= 30 * DAY) {
      comingUp.push({ person, kind: 'tests', tests: rx.testsRecommended, date: chart.start });
    }
  }
  comingUp.sort((a, b) => a.date - b.date);

  const order = peopleOf(prescriptions).map((x) => x.key);
  const people = [...byPerson.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return { people, comingUp, charts };
}

// Does anyone have anything today?
export function isEmptyDay(day) {
  return day.people.every((p) => SLOTS.every((s) => !p.slots[s].length) && !p.once.length && !p.weekly.length && !p.times.length && !p.sos.length && !p.check.length);
}

// One calendar file for the whole family: each running prescription's
// reminders (same safety rules as the single chart), titled with the person.
export function buildFamilyIcs(day, times, labels, today = istDay(new Date()), now = new Date()) {
  const events = [];
  for (const { rx, chart, person } of day.charts) {
    // Drop stale "continue" items (same 90-day rule as the screen).
    const fresh = { ...chart, groups: { ...chart.groups } };
    for (const g of [...SLOTS, 'weekly']) fresh.groups[g] = chart.groups[g].filter((it) => activeToday(it, chart, today));
    const who = person === 'self' ? labels.self : person;
    const ics = buildIcs(fresh, times, { ...labels, uidPrefix: `rx${rx._id || ''}`, reminder: (s) => labels.reminder(`${who} · ${s}`) }, today, now);
    events.push(...(ics.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT\r\n/g) || []));
  }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ProMedicoz//Family Medicine Chart//EN', 'CALSCALE:GREGORIAN', ...events.map((e) => e.replace(/\r\n$/, '')), 'END:VCALENDAR'].join('\r\n') + '\r\n';
}

// Plain-text day for WhatsApp ("send to family").
export function familyDayText(day, labels, fmt) {
  const out = [labels.shareTitle(fmt(istDay(new Date())))];
  const who = (p) => (p.key === 'self' ? labels.self : p.name);
  const line = (it, p) => `   • ${it.name}${it.food ? ` (${labels.food[it.food]})` : ''}${p.multi && it.doctor ? ` — Dr. ${it.doctor}` : ''}`;
  for (const s of SLOTS) {
    const rows = day.people.filter((p) => p.slots[s].length);
    if (!rows.length) continue;
    out.push('', `${labels.slotIcon[s]} ${labels.slot[s]}`);
    for (const p of rows) out.push(`  ${who(p)}:`, ...p.slots[s].map((it) => line(it, p)));
  }
  for (const [g, title] of [['once', labels.onceName], ['weekly', labels.weeklyName], ['sos', labels.sosName]]) {
    const rows = day.people.filter((p) => p[g].length);
    if (!rows.length) continue;
    out.push('', title);
    for (const p of rows) out.push(`  ${who(p)}:`, ...p[g].map((it) => (g === 'sos' ? `   • ${it.original}` : line(it, p))));
  }
  out.push('', labels.shareFooter);
  return out.join('\n');
}
