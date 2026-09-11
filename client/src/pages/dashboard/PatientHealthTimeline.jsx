import { useState, useEffect } from 'react';
import { appointmentAPI, prescriptionAPI, reportAPI } from '../../services/api';
import { getSocket } from '../../services/socket';

// ============================================
// Patient Health Timeline — "My Health History"
// ============================================
// A single chronological view that pulls together everything already stored
// about a patient — their consultations, the prescriptions doctors wrote, and
// the medical reports they uploaded — into one date-ordered story of their
// health on ProMedicoz.
//
// Design notes:
// - PURELY client-side aggregation. It reuses the three existing "get mine"
//   endpoints (appointments, prescriptions, reports) and merges them locally.
//   No new backend endpoint, no schema change — so it can't break anything
//   the rest of the app depends on.
// - Read-only. It never mutates data; it just presents what already exists.
// - Groups entries by month so a long history stays scannable, and offers a
//   simple type filter (All / Consultations / Prescriptions / Reports).

const TYPE_META = {
  appointment: { icon: '🩺', label: 'Consultation', accent: 'border-primary-400', chip: 'bg-primary-50 text-primary-700' },
  prescription: { icon: '💊', label: 'Prescription', accent: 'border-purple-400', chip: 'bg-purple-50 text-purple-700' },
  report: { icon: '📋', label: 'Report', accent: 'border-green-400', chip: 'bg-green-50 text-green-700' },
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'appointment', label: 'Consultations' },
  { value: 'prescription', label: 'Prescriptions' },
  { value: 'report', label: 'Reports' },
];

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// "August 2026" grouping key + label from a date.
function monthKey(dateString) {
  const d = new Date(dateString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

const STATUS_CHIP = {
  completed: 'bg-green-100 text-green-700',
  confirmed: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function PatientHealthTimeline({ onNavigateTab }) {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]); // merged, sorted timeline entries

  const fetchAll = async () => {
    try {
      // Pull generously so the timeline reflects real history, not just the
      // first page. These are the same endpoints the individual tabs use.
      const [aptRes, rxRes, repRes] = await Promise.all([
        appointmentAPI.getMine({ limit: 100 }),
        prescriptionAPI.getMine({ limit: 100 }),
        reportAPI.getMine(),
      ]);

      const entries = [];

      (aptRes.data.appointments || []).forEach((apt) => {
        entries.push({
          id: `apt-${apt._id}`,
          type: 'appointment',
          date: apt.date,
          data: apt,
        });
      });

      (rxRes.data.prescriptions || []).forEach((rx) => {
        entries.push({
          id: `rx-${rx._id}`,
          type: 'prescription',
          // Prescriptions are dated by when the doctor wrote them.
          date: rx.createdAt,
          data: rx,
        });
      });

      (repRes.data.reports || []).forEach((rep) => {
        entries.push({
          id: `rep-${rep._id}`,
          type: 'report',
          date: rep.createdAt,
          data: rep,
        });
      });

      // Newest first — a health history reads most naturally from "most
      // recent" downward.
      entries.sort((a, b) => new Date(b.date) - new Date(a.date));
      setItems(entries);
    } catch (error) {
      console.error('Fetch health timeline error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Keep the timeline fresh when a doctor writes a prescription or reviews a
  // report while the patient is looking at it — same realtime events the
  // individual tabs already listen to.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => fetchAll();
    socket.on('prescription-updated', refresh);
    socket.on('report-updated', refresh);
    return () => {
      socket.off('prescription-updated', refresh);
      socket.off('report-updated', refresh);
    };
  }, []);

  const visible = filter === 'all' ? items : items.filter((it) => it.type === filter);

  // Group the visible entries by month for scannable section headers.
  const groups = [];
  let currentKey = null;
  visible.forEach((it) => {
    const key = monthKey(it.date);
    if (key !== currentKey) {
      currentKey = key;
      groups.push({ key, label: monthLabel(it.date), entries: [it] });
    } else {
      groups[groups.length - 1].entries.push(it);
    }
  });

  if (loading) return <div className="text-center py-8 text-gray-600">Loading your health history...</div>;

  return (
    <div className="max-w-3xl">
      <div className="mb-2">
        <h2 className="text-xl font-semibold text-gray-800">My Health History</h2>
        <p className="text-sm text-gray-500 mt-1">
          Everything in one place — your consultations, prescriptions, and reports, newest first.
        </p>
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-2 my-4">
        {FILTERS.map((f) => {
          const count = f.value === 'all' ? items.length : items.filter((it) => it.type === f.value).length;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <div className="text-5xl mb-4">📖</div>
          <h3 className="text-xl font-medium text-gray-700">
            {items.length === 0 ? 'Your health history is empty' : 'Nothing to show for this filter'}
          </h3>
          <p className="text-gray-500 mt-2">
            {items.length === 0
              ? 'Once you consult a doctor, your appointments, prescriptions, and reports will appear here as a timeline.'
              : 'Try a different filter above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.key}>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">{group.label}</h3>
              {/* Vertical timeline: a left rail with a dot per entry */}
              <div className="relative border-l-2 border-gray-100 ml-3 pl-6 space-y-4">
                {group.entries.map((it) => (
                  <TimelineEntry key={it.id} entry={it} onNavigateTab={onNavigateTab} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// A single timeline card. Content differs by entry type but shares one shell.
function TimelineEntry({ entry, onNavigateTab }) {
  const meta = TYPE_META[entry.type];
  const { data } = entry;

  return (
    <div className="relative">
      {/* Dot on the rail */}
      <span
        className="absolute -left-[1.95rem] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-primary-400 flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
      </span>

      <div className={`bg-white rounded-xl shadow-sm border-l-4 ${meta.accent} p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <span className="text-xl flex-shrink-0" aria-hidden="true">{meta.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.chip}`}>{meta.label}</span>
                <span className="text-xs text-gray-400">{formatDate(entry.date)}</span>
              </div>

              {/* Type-specific summary */}
              {entry.type === 'appointment' && (
                <div className="mt-1.5">
                  <p className="font-medium text-gray-800">
                    Dr. {data.doctor?.name || 'Doctor'}
                    {data.doctor?.specialization ? ` — ${data.doctor.specialization}` : ''}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {data.timeSlot ? `${data.timeSlot} • ` : ''}
                    <span className="capitalize">{data.consultationType || 'in-person'}</span>
                    {data.bookedFor === 'family' && data.familyMemberName ? ` • for ${data.familyMemberName}` : ''}
                  </p>
                  {data.reason && <p className="text-sm text-gray-500 mt-1">Reason: {data.reason}</p>}
                </div>
              )}

              {entry.type === 'prescription' && (
                <div className="mt-1.5">
                  <p className="font-medium text-gray-800">Dr. {data.doctor?.name || 'Doctor'}</p>
                  {data.diagnosis && <p className="text-sm text-gray-600 mt-0.5">Diagnosis: {data.diagnosis}</p>}
                  {data.medicines && data.medicines.length > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      {data.medicines.length} {data.medicines.length === 1 ? 'medicine' : 'medicines'} prescribed
                    </p>
                  )}
                </div>
              )}

              {entry.type === 'report' && (
                <div className="mt-1.5">
                  <p className="font-medium text-gray-800">{data.title || 'Medical report'}</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Shared with Dr. {data.doctor?.name || 'Doctor'}
                  </p>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      data.isReviewed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {data.isReviewed ? 'Reviewed by doctor' : 'Pending review'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Status chip for appointments (aligned right) */}
          {entry.type === 'appointment' && data.status && (
            <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_CHIP[data.status] || 'bg-gray-100 text-gray-600'}`}>
              {data.status}
            </span>
          )}
        </div>

        {/* A gentle jump to the full-detail tab for that record type. */}
        {onNavigateTab && (entry.type === 'prescription' || entry.type === 'report') && (
          <div className="mt-2 pl-8">
            <button
              type="button"
              onClick={() => onNavigateTab(entry.type === 'prescription' ? 'prescriptions' : 'reports')}
              className="text-primary-600 text-xs font-medium hover:underline"
            >
              {entry.type === 'prescription' ? 'View full prescription →' : 'View report →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PatientHealthTimeline;
