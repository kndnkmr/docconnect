// Sehat Kundli: family history → personal check-up plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKundli, topForCard, encodeFamily, decodeFamily, familyIsEmpty, CONDITIONS, RELATIVES, COPY, RELATED_ARTICLES } from '../src/pages/tools/kundliRules.js';
import { articles } from '../src/pages/blog/blogData.js';

const ids = (list) => list.map((x) => x.id);
const item = (k, id) => [...k.due, ...k.later].find((x) => x.id === id);

test('no family history → routine plan (BP + sugar from 30, women get cervix/breast)', () => {
  const k = buildKundli({ age: 32, sex: 'f', family: {} });
  assert.equal(item(k, 'bp').startAge, 30);
  assert.equal(item(k, 'sugar').startAge, 30);
  assert.equal(item(k, 'bp').family, false);
  assert.ok(ids(k.due).includes('cervix') && ids(k.due).includes('breast'));
  assert.equal(k.familyItems, 0);
  assert.deepEqual(k.moments, []);
  const m = buildKundli({ age: 32, sex: 'm', family: {} });
  assert.ok(!ids([...m.due, ...m.later]).includes('cervix'), 'no cervical screening for men');
});

test('diabetes in a parent → sugar test from 25, and early pregnancy sugar test for women', () => {
  const k = buildKundli({ age: 26, sex: 'f', family: { diabetes: ['father'] } });
  assert.equal(item(k, 'sugar').startAge, 25);
  assert.equal(item(k, 'sugar').family, true);
  assert.equal(k.due[0].id, 'sugar', 'family items first');
  assert.ok(ids(k.moments).includes('gdm'));
  assert.ok(!ids(buildKundli({ age: 26, sex: 'm', family: { diabetes: ['father'] } }).moments).includes('gdm'));
});

test('only grandparents/uncles → routine plan, but noted', () => {
  const k = buildKundli({ age: 26, sex: 'm', family: { diabetes: ['grand'] } });
  assert.equal(item(k, 'sugar').startAge, 30);
  assert.deepEqual(k.secondOnly, ['diabetes']);
});

test('early heart disease in a parent → cholesterol + BP from 20, ask about children', () => {
  const k = buildKundli({ age: 22, sex: 'm', family: { heart: ['father'], young: { heart: true } } });
  assert.equal(item(k, 'lipid').startAge, 20);
  assert.equal(item(k, 'bp').startAge, 20);
  assert.ok(ids(k.moments).includes('kids-chol'));
  // not young → 25, BP routine
  const k2 = buildKundli({ age: 22, sex: 'm', family: { heart: ['father'] } });
  assert.equal(item(k2, 'lipid').startAge, 25);
  assert.equal(item(k2, 'bp').startAge, 30);
  // "young" without a first-degree relative doesn't count
  const k3 = buildKundli({ age: 22, sex: 'm', family: { heart: ['grand'], young: { heart: true } } });
  assert.equal(item(k3, 'lipid').startAge, 30);
});

test('breast/ovarian cancer: strong history → genetic counselling; men get a doctor note', () => {
  const strong = buildKundli({ age: 28, sex: 'f', family: { breast: ['mother'], young: { breast: true } } });
  assert.ok(ids(strong.due).includes('breast-gene'));
  assert.ok(strong.doctors.includes('gynae'));
  const two = buildKundli({ age: 28, sex: 'f', family: { breast: ['mother', 'sibling'] } });
  assert.ok(ids(two.due).includes('breast-gene'), '2+ relatives counts as strong');
  const one = buildKundli({ age: 28, sex: 'f', family: { breast: ['mother'] } });
  assert.equal(item(one, 'mammo').startAge, 40);
  assert.ok(!ids([...one.due, ...one.later]).includes('breast-gene'));
  const man = buildKundli({ age: 28, sex: 'm', family: { breast: ['mother'] } });
  assert.ok(ids(man.moments).includes('brca-man'));
});

