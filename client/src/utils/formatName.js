// ============================================
// Doctor display-name formatting
// ============================================
// Doctors type their own name at registration, so we see inconsistencies:
//   - Some include a "Dr"/"Dr." prefix ("Dr Akash Verma"), which then doubles
//     up when the UI also adds "Dr." → "Dr. Dr Akash Verma".
//   - Casing varies ("akash verma", "Akash verma").
// These helpers clean that up for DISPLAY only — the stored name is unchanged.

// Title-case each word ("akash verma" → "Akash Verma"). Leaves already-correct
// words alone and keeps hyphens/apostrophes reasonable for common names.
function titleCase(str) {
  return String(str || '')
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        // handle hyphenated parts (e.g. "abdul-rahman")
        .split('-')
        .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p))
        .join('-')
    )
    .join(' ');
}

// Strip a leading "Dr"/"Dr."/"doctor" the user may have typed, so the UI can
// add its own "Dr." prefix without doubling it.
function stripDoctorPrefix(name) {
  return String(name || '').replace(/^\s*(dr\.?|doctor)\s+/i, '').trim();
}

// The clean bare name (no "Dr." prefix), title-cased. e.g. "dr akash verma"
// → "Akash Verma". Use when you render your own "Dr." in the JSX.
export function cleanDoctorName(name) {
  const bare = stripDoctorPrefix(name);
  return titleCase(bare) || 'Doctor';
}

// The full display name WITH a single "Dr." prefix, correctly cased.
// "dr akash verma" → "Dr. Akash Verma"; "akash verma" → "Dr. Akash Verma".
export function formatDoctorName(name) {
  return `Dr. ${cleanDoctorName(name)}`;
}
