// Doctor profile autosave (src/utils/profileAutosave.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffProfile, profileProblems, payloadFor, profileProgress } from '../src/utils/profileAutosave.js';

test('only changed fields are sent; uploads are never autosaved', () => {
  const saved = { specialization: 'GP', bio: '', consultationModes: ['in-person'], profilePhoto: 'a' };
  const now = { specialization: 'GP', bio: 'Hello', consultationModes: ['in-person', 'video'], profilePhoto: 'b' };
  assert.deepEqual(diffProfile(now, saved), { bio: 'Hello', consultationModes: ['in-person', 'video'] });
  assert.deepEqual(diffProfile(saved, saved), {});
});

test('obvious problems are caught per field', () => {
  assert.ok(profileProblems({ phone: '98765' }).phone);
  assert.ok(profileProblems({ phone: '' }).phone);
  assert.deepEqual(profileProblems({ phone: '+91 98765 43210' }), {});
  assert.deepEqual(profileProblems({ whatsappNumber: '' }), {});
  assert.ok(profileProblems({ whatsappNumber: '123' }).whatsappNumber);
  assert.ok(profileProblems({ consultationFee: '-5' }).consultationFee);
  assert.ok(profileProblems({ experience: '99' }).experience);
  assert.deepEqual(profileProblems({ experience: '' }), {});
  assert.ok(profileProblems({ googleMapsLink: 'javascript:alert(1)' }).googleMapsLink);
  assert.deepEqual(profileProblems({ googleMapsLink: 'maps.app.goo.gl/x' }), {});
});

test('cleared number fields become null', () => {
  assert.deepEqual(payloadFor({ experience: '', consultationFee: '500', bio: '' }), { experience: null, consultationFee: '500', bio: '' });
});

test('progress: 5 of 8 with what is left', () => {
  const p = profileProgress({ specialization: 'GP', qualification: 'MBBS', experience: 5, consultationFee: 300, phone: '+919876543210', medicalRegistrationNo: '', clinicAddress: ' ', city: '' });
  assert.equal(p.done, 5);
  assert.equal(p.total, 8);
  assert.deepEqual(p.missing, ['registration no.', 'clinic address', 'city']);
});
