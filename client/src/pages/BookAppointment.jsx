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

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { doctorAPI, appointmentAPI, availabilityAPI, familyMemberAPI } from '../services/api';
import toast from 'react-hot-toast';

function BookAppointment() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if this is a repeat booking (prefilled data from Dashboard)
  const repeatData = location.state || {};

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

  // Form state
  const [formData, setFormData] = useState({
    date: '',
    timeSlot: '',
    reason: repeatData.reason || '',
    consultationType: repeatData.consultationType || 'in-person'
  });

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
      await appointmentAPI.book({
        doctorId,
        date: formData.date,
        timeSlot: formData.timeSlot,
        reason: formData.reason,
        consultationType: formData.consultationType,
        bookedFor,
        familyMemberName: bookedFor === 'family' ? selectedFamilyMember : '',
        originalAppointmentId: repeatData.originalAppointmentId || undefined,
        isFollowUp: repeatData.isFollowUp || false,
        consentGiven: consentGiven
      });

      toast.success('Appointment booked! Waiting for doctor confirmation.');
      navigate('/booking-confirmation', {
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
      const message = error.response?.data?.message || 'Failed to book appointment';
      toast.error(message);
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
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to={`/doctors/${doctorId}`} className="text-primary-600 hover:underline mb-6 inline-block">
        ← Back to doctor profile
      </Link>

      <div className="max-w-2xl mx-auto">
        {/* Doctor info card */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 flex items-center gap-4">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
            {doctor?.profilePhoto ? (
              <img src={doctor.profilePhoto} alt={doctor.name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <span className="text-2xl">👨‍⚕️</span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{doctor?.name}</h2>
            <p className="text-primary-600">{doctor?.specialization || 'General Physician'}</p>
            {doctor?.consultationFee > 0 && (
              <p className="text-gray-500 text-sm">Fee: ₹{doctor.consultationFee}</p>
            )}
          </div>
        </div>

        {/* Booking form */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Book Appointment</h1>

          {/* Repeat booking indicator */}
          {repeatData.repeatBooking && (
            <div className="mb-5 p-3 bg-primary-50 border border-primary-200 rounded-lg flex items-center gap-2">
              <span className="text-lg">🔄</span>
              <p className="text-sm text-primary-700">
                Rebooking from a previous appointment. Reason and consultation type have been pre-filled.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Date picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred Date *
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
                Select a date to see available time slots
              </p>
            </div>

            {/* Time slot selector - NOW DYNAMIC */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Slot *
              </label>

              {/* Show loading while fetching slots */}
              {slotsLoading ? (
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm">
                  Loading available slots...
                </div>
              ) : !formData.date ? (
                // No date selected yet
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm">
                  Pick a date first to see available slots
                </div>
              ) : availableSlots.length === 0 ? (
                // Date selected but no slots available
                <div className="w-full px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {slotsMessage || 'No slots available on this date'}
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
            </div>

            {/* Who is this booking for? */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Booking For
              </label>
              <select
                value={bookedFor}
                onChange={(e) => {
                  setBookedFor(e.target.value);
                  if (e.target.value === 'self') setSelectedFamilyMember('');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="self">Myself</option>
                <option value="family">A Family Member</option>
              </select>
            </div>

            {/* Family member selection (only when booking for family) */}
            {bookedFor === 'family' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Family Member *
                </label>
                {familyMembers.length === 0 ? (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-700">
                      You haven't added any family members yet.
                    </p>
                    <Link
                      to="/dashboard"
                      className="text-sm text-primary-600 hover:underline mt-1 inline-block"
                    >
                      Go to Dashboard → Family Members tab to add them
                    </Link>
                  </div>
                ) : (
                  <select
                    value={selectedFamilyMember}
                    onChange={(e) => setSelectedFamilyMember(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    required
                  >
                    <option value="">Choose family member...</option>
                    {familyMembers.map((member) => (
                      <option key={member._id} value={member.name}>
                        {member.name} ({member.relationship}{member.age ? `, ${member.age} yrs` : ''})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Consultation type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Consultation Type
              </label>
              <select
                value={formData.consultationType}
                onChange={(e) => setFormData(prev => ({ ...prev, consultationType: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="in-person">In-Person Visit</option>
                <option value="video">Video Call</option>
                <option value="phone">Phone Call</option>
              </select>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Visit *
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Briefly describe your symptoms or reason for the visit..."
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

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !formData.timeSlot || !consentGiven || (bookedFor === 'family' && !selectedFamilyMember)}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Booking...' : 'Confirm Booking'}
            </button>
          </form>

          <p className="text-gray-500 text-sm mt-4 text-center">
            Your appointment will be pending until the doctor confirms.
          </p>
        </div>
      </div>
    </div>
  );
}

export default BookAppointment;
