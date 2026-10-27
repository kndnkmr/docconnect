// ============================================
// Admin "Help patient" — edit details, family, and book on their behalf
// ============================================
// Opened from the Admin Panel (Users → Manage → 🤝 Help patient, or the
// patient detail window). Also exports NewPatientModal ("+ New patient").
// Server rules + safeguards: server/controllers/adminPatientController.js.
// Booking uses the same server-side rules as a patient's own booking.

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminAPI, doctorAPI, availabilityAPI } from '../../services/api';
import { formatDoctorName } from '../../utils/formatName';
import { offeredModes, pickMode } from '../../utils/consultModes';

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const RELATIONSHIPS = ['parent', 'spouse', 'child', 'sibling', 'other'];
const MODES = [
  { key: 'phone', label: '📞 Phone' },
  { key: 'video', label: '📹 Video' },
  { key: 'in-person', label: '🏥 Clinic' },
];
const DETAIL_FIELDS = ['name', 'phone', 'email', 'bloodGroup', 'allergies', 'currentMedications', 'medicalHistory', 'emergencyContactName', 'emergencyContactPhone', 'insuranceProvider', 'insurancePolicyNumber'];

const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none';
const label = 'block text-xs font-semibold text-gray-700 mb-1';
const tenDigits = (p) => String(p || '').replace(/\D/g, '').slice(-10);
const todayIST = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const waLink = (phone, text) => `https://wa.me/91${tenDigits(phone)}?text=${encodeURIComponent(text)}`;
const msg = (e, fallback) => e?.response?.data?.message || fallback;

function Shell({ title, subtitle, onClose, busy, children, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-800 truncate">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} disabled={busy} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">✕</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="p-4 border-t border-gray-100 flex flex-wrap items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------- Tab 1: Details ----------------
function DetailsTab({ patient, onSaved }) {
  const pick = (u) => Object.fromEntries(DETAIL_FIELDS.map((f) => [f, f === 'phone' || f === 'emergencyContactPhone' ? tenDigits(u[f]) : (u[f] || '')]));
  const [form, setForm] = useState(() => pick(patient));
  const [saving, setSaving] = useState(false);
  const [showInsurance, setShowInsurance] = useState(Boolean(patient.insuranceProvider || patient.insurancePolicyNumber));
  const original = pick(patient);
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: f.toLowerCase().includes('phone') ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value }));
  const changed = DETAIL_FIELDS.filter((f) => String(form[f]).trim() !== String(original[f]).trim());

  const save = async () => {
    if (!changed.length) { toast('No changes made.', { icon: 'ℹ️' }); return; }
    if (form.phone.length !== 10) { toast.error('Mobile number must be 10 digits.'); return; }
    setSaving(true);
    try {
      const payload = Object.fromEntries(changed.map((f) => [f, String(form[f]).trim()]));
      const { data } = await adminAPI.updatePatient(patient._id, payload);
      toast.success(data.message);
      onSaved(data.user);
    } catch (e) {
      toast.error(msg(e, 'Could not save details'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Account</p>
      <div>
        <label className={label} htmlFor="hp-name">Name</label>
        <input id="hp-name" className={input} value={form.name} onChange={set('name')} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="hp-phone">Mobile (login) <span className="text-red-500">*</span></label>
          <input id="hp-phone" inputMode="numeric" className={`${input} ${!original.phone ? 'border-amber-400 bg-amber-50' : ''}`} value={form.phone} onChange={set('phone')} placeholder="10 digits" />
          {!original.phone && <p className="text-[11px] text-amber-700 mt-1">⚠ No mobile on file — they can't log in by phone until it's added.</p>}
        </div>
        <div>
          <label className={label} htmlFor="hp-email">Email (optional)</label>
          <input id="hp-email" type="email" className={input} value={form.email} onChange={set('email')} placeholder="leave empty if none" />
        </div>
      </div>

      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 pt-2">Medical info (shown to doctors)</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={label} htmlFor="hp-blood">Blood group</label>
          <select id="hp-blood" className={input} value={form.bloodGroup} onChange={set('bloodGroup')}>
            {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b || '—'}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="hp-allergies">Allergies</label>
          <input id="hp-allergies" className={input} value={form.allergies} onChange={set('allergies')} placeholder="e.g. Penicillin" />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="hp-meds">Current medicines</label>
        <input id="hp-meds" className={input} value={form.currentMedications} onChange={set('currentMedications')} />
      </div>
      <div>
        <label className={label} htmlFor="hp-history">Medical history</label>
        <input id="hp-history" className={input} value={form.medicalHistory} onChange={set('medicalHistory')} placeholder="e.g. Thyroid, BP" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="hp-ecn">Emergency contact</label>
          <input id="hp-ecn" className={input} value={form.emergencyContactName} onChange={set('emergencyContactName')} placeholder="Name (relation)" />
        </div>
        <div>
          <label className={label} htmlFor="hp-ecp">Emergency phone</label>
          <input id="hp-ecp" inputMode="numeric" className={input} value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} placeholder="10 digits" />
        </div>
      </div>
      {showInsurance ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="hp-ins">Insurance provider</label>
            <input id="hp-ins" className={input} value={form.insuranceProvider} onChange={set('insuranceProvider')} />
          </div>
          <div>
            <label className={label} htmlFor="hp-pol">Policy number</label>
            <input id="hp-pol" className={input} value={form.insurancePolicyNumber} onChange={set('insurancePolicyNumber')} />
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowInsurance(true)} className="text-xs font-medium text-primary-600">+ Insurance</button>
      )}

      <p className="text-[11px] text-sky-800 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
        Only changed fields are saved. Each save is logged on the account (which admin, when, which fields).
      </p>
      <div className="flex justify-end">
        <button onClick={save} disabled={saving || !changed.length} className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Saving…' : changed.length ? `Save ${changed.length} change${changed.length === 1 ? '' : 's'}` : 'No changes'}
        </button>
      </div>
    </div>
  );
}

