// One English / हिंदी choice for the app (src/context/LangContext.jsx) and
// where the top-bar switch shows (src/components/HeaderLangSwitch.jsx).
// Pure logic only — the .jsx files are read as text for the wiring checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// initialLang / showHeaderLang live in .jsx files; copy their bodies out so
// node can run them without a JSX build step.
const src = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const fnFrom = (code, name) => {
  const start = code.indexOf(`export function ${name}`);
  assert.ok(start >= 0, `${name} not found`);
  // Body starts at the first "{" after the closing ")" of the parameters.
  let depth = 0; let i = code.indexOf(') {', start) + 2;
  for (; i < code.length; i++) { if (code[i] === '{') depth++; else if (code[i] === '}' && --depth === 0) break; }
  // eslint-disable-next-line no-new-func
  return new Function(`${code.slice(start, i + 1).replace('export ', '')}; return ${name};`)();
};
const initialLang = fnFrom(src('../src/context/LangContext.jsx'), 'initialLang');
const showHeaderLang = fnFrom(src('../src/components/HeaderLangSwitch.jsx'), 'showHeaderLang');

test('first visit follows the phone language; a saved choice wins', () => {
  assert.equal(initialLang({ saved: null, languages: ['hi-IN', 'en-IN'] }), 'hi');
  assert.equal(initialLang({ saved: null, languages: ['en-IN', 'hi'] }), 'hi');
  assert.equal(initialLang({ saved: null, languages: ['en-US'] }), 'en');
  assert.equal(initialLang({ saved: 'en', languages: ['hi-IN'] }), 'en');
  assert.equal(initialLang({ saved: 'hi', languages: ['en-US'] }), 'hi');
  assert.equal(initialLang({ saved: 'fr', languages: [] }), 'en');
  assert.equal(initialLang(), 'en');
});

test('top-bar switch: visitors + patients everywhere except blog/tools/admin; never doctors/admins', () => {
  for (const p of ['/', '/doctors', '/dr/pooja-singh', '/book-appointment/x', '/booking-confirmation', '/login', '/register', '/dashboard', '/specialization/gynaecologist/bhilai']) {
    assert.equal(showHeaderLang(p, undefined), true, p);
    assert.equal(showHeaderLang(p, 'patient'), true, p);
  }
  for (const p of ['/blog', '/blog/x', '/blog/x/hi', '/tools', '/tools/due-date-calculator/hi', '/admin']) assert.equal(showHeaderLang(p, undefined), false, p);
  assert.equal(showHeaderLang('/dashboard', 'doctor'), false);
  assert.equal(showHeaderLang('/', 'admin'), false);
});

test('pages use the shared choice (no stale per-page copies or duplicate switches)', () => {
  for (const f of ['Home', 'BookAppointment', 'BookingConfirmation', 'DoctorList', 'DoctorProfile', 'SpecializationPage', 'Login', 'Register', 'Dashboard', 'HowItWorks', 'AboutUs', 'InstallApp']) {
    const s = src(`../src/pages/${f}.jsx`);
    assert.match(s, /useLang\(\)/, f);
    assert.doesNotMatch(s, /localStorage\.getItem\('promedicoz_lang'\)/, `${f} still reads its own copy`);
    assert.doesNotMatch(s, /<LangToggle|changeLang\('hi'\)/, `${f} still has its own switch`);
  }
  assert.match(src('../src/components/Navbar.jsx'), /<HeaderLangSwitch/);
  assert.match(src('../src/main.jsx'), /<LangProvider>/);
});
