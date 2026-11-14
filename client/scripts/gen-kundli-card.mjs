// ============================================
// Share card for Sehat Kundli (1200x630) → public/og/tools/sehat-kundli.png
// ============================================
// Same approach as gen-vaccine-card.mjs: vector SVG + text (no emoji —
// rsvg-convert can't draw colour emoji), rasterised locally, PNG committed.
// Not part of the Vercel build. Re-run only if the design changes:
//   node scripts/gen-kundli-card.mjs
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'og', 'tools');
const FONT = 'Kohinoor Devanagari, Devanagari Sangam MN, Noto Sans Devanagari, Noto Sans, Arial, sans-serif';
// Kundli diamond with a few "houses" lit up.
const kundli = (cx, cy, s) => `
  <rect x="${cx - s}" y="${cy - s}" width="${s * 2}" height="${s * 2}" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="7"/>
  <path d="M${cx} ${cy - s} L${cx + s} ${cy} L${cx} ${cy + s} L${cx - s} ${cy} Z M${cx - s} ${cy - s} L${cx + s} ${cy + s} M${cx + s} ${cy - s} L${cx - s} ${cy + s}" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="7"/>
  <circle cx="${cx}" cy="${cy - s / 2}" r="16" fill="#fde68a"/>
  <circle cx="${cx + s / 2}" cy="${cy}" r="16" fill="#ffffff" opacity="0.9"/>
  <circle cx="${cx}" cy="${cy + s / 2}" r="16" fill="#fde68a"/>
  <circle cx="${cx - s / 2}" cy="${cy}" r="16" fill="#ffffff" opacity="0.9"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f97316"/><stop offset="0.55" stop-color="#e11d48"/><stop offset="1" stop-color="#7f1d1d"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1080" cy="90" r="240" fill="#ffffff" opacity="0.07"/>
  ${kundli(950, 300, 165)}
  <text x="80" y="120" font-family="${FONT}" font-size="30" font-weight="bold" fill="#ffedd5">ProMedicoz · Free</text>
  <text x="80" y="245" font-family="${FONT}" font-size="96" font-weight="bold" fill="#ffffff">Sehat Kundli</text>
  <rect x="82" y="275" width="170" height="10" rx="5" fill="#fde68a"/>
  <text x="80" y="360" font-family="${FONT}" font-size="38" fill="#ffffff">Parivaar ki health history se</text>
  <text x="80" y="410" font-family="${FONT}" font-size="38" fill="#ffffff">aapka apna check-up plan</text>
  <text x="80" y="480" font-family="${FONT}" font-size="28" fill="#ffe4e6">Sugar · BP · Heart · Thyroid · Cancer · Thalassemia</text>
  <text x="80" y="540" font-family="${FONT}" font-size="26" fill="#ffedd5">Medical salaah, jyotish nahi · Kuch save nahi hota</text>
  <text x="80" y="595" font-family="${FONT}" font-size="26" font-weight="bold" fill="#ffffff">promedicoz.in/tools/sehat-kundli</text>
</svg>`;
async function main() {
  try { await execFileP('rsvg-convert', ['--version']); }
  catch { console.error('[kundli-card] rsvg-convert not found (brew install librsvg).'); process.exit(1); }
  await mkdir(OUT_DIR, { recursive: true });
  const svgPath = join(OUT_DIR, 'sehat-kundli.svg');
  await writeFile(svgPath, svg, 'utf8');
  await execFileP('rsvg-convert', ['-w', '1200', '-h', '630', svgPath, '-o', join(OUT_DIR, 'sehat-kundli.png')]);
  await rm(svgPath);
  console.log('[kundli-card] Wrote public/og/tools/sehat-kundli.png');
}
main().catch((e) => { console.error('[kundli-card] Failed:', e); process.exit(1); });
