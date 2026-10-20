// ============================================
// Vercel serverless function: per-doctor social share preview for /dr/:slug
// ============================================
// WHY: /dr/:slug is a client-rendered SPA route with no prerendered HTML, so a
// social crawler (WhatsApp, Facebook, LinkedIn, X) reading the raw HTML only
// ever saw the generic homepage OG tags — every doctor shared the same banner.
//
// WHAT THIS DOES: for a request to /dr/:slug, we fetch the doctor from the live
// API and return a small HTML document whose <head> carries THAT doctor's OG
// tags — including a share card image composed on the fly from the doctor's own
// Cloudinary photo (name + specialty + fee overlaid). Human browsers are sent
// on to the real SPA via a redirect; crawlers don't follow it, they just read
// the tags. The card is always current because it's built from live data.
//
// FAILSAFE: on any error / 404 / missing data we fall back to redirecting to
// the SPA (and let it render normally) — a preview problem must never break the
// actual page.

const API_BASE = 'https://docconnect-fcg6.onrender.com/api';
const SITE = 'https://www.promedicoz.in';
const CLOUD_NAME = 'g6uc48vt'; // Cloudinary cloud that stores doctor photos
const DEFAULT_IMAGE = `${SITE}/og-image.png`;

// Escape text for safe insertion into an HTML attribute / text node.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Cloudinary overlay text must be URL-encoded, and a few characters are special
// inside a transformation segment (',', '/', '%'). Double-encode so they land
// as literal text in the rendered card.
function clText(s) {
  return encodeURIComponent(String(s || '').trim())
    .replace(/%/g, '%25')   // must be first
    .replace(/,/g, '%2C')
    .replace(/\//g, '%2F');
}

// From a stored Cloudinary image URL, pull the "public id" (the path after
// /upload/[transforms]/ and before the extension), e.g.
// https://res.cloudinary.com/g6uc48vt/image/upload/v123/promedicoz/profile/abc.jpg
//   -> promedicoz/profile/abc
function cloudinaryPublicId(photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string') return null;
  if (!photoUrl.includes('res.cloudinary.com') || !photoUrl.includes('/upload/')) return null;
  let tail = photoUrl.split('/upload/')[1] || '';
  // Drop any leading transformation segments and a version prefix (v123456/).
  const parts = tail.split('/');
  while (parts.length && /^v\d+$/.test(parts[0]) === false && parts[0].includes(',')) parts.shift();
  if (parts.length && /^v\d+$/.test(parts[0])) parts.shift();
  tail = parts.join('/');
  return tail.replace(/\.[a-zA-Z0-9]+$/, '') || null; // strip extension
}

// Build the 1200x630 share card as a single Cloudinary URL: the doctor's photo
// padded onto a branded blue canvas, their photo again as a white-ringed circle
// on the left, and name / specialty / fee / brand as text overlays on the
// right. Falls back to the default banner when there's no usable photo.
function buildCardUrl(doctor) {
  const pid = cloudinaryPublicId(doctor.profilePhoto);
  if (!pid) return DEFAULT_IMAGE;

  const name = `Dr. ${doctor.name || ''}`.trim();
  const spec = doctor.specialization || 'Doctor';
  const feeLine = Number(doctor.consultationFee) > 0
    ? `Rs. ${doctor.consultationFee} consultation`
    : 'Book an appointment online';

  // Cloudinary nests overlays' own public id with ':' instead of '/'.
  const pidLayer = pid.replace(/\//g, ':');

  const t = [
    // Base: the doctor's photo filled to the 1200x630 canvas and darkened, so
    // the overlaid white text is always legible over any photo. (A blue base
    // colour shows through only if the photo can't cover the frame.)
    'w_1200,h_630,c_fill,g_auto,b_rgb:1d4ed8,e_brightness:-30,q_auto,f_jpg',
    // Left: circular portrait with a white ring, face-centred.
    `l_${pidLayer},w_300,h_300,c_fill,g_face,r_max,bo_8px_solid_white/fl_layer_apply,g_west,x_90`,
    // Name.
    `l_text:Arial_62_bold:${clText(name)},co_white/fl_layer_apply,g_north_west,x_470,y_210`,
    // Specialty.
    `l_text:Arial_36:${clText(spec)},co_rgb:dbeafe/fl_layer_apply,g_north_west,x_470,y_300`,
    // Fee / CTA line.
    `l_text:Arial_34_bold:${clText(feeLine)},co_white/fl_layer_apply,g_north_west,x_470,y_365`,
    // Brand footer.
    `l_text:Arial_28_bold:${clText('ProMedicoz · Book online · No commission')},co_rgb:bfdbfe/fl_layer_apply,g_south_west,x_90,y_55`,
  ].join('/');

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${t}/${pid}.jpg`;
}

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Load the built SPA shell (dist/index.html) once per cold start. We inject
// per-doctor meta into THIS real document and serve it to everyone — so humans
// get the normal React app (same script/CSS, hydrates as usual) AND crawlers
// get the correct tags. No redirect anywhere, so no loop with the /dr/:slug ->
// /api/dr/:slug rewrite. Vercel bundles the function's CWD at the project root,
// where the build output lives under dist/.
let _shellCache = null;
async function loadShell() {
  if (_shellCache) return _shellCache;
  const candidates = [
    join(process.cwd(), 'dist', 'index.html'),
    join(process.cwd(), 'index.html'),
    join(process.cwd(), 'public', 'index.html'),
  ];
  for (const p of candidates) {
    try {
      _shellCache = await readFile(p, 'utf8');
      return _shellCache;
    } catch { /* try next */ }
  }
  return null;
}

// Swap the default <head> meta in the real index.html for this doctor's values.
// Mirrors the anchor strings the prerender script relies on, so it stays in
// lockstep with index.html.
function injectMeta(shell, { title, description, image, url }) {
  const eTitle = esc(title);
  const eDesc = esc(description);
  const eImg = esc(image);
  const eUrl = esc(url);
  let html = shell;
  const swap = (find, replace) => { if (html.includes(find)) html = html.replace(find, replace); };

  swap('<title>ProMedicoz - Find & Book Doctors Online | India</title>', `<title>${eTitle}</title>`);
  swap(
    '<meta name="description" content="ProMedicoz - India\'s doctor consultation platform. Find qualified doctors, book appointments online, video consultations, and manage your health." />',
    `<meta name="description" content="${eDesc}" />`
  );
  swap('<meta property="og:title" content="ProMedicoz - Consult Verified Doctors Online" />', `<meta property="og:title" content="${eTitle}" />`);
  swap(
    '<meta property="og:description" content="Find and book verified doctors across India — video, phone, or in-person. Book in under 2 minutes. Your health, our priority." />',
    `<meta property="og:description" content="${eDesc}" />`
  );
  swap('<meta property="og:url" content="https://www.promedicoz.in/" />', `<meta property="og:url" content="${eUrl}" />`);
  swap('<meta property="og:type" content="website" />', '<meta property="og:type" content="profile" />');
  swap('<meta property="og:image" content="https://www.promedicoz.in/og-image.png" />', `<meta property="og:image" content="${eImg}" />`);
  swap('<meta name="twitter:title" content="ProMedicoz - Consult Verified Doctors Online" />', `<meta name="twitter:title" content="${eTitle}" />`);
  swap(
    '<meta name="twitter:description" content="Find and book verified doctors across India — video, phone, or in-person. Book in under 2 minutes." />',
    `<meta name="twitter:description" content="${eDesc}" />`
  );
  swap('<meta name="twitter:image" content="https://www.promedicoz.in/og-image.png" />', `<meta name="twitter:image" content="${eImg}" />`);
  if (!html.includes('rel="canonical"')) {
    html = html.replace('</head>', `    <link rel="canonical" href="${eUrl}" />\n  </head>`);
  }
  return html;
}

export default async function handler(req, res) {
  const slug = String(req.query.slug || '').trim().toLowerCase();
  const canonical = `${SITE}/dr/${encodeURIComponent(slug)}`;

  const shell = await loadShell();

  // If we can't read the shell, redirect to the app root rewrite as a last
  // resort (never loops: destination is index.html-served content, not /dr/).
  const serveShellPlain = async () => {
    if (shell) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(shell);
    } else {
      res.statusCode = 302;
      res.setHeader('Location', '/');
      res.end();
    }
  };

  if (!slug) return serveShellPlain();

  try {
    const r = await fetch(`${API_BASE}/doctors/by-slug/${encodeURIComponent(slug)}`, {
      headers: { accept: 'application/json' },
    });
    if (!r.ok) return serveShellPlain();
    const data = await r.json();
    const doctor = data && data.doctor;
    if (!doctor || !doctor.name) return serveShellPlain();

    const name = `Dr. ${doctor.name}`.trim();
    const spec = doctor.specialization || 'Doctor';
    const city = doctor.city ? ` in ${doctor.city}` : '';
    const title = `${name} — ${spec}`;
    const description =
      `Book an appointment with ${name}, ${spec}${city}, on ProMedicoz. ` +
      (Number(doctor.consultationFee) > 0 ? `Consultation fee Rs. ${doctor.consultationFee}. ` : '') +
      `Consult by video, phone, or in person.`;
    const image = buildCardUrl(doctor);

    const html = shell
      ? injectMeta(shell, { title, description, image, url: canonical })
      : null;

    if (!html) return serveShellPlain();

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Cache the rendered shell at the edge so repeat crawls/visits are fast,
    // but refresh often enough that a doctor's profile edit shows within minutes.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400');
    res.end(html);
  } catch {
    return serveShellPlain();
  }
}
