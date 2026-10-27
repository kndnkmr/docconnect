// ============================================
// Slot helpers — shared by the free-slots endpoint, booking and reschedule
// ============================================
// Booking and reschedule must only accept a slot the doctor's schedule would
// actually offer (same labels, same "not already started today" rule), so they
// use these helpers instead of trusting whatever string the client sends.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Convert minutes since midnight to "HH:MM AM/PM" (540 → "09:00 AM").
function minutesToTimeString(minutes) {
  let hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  hours24 = hours24 % 24; // 24:00 (midnight end of day) → 12 AM

  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  return `${hours12.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${period}`;
}

// Convert "09:30 AM" / "01:30 PM" to minutes since midnight.
function timeStringToMinutes(timeStr) {
  const [time, period] = String(timeStr || '').split(' ');
  let [hours, mins] = (time || '').split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + mins;
}

// "09:00","12:00",30 → ["09:00 AM - 09:30 AM", ...]
function generateTimeSlots(startTime, endTime, durationMinutes) {
  const slots = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let currentMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;
  if (endMinutes === 0) endMinutes = 24 * 60; // "00:00" end = midnight

  while (currentMinutes + durationMinutes <= endMinutes) {
    slots.push(`${minutesToTimeString(currentMinutes)} - ${minutesToTimeString(currentMinutes + durationMinutes)}`);
    currentMinutes += durationMinutes;
  }
  return slots;
}

// Current IST date ("YYYY-MM-DD") and minutes since midnight.
function nowIST() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { date, minutes: now.getHours() * 60 + now.getMinutes() };
}

// A real calendar date in YYYY-MM-DD form (rejects "2026-02-31", "abc").
function isValidDateString(date) {
  if (typeof date !== 'string' || !DATE_RE.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

// Weekday name for a YYYY-MM-DD date (calendar day, timezone-independent).
function dayNameOf(date) {
  return DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

// Every slot label the doctor's weekly schedule produces for this date.
function slotsForDate(doctor, date) {
  const day = dayNameOf(date);
  const duration = doctor.slotDuration || 30;
  const out = [];
  for (const s of (doctor.availability || []).filter((a) => a.day === day)) {
    if (s.startTime && s.endTime) out.push(...generateTimeSlots(s.startTime, s.endTime, duration));
  }
  return out;
}

// Why a (date, timeSlot) can't be booked with this doctor, or null if it can.
// Does NOT check whether someone else already holds the slot — the caller
// queries appointments for that.
function slotProblem(doctor, date, timeSlot) {
  if (!isValidDateString(date)) return 'Invalid date. Use YYYY-MM-DD.';
  const { date: today, minutes } = nowIST();
  if (date < today) return 'Cannot book appointments in the past';
  if ((doctor.blockedDates || []).some((b) => b.date === date)) {
    return 'The doctor is not available on this date. Please choose another day.';
  }
  if (typeof timeSlot !== 'string' || !slotsForDate(doctor, date).includes(timeSlot)) {
    return 'This time slot is not available for this doctor. Please choose a time from the list.';
  }
  if (date === today && timeStringToMinutes(timeSlot.split(' - ')[0]) <= minutes) {
    return 'This time slot has already started. Please choose a later time.';
  }
  return null;
}

// Absolute start/end (ms since epoch) of an appointment's slot.
// Appointment.date is stored as new Date('YYYY-MM-DD') = midnight UTC of the
// IST calendar day, and timeSlot is IST wall-clock ("10:30 AM - 11:00 AM").
// Returns null if the slot can't be parsed.
const IST_OFFSET_MIN = 330;
function slotWindowMs(date, timeSlot) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const parts = String(timeSlot || '').split(' - ');
  if (parts.length !== 2 || !/\d:\d\d [AP]M/.test(parts[0]) || !/\d:\d\d [AP]M/.test(parts[1])) return null;
  const startMin = timeStringToMinutes(parts[0].trim());
  let endMin = timeStringToMinutes(parts[1].trim());
  if (endMin <= startMin) endMin += 24 * 60; // ends at/after midnight
  const dayUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return {
    start: dayUtc + (startMin - IST_OFFSET_MIN) * 60000,
    end: dayUtc + (endMin - IST_OFFSET_MIN) * 60000,
  };
}

module.exports = {
  DAY_NAMES, minutesToTimeString, timeStringToMinutes, generateTimeSlots,
  nowIST, isValidDateString, dayNameOf, slotsForDate, slotProblem, slotWindowMs,
};
