// ============================================
// Build-time prerender: per-route static <head> meta
// ============================================
// WHY: This is a client-only React SPA, so Vite emits a single dist/index.html
// that is served for EVERY route. Its <title>/description/OG tags are the
// generic homepage ones; the correct per-page tags are only injected by
// react-helmet-async AFTER JavaScript runs. Search crawlers (and social
// scrapers) that read the raw HTML therefore see the same generic tags on every
// URL, which hurts indexing and shows wrong titles in search results.
//
// WHAT THIS DOES: after `vite build`, we take the built dist/index.html as a
// template and write one static copy per public route (e.g. dist/blog/<slug>/
// index.html) with the CORRECT title, description, canonical, robots and OG
// tags baked into the raw HTML. Vercel serves the matching static file for each
// route; React then hydrates exactly as before.
//
// WHAT THIS DOES NOT DO: it does not change the app's runtime, components, CSS,
// or the article formatting in any way. It only rewrites <head> meta strings in
// static HTML files. The <body> (the <div id="root"> + the module script) is
// byte-for-byte identical to the template, so every page still renders and
// behaves exactly like the live SPA — just with correct initial meta.
//
// Utility/auth routes (login, register, dashboards, etc.) are deliberately NOT
// prerendered here — they already get an X-Robots-Tag: noindex response header
// from vercel.json.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = join(__dirname, '..');
const DIST = join(CLIENT_DIR, 'dist');
const TEMPLATE_PATH = join(DIST, 'index.html');

const SITE = 'https://www.promedicoz.in';
const SITE_NAME = 'ProMedicoz';
const OG_IMAGE = `${SITE}/og-image.png`;

