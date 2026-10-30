import { useState } from 'react';
import { availabilityAPI, appointmentAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';

// Fixed UI text. Doctors/admins always see English.
const TXT = {
  en: {
    yourDoctor: 'your doctor',
    noSlots: 'No free slots on this date. Try another day.',
    loadFailed: 'Could not load slots. Please try again.',
    pickBoth: 'Please pick a new date and time',
    done: 'Appointment rescheduled. Waiting for the doctor to confirm the new time.',
    failed: 'Failed to reschedule',
    title: 'Reschedule Appointment',
    intro: (dr) => `Move your appointment with ${dr} to a new time. Your payment and details stay the same — the doctor will just re-confirm the new slot.`,
    current: 'Currently booked',
    newDate: 'New date',
    newTime: 'New time',
    loading: 'Loading slots…',
    noneAvailable: 'No slots available.',
    cancel: 'Cancel',
    submitting: 'Rescheduling…',
    confirm: 'Confirm Reschedule',
  },
  hi: {
    yourDoctor: 'आपके डॉक्टर',
    noSlots: 'इस दिन कोई समय खाली नहीं है। कोई और दिन चुनें।',
    loadFailed: 'समय लोड नहीं हो पाए। कृपया फिर से कोशिश करें।',
    pickBoth: 'कृपया नई तारीख और समय चुनें',
    done: 'अपॉइंटमेंट का समय बदल गया। डॉक्टर के नया समय कन्फ़र्म करने का इंतज़ार है।',
    failed: 'समय नहीं बदल पाया',
    title: 'अपॉइंटमेंट का समय बदलें',
    intro: (dr) => `${dr} के साथ अपना अपॉइंटमेंट नए समय पर ले जाएँ। आपका पेमेंट और बाकी जानकारी वही रहेगी — डॉक्टर बस नया समय फिर से कन्फ़र्म करेंगे।`,
    current: 'अभी बुक है',
    newDate: 'नई तारीख',
    newTime: 'नया समय',
    loading: 'समय लोड हो रहे हैं…',
    noneAvailable: 'कोई समय खाली नहीं है।',
    cancel: 'रद्द करें',
    submitting: 'समय बदल रहे हैं…',
    confirm: 'नया समय पक्का करें',
  },
};

// Modal for a patient to move a pending/confirmed appointment to a new free
// slot with the SAME doctor. Reuses the public free-slots endpoint (so it only
// ever offers genuinely open slots, and honours the doctor's blocked dates),
// then calls the reschedule endpoint. Self-contained (own backdrop) to match
// the app's other modals without needing a shared Modal primitive.
function RescheduleModal({ appointment, onClose, onDone }) {
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsMessage, setSlotsMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { lang } = useLang();
  const { user } = useAuth();
  const hi = lang === 'hi' && user?.role !== 'doctor' && user?.role !== 'admin';
  const t = TXT[hi ? 'hi' : 'en'];

  if (!appointment) return null;

  const doctorId = appointment.doctor?._id || appointment.doctor;
  const doctorName = appointment.doctor?.name ? `Dr. ${appointment.doctor.name}` : t.yourDoctor;
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const handleDateChange = async (newDate) => {
    setDate(newDate);
    setSelectedSlot('');
    setSlots([]);
    setSlotsMessage('');
    if (!newDate || !doctorId) return;
    setSlotsLoading(true);
    try {
      const res = await availabilityAPI.getFreeSlots(doctorId, newDate);
      const data = res.data;
      if (!data.slots || data.slots.length === 0) {
        setSlotsMessage(data.message || t.noSlots);
      } else {
        setSlots(data.slots);
      }
    } catch (error) {
      setSlotsMessage(t.loadFailed);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!date || !selectedSlot) {
      toast.error(t.pickBoth);
      return;
    }
    setSubmitting(true);
    try {
      await appointmentAPI.reschedule(appointment._id, { date, timeSlot: selectedSlot });
      toast.success(t.done, { duration: 6000 });
      onDone?.();
    } catch (error) {
      toast.error(error.response?.data?.message || t.failed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-1">{t.title}</h3>
          <p className="text-sm text-gray-500 mb-4">
            {t.intro(doctorName)}
          </p>

          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-1">{t.current}</p>
            <p className="text-sm font-medium text-gray-700">
              {new Date(appointment.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · {appointment.timeSlot}
            </p>
          </div>

          <label className="block text-sm text-gray-600 mb-1">{t.newDate}</label>
          <input
            type="date"
            value={date}
            min={todayStr}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          />

          {date && (
            <div className="mt-4">
              <label className="block text-sm text-gray-600 mb-2">{t.newTime}</label>
              {slotsLoading ? (
                <p className="text-sm text-gray-500">{t.loading}</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-gray-500">{slotsMessage || t.noneAvailable}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        selectedSlot === slot
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-primary-300'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              {t.cancel}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !date || !selectedSlot}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-60"
            >
              {submitting ? t.submitting : t.confirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RescheduleModal;
