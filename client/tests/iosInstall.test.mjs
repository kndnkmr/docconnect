// iPhone install guide: only for iPhone/iPad, never Android.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installEnv, wantsIosGuide, iosSteps, safariLink, iosNudgeSnoozed, snoozeIosNudge, shareButtonAt, iosGuideSteps, shouldWelcomeInstall, markWelcomeSeen } from '../src/utils/iosInstall.js';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1',
  iphoneInsta: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0',
  iphoneFb: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/460.0]',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  androidWhatsApp: 'Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 WhatsApp/2.24',
  androidInsta: 'Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36 Instagram 330.0.0.40',
};

test('Android and desktop never get the iPhone guide', () => {
  for (const k of ['androidChrome', 'androidWhatsApp', 'androidInsta', 'mac']) {
    const e = installEnv({ ua: UA[k], touchPoints: k === 'mac' ? 0 : 5 });
    assert.equal(e.ios, false, k);
    assert.equal(e.inApp, null, k);
    assert.equal(wantsIosGuide(e), false, k);
  }
});

test('iPhone browsers and in-app browsers are recognised', () => {
  assert.deepEqual(installEnv({ ua: UA.iphoneSafari }), { ios: true, inApp: null, browser: 'safari', installed: false, ipad: false, newSafari: false });
  assert.equal(installEnv({ ua: UA.iphoneChrome }).browser, 'chrome');
  assert.equal(installEnv({ ua: UA.iphoneInsta }).inApp, 'Instagram');
  assert.equal(installEnv({ ua: UA.iphoneFb }).inApp, 'Facebook');
  assert.equal(installEnv({ ua: UA.ipad, touchPoints: 5 }).ios, true, 'iPad reports Mac');
  assert.equal(wantsIosGuide(installEnv({ ua: UA.iphoneSafari })), true);
  assert.equal(wantsIosGuide(installEnv({ ua: UA.iphoneSafari, standalone: true })), false, 'already installed');
});

test('steps fit the browser and language', () => {
  assert.match(iosSteps(installEnv({ ua: UA.iphoneSafari }))[0], /bottom/);
  assert.match(iosSteps(installEnv({ ua: UA.iphoneChrome }))[0], /address bar/);
  assert.equal(iosSteps(installEnv({ ua: UA.iphoneSafari }), 'hi').length, 3);
  assert.match(iosSteps(installEnv({ ua: UA.iphoneSafari }), 'hi')[1], /Add to Home Screen/);
});

test('Safari link only for https', () => {
  assert.equal(safariLink('https://www.promedicoz.in/install'), 'x-safari-https://www.promedicoz.in/install');
  assert.equal(safariLink('javascript:alert(1)'), null);
});

test('"Maybe later" hides the card for a week', () => {
  const mem = new Map();
  const s = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(iosNudgeSnoozed(s, 0), false);
  snoozeIosNudge(s, 1000);
  assert.equal(iosNudgeSnoozed(s, 2000), true);
  assert.equal(iosNudgeSnoozed(s, 1000 + 8 * 24 * 3600 * 1000), false);
  assert.equal(iosNudgeSnoozed({ getItem() { throw new Error('x'); } }), false);
});

test('arrow points where the Share button really is', () => {
  assert.equal(shareButtonAt(installEnv({ ua: UA.iphoneSafari })), 'bottom');
  assert.equal(shareButtonAt(installEnv({ ua: UA.iphoneChrome })), 'top');
  assert.equal(shareButtonAt(installEnv({ ua: UA.ipad, touchPoints: 5 })), 'top');
  assert.equal(shareButtonAt(installEnv({ ua: UA.androidChrome, touchPoints: 5 })), null, 'never on Android');
});

test('guide has 3 short steps in both languages, each with words to read aloud', () => {
  for (const lang of ['en', 'hi']) {
    const s = iosGuideSteps(installEnv({ ua: UA.iphoneSafari }), lang);
    assert.deepEqual(s.map((x) => x.key), ['share', 'add-home', 'add']);
    for (const x of s) { assert.ok(x.title && x.sub && x.say); assert.ok(x.title.length < 40, x.title); }
  }
  assert.match(iosGuideSteps(installEnv({ ua: UA.iphoneSafari }))[0].sub, /bottom/);
  assert.match(iosGuideSteps(installEnv({ ua: UA.iphoneChrome }))[0].sub, /top right/);
});

test('installed welcome shows once, only when opened from the iPhone icon', () => {
  const mem = new Map();
  const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(shouldWelcomeInstall(installEnv({ ua: UA.iphoneSafari }), st), false, 'not installed yet');
  const inst = installEnv({ ua: UA.iphoneSafari, standalone: true });
  assert.equal(shouldWelcomeInstall(inst, st), true);
  markWelcomeSeen(st);
  assert.equal(shouldWelcomeInstall(inst, st), false);
  assert.equal(shouldWelcomeInstall(installEnv({ ua: UA.androidChrome, standalone: true }), st), false, 'never on Android');
});

const IOS26 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
test('iOS 26 Safari: arrow at ⋯ (bottom right) and the 4-step path', () => {
  const e = installEnv({ ua: IOS26 });
  assert.equal(e.newSafari, true);
  assert.equal(shareButtonAt(e), 'bottom-right');
  for (const lang of ['en', 'hi']) {
    const s = iosGuideSteps(e, lang);
    assert.deepEqual(s.map((x) => x.key), ['more', 'share', 'add-home', 'add']);
    for (const x of s) assert.ok(x.title && x.sub && x.say);
  }
  assert.match(iosGuideSteps(e)[2].sub, /View More/);
  assert.match(iosGuideSteps(e)[3].sub, /Open as Web App/);
  assert.equal(iosSteps(e).length, 4);
  // Older Safari and Chrome on iPhone keep their paths.
  assert.equal(shareButtonAt(installEnv({ ua: UA.iphoneSafari })), 'bottom');
  assert.equal(installEnv({ ua: UA.iphoneChrome }).newSafari, false);
  assert.equal(shareButtonAt(installEnv({ ua: UA.ipad.replace('Version/17.4', 'Version/26.0'), touchPoints: 5 })), 'top');
});