test('colon, kidney, glaucoma, thyroid, thalassaemia rules', () => {
  const k = buildKundli({ age: 45, sex: 'f', family: { colon: ['father'], young: { colon: true }, kidney: ['mother'], glaucoma: ['sibling'], thyroid: ['mother'], thal: ['grand'] } });
  assert.equal(item(k, 'colon').startAge, 40);
  assert.match(item(k, 'colon').every.en, /5 years/);
  assert.equal(item(k, 'kidney').startAge, 30);
  assert.equal(item(k, 'eye').family, true);
  assert.ok(ids(k.moments).includes('thyroid'));
  assert.ok(ids(k.moments).includes('thal'), 'thalassaemia carrier test even for second-degree');
  assert.ok(k.later.every((x) => x.startAge > 45));
});

test('later items are sorted by age; due items all apply now', () => {
  const k = buildKundli({ age: 20, sex: 'f', family: { diabetes: ['mother'] } });
  assert.ok(k.due.every((x) => x.startAge <= 20));
  const ages = k.later.map((x) => x.startAge);
  assert.deepEqual(ages, [...ages].sort((x, y) => x - y));
});

test('bad input is rejected', () => {
  assert.equal(buildKundli({ age: 12, sex: 'f' }).error, 'age');
  assert.equal(buildKundli({ age: 'abc', sex: 'f' }).error, 'age');
  assert.equal(buildKundli({ age: 30, sex: 'x' }).error, 'sex');
  assert.equal(buildKundli({ age: 30, sex: 'm', family: { diabetes: ['neighbour'] } }).familyConditions.length, 0, 'unknown relatives ignored');
});

test('share link round-trips the family list and ignores junk', () => {
  const fam = { diabetes: ['mother', 'father'], heart: ['father'], young: { heart: true }, thal: ['grand'] };
  const enc = encodeFamily(fam);
  assert.equal(enc, 'd:mf,h:f!,l:g');
  const dec = decodeFamily(enc);
  assert.deepEqual(dec.diabetes, ['mother', 'father']);
  assert.equal(dec.young.heart, true);
  assert.deepEqual(dec.thal, ['grand']);
  assert.ok(familyIsEmpty(decodeFamily('<script>,x:zz,d:q')));
  assert.ok(familyIsEmpty({}));
});

test('share picture lines: family items first, max 5', () => {
  const k = buildKundli({ age: 35, sex: 'f', family: { diabetes: ['father'], thal: ['mother'] } });
  const top = topForCard(k);
  assert.ok(top.length <= 5);
  assert.equal(top[0].id, 'sugar');
  assert.ok(top.some((x) => x.id === 'thal'));
});

test('copy is complete in both languages and every text has en + hi', () => {
  for (const lang of ['en', 'hi']) for (const key of Object.keys(COPY.en)) assert.ok(COPY[lang][key] !== undefined, `${lang}.${key}`);
  for (const c of CONDITIONS) assert.ok(c.label.en && c.label.hi && c.short.en && c.short.hi && (!c.young || (c.young.en && c.young.hi)));
  assert.equal(buildKundli({ age: 30, sex: 'm', family: { diabetes: ['father'] } }).due.find((x) => x.id === 'sugar').why.en, 'Because of diabetes in your family');
  for (const r of RELATIVES) assert.ok(r.label.en && r.label.hi);
  const k = buildKundli({ age: 50, sex: 'f', family: { diabetes: ['mother'], heart: ['father'], young: { heart: true }, thyroid: ['mother'], breast: ['mother'], colon: ['father'], kidney: ['father'], thal: ['sibling'], glaucoma: ['mother'] } });
  for (const x of [...k.due, ...k.later, ...k.moments]) {
    assert.ok(x.title.en && x.title.hi, x.id);
    if (x.every) assert.ok(x.every.en && x.every.hi, x.id);
    if (x.why) assert.ok(x.why.en && x.why.hi, x.id);
  }
});

test('related articles exist', () => {
  const slugs = new Set(articles.map((a) => a.slug));
  for (const s of RELATED_ARTICLES) assert.ok(slugs.has(s), s);
});
