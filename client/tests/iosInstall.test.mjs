// iPhone install guide: only for iPhone/iPad, never Android.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installEnv, wantsIosGuide, iosSteps, safariLink, iosNudgeSnoozed, snoozeIosNudge } from '../src/utils/iosInstall.js';

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
  assert.deepEqual(installEnv({ ua: UA.iphoneSafari }), { ios: true, inApp: null, browser: 'safari', installed: false });
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
