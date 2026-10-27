// Consultation types a doctor offers (src/utils/consultModes.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offeredModes, pickMode } from '../src/utils/consultModes.js';

test('only the doctor\'s own types, in display order', () => {
  assert.deepEqual(offeredModes(['in-person', 'video']), ['video', 'in-person']);
  assert.deepEqual(offeredModes(['in-person']), ['in-person']);
  assert.deepEqual(offeredModes([]), ['video', 'phone', 'in-person']);        // old records: all
  assert.deepEqual(offeredModes(undefined), ['video', 'phone', 'in-person']);
  assert.deepEqual(offeredModes(['teleport']), ['video', 'phone', 'in-person']);
});

test('pick: keep a valid choice, otherwise first offered (and say it changed)', () => {
  assert.deepEqual(pickMode('video', ['video', 'in-person']), { mode: 'video', switched: false });
  assert.deepEqual(pickMode('video', ['in-person']), { mode: 'in-person', switched: true });
  assert.deepEqual(pickMode('', ['phone', 'in-person']), { mode: 'phone', switched: false });
  assert.deepEqual(pickMode(undefined, ['in-person']), { mode: 'in-person', switched: false });
});
