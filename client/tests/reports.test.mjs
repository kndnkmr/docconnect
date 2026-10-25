// Report Samjhao — ranges, bands, urgent limits (src/pages/tools/reports.js)
// ⚠ These numbers are medical. If a doctor changes a range in reports.js,
// update the matching expectation here in the same commit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpret, reasonText, urgentText, formatValue, normalizeTyped, PARAMS, COPY } from '../src/pages/tools/reports.js';

const level = (id, v, sex, rr) => interpret(id, v, sex, rr).level;
const key = (id, v) => interpret(id, v).key;
const urgent = (id, v) => interpret(id, v).urgent;

test('typical adult ranges', () => {
  assert.deepEqual(PARAMS.hb.range('f'), [12, 15]);
  assert.deepEqual(PARAMS.hb.range('m'), [13, 17]);
  assert.deepEqual(PARAMS.wbc.range(), [4000, 11000]);
  assert.deepEqual(PARAMS.plt.range(), [1.5, 4.5]);
  assert.deepEqual(PARAMS.tsh.range(), [0.4, 4.0]);
  assert.deepEqual(PARAMS.ft4.range(), [0.8, 1.8]);
  assert.deepEqual(PARAMS.b12.range(), [200, 900]);
});

test('"see a doctor today" limits', () => {
  assert.deepEqual(PARAMS.hb.urgent, { below: 7 });
  assert.deepEqual(PARAMS.wbc.urgent, { below: 2000, above: 30000 });
  assert.deepEqual(PARAMS.plt.urgent, { below: 0.5 });
  assert.deepEqual(PARAMS.fbs.urgent, { below: 54, above: 299 });
  assert.deepEqual(PARAMS.ppbs.urgent, { below: 54, above: 299 });
  assert.equal(PARAMS.tsh.urgent, undefined);
});

test('haemoglobin by sex, and the report’s own range', () => {
  assert.equal(level('hb', 10.2, 'f'), 'low');
  assert.equal(level('hb', 13.5, 'm'), 'ok');
  assert.equal(level('hb', 12.5, 'm'), 'low');
  assert.equal(level('hb', 11.8, 'f', [11.5, 15]), 'ok');
  assert.equal(interpret('hb', 11.8, 'f', [11.5, 15]).usedReportRange, true);
  assert.equal(interpret('hb', 11.8, 'f', [15, 11]).usedReportRange, false); // reversed range ignored
  assert.equal(urgent('hb', 6.5), true);
  assert.equal(urgent('hb', 7), false);
});

test('CBC', () => {
  assert.equal(level('wbc', 7800), 'ok');
  assert.equal(urgent('wbc', 1500), true);
  assert.equal(urgent('wbc', 31000), true);
  assert.equal(level('plt', 2.1), 'ok');
  assert.equal(urgent('plt', 0.4), true);
});

test('thyroid', () => {
  assert.equal(level('tsh', 6.8), 'high');
  assert.equal(level('tsh', 0.2), 'low');
  assert.equal(urgent('tsh', 60), false);
});

test('fasting sugar bands', () => {
  assert.equal(key('fbs', 65), 'sugarLow');
  assert.equal(key('fbs', 70), 'normal');
  assert.equal(key('fbs', 99), 'normal');
  assert.equal(key('fbs', 100), 'prediabetes');
  assert.equal(key('fbs', 125), 'prediabetes');
  assert.equal(key('fbs', 126), 'diabetesRange');
  assert.equal(urgent('fbs', 50), true);
  assert.equal(urgent('fbs', 299), false);
  assert.equal(urgent('fbs', 300), true);
});

test('post-meal sugar and HbA1c bands', () => {
  assert.equal(key('ppbs', 139), 'normal');
  assert.equal(key('ppbs', 140), 'prediabetes');
  assert.equal(key('ppbs', 199), 'prediabetes');
  assert.equal(key('ppbs', 200), 'diabetesRange');
  assert.equal(key('hba1c', 5.6), 'normal');
  assert.equal(key('hba1c', 5.7), 'prediabetes');
  assert.equal(key('hba1c', 6.4), 'prediabetes');
  assert.equal(key('hba1c', 6.5), 'diabetesRange');
});

