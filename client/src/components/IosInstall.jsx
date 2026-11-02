// ============================================
// iPhone "Add to Home Screen" UI (shown on iPhone/iPad ONLY)
// ============================================
// Apple allows no one-tap install, so iPhone users get:
//   • IosInstallSheet — "follow the arrow": the page dims, a big arrow
//     points at the real Share button, one short step at a time, with a
//     🔊 Listen button (Hindi/English),
//   • IosInstalledWelcome — 🎉 the first time it's opened from the icon,
//     with one tap to turn on alerts (which only works once installed),
//   • InAppBrowserBar — "Open in Safari" when inside Instagram/Facebook/…
//     (those browsers can't add to the Home Screen at all),
//   • IosAlertsCard — "Get alerts on your iPhone" after booking / on the
//     dashboard (iPhone only allows alerts once ProMedicoz is on the Home
//     Screen).
// Every piece renders nothing unless the device is an iPhone/iPad, so
// Android and desktop are untouched. Logic + tests: utils/iosInstall.js.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { enablePushNotifications, getPushPermission, isPushSupported } from '../services/push';
import toast from 'react-hot-toast';
import { usePwa } from '../context/PwaContext';
import { useLang } from '../context/LangContext';
import { trackEvent } from './Analytics';
import { iosSteps, safariLink, iosNudgeSnoozed, snoozeIosNudge, shareButtonAt, iosGuideSteps, shouldWelcomeInstall, markWelcomeSeen } from '../utils/iosInstall';

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
    stepOf: (n, total = 3) => `Step ${n} of ${total}`, next: 'Next ›', back: '‹ Back', done: 'Done',
    listen: '🔊 Listen', stop: '⏹ Stop', stepByStep: '▶ Show me, step by step',
    welcomeTitle: 'ProMedicoz is installed!', welcomeText: 'One last tap so your doctor can reach you:',
    welcomeAlerts: '🔔 Turn on alerts', welcomeLogin: 'Log in to get alerts', welcomeLater: 'Not now',
    alertsOn: 'Alerts are on. You’ll hear from your doctor here.', alertsFail: 'Alerts could not be turned on. You can try again from your dashboard.',
    shareBelow: 'Share is in Safari’s bar below', shareAbove: 'Share is in the bar above', moreBelow: 'Tap ⋯ down here',
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
    stepOf: (n, total = 3) => `स्टेप ${n} / ${total}`, next: 'आगे ›', back: '‹ पीछे', done: 'हो गया',
    listen: '🔊 सुनें', stop: '⏹ रोकें', stepByStep: '▶ एक-एक स्टेप दिखाएं',
    welcomeTitle: 'ProMedicoz इंस्टॉल हो गया!', welcomeText: 'बस एक टैप, ताकि डॉक्टर आप तक पहुँच सकें:',
    welcomeAlerts: '🔔 अलर्ट चालू करें', welcomeLogin: 'अलर्ट के लिए लॉग इन करें', welcomeLater: 'अभी नहीं',
    alertsOn: 'अलर्ट चालू हैं। डॉक्टर की खबर आपको यहीं मिलेगी।', alertsFail: 'अलर्ट चालू नहीं हो सके। डैशबोर्ड से दोबारा कोशिश करें।',
    shareBelow: 'Share नीचे Safari पट्टी में', shareAbove: 'Share ऊपर की पट्टी में', moreBelow: '⋯ यहाँ नीचे टैप करें',
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


// ---------------- "Follow the arrow" (iPhone, not in an in-app browser) ----------------
// Read a step aloud (Web Speech API, built into iPhone Safari).
const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
function speak(text, lang, onEnd) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const u = new window.SpeechSynthesisUtterance(text);
  u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  u.rate = 0.9;
  u.onend = onEnd; u.onerror = onEnd;
  window.speechSynthesis.speak(u);
}
const stopSpeaking = () => { if (canSpeak()) window.speechSynthesis.cancel(); };

