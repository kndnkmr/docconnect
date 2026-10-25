// Report Samjhao photo reader — text lines → values (src/pages/tools/reportParse.js)
// Lines are written the way the on-phone reader (Tesseract) returns them,
// including its real slips (dropped decimal points, O for 0).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReportLines, linesFromTesseract } from '../src/pages/tools/reportParse.js';

const L = (arr, confidence = 90) => arr.map((text) => ({ text, confidence }));

test('typical CBC table, skipping look-alike rows (MCH, MPV)', () => {
  const r = parseReportLines(L([
    'COMPLETE BLOOD COUNT (CBC)',
    'Test Name Result Unit Bio. Ref. Interval',
    'Haemoglobin (Hb) 10.2 g/dL 12.0 - 15.0',
    'Total Leucocyte Count (TLC) 7,800 cells/cumm 4000 - 11000',
    'Platelet Count 2.1 lakhs/cumm 1.5 - 4.5',
    'Mean Corpuscular Hemoglobin (MCH) 27.1 pg 27 - 32',
    'Mean Platelet Volume (MPV) 9.8 fL 7.5 - 11.5',
  ]));
  assert.deepEqual(r.hb, { value: 10.2, range: [12, 15], unsure: false });
  assert.deepEqual(r.wbc, { value: 7800, range: [4000, 11000], unsure: false });
  assert.deepEqual(r.plt, { value: 2.1, range: [1.5, 4.5], unsure: false });
});

test('×10³ units are converted', () => {
  const r = parseReportLines(L(['WBC Count 7.8 10^3/uL 4.0 - 11.0', 'Platelet Count 210 10^3/uL 150 - 450']));
  assert.equal(r.wbc.value, 7800);
  assert.deepEqual(r.wbc.range, [4000, 11000]);
  assert.equal(r.plt.value, 2.1);
  assert.deepEqual(r.plt.range, [1.5, 4.5]);
  assert.equal(parseReportLines(L(['Platelet Count 210000 /cumm 150000 - 450000'])).plt.value, 2.1);
});

test('thyroid: Free T4 and TSH (name digits are not read as values)', () => {
  const r = parseReportLines(L(['T3 (Total) 1.1 ng/mL 0.8 - 2.0', 'Free T4 (FT4) 1.2 ng/dL 0.8 - 1.8', 'TSH (Ultrasensitive) 6.80 µIU/mL 0.27 - 4.20']));
  assert.deepEqual(r.ft4, { value: 1.2, range: [0.8, 1.8], unsure: false });
  assert.deepEqual(r.tsh, { value: 6.8, range: [0.27, 4.2], unsure: false });
});

test('sugar: fasting, PP, HbA1c (HbA1c is never read as Hb)', () => {
  const r = parseReportLines(L(['Glucose - Fasting (FBS) 112 mg/dL 70 - 100', 'Glucose Post Prandial (PPBS) 168 mg/dL 70 - 140', 'HbA1c (Glycated Haemoglobin) 6.1 % 4.0 - 5.6']));
  assert.equal(r.fbs.value, 112);
  assert.equal(r.ppbs.value, 168);
  assert.equal(r.hba1c.value, 6.1);
  assert.equal(r.hb, undefined);
  assert.equal(r.fbs.range, null); // printed ranges are not used for band tests
});

test('vitamins, including "25-OH" and nmol/L', () => {
  const r = parseReportLines(L(['25-OH Vitamin D (Total) 18.4 ng/mL 30 - 100', 'Vitamin B12 245 pg/mL 211 - 911']));
  assert.equal(r.vitd.value, 18.4);
  assert.equal(r.b12.value, 245);
  assert.deepEqual(r.b12.range, [211, 911]);
  assert.equal(parseReportLines(L(['Vitamin D (25-OH) 45 nmol/L 75 - 250'])).vitd.value, 18);
});

test('mmol/L sugar is converted', () => {
  const r = parseReportLines(L(['Fasting Blood Sugar 6.2 mmol/L']));
  assert.equal(r.fbs.value, 111.6);
  assert.equal(r.fbs.unsure, false);
});

test('OCR slips: O for 0, comma decimals, low confidence', () => {
  const r = parseReportLines([{ text: 'Haemoglobin 1O.2 g/dL 12.0 - 15.0', confidence: 60 }]);
  assert.equal(r.hb.value, 10.2);
  assert.equal(r.hb.unsure, true);
  assert.equal(parseReportLines(L(['Hb 10,2 g/dL'])).hb.value, 10.2);
  assert.equal(parseReportLines(L(['Haemoglobin 12.0 - 15.0 10.2 L'])).hb.value, 10.2); // range first
  assert.equal(parseReportLines(L(['Haemoglobin 102 g/L 120 - 150'])).hb.value, 10.2);
});

test('dropped decimal points are recovered AND marked unsure', () => {
  assert.deepEqual(parseReportLines(L(['Platelet Count 21 lakhs/cumm 15-45'])).plt, { value: 2.1, range: [1.5, 4.5], unsure: true });
  assert.deepEqual(parseReportLines(L(['Free T4 (FT4) 12 ng/dL 08-18'])).ft4, { value: 1.2, range: [0.8, 1.8], unsure: true });
});

test('a real but very abnormal value is never "corrected"', () => {
  const r = parseReportLines(L(['TSH 60.2 uIU/mL 0.27 - 4.20']));
  assert.equal(r.tsh.value, 60.2);
  assert.equal(r.tsh.unsure, true);
});

test('unreadable values stay as read and are marked unsure', () => {
  assert.deepEqual(parseReportLines(L(['Glucose - Fasting 12 mg/dL 70-100'])).fbs, { value: 12, range: null, unsure: true });
  assert.deepEqual(parseReportLines(L(['HbA1c 6.1 % 40-56'])).hba1c, { value: 6.1, range: null, unsure: false });
  assert.equal(parseReportLines(L(['Free T4 1.2 ng/dL 0.8 - 1.8'])).ft4.unsure, false);
});

test('a test name with no number is left for the user', () => {
  assert.equal(parseReportLines(L(['Haemoglobin', 'Patient Name: XYZ Age 34'])).hb, undefined);
});

test('linesFromTesseract reads blocks, falls back to text', () => {
  const lines = linesFromTesseract({ blocks: [{ paragraphs: [{ lines: [{ text: 'Hb 10.2', confidence: 88 }] }] }] });
  assert.deepEqual(lines, [{ text: 'Hb 10.2', confidence: 88 }]);
  assert.deepEqual(linesFromTesseract({ text: 'a\nb' }), [{ text: 'a', confidence: null }, { text: 'b', confidence: null }]);
});
