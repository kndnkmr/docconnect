// ============================================
// sendEmail with the current Resend SDK (no real email sent)
// ============================================
const { test } = require('node:test');
const assert = require('node:assert');

process.env.RESEND_API_KEY = 're_test_only';
// Replace the Resend client's send before sendEmail loads it.
const resendPkg = require('resend');
let reply;
resendPkg.Resend.prototype.emails = undefined;
const OrigResend = resendPkg.Resend;
resendPkg.Resend = class extends OrigResend {
  constructor(key) {
    super(key);
    this.emails = { send: async () => reply };
  }
};
const { sendEmail } = require('../utils/sendEmail');

test('success → returns the id', async () => {
  reply = { data: { id: 'em_123' }, error: null };
  assert.deepStrictEqual(await sendEmail({ to: 'a@b.c', subject: 's', html: '<p>x</p>' }), { success: true, id: 'em_123' });
});

test('failure reported by Resend is NOT logged as sent', async () => {
  reply = { data: null, error: { name: 'validation_error', message: 'Domain not verified' } };
  const r = await sendEmail({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });
  assert.strictEqual(r.success, false);
  assert.match(r.error, /Domain not verified/);
});

test('never throws: a broken reply is reported as a failed send', async () => {
  reply = null;
  const r = await sendEmail({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });
  assert.strictEqual(r.success, false);
});
