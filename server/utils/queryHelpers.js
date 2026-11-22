// ============================================
// Query Helpers - shared pagination + regex safety utilities
// ============================================
// Used across list/search endpoints (admin, doctors, appointments,
// complaints) so every one of them handles user-supplied query params the
// same, safe way:
//   - Search strings are escaped before being used in a RegExp, so a crafted
//     pattern (e.g. lots of nested repetition) can't cause a ReDoS (regex
//     denial-of-service) on the server.
//   - Pagination limits are bounded, so a request like ?limit=1000000 can't
//     force a single query to pull an unbounded number of records into memory.

// Escape regex special characters so user input is treated as a literal
// substring to search for, not as a regex pattern to execute.
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Build a case-insensitive "contains" RegExp from user input, safely.
const safeContainsRegex = (input) => new RegExp(escapeRegex(input), 'i');

// Doctor-name search. Patients type "Dr Pooja Singh" or "Dr. Pooja" but many
// doctors are stored without the title ("Pooja Singh"), so a plain contains
// match found nobody. We drop a leading Dr/Dr./Doctor/डॉ and then require every
// remaining word to appear in the name, in any order ("singh pooja" works too).
const nameRegex = (input) => {
  const raw = String(input).trim();
  const cleaned = raw.replace(/^(dr\b\.?|doctor\b|डॉ\.?)\s*/i, '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 6);
  if (words.length === 0) return safeContainsRegex(raw);
  return new RegExp(words.map((w) => `(?=.*${escapeRegex(w)})`).join(''), 'i');
};
// Specialty search: case-insensitive, but the term must START a word, so
// "Urologist" no longer matches "neUROLOGIST" (and "Dermatology" doesn't
// leak into unrelated words). "cardio" still finds "Cardiologist",
// "Gynaecologist" still finds "Obstetrician and Gynaecologist".
const specialtyRegex = (input) => {
  const t = String(input).trim();
  const e = escapeRegex(t);
  return new RegExp(/^\w/.test(t) ? `\\b${e}` : e, 'i');
};
// Parse page/limit from query params with sane bounds.
// - page: always at least 1
// - limit: at least 1, capped at maxLimit (default 100)
const getPagination = (req, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || defaultLimit, 1), maxLimit);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

module.exports = { escapeRegex, safeContainsRegex, nameRegex, specialtyRegex, getPagination };
