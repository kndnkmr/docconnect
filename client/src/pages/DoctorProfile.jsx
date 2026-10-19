// ============================================
// Doctor Profile Page - View Single Doctor
// ============================================
// Displays a doctor's full profile with details, and a button to book.
//
// KEY CONCEPTS:
// - useParams(): get the :id from the URL
// - Conditional rendering: show different content based on data
// - Loading/error states
// - Link with dynamic params

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doctorAPI, reviewAPI, availabilityAPI, getUploadUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/SEO';
import { DoctorSchema } from '../components/StructuredData';
import VerifiedBadge from '../components/VerifiedBadge';
import LangToggle from '../components/LangToggle';
import { formatDoctorName } from '../utils/formatName';
import { trackEvent } from '../components/Analytics';
import toast from 'react-hot-toast';

// Patient-facing → bilingual via shared promedicoz_lang. Only fixed labels
// translate; doctor-entered content (name, specialization, bio, address,
// review text) is shown as-is.
const TXT = {
  en: {
    loading: 'Loading profile...',
    notFoundTitle: 'Doctor Not Found', notFoundMsg: "This profile doesn't exist or was removed.",
    backToDoctors: '← Back to all doctors',
    verified: 'Verified by ProMedicoz',
    yrsExp: (y) => `${y} yrs experience`,
    feeBadge: (f) => `Rs. ${f} consultation`,
    consultsDone: (n) => `✅ ${n} consultation${n > 1 ? 's' : ''} completed`,
    newDoctor: '🆕 New on ProMedicoz',
    inPerson: '🏥 In-Person', video: '📹 Video', phone: '📞 Phone',
    speaks: 'Speaks', bookAppointment: 'Book Appointment',
    messageWhatsApp: 'Message on WhatsApp', shareWhatsApp: 'Share via WhatsApp',
    loginToBook: 'Log in to Book Appointment', noAccount: 'New to ProMedicoz?', signUpFree: 'Create a free account →',
    about: 'About', clinicAddress: 'Clinic Address', getDirections: '📍 Get Directions',
    patientReviews: 'Patient Reviews', noReviews: 'No reviews yet. Be the first to consult and rate!',
    ratingBadge: (avg, n) => `⭐ ${avg} / 5 (${n} review${n > 1 ? 's' : ''})`,
    doctorReplyLabel: "Doctor's reply", reply: 'Reply', editReply: 'Edit reply',
    replyPlaceholder: 'Write a public reply…', postReply: 'Post reply', cancel: 'Cancel',
    // Availability signal shown in the header + sticky bar
    availableToday: '🟢 Available today', nextAvailable: (label) => `Next available: ${label}`,
    nextToday: (time) => `Available today at ${time}`,
    nextTomorrow: (time) => `Available tomorrow at ${time}`,
    nextOn: (day, time) => `Next available ${day} at ${time}`,
    pickSlot: 'Pick a time slot', feeFrom: (f) => `Rs. ${f}`, feeConsult: 'consultation',
    newRatingPlaceholder: '🆕 New on ProMedicoz',
  },
  hi: {
    loading: 'प्रोफ़ाइल लोड हो रही है...',
    notFoundTitle: 'डॉक्टर नहीं मिला', notFoundMsg: 'यह प्रोफ़ाइल मौजूद नहीं है या हटा दी गई है।',
    backToDoctors: '← सभी डॉक्टर पर वापस जाएं',
    verified: 'ProMedicoz द्वारा सत्यापित',
    yrsExp: (y) => `${y} वर्ष का अनुभव`,
    feeBadge: (f) => `Rs. ${f} परामर्श`,
    consultsDone: (n) => `✅ ${n} परामर्श पूरे`,
    newDoctor: '🆕 ProMedicoz पर नया',
    inPerson: '🏥 क्लिनिक पर', video: '📹 वीडियो', phone: '📞 फ़ोन',
    speaks: 'बोलते हैं', bookAppointment: 'अपॉइंटमेंट बुक करें',
    messageWhatsApp: 'WhatsApp पर संदेश भेजें', shareWhatsApp: 'WhatsApp पर साझा करें',
    loginToBook: 'अपॉइंटमेंट बुक करने के लिए लॉग इन करें', noAccount: 'ProMedicoz पर नए हैं?', signUpFree: 'मुफ़्त खाता बनाएं →',
    about: 'परिचय', clinicAddress: 'क्लिनिक का पता', getDirections: '📍 रास्ता देखें',
    patientReviews: 'मरीज़ों की समीक्षाएं', noReviews: 'अभी कोई समीक्षा नहीं। पहले परामर्श लें और रेटिंग दें!',
    ratingBadge: (avg, n) => `⭐ ${avg} / 5 (${n} समीक्षा${n > 1 ? 'एं' : ''})`,
    doctorReplyLabel: 'डॉक्टर का जवाब', reply: 'जवाब दें', editReply: 'जवाब संपादित करें',
    replyPlaceholder: 'सार्वजनिक जवाब लिखें…', postReply: 'जवाब पोस्ट करें', cancel: 'रद्द करें',
    availableToday: '🟢 आज उपलब्ध', nextAvailable: (label) => `अगली उपलब्धता: ${label}`,
    nextToday: (time) => `आज ${time} बजे उपलब्ध`,
    nextTomorrow: (time) => `कल ${time} बजे उपलब्ध`,
    nextOn: (day, time) => `अगली उपलब्धता ${day} को ${time} बजे`,
    pickSlot: 'समय स्लॉट चुनें', feeFrom: (f) => `Rs. ${f}`, feeConsult: 'परामर्श',
    newRatingPlaceholder: '🆕 ProMedicoz पर नया',
  },
};

