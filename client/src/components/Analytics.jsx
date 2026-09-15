// ============================================
// Analytics — send a GA4 page_view on every route change
// ============================================
// This is a Single Page App. The browser loads a real HTML page only once;
// after that, React Router swaps "pages" on the client without a full reload.
// GA4's automatic pageview only fires on that first real load — so without
// this, navigating from one blog article to another (or anywhere) would NOT
// be counted, and your view numbers would be badly under-reported.
//
// index.html sets `send_page_view: false` on the GA4 config to turn off the
// automatic (and inaccurate-for-SPA) pageview. This component then fires ONE
// page_view manually on every route change — the correct way to track a SPA.
//
// Mounted once inside <App /> (which sits inside <BrowserRouter>), exactly like
// ScrollToTop, so it covers every route without touching individual pages.
// Renders nothing.
//
// Safe by design: if gtag isn't loaded (e.g. an ad-blocker removed it, or a
// dev build without the snippet), it simply does nothing — no errors.

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Your GA4 Measurement ID (matches the snippet in index.html).
const GA_MEASUREMENT_ID = 'G-28BZZQPPXF';

function Analytics() {
  // Keyed on the full location (path + query) so a genuine navigation is
  // counted, including query-string changes that represent a new view.
  const { pathname, search } = useLocation();

  useEffect(() => {
    // gtag is defined by the snippet in index.html. Guard in case it isn't
    // present (blocked, or a build without analytics) so we never crash.
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
      return;
    }

    const page_path = pathname + search;

    // Pages set their <title> via react-helmet-async, which updates the DOM
    // title AFTER this effect runs. So we send the page_view on the next tick,
    // by when document.title reflects the new page (e.g. the article title) —
    // giving accurate "Page title" reporting in GA4. A tiny 0ms-ish timeout is
    // enough; helmet has committed by then.
    const timer = setTimeout(() => {
      window.gtag('event', 'page_view', {
        page_path,
        page_location: window.location.href,
        page_title: document.title,
        send_to: GA_MEASUREMENT_ID,
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [pathname, search]);

  return null;
}

export default Analytics;
