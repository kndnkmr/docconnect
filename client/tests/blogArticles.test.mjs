// Blog articles: every article is complete, bilingual and well-formed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { articles } from '../src/pages/blog/blogData.js';
import { titlesHi } from '../src/pages/blog/titlesHi.js';
import { INTERNAL_LINKS as linkMap } from '../src/pages/blog/linkMap.js';

const TYPES = new Set(['intro', 'heading', 'paragraph', 'list', 'callout', 'table', 'steps']);

test('slugs are unique and URL-safe', () => {
  const seen = new Set();
  for (const a of articles) {
    assert.match(a.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, a.slug);
    assert.ok(!seen.has(a.slug), `duplicate ${a.slug}`);
    seen.add(a.slug);
  }
});

test('every article has its fields, English + Hinglish body and a Hinglish title', () => {
  for (const a of articles) {
    for (const f of ['title', 'description', 'specialization', 'publishedDate', 'readTime', 'image']) assert.ok(a[f], `${a.slug} missing ${f}`);
    assert.match(a.publishedDate, /^\d{4}-\d{2}-\d{2}$/, a.slug);
    assert.ok(a.content.length > 3, `${a.slug} content`);
    assert.ok(Array.isArray(a.contentHi) && a.contentHi.length > 3, `${a.slug} contentHi`);
    assert.ok(titlesHi[a.slug], `${a.slug} has no Hinglish title`);
  }
});

test('blocks are known types and tables line up', () => {
  for (const a of articles) {
    for (const b of [...a.content, ...a.contentHi]) {
      assert.ok(TYPES.has(b.type), `${a.slug} unknown block ${b.type}`);
      if (b.type === 'table') for (const r of b.rows) assert.equal(r.length, b.headers.length, `${a.slug} table row`);
      if (b.type === 'list' || b.type === 'steps') assert.ok(b.items.length > 0, `${a.slug} empty ${b.type}`);
    }
  }
});

test('internal links point at real articles', () => {
  const slugs = new Set(articles.map((a) => a.slug));
  for (const [phrase, slug] of Object.entries(linkMap)) assert.ok(slugs.has(slug), `"${phrase}" → missing ${slug}`);
});
