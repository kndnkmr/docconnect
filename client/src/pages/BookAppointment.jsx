// ============================================
// Book Appointment Page - Booking Form
// ============================================
// Patient selects date, time slot, and reason to book with a doctor.
//
// KEY CONCEPTS:
// - URL params: get the doctorId from the route
// - Dynamic slot fetching: when patient picks a date, we fetch FREE slots from the API
// - The API checks the doctor's availability schedule + existing bookings
// - Only available (non-booked) slots are shown
//
// FLOW:
// 1. Patient picks a date
// 2. Frontend calls GET /api/availability/:doctorId/slots?date=...
// 3. Backend calculates free slots and returns them
// 4. Patient sees only available times and picks one

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { doctorAPI, appointmentAPI, availabilityAPI, familyMemberAPI, getUploadUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/SEO';
import toast from 'react-hot-toast';
import { offeredModes, pickMode } from '../utils/consultModes';
import { loadDraft, clearDraft, savedAgo, DRAFT_TTL } from '../utils/drafts';
import useAutoDraft from '../utils/useAutoDraft';

// Any one of the medical info fields being set is enough to consider it
// "on file" — no need for every field to be filled in.
const hasMedicalInfo = (u) =>
  !!(u?.allergies || u?.currentMedications || u?.medicalHistory || u?.bloodGroup || u?.emergencyContactName || u?.insuranceProvider);

// Common symptoms for the quick-pick list. Bilingual so a Hindi-speaking
// patient can recognise them — but the value STORED (and shown to the
// doctor) is always the English `en`, so the doctor side stays English.
const COMMON_SYMPTOMS = [
  { en: 'Fever', hi: 'बुखार' },
  { en: 'Cough', hi: 'खांसी' },
  { en: 'Cold', hi: 'सर्दी' },
  { en: 'Headache', hi: 'सिरदर्द' },
  { en: 'Body Ache', hi: 'बदन दर्द' },
  { en: 'Fatigue', hi: 'थकान' },
  { en: 'Nausea/Vomiting', hi: 'मतली / उल्टी' },
  { en: 'Diarrhea', hi: 'दस्त' },
  { en: 'Stomach Pain', hi: 'पेट दर्द' },
  { en: 'Chest Pain', hi: 'सीने में दर्द' },
  { en: 'Shortness of Breath', hi: 'सांस लेने में तकलीफ' },
  { en: 'Sore Throat', hi: 'गले में खराश' },
  { en: 'Skin Rash', hi: 'त्वचा पर चकत्ते' },
  { en: 'Dizziness', hi: 'चक्कर आना' },
  { en: 'Joint Pain', hi: 'जोड़ों का दर्द' },
  { en: 'Back Pain', hi: 'कमर दर्द' },
];

// Bilingual UI strings for the patient booking flow (Phase 2). Doctor-entered
// content (name, specialization) and the values sent to the server stay in
// English/as-typed — only fixed patient-facing labels are translated.
const BOOKING_TXT = {
  en: {
    back: '← Back to doctor profile',
    loading: 'Loading...',
    feeLabel: 'Fee',
    title: 'Book Appointment',
    repeatNote: 'Rebooking from a previous appointment. Reason and consultation type have been pre-filled.',
    dateLabel: 'Preferred Date *',
    dateHint: 'Select a date to see available time slots',
    slotLabel: 'Time Slot *',
    slotsLoading: 'Loading available slots...',
    pickDateFirst: 'Pick a date first to see available slots',
    noSlots: 'No slots available on this date',
    bookingFor: 'Booking For',
    myself: 'Myself',
    familyMember: 'A Family Member',
    selectFamily: 'Select Family Member *',
    noFamily: "You haven't added any family members yet.",
    addFamily: '+ Add a family member →',
    chooseFamily: 'Choose family member...',
    medInfoOnFile: '✓ Your doctor will automatically see your medical info on file:',
    lblAllergies: 'Allergies',
    lblMedications: 'Current Medications',
    lblHistory: 'Medical History',
    lblBlood: 'Blood Group',
    lblEmergency: 'Emergency Contact',
    lblInsurance: 'Insurance',
    updateIfChanged: 'Update this if anything has changed →',
    addMedPrompt: '💡 Adding your allergies and emergency contact helps your doctor be prepared — takes a minute.',
    addInSettings: 'Add it in Account Settings →',
    consultType: 'Consultation Type',
    inPerson: 'In-Person Visit',
    video: 'Video Call',
    phone: 'Phone Call',
    onlyMode: (name) => `Dr. ${name} consults this way only`,
    modeSwitched: (name) => `Dr. ${name} doesn't offer your last consultation type, so we picked one they do offer.`,
    step1: 'Date & time',
    restored: (ago) => `↩ Picked up where you left off (${ago})`,
    startFresh: 'Start fresh',
    slotLost: (slot) => `${slot} was booked by someone else meanwhile. Everything else is kept, so just pick another time.`,
    step2: 'Who & how',
    step3: 'Reason for visit',
    symptomsLabel: 'Symptoms (optional)',
    symptomsHint: 'Select any that apply — helps your doctor at a glance.',
    reasonLabel: 'Reason for Visit *',
    reasonPlaceholder: 'Briefly describe your symptoms or reason for the visit...',
    booking: 'Booking...',
    confirmBooking: 'Confirm Booking',
    pendingNote: 'Your appointment will be pending until the doctor confirms.',
  },
  hi: {
    back: '← डॉक्टर प्रोफ़ाइल पर वापस जाएं',
    loading: 'लोड हो रहा है...',
    feeLabel: 'शुल्क',
    title: 'अपॉइंटमेंट बुक करें',
    repeatNote: 'पिछले अपॉइंटमेंट से दोबारा बुकिंग। कारण और परामर्श का तरीका पहले से भर दिया गया है।',
    dateLabel: 'पसंदीदा तारीख *',
    dateHint: 'उपलब्ध समय स्लॉट देखने के लिए तारीख चुनें',
    slotLabel: 'समय स्लॉट *',
    slotsLoading: 'उपलब्ध स्लॉट लोड हो रहे हैं...',
    pickDateFirst: 'स्लॉट देखने के लिए पहले तारीख चुनें',
    noSlots: 'इस तारीख पर कोई स्लॉट उपलब्ध नहीं है',
    bookingFor: 'किसके लिए बुकिंग',
    myself: 'स्वयं के लिए',
    familyMember: 'परिवार के सदस्य के लिए',
    selectFamily: 'परिवार का सदस्य चुनें *',
    noFamily: 'आपने अभी तक कोई परिवार सदस्य नहीं जोड़ा है।',
    addFamily: '+ परिवार सदस्य जोड़ें →',
    chooseFamily: 'परिवार सदस्य चुनें...',
    medInfoOnFile: '✓ आपके डॉक्टर को आपकी दर्ज मेडिकल जानकारी अपने आप दिखेगी:',
    lblAllergies: 'एलर्जी',
    lblMedications: 'वर्तमान दवाएं',
    lblHistory: 'चिकित्सा इतिहास',
    lblBlood: 'रक्त समूह',
    lblEmergency: 'आपातकालीन संपर्क',
    lblInsurance: 'बीमा',
    updateIfChanged: 'कुछ बदला हो तो यहाँ अपडेट करें →',
    addMedPrompt: '💡 अपनी एलर्जी और आपातकालीन संपर्क जोड़ने से डॉक्टर बेहतर तैयारी कर पाते हैं — बस एक मिनट लगता है।',
    addInSettings: 'इसे अकाउंट सेटिंग्स में जोड़ें →',
    consultType: 'परामर्श का तरीका',
    inPerson: 'क्लिनिक पर मिलें',
    video: 'वीडियो कॉल',
    phone: 'फ़ोन कॉल',
    onlyMode: (name) => `डॉ. ${name} केवल इसी तरीके से परामर्श देते हैं`,
    modeSwitched: (name) => `डॉ. ${name} आपका पिछला परामर्श तरीका नहीं देते, इसलिए हमने उनका उपलब्ध तरीका चुना है।`,
    step1: 'तारीख और समय',
    restored: (ago) => `↩ जहाँ छोड़ा था, वहीं से जारी (${ago})`,
    startFresh: 'नए सिरे से शुरू करें',
    slotLost: (slot) => `${slot} इस बीच किसी और ने बुक कर लिया। बाकी सब वैसा ही है, बस दूसरा समय चुनें।`,
    step2: 'किसके लिए और कैसे',
    step3: 'आने का कारण',
    symptomsLabel: 'लक्षण (वैकल्पिक)',
    symptomsHint: 'जो भी लागू हों चुनें — इससे डॉक्टर को एक नज़र में मदद मिलती है।',
    reasonLabel: 'आने का कारण *',
    reasonPlaceholder: 'अपने लक्षण या आने का कारण संक्षेप में बताएं...',
    booking: 'बुकिंग हो रही है...',
    confirmBooking: 'बुकिंग की पुष्टि करें',
    pendingNote: 'डॉक्टर की पुष्टि होने तक आपका अपॉइंटमेंट लंबित रहेगा।',
  },
};

function BookAppointment() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Language — shares the same stored choice as the Home page toggle, so a
  // patient's selection carries across the site. Doctor-facing pages have no
  // translation logic, so they stay English regardless of this.
  const [lang, setLang] = useState(() => localStorage.getItem('promedicoz_lang') || 'en');
  const t = BOOKING_TXT[lang];
  const changeLang = (l) => { setLang(l); localStorage.setItem('promedicoz_lang', l); };

  // Check if this is a repeat booking (prefilled data from Dashboard)
  const repeatData = location.state || {};

  // Deep-link support: the doctor profile's "quick-pick slot" chips link here
  // with ?date=YYYY-MM-DD&slot=<label>. We pre-fill the date (and auto-select
  // the slot once that date's free slots load, if it's still available).
  const query = new URLSearchParams(location.search);
  const presetDate = query.get('date') || '';
  const presetSlot = query.get('slot') || '';

  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Family members state
  const [familyMembers, setFamilyMembers] = useState([]);
  const [bookedFor, setBookedFor] = useState(repeatData.bookedFor || 'self');
  const [selectedFamilyMember, setSelectedFamilyMember] = useState(repeatData.familyMemberName || '');

  // Slot-related state
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsMessage, setSlotsMessage] = useState('');

  // Form state (date may be pre-filled from a quick-pick deep link)
  const [formData, setFormData] = useState({
    date: presetDate,
    timeSlot: '',
    reason: repeatData.reason || '',
    consultationType: repeatData.consultationType || 'in-person'
  });

  // Structured symptom tags — a fast-glance supplement to the free-text
  // "Reason for Visit" below, not a replacement for it.
  const [symptoms, setSymptoms] = useState([]);
  const toggleSymptom = (s) => {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  // Consultation types: only the ones this doctor offers (same rule as the
  // server). Once the doctor loads, keep a repeat booking's type if it's
  // still offered, otherwise pick the first offered one (and say so).
  const [modeSwitched, setModeSwitched] = useState(false);
  useEffect(() => {
    if (!doctor) return;
    const { mode, switched } = pickMode(repeatData.consultationType || '', doctor.consultationModes);
    setFormData((prev) => ({ ...prev, consultationType: mode }));
    setModeSwitched(switched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctor]);
  const modes = offeredModes(doctor?.consultationModes);

  // ---- Pick up where you left off (draft on this device) ----
  // The form is saved on the device as the patient types (not consent).
  // Coming back restores it; the slot is re-checked against the fresh free
  // list. Not used for repeat/follow-up bookings (those carry their own
  // context from the Dashboard) or quick-pick deep links (explicit choice).
  const userId = user?._id || user?.id;
  const draftName = `booking:${doctorId}`;
  const [restored, setRestored] = useState(null);       // { savedAt } when a draft was restored
  const [slotLostNote, setSlotLostNote] = useState(''); // restored slot no longer free
  const [booked, setBooked] = useState(false);
  const restoreSlotRef = useRef('');
  const draftCheckedRef = useRef(false);
  useEffect(() => {
    if (!doctor || !userId || draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    if (repeatData.repeatBooking || presetDate) return;
    const d = loadDraft(draftName, userId, DRAFT_TTL.booking);
    if (!d) return;
    const x = d.data || {};
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const dateOk = typeof x.date === 'string' && x.date >= today;
    restoreSlotRef.current = dateOk ? (x.timeSlot || '') : '';
    setFormData((prev) => ({
      ...prev,
      date: dateOk ? x.date : '',
      reason: typeof x.reason === 'string' ? x.reason : '',
      consultationType: pickMode(x.consultationType, doctor.consultationModes).mode,
    }));
    setSymptoms(Array.isArray(x.symptoms) ? x.symptoms.filter((v) => typeof v === 'string') : []);
    setBookedFor(x.bookedFor === 'family' ? 'family' : 'self');
    setSelectedFamilyMember(x.bookedFor === 'family' ? (x.familyMemberName || '') : '');
    setModeSwitched(false);
    setRestored({ savedAt: d.savedAt });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctor, userId]);

  useAutoDraft(draftName, {
    doctorId, doctorName: doctor?.name || '',
    date: formData.date, timeSlot: formData.timeSlot, reason: formData.reason,
    consultationType: formData.consultationType, symptoms,
    bookedFor, familyMemberName: bookedFor === 'family' ? selectedFamilyMember : '',
  }, {
    userId,
    enabled: !!userId && !!doctor && !repeatData.repeatBooking && !booked && draftCheckedRef.current,
    isEmpty: (d) => !d.date && !String(d.reason || '').trim() && !(d.symptoms || []).length,
  });

  const startFresh = () => {
    clearDraft(draftName, userId);
    restoreSlotRef.current = '';
    setFormData((prev) => ({ ...prev, date: '', timeSlot: '', reason: '', consultationType: pickMode('', doctor?.consultationModes).mode }));
    setSymptoms([]);
    setBookedFor('self');
    setSelectedFamilyMember('');
    setRestored(null);
    setSlotLostNote('');
  };

  // Consent state (controlled so we can reliably enforce it before booking)
  const [consentGiven, setConsentGiven] = useState(false);

  // Fetch doctor info on load
  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        const response = await doctorAPI.getById(doctorId);
        setDoctor(response.data.doctor);
      } catch (error) {
        toast.error('Doctor not found');
        navigate('/doctors');
      } finally {
        setLoading(false);
      }
    };
    fetchDoctor();

    // Fetch family members for the dropdown
    const fetchFamilyMembers = async () => {
      try {
        const response = await familyMemberAPI.getAll();
        setFamilyMembers(response.data.familyMembers);
      } catch (error) {
        // Non-critical — patient just can't select family member
        console.error('Fetch family members error:', error);
      }
    };
    fetchFamilyMembers();
  }, [doctorId, navigate]);

  // ---- Fetch free slots when date changes ----
  // This is the KEY difference from before (hardcoded slots)
  // Now we ask the server: "What's available for this doctor on this date?"
  useEffect(() => {
    if (!formData.date) {
      setAvailableSlots([]);
      setSlotsMessage('');
      return;
    }

    const fetchSlots = async () => {
      setSlotsLoading(true);
      setSlotsMessage('');
      setAvailableSlots([]);
      // Clear the selected time slot when date changes
      setFormData(prev => ({ ...prev, timeSlot: '' }));

      try {
        const response = await availabilityAPI.getFreeSlots(doctorId, formData.date);
        const data = response.data;

        if (data.slots.length === 0) {
          setSlotsMessage(
            data.message || `No available slots on ${data.dayOfWeek}. Try a different date.`
          );
        } else {
          setAvailableSlots(data.slots);
          setSlotsMessage(
            `${data.freeCount} slots available on ${data.dayOfWeek} (${data.bookedCount} already booked)`
          );
          // If the user arrived via a quick-pick deep link, auto-select that
          // slot — but only if it's still free (someone may have booked it
          // first). Checked against the fresh list so we never select a
          // now-unavailable time. Only fires for the matching date.
          if (presetSlot && formData.date === presetDate && data.slots.includes(presetSlot)) {
            setFormData(prev => ({ ...prev, timeSlot: presetSlot }));
          }
        }
        // A restored draft's slot: select it again only if it's still free.
        const want = restoreSlotRef.current;
        if (want) {
          restoreSlotRef.current = '';
          if (data.slots.includes(want)) setFormData(prev => ({ ...prev, timeSlot: want }));
          else setSlotLostNote(want);
        }
      } catch (error) {
        setSlotsMessage('Could not load available slots. The doctor may not have set their schedule yet.');
        console.error('Fetch slots error:', error);
      } finally {
        setSlotsLoading(false);
      }
    };

    fetchSlots();
  }, [formData.date, doctorId]);
  // Re-runs whenever the date OR doctorId changes

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.date || !formData.timeSlot || !formData.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Enforce consent explicitly (not just via native checkbox validation)
    if (!consentGiven) {
      toast.error('Please agree to the consent terms before booking / बुकिंग से पहले सहमति दें');
      return;
    }

    // Check date is in the future
    const selectedDate = new Date(formData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      toast.error('Please select a future date');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: bookRes } = await appointmentAPI.book({
        doctorId,
        date: formData.date,
        timeSlot: formData.timeSlot,
        reason: formData.reason,
        symptoms,
        consultationType: formData.consultationType,
        bookedFor,
        familyMemberName: bookedFor === 'family' ? selectedFamilyMember : '',
        originalAppointmentId: repeatData.originalAppointmentId || undefined,
        isFollowUp: repeatData.isFollowUp || false,
        consentGiven: consentGiven
      });

      setBooked(true);
      clearDraft(draftName, userId);
      toast.success('Appointment booked! Waiting for doctor confirmation.');
      // ?id= lets the page load the live booking (refresh, alert link) and
      // show the payment box the moment the doctor confirms.
      const newId = bookRes?.appointment?._id;
      navigate(newId ? `/booking-confirmation?id=${newId}` : '/booking-confirmation', {
        state: {
          doctorName: doctor?.name,
          specialization: doctor?.specialization,
          date: formData.date,
          timeSlot: formData.timeSlot,
          consultationType: formData.consultationType,
          reason: formData.reason,
          fee: doctor?.consultationFee
        }
      });

    } catch (error) {
      // 401 = login expired: the "Please log in again — your work is saved"
      // banner explains it, and the form is kept as a draft.
      if (error.response?.status !== 401) {
        const message = error.response?.data?.message || 'Failed to book appointment';
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get today's date in YYYY-MM-DD format (for min attribute on date input)
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg text-gray-600">{t.loading}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <SEO title="Book Appointment" description="Book your appointment on ProMedicoz." path="/book-appointment" noindex />
      <div className="flex items-center justify-between mb-6 max-w-2xl mx-auto">
        <Link to={`/doctors/${doctorId}`} className="text-primary-600 hover:underline inline-block">
          {t.back}
        </Link>
        {/* Language toggle — same choice as the home page, available here too
            in case a patient landed straight on the booking page. */}
        <div className="inline-flex items-center bg-gray-100 rounded-full p-0.5 text-xs">
          <button
            onClick={() => changeLang('en')}
            className={`px-3 py-1 rounded-full font-medium transition-colors ${lang === 'en' ? 'bg-primary-600 text-white' : 'text-gray-600'}`}
          >
            English
          </button>
          <button
            onClick={() => changeLang('hi')}
            className={`px-3 py-1 rounded-full font-medium transition-colors ${lang === 'hi' ? 'bg-primary-600 text-white' : 'text-gray-600'}`}
          >
            हिंदी
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Doctor summary card — who you're booking + the fee, up front. */}
        <div className="bg-white rounded-2xl shadow-md p-5 mb-6 flex items-center gap-4">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-primary-50">
            {doctor?.profilePhoto ? (
              <img src={getUploadUrl(doctor.profilePhoto, { width: 150 })} alt={doctor.name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <span className="text-2xl">🧑‍⚕️</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-800 truncate">{doctor?.name}</h2>
            <p className="text-primary-600 text-sm font-medium">{doctor?.specialization || 'General Physician'}</p>
          </div>
          {doctor?.consultationFee > 0 && (
            <div className="flex-shrink-0 text-center bg-green-50 border border-green-100 rounded-xl px-3 py-2">
              <div className="text-base font-extrabold text-green-700 leading-none">Rs. {doctor.consultationFee}</div>
              <div className="text-[10px] text-green-600 mt-0.5">{t.feeLabel}</div>
            </div>
          )}
        </div>

        {/* Booking form */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">{t.title}</h1>

          {/* Repeat booking indicator */}
          {repeatData.repeatBooking && (
            <div className="mb-5 p-3 bg-primary-50 border border-primary-200 rounded-lg flex items-center gap-2">
              <span className="text-lg">🔄</span>
              <p className="text-sm text-primary-700">
                {t.repeatNote}
              </p>
            </div>
          )}

          {restored && (
            <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between gap-3" role="status">
              <p className="text-sm text-blue-800">{t.restored(savedAgo(restored.savedAt))}</p>
              <button type="button" onClick={startFresh} className="text-sm font-semibold text-primary-600 hover:underline whitespace-nowrap">{t.startFresh}</button>
            </div>
          )}

          <form id="book-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Step 1 — Date & time */}
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
              <h2 className="text-base font-bold text-gray-800">{t.step1}</h2>
            </div>

            {/* Date picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.dateLabel}
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                min={getTodayString()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {t.dateHint}
              </p>
            </div>

            {/* Time slot selector - NOW DYNAMIC */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.slotLabel}
              </label>

              {/* Show loading while fetching slots */}
              {slotsLoading ? (
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm">
                  {t.slotsLoading}
                </div>
              ) : !formData.date ? (
                // No date selected yet
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm">
                  {t.pickDateFirst}
                </div>
              ) : availableSlots.length === 0 ? (
                // Date selected but no slots available
                <div className="w-full px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {slotsMessage || t.noSlots}
                </div>
              ) : (
                // Slots available — show as selectable grid
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, timeSlot: slot }))}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                          formData.timeSlot === slot
                            ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-200'
                            : 'border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-gray-50'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                  {/* Slots info message */}
                  <p className="text-xs text-green-600 mt-2">
                    {slotsMessage}
                  </p>
                </>
              )}
              {slotLostNote && !formData.timeSlot && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2" role="status">{t.slotLost(slotLostNote)}</p>
              )}
            </div>

            {/* Step 2 — Who & how */}
            <div className="flex items-center gap-2.5 pt-2 border-t border-gray-100">
              <span className="w-6 h-6 mt-4 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
              <h2 className="text-base font-bold text-gray-800 mt-4">{t.step2}</h2>
            </div>

            {/* Who is this booking for? */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.bookingFor}
              </label>
              <select
                value={bookedFor}
                onChange={(e) => {
                  setBookedFor(e.target.value);
                  if (e.target.value === 'self') setSelectedFamilyMember('');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="self">{t.myself}</option>
                <option value="family">{t.familyMember}</option>
              </select>
            </div>

            {/* Family member selection (only when booking for family) */}
            {bookedFor === 'family' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.selectFamily}
                </label>
                {familyMembers.length === 0 ? (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-700">
                      {t.noFamily}
                    </p>
                    <Link
                      to={`/dashboard?tab=familyMembers&back=${encodeURIComponent(`/book-appointment/${doctorId}`)}`}
                      className="text-sm text-primary-600 hover:underline mt-1 inline-block"
                    >
                      {t.addFamily}
                    </Link>
                  </div>
                ) : (
                  <select
                    value={selectedFamilyMember}
                    onChange={(e) => setSelectedFamilyMember(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    required
                  >
                    <option value="">{t.chooseFamily}</option>
                    {familyMembers.map((member) => (
                      <option key={member._id} value={member.name}>
                        {member.name} ({member.relationship}{member.age ? `, ${member.age} yrs` : ''})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Medical info reminder — only for a self-booking, since this is
                the ACCOUNT HOLDER's medical info (allergies, emergency
                contact, etc.), which has nothing to do with a family member
                being booked for instead. Always reads live from the
                patient's profile rather than being copied onto the
                appointment, so the doctor always sees the current version,
                not a possibly-stale one from whenever this was booked. */}
            {bookedFor === 'self' && (
              hasMedicalInfo(user) ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  <p className="font-medium mb-1">{t.medInfoOnFile}</p>
                  <ul className="text-green-700 space-y-0.5 list-disc list-inside">
                    {user.allergies && <li>{t.lblAllergies}: {user.allergies}</li>}
                    {user.currentMedications && <li>{t.lblMedications}: {user.currentMedications}</li>}
                    {user.medicalHistory && <li>{t.lblHistory}: {user.medicalHistory}</li>}
                    {user.bloodGroup && <li>{t.lblBlood}: {user.bloodGroup}</li>}
                    {user.emergencyContactName && <li>{t.lblEmergency}: {user.emergencyContactName}</li>}
                    {user.insuranceProvider && <li>{t.lblInsurance}: {user.insuranceProvider}</li>}
                  </ul>
                  <Link to={`/dashboard?tab=account&back=${encodeURIComponent(`/book-appointment/${doctorId}`)}`} className="text-green-700 underline text-xs mt-1 inline-block">
                    {t.updateIfChanged}
                  </Link>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  {t.addMedPrompt}{' '}
                  <Link to={`/dashboard?tab=account&back=${encodeURIComponent(`/book-appointment/${doctorId}`)}`} className="underline font-medium">
                    {t.addInSettings}
                  </Link>
                </div>
              )
            )}

            {/* Consultation type — tap-to-pick mode cards (writes the same
                formData.consultationType values the old dropdown did). */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.consultType}
              </label>
              {modes.length === 1 ? (
                // Only one way to consult: nothing to choose, just say it.
                <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-primary-500 bg-primary-50 ring-2 ring-primary-200">
                  <span className="text-xl" aria-hidden="true">{{ video: '📹', phone: '📞', 'in-person': '🏥' }[modes[0]]}</span>
                  <div>
                    <p className="text-sm font-semibold text-primary-700">{{ video: t.video, phone: t.phone, 'in-person': t.inPerson }[modes[0]]}</p>
                    <p className="text-xs text-gray-500">{t.onlyMode(doctor?.name || '')}</p>
                  </div>
                </div>
              ) : (
              <div className={`grid gap-2 ${modes.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {[
                  { key: 'video', icon: '📹', label: t.video },
                  { key: 'phone', icon: '📞', label: t.phone },
                  { key: 'in-person', icon: '🏥', label: t.inPerson },
                ].filter((m) => modes.includes(m.key)).map((m) => {
                  const on = formData.consultationType === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, consultationType: m.key }))}
                      className={`flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl border text-center transition-all ${on ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'}`}
                    >
                      <span className="text-xl" aria-hidden="true">{m.icon}</span>
                      <span className={`text-xs font-medium leading-tight ${on ? 'text-primary-700' : 'text-gray-600'}`}>{m.label}</span>
                    </button>
                  );
                })}
              </div>
              )}
              {modeSwitched && <p className="text-xs text-amber-700 mt-2">{t.modeSwitched(doctor?.name || '')}</p>}
            </div>

            {/* Step 3 — Reason for visit */}
            <div className="flex items-center gap-2.5 pt-2 border-t border-gray-100">
              <span className="w-6 h-6 mt-4 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
              <h2 className="text-base font-bold text-gray-800 mt-4">{t.step3}</h2>
            </div>

            {/* Structured symptom tags — optional quick-pick, supplements
                the free-text reason below rather than replacing it */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.symptomsLabel}
              </label>
              <p className="text-xs text-gray-500 mb-2">{t.symptomsHint}</p>
              <div className="flex flex-wrap gap-2">
                {COMMON_SYMPTOMS.map((s) => (
                  <button
                    key={s.en}
                    type="button"
                    onClick={() => toggleSymptom(s.en)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                      symptoms.includes(s.en)
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:border-primary-300 hover:bg-gray-50'
                    }`}
                  >
                    {lang === 'hi' ? s.hi : s.en}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.reasonLabel}
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder={t.reasonPlaceholder}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                required
              />
            </div>

            {/* Consent checkbox (bilingual: English + Hindi) */}
            <label className="flex items-start gap-2 cursor-pointer bg-gray-50 border border-gray-200 rounded-lg p-3">
              <input
                type="checkbox"
                id="consent"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-xs text-gray-600 space-y-1">
                <span className="block">
                  I agree to the <a href="/terms" target="_blank" className="text-primary-600 underline">Terms &amp; Conditions</a> and consent to teleconsultation. I understand this is not an emergency service.
                </span>
                <span className="block text-gray-500">
                  मैं <a href="/terms" target="_blank" className="text-primary-600 underline">नियम और शर्तों</a> से सहमत हूँ और टेलीकंसल्टेशन के लिए अपनी सहमति देता/देती हूँ। मैं समझता/समझती हूँ कि यह आपातकालीन सेवा नहीं है।
                </span>
              </span>
            </label>

            {/* Submit — inline button for tablet/desktop; on mobile the sticky
                bottom bar carries the action (md:hidden here to avoid two). */}
            <button
              type="submit"
              disabled={isSubmitting || !formData.timeSlot || !consentGiven || (bookedFor === 'family' && !selectedFamilyMember)}
              className="btn btn-primary w-full hidden md:flex"
            >
              {isSubmitting ? t.booking : t.confirmBooking}
            </button>
          </form>

          <p className="text-gray-500 text-sm mt-4 text-center">
            {t.pendingNote}
          </p>
        </div>
      </div>

      {/* Sticky mobile submit bar — fee + Confirm always reachable while the
          patient scrolls the form. Submits #book-form via the form attribute,
          so it shares the exact same disabled rules + submit handler.
          IMPORTANT: it sits ABOVE the global BottomNav (which is fixed at
          bottom-0, h-16 = 64px, + the safe-area inset). If this bar also sat
          at bottom-0 the BottomNav (z-50) would cover it and the Confirm
          button would be invisible — so we offset it by the nav height and
          give it z-50 too. The spacer below reserves room for both bars. */}
      <div className="h-36 md:hidden" aria-hidden="true" />
      <div
        className="fixed inset-x-0 z-50 md:hidden bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] px-4 py-3 flex items-center gap-3"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex-1 min-w-0">
          {doctor?.consultationFee > 0 ? (
            <>
              <p className="text-lg font-bold text-gray-800 leading-none">Rs. {doctor.consultationFee}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{formData.timeSlot ? formData.timeSlot.split(' - ')[0] : t.pickDateFirst}</p>
            </>
          ) : (
            <p className="text-sm font-medium text-gray-700 truncate">{doctor?.name}</p>
          )}
        </div>
        <button
          type="submit"
          form="book-form"
          disabled={isSubmitting || !formData.timeSlot || !consentGiven || (bookedFor === 'family' && !selectedFamilyMember)}
          className="btn btn-primary flex-shrink-0 disabled:opacity-60"
        >
          {isSubmitting ? t.booking : t.confirmBooking}
        </button>
      </div>
    </div>
  );
}

export default BookAppointment;
