// Doctor's prescription box — cards ⇄ saved fields (src/utils/rxRows.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowsToMedicines, medicinesToRows, rowsToText, textToRows } from '../src/utils/rxRows.js';
import { buildChart } from '../src/utils/rxChart.js';

const ROWS = [
  { name: 'Tab Pan 40', freq: '1-0-0', food: 'Before food', days: '5', note: 'before breakfast' },
  { name: 'Tab Augmentin 625', freq: 'BD', food: 'After food', days: '5', note: '' },
  { name: 'Tab Calpol 650', freq: 'SOS', food: '', days: '', note: 'if fever, body ache' },
  { name: 'Tab Thyronorm 50', freq: 'OD', food: 'Empty stomach', days: 'Continue', note: '' },
];

test('cards save into the same fields as before', () => {
  const meds = rowsToMedicines([...ROWS, { name: '  ', freq: 'BD', food: '', days: '3', note: '' }]);
  assert.equal(meds.length, 4); // unnamed card dropped
  assert.deepEqual(meds[0], { name: 'Tab Pan 40', dosage: '', frequency: '1-0-0', duration: '5 days', instructions: 'Before food; before breakfast' });
  assert.equal(meds[2].instructions, 'if fever, body ache'); // comma stays in ONE medicine
  assert.equal(meds[3].duration, 'Continue');
  assert.equal(rowsToMedicines([{ name: 'X', days: '1' }])[0].duration, '1 day');
});

test('round trip: save then edit gives back the same cards', () => {
  assert.deepEqual(medicinesToRows(rowsToMedicines(ROWS)), ROWS);
});

test('old saved data (shifted / free text) is kept exactly, not lost', () => {
  const old = [
    { name: 'Paracetamol 500mg', dosage: '', frequency: '5 days', duration: '', instructions: '' },
    { name: 'Vit D', dosage: '60K', frequency: 'Once a week', duration: '8 weeks', instructions: 'after milk' },
  ];
  assert.deepEqual(medicinesToRows(old), [
    { name: 'Paracetamol 500mg', freq: '5 days', food: '', days: '', note: '' },
    { name: 'Vit D 60K', freq: 'Once a week', food: '', days: '8 weeks', note: 'after milk' },
  ]);
});

test('"type as text": one medicine per line, commas safe, round trip', () => {
  const txt = rowsToText(ROWS);
  assert.equal(txt.split('\n').length, 4);
  assert.equal(txt.split('\n')[2], 'Tab Calpol 650 - SOS -  - if fever, body ache');
  assert.deepEqual(textToRows(txt), ROWS);
  assert.deepEqual(textToRows('\n \n'), []);
  assert.deepEqual(textToRows('Tab Dolo 650 - TDS - 3 days'), [{ name: 'Tab Dolo 650', freq: 'TDS', food: '', days: '3', note: '' }]);
});

test("the patient's chart reads what the doctor saved", () => {
  const c = buildChart({ createdAt: '2026-08-06T05:00:00Z', medicines: rowsToMedicines(ROWS) }, Date.UTC(2026, 7, 6));
  assert.deepEqual(c.groups.morning.map((i) => i.name), ['Tab Pan 40', 'Tab Augmentin 625']);
  assert.deepEqual(c.groups.night.map((i) => i.name), ['Tab Augmentin 625']);
  assert.deepEqual(c.groups.sos.map((i) => i.name), ['Tab Calpol 650']);
  assert.deepEqual(c.groups.once.map((i) => i.name), ['Tab Thyronorm 50']);
  assert.deepEqual(c.items.map((i) => i.food), ['before', 'after', null, 'empty']);
  assert.equal(c.items[3].ongoing, true);
  assert.equal(c.groups.check.length, 0);
});
