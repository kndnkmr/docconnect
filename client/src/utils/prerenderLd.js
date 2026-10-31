// ============================================
// Structured data (JSON-LD): never twice on the same page
// ============================================
// Pre-built pages (scripts/prerender.mjs) already carry their page's
// structured data — Article, FAQ, Breadcrumb… — tagged data-pmz="page".
// Some pages (BlogArticle, SpecializationPage) also add their own via Helmet,
// so after loading Google saw every item TWICE (Search Console flags
// duplicate FAQ / Article data).
//   • On the page that was opened: the pre-built data is right, so the page
//     skips adding its own copy (pageHasPrerenderedLd → true).
//   • After moving to another page inside the app, that pre-built data is
//     about the OLD page — it's removed (dropPrerenderedLd) and pages add
//     their own as before.

const firstPath = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') || '/' : '';
const firstTypes = new Set();
if (typeof document !== 'undefined') {
  for (const s of document.querySelectorAll('script[type="application/ld+json"][data-pmz="page"]')) {
    try {
      const j = JSON.parse(s.textContent || '{}');
      (Array.isArray(j) ? j : [j]).forEach((x) => x && x['@type'] && firstTypes.add(x['@type']));
    } catch { /* ignore broken data */ }
  }
}
let dropped = false;

// Is `type` (e.g. 'Article', 'FAQPage') already provided by the pre-built
// page for `pathname`?
export function pageHasPrerenderedLd(type, pathname) {
  if (dropped) return false;
  const p = String(pathname || '').replace(/\/$/, '') || '/';
  return p === firstPath && firstTypes.has(type);
}

// Called on every route change: once we've left the first page, remove its
// pre-built data so it never describes the wrong page.
export function dropPrerenderedLd(pathname) {
  const p = String(pathname || '').replace(/\/$/, '') || '/';
  if (dropped || p === firstPath) return;
  dropped = true;
  document.querySelectorAll('script[type="application/ld+json"][data-pmz="page"]').forEach((s) => s.remove());
}
