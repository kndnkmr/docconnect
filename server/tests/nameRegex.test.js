const test = require('node:test');
const assert = require('node:assert');
const { nameRegex } = require('../utils/queryHelpers');

test('nameRegex ignores a leading Dr / Dr. / Doctor', () => {
  for (const q of ['Dr Pooja Singh', 'Dr. Pooja', 'dr.pooja singh', 'Doctor Pooja', 'Pooja']) {
    assert.ok(nameRegex(q).test('Pooja Singh'), q);
  }
});
test('nameRegex matches words in any order and still matches stored "Dr" names', () => {
  assert.ok(nameRegex('singh pooja').test('Pooja Singh'));
  assert.ok(nameRegex('Dr Akash verma').test('Dr Akash verma'));
});
test('nameRegex does not match other doctors and is regex-safe', () => {
  assert.ok(!nameRegex('Dr Pooja Singh').test('Rajni singh'));
  assert.doesNotThrow(() => nameRegex('(.*)+['));
  assert.ok(!nameRegex('.*').test('Pooja Singh'));
});
test('nameRegex with only "Dr" falls back to a plain contains', () => {
  assert.ok(nameRegex('Dr').test('Dr Akash verma'));
});
