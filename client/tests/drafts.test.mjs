// Drafts on the device (src/utils/drafts.js)
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal localStorage for node.
class MemStore {
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
globalThis.localStorage = new MemStore();
const { saveDraft, loadDraft, clearDraft, listDrafts, clearAllDrafts, savedAgo, draftKey, HOUR } = await import('../src/utils/drafts.js');

beforeEach(() => { globalThis.localStorage = new MemStore(); });

test('save + load per account', () => {
  saveDraft('booking:doc1', { date: '2099-01-01', reason: 'Fever' }, 'u1', 1000);
  assert.deepEqual(loadDraft('booking:doc1', 'u1', HOUR, 2000), { data: { date: '2099-01-01', reason: 'Fever' }, savedAt: 1000 });
  assert.equal(loadDraft('booking:doc1', 'u2', HOUR, 2000), null); // another account on the same phone
  assert.equal(draftKey('register', null), 'pmz_draft:guest:register');
});

test('expired and broken drafts are dropped', () => {
  saveDraft('booking:doc1', { a: 1 }, 'u1', 0);
  assert.equal(loadDraft('booking:doc1', 'u1', HOUR, 2 * HOUR), null);
  assert.equal(localStorage.length, 0);
  localStorage.setItem(draftKey('rx:a1', 'u1'), '{not json');
  assert.equal(loadDraft('rx:a1', 'u1', HOUR), null);
  assert.equal(localStorage.length, 0);
});

test('list newest first by prefix; clear one; logout clears only that account', () => {
  saveDraft('booking:doc1', { n: 1 }, 'u1', 1000);
  saveDraft('booking:doc2', { n: 2 }, 'u1', 3000);
  saveDraft('rx:a1', { n: 3 }, 'u1', 2000);
  saveDraft('booking:doc9', { n: 9 }, 'u2', 2000);
  const list = listDrafts('u1', 'booking:', HOUR, 4000);
  assert.deepEqual(list.map((d) => d.name), ['booking:doc2', 'booking:doc1']);
  clearDraft('booking:doc2', 'u1');
  assert.equal(listDrafts('u1', 'booking:', HOUR, 4000).length, 1);
  clearAllDrafts('u1');
  assert.equal(listDrafts('u1', '', HOUR, 4000).length, 0);
  assert.equal(listDrafts('u2', 'booking:', HOUR, 4000).length, 1);
});

test('saved-ago labels', () => {
  const now = 10 * 24 * HOUR;
  assert.equal(savedAgo(now - 10 * 1000, now), 'just now');
  assert.equal(savedAgo(now - 10 * 60000, now), '10 min ago');
  assert.equal(savedAgo(now - 3 * HOUR, now), '3h ago');
  assert.equal(savedAgo(now - 48 * HOUR, now), '2 days ago');
});
