// ============================================
// Admin → 🚨 Needs help — patients who may be stuck
// ============================================
// The server finds these on its own (server/utils/needsHelp.js); most also
// got an automatic reminder first. Each row has a one-tap action that
// already exists elsewhere: Confirm, Payment help, Help patient, or a
// pre-filled WhatsApp message to the doctor or patient.

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../services/api';
import { GROUPS, waLink, ago, messageFor } from '../../utils/needsHelp';

const TONES = {
  red: { box: 'border-red-200', head: 'bg-red-50 text-red-800', row: 'border-red-100' },
  orange: { box: 'border-orange-200', head: 'bg-orange-50 text-orange-800', row: 'border-orange-100' },
  yellow: { box: 'border-yellow-200', head: 'bg-yellow-50 text-yellow-900', row: 'border-yellow-100' },
  gray: { box: 'border-gray-200', head: 'bg-gray-50 text-gray-700', row: 'border-gray-100' },
};

const day = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function WaButton({ phone, text, label }) {
  const href = waLink(phone, text);
  if (!href) return <span className="text-[11px] text-gray-400">{label}: no number</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 border border-green-200 bg-green-50 text-green-800 rounded-lg text-xs font-medium hover:bg-green-100 whitespace-nowrap">
      💬 {label}
    </a>
  );
}

export default function NeedsHelp({ onConfirm, onPaymentHelp, onHelpPatient, onCountChange, refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await adminAPI.getNeedsHelp();
      setData(d);
      onCountChange && onCountChange(d.total);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load the needs-help list');
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const refundChecked = async (apt) => {
    const note = window.prompt(`Refund checked for ${apt.patient?.name || 'this patient'}? Add a short note (e.g. "Doctor refunded by UPI 6 Aug"):`, '');
    if (note === null) return;
    setBusyId(apt._id);
    try {
      const { data: r } = await adminAPI.refundChecked(apt._id, { note });
      toast.success(r.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    } finally {
      setBusyId('');
    }
  };

  const confirm = async (apt) => {
    setBusyId(apt._id);
    try {
      await onConfirm(apt);
      load();
    } finally {
      setBusyId('');
    }
  };

  const row = (groupKey, apt) => {
    const p = apt.patient || {};
    const d = apt.doctor || {};
    let detail = `${day(apt.date)} · ${apt.timeSlot}`;
    if (groupKey === 'notConfirmed') detail += ` · booked ${ago(apt.createdAt)} ago`;
    if (groupKey === 'paymentWaiting') detail = `Waiting ${ago(apt.paymentClaimedAt || apt.updatedAt)} · ${apt.paymentUTR ? `UTR ${apt.paymentUTR}` : apt.paymentScreenshot ? 'screenshot sent' : 'no proof'} · ${detail}`;
    if (groupKey === 'unpaidSoon') detail += ` · ${apt.consultationType}`;
    if (groupKey === 'slotPassedOpen') detail += ` · ${apt.status} · ${apt.paymentStatus === 'paid' ? 'paid' : 'unpaid'}`;
    if (groupKey === 'paidCancelled') detail += ` · ${apt.paymentStatus === 'paid' ? 'paid' : 'patient said paid'}${apt.amountCollected ? ` Rs. ${apt.amountCollected}` : ''}`;

    return (
      <div key={apt._id} className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm border-t border-gray-100">
        <div className="min-w-0">
          <span className="font-semibold text-gray-800">{p.name || 'Unknown'}</span>
          {p.patientId && <span className="text-gray-500 ml-1">{p.patientId}</span>}
          <span className="text-gray-500"> → Dr. {d.name || '?'}</span>
          <div className="text-xs text-gray-500">{detail}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {groupKey === 'notConfirmed' && (
            <button type="button" disabled={busyId === apt._id} onClick={() => confirm(apt)} className="px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-60">✓ Confirm</button>
          )}
          {['paymentWaiting', 'unpaidSoon'].includes(groupKey) && (
            <button type="button" onClick={() => onPaymentHelp(apt)} className="px-2.5 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700">💳 Payment help</button>
          )}
          {groupKey === 'paidCancelled' && (
            <button type="button" disabled={busyId === apt._id} onClick={() => refundChecked(apt)} className="px-2.5 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-semibold hover:bg-gray-900 disabled:opacity-60">✓ Refund checked</button>
          )}
          {groupKey !== 'unpaidSoon' && <WaButton phone={d.phone} text={messageFor(groupKey, apt, 'doctor')} label="WhatsApp doctor" />}
          {['unpaidSoon', 'slotPassedOpen', 'paidCancelled'].includes(groupKey) && <WaButton phone={p.phone} text={messageFor(groupKey, apt, 'patient')} label="WhatsApp patient" />}
        </div>
      </div>
    );
  };

  const patientRow = (u) => (
    <div key={u._id} className="px-3 py-2.5 flex items-center justify-between gap-2 text-sm border-t border-gray-100">
      <div className="min-w-0">
        <span className="font-semibold text-gray-800">{u.name}</span>
        {u.patientId && <span className="text-gray-500 ml-1">{u.patientId}</span>}
        {u.email && <span className="text-gray-500 text-xs ml-1">· {u.email}</span>}
      </div>
      <button type="button" onClick={() => onHelpPatient(u._id)} className="px-2.5 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 whitespace-nowrap">🤝 Help patient</button>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Patients who may be stuck</h2>
          <p className="text-xs text-gray-500">The server finds these on its own. Most also get an automatic reminder first.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="text-sm text-primary-600 hover:underline disabled:opacity-60 whitespace-nowrap">
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {!data && loading && <p className="text-sm text-gray-500">Checking…</p>}
      {data && data.total === 0 && (
        <p className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">✓ All clear: nobody looks stuck right now.</p>
      )}

      {data && (
        <div className="space-y-3">
          {GROUPS.map((g) => {
            const items = data.groups[g.key] || [];
            const t = TONES[g.tone];
            return (
              <section key={g.key} className={`border rounded-xl overflow-hidden ${items.length ? t.box : 'border-gray-100'}`} aria-label={g.title}>
                <div className={`px-3 py-2 text-sm font-semibold ${items.length ? t.head : 'bg-gray-50 text-gray-500'}`}>
                  {g.icon} {g.title} ({items.length})
                  <span className="font-normal opacity-80"> · {items.length ? g.note : '✓ All clear'}</span>
                </div>
                {g.key === 'noPhone' ? items.map(patientRow) : items.map((apt) => row(g.key, apt))}
              </section>
            );
          })}
          <p className="text-[11px] text-gray-400">Updated {new Date(data.generatedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</p>
        </div>
      )}
    </div>
  );
}
