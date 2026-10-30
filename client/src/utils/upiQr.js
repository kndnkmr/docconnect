// ============================================
// UPI QR codes: read the UPI ID from a doctor's QR image
// ============================================
// Every UPI QR (GPay, PhonePe, Paytm, BHIM, bank apps) is just a text link:
//   upi://pay?pa=<UPI ID>&pn=<account holder name>&...
// Many doctors upload only the QR and leave "UPI ID" empty. Without the ID,
// a patient who is paying FROM the same phone that shows the QR (most of
// them) has no way to pay: you can't scan your own screen, and the one-tap
// "Pay with UPI app" button needs the ID. So we read it from the image.
//
// Pure helpers (parseUpiUri, isValidUpiId, sameUpi) are tested in
// tests/upiQr.test.mjs. readUpiFromImage() runs in the browser only.

// Same rule the UPI apps accept: handle@provider.
const UPI_ID_RE = /^[\w.-]{2,256}@[a-zA-Z][\w.-]{1,64}$/;
export const isValidUpiId = (id) => UPI_ID_RE.test(String(id || '').trim());

// UPI IDs are case-insensitive.
export const sameUpi = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// Text inside a QR → { upiId, name } for a UPI payment QR, or null.
export function parseUpiUri(text) {
  const s = String(text || '').trim();
  if (!/^upi:\/\/pay\?/i.test(s)) return null;
  const params = {};
  for (const part of s.slice(s.indexOf('?') + 1).split('&')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const key = part.slice(0, i).toLowerCase();
    let val = part.slice(i + 1).replace(/\+/g, ' ');
    try { val = decodeURIComponent(val); } catch { /* keep raw */ }
    if (!(key in params)) params[key] = val;
  }
  const upiId = String(params.pa || '').trim();
  if (!isValidUpiId(upiId)) return null;
  const name = String(params.pn || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return { upiId, name };
}

// What the QR in an image is: { kind: 'upi', upiId, name } | { kind: 'other' }
// (a QR, but a website / something else) | { kind: 'none' } (no QR found) |
// { kind: 'error' } (image couldn't be opened).
export function classifyQrText(text) {
  if (text == null) return { kind: 'none' };
  const upi = parseUpiUri(text);
  return upi ? { kind: 'upi', ...upi } : { kind: 'other' };
}

// ---------------- browser only ----------------
const cache = new Map(); // src → Promise<result>

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Cloudinary sends Access-Control-Allow-Origin: *, so we can read pixels.
    if (!/^(data|blob):/.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

async function decodeImage(img) {
  // 1) The phone's own QR reader (Android Chrome, Safari 17+): instant, no download.
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats?.();
      if (!formats || formats.includes('qr_code')) {
        const found = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(img);
        const upi = found.map((f) => f.rawValue).find((v) => parseUpiUri(v));
        if (upi) return upi;
        if (found[0]) return found[0].rawValue;
      }
    } catch { /* fall back to jsQR */ }
  }
  // 2) jsQR (open source, ~50 KB), downloaded only when needed. A few sizes:
  //    big screenshots read best shrunk, small ones at full size.
  const { default: jsQR } = await import('jsqr');
  const w0 = img.naturalWidth || img.width; const h0 = img.naturalHeight || img.height;
  for (const max of [800, 1200, 500]) {
    const s = Math.min(1, max / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * s)); const h = Math.max(1, Math.round(h0 * s));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });
    if (r && r.data) return r.data;
    if (s === 1) break; // already full size
  }
  return null;
}

// Read a QR from an image URL (Cloudinary / data:) or a File the doctor just
// picked. Never throws. Results for URLs are remembered for this page visit.
export function readUpiFromImage(srcOrFile) {
  if (!srcOrFile) return Promise.resolve({ kind: 'none' });
  const isFile = typeof File !== 'undefined' && srcOrFile instanceof Blob;
  if (!isFile && cache.has(srcOrFile)) return cache.get(srcOrFile);
  const run = (async () => {
    const src = isFile ? URL.createObjectURL(srcOrFile) : srcOrFile;
    try {
      const img = await loadImage(src);
      return classifyQrText(await decodeImage(img));
    } catch {
      return { kind: 'error' };
    } finally {
      if (isFile) URL.revokeObjectURL(src);
    }
  })();
  if (!isFile) cache.set(srcOrFile, run);
  return run;
}
