// ============================================
// iPhone "Add to Home Screen" UI (shown on iPhone/iPad ONLY)
// ============================================
// Apple allows no one-tap install, so iPhone users get:
//   • IosInstallSheet — the 3 taps with a looping animated demo,
//   • InAppBrowserBar — "Open in Safari" when inside Instagram/Facebook/…
//     (those browsers can't add to the Home Screen at all),
//   • IosAlertsCard — "Get alerts on your iPhone" after booking / on the
//     dashboard (iPhone only allows alerts once ProMedicoz is on the Home
//     Screen).
// Every piece renders nothing unless the device is an iPhone/iPad, so
// Android and desktop are untouched. Logic + tests: utils/iosInstall.js.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { usePwa } from '../context/PwaContext';
import { useLang } from '../context/LangContext';
import { trackEvent } from './Analytics';
import { iosSteps, safariLink, iosNudgeSnoozed, snoozeIosNudge } from '../utils/iosInstall';

const T = {
  en: {
    title: 'Add ProMedicoz to your iPhone',
    why: 'Apple doesn’t allow a one-tap install button, so it’s these 3 quick taps:',
    got: 'Got it', close: 'Close',
    after: 'Then open ProMedicoz from its Home Screen icon. It opens like an app and can send you alerts.',
    inAppTitle: () => 'Open in Safari first',
    inAppText: (app) => `${app}’s browser can’t add apps to your Home Screen.`,
    openSafari: '🧭 Open in Safari', copy: '📋 Copy link',
    copied: 'Link copied. Open Safari and paste it in the address bar.',
    inAppHelp: (app) => `If Safari doesn’t open: tap ⋯ or ⬆ in ${app} → “Open in browser”, or paste the link in Safari.`,
    barText: (app) => `You’re in ${app}’s browser.`,
    alertsTitle: '🔔 Get alerts on your iPhone',
    alertsPatient: 'Know the moment the doctor confirms or calls you. iPhone needs ProMedicoz on your Home Screen for alerts (3 taps).',
    alertsDoctor: 'Get an alert the moment a patient books, pays or calls. iPhone needs ProMedicoz on your Home Screen for alerts (3 taps).',
    showMe: 'Show me how', later: 'Maybe later',
    demo: 'Animation showing the 3 taps',
  },
  hi: {
    title: 'ProMedicoz को iPhone पर जोड़ें',
    why: 'Apple एक-टैप इंस्टॉल बटन की अनुमति नहीं देता, इसलिए ये 3 आसान टैप करें:',
    got: 'ठीक है', close: 'बंद करें',
    after: 'फिर Home Screen के ProMedicoz आइकन से खोलें। यह ऐप की तरह खुलेगा और अलर्ट भेज सकेगा।',
    inAppTitle: () => 'पहले Safari में खोलें',
    inAppText: (app) => `${app} का ब्राउज़र Home Screen पर ऐप नहीं जोड़ सकता।`,
    openSafari: '🧭 Safari में खोलें', copy: '📋 लिंक कॉपी करें',
    copied: 'लिंक कॉपी हो गया। Safari खोलें और ऊपर पता-पट्टी में पेस्ट करें।',
    inAppHelp: (app) => `अगर Safari न खुले: ${app} में ⋯ या ⬆ टैप करें → “Open in browser”, या लिंक Safari में पेस्ट करें।`,
    barText: (app) => `आप ${app} के ब्राउज़र में हैं।`,
    alertsTitle: '🔔 iPhone पर अलर्ट पाएं',
    alertsPatient: 'डॉक्टर के कन्फ़र्म करते या कॉल करते ही पता चलेगा। अलर्ट के लिए iPhone पर ProMedicoz को Home Screen पर जोड़ना ज़रूरी है (3 टैप)।',
    alertsDoctor: 'मरीज़ के बुक, भुगतान या कॉल करते ही अलर्ट पाएं। अलर्ट के लिए iPhone पर ProMedicoz को Home Screen पर जोड़ना ज़रूरी है (3 टैप)।',
    showMe: 'तरीका दिखाएं', later: 'बाद में',
    demo: '3 टैप दिखाने वाला एनिमेशन',
  },
};
const useT = () => { const { lang } = useLang(); return { t: T[lang] || T.en, lang }; };

