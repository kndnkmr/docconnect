// ============================================
// Booking Confirmation Page - Shown after successful booking
// ============================================

import { Link, useLocation } from 'react-router-dom';

function BookingConfirmation() {
  const location = useLocation();
  const booking = location.state;
  // Booking data passed from BookAppointment page via navigate state

  if (!booking) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-800">No booking details found</h2>
        <Link to="/dashboard" className="text-primary-600 hover:underline mt-4 inline-block">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-lg mx-auto">
        {/* Success icon */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Appointment Booked!</h1>
          <p className="text-gray-600 mt-2">Your booking is confirmed. Waiting for doctor to accept.</p>
        </div>

        {/* Booking details card */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4 text-lg">Booking Summary</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Doctor</span>
              <span className="font-medium text-gray-800">{booking.doctorName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Specialization</span>
              <span className="font-medium text-gray-800">{booking.specialization || '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Date</span>
              <span className="font-medium text-gray-800">
                {new Date(booking.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Time Slot</span>
              <span className="font-medium text-gray-800">{booking.timeSlot}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Consultation Type</span>
              <span className="font-medium text-gray-800 capitalize">{booking.consultationType}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Reason</span>
              <span className="font-medium text-gray-800">{booking.reason}</span>
            </div>
            {booking.fee && (
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Consultation Fee</span>
                <span className="font-semibold text-primary-600">₹{booking.fee}</span>
              </div>
            )}
          </div>
        </div>

        {/* What's next */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <h3 className="font-medium text-blue-800 mb-2">What happens next?</h3>
          <ol className="text-sm text-blue-700 space-y-2 list-decimal ml-4">
            <li>Doctor will confirm your appointment (you'll see it in Dashboard)</li>
            <li>Once confirmed, you'll see payment details</li>
            <li>Complete the payment via UPI</li>
            <li>On the appointment day, connect via the method you chose ({booking.consultationType})</li>
          </ol>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4">
          <Link
            to="/dashboard"
            className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-semibold text-center hover:bg-primary-700 transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            to="/doctors"
            className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold text-center hover:bg-gray-50 transition-colors"
          >
            Browse More Doctors
          </Link>
        </div>
      </div>
    </div>
  );
}

export default BookingConfirmation;
