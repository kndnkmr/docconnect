// Shared helpers for the client's safety tests (run with `npm test`).
// Dates are compared as ISO strings ("2026-08-10"), never as month names,
// because short month names differ between Node/ICU versions ("Sep"/"Sept").

export const U = (s) => Date.parse(`${s}T00:00:00Z`); // "2026-08-06" -> UTC midnight
export const iso = (t) => new Date(t).toISOString().slice(0, 10);
