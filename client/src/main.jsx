// ============================================
// Main Entry Point - Where React starts
// ============================================
// This is the FIRST JavaScript file that runs.
// It takes our React app (App component) and puts it into the HTML page.
//
// Think of it like plugging a TV into a wall socket:
// - The wall socket = <div id="root"> in index.html
// - The TV = our App component
// - This file = the power cord connecting them

import React from 'react';
import ReactDOM from 'react-dom/client';
// ReactDOM = the library that connects React to the browser's DOM
// (DOM = Document Object Model = the HTML structure on the page)

import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
// BrowserRouter = enables page navigation in our app
// It watches the URL and renders the matching page component
// Wrapping our app in BrowserRouter means ANY component inside can use routing

import toast from 'react-hot-toast';
// For a brief "updating" message when a new version is picked up

import App from './App.jsx';
// Our main App component (we'll create this next)

import { AuthProvider } from './context/AuthContext.jsx';
// AuthProvider = wraps our app with authentication state
// Any component can then check: "Is the user logged in? What's their role?"

import { PwaProvider } from './context/PwaContext.jsx';
// LangProvider = one English / हिंदी choice for the whole app (top-bar switch).
import { LangProvider } from './context/LangContext.jsx';
// PwaProvider = captures the browser's "install app" prompt ONCE and shares
// it, so every "Get the App" entry point offers the same one-tap install.

import './index.css';
// Records which page was opened and what structured data it came with, at
// start-up (before any navigation) — see utils/prerenderLd.js.
import './utils/prerenderLd';
// Import our global styles (Tailwind CSS directives)

// ---- Render the app ----
// createRoot() creates a "root" that React controls
// .render() puts our component tree into the DOM

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      {/* v7_startTransition: when a link opens a page whose code is still
          downloading, keep the current page on screen until the new one is
          ready, instead of flashing "Loading…" (was most visible opening
          blog articles from Home / "More to read"). */}
      <BrowserRouter future={{ v7_startTransition: true }}>
        <AuthProvider>
          <PwaProvider>
            <LangProvider>
              <App />
            </LangProvider>
          </PwaProvider>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);

// ---- Blog articles: never wait in line ----
// 1) Opened straight from a link (WhatsApp / Google): start loading this
//    article now, while React starts up (the pre-built page already asked the
//    browser for the files with <link rel="modulepreload">). By the time the
//    article page draws, the text is ready — no "Loading…".
// 2) Anywhere on the site (Home, "More to read", links inside articles):
//    a finger touching / mouse hovering an article link starts its download.
const ARTICLE_PATH = /^\/blog\/([a-z0-9-]+)(?:\/hi)?\/?$/;
const prefetchSlug = (slug) => {
  import('./pages/blog/articleBodies').then((m) => m.prefetchArticle(slug)).catch(() => {});
};
{
  const m = ARTICLE_PATH.exec(window.location.pathname);
  if (m) prefetchSlug(m[1]);
  const early = (e) => {
    const a = e.target && e.target.closest && e.target.closest('a[href^="/blog/"]');
    if (!a) return;
    const hit = ARTICLE_PATH.exec(a.getAttribute('href').split(/[?#]/)[0]);
    if (hit) prefetchSlug(hit[1]);
  };
  document.addEventListener('pointerdown', early, { passive: true, capture: true });
  document.addEventListener('mouseover', early, { passive: true });
  document.addEventListener('focusin', early);
}

// ---- Missing page piece after a new deploy → reload once ----
// Screens (dashboard tabs, chat, call…) load on demand. If a new version was
// deployed while this tab was open, an old piece may no longer exist; instead
// of a blank screen, reload once to pick up the new version (forms are
// autosaved as drafts, so nothing is lost). The 30 s guard prevents loops.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('pmz-chunk-reload') || 0);
    if (Date.now() - last < 30000) return; // already tried — let the error show
    sessionStorage.setItem('pmz-chunk-reload', String(Date.now()));
  } catch (e) { /* storage blocked: still reload once */ }
  event.preventDefault();
  window.location.reload();
});

// ---- Register Service Worker (PWA) ----
// Only in production — dev mode doesn't need caching
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Check for updates on load...
        reg.update();

        // ...and periodically while the tab is actually open and active.
        // (A plain setInterval alone is unreliable — browsers routinely pause
        // JS timers on backgrounded/inactive tabs to save battery, especially
        // on mobile, so a PWA left open in the background for a while may
        // never fire the interval and can go a long time without checking.)
        setInterval(() => reg.update(), 15 * 60 * 1000);

        // ...and — most importantly — right when the user comes back to the
        // app (switches tabs back, reopens from the home screen, unlocks
        // their phone). This is the moment that actually matters: it means
        // a returning user gets the latest version within a second or two of
        // opening the app, instead of waiting on a background timer.
        const checkOnReturn = () => {
          if (document.visibilityState === 'visible') reg.update();
        };
        document.addEventListener('visibilitychange', checkOnReturn);
        window.addEventListener('focus', checkOnReturn);
      })
      .catch((err) => console.log('Service Worker registration failed:', err));

    // When a new service worker takes control (new deploy), show a brief message
    // and reload ONCE so the user immediately gets the latest app — no manual
    // cache clearing needed.
    // Only for UPDATES: on a first visit there is no previous worker, and the
    // first one taking control must not reload the page (that wiped whatever
    // the visitor had just started — a search, a form, a chosen photo).
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      if (refreshing) return;
      refreshing = true;
      try {
        toast.loading('Updating to the latest version…', { duration: 1500 });
      } catch (e) { /* toast not critical */ }
      setTimeout(() => window.location.reload(), 1200);
    });
  });
}
