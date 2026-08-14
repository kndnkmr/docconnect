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
        <div className="md:flex">
          {/* Photo */}
          <div className="md:w-1/3 h-64 md:h-auto bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
            {doctor.profilePhoto ? (
              <img
                src={getUploadUrl(doctor.profilePhoto, { width: 600 })}
                alt={doctor.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-8xl">🧑‍⚕️</span>
            )}
          </div>

          {/* Basic Info */}
          <div className="p-8 md:w-2/3">
            <h1 className="text-3xl font-bold text-gray-800">{doctor.name}</h1>

            {doctor.specialization && (
              <p className="text-primary-600 text-lg font-medium mt-2">
                {doctor.specialization}
              </p>
            )}

            {doctor.qualification && (
              <p className="text-gray-600 mt-1">{doctor.qualification}</p>
            )}

            {/* Quick stats */}
            <div className="flex flex-wrap gap-4 mt-6">
              {doctor.experience > 0 && (
                <div className="bg-gray-100 px-4 py-2 rounded-lg">
                  <span className="text-sm text-gray-500">Experience</span>
                  <p className="font-semibold text-gray-800">{doctor.experience} years</p>
                </div>
              )}
              {doctor.consultationFee > 0 && (
                <div className="bg-gray-100 px-4 py-2 rounded-lg">
                  <span className="text-sm text-gray-500">Consultation Fee</span>
                  <p className="font-semibold text-gray-800">₹{doctor.consultationFee}</p>
                </div>
              )}
            </div>

            {/* Book Appointment Button */}
            {isAuthenticated && isPatient && (
              <Link
                to={`/book-appointment/${doctor._id}`}
                className="inline-block bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold mt-6 hover:bg-primary-700 transition-colors"
              >
                Book Appointment
              </Link>
            )}

            {!isAuthenticated && (
              <p className="mt-6 text-gray-500">
                <Link to="/login" className="text-primary-600 hover:underline">
                  Log in
                </Link>{' '}
                as a patient to book an appointment.
              </p>
            )}

            {/* Share Profile Button */}
            <div className="mt-4">
              <button
                onClick={() => {
                  const shareUrl = window.location.href;
                  const shareText = `Check out ${doctor.name} (${doctor.specialization || 'Doctor'}) on ProMedicoz - ${shareUrl}`;
                  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
                  window.open(whatsappUrl, '_blank');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
              >
                <span>📤</span> Share Profile via WhatsApp
              </button>
            </div>
          </div>
        </div>

        {/* ---- Details Section ---- */}
        <div className="border-t p-8">
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
