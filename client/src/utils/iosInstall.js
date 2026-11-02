// ============================================
// iPhone "Add to Home Screen" helper (iPhone/iPad ONLY)
// ============================================
// Apple gives websites no one-tap install (no `beforeinstallprompt`), so on
// iPhone we guide the 3 manual taps instead, at the moments it matters, and
// help people leave in-app browsers (Instagram, Facebook…) that can't add
// to the Home Screen at all.
//
// Android / desktop are NOT affected: everything here returns ios:false
// there, and every caller only shows iPhone UI when ios is true. The
// Android one-tap install (PwaContext) is unchanged.
// Tests: tests/iosInstall.test.mjs

// Which in-app browsers can't "Add to Home Screen" (from their user agent).
const IN_APP = [
  [/FBAN|FBAV|FB_IAB|FBIOS/i, 'Facebook'],
  [/Instagram/i, 'Instagram'],
  [/WhatsApp/i, 'WhatsApp'],
  [/\bLine\//i, 'LINE'],
  [/Snapchat/i, 'Snapchat'],
  [/LinkedInApp/i, 'LinkedIn'],
  [/Twitter/i, 'X'],
  [/musical_ly|BytedanceWebview|TikTok/i, 'TikTok'],
  [/Pinterest/i, 'Pinterest'],
];

// ua: navigator.userAgent; touchPoints: navigator.maxTouchPoints;
// standalone: already opened from the Home Screen icon.
export function installEnv({ ua = '', touchPoints = 0, standalone = false } = {}) {
  // iPadOS 13+ says "Macintosh" — tell it apart by its touch screen.
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1);
  if (!ios) return { ios: false, inApp: null, browser: 'other', installed: Boolean(standalone) };
  const ipad = /iPad/i.test(ua) || /Macintosh/i.test(ua);
  const hit = IN_APP.find(([re]) => re.test(ua));
  const browser = /CriOS/i.test(ua) ? 'chrome' : /FxiOS/i.test(ua) ? 'firefox' : /EdgiOS/i.test(ua) ? 'edge' : 'safari';
  return { ios: true, inApp: hit ? hit[1] : null, browser, installed: Boolean(standalone), ipad };
}

// The live environment (browser only).
export function currentInstallEnv() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return installEnv();
  const standalone = window.navigator.standalone === true
    || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  return installEnv({ ua: navigator.userAgent || '', touchPoints: navigator.maxTouchPoints || 0, standalone });
}

// Show the iPhone guide? Only on iPhone/iPad and not already installed.
export const wantsIosGuide = (env) => Boolean(env && env.ios && !env.installed);

// The 3 taps for this browser, in English or Hindi.
export function iosSteps(env, lang = 'en') {
  const hi = lang === 'hi';
  const chromeLike = env && (env.browser === 'chrome' || env.browser === 'edge' || env.browser === 'firefox');
  const share = chromeLike
    ? (hi ? 'ऊपर पता-पट्टी में Share ⬆ पर टैप करें' : 'Tap Share ⬆ in the address bar (top)')
    : (hi ? 'नीचे Share ⬆ पर टैप करें (नए iPhone पर पहले ⋯ टैप करें)' : 'Tap Share ⬆ at the bottom (on newer iPhones, tap ⋯ first)');
  return [
    share,
    hi ? 'नीचे स्क्रॉल करें, “Add to Home Screen” टैप करें' : 'Scroll down, tap “Add to Home Screen”',
    hi ? 'ऊपर दाईं ओर “Add” टैप करें' : 'Tap “Add” (top right)',
  ];
}

// Link that asks iOS to open the page in Safari (works from some in-app
// browsers; others ignore it, so callers always offer "Copy link" too).
export function safariLink(url) {
  return /^https:\/\//i.test(String(url)) ? `x-safari-${url}` : null;
}

// "Maybe later" hides the iPhone alerts card for 7 days.
const KEY = 'pmz_ios_nudge_until';
const WEEK = 7 * 24 * 3600 * 1000;
export function iosNudgeSnoozed(storage, now = Date.now()) {
  try { return Number(storage.getItem(KEY) || 0) > now; } catch { return false; }
}
export function snoozeIosNudge(storage, now = Date.now()) {
  try { storage.setItem(KEY, String(now + WEEK)); } catch { /* private mode */ }
}

// Where the browser's Share button is: Safari on iPhone = bottom bar;
// iPad Safari and Chrome/Edge/Firefox on iPhone = top right.
export function shareButtonAt(env) {
  if (!env || !env.ios) return null;
  return env.ipad || env.browser !== 'safari' ? 'top' : 'bottom';
}

// "Follow the arrow" guide: one short step at a time. title/sub are shown,
// say is read aloud by the 🔊 button (same words, no symbols).
export function iosGuideSteps(env, lang = 'en') {
  const hi = lang === 'hi';
  const top = shareButtonAt(env) === 'top';
  return [
    {
      key: 'share',
      title: hi ? 'यह बटन टैप करें' : 'Tap this button',
      sub: top
        ? (hi ? 'यह स्क्रीन पर ऊपर दाईं ओर है।' : 'It’s at the top right of your screen.')
        : (hi ? 'यह स्क्रीन पर नीचे है। नए iPhone पर पहले ⋯ टैप करें, फिर Share।' : 'It’s at the bottom of your screen. On newer iPhones, tap ⋯ first, then Share.'),
      say: top
        ? (hi ? 'स्क्रीन पर ऊपर दाईं ओर, शेयर बटन टैप करें।' : 'Tap the Share button at the top right of your screen.')
        : (hi ? 'स्क्रीन पर नीचे, शेयर बटन टैप करें। नए आईफ़ोन पर पहले तीन बिंदु वाला बटन टैप करें।' : 'Tap the Share button at the bottom of your screen. On newer iPhones, tap the three dots first.'),
    },
    {
      key: 'add-home',
      title: hi ? 'मेन्यू खुलेगा। इसे टैप करें:' : 'A menu opens. Tap this:',
      sub: hi ? 'नहीं दिख रहा? नीचे स्क्रॉल करें। ＋ वाला चौकोर ढूंढें।' : 'Don’t see it? Scroll down. Look for the square with a ＋.',
      say: hi ? 'मेन्यू में ऐड टू होम स्क्रीन टैप करें। न दिखे तो नीचे स्क्रॉल करें।' : 'In the menu, tap Add to Home Screen. If you don’t see it, scroll down.',
    },
    {
      key: 'add',
      title: hi ? '“Add” टैप करें' : 'Tap “Add”',
      sub: hi ? 'यह ऊपर दाईं ओर है। फिर Home Screen पर ProMedicoz आइकन से खोलें।' : 'It’s at the top right. Then open ProMedicoz from the new icon on your Home Screen.',
      say: hi ? 'ऊपर दाईं ओर ऐड टैप करें। फिर होम स्क्रीन पर प्रोमेडिकोज़ आइकन से खोलें।' : 'Tap Add at the top right. Then open ProMedicoz from the new icon on your Home Screen.',
    },
  ];
}

// First open from the Home Screen icon → show the 🎉 "installed" welcome once.
const WELCOME_KEY = 'pmz_ios_welcome_seen';
export function shouldWelcomeInstall(env, storage) {
  if (!env || !env.ios || !env.installed) return false;
  try { return !storage.getItem(WELCOME_KEY); } catch { return false; }
}
export function markWelcomeSeen(storage) {
  try { storage.setItem(WELCOME_KEY, '1'); } catch { /* private mode */ }
}
