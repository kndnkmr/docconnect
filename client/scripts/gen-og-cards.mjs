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
//   node scripts/gen-og-cards.mjs                 (all cards)
//   node scripts/gen-og-cards.mjs microbiologist  (only the cards named)
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
  // Hindi-first: our blog audience is largely Hindi-speaking, so the share
  // cards (what shows in a WhatsApp status) are in Hindi. rsvg-convert renders
  // Devanagari fine with the system font (verified). Labels are the Hindi
  // specialty names; taglines are short Hindi topic lines.
  'general-physician': { label: 'सामान्य चिकित्सक',      tagline: 'बुखार, खांसी, जांच व रोज़मर्रा की सेहत', from: '#2563eb', to: '#1e3a8a' },
  'gynaecologist':     { label: 'स्त्री रोग विशेषज्ञ',    tagline: 'महिला स्वास्थ्य, गर्भावस्था व मासिक',    from: '#db2777', to: '#9d174d' },
  'cardiologist':      { label: 'हृदय रोग विशेषज्ञ',      tagline: 'हृदय, रक्तचाप व कोलेस्ट्रॉल',           from: '#e11d48', to: '#9f1239' },
  'dermatologist':     { label: 'त्वचा रोग विशेषज्ञ',     tagline: 'त्वचा, बाल व नाखून की देखभाल',          from: '#c026d3', to: '#86198f' },
  'orthopedic':        { label: 'हड्डी रोग विशेषज्ञ',     tagline: 'हड्डी, जोड़, कमर व रीढ़',               from: '#ea580c', to: '#9a3412' },
  'pediatrician':      { label: 'बाल रोग विशेषज्ञ',       tagline: 'बच्चों की सेहत व टीकाकरण',             from: '#0284c7', to: '#075985' },
  'gastroenterologist':{ label: 'पेट व पाचन विशेषज्ञ',    tagline: 'पेट, अम्लता व पाचन',                   from: '#059669', to: '#065f46' },
  'ent-specialist':    { label: 'कान-नाक-गला विशेषज्ञ',   tagline: 'कान, नाक व गला',                       from: '#0891b2', to: '#155e75' },
  'psychiatrist':      { label: 'मनोचिकित्सक',            tagline: 'मानसिक स्वास्थ्य, तनाव व नींद',         from: '#7c3aed', to: '#5b21b6' },
  'neurologist':       { label: 'न्यूरोलॉजिस्ट',          tagline: 'मस्तिष्क, नसें व सिरदर्द',             from: '#4f46e5', to: '#3730a3' },
  'ophthalmologist':   { label: 'नेत्र रोग विशेषज्ञ',     tagline: 'आँख व दृष्टि की देखभाल',               from: '#0d9488', to: '#115e59' },
  'pulmonologist':     { label: 'फेफड़ा रोग विशेषज्ञ',    tagline: 'फेफड़े, साँस व दमा',                   from: '#2563eb', to: '#1e40af' },
  'endocrinologist':   { label: 'मधुमेह व हार्मोन विशेषज्ञ', tagline: 'मधुमेह, थायराइड व हार्मोन',         from: '#d97706', to: '#92400e' },
  'dentist':           { label: 'दंत चिकित्सक',           tagline: 'दांत व मसूड़ों की देखभाल',             from: '#475569', to: '#1e293b' },
  'urologist':         { label: 'मूत्र रोग विशेषज्ञ',     tagline: 'गुर्दा, मूत्र व प्रोस्टेट',            from: '#0891b2', to: '#155e75' },
  'physiotherapist':   { label: 'फिजियोथेरेपिस्ट',        tagline: 'चलना-फिरना, दर्द व रिकवरी',            from: '#ea580c', to: '#9a3412' },
  'microbiologist':    { label: 'माइक्रोबायोलॉजिस्ट',     tagline: 'संक्रमण, जांच व सही दवा',              from: '#7c3aed', to: '#4c1d95' },
  'nephrologist':      { label: 'गुर्दा रोग विशेषज्ञ',    tagline: 'गुर्दे की देखभाल',                     from: '#0891b2', to: '#155e75' },
  // Generic fallback card used when an article's specialty has no card.
  'default':           { label: 'ProMedicoz हेल्थ',       tagline: 'भारत के लिए विशेषज्ञ स्वास्थ्य लेख',     from: '#2563eb', to: '#1e3a8a' },
};

// XML-escape text going into the SVG.
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Build the 1200x630 card SVG. Clean, brand-consistent: diagonal gradient, a
// soft corner glow, a faint oversized medical "+" motif, the category label,
// a tagline, and the ProMedicoz wordmark + "Health Blog" kicker.
function cardSvg({ label, tagline, from, to }) {
  // Devanagari-capable font stack (macOS system fonts first, with Noto as a
  // cross-platform fallback). The Latin brand word ("ProMedicoz") uses the same
  // stack — these fonts carry Latin glyphs too, so it stays consistent.
  const fontStack = 'Kohinoor Devanagari, Devanagari Sangam MN, Noto Sans Devanagari, Noto Sans, Arial, sans-serif';
  // Hindi labels are often longer/taller than the English ones — shrink the
  // headline a bit and keep it on one line within the frame.
  const labelSize = label.length > 16 ? 66 : 82;
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
  <!-- kicker (Hindi) -->
  <text x="90" y="150" font-family="${fontStack}" font-size="32" font-weight="bold" fill="#ffffff" opacity="0.9">ProMedicoz · स्वास्थ्य ब्लॉग</text>
  <!-- category label -->
  <text x="90" y="335" font-family="${fontStack}" font-size="${labelSize}" font-weight="bold" fill="#ffffff">${esc(label)}</text>
  <!-- accent underline under the label -->
  <rect x="92" y="360" width="120" height="8" rx="4" fill="#ffffff" opacity="0.9"/>
  <!-- tagline -->
  <text x="90" y="425" font-family="${fontStack}" font-size="38" fill="#ffffff" opacity="0.92">${esc(tagline)}</text>
  <!-- footer wordmark + trust line (Hindi) -->
  <text x="90" y="560" font-family="${fontStack}" font-size="34" font-weight="bold" fill="#ffffff">ProMedicoz</text>
  <text x="90" y="600" font-family="${fontStack}" font-size="25" fill="#ffffff" opacity="0.88">वेरिफाइड डॉक्टर · ऑनलाइन बुक करें</text>
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
  const only = process.argv.slice(2);
  for (const [slug, card] of Object.entries(CARDS)) {
    if (only.length && !only.includes(slug)) continue;
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