// Small pictures of what the user will see, drawn like Apple's own screens.
function ShareIcon() {
  return (
    <span className="inline-flex items-center justify-center w-14 h-12 rounded-xl bg-primary-50 border-2 border-primary-600 text-primary-600" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12" /><path d="M7.5 7.5 12 3l4.5 4.5" /><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
      </svg>
    </span>
  );
}
function MenuPicture() {
  return (
    <div className="mx-auto w-56 rounded-xl bg-gray-50 border border-gray-200 p-2 space-y-1.5 text-left" aria-hidden="true">
      <div className="rounded-lg bg-white px-3 py-2 text-xs text-gray-400">Copy</div>
      <div className="rounded-lg bg-primary-50 border-2 border-primary-600 px-3 py-2.5 flex items-center justify-between">
        <span className="text-sm font-bold text-primary-900">Add to Home Screen</span>
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary-900" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></svg>
      </div>
      <div className="rounded-lg bg-white px-3 py-2 text-xs text-gray-400">Add Bookmark</div>
    </div>
  );
}
function MorePicture() {
  return (
    <div className="mx-auto w-60 rounded-full bg-gray-100 border border-gray-200 pl-4 pr-1.5 py-1.5 flex items-center justify-between" aria-hidden="true">
      <span className="text-xs text-gray-500">promedicoz.in</span>
      <span className="w-10 h-10 rounded-full bg-primary-50 border-2 border-primary-600 text-primary-700 text-xl font-bold flex items-center justify-center">⋯</span>
    </div>
  );
}
function AddPicture({ webAppSwitch = false }) {
  return (
    <div className="mx-auto w-56" aria-hidden="true">
      <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 flex items-center justify-between text-sm">
        <span className="text-gray-400">Cancel</span>
        <span className="relative font-bold text-primary-600">Add<span className="absolute -inset-2 rounded-full border-[3px] border-amber-400" /></span>
      </div>
      {webAppSwitch && (
        <div className="mt-2 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 flex items-center justify-between text-xs text-gray-700">
          <span>Open as Web App</span>
          <span className="w-9 h-5 rounded-full bg-green-500 relative"><span className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-white" /></span>
        </div>
      )}
      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-600">
        <img src="/icons/apple-touch-icon-180.png" alt="" className="w-9 h-9 rounded-[10px] shadow" />
        <span>ProMedicoz</span>
      </div>
    </div>
  );
}

