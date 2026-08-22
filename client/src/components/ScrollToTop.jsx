// ============================================
// ScrollToTop — reset scroll position on route change
// ============================================
// In a single-page app, navigating between routes does NOT reset the scroll
// position the way a full page load would. So if a user is scrolled to the
// bottom of one page and clicks a link, the next page opens still scrolled to
// the bottom — forcing them to scroll up to see the content. This component
// fixes that globally: whenever the URL PATH changes, it jumps back to the top.
//
// Mounted once inside <App /> (which sits inside <BrowserRouter>), so it
// applies to every route without touching individual pages. Renders nothing.
//
// Note: keyed on pathname only (not search/hash), so in-page anchor links
// (#section) and query-param changes on the same page don't force a jump.

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // 'auto' = instant jump (not smooth) — a navigation should feel like
    // landing at the top of a fresh page, not animating a long scroll.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}

export default ScrollToTop;