// ---- Escape a value for safe insertion into an HTML attribute ----
// Titles/descriptions contain &, quotes, < > and em-dashes — escape the ones
// that would break an attribute or the markup. (Em-dashes etc. are valid UTF-8
// and the file is UTF-8, so they can stay as-is.)
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// SEO.jsx logic, mirrored: fullTitle = `${title} | ProMedicoz` (or default).
function fullTitle(title) {
  return title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - Find & Book Doctors Online`;
}

// Specialization slug -> { title, description }. Mirrors specializationData in
// src/pages/SpecializationPage.jsx. Kept here as plain data because that page
// is a JSX/React module that a plain Node script can't import directly. These
// 10 entries are stable and match the sitemap; if the page's copy changes,
// update here too. Only title + description are needed (they drive the meta).
const SPECIALIZATIONS = {
  'gynaecologist': { title: 'Gynaecologist', description: 'Gynaecologists specialize in women\'s reproductive health, pregnancy care, fertility treatments, and menstrual disorders.' },
  'dermatologist': { title: 'Dermatologist', description: 'Dermatologists diagnose and treat conditions affecting the skin, hair, and nails. From acne to hair loss, they provide expert care.' },
  'cardiologist': { title: 'Cardiologist', description: 'Cardiologists specialize in diagnosing and treating heart conditions, high blood pressure, cholesterol, and circulatory system disorders.' },
  'neurologist': { title: 'Neurologist', description: 'Neurologists treat disorders of the brain, spinal cord, and nerves including headaches, seizures, stroke, and neuropathy.' },
  'orthopedic': { title: 'Orthopedic', description: 'Orthopedic doctors treat conditions affecting bones, joints, muscles, tendons, and the spine. From fractures to arthritis.' },
  'pediatrician': { title: 'Pediatrician', description: 'Pediatricians specialize in healthcare for infants, children, and adolescents — from vaccinations to childhood diseases.' },
  'psychiatrist': { title: 'Psychiatrist', description: 'Psychiatrists diagnose and treat mental health conditions including depression, anxiety, OCD, PTSD, and sleep disorders.' },
  'dentist': { title: 'Dentist', description: 'Dentists provide comprehensive oral healthcare including cleanings, fillings, root canals, braces, and gum disease treatment.' },
  'general-physician': { title: 'General Physician', description: 'General physicians are your first point of contact for most health concerns. They diagnose, treat, and refer to specialists when needed.' },
  'ent-specialist': { title: 'ENT Specialist', description: 'ENT specialists treat conditions of the ear, nose, throat, head, and neck including hearing loss, sinusitis, and tonsillitis.' },
};

// ---- Build the list of routes to prerender ----
async function buildRoutes() {
  // Blog articles — single source of truth from blogData.js (plain data module).
  const { articles } = await import('../src/pages/blog/blogData.js');
  const specializationData = SPECIALIZATIONS;

  const routes = [];

  // Static pages (title/description/path mirror each page's <SEO> props).
  const staticPages = [
    { path: '/', title: 'Find & Book Doctors Online in India', description: 'ProMedicoz - Book doctor appointments online. Find gynaecologists, cardiologists, dermatologists and 20+ specialists. Video, phone or in-person consultations.', type: 'website' },
    { path: '/blog', title: 'Health Blog — Expert Medical Articles', description: 'Read expert health articles on ProMedicoz. Learn about symptoms, when to see a doctor, treatment options, and preventive care tips.', type: 'website' },
    { path: '/doctors', title: 'Find Doctors', description: 'Find and book doctors online. Browse profiles, check availability, read reviews, and book appointments instantly on ProMedicoz.', type: 'website' },
    { path: '/about', title: 'About Us', description: 'ProMedicoz connects patients across India with verified doctors for video, phone, and in-person consultations — a free platform built to make quality healthcare easy to reach.', type: 'website' },
    { path: '/how-it-works', title: 'How It Works — For Patients', description: 'How ProMedicoz works for patients: find a verified doctor, book a slot, pay the doctor directly via UPI after confirmation, and consult by video, phone, or in person.', type: 'website' },
    { path: '/for-doctors', title: 'For Doctors — How ProMedicoz Works', description: 'How ProMedicoz works for doctors: keep 100% of your fee (no commission), patients pay you directly via UPI, and consult by video, phone, or in person. Free to join.', type: 'website' },
    { path: '/install', title: 'Get the App — Install & Share ProMedicoz', description: 'Install ProMedicoz on your phone for one-tap access, and share it with family and friends. Works on Android and iPhone.', type: 'website' },
    { path: '/terms', title: 'Terms & Conditions', description: 'Terms and Conditions for using ProMedicoz doctor consultation platform.', type: 'website' },
    { path: '/privacy', title: 'Privacy Policy', description: 'Privacy Policy for ProMedicoz - how we collect, use, and protect your personal and health data.', type: 'website' },
    { path: '/medical-disclaimer', title: 'Medical Disclaimer', description: 'Medical Disclaimer for ProMedicoz — the platform connects patients with registered doctors and does not itself provide medical advice.', type: 'website' },
    { path: '/cancellation-refund', title: 'Cancellation & Refund Policy', description: 'Cancellation and refund policy for ProMedicoz. Payments are made directly to the doctor via UPI; ProMedicoz does not collect or hold any money.', type: 'website' },
  ];
  routes.push(...staticPages);

  // Blog articles.
  for (const a of articles) {
    if (!a || !a.slug) continue;
    routes.push({
      path: `/blog/${a.slug}`,
      title: a.title,
      description: a.description,
      type: 'article',
    });
  }

  // Specialization landing pages (only the ones in the sitemap / indexable).
  const specSlugs = [
    'cardiologist', 'dentist', 'dermatologist', 'ent-specialist', 'general-physician',
    'gynaecologist', 'neurologist', 'orthopedic', 'pediatrician', 'psychiatrist',
  ];
  for (const slug of specSlugs) {
    const d = specializationData[slug];
    if (!d) continue;
    routes.push({
      path: `/specialization/${slug}`,
      title: `Best ${d.title} Doctors Online - Book Appointment`,
      description: `Consult top ${d.title.toLowerCase()} doctors online on ${SITE_NAME}. ${d.description} Book video, phone or in-person consultation.`,
      type: 'website',
    });
  }

  // Dedupe by path (defensive — e.g. any accidental duplicate article slug).
  const seen = new Set();
  return routes.filter((r) => {
    if (seen.has(r.path)) return false;
    seen.add(r.path);
    return true;
  });
}

// ---- Apply a route's meta to the template HTML ----
// We replace only the specific known static strings from index.html. If any of
// these anchor strings ever changes in index.html, the matching replace becomes
// a no-op — so we assert each critical replacement actually happened, failing
// the build loudly rather than silently shipping wrong/stale meta.
function applyMeta(template, route) {
  const title = fullTitle(route.title);
  const desc = route.description || '';
  const url = `${SITE}${route.path}`;
  const eTitle = esc(title);
  const eDesc = esc(desc);
  const eUrl = esc(url);

  let html = template;
  const checks = [];
  const replaceOnce = (find, replace, label) => {
    if (!html.includes(find)) { checks.push(label); return; }
    html = html.replace(find, replace);
  };

  // <title>
  replaceOnce(
    '<title>ProMedicoz - Find & Book Doctors Online | India</title>',
    `<title>${eTitle}</title>`,
    'title'
  );
  // <meta name="description">
  replaceOnce(
    '<meta name="description" content="ProMedicoz - India\'s doctor consultation platform. Find qualified doctors, book appointments online, video consultations, and manage your health." />',
    `<meta name="description" content="${eDesc}" />`,
    'description'
  );
  // og:title
  replaceOnce(
    '<meta property="og:title" content="ProMedicoz - Consult Verified Doctors Online" />',
    `<meta property="og:title" content="${eTitle}" />`,
    'og:title'
  );
  // og:description
  replaceOnce(
    '<meta property="og:description" content="Find and book verified doctors across India — video, phone, or in-person. Book in under 2 minutes. Your health, our priority." />',
    `<meta property="og:description" content="${eDesc}" />`,
    'og:description'
  );
  // og:url
  replaceOnce(
    '<meta property="og:url" content="https://www.promedicoz.in/" />',
    `<meta property="og:url" content="${eUrl}" />`,
    'og:url'
  );
  // og:type
  replaceOnce(
    '<meta property="og:type" content="website" />',
    `<meta property="og:type" content="${esc(route.type || 'website')}" />`,
    'og:type'
  );
  // twitter:title
  replaceOnce(
    '<meta name="twitter:title" content="ProMedicoz - Consult Verified Doctors Online" />',
    `<meta name="twitter:title" content="${eTitle}" />`,
    'twitter:title'
  );
  // twitter:description
  replaceOnce(
    '<meta name="twitter:description" content="Find and book verified doctors across India — video, phone, or in-person. Book in under 2 minutes." />',
    `<meta name="twitter:description" content="${eDesc}" />`,
    'twitter:description'
  );

  // Inject a canonical link (index.html has none in the static head). We add it
  // right before the closing </head> so it's always present in raw HTML.
  const canonicalTag = `<link rel="canonical" href="${eUrl}" />`;
  if (!html.includes('rel="canonical"')) {
    html = html.replace('</head>', `    ${canonicalTag}\n  </head>`);
  }

  return { html, missing: checks };
}

async function main() {
  if (!existsSync(TEMPLATE_PATH)) {
    console.error(`[prerender] dist/index.html not found at ${TEMPLATE_PATH}. Run "vite build" first.`);
    process.exit(1);
  }

  const template = await readFile(TEMPLATE_PATH, 'utf8');
  const routes = await buildRoutes();

  let written = 0;
  const missingByRoute = [];

  for (const route of routes) {
    const { html, missing } = applyMeta(template, route);
    if (missing.length) missingByRoute.push({ path: route.path, missing });

    if (route.path === '/') {
      // Home: overwrite dist/index.html in place.
      await writeFile(TEMPLATE_PATH, html, 'utf8');
    } else {
      // Others: dist/<route>/index.html (directory-style URL).
      const outDir = join(DIST, route.path.replace(/^\//, ''));
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, 'index.html'), html, 'utf8');
    }
    written++;
  }

  // If the template's anchor strings didn't match (index.html changed), fail
  // loudly — we must not silently ship pages with stale/wrong meta.
  if (missingByRoute.length) {
    console.error('[prerender] ERROR: some meta anchors were not found in dist/index.html.');
    console.error('[prerender] This usually means index.html <head> changed and the script needs updating.');
    for (const m of missingByRoute.slice(0, 3)) {
      console.error(`  - ${m.path}: missing [${m.missing.join(', ')}]`);
    }
    process.exit(1);
  }

  console.log(`[prerender] Wrote ${written} prerendered routes (static pages + ${routes.filter(r => r.path.startsWith('/blog/')).length} articles + specializations).`);
}

main().catch((err) => {
  console.error('[prerender] Failed:', err);
  process.exit(1);
});
