// ============================================
// Call alarm helpers (pure parts tested in tests/callAlarm.test.mjs)
// ============================================
// Ringer: a phone-style ring generated with Web Audio (no audio file):
// Indian "double ring" cadence (two 0.4 s bursts of 400+450 Hz, then a 2 s
// pause), repeating vibration, and a flashing tab title. Browsers only allow
// sound after the person has tapped the page once, so unlockAudio() is
// attached to the first tap/keypress on the Dashboard.

let ctx = null;
const getCtx = () => {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (C) ctx = new C();
  }
  return ctx;
};

// Call from a user gesture (first tap) so the ring can play later.
export function unlockAudio() {
  try {
    const c = getCtx();
    if (c && c.state === 'suspended') c.resume();
    // A silent blip fully unlocks on iOS Safari.
    if (c) {
      const o = c.createOscillator();
      const g = c.createGain();
      g.gain.value = 0;
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.01);
    }
  } catch { /* no audio on this device */ }
}

export const RING_CYCLE_MS = 3000;
export const VIBRATE_PATTERN = [400, 200, 400, 2000];

function burst(c, at, dur) {
  for (const f of [400, 450]) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.18, at + 0.03);
    g.gain.setValueAtTime(0.18, at + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(c.destination);
    o.start(at); o.stop(at + dur + 0.02);
  }
}

let ringTimer = null;
let titleTimer = null;
let savedTitle = '';

// Start ringing (no-op if already ringing). `label` is the flashing title.
export function startRinging(label = '📞 Calling…') {
  if (ringTimer) return;
  const cycle = () => {
    try {
      const c = getCtx();
      if (c) {
        if (c.state === 'suspended') c.resume();
        const t = c.currentTime + 0.02;
        burst(c, t, 0.4);
        burst(c, t + 0.6, 0.4);
      }
    } catch { /* visual banner still shows */ }
    try { if (navigator.vibrate) navigator.vibrate(VIBRATE_PATTERN); } catch { /* not supported */ }
  };
  cycle();
  ringTimer = setInterval(cycle, RING_CYCLE_MS);
  if (typeof document !== 'undefined') {
    savedTitle = document.title;
    let on = false;
    titleTimer = setInterval(() => {
      on = !on;
      document.title = on ? label : savedTitle;
    }, 1000);
  }
}

export function stopRinging() {
  if (ringTimer) { clearInterval(ringTimer); ringTimer = null; }
  if (titleTimer) { clearInterval(titleTimer); titleTimer = null; if (savedTitle) document.title = savedTitle; }
  try { if (navigator.vibrate) navigator.vibrate(0); } catch { /* ignore */ }
}

// ---- Pure helpers ----

// IST slot start/end (ms) for an appointment (date = UTC midnight of the
// IST day, timeSlot = "10:30 AM - 11:00 AM"), or null.
export function slotTimes(date, timeSlot) {
  const d = new Date(date);
  const parts = String(timeSlot || '').split(' - ');
  if (isNaN(d.getTime()) || parts.length !== 2) return null;
  const toMin = (s) => {
    const m = String(s).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10) % 12;
    if (m[3].toUpperCase() === 'PM') h += 12;
    return h * 60 + parseInt(m[2], 10);
  };
  const a = toMin(parts[0]);
  let b = toMin(parts[1]);
  if (a == null || b == null) return null;
  if (b <= a) b += 24 * 60;
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return { start: day + (a - 330) * 60000, end: day + (b - 330) * 60000 };
}

// Show the "Call alerts" box on this card? Video/phone, not cancelled or
// done, and the slot is within the next 48 h (or happening now).
export function wantsCallAlerts(apt, now = Date.now()) {
  if (!apt || !['video', 'phone'].includes(apt.consultationType)) return false;
  if (!['pending', 'confirmed'].includes(apt.status)) return false;
  const t = slotTimes(apt.date, apt.timeSlot);
  return !!t && t.end > now && t.start - now <= 48 * 3600 * 1000;
}

// What the "Call alerts" box should say on this device.
//   'on' | 'off' (can ask) | 'blocked' (denied in browser settings)
//   | 'ios-install' (iPhone/iPad not added to Home Screen) | 'unsupported'
export function callAlertState({ supported, permission, isIOS, standalone }) {
  if (isIOS && !standalone) return 'ios-install';
  if (!supported) return 'unsupported';
  if (permission === 'granted') return 'on';
  if (permission === 'denied') return 'blocked';
  return 'off';
}

export const isIOSDevice = (ua = typeof navigator !== 'undefined' ? navigator.userAgent : '', maxTouch = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0) =>
  /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouch > 1);

export const isStandalone = () =>
  typeof window !== 'undefined' && ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true);

// Is the OTHER person's phone likely not to ring? Uses the server's records:
// callAlerts.<role> = { sentAt, devices, seenAt (phone receipt), ready }.
//   'not-ready'    → before the call: the 30-min check found alerts off / not
//                    tested on a locked screen (keep their number handy)
//   'not-received' → the ring was sent ≥45 s ago but their phone never
//                    confirmed it (locked + battery saver / Do Not Disturb)
//   'no-alerts'    → the ring went out to 0 devices (alerts off)
//   null           → fine, or nothing to say
// myRole = 'doctor' | 'patient' (the viewer); the other side is checked.
const RECEIPT_GRACE_MS = 45 * 1000;
export function otherAlertProblem(apt, myRole, now = Date.now()) {
  if (!apt || apt.status !== 'confirmed' || apt.paymentStatus !== 'paid') return null;
  if (!['video', 'phone'].includes(apt.consultationType)) return null;
  const t = slotTimes(apt.date, apt.timeSlot);
  if (!t || now > t.end) return null;
  if (apt.callStartedAt && new Date(apt.callStartedAt).getTime() >= t.start - 15 * 60000) return null;
  const other = (apt.callAlerts || {})[myRole === 'doctor' ? 'patient' : 'doctor'] || {};
  if (other.sentAt) {
    if (other.seenAt) return null;
    if (other.devices === 0) return 'no-alerts';
    return now - new Date(other.sentAt).getTime() >= RECEIPT_GRACE_MS ? 'not-received' : null;
  }
  if (now < t.start && (other.ready === 'not-tested' || other.ready === 'no-alerts')) return 'not-ready';
  return null;
}

// Show "Not joined yet? Call / WhatsApp them" — from 2 min after the start
// until the slot ends, for a confirmed + paid video/phone appointment.
export function showNoShowHelp(apt, now = Date.now()) {
  if (!apt || apt.status !== 'confirmed' || apt.paymentStatus !== 'paid') return false;
  if (!['video', 'phone'].includes(apt.consultationType)) return false;
  const t = slotTimes(apt.date, apt.timeSlot);
  return !!t && now >= t.start + 2 * 60000 && now <= t.end;
}
