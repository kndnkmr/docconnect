// ============================================
// Consultation types a doctor offers (pure, tested in tests/consultModes.test.mjs)
// ============================================
// Mirrors the server rule in server/utils/booking.js: only a type the doctor
// offers can be booked. Very old doctor records without a list allow all.

export const ALL_MODES = ['video', 'phone', 'in-person'];

// The doctor's offered types, in the booking page's display order.
export function offeredModes(doctorModes) {
  const list = Array.isArray(doctorModes) ? doctorModes : [];
  const offered = ALL_MODES.filter((m) => list.includes(m));
  return offered.length ? offered : ALL_MODES;
}

// Keep the current choice if the doctor offers it; otherwise the first offered.
// Returns { mode, switched } — switched = the previous choice had to change.
export function pickMode(current, doctorModes) {
  const offered = offeredModes(doctorModes);
  if (current && offered.includes(current)) return { mode: current, switched: false };
  return { mode: offered[0], switched: !!current };
}
