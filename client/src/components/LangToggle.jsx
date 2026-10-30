// ============================================
// LangToggle - Shared English / हिंदी switch for patient-facing pages
// ============================================
// A small, controlled toggle that lets a patient switch the on-screen language
// on ANY patient-facing page — not just the Home page. It writes the choice to
// the shared `promedicoz_lang` localStorage key (the same key every page reads),
// so the selection carries across the whole site.
//
// WHY THIS EXISTS: several pages (doctor profile, doctor list, booking
// confirmation) previously READ the saved language but gave no way to CHANGE
// it. A patient who picked Hindi on Home, then opened a doctor profile, was
// stuck — there was no toggle. This component fills that gap consistently.
//
// It is CONTROLLED: the parent passes the current `lang` and an `onChange`
// handler. The parent keeps its own `lang` state (so it re-renders on change);
// this component just persists the choice and calls back. That means dropping
// it into a page does NOT change any of that page's translation logic — the
// page keeps using its own `lang` exactly as before.
//
// Matches the gray-pill visual already used on BookAppointment / HowItWorks.

// Now also updates the app-wide choice (context/LangContext.jsx), so the
// top-bar switch and every page stay in sync. Still used inside full-screen
// windows (medicine chart) and the tool pages, which pick language by URL.
import { useLang } from '../context/LangContext';

function LangToggle({ lang, onChange, className = '' }) {
  const app = useLang();
  const pick = (l) => {
    if (l === lang) return;
    app.setLang(l);
    if (onChange) onChange(l);
  };

  return (
    <div className={`inline-flex items-center bg-gray-100 rounded-full p-0.5 text-xs ${className}`}>
      <button
        type="button"
        onClick={() => pick('en')}
        aria-pressed={lang === 'en'}
        className={`px-3 py-1 rounded-full font-medium transition-colors ${lang === 'en' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => pick('hi')}
        aria-pressed={lang === 'hi'}
        className={`px-3 py-1 rounded-full font-medium transition-colors ${lang === 'hi' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
      >
        हिंदी
      </button>
    </div>
  );
}

export default LangToggle;
