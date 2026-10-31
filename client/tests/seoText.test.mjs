// Search title / description rules (src/utils/seoText.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seoTitle, seoDescription, DEFAULT_TITLE } from '../src/utils/seoText.js';

test('brand is added only when the title still fits in Google (~60)', () => {
  assert.equal(seoTitle('Health Blog'), 'Health Blog | ProMedicoz');
  assert.equal(seoTitle('Dr. Harinder Singh – Microbiology in Nabha'), 'Dr. Harinder Singh – Microbiology in Nabha | ProMedicoz');
  const long = 'Acidity and Heartburn: Causes, Quick Relief and When to Worry';
  assert.equal(seoTitle(long), long, 'long title: no brand, nothing cut');
  assert.ok(seoTitle('x'.repeat(47)).endsWith('| ProMedicoz') && seoTitle('x'.repeat(47)).length === 60);
  assert.equal(seoTitle('x'.repeat(48)), 'x'.repeat(48));
  assert.equal(seoTitle(''), DEFAULT_TITLE);
  assert.equal(seoTitle('  Two   spaces  '), 'Two spaces | ProMedicoz');
});

test('descriptions: short ones untouched, long ones end cleanly at a word', () => {
  assert.equal(seoDescription('Book a gynaecologist in Bhilai.'), 'Book a gynaecologist in Bhilai.');
  const long = 'Acidity and heartburn are common, but frequent symptoms can point to reflux or an ulcer. Learn the triggers, simple fixes that work, safe medicines, and the warning signs that need a doctor today.';
  const d = seoDescription(long);
  assert.ok(d.length <= 155, `length ${d.length}`);
  assert.ok(d.endsWith('…'));
  assert.ok(long.startsWith(d.slice(0, -1)), 'a clean prefix of the original');
  assert.ok(!/\s…$|[,;—-]…$/.test(d), 'no dangling space or comma before …');
  assert.equal(seoDescription(''), '');
});
