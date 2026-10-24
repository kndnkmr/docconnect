// ============================================
// Share cards for the pregnancy due-date calculator
// ============================================
// Writes 1200x630 Open Graph images into public/og/tools/:
//   due-date.png          the tool's own card ("Meri due date kab hai?")
//   due-<YYYY-MM>.png     one "Khushkhabri… March 2027" card per due month
//
// When a user shares her result, the link is /tools/due-date-calculator/2027-03;
// the prerender gives that page the matching due-2027-03.png card, so the family
// sees the month in the WhatsApp preview. Only the MONTH ever appears — never a
// date — for privacy.
//
// Same approach as gen-og-cards.mjs: vector SVG + text (no emoji — rsvg-convert
// can't draw colour emoji), rasterised locally with rsvg-convert, PNGs committed.
// Not part of the Vercel build.
//
// Covers 3 months back to 24 months ahead of when it runs. A month without a
// card simply falls back to the tool card, so nothing breaks — but re-run this
// about once a year to roll the window forward:
//   node scripts/gen-due-date-cards.mjs

import { writeFile, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'og', 'tools');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const FONT = 'Kohinoor Devanagari, Devanagari Sangam MN, Noto Sans Devanagari, Noto Sans, Arial, sans-serif';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Small decorative heart (24x24 path), placed with transform.
const heart = (x, y, s, o) =>
  `<path transform="translate(${x} ${y}) scale(${s})" fill="#ffffff" opacity="${o}" d="M12 21s-7-4.35-9.5-8.5C.8 9.4 2.5 5 6.5 5c2 0 3.5 1.2 5.5 3 2-1.8 3.5-3 5.5-3 4 0 5.7 4.4 4 7.5C19 16.65 12 21 12 21z"/>`;

function frame(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#db2777"/><stop offset="1" stop-color="#831843"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1060" cy="110" r="250" fill="#ffffff" opacity="0.07"/>
  <circle cx="1130" cy="570" r="170" fill="#ffffff" opacity="0.06"/>
  ${heart(930, 250, 5, 0.16)}${heart(1060, 170, 2.6, 0.18)}${heart(870, 160, 1.8, 0.2)}${heart(1050, 420, 2, 0.14)}
  <text x="90" y="130" font-family="${FONT}" font-size="30" font-weight="bold" fill="#fce7f3">ProMedicoz · स्वास्थ्य</text>
  ${inner}
  <text x="90" y="590" font-family="${FONT}" font-size="26" font-weight="bold" fill="#ffffff">promedicoz.in/tools/due-date-calculator</text>
</svg>`;
}

function monthCard(label) {
  return frame(`
  <text x="90" y="240" font-family="${FONT}" font-size="64" font-weight="bold" fill="#ffffff">Khushkhabri aane wali hai!</text>
  <text x="90" y="300" font-family="${FONT}" font-size="34" fill="#fce7f3">Nanhe mehmaan ka intezaar —</text>
  <text x="90" y="400" font-family="${FONT}" font-size="86" font-weight="bold" fill="#ffffff">${esc(label)}</text>
  <rect x="92" y="425" width="150" height="9" rx="4.5" fill="#ffffff" opacity="0.9"/>
  <text x="90" y="510" font-family="${FONT}" font-size="30" fill="#ffffff" opacity="0.92">Apni due date bhi nikaalein — free, Hindi mein</text>`);
}

function toolCard() {
  return frame(`
  <text x="90" y="260" font-family="${FONT}" font-size="76" font-weight="bold" fill="#ffffff">Meri due date</text>
  <text x="90" y="350" font-family="${FONT}" font-size="76" font-weight="bold" fill="#ffffff">kab hai?</text>
  <rect x="92" y="378" width="150" height="9" rx="4.5" fill="#ffffff" opacity="0.9"/>
  <text x="90" y="455" font-family="${FONT}" font-size="34" fill="#fce7f3">Pregnancy due date calculator</text>
  <text x="90" y="505" font-family="${FONT}" font-size="30" fill="#ffffff" opacity="0.92">Free · Hindi + English · Kuch bhi save nahi hota</text>`);
}

async function render(name, svg) {
  const svgPath = join(OUT_DIR, `${name}.svg`);
  await writeFile(svgPath, svg, 'utf8');
  await execFileP('rsvg-convert', ['-w', '1200', '-h', '630', svgPath, '-o', join(OUT_DIR, `${name}.png`)]);
  await rm(svgPath);
}

async function main() {
  try { await execFileP('rsvg-convert', ['--version']); }
  catch { console.error('[due-cards] rsvg-convert not found (brew install librsvg).'); process.exit(1); }
  await mkdir(OUT_DIR, { recursive: true });

  await render('due-date', toolCard());
  const now = new Date();
  let n = 0;
  for (let i = -3; i <= 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    await render(`due-${key}`, monthCard(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`));
    n++;
  }
  console.log(`[due-cards] Wrote the tool card + ${n} month cards to public/og/tools/`);
}

main().catch((e) => { console.error('[due-cards] Failed:', e); process.exit(1); });