// ============================================
// Curated (offline-collected) reviews, per doctor
// ============================================
// Some patients gave genuine feedback offline/verbally (they consulted but
// didn't know how to submit a review in the app). These are REAL reviews, so
// we surface them on the doctor's profile — but kept separate from the DB
// reviews and clearly attributed. Keyed by the doctor's name (lowercased,
// trimmed). To add a doctor, add a `name` → [reviews] entry. Each review:
// { rating, comment, name } — name is the patient's first name/initial.
//
// These merge with (never replace) any real in-app DB reviews the doctor has,
// and feed the rating summary so the average/stars reflect all real feedback.
const CURATED_DOCTOR_REVIEWS = {
  'pooja singh': [
    { rating: 5, comment: 'Dr. Pooja is an incredible gynecologist — her virtual consultation gave me the exact guidance and relief I needed for period pain right when I needed it.', name: 'Naina' },
    { rating: 5, comment: 'A huge thank you to Dr. Pooja; her online consultation provided fast, compassionate relief for my severe period pain without the hassle of a clinic visit.', name: 'Geeta' },
    { rating: 5, comment: 'Highly recommend Dr. Pooja for gynecological consultations. She explained the root cause of my menstrual pain clearly and provided a very effective management plan online.', name: 'Kia' },
    { rating: 5, comment: 'Dr. Pooja listened patiently and gave me clear, practical medical steps I needed to get my cycle back on track.', name: 'Sonam Tiwari' },
    { rating: 5, comment: 'The most comfortable way to get expert gynecological advice — thank you, Dr. Pooja, for making women\u2019s healthcare so accessible!', name: 'Sagufta Sultana' },
    { rating: 5, comment: 'Dr. Pooja gave me a clear management plan that has truly restored my energy. Caring and thorough.', name: 'Mandakini Chandrakar' },
  ],
};

// Look up curated reviews for a doctor by name (case/space-insensitive).
const getCuratedReviews = (doctorName) => {
  if (!doctorName) return [];
  const key = String(doctorName).trim().toLowerCase().replace(/\s+/g, ' ');
  return CURATED_DOCTOR_REVIEWS[key] || [];
};

