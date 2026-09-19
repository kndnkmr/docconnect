// ============================================
// Generate blogMeta.js from blogData.js
// ============================================
// WHY: blogData.js holds all article metadata AND the full article bodies
// (content arrays). It's a large file (~1.3 MB). The blog LIST page and the
// homepage daily-tip only need the lightweight metadata (title, description,
// etc.) — not the full text of every article. But if they import from
// blogData.js, the bundler pulls the entire heavy file into their chunk, so
// just opening /blog downloaded ~400 KB (gzipped) of every article's body.
//
// This script derives a lightweight `blogMeta.js` (metadata only, no `content`)
// from blogData.js as the SINGLE SOURCE OF TRUTH — so there's no duplicate data
// to keep in sync. It runs automatically before each build (see package.json),
// and can be run manually with `npm run gen:blog-meta`.
//
// The blog LIST and homepage import the small blogMeta; the ARTICLE page keeps
// importing blogData (it needs the full content). Result: the blog list page
// loads only the small metadata file, not the megabyte of article bodies.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = join(__dirname, '..', 'src', 'pages', 'blog');
const SOURCE = join(BLOG_DIR, 'blogData.js');
const OUT = join(BLOG_DIR, 'blogMeta.js');

// The lightweight fields the list/cards/daily-tip actually use. Deliberately
// EXCLUDES `content` (the heavy part).
const META_FIELDS = ['slug', 'title', 'description', 'specialization', 'publishedDate', 'readTime', 'image'];

async function main() {
  // Import the single source of truth. blogData.js is a plain data module
  // (no imports, no JSX), so a Node import works directly.
  const mod = await import(`file://${SOURCE}`);
  const articles = mod.articles;

  if (!Array.isArray(articles) || articles.length === 0) {
    console.error('[gen-blog-meta] ERROR: could not read articles from blogData.js');
    process.exit(1);
  }

  // Pick only the light fields for each article.
  const meta = articles.map((a) => {
    const o = {};
    for (const f of META_FIELDS) o[f] = a[f];
    return o;
  });

  // Basic sanity: every entry must have a slug and title.
  const bad = meta.find((m) => !m.slug || !m.title);
  if (bad) {
    console.error('[gen-blog-meta] ERROR: an article is missing slug or title:', bad);
    process.exit(1);
  }

  const header = `// ============================================
// AUTO-GENERATED — do not edit by hand.
// Generated from blogData.js by scripts/gen-blog-meta.mjs (runs on build).
// Lightweight article metadata (NO article body/content) so the blog list
// and homepage load fast without pulling in every article's full text.
// To change article data, edit blogData.js and rebuild.
// ============================================

`;

  const body = `export const articleMeta = ${JSON.stringify(meta, null, 2)};\n`;

  await writeFile(OUT, header + body, 'utf8');
  console.log(`[gen-blog-meta] Wrote ${meta.length} article metadata entries to blogMeta.js`);
}

main().catch((err) => {
  console.error('[gen-blog-meta] Failed:', err);
  process.exit(1);
});
