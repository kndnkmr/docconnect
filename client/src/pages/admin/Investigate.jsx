// ============================================
// Admin → 🔎 Investigate an appointment (silent: nobody is notified)
// ============================================
// Where each side is, a full timeline, the evidence (including screenshots and
// UTRs that were replaced), chat and call counts (never the message text),
// each person's track record, and the admin actions: payment help, warn,
// suspend, note. Data from GET /api/admin/appointments/:id/investigate.
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminAPI, getUploadUrl } from '../../services/api';
import StepChips from './StepChips';
const ROLE = {
  patient: 'bg-blue-100 text-blue-800', doctor: 'bg-green-100 text-green-800',
  admin: 'bg-purple-100 text-purple-800', system: 'bg-gray-100 text-gray-600',
};
const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '');
const dayOf = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
function Track({ t, title }) {
  if (!t) return null;
  return (
    <div className="flex-1 min-w-[220px] text-xs text-gray-700 space-y-0.5">
      <p className="font-bold text-gray-800 text-sm">{title}: {t.name}</p>
      {t.suspended && <p className="text-red-700 font-semibold">Suspended{t.suspendedReason ? `: ${t.suspendedReason}` : ''}</p>}
      <p>Joined {when(t.joined)} · last login {t.lastLogin ? when(t.lastLogin) : 'never'}</p>
      <p>{t.bookings} bookings · {t.completed} completed · {t.cancelled} cancelled ({t.cancelRatePct}%)</p>
      <p>{t.paymentClaims} payment claims · {t.paidBookings} paid bookings</p>
      <p className={t.notReceivedCases ? 'text-red-700' : ''}>
        "Not received" cases: <b>{t.notReceivedCases}</b>
        {t.notReceivedButAdminFoundPaid > 0 && <> · admin later found it paid: <b>{t.notReceivedButAdminFoundPaid}</b></>}
      </p>
      <p>Claims taken back or reset: <b>{t.claimsTakenBackOrReset}</b> · warnings: <b>{t.warnings}</b></p>
    </div>
  );
}
export default function Investigate({ apt, onClose, onPaymentHelp, onChanged }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState('');
  const [who, setWho] = useState('patient');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.investigate(apt._id);
      setD(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load this appointment');
    } finally {
      setLoading(false);
    }
  }, [apt._id]);
  useEffect(() => { load(); }, [load]);
  const a = d && d.appointment;
  const person = a && (who === 'doctor' ? a.doctor : a.patient);
  const act = async (kind) => {
    if (!person || !person._id) return;
    const reason = text.trim();
    if (kind !== 'note' && !reason) { toast.error('Please write the reason. The person sees it.'); return; }
    if (kind === 'note' && !reason) { toast.error('Please write a note'); return; }
    if (kind === 'suspend' && !window.confirm(`Suspend ${person.name}? They are signed out, told why, and cannot log in until you reactivate them. Records are kept.`)) return;
    setBusy(kind);
    try {
      let res;
      if (kind === 'warn') res = await adminAPI.warnUser(person._id, { reason, appointmentId: a._id });
      else if (kind === 'suspend') res = await adminAPI.setSuspension(person._id, true, reason, a._id);
      else res = await adminAPI.addNote(a._id, reason);
      toast.success(res.data.message);
      setText('');
      onChanged && onChanged();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    } finally {
      setBusy('');
    }
  };
  const ev = d && d.evidence;
  const shot = ev && ev.screenshot ? getUploadUrl(ev.screenshot) : '';
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Investigate appointment">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[94vh] overflow-y-auto p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-800">🔎 Investigate</h3>
            <p className="text-xs text-gray-500">Silent: nobody is told that you looked.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none" aria-label="Close">×</button>
        </div>
        {loading && !d && <p className="mt-4 text-sm text-gray-500">Loading…</p>}
        {d && (
          <>
            <p className="mt-2 text-sm font-semibold text-gray-800">
              {a.patient?.name} {a.patient?.patientId ? `(${a.patient.patientId})` : ''} → Dr. {a.doctor?.name}
            </p>
            <p className="text-xs text-gray-500">{dayOf(a.date)}, {a.timeSlot} · {a.consultationType} · fee Rs. {ev.amountAsked} · booked {when(a.createdAt)}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              {a.patient?.phone && <a className="text-primary-600" href={`tel:${a.patient.phone}`}>📞 Patient {a.patient.phone}</a>}
              {a.doctor?.phone && <a className="text-primary-600" href={`tel:${a.doctor.phone}`}>📞 Doctor {a.doctor.phone}</a>}
            </div>

            <div className={`mt-3 p-3 rounded-xl border ${d.steps.flag === 'dispute' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
              <p className="text-xs font-bold text-gray-600 mb-1.5">Where each side is</p>
              <StepChips steps={d.steps} />
              {ev.disputedAt && (
                <p className="mt-2 text-xs text-red-800">Doctor said "not received" on {when(ev.disputedAt)}{ev.disputeNote ? `: "${ev.disputeNote}"` : ''}</p>
              )}
            </div>

            <div className="mt-3 grid sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-gray-200">
                <p className="text-sm font-bold text-gray-800 mb-1">Timeline</p>
                <p className="text-[11px] text-gray-400 mb-2">Nothing is deleted. Older appointments show the times we already had.</p>
                <ol className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {d.timeline.map((e, i) => (
                    <li key={i} className="text-xs">
                      <span className="text-gray-400">{when(e.at)}</span>{' '}
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${ROLE[e.role] || ROLE.system}`}>{e.role}</span>{' '}
                      <span className="text-gray-800">{e.text}</span>
                      {e.data && e.data.utr && <span className="font-mono text-gray-600"> {e.data.utr}</span>}
                      {e.data && (e.data.url || e.data.screenshot) && (
                        <button type="button" onClick={() => setZoom(getUploadUrl(e.data.url || e.data.screenshot))} className="ml-1 text-primary-600 hover:underline">view image</button>
                      )}
                      {e.note && <span className="text-gray-500 italic"> "{e.note}"</span>}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="p-3 rounded-xl border border-gray-200 text-xs text-gray-700 space-y-1">
                <p className="text-sm font-bold text-gray-800">Evidence</p>
                <p>UTR: {ev.utr ? <span className="font-mono">{ev.utr}</span> : <span className="text-gray-400">none</span>}</p>
                {ev.utrUsedOnOtherBookings > 0 && <p className="text-red-700 font-semibold">⚠ This UTR is on {ev.utrUsedOnOtherBookings} other booking(s)</p>}
                <p>Screenshot: {shot ? <button type="button" onClick={() => setZoom(shot)} className="text-primary-600 hover:underline">View</button> : <span className="text-gray-400">none</span>}</p>
                <p>Doctor's UPI: {ev.doctorUpi || <span className="text-gray-400">not set</span>}</p>
                <p>Asked Rs. {ev.amountAsked}{ev.amountCollected ? ` · marked received Rs. ${ev.amountCollected}` : ''}</p>
                {ev.history.length > 0 && (
                  <div className="pt-1 border-t border-gray-100">
                    <p className="font-semibold text-gray-800">Earlier proof (removed or replaced)</p>
                    {ev.history.map((h, i) => (
                      <p key={i}>{when(h.at)} ({h.role}) {h.utr && <span className="font-mono">{h.utr}</span>} {h.screenshot && <button type="button" onClick={() => setZoom(getUploadUrl(h.screenshot))} className="text-primary-600 hover:underline">image</button>}</p>
                    ))}
                  </div>
                )}
                <div className="pt-1 border-t border-gray-100">
                  <p className="font-semibold text-gray-800">Chat (no message text shown)</p>
                  <p>{d.chat.total} messages{d.chat.total ? ` · patient ${d.chat.byRole.patient || 0}, doctor ${d.chat.byRole.doctor || 0} · last by ${d.chat.lastBy} ${when(d.chat.lastAt)}` : ''}</p>
                  <p className="font-semibold text-gray-800 pt-1">Call</p>
                  <p>Alert reached: doctor {d.calls.alerts?.doctor?.seenAt ? '✓' : (d.calls.alerts?.doctor?.sentAt ? 'sent, not seen' : '–')} · patient {d.calls.alerts?.patient?.seenAt ? '✓' : (d.calls.alerts?.patient?.sentAt ? 'sent, not seen' : '–')}</p>
                  <p>{d.calls.logs.length ? `Call held ${d.calls.logs.length}x, ${d.calls.logs.reduce((s, c) => s + (c.durationSeconds || 0), 0)} s in total` : 'No call recorded'}</p>
                </div>
              </div>
            </div>

            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-sm font-bold text-amber-900 mb-1">Track record (facts only, you decide)</p>
              <p className="text-[11px] text-amber-800 mb-2">One case proves little. A pattern over several cases does. Event-based counts start from when this feature went live.</p>
              <div className="flex flex-wrap gap-4">
                <Track t={d.trust.patient} title="Patient" />
                <Track t={d.trust.doctor} title="Doctor" />
              </div>
            </div>

            <div className="mt-3 p-3 rounded-xl border border-gray-200">
              <p className="text-sm font-bold text-gray-800 mb-2">What you can do</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {a.status !== 'cancelled' && !a.isFollowUp && (
                  <button type="button" onClick={() => onPaymentHelp && onPaymentHelp(a)} className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700">💳 Mark paid / reset payment</button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-gray-600" htmlFor="inv-who">About the</label>
                <select id="inv-who" value={who} onChange={(e) => setWho(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs">
                  <option value="patient">Patient ({a.patient?.name})</option>
                  <option value="doctor">Doctor ({a.doctor?.name})</option>
                </select>
              </div>
              <textarea
                value={text} onChange={(e) => setText(e.target.value)} maxLength={300} rows={2}
                placeholder="Write the reason (warnings and suspensions show this text to the person) or a private note"
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                aria-label="Reason or note"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={!!busy} onClick={() => act('warn')} className="px-3 py-1.5 bg-white border border-blue-300 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-50 disabled:opacity-60">{busy === 'warn' ? 'Sending…' : '⚠ Send warning'}</button>
                <button type="button" disabled={!!busy} onClick={() => act('suspend')} className="px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-50 disabled:opacity-60">{busy === 'suspend' ? 'Saving…' : '⛔ Suspend'}</button>
                <button type="button" disabled={!!busy} onClick={() => act('note')} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-60">{busy === 'note' ? 'Saving…' : '📝 Save private note'}</button>
              </div>
              <p className="text-[11px] text-gray-500 mt-2">Every action is written to the timeline with your name. Warnings and suspensions tell the person why.</p>
            </div>
          </>
        )}
      </div>
      {zoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/80" onClick={() => setZoom('')} aria-label="Close image" />
          {/\.pdf($|\?)/i.test(zoom) ? (
            <a href={zoom} target="_blank" rel="noopener noreferrer" className="relative bg-white rounded-lg px-4 py-3 text-primary-600">Open PDF receipt</a>
          ) : (
            <img src={zoom} alt="Payment proof" className="relative max-w-lg w-full max-h-[85vh] object-contain rounded-lg" />
          )}
        </div>
      )}
    </div>
  );
}