test('vitamin D bands and B12', () => {
  assert.equal(key('vitd', 18), 'low');
  assert.equal(key('vitd', 20), 'borderline');
  assert.equal(key('vitd', 29.9), 'borderline');
  assert.equal(key('vitd', 30), 'normal');
  assert.equal(key('vitd', 100), 'normal');
  assert.equal(key('vitd', 120), 'high');
  assert.equal(level('b12', 150), 'low');
  assert.equal(level('b12', 450), 'ok');
});

test('unit conversions', () => {
  assert.equal(PARAMS.fbs.units[1].toBase(7), 126); // mmol/L -> mg/dL
  assert.equal(PARAMS.vitd.units[1].toBase(50), 20); // nmol/L -> ng/mL
  assert.equal(PARAMS.plt.units[2].toBase(210000), 2.1); // /µL -> lakh
  assert.equal(PARAMS.hb.units[1].toBase(102), 10.2); // g/L -> g/dL
});

test('typed values in the default unit are scaled sensibly', () => {
  assert.equal(normalizeTyped('plt', 40000), 0.4);
  assert.equal(normalizeTyped('plt', 210), 2.1);
  assert.equal(normalizeTyped('plt', 2.1), 2.1);
  assert.equal(normalizeTyped('wbc', 7.8), 7800);
  assert.equal(normalizeTyped('wbc', 7800), 7800);
  assert.equal(normalizeTyped('hb', 102), 10.2);
  assert.equal(normalizeTyped('hb', 10.2), 10.2);
  assert.equal(normalizeTyped('tsh', 60), 60);
  // the trap this prevents: "40000 platelets" must be urgent-low, not "High"
  assert.equal(interpret('plt', normalizeTyped('plt', 40000)).urgent, true);
});

test('implausible values are flagged', () => {
  assert.equal(interpret('hb', 40).implausible, true);
  assert.equal(interpret('hb', 10).implausible, false);
});

test('explanations never empty for abnormal results, null when normal', () => {
  assert.ok(reasonText('hb', interpret('hb', 9), 'hi').startsWith('Aam kaaran: iron'));
  assert.equal(reasonText('hb', interpret('hb', 13), 'en'), null);
  assert.equal(reasonText('vitd', interpret('vitd', 25), 'en'), COPY.en.vitdBorder);
  assert.ok(reasonText('fbs', interpret('fbs', 110), 'en').startsWith('In the prediabetes'));
  for (const id of Object.keys(PARAMS)) {
    for (const lang of ['en', 'hi']) {
      for (const v of [PARAMS[id].plausible[0], PARAMS[id].plausible[1]]) {
        const r = interpret(id, v);
        if (r.level !== 'ok') assert.ok(reasonText(id, r, lang), `${id} ${v} ${lang} has a reason`);
      }
    }
  }
});

test('formatting and urgent text', () => {
  assert.equal(formatValue('plt', 0.4), '0.4 lakh');
  assert.equal(formatValue('wbc', 12500), '12,500 /µL');
  assert.ok(urgentText('plt', 0.4, 'en').startsWith('Platelets 0.4 lakh is very low.'));
  assert.ok(urgentText('hb', 6.5, 'hi').includes('bahut kam'));
});

test('copy has no disease diagnosis words in result texts', () => {
  // Safety rule: explain, don't diagnose. Names like "hypothyroidism" or
  // "anaemia" must not appear in the per-result reasons.
  const banned = /hypothyroid|hyperthyroid|anaemia|anemia|leukaemia|leukemia|you have/i;
  for (const id of Object.keys(PARAMS)) {
    for (const lang of ['en', 'hi']) {
      for (const v of [PARAMS[id].plausible[0], PARAMS[id].plausible[1]]) {
        const t = reasonText(id, interpret(id, v), lang) || '';
        assert.ok(!banned.test(t), `${id} ${lang}: "${t}"`);
      }
    }
  }
});
