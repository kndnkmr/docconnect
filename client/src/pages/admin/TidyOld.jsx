// Admin → Needs help: old appointments nobody closed. Shows what would change
// first; nothing is changed until the admin confirms.
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../services/api';
export default function TidyOld({ onDone }) {
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setP((await adminAPI.previewOldAppointments()).data); } catch { setP(null); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!p || p.total === 0) return null;
  const c = p.counts;
  const tidy = async () => {
    if (!window.confirm(`Tidy ${p.total} old appointments?\n\n• ${c['expire-pending']} requests nobody confirmed will be closed as expired\n• ${c.complete} visits (paid / free / call held) will be marked completed\n• ${c['close-unpaid']} unpaid visits that likely did not happen will be closed\n\nNobody is notified. Each change is written to the appointment's history.`)) return;
    setBusy(true);
    try {
      const { data } = await adminAPI.tidyOldAppointments();
      toast.success(data.message, { duration: 8000 });
      await load();
      onDone && onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not tidy');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mb-4 p-4 rounded-xl border border-amber-200 bg-amber-50">
      <p className="font-bold text-amber-900">🧹 {p.total} old appointments are still open</p>
      <p className="text-sm text-amber-900 mt-1">
        Their time passed long ago, but they still show as pending or confirmed, so doctors see them next to today's patients.
        {' '}{c['expire-pending']} unconfirmed requests · {c.complete} paid or free visits · {c['close-unpaid']} unpaid visits.
      </p>
      <p className="text-xs text-amber-800 mt-1">By doctor: {Object.entries(p.byDoctor).map(([n, k]) => `${n} (${k})`).join(', ')}</p>
      <button type="button" onClick={tidy} disabled={busy} className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-60">
        {busy ? 'Tidying…' : 'Review and tidy up'}
      </button>
    </div>
  );
}
