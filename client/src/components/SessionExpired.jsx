// ============================================
// SessionExpired — "Please log in again. Your work is saved."
// ============================================
// services/api.js fires 'pmz:session-expired' when a logged-in request gets
// a 401 (login expired, or account suspended/deleted). Instead of a stream
// of error toasts, show one clear banner. "Log in again" ends the session
// WITHOUT deleting form drafts and returns the person to this page, where
// the booking / prescription / profile draft restores itself.

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

// Fixed text (follows the app-wide language). The server's suspended/deleted
// message is shown as it comes.
const EXPIRED_TXT = {
  en: {
    expired: '🔒 Please log in again. Your work on this page is saved and will be right here after you log in.',
    ok: 'OK',
    login: 'Log in →',
  },
  hi: {
    expired: '🔒 कृपया फिर से लॉग इन करें। इस पेज पर आपका भरा हुआ काम सुरक्षित है, लॉग इन के बाद यहीं मिलेगा।',
    ok: 'ठीक है',
    login: 'लॉग इन करें →',
  },
};

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];

export default function SessionExpired() {
  const [info, setInfo] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAuth();
  const { lang } = useLang(); // app-wide (top-bar switch)
  const T = EXPIRED_TXT[lang] || EXPIRED_TXT.en;

  useEffect(() => {
    const onExpired = (e) => setInfo((prev) => prev || { message: (e.detail && e.detail.message) || '' });
    window.addEventListener('pmz:session-expired', onExpired);
    return () => window.removeEventListener('pmz:session-expired', onExpired);
  }, []);

  // Logged in again (or out) → nothing to show.
  useEffect(() => { if (!isAuthenticated) setInfo(null); }, [isAuthenticated]);

  if (!info || AUTH_PAGES.some((p) => location.pathname.startsWith(p))) return null;

  const blocked = /suspended|deleted/i.test(info.message);
  const goLogin = () => {
    const from = `${location.pathname}${location.search}`;
    logout({ keepDrafts: !blocked });
    setInfo(null);
    navigate('/login', { replace: true, state: { from, skipAsk: true } });
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[80] p-3" role="alert">
      <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-xl shadow-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-red-900">
          {blocked
            ? info.message
            : T.expired}
        </p>
        <button type="button" onClick={goLogin} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 whitespace-nowrap">
          {blocked ? T.ok : T.login}
        </button>
      </div>
    </div>
  );
}