// ---------------- Tab 2: Family ----------------
function FamilyTab({ patient, onChanged }) {
  const empty = { name: '', relationship: 'parent', gender: 'female', age: '', phone: '' };
  const [editing, setEditing] = useState(null); // null | 'new' | memberId
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const members = patient.familyMembers || [];

  const startEdit = (m) => {
    setEditing(m ? m._id : 'new');
    setForm(m ? { name: m.name, relationship: m.relationship, gender: m.gender || 'other', age: m.age ?? '', phone: tenDigits(m.phone) } : empty);
  };
  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    setBusy(true);
    const body = { ...form, name: form.name.trim(), age: form.age === '' ? null : Number(form.age) };
    try {
      const { data } = editing === 'new'
        ? await adminAPI.addPatientFamily(patient._id, body)
        : await adminAPI.updatePatientFamily(patient._id, editing, body);
      toast.success(data.message);
      onChanged(data.familyMembers);
      setEditing(null);
    } catch (e) {
      toast.error(msg(e, 'Could not save family member'));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (m) => {
    if (!window.confirm(`Remove ${m.name} from ${patient.name}'s family members? Past appointments for them are kept.`)) return;
    setBusy(true);
    try {
      const { data } = await adminAPI.deletePatientFamily(patient._id, m._id);
      toast.success(data.message);
      onChanged(data.familyMembers);
    } catch (e) {
      toast.error(msg(e, 'Could not remove family member'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {members.length === 0 && editing === null && <p className="text-sm text-gray-500">No family members yet.</p>}
      {members.map((m) => (editing === m._id ? null : (
        <div key={m._id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2">
          <div className="min-w-0 text-sm">
            <span className="font-semibold text-gray-800">{m.name}</span>
            <span className="text-gray-500"> · {m.relationship}{m.gender && m.gender !== 'other' ? ` · ${m.gender}` : ''}{m.age != null ? ` · ${m.age} yrs` : ''}{m.phone ? ` · ${m.phone}` : ''}</span>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button onClick={() => startEdit(m)} disabled={busy} className="text-xs font-medium text-primary-600">Edit</button>
            <button onClick={() => remove(m)} disabled={busy} className="text-xs font-medium text-red-600">Remove</button>
          </div>
        </div>
      )))}

      {editing !== null ? (
        <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="fm-name">Name</label>
              <input id="fm-name" className={input} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Mummy" />
            </div>
            <div>
              <label className={label} htmlFor="fm-rel">Relationship</label>
              <select id="fm-rel" className={input} value={form.relationship} onChange={(e) => setForm((p) => ({ ...p, relationship: e.target.value }))}>
                {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label} htmlFor="fm-gender">Gender</label>
              <select id="fm-gender" className={input} value={form.gender} onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}>
                <option value="female">female</option><option value="male">male</option><option value="other">other</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="fm-age">Age</label>
              <input id="fm-age" inputMode="numeric" className={input} value={form.age} onChange={(e) => setForm((p) => ({ ...p, age: e.target.value.replace(/\D/g, '').slice(0, 3) }))} />
            </div>
            <div>
              <label className={label} htmlFor="fm-phone">Phone</label>
              <input id="fm-phone" inputMode="numeric" className={input} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="optional" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(null)} disabled={busy} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
            <button onClick={save} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      ) : (
        members.length < 10 && <button onClick={() => startEdit(null)} className="w-full py-2 rounded-lg border-2 border-dashed border-primary-300 text-primary-700 text-sm font-semibold hover:bg-primary-50">＋ Add family member</button>
      )}
    </div>
  );
}

// ---------------- Tab 3: Book ----------------
function BookTab({ patient, onBooked }) {
  const [forWho, setForWho] = useState('self');
  const [search, setSearch] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [doctor, setDoctor] = useState(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotsMsg, setSlotsMsg] = useState('');
  const [slot, setSlot] = useState('');
  const [mode, setMode] = useState('phone');
  const [reason, setReason] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const members = patient.familyMembers || [];

  // Doctor search (debounced).
  useEffect(() => {
    if (doctor) return undefined;
    const t = setTimeout(async () => {
      try {
        const { data } = await doctorAPI.getAll({ name: search.trim() || undefined, limit: 8 });
        setDoctors(data.doctors || []);
      } catch { setDoctors([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [search, doctor]);

  // Only the consultation types this doctor offers (server enforces it too).
  useEffect(() => {
    if (doctor) setMode((m) => pickMode(m, doctor.consultationModes).mode);
  }, [doctor]);
  const doctorModes = offeredModes(doctor?.consultationModes);

  // Live free slots for the chosen doctor + date (same API patients use).
  useEffect(() => {
    setSlot(''); setSlots([]); setSlotsMsg('');
    if (!doctor || !date) return;
    let cancelled = false;
    availabilityAPI.getFreeSlots(doctor._id, date)
      .then(({ data }) => {
        if (cancelled) return;
        setSlots(data.slots || []);
        setSlotsMsg((data.slots || []).length ? '' : (data.message || `No free slots on ${data.dayOfWeek || 'this day'}. Try another date.`));
      })
      .catch(() => !cancelled && setSlotsMsg('Could not load slots. The doctor may not have set a schedule.'));
    return () => { cancelled = true; };
  }, [doctor, date]);

  const forName = forWho === 'self' ? patient.name : forWho;
  const canBook = doctor && date && slot && reason.trim() && consent && !busy;

  const book = async () => {
    setBusy(true);
    try {
      const { data } = await adminAPI.bookForPatient(patient._id, {
        doctorId: doctor._id, date, timeSlot: slot, reason: reason.trim(), consultationType: mode,
        bookedFor: forWho === 'self' ? 'self' : 'family', familyMemberName: forWho === 'self' ? '' : forWho,
        consentConfirmed: true,
      });
      toast.success('Booked.');
      setDone({ ...data, doctorName: formatDoctorName(doctor.name), forName });
      onBooked();
    } catch (e) {
      toast.error(msg(e, 'Could not book'));
      if (/slot/i.test(msg(e, ''))) { const d = date; setDate(''); setTimeout(() => setDate(d), 0); } // refresh slots
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const text = `Namaste ${patient.name}, ProMedicoz se: ${done.forName === patient.name ? 'aapki' : `${done.forName} ki`} appointment ${done.doctorName} ke saath ${done.when} ke liye book ho gayi hai. Doctor jaldi confirm karenge. Aap apne ProMedicoz account mein dekh sakte hain: https://www.promedicoz.in/dashboard`;
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-green-50 border border-green-200 p-4">
          <p className="font-bold text-green-900">✓ {done.message}</p>
          <p className="text-sm text-green-800 mt-1">The patient got an app notification (if enabled). The doctor got the usual booking email, and the appointment is tagged "Booked by ProMedicoz support".</p>
        </div>
        {patient.phone ? (
          <a href={waLink(patient.phone, text)} target="_blank" rel="noopener noreferrer" className="block w-full text-center py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700">💬 Tell {patient.name} on WhatsApp</a>
        ) : <p className="text-xs text-amber-700">Add a mobile number in Details to message the patient on WhatsApp.</p>}
        <button onClick={() => { setDone(null); setSlot(''); setReason(''); setConsent(false); }} className="w-full py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">Book another</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className={label}>For</p>
        <div className="flex flex-wrap gap-2">
          {[{ key: 'self', text: `${patient.name} (self)` }, ...members.map((m) => ({ key: m.name, text: `${m.name} · ${m.relationship}` }))].map((o) => (
            <button key={o.key} type="button" onClick={() => setForWho(o.key)} aria-pressed={forWho === o.key}
              className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${forWho === o.key ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
              {o.text}
            </button>
          ))}
        </div>
        {members.length === 0 && <p className="text-[11px] text-gray-500 mt-1">Booking for a relative? Add them in the Family tab first.</p>}
      </div>

      <div>
        <label className={label} htmlFor="bk-doc">Doctor</label>
        {doctor ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2">
            <div className="text-sm"><span className="font-semibold text-primary-900">{formatDoctorName(doctor.name)}</span><span className="text-primary-800"> · {doctor.specialization || 'Doctor'}{doctor.consultationFee ? ` · Rs. ${doctor.consultationFee}` : ''}</span></div>
            <button onClick={() => { setDoctor(null); setDate(''); }} className="text-xs font-medium text-primary-700">Change</button>
          </div>
        ) : (
          <>
            <input id="bk-doc" className={input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search doctor by name" />
            <ul className="mt-2 max-h-44 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-100">
              {doctors.map((d) => (
                <li key={d._id}>
                  <button onClick={() => setDoctor(d)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                    <span className="font-medium text-gray-800">{formatDoctorName(d.name)}</span>
                    <span className="text-gray-500"> · {d.specialization || 'Doctor'}{d.city ? ` · ${d.city}` : ''}{d.consultationFee ? ` · Rs. ${d.consultationFee}` : ''}</span>
                  </button>
                </li>
              ))}
              {doctors.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">No doctors found.</li>}
            </ul>
          </>
        )}
      </div>

      {doctor && (
        <>
          <div>
            <label className={label} htmlFor="bk-date">Date</label>
            <input id="bk-date" type="date" min={todayIST()} className={`${input} max-w-[200px]`} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {date && (
            <div>
              <p className={label}>Free slots (live)</p>
              {slotsMsg ? <p className="text-sm text-amber-700">{slotsMsg}</p> : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <button key={s} type="button" onClick={() => setSlot(s)} aria-pressed={slot === s}
                      className={`px-3 py-1.5 rounded-lg border text-sm ${slot === s ? 'border-primary-600 bg-primary-600 text-white font-semibold' : 'border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100'}`}>
                      {s.split(' - ')[0]}
                    </button>
                  ))}
                  {!slots.length && <span className="text-sm text-gray-400">Loading…</span>}
                </div>
              )}
            </div>
          )}
          <div>
            <p className={label}>Mode{doctorModes.length === 1 ? ' (the only one this doctor offers)' : ''}</p>
            <div className="flex flex-wrap gap-2">
              {MODES.filter((m) => doctorModes.includes(m.key)).map((m) => (
                <button key={m.key} type="button" onClick={() => setMode(m.key)} aria-pressed={mode === m.key}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${mode === m.key ? 'border-primary-600 bg-primary-600 text-white font-semibold' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={label} htmlFor="bk-reason">Reason (the patient's words)</label>
            <textarea id="bk-reason" rows={2} className={`${input} resize-none`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Thyroid follow-up, tiredness" />
          </div>
          <label className="flex items-start gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-amber-600" />
            <span className="text-sm text-amber-900">
              <span className="font-semibold">{forName === patient.name ? patient.name : `${patient.name} (for ${forName})`} agreed on a call/WhatsApp to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">Terms</a> and teleconsultation consent.</span>
              <span className="block text-[11px] text-amber-800 mt-0.5">Recorded as "consent taken by admin" with the time.</span>
            </span>
          </label>
          <button onClick={book} disabled={!canBook} className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50">
            {busy ? 'Booking…' : `Book for ${forName}`}
          </button>
          <p className="text-[11px] text-gray-500 text-center">Same checks as a patient booking (free slot, date, doctor's day off).</p>
        </>
      )}
    </div>
  );
}

// ---------------- The window ----------------
export default function HelpPatient({ patientId, initialTab = 'details', onClose, onChanged }) {
  const [patient, setPatient] = useState(null);
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    let cancelled = false;
    adminAPI.getUser(patientId)
      .then(({ data }) => { if (!cancelled) setPatient(data.user); })
      .catch((e) => { toast.error(msg(e, 'Could not load the patient')); onClose(); });
    return () => { cancelled = true; };
  }, [patientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const TABS = [['details', '1 Details'], ['family', '2 Family'], ['book', '3 Book']];
  return (
    <Shell
      title={`🤝 Help patient${patient ? ` · ${patient.name}` : ''}`}
      subtitle={patient ? [patient.patientId, patient.phone || 'no mobile', patient.lastLoginAt ? `last login ${new Date(patient.lastLoginAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'never logged in'].filter(Boolean).join(' · ') : 'Loading…'}
      onClose={onClose}
    >
      {!patient ? <p className="text-sm text-gray-500">Loading…</p> : (
        <>
          <div className="flex gap-2 mb-5" role="tablist">
            {TABS.map(([k, t]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold ${tab === k ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {t}
              </button>
            ))}
          </div>
          {tab === 'details' && <DetailsTab key={patient.updatedAt || 'd'} patient={patient} onSaved={(u) => { setPatient((p) => ({ ...p, ...u })); onChanged?.(); }} />}
          {tab === 'family' && <FamilyTab patient={patient} onChanged={(fm) => { setPatient((p) => ({ ...p, familyMembers: fm })); onChanged?.(); }} />}
          {tab === 'book' && <BookTab patient={patient} onBooked={() => onChanged?.()} />}
        </>
      )}
    </Shell>
  );
}

// ---------------- + New patient ----------------
export function NewPatientModal({ onClose, onCreated, onOpenExisting }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [existingId, setExistingId] = useState(null);

  const create = async () => {
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    if (form.phone.length !== 10) { toast.error('Mobile number must be 10 digits.'); return; }
    setBusy(true); setExistingId(null);
    try {
      const { data } = await adminAPI.createPatient({ name: form.name.trim(), phone: form.phone, email: form.email.trim(), consentConfirmed: true });
      toast.success(data.message);
      setDone(data);
      onCreated?.();
    } catch (e) {
      toast.error(msg(e, 'Could not create the account'));
      if (e?.response?.data?.existingUserId) setExistingId(e.response.data.existingUserId);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const text = `Namaste ${done.user.name}, aapka ProMedicoz account ban gaya hai (Patient ID ${done.user.patientId}). Login ke liye aapka mobile number ${tenDigits(done.user.phone)} hai. Is link se apna password set karein (${done.expiresInHours} ghante tak valid): ${done.setPasswordUrl}`;
    return (
      <Shell title="✓ Patient account created" subtitle={`${done.user.name} · ${done.user.patientId}`} onClose={onClose}
        footer={<>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Close</button>
          <button onClick={() => onCreated?.(done.user, 'book')} className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700">Continue to Book →</button>
        </>}>
        <div className="space-y-3">
          <p className="text-sm text-gray-700">The patient logs in with their mobile number. Nobody has their password yet — send them this link to set one ({done.expiresInHours} hours){done.emailed ? '. It was also emailed to them.' : '.'}</p>
          <a href={waLink(done.user.phone, text)} target="_blank" rel="noopener noreferrer" className="block w-full text-center py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700">💬 Send set-password link on WhatsApp</a>
          <button onClick={() => { navigator.clipboard?.writeText(done.setPasswordUrl); toast.success('Link copied'); }} className="w-full py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Copy link</button>
          <p className="text-[11px] text-gray-500">Expired? Use "Send Password Reset" on their row anytime.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="+ New patient" subtitle="For someone who can't register themselves" onClose={onClose} busy={busy}
      footer={<>
        <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
        <button onClick={create} disabled={busy || !consent} className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">{busy ? 'Creating…' : 'Create account'}</button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={label} htmlFor="np-name">Name <span className="text-red-500">*</span></label>
          <input id="np-name" className={input} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label className={label} htmlFor="np-phone">Mobile (login) <span className="text-red-500">*</span></label>
          <input id="np-phone" inputMode="numeric" className={input} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10 digits" />
          {existingId && (
            <button onClick={() => onOpenExisting?.(existingId)} className="mt-1 text-xs font-semibold text-primary-700 underline">This number already has an account — open it in Help patient →</button>
          )}
        </div>
        <div>
          <label className={label} htmlFor="np-email">Email (optional)</label>
          <input id="np-email" type="email" className={input} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
        </div>
        <label className="flex items-start gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 cursor-pointer">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-amber-600" />
          <span className="text-sm text-amber-900 font-semibold">
            The patient asked us to create the account and agreed on a call/WhatsApp to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">Terms</a> &amp; <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>.
          </span>
        </label>
        <p className="text-[11px] text-gray-500">No password is set by you. The patient gets a link to set their own.</p>
      </div>
    </Shell>
  );
}
