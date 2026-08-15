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
import toast from 'react-hot-toast';

function DoctorProfile() {
  const { id } = useParams();
  // If URL is /doctors/abc123, then id = "abc123"

  const { isAuthenticated, isPatient } = useAuth();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ averageRating: 0, totalReviews: 0 });

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

    const fetchReviews = async () => {
      try {
        const reviewResponse = await reviewAPI.getDoctorReviews(id);
        setReviews(reviewResponse.data.reviews);
        setReviewStats(reviewResponse.data.stats);
      } catch (error) {
        // Silently fail — reviews are optional, don't block the page
        console.error('Fetch reviews error:', error);
      }
    };

    fetchDoctor();
    fetchReviews();
  }, [id]);
  // [id] = re-fetch if the ID in the URL changes

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg text-gray-600">Loading profile...</div>
      </div>
    );
  }

  // Doctor not found
  if (!doctor) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-2xl font-bold text-gray-800">Doctor Not Found</h2>
          <p className="text-gray-600 mt-2">This profile doesn't exist or was removed.</p>
          <Link to="/doctors" className="text-primary-600 hover:underline mt-4 inline-block">
            ← Back to all doctors
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <SEO
        title={doctor ? `Dr. ${doctor.name} - ${doctor.specialization || 'Doctor'}` : 'Doctor Profile'}
        description={doctor ? `Book appointment with Dr. ${doctor.name} (${doctor.specialization || 'General Physician'}). ${doctor.experience || 0} years experience. Consultation fee: ₹${doctor.consultationFee || 'N/A'}.` : ''}
        path={`/doctors/${id}`}
        type="profile"
      />
      {doctor && <DoctorSchema doctor={doctor} />}
      {/* Back link */}
      <Link to="/doctors" className="text-primary-600 hover:underline mb-6 inline-block">
        ← Back to all doctors
      </Link>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
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
              Dr. {doctor.name}
              {doctor.isAdminVerified && <VerifiedBadge size={22} />}
            </h1>
            {doctor.isAdminVerified && (
              <p className="text-xs text-blue-600 font-medium mt-0.5">Verified by ProMedicoz</p>
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
                  {doctor.experience} yrs experience
                </span>
              )}
              {doctor.consultationFee > 0 && (
                <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                  ₹{doctor.consultationFee} consultation
                </span>
              )}
              {doctor.city && (
                <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                  📍 {doctor.city}
                </span>
              )}
            </div>

            {/* Consultation modes */}
            {doctor.consultationModes && doctor.consultationModes.length > 0 && (
              <div className="flex flex-wrap justify-center md:justify-start gap-1 mt-2">
                {doctor.consultationModes.includes('in-person') && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">🏥 In-Person</span>}
                {doctor.consultationModes.includes('video') && <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">📹 Video</span>}
                {doctor.consultationModes.includes('phone') && <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">📞 Phone</span>}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 mt-6">
              {isAuthenticated && isPatient && (
                <Link
                  to={`/book-appointment/${doctor._id}`}
                  className="inline-block bg-primary-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                >
                  Book Appointment
                </Link>
              )}

              <button
                onClick={() => {
                  const shareUrl = window.location.href;
                  const shareText = `Check out ${doctor.name} (${doctor.specialization || 'Doctor'}) on ProMedicoz - ${shareUrl}`;
                  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
                  window.open(whatsappUrl, '_blank');
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
              >
                <span>📤</span> Share via WhatsApp
              </button>
            </div>

            {!isAuthenticated && (
              <p className="mt-3 text-sm text-gray-500">
                <Link to="/login" className="text-primary-600 hover:underline">
                  Log in
                </Link>{' '}
                as a patient to book an appointment.
              </p>
            )}
          </div>
        </div>

        {/* ---- Details Section ---- */}
        <div className="border-t p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* About */}
            {doctor.bio && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-3">About</h2>
                <p className="text-gray-600 leading-relaxed">{doctor.bio}</p>
                {/* leading-relaxed = more line spacing (easier to read paragraphs) */}
              </div>
            )}

            {/* Clinic Address */}
            {doctor.clinicAddress && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-3">Clinic Address</h2>
                <p className="text-gray-600">{doctor.clinicAddress}</p>
                <a
                  href={doctor.googleMapsLink || `https://maps.google.com?q=${encodeURIComponent(doctor.clinicAddress || doctor.city || '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-sm text-primary-600 hover:underline font-medium"
                >
                  📍 Get Directions
                </a>
              </div>
            )}
          </div>
        </div>

        {/* ---- Reviews Section ---- */}
        <div className="border-t p-8">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Patient Reviews</h2>
            {reviewStats.totalReviews > 0 && (
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                ⭐ {reviewStats.averageRating} / 5 ({reviewStats.totalReviews} reviews)
              </span>
            )}
          </div>

          {reviews.length === 0 ? (
            <p className="text-gray-500">No reviews yet. Be the first to consult and rate!</p>
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DoctorProfile;
