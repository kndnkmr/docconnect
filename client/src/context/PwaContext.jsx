// ============================================
// PWA Install Context - one shared "install the app" prompt
// ============================================
// The browser fires the `beforeinstallprompt` event ONCE, and only the code
// listening at that moment can later trigger the install. Previously each
// place that offered install (the navbar, the /install page) listened on its
// OWN local state, so whichever mounted first "ate" the event and the others
// couldn't install — which is why "Get the App" behaved inconsistently.
//
// This captures the event a single time at the app root and shares it with
// every component via the usePwa() hook, so the navbar, the Home strip, and
// the /install page can all offer the same one-tap install.
//
// Note: `beforeinstallprompt` is a Chromium (Android/desktop Chrome, Edge)
// feature. It never fires on iOS Safari — there, `canInstall` stays false and
// callers should fall back to the manual "Add to Home Screen" instructions
// (which the /install page already shows).

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const PwaContext = createContext({
  canInstall: false,
  isInstalled: false,
  promptInstall: async () => false,
});

export function PwaProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(
    typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(display-mode: standalone)').matches
  );

  useEffect(() => {
    const onBeforeInstall = (e) => {
      // Stop Chrome's default mini-infobar; keep the event so WE decide when
      // to show the install UI (on a button tap).
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Fire the native install prompt. Returns true if the user accepted.
  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    try {
      const choice = await deferredPrompt.userChoice;
      // A deferred prompt can only be used once — clear it either way.
      setDeferredPrompt(null);
      return choice && choice.outcome === 'accepted';
    } catch {
      setDeferredPrompt(null);
      return false;
    }
  }, [deferredPrompt]);

  const value = {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    promptInstall,
  };

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa() {
  return useContext(PwaContext);
}
