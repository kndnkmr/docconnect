// ============================================
// Share card for the ovulation & period calculator
// ============================================
// Writes public/og/tools/ovulation.png (1200x630) — the WhatsApp / social
// preview for /tools/ovulation-calculator. Same approach as
// gen-due-date-cards.mjs: vector SVG + text (no emoji — rsvg-convert can't
// draw colour emoji), rasterised locally with rsvg-convert, PNG committed.
// Not part of the Vercel build. Re-run only if the design changes:
//   node scripts/gen-ovulation-card.mjs

import { writeFile, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'og', 'tools');
const FONT = 'Kohinoor Devanagari, Devanagari Sangam MN, Noto Sans Devanagari, Noto Sans, Arial, sans-serif';

// Simple 5-petal flower, placed with transform.
const flower = (x, y, s, o) => {
  const petals = [0, 72, 144, 216, 288]
    .map((a) => `<ellipse cx="0" cy="-14" rx="8" ry="14" transform="rotate(${a})"/>`).join('');
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="#ffffff" opacity="${o}">${petals}<circle r="6" fill="#ede9fe"/></g>`;
};

// Mini calendar strip: a row of day dots with the fertile run highlighted.
const strip = () => {
  let out = '';
  for (let i = 0; i < 14; i++) {
    const x = 845 + (i % 7) * 44;
    const y = 300 + Math.floor(i / 7) * 44;
    const fertile = i >= 6 && i <= 11;
    const ov = i === 11;
    out += `<rect x="${x}" y="${y}" width="34" height="34" rx="8" fill="#ffffff" opacity="${ov ? 0.95 : fertile ? 0.45 : 0.14}"/>`;
  }
  return out;
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#4c1d95"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1060" cy="110" r="250" fill="#ffffff" opacity="0.07"/>
  <circle cx="1130" cy="570" r="170" fill="#ffffff" opacity="0.06"/>
  ${flower(1080, 170, 2.2, 0.22)}${flower(900, 200, 1.3, 0.2)}${flower(1110, 470, 1.6, 0.16)}
  ${strip()}
  <text x="90" y="130" font-family="${FONT}" font-size="30" font-weight="bold" fill="#ede9fe">ProMedicoz · स्वास्थ्य</text>
  <text x="90" y="260" font-family="${FONT}" font-size="76" font-weight="bold" fill="#ffffff">Ovulation</text>
  <text x="90" y="350" font-family="${FONT}" font-size="76" font-weight="bold" fill="#ffffff">kab hai?</text>
  <rect x="92" y="378" width="150" height="9" rx="4.5" fill="#ffffff" opacity="0.9"/>
  <text x="90" y="455" font-family="${FONT}" font-size="34" fill="#ede9fe">Fertile days + agla period calculator</text>
  <text x="90" y="505" font-family="${FONT}" font-size="30" fill="#ffffff" opacity="0.92">Free · Hindi + English · Kuch bhi save nahi hota</text>
  <text x="90" y="590" font-family="${FONT}" font-size="26" font-weight="bold" fill="#ffffff">promedicoz.in/tools/ovulation-calculator</text>
</svg>`;

async function main() {
  try { await execFileP('rsvg-convert', ['--version']); }
  catch { console.error('[ovulation-card] rsvg-convert not found (brew install librsvg).'); process.exit(1); }
  await mkdir(OUT_DIR, { recursive: true });
  const svgPath = join(OUT_DIR, 'ovulation.svg');
  await writeFile(svgPath, svg, 'utf8');
  await execFileP('rsvg-convert', ['-w', '1200', '-h', '630', svgPath, '-o', join(OUT_DIR, 'ovulation.png')]);
  await rm(svgPath);
  console.log('[ovulation-card] Wrote public/og/tools/ovulation.png');
}

main().catch((e) => { console.error('[ovulation-card] Failed:', e); process.exit(1); });
