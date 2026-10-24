// ============================================
// Share cards for the vaccination schedule and the /tools hub
// ============================================
// Writes into public/og/tools/ (1200x630):
//   vaccination.png   preview for /tools/vaccination-schedule
//   tools.png         preview for /tools
// Same approach as gen-due-date-cards.mjs: vector SVG + text (no emoji —
// rsvg-convert can't draw colour emoji), rasterised locally, PNGs committed.
// Not part of the Vercel build. Re-run only if the design changes:
//   node scripts/gen-vaccine-card.mjs

import { writeFile, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'og', 'tools');
const FONT = 'Kohinoor Devanagari, Devanagari Sangam MN, Noto Sans Devanagari, Noto Sans, Arial, sans-serif';

const frame = (from, to, accent, url, inner, art) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1060" cy="110" r="250" fill="#ffffff" opacity="0.07"/>
  <circle cx="1130" cy="570" r="170" fill="#ffffff" opacity="0.06"/>
  ${art}
  <text x="90" y="130" font-family="${FONT}" font-size="30" font-weight="bold" fill="${accent}">ProMedicoz · स्वास्थ्य</text>
  ${inner}
  <text x="90" y="590" font-family="${FONT}" font-size="26" font-weight="bold" fill="#ffffff">${url}</text>
</svg>`;

// Vertical timeline of dots (birth → 16 yrs), first ones "done".
const timeline = () => {
  let out = '<line x1="930" y1="170" x2="930" y2="470" stroke="#ffffff" stroke-opacity="0.35" stroke-width="6" stroke-linecap="round"/>';
  [170, 230, 290, 350, 410, 470].forEach((y, i) => {
    const op = i < 2 ? 0.95 : i === 2 ? 0.95 : 0.35;
    out += `<circle cx="930" cy="${y}" r="${i === 2 ? 20 : 14}" fill="#ffffff" opacity="${op}"/>`;
    out += `<rect x="970" y="${y - 10}" width="${[150, 190, 170, 130, 160, 110][i]}" height="20" rx="10" fill="#ffffff" opacity="${i <= 2 ? 0.55 : 0.2}"/>`;
  });
  return out;
};

const vaccination = frame('#0d9488', '#155e75', '#ccfbf1', 'promedicoz.in/tools/vaccination-schedule', `
  <text x="90" y="260" font-family="${FONT}" font-size="72" font-weight="bold" fill="#ffffff">Baby ko teeka</text>
  <text x="90" y="345" font-family="${FONT}" font-size="72" font-weight="bold" fill="#ffffff">kab lagega?</text>
  <rect x="92" y="373" width="150" height="9" rx="4.5" fill="#ffffff" opacity="0.9"/>
  <text x="90" y="450" font-family="${FONT}" font-size="34" fill="#ccfbf1">Vaccination schedule · sarkari (UIP)</text>
  <text x="90" y="500" font-family="${FONT}" font-size="30" fill="#ffffff" opacity="0.92">Free · Hindi + English · Kuch bhi save nahi hota</text>`, timeline());

// Three tool tiles for the hub.
const tiles = () => [['#f9a8d4', 170], ['#c4b5fd', 290], ['#5eead4', 410]]
  .map(([c, y]) => `<rect x="860" y="${y - 45}" width="250" height="90" rx="22" fill="${c}" opacity="0.9"/><rect x="890" y="${y - 12}" width="140" height="24" rx="12" fill="#ffffff" opacity="0.8"/>`).join('');

const tools = frame('#2563eb', '#1e3a8a', '#dbeafe', 'promedicoz.in/tools', `
  <text x="90" y="260" font-family="${FONT}" font-size="76" font-weight="bold" fill="#ffffff">Free health</text>
  <text x="90" y="350" font-family="${FONT}" font-size="76" font-weight="bold" fill="#ffffff">tools</text>
  <rect x="92" y="378" width="150" height="9" rx="4.5" fill="#ffffff" opacity="0.9"/>
  <text x="90" y="455" font-family="${FONT}" font-size="32" fill="#dbeafe">Due date · Ovulation · Baby vaccines</text>
  <text x="90" y="505" font-family="${FONT}" font-size="30" fill="#ffffff" opacity="0.92">Free · Hindi + English · Kuch bhi save nahi hota</text>`, tiles());

async function render(name, svg) {
  const svgPath = join(OUT_DIR, `${name}.svg`);
  await writeFile(svgPath, svg, 'utf8');
  await execFileP('rsvg-convert', ['-w', '1200', '-h', '630', svgPath, '-o', join(OUT_DIR, `${name}.png`)]);
  await rm(svgPath);
}

async function main() {
  try { await execFileP('rsvg-convert', ['--version']); }
  catch { console.error('[vaccine-card] rsvg-convert not found (brew install librsvg).'); process.exit(1); }
  await mkdir(OUT_DIR, { recursive: true });
  await render('vaccination', vaccination);
  await render('tools', tools);
  console.log('[vaccine-card] Wrote public/og/tools/vaccination.png and tools.png');
}

main().catch((e) => { console.error('[vaccine-card] Failed:', e); process.exit(1); });