function FollowTheArrow({ env, onClose }) {
  const { t, lang } = useT();
  const [step, setStep] = useState(0);
  const [talking, setTalking] = useState(false);
  const steps = iosGuideSteps(env, lang);
  const at = shareButtonAt(env); // 'bottom' | 'top'
  const cur = steps[step];
  useEffect(() => () => stopSpeaking(), []);
  // Hide the app's own bottom tabs (and the floating WhatsApp button) while guiding, so the arrow points past
  // the page edge to Safari's real bar (not at our "Doctors"/"Blog" tabs).
  useEffect(() => {
    document.body.classList.add('pmz-guide-open');
    return () => document.body.classList.remove('pmz-guide-open');
  }, []);
  useEffect(() => { stopSpeaking(); setTalking(false); }, [step]);
  const go = (n) => { trackEvent('ios_install_step', { step: n + 1 }); setStep(n); };
  const close = () => { stopSpeaking(); onClose(); };
  const listen = () => {
    if (talking) { stopSpeaking(); setTalking(false); return; }
    setTalking(true);
    speak(cur.say, lang, () => setTalking(false));
  };
  const newLayout = steps.length === 4; // iOS 26 Safari: ⋯ → Share → Add to Home Screen → Add
  const PICTURE = { more: <MorePicture />, share: <ShareIcon />, 'add-home': <MenuPicture />, add: <AddPicture webAppSwitch={newLayout} /> };
  // Card sits away from the arrow: top of the screen when the button is at
  // the bottom, and the other way round.
  const cardPos = at !== 'top' ? 'items-start pt-[calc(1rem+env(safe-area-inset-top))]' : 'items-end pb-[calc(1rem+env(safe-area-inset-bottom))]';
  return (
    // Portal to <body> at the very top layer, so the app's own bottom tabs
    // are dimmed too and can't be mistaken for Safari's bar.
    createPortal(<div className={`fixed inset-0 z-[1000] flex justify-center px-3 bg-black/70 ${cardPos}`} onClick={close}>
      <style>{`
        @keyframes pmzBounceDown{0%,100%{transform:translateY(0)}50%{transform:translateY(14px)}}
        @keyframes pmzBounceUp{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
        .pmz-arrow-down{animation:pmzBounceDown 1s ease-in-out infinite}
        .pmz-arrow-up{animation:pmzBounceUp 1s ease-in-out infinite}
        body.pmz-guide-open [data-bottom-nav],body.pmz-guide-open [data-floating-whatsapp]{display:none !important}
        @media (prefers-reduced-motion:reduce){.pmz-arrow-down,.pmz-arrow-up{animation:none}}
      `}</style>
      <div role="dialog" aria-modal="true" aria-label={t.title} onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 text-center">
        <button type="button" onClick={close} aria-label={t.close} className="absolute top-3 right-3 text-gray-500 text-xl leading-none">✕</button>
        <p className="text-xs font-semibold text-gray-500 flex items-center justify-center gap-2">
          {t.stepOf(step + 1, steps.length)}
          <span className="flex gap-1" aria-hidden="true">{steps.map((_, i) => <span key={i} className={`w-2 h-2 rounded-full ${i <= step ? 'bg-primary-600' : 'bg-gray-300'}`} />)}</span>
        </p>
        <h2 className="text-xl font-extrabold text-gray-900 mt-2" aria-live="polite">{cur.title}</h2>
        <p className="text-sm text-gray-600 mt-1 mb-4">{cur.sub}</p>
        <div className="flex justify-center">{PICTURE[cur.key]}</div>
        <div className="mt-5 flex items-center justify-between gap-2">
          {step > 0
            ? <button type="button" onClick={() => go(step - 1)} className="px-3 py-2 text-sm text-gray-600">{t.back}</button>
            : <span className="w-16" />}
          {canSpeak() && (
            <button type="button" onClick={listen} className="px-3 py-2 rounded-full border border-gray-300 text-sm font-medium text-gray-700">{talking ? t.stop : t.listen}</button>
          )}
          {step < steps.length - 1
            ? <button type="button" onClick={() => go(step + 1)} className="px-5 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold">{t.next}</button>
            : <button type="button" onClick={close} className="px-5 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold">{t.done}</button>}
        </div>
      </div>
      {/* The big bouncing arrow at the REAL Share button (step 1 only). */}
      {step === 0 && at === 'bottom-right' && (
        <div className="pointer-events-none fixed right-3 bottom-[env(safe-area-inset-bottom)] flex flex-col items-end text-amber-300" aria-hidden="true">
          <span className="whitespace-nowrap text-sm font-bold text-white mb-1 drop-shadow bg-black/40 rounded-full px-3 py-1">{t.moreBelow}</span>
          <svg viewBox="0 0 48 64" className="pmz-arrow-down w-14 h-20 mr-1 drop-shadow-lg" fill="currentColor"><path d="M18 0h12v40h14L24 64 4 40h14z" /></svg>
        </div>
      )}
      {step === 0 && at !== 'bottom-right' && (at === 'bottom' ? (
        <div className="pointer-events-none fixed left-1/2 -translate-x-1/2 bottom-[env(safe-area-inset-bottom)] flex flex-col items-center text-amber-300" aria-hidden="true">
          <span className="whitespace-nowrap text-sm font-bold text-white mb-1 drop-shadow bg-black/40 rounded-full px-3 py-1">{t.shareBelow}</span>
          <svg viewBox="0 0 48 64" className="pmz-arrow-down w-14 h-20 drop-shadow-lg" fill="currentColor"><path d="M18 0h12v40h14L24 64 4 40h14z" /></svg>
        </div>
      ) : (
        <div className="pointer-events-none fixed right-3 top-[calc(0.25rem+env(safe-area-inset-top))] flex flex-col items-center text-amber-300" aria-hidden="true">
          <svg viewBox="0 0 48 64" className="pmz-arrow-up w-12 h-16 drop-shadow-lg" fill="currentColor"><path d="M18 64h12V24h14L24 0 4 24h14z" /></svg>
          <span className="whitespace-nowrap text-sm font-bold text-white mt-1 drop-shadow bg-black/40 rounded-full px-3 py-1">{t.shareAbove}</span>
        </div>
      ))}
    </div>, document.body)
  );
}

