// ============================================
// Share card for Report Samjhao (/tools/blood-report)
// ============================================
// Writes public/og/tools/report.png (1200x630). Same approach as the other
// card scripts: vector SVG + text (no emoji), rasterised locally with
// rsvg-convert, PNG committed. Not part of the Vercel build.
//   node scripts/gen-report-card.mjs

import { writeFile, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const execFileP = promisify(execFile);
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og', 'tools');
const FONT = 'Kohinoor Devanagari, Devanagari Sangam MN, Noto Sans Devanagari, Noto Sans, Arial, sans-serif';

// A stylised report sheet with three result rows (two "ok", one flagged).
const sheet = () => {
  const row = (y, w, flag) => `<rect x="905" y="${y}" width="${w}" height="16" rx="8" fill="#c7d2fe"/>`
    + `<rect x="1060" y="${y - 6}" width="66" height="28" rx="14" fill="${flag ? '#fb923c' : '#4ade80'}"/>`;
  return `<g transform="rotate(4 1000 330)">
    <rect x="870" y="150" width="290" height="360" rx="22" fill="#ffffff" opacity="0.96"/>
    <rect x="905" y="190" width="150" height="20" rx="10" fill="#6366f1"/>
    ${row(250, 120, false)}${row(305, 135, true)}${row(360, 110, false)}${row(415, 128, false)}
    <rect x="905" y="460" width="220" height="10" rx="5" fill="#e0e7ff"/>
  </g>`;
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#312e81"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1060" cy="110" r="250" fill="#ffffff" opacity="0.07"/>
  <circle cx="1130" cy="570" r="170" fill="#ffffff" opacity="0.06"/>
  ${sheet()}
  <text x="90" y="130" font-family="${FONT}" font-size="30" font-weight="bold" fill="#e0e7ff">ProMedicoz · स्वास्थ्य</text>
  <text x="90" y="260" font-family="${FONT}" font-size="80" font-weight="bold" fill="#ffffff">Report</text>
  <text x="90" y="350" font-family="${FONT}" font-size="80" font-weight="bold" fill="#ffffff">Samjhao</text>
  <rect x="92" y="378" width="150" height="9" rx="4.5" fill="#ffffff" opacity="0.9"/>
  <text x="90" y="455" font-family="${FONT}" font-size="32" fill="#e0e7ff">Blood report aasaan Hindi mein</text>
  <text x="90" y="505" font-family="${FONT}" font-size="28" fill="#ffffff" opacity="0.92">CBC · Thyroid · Sugar · Vit D · B12 — kuch upload nahi hota</text>
  <text x="90" y="590" font-family="${FONT}" font-size="26" font-weight="bold" fill="#ffffff">promedicoz.in/tools/blood-report</text>
</svg>`;

async function main() {
  try { await execFileP('rsvg-convert', ['--version']); }
  catch { console.error('[report-card] rsvg-convert not found (brew install librsvg).'); process.exit(1); }
  await mkdir(OUT_DIR, { recursive: true });
  const svgPath = join(OUT_DIR, 'report.svg');
  await writeFile(svgPath, svg, 'utf8');
  await execFileP('rsvg-convert', ['-w', '1200', '-h', '630', svgPath, '-o', join(OUT_DIR, 'report.png')]);
  await rm(svgPath);
  console.log('[report-card] Wrote public/og/tools/report.png');
}

main().catch((e) => { console.error('[report-card] Failed:', e); process.exit(1); });
