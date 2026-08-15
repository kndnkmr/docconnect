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

import './index.css';
// Import our global styles (Tailwind CSS directives)

// ---- Render the app ----
// createRoot() creates a "root" that React controls
// .render() puts our component tree into the DOM

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);

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
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      try {
        toast.loading('Updating to the latest version…', { duration: 1500 });
      } catch (e) { /* toast not critical */ }
      setTimeout(() => window.location.reload(), 1200);
    });
  });
}