function DoctorProfile() {
  const { id } = useParams();
  // If URL is /doctors/abc123, then id = "abc123"

  const [lang, setLang] = useState(() => localStorage.getItem('promedicoz_lang') || 'en');
  const t = TXT[lang];
  const { isAuthenticated, isPatient, user } = useAuth();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ averageRating: 0, totalReviews: 0 });
  // Live availability: next free slot + a few quick-pick slots for today.
  // Fetched from the public free-slots endpoint so it reflects real, unbooked,
  // future times (never fabricated). `null` until loaded or if none found.
  const [nextSlot, setNextSlot] = useState(null); // { date, dayName, time, isToday }
  const [todaySlots, setTodaySlots] = useState([]); // quick-pick chips for today
  // Doctor reply UI: which review is open for reply, and the draft text.
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);

  // True when the logged-in user is the doctor whose profile this is —
  // gates the "Reply" controls to only their own reviews.
  const isOwnProfile = isAuthenticated && user && doctor && user._id === doctor._id;

  // Merge any curated (offline-collected) real reviews for this doctor with
  // the in-app DB reviews, and recompute the rating summary over the combined
  // set so the average/stars reflect ALL genuine feedback. Curated entries are
  // tagged (isCurated) so the UI can attribute them and skip doctor-reply
  // controls (there's no DB record to reply to). DB reviews come first.
  const curatedReviews = (getCuratedReviews(doctor?.name) || []).map((r, i) => ({
    _id: `curated-${i}`,
    rating: r.rating,
    comment: r.comment,
    patient: { name: r.name },
    createdAt: null,
    isCurated: true,
  }));
  const allReviews = [...reviews, ...curatedReviews];
  const combinedStats = (() => {
    const total = allReviews.length;
    if (total === 0) return { averageRating: 0, totalReviews: 0 };
    const sum = allReviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return { averageRating: Math.round((sum / total) * 10) / 10, totalReviews: total };
  })();

  // Friendly label for the next-available signal (today / tomorrow / weekday).
  const availabilityLabel = (() => {
    if (!nextSlot) return null;
    if (nextSlot.isToday) return t.nextToday(nextSlot.time);
    // Is the next slot tomorrow (IST)?
    const tomorrow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    if (nextSlot.date === tomorrowStr) return t.nextTomorrow(nextSlot.time);
    return t.nextOn(nextSlot.dayName, nextSlot.time);
  })();

  // Shared click handler for any "book" entry point (keeps analytics consistent).
  const trackBook = (authState) => trackEvent('book_appointment_click', {
    doctor_id: doctor?._id,
    doctor_specialization: doctor?.specialization || 'unknown',
    auth_state: authState,
  });

  // Reusable reviews fetch (also called after posting a reply to refresh).
  const loadReviews = async () => {
    try {
      const reviewResponse = await reviewAPI.getDoctorReviews(id);
      setReviews(reviewResponse.data.reviews);
      setReviewStats(reviewResponse.data.stats);
    } catch (error) {
      console.error('Fetch reviews error:', error);
    }
  };

  const handleReply = async (reviewId) => {
    if (!replyText.trim()) { toast.error('Please write a reply'); return; }
    setReplySaving(true);
    try {
      await reviewAPI.reply(reviewId, replyText.trim());
      toast.success('Reply posted');
      setReplyingTo(null);
      setReplyText('');
      await loadReviews();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to post reply');
    } finally {
      setReplySaving(false);
    }
  };

  // Fetch doctor data when component loads
  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        const response = await doctorAPI.getById(id);
        setDoctor(response.data.doctor);
      } catch (error) {
        toast.error('Failed to load doctor profile');
        console.error('Fetch doctor error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctor();
    loadReviews();
  }, [id]);
  // [id] = re-fetch if the ID in the URL changes

  // Fetch the earliest real free slot (searches up to 14 days, IST), plus a few
  // quick-pick slots for the first day that has any. Uses the SAME public
  // free-slots endpoint the booking page uses, so what we show here matches
  // what's actually bookable. Fails quietly — availability is a nice-to-have
  // signal, never allowed to break the profile.
  useEffect(() => {
    let cancelled = false;
    const findNextAvailable = async () => {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      // "Today" in IST so the date strings line up with the backend.
      const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      for (let offset = 0; offset < 14; offset++) {
        if (cancelled) return;
        const d = new Date(istNow);
        d.setDate(d.getDate() + offset);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        try {
          const res = await availabilityAPI.getFreeSlots(id, dateStr);
          const slots = res.data.slots || [];
          if (slots.length > 0) {
            if (cancelled) return;
            const firstStart = (slots[0] || '').split(' - ')[0]; // "09:30 AM"
            setNextSlot({ date: dateStr, dayName: dayNames[d.getDay()], time: firstStart, isToday: offset === 0 });
            // Only surface quick-pick chips when the soonest day is today or
            // tomorrow — further out, a single "next available" line is clearer.
            if (offset <= 1) setTodaySlots(slots.slice(0, 4).map((s) => ({ date: dateStr, label: s })));
            return;
          }
        } catch { /* ignore this day, keep looking */ }
      }
    };
    findNextAvailable();
    return () => { cancelled = true; };
  }, [id]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg text-gray-600">{t.loading}</div>
      </div>
    );
  }

  // Doctor not found
  if (!doctor) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-2xl font-bold text-gray-800">{t.notFoundTitle}</h2>
          <p className="text-gray-600 mt-2">{t.notFoundMsg}</p>
          <Link to="/doctors" className="text-primary-600 hover:underline mt-4 inline-block">
            {t.backToDoctors}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SEO
        title={doctor ? `${formatDoctorName(doctor.name)} - ${doctor.specialization || 'Doctor'}` : 'Doctor Profile'}
        description={doctor ? `Book appointment with ${formatDoctorName(doctor.name)} (${doctor.specialization || 'General Physician'}). ${doctor.experience || 0} years experience. Consultation fee: Rs. ${doctor.consultationFee || 'N/A'}.` : ''}
        path={`/doctors/${id}`}
        type="profile"
      />
      {doctor && <DoctorSchema doctor={doctor} />}

      {/* Gradient header band — carries the back link plus the trust signals
          a patient wants up front (rating + live availability). This makes the
          profile open as rich as the listing card promised, instead of a near
          empty band. All signals use real data and are hidden when absent. */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="container mx-auto px-4 pt-6 pb-16">
          <div className="flex items-center justify-between gap-3">
            <Link to="/doctors" className="text-primary-100 hover:text-white text-sm inline-flex items-center gap-1 transition-colors">
              {t.backToDoctors}
            </Link>
            {/* Language toggle — lets a patient switch EN/हिंदी here too, not
                just on Home. Shares the same promedicoz_lang choice site-wide. */}
            <LangToggle lang={lang} onChange={setLang} />
          </div>

          {/* Signal chips — only render the ones we actually have data for. */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {combinedStats.totalReviews > 0 && (
              <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium">
                ⭐ {combinedStats.averageRating} <span className="text-primary-100">/ 5 · {combinedStats.totalReviews}</span>
              </span>
            )}
            {nextSlot && nextSlot.isToday && (
              <span className="inline-flex items-center gap-1 bg-green-400/20 text-green-50 px-3 py-1.5 rounded-full text-sm font-medium">
                {t.availableToday}
              </span>
            )}
            {availabilityLabel && !(nextSlot && nextSlot.isToday) && (
              <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium">
                🕐 {availabilityLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-10">
      {/* Two-column "decision layout" on desktop: a rich profile/detail column
          on the left, and a sticky booking card on the right that stays in view
          while the patient reads. On mobile everything stacks and the existing
          sticky bottom bar carries the primary action. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 -mt-10 relative z-10 items-start">
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* ---- Header Section (photo + basic info) ---- */}
        {/* Stacked & centered on mobile, side-by-side on desktop — avoids a
            giant colored box on small screens and keeps info tidy either way. */}
        <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 md:items-start">
          {/* Avatar — a green "available today" ring is added only when the
              doctor genuinely has a free slot today (real data), so it stays
              honest and simply disappears otherwise. */}
          <div className="flex-shrink-0 mx-auto md:mx-0">
            <div className={`rounded-full p-1 ${nextSlot && nextSlot.isToday ? 'ring-4 ring-green-400/70' : ''}`}>
            {doctor.profilePhoto ? (
              <img
                src={getUploadUrl(doctor.profilePhoto, { width: 300 })}
                alt={doctor.name}
                className="w-32 h-32 md:w-36 md:h-36 rounded-full object-cover border-4 border-white shadow-sm"
              />
            ) : (
              <div className="w-32 h-32 md:w-36 md:h-36 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-6xl border-4 border-white">
                🧑‍⚕️
              </div>
            )}
            </div>
          </div>

          {/* Basic Info */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center justify-center md:justify-start gap-2">
              {formatDoctorName(doctor.name)}
              {doctor.isAdminVerified && <VerifiedBadge size={22} />}
            </h1>
            {doctor.isAdminVerified && (
              <p className="text-xs text-blue-600 font-medium mt-0.5">{t.verified}</p>
            )}

            {doctor.specialization && (
              <p className="text-primary-600 text-lg font-medium mt-1">
                {doctor.specialization}
              </p>
            )}

            {doctor.qualification && (
              <p className="text-gray-600 mt-1">{doctor.qualification}</p>
            )}

            {doctor.medicalRegistrationNo && (
              <p className="text-gray-500 text-sm mt-1">
                Medical Registration No: <span className="font-medium text-gray-700">{doctor.medicalRegistrationNo}</span>
              </p>
            )}

            {/* Quick facts as icon stat tiles — far more scannable than a row
                of identical grey pills. Each tile renders only when we have
                that data (fee shown exactly as the doctor set it, never a
                default). On mobile they sit in a 2-col grid; inline-ish on
                desktop. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
              {doctor.experience > 0 && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 flex items-center gap-2.5 text-left">
                  <span className="text-xl" aria-hidden="true">🎓</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-800 leading-none">{doctor.experience}{lang === 'hi' ? ' वर्ष' : ' yrs'}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{lang === 'hi' ? 'अनुभव' : 'experience'}</div>
                  </div>
                </div>
              )}
              {doctor.consultationFee > 0 && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 flex items-center gap-2.5 text-left">
                  <span className="text-xl" aria-hidden="true">🧾</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-800 leading-none">Rs. {doctor.consultationFee}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{lang === 'hi' ? 'परामर्श' : 'consultation'}</div>
                  </div>
                </div>
              )}
              {doctor.completedConsultations > 0 ? (
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 flex items-center gap-2.5 text-left">
                  <span className="text-xl" aria-hidden="true">✅</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-800 leading-none">{doctor.completedConsultations}+</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{lang === 'hi' ? 'परामर्श पूरे' : 'consults done'}</div>
                  </div>
                </div>
              ) : curatedReviews.length === 0 ? (
                /* "New on ProMedicoz" only for genuinely new doctors. An
                   established doctor who already has patient reviews (e.g. ones
                   collected before they were on the platform) is NOT new, so we
                   suppress the badge for them rather than mislabel them. */
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 flex items-center gap-2.5 text-left">
                  <span className="text-xl" aria-hidden="true">🆕</span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-indigo-700 leading-tight">{lang === 'hi' ? 'ProMedicoz पर नया' : 'New on ProMedicoz'}</div>
                  </div>
                </div>
              ) : null}
              {doctor.city && doctor.city.trim() && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 flex items-center gap-2.5 text-left">
                  <span className="text-xl flex-shrink-0" aria-hidden="true">📍</span>
                  <div className="min-w-0">
                    {/* Full city shown (no truncation) — long names like
                        "Chhattisgarh" were being clipped to "Chhattisg…".
                        leading-tight lets it wrap to a second line if needed. */}
                    <div className="text-sm font-bold text-gray-800 leading-tight break-words">{doctor.city.trim()}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{lang === 'hi' ? 'स्थान' : 'location'}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Consultation modes — polished bordered pills (how the doctor
                consults). Tinted per mode for quick scanning. */}
            {doctor.consultationModes && doctor.consultationModes.length > 0 && (
              <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                {doctor.consultationModes.includes('video') && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-full text-xs font-medium">{t.video}</span>}
                {doctor.consultationModes.includes('phone') && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-100 rounded-full text-xs font-medium">{t.phone}</span>}
                {doctor.consultationModes.includes('in-person') && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-medium">{t.inPerson}</span>}
              </div>
            )}

            {/* Languages the doctor can consult in */}
            {doctor.languagesSpoken && doctor.languagesSpoken.length > 0 && (
              <p className="text-gray-600 text-sm mt-3 text-center md:text-left">
                <span aria-hidden="true">🗣️</span> <span className="font-semibold text-gray-700">{t.speaks}:</span> {doctor.languagesSpoken.join(', ')}
              </p>
            )}

            {/* Quick-pick slots — real, bookable times for the soonest day.
                Tapping one takes the patient into the booking page with that
                time carried through; nothing is auto-chosen for them — they
                still confirm on the booking page. Only shown to logged-in
                patients (who can book); logged-out users get the login CTA. */}
            {isAuthenticated && isPatient && todaySlots.length > 0 && (
              <div className="mt-6 lg:hidden">
                <p className="text-xs font-medium text-gray-500 mb-2 text-center md:text-left">{t.pickSlot}</p>
                <div className="flex flex-wrap justify-center md:justify-start gap-2">
                  {todaySlots.map((slot) => (
                    <Link
                      key={`${slot.date}-${slot.label}`}
                      to={`/book-appointment/${doctor._id}?date=${slot.date}&slot=${encodeURIComponent(slot.label)}`}
                      onClick={() => trackBook('logged_in')}
                      className="px-3 py-1.5 rounded-lg border border-primary-200 bg-primary-50 text-primary-700 text-sm font-medium hover:bg-primary-100 hover:border-primary-300 transition-colors"
                    >
                      {(slot.label || '').split(' - ')[0]}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Actions. The primary Book button here is hidden on large screens
                (lg:hidden) because the sticky right-column card carries it on
                desktop; it stays visible on mobile/tablet. WhatsApp message +
                Share remain on every size. */}
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 mt-5">
              {isAuthenticated && isPatient && (
                <Link
                  to={`/book-appointment/${doctor._id}`}
                  onClick={() => trackBook('logged_in')}
                  className="btn btn-primary px-7 text-base lg:hidden"
                >
                  📅 {t.bookAppointment}
                </Link>
              )}

              {/* Direct line to the doctor, if they've set one — separate
                  from "Share via WhatsApp" below, which shares the PROFILE
                  LINK with someone else, not a message TO the doctor. */}
              {doctor.whatsappNumber && (
                <a
                  href={`https://wa.me/${doctor.whatsappNumber.replace('+', '')}?text=${encodeURIComponent(`Hi ${formatDoctorName(doctor.name)}, I would like to consult with you.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-success px-4"
                >
                  <span>💬</span> {t.messageWhatsApp}
                </a>
              )}

              <button
                onClick={() => {
                  const shareUrl = window.location.href;
                  const shareText = `Check out ${formatDoctorName(doctor.name)} (${doctor.specialization || 'Doctor'}) on ProMedicoz - ${shareUrl}`;
                  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
                  trackEvent('share_doctor', { doctor_id: doctor._id, method: 'whatsapp' });
                  window.open(whatsappUrl, '_blank');
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
              >
                <span>📤</span> {t.shareWhatsApp}
              </button>
            </div>

            {!isAuthenticated && (
              <div className="mt-4 lg:hidden">
                <Link
                  to="/login"
                  onClick={() => trackEvent('book_appointment_click', {
                    doctor_id: doctor._id,
                    doctor_specialization: doctor.specialization || 'unknown',
                    auth_state: 'logged_out',
                  })}
                  className="btn btn-primary"
                >
                  {t.loginToBook}
                </Link>
                <p className="mt-2 text-sm text-gray-500">
                  {t.noAccount}{' '}
                  <Link to="/register" className="text-primary-600 hover:underline font-medium whitespace-nowrap">{t.signUpFree}</Link>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ---- Details Section ---- */}
        {(doctor.bio || doctor.clinicAddress) && (
        <div className="border-t p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* About — soft card with an accent icon heading instead of a bare
                text header, so the section reads as a designed block. */}
            {doctor.bio && (
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5">
                <h2 className="flex items-center gap-2 text-base font-bold text-gray-800 mb-2.5">
                  <span className="w-8 h-8 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center text-lg flex-shrink-0" aria-hidden="true">👤</span>
                  {t.about}
                </h2>
                <p className="text-gray-600 leading-relaxed text-sm">{doctor.bio}</p>
              </div>
            )}

            {/* Clinic Address — matching card with a maps accent + a proper
                "Get Directions" pill button. */}
            {doctor.clinicAddress && (
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5">
                <h2 className="flex items-center gap-2 text-base font-bold text-gray-800 mb-2.5">
                  <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center text-lg flex-shrink-0" aria-hidden="true">📍</span>
                  {t.clinicAddress}
                </h2>
                <p className="text-gray-600 text-sm leading-relaxed">{doctor.clinicAddress}</p>
                <a
                  href={doctor.googleMapsLink || `https://maps.google.com?q=${encodeURIComponent(doctor.clinicAddress || doctor.city || '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm text-primary-700 hover:bg-primary-50 hover:border-primary-200 font-medium transition-colors"
                >
                  {t.getDirections}
                </a>
              </div>
            )}
          </div>
        </div>
        )}

        {/* ---- Reviews Section ---- */}
        <div className="border-t p-6 md:p-8">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-5">
            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center text-lg flex-shrink-0" aria-hidden="true">⭐</span>
            {t.patientReviews}
          </h2>

          {/* Rating summary — a big average + a star-distribution bar, so the
              overall sentiment is readable at a glance. Computed over all real
              feedback (in-app DB reviews + offline-collected curated reviews). */}
          {combinedStats.totalReviews > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6 mb-6 pb-6 border-b border-gray-100">
              {/* Score card — number on top, stars beneath, count on its own
                  line, so nothing collides regardless of screen width. */}
              <div className="flex-shrink-0 bg-amber-50 border border-amber-100 rounded-2xl px-6 py-4 text-center sm:w-44">
                <div className="text-4xl font-extrabold text-gray-800 leading-none">{combinedStats.averageRating}</div>
                <div className="text-yellow-500 text-base mt-1.5">{'★'.repeat(Math.round(combinedStats.averageRating))}<span className="text-amber-200">{'★'.repeat(5 - Math.round(combinedStats.averageRating))}</span></div>
                <div className="text-xs text-amber-800 mt-1.5">
                  {lang === 'hi' ? `${combinedStats.totalReviews} समीक्षाओं पर आधारित` : `Based on ${combinedStats.totalReviews} review${combinedStats.totalReviews > 1 ? 's' : ''}`}
                </div>
              </div>
              {/* Distribution bars (5★→1★) computed over all reviews. */}
              <div className="flex-1 space-y-1.5 min-w-0">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = allReviews.filter((r) => r.rating === star).length;
                  const pct = allReviews.length > 0 ? Math.round((count / allReviews.length) * 100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="w-6 flex-shrink-0">{star}★</span>
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className="w-6 text-right flex-shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {allReviews.length === 0 ? (
            <p className="text-gray-500">{t.noReviews}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allReviews.map((review) => {
                // Stable colour for the avatar initial, derived from the name
                // so each patient keeps a consistent tint (purely cosmetic).
                const palette = ['bg-pink-100 text-pink-700', 'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-violet-100 text-violet-700', 'bg-cyan-100 text-cyan-700'];
                const pname = review.patient?.name || 'Patient';
                const tint = palette[(pname.charCodeAt(0) || 0) % palette.length];
                return (
                <div key={review._id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col">
                  {/* Top row: avatar initial + name + stars. Name sits on its
                      own line here, so it can never overlap the review text. */}
                  <div className="flex items-center gap-3">
                    <span className={`flex-shrink-0 w-9 h-9 rounded-full ${tint} flex items-center justify-center text-sm font-bold`} aria-hidden="true">
                      {pname.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{pname}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-500 text-sm leading-none">{'★'.repeat(review.rating)}<span className="text-gray-300">{'★'.repeat(5 - review.rating)}</span></span>
                        {review.createdAt && (
                          <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Review text — full width, below the header, so nothing overlaps. */}
                  {review.comment && (
                    <p className="text-gray-600 mt-3 text-sm leading-relaxed">"{review.comment}"</p>
                  )}

                  {/* Doctor's public reply, if any (DB reviews only) */}
                  {review.doctorReply && review.doctorReply.text && (
                    <div className="mt-3 ml-3 pl-3 border-l-2 border-primary-200">
                      <p className="text-xs font-semibold text-primary-700">💬 {t.doctorReplyLabel}</p>
                      <p className="text-sm text-gray-700 mt-1">{review.doctorReply.text}</p>
                    </div>
                  )}

                  {/* Doctor viewing their OWN profile: reply / edit-reply control.
                      Curated reviews have no DB record, so no reply control. */}
                  {isOwnProfile && !review.isCurated && (
                    replyingTo === review._id ? (
                      <div className="mt-3">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          maxLength={500}
                          rows={2}
                          placeholder={t.replyPlaceholder}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleReply(review._id)}
                            disabled={replySaving}
                            className="px-4 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
                          >
                            {t.postReply}
                          </button>
                          <button
                            onClick={() => { setReplyingTo(null); setReplyText(''); }}
                            className="px-4 py-1.5 text-gray-600 rounded-lg text-sm hover:bg-gray-100"
                          >
                            {t.cancel}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setReplyingTo(review._id); setReplyText(review.doctorReply?.text || ''); }}
                        className="mt-3 text-xs font-medium text-primary-600 hover:underline"
                      >
                        {review.doctorReply && review.doctorReply.text ? t.editReply : t.reply}
                      </button>
                    )
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* ---- Right column: sticky booking card (desktop only) ----
          Keeps fee, live availability, quick-pick slots and the primary Book
          action in view while the patient reads the profile. Hidden on mobile
          (lg:block) where the fixed bottom bar already carries the action.
          Everything here mirrors the left column's data/behaviour exactly —
          same links, same auth gating, same analytics — nothing new is
          auto-selected and the fee is shown exactly as the doctor set it. */}
      {!isOwnProfile && (
      <aside className="hidden lg:block">
        <div className="sticky top-24 bg-white rounded-2xl shadow-lg ring-1 ring-black/5 p-5">
          {doctor.consultationFee > 0 && (
            <div className="mb-3">
              <span className="text-2xl font-extrabold text-gray-800">Rs. {doctor.consultationFee}</span>
              <span className="text-sm text-gray-500 ml-1">{lang === 'hi' ? 'परामर्श' : 'per consultation'}</span>
            </div>
          )}

          {nextSlot && nextSlot.isToday ? (
            <div className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-100 rounded-lg px-3 py-1.5 text-sm font-medium mb-4">
              {t.availableToday}{nextSlot.time ? ` · ${nextSlot.time}` : ''}
            </div>
          ) : availabilityLabel ? (
            <div className="inline-flex items-center gap-1.5 bg-gray-50 text-gray-600 border border-gray-100 rounded-lg px-3 py-1.5 text-sm font-medium mb-4">
              🕐 {availabilityLabel}
            </div>
          ) : null}

          {/* Quick-pick slots (logged-in patients only) — tap carries the time
              into booking; nothing is auto-selected. */}
          {isAuthenticated && isPatient && todaySlots.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{t.pickSlot}</p>
              <div className="grid grid-cols-2 gap-2">
                {todaySlots.map((slot) => (
                  <Link
                    key={`aside-${slot.date}-${slot.label}`}
                    to={`/book-appointment/${doctor._id}?date=${slot.date}&slot=${encodeURIComponent(slot.label)}`}
                    onClick={() => trackBook('logged_in')}
                    className="text-center px-2 py-2 rounded-lg border border-primary-200 bg-primary-50 text-primary-700 text-sm font-medium hover:bg-primary-100 hover:border-primary-300 transition-colors"
                  >
                    {(slot.label || '').split(' - ')[0]}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Primary action — same gating as the inline buttons. */}
          {isAuthenticated && isPatient ? (
            <Link
              to={`/book-appointment/${doctor._id}`}
              onClick={() => trackBook('logged_in')}
              className="btn btn-primary w-full justify-center text-base"
            >
              📅 {t.bookAppointment}
            </Link>
          ) : !isAuthenticated ? (
            <>
              <Link
                to="/login"
                onClick={() => trackEvent('book_appointment_click', { doctor_id: doctor._id, doctor_specialization: doctor.specialization || 'unknown', auth_state: 'logged_out' })}
                className="btn btn-primary w-full justify-center"
              >
                {t.loginToBook}
              </Link>
              <p className="mt-2 text-xs text-gray-500 text-center">
                {t.noAccount}{' '}
                <Link to="/register" className="text-primary-600 hover:underline font-medium">{t.signUpFree}</Link>
              </p>
            </>
          ) : null}

          {/* Honest differentiator — reinforces the platform's edge at the
              point of decision. */}
          <p className="mt-3 text-[11px] text-center text-green-700 bg-green-50 rounded-lg py-1.5">
            {lang === 'hi' ? 'पैसे सीधे डॉक्टर को · कोई कमीशन नहीं' : 'Pay the doctor directly · no commission'}
          </p>
        </div>
      </aside>
      )}
      </div>
      </div>

      {/* Sticky mobile booking bar — the single most "big-platform" touch.
          Stays pinned at the bottom on phones while the user scrolls the
          profile, so the primary action (book / log in to book) is always one
          tap away. Hidden on md+ where the header button is already in view.
          Padding-bottom spacer below prevents it covering page content. */}
      {!isOwnProfile && (
        <>
          {/* Sits ABOVE the global BottomNav (fixed bottom-0, h-16 + safe area)
              so the nav doesn't cover the Book button for logged-in patients. */}
          <div className="h-36 md:hidden" aria-hidden="true" />
          <div
            className="fixed inset-x-0 z-50 md:hidden bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] px-4 py-3 flex items-center gap-3"
            style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
          >
            <div className="flex-1 min-w-0">
              {doctor.consultationFee > 0 ? (
                <>
                  <p className="text-lg font-bold text-gray-800 leading-none">{t.feeFrom(doctor.consultationFee)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {availabilityLabel ? availabilityLabel : t.feeConsult}
                  </p>
                </>
              ) : (
                <p className="text-sm font-medium text-gray-700">
                  {availabilityLabel || formatDoctorName(doctor.name)}
                </p>
              )}
            </div>
            {isAuthenticated && isPatient ? (
              <Link
                to={`/book-appointment/${doctor._id}`}
                onClick={() => trackBook('logged_in')}
                className="btn btn-primary flex-shrink-0"
              >
                📅 {t.bookAppointment}
              </Link>
            ) : !isAuthenticated ? (
              <Link
                to="/login"
                onClick={() => trackBook('logged_out')}
                className="btn btn-primary flex-shrink-0"
              >
                {t.bookAppointment}
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

export default DoctorProfile;
