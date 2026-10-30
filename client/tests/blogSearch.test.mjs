// Blog search (English / Hinglish / Hindi words) + continue-reading & saved.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { searchWords, searchArticles } from '../src/utils/blogSearch.js';

// Minimal localStorage for the reading helpers.
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { noteProgress, getContinue, getSaved, isSaved, toggleSaved } = await import('../src/utils/blogReading.js');

const A = [
  { slug: 'gas-acidity', title: 'Gas and Acidity — When to See a Doctor', description: 'Bloating and burning', specialization: 'Gastroenterologist', publishedDate: '2026-07-01' },
  { slug: 'stomach-pain', title: 'Stomach Pain: Common Causes', description: 'Belly pain explained', specialization: 'Gastroenterologist', publishedDate: '2026-07-05' },
  { slug: 'high-bp', title: 'High BP — the Silent Killer', description: 'Blood pressure basics', specialization: 'Cardiologist', publishedDate: '2026-06-01' },
  { slug: 'pcos-diet', title: 'PCOS Diet: What to Eat', description: 'Food for PCOD', specialization: 'Gynaecologist', publishedDate: '2026-08-01' },
];
const HI = { 'high-bp': 'High BP — Chupa Hua Khatra', 'pcos-diet': 'PCOS Mein Kya Khaayein' };

test('English search ranks title matches first', () => {
  // The exact article first, related stomach problems after it.
  assert.deepEqual(searchArticles(A, 'stomach pain').map((a) => a.slug), ['stomach-pain', 'gas-acidity']);
  assert.deepEqual(searchArticles(A, 'acidity').map((a) => a.slug), ['gas-acidity', 'stomach-pain']);
  assert.deepEqual(searchArticles(A, '  '), []);
});

test('everyday words find medical titles; filler words are optional', () => {
  const B = [
    { slug: 'diabetes-signs', title: 'Silent Signs of High Blood Sugar', description: 'Diabetes early signs', specialization: 'Endocrinologist', publishedDate: '2026-05-01' },
    { slug: 'hba1c', title: 'HbA1c Test Explained', description: 'Your 3-month diabetes number', specialization: 'Endocrinologist', publishedDate: '2026-05-02' },
    { slug: 'loose', title: 'Diarrhoea in Children', description: 'Loose motions and ORS', specialization: 'Pediatrician', publishedDate: '2026-05-03' },
    { slug: 'back', title: 'Lower Back Pain at Desk Jobs', description: 'Posture fixes', specialization: 'Orthopedic', publishedDate: '2026-05-04' },
    { slug: 'feedback', title: 'Feedback from Patients', description: 'What patients told us', specialization: 'General Physician', publishedDate: '2026-05-05' },
  ];
  assert.deepEqual(searchArticles(B, 'sugar').map((a) => a.slug).sort(), ['diabetes-signs', 'hba1c']);
  assert.deepEqual(searchArticles(B, 'loose motion').map((a) => a.slug), ['loose']);
  assert.deepEqual(searchArticles(B, 'bacche ko dast').map((a) => a.slug), ['loose']);
  assert.deepEqual(searchArticles(B, 'kamar dard').map((a) => a.slug), ['back'], 'kamar = back, never "feedback"');
  assert.deepEqual(searchArticles(B, 'sugar problem').map((a) => a.slug).length, 2, '"problem" is optional');
  assert.deepEqual(searchArticles(A, 'pet dard').map((a) => a.slug)[0], 'stomach-pain');
});

test('Hindi (Devanagari) words find English articles', () => {
  assert.ok(searchWords('पेट दर्द').includes('stomach'));
  assert.equal(searchArticles(A, 'पेट दर्द')[0].slug, 'stomach-pain');
  assert.equal(searchArticles(A, 'बीपी')[0].slug, 'high-bp');
  assert.equal(searchArticles(A, 'गैस एसिडिटी')[0].slug, 'gas-acidity');
});

test('Hinglish titles are searchable', () => {
  assert.equal(searchArticles(A, 'khatra', HI)[0].slug, 'high-bp');
  assert.equal(searchArticles(A, 'kya khaayein', HI)[0].slug, 'pcos-diet');
});

beforeEach(() => store.clear());

test('continue reading: halfway only, cleared when finished', () => {
  const art = { slug: 'pcos-diet', title: 'PCOS Diet', image: '🌸' };
  noteProgress(art, 0.05);
  assert.equal(getContinue(), null);
  noteProgress(art, 0.4);
  assert.equal(getContinue().pct, 40);
  noteProgress(art, 0.95);
  assert.equal(getContinue(), null);
  noteProgress(art, 0.5, Date.now() - 31 * 864e5);
  assert.equal(getContinue(), null, 'forgotten after 30 days');
});

test('saved for later toggles, newest first', () => {
  assert.equal(toggleSaved({ slug: 'a', title: 'A' }), true);
  assert.equal(toggleSaved({ slug: 'b', title: 'B' }), true);
  assert.deepEqual(getSaved().map((s) => s.slug), ['b', 'a']);
  assert.equal(isSaved('a'), true);
  assert.equal(toggleSaved({ slug: 'a', title: 'A' }), false);
  assert.equal(isSaved('a'), false);
});
