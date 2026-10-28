// ============================================
// "My phone didn't ring when locked" — what to change, by phone brand
// ============================================
// Phones silence or delay website alerts when the screen is locked, mostly
// through battery savers and Do Not Disturb. The fix is in different places
// on each brand, so we detect the brand from the browser and show its steps.
// Pure + tested (tests/alertFixSteps.test.mjs).

export function detectPhone(ua = '') {
  const s = String(ua);
  if (/iPhone|iPad|iPod/i.test(s)) return 'iphone';
  if (!/Android/i.test(s)) return 'other';
  if (/Xiaomi|Redmi|POCO|\bMi\s|MIUI|HyperOS|M2\d{3}|2\d{3}[A-Z0-9]{3,}/i.test(s)) return 'xiaomi';
  if (/SM-|Samsung|Galaxy/i.test(s)) return 'samsung';
  if (/OPPO|CPH\d|RMX\d|Realme|OnePlus|\bPB\w{3}\d|\bIN20\d\d/i.test(s)) return 'oppo';
  if (/vivo|\bV2\d{3}|iQOO/i.test(s)) return 'vivo';
  return 'android';
}

const COMMON_ANDROID_END = [
  'Do Not Disturb / Focus: allow Chrome (or ProMedicoz) to break through, or turn it off before the call.',
  'Chrome → ⋮ → Settings → Notifications → promedicoz.in → Allowed, sound on.',
];

const STEPS = {
  xiaomi: {
    label: 'Xiaomi / Redmi / POCO',
    en: [
      'Settings → Apps → Manage apps → Chrome → Battery saver → No restrictions.',
      'Same screen → Autostart → ON.',
      ...COMMON_ANDROID_END,
    ],
  },
  samsung: {
    label: 'Samsung',
    en: [
      'Settings → Battery → Background usage limits → Never sleeping apps → add Chrome.',
      'Settings → Apps → Chrome → Battery → Unrestricted.',
      ...COMMON_ANDROID_END,
    ],
  },
  oppo: {
    label: 'Oppo / Realme / OnePlus',
    en: [
      'Settings → Battery → (More settings / App battery management) → Chrome → Allow background activity, turn off "Optimise".',
      'Settings → Apps → Chrome → Auto launch / Allow auto-start → ON.',
      ...COMMON_ANDROID_END,
    ],
  },
  vivo: {
    label: 'Vivo / iQOO',
    en: [
      'Settings → Battery → Background power consumption management → Chrome → Allow.',
      'i Manager → App manager → Autostart manager → Chrome → ON.',
      ...COMMON_ANDROID_END,
    ],
  },
  android: {
    label: 'Android',
    en: [
      'Settings → Apps → Chrome → Battery → Unrestricted (or "Don\'t optimise").',
      ...COMMON_ANDROID_END,
    ],
  },
  iphone: {
    label: 'iPhone',
    en: [
      'Open ProMedicoz from the Home Screen icon (Safari → Share → Add to Home Screen) — iPhones only alert Home Screen apps.',
      'Settings → Notifications → ProMedicoz → Allow, Sounds ON, Lock Screen ON.',
      'Focus / Do Not Disturb → Apps → add ProMedicoz, or turn Focus off before the call.',
    ],
  },
  other: {
    label: 'this device',
    en: [
      'Use Chrome on an Android phone, or ProMedicoz from the Home Screen on an iPhone.',
      'Allow notifications for promedicoz.in and keep the sound on.',
    ],
  },
};

export function alertFixSteps(ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '')) {
  const brand = detectPhone(ua);
  const s = STEPS[brand];
  return { brand, label: s.label, steps: s.en };
}
