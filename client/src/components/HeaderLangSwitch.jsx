// ============================================
// Top-bar English / हिंदी switch — the one language switch for the app
// ============================================
// Lives in the Navbar on every page (phone: next to the menu button), so a
// patient who can't read English always finds it in the same place.
// Hidden for doctors and admins (their screens are English) and on the blog
// and free-tool pages, which have their own language by web address
// (/blog/…/hi, /tools/…/hi) and their own switch.
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

export function showHeaderLang(pathname, role) {
  if (role === 'doctor' || role === 'admin') return false;
  return !/^\/(blog|tools|admin)(\/|$)/.test(pathname || '');
}

export default function HeaderLangSwitch({ compact = false }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { lang, setLang } = useLang();
  if (!showHeaderLang(pathname, user && user.role)) return null;
  const btn = (l, label, aria) => (
    <button
      type="button"
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      aria-label={aria}
      lang={l}
      className={`rounded-full font-semibold transition-colors ${compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1 text-sm'} ${lang === l ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-200'}`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Language / भाषा" className="inline-flex items-center bg-gray-100 border border-gray-200 rounded-full p-0.5">
      {btn('en', compact ? 'EN' : 'English', 'English')}
      {btn('hi', compact ? 'हिं' : 'हिंदी', 'हिंदी')}
    </div>
  );
}
