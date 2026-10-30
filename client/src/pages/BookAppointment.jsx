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
import { useLang } from '../context/LangContext';
import { dayTiles, groupSlots, slotStart, symptomsFor, missingStep } from '../utils/bookingUi';
import { formatDoctorName } from '../utils/formatName';
import VoiceSearch, { isVoiceSupported } from '../components/VoiceSearch';

// Any one of the medical info fields being set is enough to consider it
// "on file" — no need for every field to be filled in.
const hasMedicalInfo = (u) =>
  !!(u?.allergies || u?.currentMedications || u?.medicalHistory || u?.bloodGroup || u?.emergencyContactName || u?.insuranceProvider);

// Problem chips now match the doctor's specialty — see utils/bookingUi.js
// (symptomsFor). The stored value is always English, so the doctor side stays English.

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
    // ---- New look ----
    docTrust: 'Pay only after the doctor confirms',
    yrs: (n) => `${n} yrs`,
    when: 'When?',
    howWho: 'How & for whom?',
    problem: "What's the problem?",
    earliest: (label) => `⚡ Earliest: ${label}`,
    today: 'Today',
    tomorrow: 'Tomorrow',
    off: 'Off',
    otherDate: '📅 Other date:',
    groups: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' },
    pickDayFirst: 'Pick a day above to see free times',
    slotsFree: (n) => `${n} free time${n === 1 ? '' : 's'} on this day`,
    modeHint: { video: 'Face to face on video, from home', phone: 'Talk from home, no travel', clinic: 'Visit the clinic' },
    modeShort: { video: '📹 Video', phone: '📞 Phone', 'in-person': '🏥 Clinic' },
    forWhom: 'For whom?',
    myselfChip: '🙋 Myself',
    addMember: '+ Add family member',
    reasonPh2: 'Tell the doctor in your own words (Hindi or English)…',
    voiceHint: 'Tap 🎤 and speak — we type it for you. You can edit it.',
    summaryPick: 'Pick a day and time',
    payAfter: 'pay after confirm',
    bookNow: 'Book now →',
    missing: { time: 'Pick a day and time first', who: 'Choose who this is for', reason: 'Tell the doctor what the problem is', consent: 'Tick the consent box to continue' },
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
    // ---- New look ----
    docTrust: 'डॉक्टर की पुष्टि के बाद ही भुगतान',
    yrs: (n) => `${n} साल`,
    when: 'कब?',
    howWho: 'कैसे और किसके लिए?',
    problem: 'क्या परेशानी है?',
    earliest: (label) => `⚡ सबसे जल्दी: ${label}`,
    today: 'आज',
    tomorrow: 'कल',
    off: 'छुट्टी',
    otherDate: '📅 कोई और तारीख:',
    groups: { morning: 'सुबह', afternoon: 'दोपहर', evening: 'शाम', night: 'रात' },
    pickDayFirst: 'खाली समय देखने के लिए ऊपर दिन चुनें',
    slotsFree: (n) => `इस दिन ${n} समय खाली हैं`,
    modeHint: { video: 'घर बैठे वीडियो पर आमने-सामने', phone: 'घर से बात करें, कहीं जाना नहीं', clinic: 'क्लिनिक पर मिलें' },
    modeShort: { video: '📹 वीडियो', phone: '📞 फ़ोन', 'in-person': '🏥 क्लिनिक' },
    forWhom: 'किसके लिए?',
    myselfChip: '🙋 मेरे लिए',
    addMember: '+ परिवार सदस्य जोड़ें',
    reasonPh2: 'अपने शब्दों में डॉक्टर को बताएं (हिंदी या English)…',
    voiceHint: '🎤 दबाकर बोलें — हम लिख देंगे। आप बदल भी सकते हैं।',
    summaryPick: 'दिन और समय चुनें',
    payAfter: 'पुष्टि के बाद भुगतान',
    bookNow: 'बुक करें →',
    missing: { time: 'पहले दिन और समय चुनें', who: 'चुनें कि किसके लिए है', reason: 'डॉक्टर को परेशानी बताएं', consent: 'आगे बढ़ने के लिए सहमति पर टिक करें' },
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
  const { lang, setLang } = useLang(); // app-wide (top-bar switch)
  const t = BOOKING_TXT[lang];
  const [voiceOk] = useState(() => isVoiceSupported());

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
        setFamilyMembers(Array.isArray(response.data.familyMembers) ? response.data.familyMembers : []);
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

  // ---- New look helpers (utils/bookingUi.js) ----
  const tiles = dayTiles({ availability: doctor?.availability, blockedDates: doctor?.blockedDates });
  const inTiles = tiles.some((d) => d.date === formData.date);
  const baseSymptoms = symptomsFor(doctor?.specialization);
  // Keep any chosen problem visible even if it isn't in this doctor's list
  // (e.g. restored from an older draft).
  const symptomList = [...baseSymptoms, ...symptoms.filter((s) => !baseSymptoms.some((b) => b.en === s)).map((s) => ({ en: s, hi: s }))];
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const dayLabel = (date, opts) => new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', ...opts });
  const earliest = doctor?.nextAvailable || null;
  const earliestLabel = earliest
    ? `${earliest.isToday ? t.today : dayLabel(earliest.date, { weekday: 'short', day: 'numeric' })} ${slotStart(earliest.timeSlot)}`
    : '';
  const pickEarliest = () => {
    if (!earliest) return;
    if (formData.date === earliest.date) {
      if (availableSlots.includes(earliest.timeSlot)) setFormData((prev) => ({ ...prev, timeSlot: earliest.timeSlot }));
      return;
    }
    restoreSlotRef.current = earliest.timeSlot; // selected once that day's free times load (if still free)
    setFormData((prev) => ({ ...prev, date: earliest.date }));
  };
  const stepRefs = { time: useRef(null), who: useRef(null), reason: useRef(null), consent: useRef(null) };
  const missing = missingStep({ date: formData.date, timeSlot: formData.timeSlot, reason: formData.reason, consent: consentGiven, bookedFor, familyMemberName: selectedFamilyMember });
  // Tapping Book with something missing: say what, and take them there.
  const onBookTap = (e) => {
    if (!missing || isSubmitting) return;
    e.preventDefault();
    toast(t.missing[missing], { icon: '👆', id: 'book-missing' }); // replaces, never stacks
    const el = stepRefs[missing].current;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const modeHint = { video: t.modeHint.video, phone: t.modeHint.phone, 'in-person': (doctor?.clinicAddress || doctor?.city || '').trim() || t.modeHint.clinic };
  const summary = formData.timeSlot
    ? `${dayLabel(formData.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${slotStart(formData.timeSlot)} · ${{ video: '📹', phone: '📞', 'in-person': '🏥' }[formData.consultationType] || ''}`
    : t.summaryPick;
  const chip = (on) => `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-colors ${on ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 bg-white text-gray-800 hover:border-primary-400'}`;
  const stepHead = (n, title) => (
    <h2 className="flex items-center gap-2.5 text-base font-bold text-gray-900">
      <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0" aria-hidden="true">{n}</span>
      {title}
    </h2>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg text-gray-600">{t.loading}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <SEO title="Book Appointment" description="Book your appointment on ProMedicoz." path="/book-appointment" noindex />
      <div className="max-w-2xl mx-auto">
        <Link to={`/doctors/${doctorId}`} className="text-primary-700 hover:underline text-sm inline-block mb-3">
          {t.back}
        </Link>

        {/* Who you're booking — trust up front: qualification, years, fee,
            and that you pay only after the doctor confirms. */}
        <div className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white p-4 sm:p-5 mb-5 flex items-center gap-4 shadow-md">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-white/40">
            {doctor?.profilePhoto ? (
              <img src={getUploadUrl(doctor.profilePhoto, { width: 150 })} alt={doctor.name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <span className="text-2xl" aria-hidden="true">🧑‍⚕️</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold truncate">{formatDoctorName(doctor?.name)}</p>
            <p className="text-sm text-primary-100 truncate">
              {[doctor?.specialization?.trim() || 'General Physician', doctor?.qualification?.trim(), doctor?.experience > 0 ? t.yrs(doctor.experience) : ''].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs text-green-200 mt-1 font-medium">✓ {t.docTrust}</p>
          </div>
          {doctor?.consultationFee > 0 && (
            <div className="flex-shrink-0 text-center bg-white rounded-xl px-3 py-2">
              <div className="text-base font-extrabold text-green-700 leading-none">Rs. {doctor.consultationFee}</div>
              <div className="text-[10px] text-gray-600 mt-0.5">{t.feeLabel}</div>
            </div>
          )}
        </div>

        {repeatData.repeatBooking && (
          <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-xl flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">🔄</span>
            <p className="text-sm text-primary-800">{t.repeatNote}</p>
          </div>
        )}
        {restored && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3" role="status">
            <p className="text-sm text-blue-800">{t.restored(savedAgo(restored.savedAt))}</p>
            <button type="button" onClick={startFresh} className="text-sm font-semibold text-primary-700 hover:underline whitespace-nowrap">{t.startFresh}</button>
          </div>
        )}

        <h1 className="sr-only">{t.title}</h1>
        <form id="book-form" onSubmit={handleSubmit} className="space-y-5">
          {/* ---- 1. When? ---- */}
          <section ref={stepRefs.time} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 scroll-mt-24" aria-labelledby="step-when">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
              <div id="step-when">{stepHead(1, t.when)}</div>
              {earliest && (
                <button type="button" onClick={pickEarliest} className="px-3 py-1.5 rounded-full bg-green-100 text-green-800 text-xs font-bold hover:bg-green-200">
                  {t.earliest(earliestLabel)}
                </button>
              )}
            </div>

            {/* Day tiles: next 2 weeks; days the doctor doesn't work are "Off". */}
            <div className="-mx-1 px-1 flex gap-2 overflow-x-auto pb-1 snap-x" role="radiogroup" aria-label={t.dateLabel}>
              {tiles.map((d) => {
                const on = formData.date === d.date;
                return (
                  <button
                    key={d.date}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={d.off}
                    onClick={() => setFormData((prev) => ({ ...prev, date: d.date }))}
                    aria-label={`${dayLabel(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}${d.off ? ` — ${t.off}` : ''}`}
                    className={`snap-start flex-shrink-0 w-16 rounded-xl border py-2 text-center transition-colors ${
                      d.off ? 'bg-gray-100 border-gray-100 text-gray-500 cursor-not-allowed'
                        : on ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                          : 'bg-white border-gray-300 text-gray-900 hover:border-primary-400'}`}
                  >
                    <span className={`block text-[11px] font-medium ${on ? 'text-primary-100' : ''}`}>
                      {d.off ? t.off : d.rel === 'today' ? t.today : d.rel === 'tomorrow' ? t.tomorrow : dayLabel(d.date, { month: 'short' })}
                    </span>
                    <span className="block text-lg font-extrabold leading-tight">{d.dayNum}</span>
                    <span className={`block text-[11px] ${on ? 'text-primary-100' : ''}`}>{dayLabel(d.date, { weekday: 'short' })}</span>
                  </button>
                );
              })}
            </div>
            {/* Any later date */}
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <span className="whitespace-nowrap">{t.otherDate}</span>
              <input
                type="date"
                value={inTiles ? '' : formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                min={getTodayString()}
                aria-label={t.dateLabel}
                className={`px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none ${!inTiles && formData.date ? 'border-primary-500 bg-primary-50' : 'border-gray-300'}`}
              />
            </label>

            {/* Free times, grouped Morning / Afternoon / Evening / Night */}
            <div className="mt-4">
              {slotsLoading ? (
                <p className="px-3 py-3 bg-gray-50 rounded-lg text-gray-600 text-sm" role="status">{t.slotsLoading}</p>
              ) : !formData.date ? (
                <p className="px-3 py-3 bg-gray-50 rounded-lg text-gray-600 text-sm">{t.pickDayFirst}</p>
              ) : availableSlots.length === 0 ? (
                <p className="px-3 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{slotsMessage || t.noSlots}</p>
              ) : (
                <>
                  <div className="space-y-3" role="radiogroup" aria-label={t.slotLabel}>
                    {groupSlots(availableSlots).map((g) => (
                      <div key={g.key}>
                        <p className="text-xs font-bold text-gray-700 mb-1.5">{g.icon} {t.groups[g.key]}</p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {g.items.map((slot) => {
                            const on = formData.timeSlot === slot;
                            return (
                              <button
                                key={slot}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => setFormData((prev) => ({ ...prev, timeSlot: slot }))}
                                className={`py-2.5 rounded-lg border text-sm font-semibold transition-colors ${on ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 text-gray-900 hover:border-primary-400 hover:bg-primary-50'}`}
                              >
                                {slotStart(slot)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-green-700 mt-2">{t.slotsFree(availableSlots.length)}</p>
                </>
              )}
              {slotLostNote && !formData.timeSlot && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2" role="status">{t.slotLost(slotLostNote)}</p>
              )}
            </div>
          </section>

          {/* ---- 2. How & for whom? ---- */}
          <section ref={stepRefs.who} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 space-y-4 scroll-mt-24" aria-labelledby="step-how">
            <div id="step-how">{stepHead(2, t.howWho)}</div>

            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">{t.consultType}</p>
              <div className={`grid gap-2 ${modes.length === 1 ? 'grid-cols-1' : modes.length === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`} role="radiogroup" aria-label={t.consultType}>
                {[
                  { key: 'phone', icon: '📞', label: t.phone },
                  { key: 'video', icon: '📹', label: t.video },
                  { key: 'in-person', icon: '🏥', label: t.inPerson },
                ].filter((m) => modes.includes(m.key)).map((m) => {
                  const on = formData.consultationType === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setFormData((prev) => ({ ...prev, consultationType: m.key }))}
                      className={`flex items-start gap-3 text-left px-3 py-3 rounded-xl border transition-colors ${on ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-200' : 'border-gray-300 bg-white hover:border-primary-400'}`}
                    >
                      <span className="text-2xl leading-none" aria-hidden="true">{m.icon}</span>
                      <span className="min-w-0">
                        <span className={`block text-sm font-bold ${on ? 'text-primary-800' : 'text-gray-900'}`}>{m.label}</span>
                        <span className="block text-xs text-gray-600 mt-0.5 line-clamp-2">{modeHint[m.key]}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {modes.length === 1 && <p className="text-xs text-gray-600 mt-2">{t.onlyMode(formatDoctorName(doctor?.name).replace(/^Dr\. /, ''))}</p>}
              {modeSwitched && <p className="text-xs text-amber-800 mt-2">{t.modeSwitched(formatDoctorName(doctor?.name).replace(/^Dr\. /, ''))}</p>}
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">{t.forWhom}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.forWhom}>
                <button type="button" role="radio" aria-checked={bookedFor === 'self'} onClick={() => { setBookedFor('self'); setSelectedFamilyMember(''); }} className={chip(bookedFor === 'self')}>
                  {t.myselfChip}
                </button>
                {familyMembers.map((m) => {
                  const on = bookedFor === 'family' && selectedFamilyMember === m.name;
                  return (
                    <button key={m._id} type="button" role="radio" aria-checked={on} onClick={() => { setBookedFor('family'); setSelectedFamilyMember(m.name); }} className={chip(on)}>
                      👤 {m.name}{m.age ? ` (${m.age})` : ''}
                    </button>
                  );
                })}
                <Link to={`/dashboard?tab=familyMembers&back=${encodeURIComponent(`/book-appointment/${doctorId}`)}`} className="inline-flex items-center px-3.5 py-2 rounded-full border border-dashed border-gray-400 text-sm font-medium text-primary-700 hover:bg-primary-50">
                  {t.addMember}
                </Link>
              </div>
              {bookedFor === 'family' && !selectedFamilyMember && <p className="text-xs text-amber-800 mt-2">{t.missing.who}</p>}
            </div>

            {/* The account holder's medical info (self-booking only) — read live
                from their profile so the doctor always sees the current version. */}
            {bookedFor === 'self' && (
              hasMedicalInfo(user) ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-900">
                  <p className="font-medium mb-1">{t.medInfoOnFile}</p>
                  <ul className="text-green-800 space-y-0.5 list-disc list-inside">
                    {user.allergies && <li>{t.lblAllergies}: {user.allergies}</li>}
                    {user.currentMedications && <li>{t.lblMedications}: {user.currentMedications}</li>}
                    {user.medicalHistory && <li>{t.lblHistory}: {user.medicalHistory}</li>}
                    {user.bloodGroup && <li>{t.lblBlood}: {user.bloodGroup}</li>}
                    {user.emergencyContactName && <li>{t.lblEmergency}: {user.emergencyContactName}</li>}
                    {user.insuranceProvider && <li>{t.lblInsurance}: {user.insuranceProvider}</li>}
                  </ul>
                  <Link to={`/dashboard?tab=account&back=${encodeURIComponent(`/book-appointment/${doctorId}`)}`} className="text-green-800 underline text-xs mt-1 inline-block">
                    {t.updateIfChanged}
                  </Link>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900">
                  {t.addMedPrompt}{' '}
                  <Link to={`/dashboard?tab=account&back=${encodeURIComponent(`/book-appointment/${doctorId}`)}`} className="underline font-medium">
                    {t.addInSettings}
                  </Link>
                </div>
              )
            )}
          </section>

          {/* ---- 3. What's the problem? ---- */}
          <section ref={stepRefs.reason} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 space-y-3 scroll-mt-24" aria-labelledby="step-problem">
            <div id="step-problem">{stepHead(3, t.problem)}</div>
            <div className="flex flex-wrap gap-2" aria-label={t.symptomsLabel} role="group">
              {symptomList.map((s) => {
                const on = symptoms.includes(s.en);
                return (
                  <button key={s.en} type="button" aria-pressed={on} onClick={() => toggleSymptom(s.en)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${on ? 'border-primary-600 bg-primary-50 text-primary-800 font-semibold' : 'border-gray-300 text-gray-800 hover:border-primary-400'}`}>
                    {on ? '✓ ' : ''}{lang === 'hi' ? s.hi : s.en}
                  </button>
                );
              })}
            </div>
            <div>
              <label htmlFor="book-reason" className="block text-sm font-semibold text-gray-800 mb-1">{t.reasonLabel}</label>
              <div className="relative">
                <textarea
                  id="book-reason"
                  value={formData.reason}
                  onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder={t.reasonPh2}
                  rows={3}
                  className={`w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none ${voiceOk ? 'pr-14' : ''}`}
                  required
                />
                {voiceOk && (
                  <VoiceSearch
                    lang={lang}
                    hideHint
                    onResult={(said) => setFormData((prev) => ({ ...prev, reason: prev.reason.trim() ? `${prev.reason.trim()} ${said}` : said }))}
                  />
                )}
              </div>
              {voiceOk && <p className="text-xs text-gray-600 mt-1">{t.voiceHint}</p>}
            </div>
          </section>

          {/* Consent (bilingual: English + Hindi) */}
          <label ref={stepRefs.consent} className="flex items-start gap-2 cursor-pointer bg-white border border-gray-200 rounded-2xl p-4 scroll-mt-24">
            <input
              type="checkbox"
              id="consent"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="w-5 h-5 mt-0.5 text-primary-600 rounded focus:ring-primary-500 flex-shrink-0"
            />
            <span className="text-xs text-gray-700 space-y-1">
              <span className="block">
                I agree to the <a href="/terms" target="_blank" className="text-primary-700 underline">Terms &amp; Conditions</a> and consent to teleconsultation. I understand this is not an emergency service.
              </span>
              <span className="block text-gray-600">
                मैं <a href="/terms" target="_blank" className="text-primary-700 underline">नियम और शर्तों</a> से सहमत हूँ और टेलीकंसल्टेशन के लिए अपनी सहमति देता/देती हूँ। मैं समझता/समझती हूँ कि यह आपातकालीन सेवा नहीं है।
              </span>
            </span>
          </label>

          {/* Tablet/desktop: summary + Book inline (phones use the sticky bar). */}
          <div className="hidden md:flex items-center justify-between gap-4 bg-white rounded-2xl border border-gray-200 p-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{summary}</p>
              {doctor?.consultationFee > 0 && <p className="text-sm"><span className="font-extrabold text-green-700">Rs. {doctor.consultationFee}</span> <span className="text-gray-600">· {t.payAfter}</span></p>}
            </div>
            <button type="submit" onClick={onBookTap} disabled={isSubmitting} aria-disabled={!!missing} className={`btn btn-primary px-8 ${missing ? 'opacity-70' : ''}`}>
              {isSubmitting ? t.booking : t.bookNow}
            </button>
          </div>
        </form>

        <p className="text-gray-600 text-sm mt-4 text-center">{t.pendingNote}</p>
      </div>

      {/* Phone: what you're booking + Book, always visible above the bottom
          menu (BottomNav is fixed at bottom-0, h-16 + safe area). Shares the
          form's submit handler via form="book-form". */}
      <div className="h-36 md:hidden" aria-hidden="true" />
      <div
        className="fixed inset-x-0 z-50 md:hidden bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.08)] px-4 py-3 flex items-center gap-3"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{summary}</p>
          {doctor?.consultationFee > 0 && (
            <p className="text-xs"><span className="text-base font-extrabold text-green-700">Rs. {doctor.consultationFee}</span> <span className="text-gray-600">{t.payAfter}</span></p>
          )}
        </div>
        <button
          type="submit"
          form="book-form"
          onClick={onBookTap}
          disabled={isSubmitting}
          aria-disabled={!!missing}
          className={`btn btn-primary flex-shrink-0 ${missing ? 'opacity-70' : ''}`}
        >
          {isSubmitting ? t.booking : t.bookNow}
        </button>
      </div>
    </div>
  );
}

export default BookAppointment;