// Looping 3-step demo (pure SVG + CSS; still image if the user prefers
// less motion). Step n is highlighted in the list in sync.
function StepsDemo({ label }) {
  return (
    <div className="ios-demo mx-auto w-40" role="img" aria-label={label}>
      <style>{`
        .ios-demo .f{opacity:0;animation:iosf 7.5s infinite}
        .ios-demo .f2{animation-delay:2.5s}.ios-demo .f3{animation-delay:5s}
        @keyframes iosf{0%,3%{opacity:0}6%,30%{opacity:1}33%,100%{opacity:0}}
        .ios-demo .tap{transform-box:fill-box;transform-origin:center;animation:iost 1.25s infinite}
        @keyframes iost{0%{transform:scale(.7);opacity:.9}100%{transform:scale(2);opacity:0}}
        @media (prefers-reduced-motion:reduce){.ios-demo .f{animation:none}.ios-demo .f1{opacity:1}.ios-demo .tap{animation:none}}
      `}</style>
      <svg viewBox="0 0 160 260" className="w-full h-auto">
        <rect x="4" y="4" width="152" height="252" rx="22" fill="#fff" stroke="#9ca3af" strokeWidth="3" />
        <rect x="16" y="22" width="128" height="14" rx="7" fill="#e5e7eb" />
        <text x="80" y="32" textAnchor="middle" fontSize="8" fill="#6b7280">promedicoz.in</text>
        <rect x="20" y="48" width="120" height="10" rx="3" fill="#dbeafe" />
        <rect x="20" y="64" width="90" height="8" rx="3" fill="#f3f4f6" />
        <rect x="20" y="78" width="104" height="8" rx="3" fill="#f3f4f6" />
        {/* frame 1: tap Share in the bottom bar */}
        <g className="f f1">
          <rect x="8" y="218" width="144" height="30" fill="#f3f4f6" />
          <text x="34" y="238" fontSize="12" fill="#6b7280">‹  ›</text>
          <text x="80" y="239" textAnchor="middle" fontSize="15" fill="#2563eb">⬆</text>
          <text x="118" y="238" fontSize="11" fill="#6b7280">▢ ☰</text>
          <circle className="tap" cx="80" cy="234" r="8" fill="#2563eb" />
          <text x="80" y="206" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1d4ed8">1 · Share</text>
        </g>
        {/* frame 2: Add to Home Screen row */}
        <g className="f f2">
          <rect x="8" y="110" width="144" height="138" rx="12" fill="#f9fafb" stroke="#e5e7eb" />
          <rect x="18" y="122" width="124" height="18" rx="5" fill="#fff" />
          <text x="26" y="134" fontSize="8" fill="#6b7280">Copy</text>
          <rect x="18" y="146" width="124" height="22" rx="5" fill="#dbeafe" stroke="#2563eb" />
          <text x="26" y="160" fontSize="9" fontWeight="700" fill="#1e3a8a">Add to Home Screen ⊞</text>
          <rect x="18" y="174" width="124" height="18" rx="5" fill="#fff" />
          <text x="26" y="186" fontSize="8" fill="#6b7280">Add Bookmark</text>
          <circle className="tap" cx="128" cy="157" r="8" fill="#2563eb" />
          <text x="80" y="104" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1d4ed8">2 · Add to Home Screen</text>
        </g>
        {/* frame 3: Add (top right) */}
        <g className="f f3">
          <rect x="8" y="8" width="144" height="70" rx="18" fill="#f9fafb" />
          <text x="22" y="34" fontSize="9" fill="#6b7280">Cancel</text>
          <text x="138" y="34" textAnchor="end" fontSize="10" fontWeight="700" fill="#2563eb">Add</text>
          <circle className="tap" cx="128" cy="31" r="8" fill="#2563eb" />
          <rect x="22" y="44" width="20" height="20" rx="5" fill="#2563eb" />
          <text x="50" y="58" fontSize="9" fill="#111827">ProMedicoz</text>
          <text x="80" y="104" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1d4ed8">3 · Add</text>
        </g>
      </svg>
    </div>
  );
}

// "Open in Safari" + copy link (for in-app browsers).
function SafariActions({ app, t, compact = false }) {
  const url = typeof window !== 'undefined' ? window.location.href : 'https://www.promedicoz.in/';
  const copy = async () => {
    trackEvent('ios_inapp_copy', { app });
    try { await navigator.clipboard.writeText(url); toast.success(t.copied, { duration: 6000 }); }
    catch { window.prompt(t.copied, url); }
  };
  const sl = safariLink(url);
  return (
    <div className={compact ? 'flex items-center gap-2' : 'flex flex-col gap-2'}>
      {sl && (
        <a href={sl} onClick={() => trackEvent('ios_inapp_safari', { app })}
          className={compact ? 'font-semibold underline whitespace-nowrap' : 'w-full text-center bg-primary-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700'}>
          {t.openSafari}
        </a>
      )}
      <button type="button" onClick={copy}
        className={compact ? 'underline whitespace-nowrap' : 'w-full py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50'}>
        {t.copy}
      </button>
    </div>
  );
}

