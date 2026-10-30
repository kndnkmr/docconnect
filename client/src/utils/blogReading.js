// ============================================
// Blog: "Continue reading" + "Saved for later" — on this phone only
// ============================================
// Kept in localStorage (no login, nothing sent to the server). Tested in
// tests/blogSearch.test.mjs.

const CONTINUE_KEY = 'pmz_blog_continue';
const SAVED_KEY = 'pmz_blog_saved';
const MAX_SAVED = 30;

const read = (k, fallback) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full/blocked */ } };

// Remember where the reader is. Only "halfway" counts: under 10% is a peek,
// over 90% is finished (then it's cleared).
export function noteProgress(article, pct, now = Date.now()) {
  if (!article || !article.slug) return;
  const cur = read(CONTINUE_KEY, null);
  if (pct >= 0.9) { if (cur && cur.slug === article.slug) write(CONTINUE_KEY, null); return; }
  if (pct < 0.1) return;
  write(CONTINUE_KEY, { slug: article.slug, title: article.title, image: article.image, hi: !!article.hi, pct: Math.round(pct * 100), at: now });
}
export function getContinue(now = Date.now()) {
  const c = read(CONTINUE_KEY, null);
  if (!c || !c.slug || now - (c.at || 0) > 30 * 864e5) return null; // forget after 30 days
  return c;
}

export const getSaved = () => (Array.isArray(read(SAVED_KEY, [])) ? read(SAVED_KEY, []) : []);
export const isSaved = (slug) => getSaved().some((s) => s.slug === slug);
export function toggleSaved(article) {
  const list = getSaved();
  const on = list.some((s) => s.slug === article.slug);
  const next = on ? list.filter((s) => s.slug !== article.slug) : [{ slug: article.slug, title: article.title, image: article.image }, ...list].slice(0, MAX_SAVED);
  write(SAVED_KEY, next);
  return !on;
}
