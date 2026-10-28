// ============================================
// CallAlertsBox — "will my phone ring at appointment time?"
// ============================================
// Shown on video/phone appointment cards within 48 h of the slot (see
// wantsCallAlerts in utils/callAlarm.js). Device-level: it reflects whether
// THIS phone/browser can get the call alarm, and fixes it in one tap.
//   on          → "🔔 Call alerts are on" + Test my alarm
//   off         → "Turn on call alerts"
//   blocked     → how to allow notifications in the browser
//   ios-install → add ProMedicoz to the Home Screen (iPhone rule)
//   unsupported → keep this page open / use Chrome

import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { isPushSupported, getPushPermission, enablePushNotifications, sendTestAlarm } from '../services/push';
import { callAlertState, isIOSDevice, isStandalone, unlockAudio } from '../utils/callAlarm';

const readState = () => callAlertState({
  supported: isPushSupported(),
  permission: getPushPermission(),
  isIOS: isIOSDevice(),
  standalone: isStandalone(),
});

export default function CallAlertsBox({ when }) {
  const [state, setState] = useState(readState);
  const [busy, setBusy] = useState(false);

  const turnOn = async () => {
    unlockAudio();
    setBusy(true);
    const ok = await enablePushNotifications();
    setBusy(false);
    setState(readState());
    if (ok) toast.success('Call alerts on. Tap "Test my alarm" to check the sound.');
    else toast.error('Could not turn on call alerts. See the steps shown.');
  };

  const test = async () => {
    unlockAudio();
    setBusy(true);
    const r = await sendTestAlarm();
    setBusy(false);
    if (r.ok) toast.success(`${r.message} Your phone should ring in a few seconds.`, { duration: 6000 });
    else toast.error(r.message, { duration: 7000 });
  };

  if (state === 'on') {
    return (
      <div className="mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg flex flex-wrap items-center gap-2 justify-between">
        <p className="text-xs font-medium text-green-800">🔔 Call alerts are on{when ? ` · your phone will ring at ${when}` : ''}</p>
        <button type="button" disabled={busy} onClick={test} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-60">
          {busy ? 'Sending…' : '🔔 Test my alarm'}
        </button>
      </div>
    );
  }

  const box = 'mt-3 p-3 bg-red-50 border border-red-200 rounded-lg';
  if (state === 'off') {
    return (
      <div className={box}>
        <p className="text-sm font-semibold text-red-800">🔕 Call alerts are off</p>
        <p className="text-xs text-red-700 mt-0.5 mb-2">Your phone won't ring{when ? ` at ${when}` : ''} unless you turn them on.</p>
        <button type="button" disabled={busy} onClick={turnOn} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-60">
          {busy ? 'Turning on…' : 'Turn on call alerts'}
        </button>
      </div>
    );
  }
  if (state === 'blocked') {
    return (
      <div className={box}>
        <p className="text-sm font-semibold text-red-800">🔕 Call alerts are blocked in this browser</p>
        <p className="text-xs text-red-700 mt-0.5">Tap the 🔒 icon next to the web address → Notifications → Allow, then reload this page.</p>
      </div>
    );
  }
  if (state === 'ios-install') {
    return (
      <div className={box}>
        <p className="text-sm font-semibold text-red-800">📲 iPhone: add ProMedicoz to your Home Screen to get call alerts</p>
        <p className="text-xs text-red-700 mt-0.5">In Safari tap Share ⬆ → "Add to Home Screen", open ProMedicoz from there, and turn on call alerts.</p>
        <Link to="/install" className="inline-block mt-1 text-xs font-semibold text-primary-600 hover:underline">Show me how →</Link>
      </div>
    );
  }
  return (
    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <p className="text-xs text-amber-800">This browser can't ring for calls. Keep ProMedicoz open at your appointment time, or use Chrome.</p>
    </div>
  );
}