// The bottom sheet. Opened from any "Install" / "Get the App" tap on
// iPhone, and from IosAlertsCard. Hosted once in App.jsx.
export function IosInstallSheet() {
  const { iosEnv, iosGuideOpen, closeIosGuide } = usePwa();
  const { t, lang } = useT();
  useEffect(() => {
    if (!iosGuideOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeIosGuide(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [iosGuideOpen, closeIosGuide]);
  if (!iosGuideOpen || !iosEnv.ios) return null;
  const app = iosEnv.inApp;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40" onClick={closeIosGuide}>
      <div role="dialog" aria-modal="true" aria-label={t.title}
        className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="text-lg font-bold text-gray-800">📲 {app ? t.inAppTitle(app) : t.title}</h2>
          <button type="button" onClick={closeIosGuide} aria-label={t.close} className="text-gray-500 text-xl leading-none">✕</button>
        </div>
        {app ? (
          <>
            <p className="text-sm text-gray-600 mb-4">{t.inAppText(app)}</p>
            <SafariActions app={app} t={t} />
            <p className="text-xs text-gray-500 mt-3">{t.inAppHelp(app)}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-3">{t.why}</p>
            <StepsDemo label={t.demo} />
            <ol className="mt-4 space-y-2">
              {iosSteps(iosEnv, lang).map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-50 text-primary-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-gray-500 mt-3">{t.after}</p>
            <button type="button" onClick={closeIosGuide} className="mt-4 w-full bg-primary-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700">{t.got}</button>
          </>
        )}
      </div>
    </div>
  );
}

// Inline guide for the /install page (iPhone only).
export function IosInstallSteps() {
  const { iosEnv } = usePwa();
  const { t, lang } = useT();
  if (!iosEnv.ios) return null;
  if (iosEnv.inApp) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
        <p className="font-semibold text-gray-800 text-sm">{t.inAppTitle(iosEnv.inApp)}</p>
        <p className="text-sm text-gray-600 mt-1 mb-3">{t.inAppText(iosEnv.inApp)}</p>
        <SafariActions app={iosEnv.inApp} t={t} />
        <p className="text-xs text-gray-500 mt-3">{t.inAppHelp(iosEnv.inApp)}</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm text-gray-600 mb-3">{t.why}</p>
      <StepsDemo label={t.demo} />
      <ol className="mt-4 space-y-2">
        {iosSteps(iosEnv, lang).map((s, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-50 text-red-500 text-xs font-bold flex items-center justify-center">{i + 1}</span>
            <span className="leading-relaxed pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-gray-500 mt-3">{t.after}</p>
    </div>
  );
}

// Slim "you're in Instagram's browser → Open in Safari" strip (iPhone in-app only).
export function InAppBrowserBar() {
  const { iosEnv } = usePwa();
  const { t } = useT();
  const [hidden, setHidden] = useState(false);
  if (!iosEnv.ios || !iosEnv.inApp || hidden) return null;
  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs sm:text-sm px-4 py-2 flex items-center justify-between gap-3">
      <span className="min-w-0">{t.barText(iosEnv.inApp)}</span>
      <SafariActions app={iosEnv.inApp} t={t} compact />
      <button type="button" onClick={() => setHidden(true)} aria-label={t.close} className="text-amber-700 px-1">✕</button>
    </div>
  );
}

// "Get alerts on your iPhone" — iPhone Safari (not installed) only; that's
// exactly where the normal "Turn on alerts" card can't show.
export function IosAlertsCard({ who = 'patient', className = '' }) {
  const { iosEnv, openIosGuide } = usePwa();
  const { t } = useT();
  const [snoozed, setSnoozed] = useState(() => typeof window === 'undefined' || iosNudgeSnoozed(window.localStorage));
  if (!iosEnv.ios || iosEnv.installed || snoozed) return null;
  return (
    <div className={`bg-primary-50 border border-primary-200 rounded-xl p-5 ${className}`}>
      <h3 className="font-semibold text-gray-800">{t.alertsTitle}</h3>
      <p className="text-sm text-gray-600 mt-1">{who === 'doctor' ? t.alertsDoctor : t.alertsPatient}</p>
      <div className="flex gap-3 mt-4">
        <button type="button" onClick={() => { trackEvent('ios_install_guide', { source: `alerts_${who}` }); openIosGuide(); }}
          className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary-700">{t.showMe}</button>
        <button type="button" onClick={() => { snoozeIosNudge(window.localStorage); setSnoozed(true); }}
          className="px-5 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100">{t.later}</button>
      </div>
    </div>
  );
}
