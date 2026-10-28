// ============================================
// Admin → 🩺 Manage doctor — full profile control on the doctor's behalf
// ============================================
// For doctors who send their details to ProMedicoz and want the admin to run
// their profile. Tabs: Profile · Photo & QR · Hours & leave · Account ·
// Changes log. Also exports NewDoctorModal ("+ New doctor").
// Server rules + safeguards: server/controllers/adminDoctorController.js
// (same checks as the doctor's own form; every change logged; the doctor is
// told — fee/UPI/QR at once, the rest in a daily summary).
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { adminAPI, getUploadUrl } from '../../services/api';
import { formatDoctorName } from '../../utils/formatName';
import { SPOKEN_LANGUAGE_OPTIONS } from '../../utils/languages';
import { googleReviewLinkOk } from '../../utils/profileAutosave';

const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none';
// Same look without forcing full width (for fields on one row).
const inline = input.replace('w-full ', '');
const labelCls = 'block text-xs font-semibold text-gray-700 mb-1';
const msg = (e, fallback) => e?.response?.data?.message || fallback;
const tenDigits = (p) => String(p || '').replace(/\D/g, '').slice(-10);
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MODES = [{ key: 'in-person', label: '🏥 Clinic' }, { key: 'phone', label: '📞 Phone' }, { key: 'video', label: '📹 Video' }];
const todayIST = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

const PROFILE_FIELDS = [
  { key: 'name', label: 'Name *' },
  { key: 'specialization', label: 'Specialization', placeholder: 'e.g. Obstetrician and Gynaecologist' },
  { key: 'qualification', label: 'Qualification', placeholder: 'e.g. MBBS, MS' },
  { key: 'medicalRegistrationNo', label: 'Medical Registration No.', placeholder: 'NMC / State council no.' },
  { key: 'experience', label: 'Experience (years)', type: 'number' },
  { key: 'consultationFee', label: 'Fee (Rs.)', type: 'number', hint: 'Changing the fee tells the doctor at once.' },
  { key: 'city', label: 'City', placeholder: 'e.g. Bhilai' },
  { key: 'clinicAddress', label: 'Clinic address' },
  { key: 'googleMapsLink', label: 'Google Maps link', placeholder: 'https://maps.app.goo.gl/…' },
  { key: 'googleReviewLink', label: '⭐ Google review link', placeholder: 'https://g.page/r/…/review' },
];
const ACCOUNT_FIELDS = [
  { key: 'phone', label: 'Mobile (their login) *', type: 'tel' },
  { key: 'whatsappNumber', label: 'WhatsApp (public button — leave empty to hide)', type: 'tel' },
  { key: 'email', label: 'Email (optional)', type: 'email' },
  { key: 'upiId', label: 'UPI ID (patients pay this)', placeholder: 'e.g. drname@okicici', hint: 'Changing it tells the doctor at once.' },
];
const FIELD_LABEL = {
  name: 'name', specialization: 'specialization', qualification: 'qualification', medicalRegistrationNo: 'registration no.',
  experience: 'experience', consultationFee: 'fee', bio: 'bio', consultationModes: 'consult types', languagesSpoken: 'languages',
  city: 'city', clinicAddress: 'clinic address', googleMapsLink: 'Maps link', googleReviewLink: 'review link', phone: 'phone',
  whatsappNumber: 'WhatsApp', email: 'email', upiId: 'UPI ID', upiQrCode: 'UPI QR', profilePhoto: 'photo',
  availability: 'weekly hours', slotDuration: 'slot length', blockedDates: 'days off', 'account created': 'account created',
};

function pickForm(d) {
  return {
    name: d.name || '', specialization: d.specialization || '', qualification: d.qualification || '',
    medicalRegistrationNo: d.medicalRegistrationNo || '', experience: d.experience ?? '', consultationFee: d.consultationFee ?? '',
    bio: d.bio || '', consultationModes: d.consultationModes || [], languagesSpoken: d.languagesSpoken || [],
    city: d.city || '', clinicAddress: d.clinicAddress || '', googleMapsLink: d.googleMapsLink || '', googleReviewLink: d.googleReviewLink || '',
    phone: tenDigits(d.phone), whatsappNumber: tenDigits(d.whatsappNumber), email: d.email || '', upiId: d.upiId || '',
    managedByAdmin: Boolean(d.managedByAdmin),
  };
}
const same = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');

