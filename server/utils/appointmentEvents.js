// ============================================
// Appointment event log: an append-only record of who did what and when.
// ============================================
// Every important step (booked, confirmed, "I paid", "not received", admin
// reset ...) is written here with the person's role. Evidence that used to be
// erased (screenshot, UTR when a claim is undone or reset) is kept in `data`,
// so an admin can still see it later. Capped at the latest MAX entries.
const MAX_EVENTS = 80;
const MAX_NOTE = 300;
// ROLES: patient | doctor | admin | system
function logEvent(apt, { role, by = null, action, note = '', data } = {}) {
  if (!apt || !action) return;
  if (!Array.isArray(apt.events) && !(apt.events && typeof apt.events.push === 'function')) apt.events = [];
  const entry = { at: new Date(), by: by || null, role: role || 'system', action, note: String(note || '').slice(0, MAX_NOTE) };
  if (data !== undefined) entry.data = data;
  apt.events.push(entry);
  if (apt.events.length > MAX_EVENTS) {
    const keep = apt.events.slice(-MAX_EVENTS);
    apt.events = keep;
  }
}
module.exports = { logEvent, MAX_EVENTS, MAX_NOTE };
