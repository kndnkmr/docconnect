// ============================================
// Generate per-category blog share cards (Open Graph images)
// ============================================
// WHY: Every blog article used to share the SAME generic ProMedicoz banner as
// its social/WhatsApp preview. This generates one branded 1200x630 card PER
// SPECIALTY (heart = red, bones = orange, skin = fuchsia, …), so a shared
// article shows a topic-relevant card that looks designed for it — not a
// one-size banner. ~17 cards instead of 373 per-article images: robust, no
// per-article staleness, and small enough to commit.
//
// HOW: each card is authored as an SVG (clean vector + typography — NO emoji,
// since rsvg-convert can't render colour emoji) and rasterised to PNG with
// `rsvg-convert`. Output: public/og/blog/<spec-slug>.png. These PNGs are
// COMMITTED, so Vercel just serves them — no image rendering runs on Vercel.
//
// WHEN TO RE-RUN: only when categories/colours/branding change. Run locally:
//   node scripts/gen-og-cards.mjs
// (Requires `rsvg-convert`, e.g. `brew install librsvg`.) It is NOT part of the
// Vercel build, by design — the committed PNGs are the build output.

import { writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = join(__dirname, '..');
const OUT_DIR = join(CLIENT_DIR, 'public', 'og', 'blog');

// Per-specialty theme: two gradient stops (dark→darker for contrast with white
// text) + a one-line tagline. Colours mirror SPEC_THEME in BlogList.jsx (the
// -600/-800 Tailwind shades, as hex) so the card matches the on-site card.
const CARDS = {
  'general-physician': { label: 'General Physician', tagline: 'Fever, cough, checkups & everyday health', from: '#2563eb', to: '#1e3a8a' },
  'gynaecologist':     { label: 'Gynaecologist',     tagline: "Women's health, pregnancy & periods",     from: '#db2777', to: '#9d174d' },
  'cardiologist':      { label: 'Cardiologist',      tagline: 'Heart, blood pressure & cholesterol',     from: '#e11d48', to: '#9f1239' },
  'dermatologist':     { label: 'Dermatologist',     tagline: 'Skin, hair & nail care',                  from: '#c026d3', to: '#86198f' },
  'orthopedic':        { label: 'Orthopedic',        tagline: 'Bones, joints, back & spine',             from: '#ea580c', to: '#9a3412' },
  'pediatrician':      { label: 'Pediatrician',      tagline: "Children's health & vaccinations",        from: '#0284c7', to: '#075985' },
  'gastroenterologist':{ label: 'Gastroenterologist',tagline: 'Stomach, acidity & digestion',            from: '#059669', to: '#065f46' },
  'ent-specialist':    { label: 'ENT Specialist',    tagline: 'Ear, nose & throat',                      from: '#0891b2', to: '#155e75' },
  'psychiatrist':      { label: 'Psychiatrist',      tagline: 'Mental health, stress & sleep',           from: '#7c3aed', to: '#5b21b6' },
  'neurologist':       { label: 'Neurologist',       tagline: 'Brain, nerves & headaches',               from: '#4f46e5', to: '#3730a3' },
  'ophthalmologist':   { label: 'Ophthalmologist',   tagline: 'Eyes & vision care',                      from: '#0d9488', to: '#115e59' },
  'pulmonologist':     { label: 'Pulmonologist',     tagline: 'Lungs, breathing & asthma',               from: '#2563eb', to: '#1e40af' },
  'endocrinologist':   { label: 'Endocrinologist',   tagline: 'Diabetes, thyroid & hormones',            from: '#d97706', to: '#92400e' },
  'dentist':           { label: 'Dentist',           tagline: 'Teeth & gum care',                        from: '#475569', to: '#1e293b' },
  'urologist':         { label: 'Urologist',         tagline: 'Kidney, urinary & prostate',              from: '#0891b2', to: '#155e75' },
  'physiotherapist':   { label: 'Physiotherapist',   tagline: 'Movement, pain & recovery',               from: '#ea580c', to: '#9a3412' },
  'nephrologist':      { label: 'Nephrologist',      tagline: 'Kidney care',                             from: '#0891b2', to: '#155e75' },
  // Generic fallback card used when an article's specialty has no card.
  'default':           { label: 'ProMedicoz Health', tagline: 'Expert health articles for India',        from: '#2563eb', to: '#1e3a8a' },
};

// XML-escape text going into the SVG.
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Build the 1200x630 card SVG. Clean, brand-consistent: diagonal gradient, a
// soft corner glow, a faint oversized medical "+" motif, the category label,
// a tagline, and the ProMedicoz wordmark + "Health Blog" kicker.
function cardSvg({ label, tagline, from, to }) {
  const fontStack = 'Helvetica, Arial, sans-serif';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <!-- soft corner glow -->
  <circle cx="1080" cy="110" r="260" fill="#ffffff" opacity="0.08"/>
  <circle cx="1140" cy="560" r="180" fill="#ffffff" opacity="0.06"/>
  <!-- faint oversized medical cross motif (right side) -->
  <g fill="#ffffff" opacity="0.10">
    <rect x="915" y="300" width="230" height="78" rx="14"/>
    <rect x="991" y="224" width="78" height="230" rx="14"/>
  </g>
  <!-- kicker -->
  <text x="90" y="150" font-family="${fontStack}" font-size="30" font-weight="bold" letter-spacing="3" fill="#ffffff" opacity="0.85">PROMEDICOZ HEALTH BLOG</text>
  <!-- category label -->
  <text x="90" y="330" font-family="${fontStack}" font-size="92" font-weight="bold" fill="#ffffff">${esc(label)}</text>
  <!-- tagline -->
  <text x="90" y="400" font-family="${fontStack}" font-size="38" fill="#ffffff" opacity="0.92">${esc(tagline)}</text>
  <!-- footer wordmark + trust line -->
  <text x="90" y="560" font-family="${fontStack}" font-size="34" font-weight="bold" fill="#ffffff">ProMedicoz</text>
  <text x="90" y="600" font-family="${fontStack}" font-size="24" fill="#ffffff" opacity="0.85">Find &amp; book verified doctors online</text>
  <!-- accent underline under the label -->
  <rect x="92" y="352" width="120" height="8" rx="4" fill="#ffffff" opacity="0.9"/>
</svg>`;
}

async function main() {
  // Verify rsvg-convert is available (local-only tool).
  try {
    await execFileP('rsvg-convert', ['--version']);
  } catch {
    console.error('[og-cards] rsvg-convert not found. Install librsvg (e.g. `brew install librsvg`) and re-run.');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  let count = 0;
  for (const [slug, card] of Object.entries(CARDS)) {
    const svg = cardSvg(card);
    const svgPath = join(OUT_DIR, `${slug}.svg`);
    const pngPath = join(OUT_DIR, `${slug}.png`);
    await writeFile(svgPath, svg, 'utf8');
    // Rasterise to a crisp 1200x630 PNG.
    await execFileP('rsvg-convert', ['-w', '1200', '-h', '630', svgPath, '-o', pngPath]);
    // Keep the repo tidy — the SVG is an intermediate, only the PNG is served.
    await rm(svgPath);
    count++;
  }

  if (!existsSync(join(OUT_DIR, 'default.png'))) {
    console.error('[og-cards] ERROR: default.png was not generated.');
    process.exit(1);
  }

  console.log(`[og-cards] Wrote ${count} category cards to public/og/blog/`);
}

main().catch((err) => {
  console.error('[og-cards] Failed:', err);
  process.exit(1);
});
