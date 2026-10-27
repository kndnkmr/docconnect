// ============================================
// Admin → Appointments → Payment help
// ============================================
// For a patient stuck on payment: see what they sent (screenshot / UPI
// reference), then either mark it paid on the doctor's behalf (after checking
// with the doctor) or reset it so the patient sees the QR + upload options
// again. Both are recorded with the admin's id and an optional note.

import { useState } from 'react';
import toast from 'react-hot-toast';
import { adminAPI, getUploadUrl } from '../../services/api';

const STATUS_LABEL = { pending: 'Not paid', patient_claimed: 'Patient says paid', paid: 'Paid' };

export default function PaymentHelp({ apt, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState(apt.doctor?.consultationFee != null ? String(apt.doctor.consultationFee) : '');
  const [busy, setBusy] = useState('');
  const [zoom, setZoom] = useState(false);
  const pay = apt.paymentStatus || 'pending';
  const shot = apt.paymentScreenshot ? getUploadUrl(apt.paymentScreenshot) : '';
  const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '');

  const act = async (action) => {
    const who = apt.patient?.name || 'the patient';
    const ask = action === 'mark_paid'
      ? `Mark ${who}'s appointment as PAID (Rs. ${amount || 0})? Only do this after the doctor confirms they received it.`
      : `Reset payment for ${who}? They'll see the QR and upload options again, and any screenshot/UTR is cleared.`;
    if (!window.confirm(ask)) return;
    setBusy(action);
    try {
      const body = action === 'mark_paid' ? { action, amount, note } : { action, note };
      const { data } = await adminAPI.paymentAction(apt._id, body);
      toast.success(data.message, { duration: 6000 });
      onDone && onDone();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update payment');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Payment help">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-800">💳 Payment help</h3>
            <p className="text-sm text-gray-600">
              {apt.patient?.name}{apt.patient?.patientId ? ` (${apt.patient.patientId})` : ''} → Dr. {apt.doctor?.name}
            </p>
            <p className="text-xs text-gray-500">{new Date(apt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, {apt.timeSlot}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label="Close">×</button>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-100 text-sm space-y-1">
          <p><span className="text-gray-500">Status:</span> <b>{STATUS_LABEL[pay] || pay}</b>{apt.paymentClaimedAt ? <span className="text-gray-500"> · since {when(apt.paymentClaimedAt)}</span> : null}</p>
          <p><span className="text-gray-500">UPI ref (UTR):</span> {apt.paymentUTR ? <span className="font-mono">{apt.paymentUTR}</span> : <span className="text-gray-400">none</span>}</p>
          <p><span className="text-gray-500">Screenshot:</span> {shot ? <button type="button" onClick={() => setZoom(true)} className="text-primary-600 hover:underline">View</button> : <span className="text-gray-400">none</span>}</p>
          {apt.paymentMarkedByRole && <p className="text-xs text-gray-500">Last changed by {apt.paymentMarkedByRole}{apt.paymentAdminNote ? `: "${apt.paymentAdminNote}"` : ''}</p>}
          {apt.patient?.phone && <p><span className="text-gray-500">Patient phone:</span> <a className="text-primary-600" href={`tel:${apt.patient.phone}`}>{apt.patient.phone}</a></p>}
          {apt.doctor?.phone && <p><span className="text-gray-500">Doctor phone:</span> <a className="text-primary-600" href={`tel:${apt.doctor.phone}`}>{apt.doctor.phone}</a></p>}
        </div>

        <label className="block mt-4 text-sm font-medium text-gray-700" htmlFor="pay-note">Note (who confirmed, why)</label>
        <input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
          placeholder="e.g. Doctor confirmed on call 6 Aug" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />

        {pay !== 'paid' && (
          <div className="mt-4 p-3 rounded-lg border border-green-200 bg-green-50">
            <label className="block text-sm font-medium text-green-900" htmlFor="pay-amount">Mark as paid (on the doctor's behalf)</label>
            <div className="flex gap-2 mt-1">
              <input id="pay-amount" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm" aria-label="Amount received (Rs.)" />
              <button type="button" disabled={!!busy} onClick={() => act('mark_paid')} className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-60">
                {busy === 'mark_paid' ? 'Saving…' : '✓ Mark paid'}
              </button>
            </div>
            <p className="text-[11px] text-green-800 mt-1">Only after the doctor confirms the money arrived.</p>
          </div>
        )}

        {pay !== 'pending' && (
          <div className="mt-3 p-3 rounded-lg border border-orange-200 bg-orange-50">
            <p className="text-sm font-medium text-orange-900">Reset to "not paid"</p>
            <p className="text-[11px] text-orange-800 mb-2">The patient sees the QR and upload options again. {pay === 'paid' ? 'A note is required for a paid appointment.' : ''}</p>
            <button type="button" disabled={!!busy} onClick={() => act('reset')} className="w-full px-3 py-2 bg-white border border-orange-300 text-orange-800 rounded-lg text-sm font-semibold hover:bg-orange-100 disabled:opacity-60">
              {busy === 'reset' ? 'Saving…' : '↩ Reset payment'}
            </button>
          </div>
        )}
      </div>

      {zoom && shot && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/80" onClick={() => setZoom(false)} aria-label="Close screenshot" />
          {/\.pdf($|\?)/i.test(shot) ? (
            <a href={shot} target="_blank" rel="noopener noreferrer" className="relative bg-white rounded-lg px-4 py-3 text-primary-600">Open PDF receipt</a>
          ) : (
            <img src={shot} alt="Payment screenshot" className="relative max-w-lg w-full max-h-[85vh] object-contain rounded-lg" />
          )}
        </div>
      )}
    </div>
  );
}
