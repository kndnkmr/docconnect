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
// useParams = hook to access URL parameters (the :id part)

import { doctorAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

function DoctorProfile() {
  const { id } = useParams();
  // If URL is /doctors/abc123, then id = "abc123"

  const { isAuthenticated, isPatient } = useAuth();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);

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
                src={doctor.profilePhoto}
                alt={doctor.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-8xl">👨‍⚕️</span>
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

            {/* WhatsApp Contact */}
            {doctor.whatsappNumber && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-3">Contact on WhatsApp</h2>
                <a
                  href={`https://wa.me/${doctor.whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hi Doctor, I would like to consult with you.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Message on WhatsApp
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DoctorProfile;
