// ============================================
// Admin → Overview → 💾 Backups
// ============================================
// Shows whether nightly encrypted backups are on, when the last one ran,
// "Back up now", and the stored backups (download = still-encrypted file,
// via a 5-minute private link). See server/utils/backup.js.

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../services/api';

const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export default function BackupsCard() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const load = () => adminAPI.getBackups().then((r) => setData(r.data)).catch(() => setData({ error: true }));
  useEffect(() => { load(); }, []);

  const runNow = async () => {
    setBusy(true);
    try {
      const r = await adminAPI.runBackup();
      toast.success(r.data.message);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Backup failed', { duration: 8000 });
    } finally {
      setBusy(false);
      load();
    }
  };

  const download = async (id) => {
    try {
      const r = await adminAPI.backupDownload(id);
      window.location.href = r.data.url;
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not create a download link');
    }
  };

  if (!data) return null;
  if (data.error) {
    return <div className="mb-4 rounded-xl p-4 border border-gray-200 bg-white text-sm text-gray-500">💾 Backups: status unavailable right now.</div>;
  }

  const lastOk = (data.runs || []).find((r) => r.ok);
  const lastRun = (data.runs || [])[0];
  const failedLast = lastRun && !lastRun.ok;
  const good = data.ready && lastOk && !failedLast;
  const tone = !data.ready || failedLast ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200';

  return (
    <div className={`mb-4 rounded-xl p-4 border ${tone}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h3 className={`font-semibold text-sm ${good ? 'text-green-800' : 'text-amber-900'}`}>
            💾 Database backups: {!data.ready ? 'Off' : good ? '✓ On' : failedLast ? 'Last backup failed' : 'On (first backup tonight)'}
          </h3>
          <p className={`text-xs mt-0.5 ${good ? 'text-green-700' : 'text-amber-800'}`}>
            {!data.ready
              ? `${data.reason}. Add BACKUP_KEY on Render (see HOW_IT_WORKS → Backups) to turn on nightly encrypted backups.`
              : failedLast
                ? `Failed ${when(lastRun.at)}: ${lastRun.error || 'unknown error'}. Try "Back up now"; if it fails again, tell support.`
                : lastOk
                  ? `Last backup ${when(lastOk.at)} · ${kb(lastOk.bytes)} · runs nightly ~2:30 AM · newest ${data.keep} kept, encrypted & private.`
                  : `Runs nightly ~2:30 AM, encrypted & private. Newest ${data.keep} kept.`}
          </p>
        </div>
        {data.ready && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {data.stored && data.stored.length > 0 && (
              <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-primary-600 hover:underline">
                {open ? 'Hide' : `Stored (${data.stored.length})`}
              </button>
            )}
            <button type="button" onClick={runNow} disabled={busy} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
              {busy ? 'Backing up…' : 'Back up now'}
            </button>
          </div>
        )}
      </div>
      {open && data.stored && (
        <ul className="mt-3 divide-y divide-gray-100 bg-white rounded-lg border border-gray-100 text-xs">
          {data.stored.map((s) => (
            <li key={s.public_id} className="flex items-center justify-between px-3 py-2">
              <span className="text-gray-700">{when(s.created_at)} · {kb(s.bytes)}</span>
              <button type="button" onClick={() => download(s.public_id)} className="text-primary-600 hover:underline">Download (encrypted)</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
