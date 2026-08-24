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
import { doctorAPI, reviewAPI, getUploadUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/SEO';
import { DoctorSchema } from '../components/StructuredData';
import VerifiedBadge from '../components/VerifiedBadge';
import { formatDoctorName } from '../utils/formatName';
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
    feeBadge: (f) => `₹${f} consultation`,
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
  },
  hi: {
    loading: 'प्रोफ़ाइल लोड हो रही है...',
    notFoundTitle: 'डॉक्टर नहीं मिला', notFoundMsg: 'यह प्रोफ़ाइल मौजूद नहीं है या हटा दी गई है।',
    backToDoctors: '← सभी डॉक्टर पर वापस जाएं',
    verified: 'ProMedicoz द्वारा सत्यापित',
    yrsExp: (y) => `${y} वर्ष का अनुभव`,
    feeBadge: (f) => `₹${f} परामर्श`,
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
  },
};

function DoctorProfile() {
  const { id } = useParams();
  // If URL is /doctors/abc123, then id = "abc123"

  const [lang] = useState(() => localStorage.getItem('promedicoz_lang') || 'en');
  const t = TXT[lang];
  const { isAuthenticated, isPatient, user } = useAuth();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ averageRating: 0, totalReviews: 0 });
  // Doctor reply UI: which review is open for reply, and the draft text.
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);

  // True when the logged-in user is the doctor whose profile this is —
  // gates the "Reply" controls to only their own reviews.
  const isOwnProfile = isAuthenticated && user && doctor && user._id === doctor._id;

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
        description={doctor ? `Book appointment with ${formatDoctorName(doctor.name)} (${doctor.specialization || 'General Physician'}). ${doctor.experience || 0} years experience. Consultation fee: ₹${doctor.consultationFee || 'N/A'}.` : ''}
        path={`/doctors/${id}`}
        type="profile"
      />
      {doctor && <DoctorSchema doctor={doctor} />}

      {/* Slim gradient header band with the back link — keeps the page
          consistent with the Doctors listing page and gives the profile
          card something to sit against instead of bare gray. */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="container mx-auto px-4 pt-6 pb-16">
          <Link to="/doctors" className="text-primary-100 hover:text-white text-sm inline-flex items-center gap-1 transition-colors">
            {t.backToDoctors}
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-10">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden -mt-10 relative z-10">
        {/* ---- Header Section (photo + basic info) ---- */}
        {/* Stacked & centered on mobile, side-by-side on desktop — avoids a
            giant colored box on small screens and keeps info tidy either way. */}
        <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 md:items-start">
          {/* Avatar */}
          <div className="flex-shrink-0 mx-auto md:mx-0">
            {doctor.profilePhoto ? (
              <img
                src={getUploadUrl(doctor.profilePhoto, { width: 300 })}
                alt={doctor.name}
                className="w-32 h-32 md:w-36 md:h-36 rounded-full object-cover border-4 border-primary-100 shadow-sm"
              />
            ) : (
              <div className="w-32 h-32 md:w-36 md:h-36 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-6xl">
                🧑‍⚕️
              </div>
            )}
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

            {/* Quick facts as compact badges — wrap cleanly instead of scattering */}
            <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-4">
              {doctor.experience > 0 && (
                <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                  {t.yrsExp(doctor.experience)}
                </span>
              )}
              {doctor.consultationFee > 0 && (
                <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                  {t.feeBadge(doctor.consultationFee)}
                </span>
              )}
              {doctor.city && (
                <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                  📍 {doctor.city}
                </span>
              )}
              {doctor.completedConsultations > 0 ? (
                <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                  {t.consultsDone(doctor.completedConsultations)}
                </span>
              ) : (
                <span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium">
                  {t.newDoctor}
                </span>
              )}
            </div>

            {/* Consultation modes */}
            {doctor.consultationModes && doctor.consultationModes.length > 0 && (
              <div className="flex flex-wrap justify-center md:justify-start gap-1 mt-2">
                {doctor.consultationModes.includes('in-person') && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{t.inPerson}</span>}
                {doctor.consultationModes.includes('video') && <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">{t.video}</span>}
                {doctor.consultationModes.includes('phone') && <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">{t.phone}</span>}
              </div>
            )}

            {/* Languages the doctor can consult in */}
            {doctor.languagesSpoken && doctor.languagesSpoken.length > 0 && (
              <p className="text-gray-600 text-sm mt-3 text-center md:text-left">
                🗣️ <span className="font-medium text-gray-700">{t.speaks}:</span> {doctor.languagesSpoken.join(', ')}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 mt-6">
              {isAuthenticated && isPatient && (
                <Link
                  to={`/book-appointment/${doctor._id}`}
                  className="inline-block bg-primary-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                >
                  {t.bookAppointment}
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
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
                >
                  <span>💬</span> {t.messageWhatsApp}
                </a>
              )}

              <button
                onClick={() => {
                  const shareUrl = window.location.href;
                  const shareText = `Check out ${formatDoctorName(doctor.name)} (${doctor.specialization || 'Doctor'}) on ProMedicoz - ${shareUrl}`;
                  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
                  window.open(whatsappUrl, '_blank');
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
              >
                <span>📤</span> {t.shareWhatsApp}
              </button>
            </div>

            {!isAuthenticated && (
              <div className="mt-4">
                <Link
                  to="/login"
                  className="inline-block bg-primary-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
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
        <div className="border-t p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* About */}
            {doctor.bio && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-3">{t.about}</h2>
                <p className="text-gray-600 leading-relaxed">{doctor.bio}</p>
                {/* leading-relaxed = more line spacing (easier to read paragraphs) */}
              </div>
            )}

            {/* Clinic Address */}
            {doctor.clinicAddress && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-3">{t.clinicAddress}</h2>
                <p className="text-gray-600">{doctor.clinicAddress}</p>
                <a
                  href={doctor.googleMapsLink || `https://maps.google.com?q=${encodeURIComponent(doctor.clinicAddress || doctor.city || '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-sm text-primary-600 hover:underline font-medium"
                >
                  {t.getDirections}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* ---- Reviews Section ---- */}
        <div className="border-t p-8">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xl font-semibold text-gray-800">{t.patientReviews}</h2>
            {reviewStats.totalReviews > 0 && (
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                {t.ratingBadge(reviewStats.averageRating, reviewStats.totalReviews)}
              </span>
            )}
          </div>

          {reviews.length === 0 ? (
            <p className="text-gray-500">{t.noReviews}</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review._id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-500">{'⭐'.repeat(review.rating)}</span>
                        <span className="text-sm text-gray-500">({review.rating}/5)</span>
                      </div>
                      {review.comment && (
                        <p className="text-gray-700 mt-2 text-sm">"{review.comment}"</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-600">{review.patient?.name}</p>
                      <p className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>

                  {/* Doctor's public reply, if any */}
                  {review.doctorReply && review.doctorReply.text && (
                    <div className="mt-3 ml-3 pl-3 border-l-2 border-primary-200">
                      <p className="text-xs font-semibold text-primary-700">💬 {t.doctorReplyLabel}</p>
                      <p className="text-sm text-gray-700 mt-1">{review.doctorReply.text}</p>
                    </div>
                  )}

                  {/* Doctor viewing their OWN profile: reply / edit-reply control */}
                  {isOwnProfile && (
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
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

export default DoctorProfile;