// 🎉 First open from the Home Screen icon: celebrate + turn on alerts.
export function IosInstalledWelcome() {
  const { iosEnv } = usePwa();
  const { isAuthenticated } = useAuth();
  const { t } = useT();
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && shouldWelcomeInstall(iosEnv, window.localStorage));
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const finish = () => { markWelcomeSeen(window.localStorage); setOpen(false); };
  const needsAlerts = isPushSupported() && getPushPermission() === 'default';
  const turnOn = async () => {
    setBusy(true);
    const ok = await enablePushNotifications();
    setBusy(false);
    trackEvent('ios_installed_alerts', { ok: ok ? 'yes' : 'no' });
    if (ok) toast.success(t.alertsOn); else toast.error(t.alertsFail);
    finish();
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4" onClick={finish}>
      <div role="dialog" aria-modal="true" aria-label={t.welcomeTitle} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-center">
        <div className="text-5xl" aria-hidden="true">🎉</div>
        <h2 className="text-xl font-extrabold text-gray-900 mt-2">{t.welcomeTitle}</h2>
        {needsAlerts ? (
          <>
            <p className="text-sm text-gray-600 mt-1 mb-4">{t.welcomeText}</p>
            {isAuthenticated ? (
              <button type="button" onClick={turnOn} disabled={busy} className="w-full py-3 rounded-lg bg-primary-600 text-white font-semibold disabled:opacity-60">{t.welcomeAlerts}</button>
            ) : (
              <Link to="/login" onClick={finish} className="block w-full py-3 rounded-lg bg-primary-600 text-white font-semibold">{t.welcomeLogin}</Link>
            )}
            <button type="button" onClick={finish} className="mt-2 w-full py-2 text-sm text-gray-600">{t.welcomeLater}</button>
          </>
        ) : (
          <button type="button" onClick={finish} className="mt-4 w-full py-3 rounded-lg bg-primary-600 text-white font-semibold">{t.done}</button>
        )}
      </div>
    </div>
  );
}

// Opened from any "Install" / "Get the App" tap on iPhone, and from
// IosAlertsCard. Hosted once in App.jsx. In-app browsers get "Open in
// Safari"; everyone else gets "follow the arrow".
export function IosInstallSheet() {
  const { iosEnv, iosGuideOpen, closeIosGuide } = usePwa();
  const { t } = useT();
  useEffect(() => {
    if (!iosGuideOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeIosGuide(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [iosGuideOpen, closeIosGuide]);
  if (!iosGuideOpen || !iosEnv.ios) return null;
  const app = iosEnv.inApp;
  if (!app) return <FollowTheArrow env={iosEnv} onClose={closeIosGuide} />;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40" onClick={closeIosGuide}>
      <div role="dialog" aria-modal="true" aria-label={t.title}
        className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="text-lg font-bold text-gray-800">📲 {t.inAppTitle(app)}</h2>
          <button type="button" onClick={closeIosGuide} aria-label={t.close} className="text-gray-500 text-xl leading-none">✕</button>
        </div>
        <p className="text-sm text-gray-600 mb-4">{t.inAppText(app)}</p>
        <SafariActions app={app} t={t} />
        <p className="text-xs text-gray-500 mt-3">{t.inAppHelp(app)}</p>
      </div>
    </div>
  );
}

// Inline guide for the /install page (iPhone only).
export function IosInstallSteps() {
  const { iosEnv, openIosGuide } = usePwa();
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
      <button type="button" onClick={() => { trackEvent('ios_install_guide', { source: 'install_page' }); openIosGuide(); }}
        className="w-full mb-4 py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700">{t.stepByStep}</button>
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