function Shell({ title, subtitle, onClose, busy, children, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/40" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-800 truncate">{title}</h3>
            {subtitle && <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} disabled={busy} className="text-gray-500 hover:text-gray-700 text-xl leading-none" aria-label="Close">✕</button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="p-3 sm:p-4 border-t border-gray-100 flex flex-wrap items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

function Field({ f, value, onChange, error }) {
  const id = `md-${f.key}`;
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{f.label}</label>
      <input id={id} type={f.type || 'text'} value={value} placeholder={f.placeholder || ''} onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? 'true' : undefined} className={`${input} ${error ? 'border-amber-400' : ''}`} />
      {error && <p className="text-xs text-amber-700 mt-1">{error}</p>}
      {f.hint && !error && <p className="text-[11px] text-gray-600 mt-1">{f.hint}</p>}
    </div>
  );
}

// ---------------- Photo & QR ----------------
function ImagesTab({ doctor, onSaved }) {
  const [busy, setBusy] = useState('');
  const refs = { profilePhoto: useRef(null), upiQrCode: useRef(null) };
  const upload = async (fieldName, file) => {
    if (!file) return;
    setBusy(fieldName);
    try {
      const { data } = await adminAPI.uploadDoctorImage(doctor._id, fieldName, file);
      toast.success(data.message);
      onSaved();
    } catch (e) {
      toast.error(msg(e, 'Upload failed. Please try another image.'));
    } finally {
      setBusy('');
      if (refs[fieldName].current) refs[fieldName].current.value = '';
    }
  };
  const box = (fieldName, title, url, note) => (
    <div className="rounded-xl border border-gray-200 p-4 flex flex-col items-center text-center">
      <p className="font-semibold text-gray-800 mb-3">{title}</p>
      {url ? (
        <img src={getUploadUrl(url, { width: 360 })} alt={title} className={fieldName === 'profilePhoto' ? 'w-32 h-32 rounded-full object-cover border' : 'w-44 h-44 object-contain border rounded-lg bg-white'} />
      ) : (
        <div className={`${fieldName === 'profilePhoto' ? 'w-32 h-32 rounded-full' : 'w-44 h-44 rounded-lg'} bg-gray-100 flex items-center justify-center text-gray-500 text-sm`}>Not added yet</div>
      )}
      <input ref={refs[fieldName]} type="file" accept="image/*" className="hidden" onChange={(e) => upload(fieldName, e.target.files?.[0])} />
      <button type="button" disabled={!!busy} onClick={() => refs[fieldName].current?.click()} className="mt-3 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
        {busy === fieldName ? 'Uploading…' : url ? 'Replace' : 'Upload'}
      </button>
      <p className="text-[11px] text-gray-600 mt-2">{note}</p>
    </div>
  );
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {box('profilePhoto', 'Profile photo', doctor.profilePhoto, 'Shown on their public page and in search.')}
      {box('upiQrCode', 'UPI QR code', doctor.upiQrCode, 'Shown to patients in the Pay box. Replacing it tells the doctor at once.')}
    </div>
  );
}

