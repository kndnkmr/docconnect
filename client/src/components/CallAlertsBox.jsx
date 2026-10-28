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

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { isPushSupported, getPushPermission, enablePushNotifications, sendTestAlarm, getAlarmTestStatus } from '../services/push';
import { alertFixSteps } from '../utils/alertFixSteps';
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

  // Last test (server): { sentAt, locked, seenAt }. A "pass" = a locked-screen
  // test that the phone confirmed it received.
  const [lastTest, setLastTest] = useState(null);
  // Locked test in progress: { phase: 'lock'|'waiting'|'passed'|'failed', secs }
  const [run, setRun] = useState(null);
  const pollRef = useRef(null);
  useEffect(() => {
    if (state !== 'on') return undefined;
    getAlarmTestStatus().then(setLastTest);
    return () => clearInterval(pollRef.current);
  }, [state]);
  const passed = !!(lastTest && lastTest.locked && lastTest.seenAt);

  const test = async () => {
    unlockAudio();
    setBusy(true);
    const r = await sendTestAlarm();
    setBusy(false);
    if (r.ok) toast.success(`${r.message} Your phone should ring in a few seconds.`, { duration: 6000 });
    else toast.error(r.message, { duration: 7000 });
  };

  // Locked-screen test: ring in 15 s; the person locks the phone; when they
  // come back we check whether the phone confirmed it received the alert.
  const lockedTest = async () => {
    unlockAudio();
    setBusy(true);
    const r = await sendTestAlarm({ locked: true });
    setBusy(false);
    if (!r.ok) { toast.error(r.message, { duration: 7000 }); return; }
    // Server can't take receipts → we can't check automatically; just ring.
    if (!r.receipts) { toast.success(`${r.message} Lock your phone and listen.`, { duration: 15000 }); return; }
    const sendAt = new Date(r.sendAt).getTime();
    setRun({ phase: 'lock', secs: Math.max(0, Math.round((sendAt - Date.now()) / 1000)) });
    clearInterval(pollRef.current);
    const deadline = sendAt + 45 * 1000; // give the phone up to 45 s after sending
    pollRef.current = setInterval(async () => {
      const now = Date.now();
      if (now < sendAt) { setRun({ phase: 'lock', secs: Math.round((sendAt - now) / 1000) }); return; }
      const s = await getAlarmTestStatus();
      if (s && s.seenAt && new Date(s.seenAt).getTime() >= sendAt - 2000) {
        clearInterval(pollRef.current); setLastTest(s); setRun({ phase: 'passed' }); return;
      }
      if (now > deadline) { clearInterval(pollRef.current); setLastTest(s); setRun({ phase: 'failed' }); return; }
      setRun({ phase: 'waiting' });
    }, 2000);
  };

  if (state === 'on') {
    const fix = alertFixSteps();
    const testedOn = lastTest && lastTest.seenAt
      ? new Date(lastTest.seenAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
      : '';
    return (
      <div className={`mt-3 p-3 rounded-lg border ${run?.phase === 'failed' ? 'bg-red-50 border-red-200' : passed ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        {run?.phase === 'lock' && (
          <p className="text-sm font-bold text-gray-900" role="status" aria-live="polite">🔒 Lock your phone now — it will ring in {run.secs} s. Then unlock and come back here.</p>
        )}
        {run?.phase === 'waiting' && <p className="text-sm font-semibold text-gray-900" role="status" aria-live="polite">⏳ Checking if your phone got it…</p>}
        {run?.phase === 'passed' && <p className="text-sm font-bold text-green-800" role="status">✅ It reached your phone while locked. You're set{when ? ` — it will ring at ${when}` : ''}.</p>}
        {run?.phase === 'failed' && (
          <div role="alert">
            <p className="text-sm font-bold text-red-800">❌ It didn't reach your phone while locked</p>
            <p className="text-xs text-red-800 mt-1 mb-1">Fix for {fix.label}:</p>
            <ol className="list-decimal pl-5 text-xs text-gray-800 space-y-0.5">
              {fix.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
            <p className="text-xs text-gray-700 mt-1">Then test again. Can't fix it? Keep ProMedicoz open on screen at your appointment time.</p>
          </div>
        )}
        {!run && (
          passed
            ? <p className="text-xs font-medium text-green-800">✅ Rang on this phone while locked{testedOn ? ` (tested ${testedOn})` : ''}{when ? ` · it will ring at ${when}` : ''}</p>
            : (
              <>
                <p className="text-xs font-bold text-amber-900">⚠️ Call alerts are on, but not tested with the screen locked</p>
                <p className="text-[11px] text-amber-900 mt-0.5">Many phones silence websites when locked. 15-second check:</p>
              </>
            )
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          {(!run || run.phase === 'failed' || run.phase === 'passed') && (
            <button type="button" disabled={busy} onClick={lockedTest} className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60 ${passed && run?.phase !== 'failed' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
              {busy ? 'Starting…' : run?.phase === 'failed' ? '🔒 Test again' : '🔒 Test with screen locked'}
            </button>
          )}
          {!run && (
            <button type="button" disabled={busy} onClick={test} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60">
              🔔 Quick test
            </button>
          )}
        </div>
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
