// ============================================
// LangContext — one English / हिंदी choice for the whole app
// ============================================
// Before: every page kept its own copy of the language (read once from
// localStorage) and had its own switch in a different place, so switching on
// one page didn't change the rest until reload, and many pages had no switch.
// Now: one choice, one switch in the top bar (Navbar), every page re-renders
// at once.
//
// First visit: follows the phone's language (Hindi phone → Hindi). Once the
// person taps the switch, that choice is saved ('promedicoz_lang') and kept.
//
// Usage in a page:   const { lang, setLang, tr } = useLang();
//                    tr('Book now', 'अभी बुक करें')
// Doctor / Admin screens don't translate, so they stay English regardless.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'promedicoz_lang';

export function initialLang({ saved, languages } = {}) {
  if (saved === 'en' || saved === 'hi') return saved;
  const list = Array.isArray(languages) ? languages : [];
  return list.some((l) => /^hi\b/i.test(String(l))) ? 'hi' : 'en';
}

function readInitial() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  const languages = typeof navigator !== 'undefined' ? (navigator.languages || [navigator.language]) : [];
  return initialLang({ saved, languages });
}

const LangContext = createContext({ lang: 'en', setLang: () => {}, tr: (en) => en });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(readInitial);

  const setLang = useCallback((l) => {
    const next = l === 'hi' ? 'hi' : 'en';
    setLangState(next);
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  }, []);

  // Another tab changed it → follow.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === KEY && (e.newValue === 'en' || e.newValue === 'hi')) setLangState(e.newValue); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Screen readers read the page in the right language.
  useEffect(() => {
    try { document.documentElement.lang = lang === 'hi' ? 'hi' : 'en'; } catch { /* ignore */ }
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, tr: (en, hi) => (lang === 'hi' && hi ? hi : en) }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
