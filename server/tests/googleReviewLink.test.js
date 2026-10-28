// ============================================
// Doctor's optional Google review link: only real Google links accepted
// ============================================
const { test } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const { googleReviewLinkProblem: p } = require('../controllers/doctorController');

test('accepts the links Google Business gives out', () => {
  for (const ok of [
    'https://g.page/r/CbX1abcDEF/review',
    'https://maps.app.goo.gl/AbCdEf123',
    'https://search.google.com/local/writereview?placeid=ChIJ123',
    'https://www.google.com/maps/place/Some+Clinic/@21.2,81.3',
    'https://g.co/kgs/AbC123',
    '  https://g.page/r/xyz/review  ',
    '',
  ]) assert.strictEqual(p(ok), null, ok);
});

test('rejects non-Google, non-https and tricky look-alikes', () => {
  for (const bad of [
    'http://g.page/r/xyz/review',
    'javascript:alert(1)',
    'https://g.page.evil.com/r/x',
    'https://evil.com/?u=https://g.page/r/x',
    'https://google.com.evil.in/maps',
    'https://www.google.com/url?q=https://evil.com',
    'g.page/r/xyz',
    'not a link',
  ]) assert.ok(p(bad), bad);
});
