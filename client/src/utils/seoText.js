// ============================================
// Search-result title + description rules (shared by SEO.jsx and the
// build-time prerender, so Google sees the same text either way)
// ============================================
// Google shows roughly 60 characters of a title and ~155 of a description.
// Adding " | ProMedicoz" to every title pushed 701 of 847 pages past that,
// so the end got cut ("…"). Google already shows the site name next to each
// result, so the brand is added only when it still fits. Descriptions are
// trimmed at a word boundary so the snippet ends cleanly.
// Tests: tests/seoText.test.mjs

export const SITE_NAME = 'ProMedicoz';
export const DEFAULT_TITLE = `${SITE_NAME} - Find & Book Doctors Online`;
const TITLE_FITS = 60;
const DESC_MAX = 155;

export function seoTitle(title) {
  const t = String(title || '').replace(/\s+/g, ' ').trim();
  if (!t) return DEFAULT_TITLE;
  const branded = `${t} | ${SITE_NAME}`;
  return branded.length <= TITLE_FITS ? branded : t;
}

export function seoDescription(text) {
  const d = String(text || '').replace(/\s+/g, ' ').trim();
  if (d.length <= DESC_MAX) return d;
  const cut = d.slice(0, DESC_MAX - 1);
  const atWord = cut.slice(0, Math.max(cut.lastIndexOf(' '), DESC_MAX - 30));
  return `${atWord.replace(/[\s,;:—–-]+$/, '')}…`;
}