// ---------------- Hours & leave ----------------
function HoursTab({ doctor, onSaved }) {
  const [rows, setRows] = useState(() => (doctor.availability || []).map((a) => ({ day: a.day, startTime: a.startTime, endTime: a.endTime })));
  const [slot, setSlot] = useState(doctor.slotDuration || 30);
  const [leave, setLeave] = useState(() => (doctor.blockedDates || []).map((b) => ({ date: b.date, reason: b.reason || '' })));
  const [newLeave, setNewLeave] = useState({ date: '', reason: '' });
  const [busy, setBusy] = useState('');
  const setRow = (i, k, v) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const saveHours = async () => {
    setBusy('hours');
    try {
      const { data } = await adminAPI.updateDoctorAvailability(doctor._id, { availability: rows, slotDuration: Number(slot) });
      toast.success(data.message); onSaved();
    } catch (e) { toast.error(msg(e, 'Could not save hours')); } finally { setBusy(''); }
  };
  const saveLeave = async (list) => {
    setBusy('leave');
    try {
      const { data } = await adminAPI.setDoctorBlockedDates(doctor._id, list);
      setLeave(data.blockedDates || []);
      toast.success('Days off saved'); onSaved();
    } catch (e) { toast.error(msg(e, 'Could not save days off')); } finally { setBusy(''); }
  };
  return (
    <div className="space-y-6">
      <section>
        <h4 className="font-semibold text-gray-800 mb-2">Weekly hours</h4>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select aria-label="Day" value={r.day} onChange={(e) => setRow(i, 'day', e.target.value)} className={`${inline} w-36`}>
                {DAYS.map((d) => <option key={d}>{d}</option>)}
              </select>
              <input aria-label="From" type="time" value={r.startTime} onChange={(e) => setRow(i, 'startTime', e.target.value)} className={`${inline} w-32`} />
              <span className="text-gray-600 text-sm">to</span>
              <input aria-label="To" type="time" value={r.endTime} onChange={(e) => setRow(i, 'endTime', e.target.value)} className={`${inline} w-32`} />
              <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="text-red-600 text-sm hover:underline">Remove</button>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-gray-600">No hours yet — patients can't book until there are some.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button type="button" onClick={() => setRows((x) => [...x, { day: 'Monday', startTime: '10:00', endTime: '13:00' }])} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">+ Add session</button>
          <button type="button" onClick={() => {
            const first = rows[0] || { startTime: '10:00', endTime: '13:00' };
            setRows(DAYS.slice(0, 6).map((day) => ({ day, startTime: first.startTime, endTime: first.endTime })));
          }} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">Same hours Mon–Sat</button>
          <label className="text-sm text-gray-700 flex items-center gap-2">Slot length
            <select value={slot} onChange={(e) => setSlot(e.target.value)} className={`${inline} w-24`}>
              {[15, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </label>
          <button type="button" disabled={busy === 'hours'} onClick={saveHours} className="ml-auto px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-60">{busy === 'hours' ? 'Saving…' : 'Save hours'}</button>
        </div>
      </section>
      <section>
        <h4 className="font-semibold text-gray-800 mb-2">Days off / leave</h4>
        <ul className="space-y-1.5 mb-3">
          {leave.map((b) => (
            <li key={b.date} className="flex items-center justify-between gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
              <span>📅 {b.date}{b.reason ? ` · ${b.reason}` : ''}</span>
              <button type="button" disabled={!!busy} onClick={() => saveLeave(leave.filter((x) => x.date !== b.date))} className="text-red-600 hover:underline">Remove</button>
            </li>
          ))}
          {leave.length === 0 && <li className="text-sm text-gray-600">No days off planned.</li>}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Leave date" type="date" min={todayIST()} value={newLeave.date} onChange={(e) => setNewLeave((x) => ({ ...x, date: e.target.value }))} className={`${inline} w-44`} />
          <input aria-label="Reason" placeholder="Reason (optional)" value={newLeave.reason} onChange={(e) => setNewLeave((x) => ({ ...x, reason: e.target.value }))} className={`${inline} flex-1 min-w-[10rem]`} />
          <button type="button" disabled={!newLeave.date || !!busy} onClick={() => { saveLeave([...leave, newLeave]); setNewLeave({ date: '', reason: '' }); }} className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-60">Add day off</button>
        </div>
        <p className="text-[11px] text-gray-600 mt-2">Patients can't book on these days. Already-booked visits are not cancelled automatically.</p>
      </section>
    </div>
  );
}

// ---------------- Changes log ----------------
function LogTab({ doctor }) {
  const items = doctor.adminEdits || [];
  if (!items.length) return <p className="text-sm text-gray-600">No admin changes yet.</p>;
  return (
    <ul className="divide-y divide-gray-100 text-sm">
      {items.map((e, i) => (
        <li key={i} className="py-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-gray-800">{(e.fields || []).map((f) => FIELD_LABEL[f] || f).join(', ')}</span>
          <span className="text-xs text-gray-600">
            {new Date(e.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
            {e.by?.name ? ` · ${e.by.name}` : ''} · {e.notified ? 'doctor told' : 'in tonight\'s summary'}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------------- Main window ----------------
export default function ManageDoctor({ doctorId, onClose, onChanged }) {
  const [doctor, setDoctor] = useState(null);
  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const load = async () => {
    try {
      const { data } = await adminAPI.getDoctorForManage(doctorId);
      setDoctor(data.doctor);
      setForm((f) => f || pickForm(data.doctor));
      setLoadErr('');
    } catch (e) { setLoadErr(msg(e, 'Could not load this doctor')); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [doctorId]);
  const original = useMemo(() => (doctor ? pickForm(doctor) : null), [doctor]);
  const changes = useMemo(() => {
    if (!form || !original) return {};
    const out = {};
    for (const k of Object.keys(form)) if (!same(form[k], original[k])) out[k] = form[k];
    return out;
  }, [form, original]);
  const errors = useMemo(() => {
    const e = {};
    if (!form) return e;
    if (!form.name.trim()) e.name = 'Name is needed.';
    if (form.phone && !/^[6-9]\d{9}$/.test(form.phone)) e.phone = '10-digit Indian mobile, starting 6-9.';
    if (!form.phone) e.phone = 'Mobile is needed (their login).';
    if (form.whatsappNumber && !/^[6-9]\d{9}$/.test(form.whatsappNumber)) e.whatsappNumber = '10-digit mobile, or leave empty.';
    if (form.googleReviewLink && !googleReviewLinkOk(form.googleReviewLink)) e.googleReviewLink = 'Paste the link from Google Business → "Ask for reviews".';
    if (form.consultationFee !== '' && (Number(form.consultationFee) < 0 || Number(form.consultationFee) > 100000)) e.consultationFee = '0 – 100000';
    if (form.experience !== '' && (Number(form.experience) < 0 || Number(form.experience) > 70)) e.experience = '0 – 70 years';
    return e;
  }, [form]);
  const dirty = Object.keys(changes).length > 0;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (Object.keys(errors).some((k) => k in changes || k === 'name' || k === 'phone')) { toast.error('Please fix the highlighted fields'); return; }
    setSaving(true);
    try {
      const payload = { ...changes };
      for (const k of ['experience', 'consultationFee']) if (payload[k] === '') payload[k] = null; else if (k in payload) payload[k] = Number(payload[k]);
      const { data } = await adminAPI.updateDoctorAsAdmin(doctorId, payload);
      toast.success(data.message);
      setForm(null); // reload from the server's saved values
      await load();
      onChanged && onChanged();
    } catch (e) { toast.error(msg(e, 'Could not save')); } finally { setSaving(false); }
  };
  const close = () => {
    if (dirty && !window.confirm('You have unsaved changes. Close anyway?')) return;
    onClose();
  };

  if (loadErr) return <Shell title="Manage doctor" onClose={onClose}><p className="text-sm text-red-700">{loadErr}</p></Shell>;
  if (!doctor || !form) return <Shell title="Manage doctor" onClose={onClose}><p className="text-sm text-gray-600" role="status">Loading…</p></Shell>;

  const tabs = [['profile', 'Profile'], ['images', 'Photo & QR'], ['hours', 'Hours & leave'], ['account', 'Account'], ['log', `Changes log (${(doctor.adminEdits || []).length})`]];
  const formTab = tab === 'profile' || tab === 'account';
  return (
    <Shell
      title={`🩺 Manage ${formatDoctorName(doctor.name)}`}
      subtitle={`${doctor.specialization || 'Doctor'}${doctor.city ? ` · ${doctor.city}` : ''}${doctor.managedByAdmin ? ' · 🛠 Managed by admin' : ''}${doctor.slug ? ` · promedicoz.in/dr/${doctor.slug}` : ''}`}
      onClose={close}
      busy={saving}
      footer={formTab ? (
        <>
          <span className="text-xs text-gray-600 mr-auto">{dirty ? `${Object.keys(changes).length} unsaved change${Object.keys(changes).length === 1 ? '' : 's'}` : 'All saved'} · same checks as the doctor's own form · logged</span>
          <button type="button" onClick={() => setForm(pickForm(doctor))} disabled={!dirty || saving} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50">Undo</button>
          <button type="button" onClick={save} disabled={!dirty || saving} className="px-5 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
        </>
      ) : null}
    >
      <div className="flex flex-wrap gap-1.5 mb-4" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === k ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{l}</button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {PROFILE_FIELDS.map((f) => <Field key={f.key} f={f} value={form[f.key]} onChange={(v) => set(f.key, v)} error={changes[f.key] !== undefined || f.key === 'name' ? errors[f.key] : ''} />)}
          </div>
          <div>
            <span className={labelCls}>Consultation types</span>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => {
                const on = form.consultationModes.includes(m.key);
                return (
                  <button key={m.key} type="button" aria-pressed={on} onClick={() => set('consultationModes', on ? form.consultationModes.filter((x) => x !== m.key) : [...form.consultationModes, m.key])}
                    className={`px-3 py-1.5 rounded-full text-sm border ${on ? 'bg-green-50 border-green-500 text-green-800 font-semibold' : 'bg-white border-gray-300 text-gray-700'}`}>{on ? '✓ ' : ''}{m.label}</button>
                );
              })}
            </div>
          </div>
          <div>
            <span className={labelCls}>Languages they consult in</span>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {SPOKEN_LANGUAGE_OPTIONS.map((o) => {
                const on = form.languagesSpoken.includes(o.value);
                return (
                  <button key={o.value} type="button" aria-pressed={on} onClick={() => set('languagesSpoken', on ? form.languagesSpoken.filter((x) => x !== o.value) : [...form.languagesSpoken, o.value])}
                    className={`px-2.5 py-1 rounded-full text-xs border ${on ? 'bg-primary-50 border-primary-500 text-primary-800 font-semibold' : 'bg-white border-gray-300 text-gray-700'}`}>{o.label}</button>
                );
              })}
            </div>
          </div>
          <div>
            <label htmlFor="md-bio" className={labelCls}>Bio (3–4 lines on what they treat helps Google + patients)</label>
            <textarea id="md-bio" rows={4} value={form.bio} onChange={(e) => set('bio', e.target.value)} className={input} />
          </div>
        </div>
      )}

      {tab === 'images' && <ImagesTab doctor={doctor} onSaved={() => { load(); onChanged && onChanged(); }} />}
      {tab === 'hours' && <HoursTab doctor={doctor} onSaved={() => { load(); onChanged && onChanged(); }} />}

      {tab === 'account' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {ACCOUNT_FIELDS.map((f) => <Field key={f.key} f={f} value={form[f.key]} onChange={(v) => set(f.key, f.type === 'tel' ? tenDigits(v) : v)} error={changes[f.key] !== undefined || f.key === 'phone' ? errors[f.key] : ''} />)}
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input type="checkbox" className="mt-0.5" checked={form.managedByAdmin} onChange={(e) => set('managedByAdmin', e.target.checked)} />
            <span>🛠 This doctor asked ProMedicoz to manage their profile{doctor.managedConsentAt ? ` (since ${new Date(doctor.managedConsentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})` : ''}</span>
          </label>
          <p className="text-xs text-gray-600">To let the doctor log in themselves: close this window → their row → <strong>Send Password Reset</strong> (emails it, or copies a link to send on WhatsApp). The doctor can always edit everything themselves too.</p>
        </div>
      )}

      {tab === 'log' && <LogTab doctor={doctor} />}
    </Shell>
  );
}

// ---------------- + New doctor ----------------
export function NewDoctorModal({ onClose, onCreated }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', specialization: '', city: '', consentConfirmed: false });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const ok = f.name.trim() && /^[6-9]\d{9}$/.test(f.phone) && f.consentConfirmed;
  const create = async () => {
    setBusy(true);
    try {
      const { data } = await adminAPI.createDoctor({ ...f, email: f.email.trim() || undefined });
      toast.success(data.message);
      onCreated(data.doctor._id);
    } catch (e) { toast.error(msg(e, 'Could not create the doctor')); } finally { setBusy(false); }
  };
  return (
    <Shell title="＋ New doctor" subtitle="Set up a profile for a doctor who sent you their details" onClose={onClose} busy={busy}
      footer={(<>
        <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">Cancel</button>
        <button type="button" onClick={create} disabled={!ok || busy} className="px-5 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">{busy ? 'Creating…' : 'Create & open Manage doctor'}</button>
      </>)}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field f={{ key: 'name', label: 'Name *', placeholder: 'e.g. Pooja Singh' }} value={f.name} onChange={(v) => set('name', v)} />
        <Field f={{ key: 'phone', label: 'Mobile * (their login)', type: 'tel' }} value={f.phone} onChange={(v) => set('phone', tenDigits(v))} error={f.phone && !/^[6-9]\d{9}$/.test(f.phone) ? '10-digit Indian mobile, starting 6-9.' : ''} />
        <Field f={{ key: 'email', label: 'Email (optional)', type: 'email' }} value={f.email} onChange={(v) => set('email', v)} />
        <Field f={{ key: 'specialization', label: 'Specialization', placeholder: 'e.g. Gynaecologist' }} value={f.specialization} onChange={(v) => set('specialization', v)} />
        <Field f={{ key: 'city', label: 'City', placeholder: 'e.g. Bhilai' }} value={f.city} onChange={(v) => set('city', v)} />
      </div>
      <label className="flex items-start gap-2 text-sm text-gray-800 mt-4">
        <input type="checkbox" className="mt-0.5" checked={f.consentConfirmed} onChange={(e) => set('consentConfirmed', e.target.checked)} />
        <span>The doctor asked ProMedicoz (on a call or WhatsApp) to set up and manage this profile.</span>
      </label>
      <p className="text-xs text-gray-600 mt-3">You won't type a password. When the doctor wants to log in, use <strong>Send Password Reset</strong> on their row. After creating, fill in photo, QR code, fee and hours, then press <strong>Verify</strong> so patients can find them.</p>
    </Shell>
  );
}
