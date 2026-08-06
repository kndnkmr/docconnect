// ============================================
// Dashboard Page - User's Personal Dashboard
// ============================================
// Shows different content based on the user's role:
// - PATIENT: their booked appointments, quick links
// - DOCTOR: their appointments, profile edit, availability management
//
// KEY CONCEPTS:
// - Role-based rendering: same page, different content per role
// - Tabs: switch between different sections within one page
// - Status badges: visual indicators for appointment status
// - Date formatting: display dates in human-readable format

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { appointmentAPI, doctorAPI, availabilityAPI, authAPI, complaintAPI, prescriptionAPI, reportAPI } from '../services/api';
import toast from 'react-hot-toast';

function Dashboard() {
  const { user, isDoctor, isPatient } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('appointments');
  // Tabs: 'appointments', 'profile' (doctor), 'availability' (doctor)

  // Doctor-specific state
  const [profileData, setProfileData] = useState({
    specialization: '',
    experience: '',
    qualification: '',
    clinicAddress: '',
    consultationFee: '',
    bio: '',
    phone: '',
    whatsappNumber: '',
    upiId: ''
  });

  // ---- Fetch appointments on load ----
  useEffect(() => {
    fetchAppointments();
    // If doctor, also fetch their current profile data
    if (isDoctor) {
      fetchProfile();
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await authAPI.getMe();
      const userData = response.data.user;
      setProfileData({
        specialization: userData.specialization || '',
        experience: userData.experience || '',
        qualification: userData.qualification || '',
        clinicAddress: userData.clinicAddress || '',
        consultationFee: userData.consultationFee || '',
        bio: userData.bio || '',
        phone: userData.phone || '',
        whatsappNumber: userData.whatsappNumber || '',
        upiId: userData.upiId || ''
      });
    } catch (error) {
      console.error('Fetch profile error:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      const response = await appointmentAPI.getMine({ limit: 20 });
      setAppointments(response.data.appointments);
    } catch (error) {
      console.error('Fetch appointments error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ---- Doctor: Update appointment status ----
  const handleStatusUpdate = async (appointmentId, newStatus) => {
    try {
      let data = { status: newStatus };
      
      // If confirming a video/phone appointment, ask for meeting link
      if (newStatus === 'confirmed') {
        const link = window.prompt('Add a meeting link (Google Meet/Zoom) for this appointment?\n\nLeave empty if in-person visit:');
        if (link) {
          data.meetingLink = link;
        }
      }
      
      await appointmentAPI.updateStatus(appointmentId, data);
      toast.success(`Appointment ${newStatus}`);
      fetchAppointments(); // Refresh the list
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    }
  };

  // ---- Patient: Cancel appointment ----
  const handleCancel = async (appointmentId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) {
      return;
      // window.confirm = browser popup that asks Yes/No
    }
    try {
      await appointmentAPI.cancel(appointmentId, {
        cancellationReason: 'Cancelled by patient from dashboard'
      });
      toast.success('Appointment cancelled');
      fetchAppointments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel');
    }
  };

  // ---- Doctor: Write Prescription ----
  const handleWritePrescription = async (appointmentId, patientId) => {
    const diagnosis = window.prompt('Enter diagnosis:');
    if (!diagnosis) return;

    const medicinesStr = window.prompt('Enter medicines (comma separated):\nExample: Paracetamol 500mg - Twice daily - 5 days, Vitamin D - Once daily - 30 days');
    const testsStr = window.prompt('Recommended tests (comma separated, leave empty if none):\nExample: Complete Blood Count, Thyroid Profile');
    const notes = window.prompt('Additional notes/advice (optional):');

    // Parse medicines
    const medicines = medicinesStr ? medicinesStr.split(',').map(m => {
      const parts = m.trim().split(' - ');
      return {
        name: parts[0] || m.trim(),
        dosage: '',
        frequency: parts[1] || '',
        duration: parts[2] || '',
        instructions: parts[3] || ''
      };
    }) : [];

    // Parse tests
    const testsRecommended = testsStr ? testsStr.split(',').map(t => t.trim()).filter(t => t) : [];

    try {
      await prescriptionAPI.create({
        appointmentId,
        diagnosis,
        medicines,
        testsRecommended,
        notes: notes || ''
      });
      toast.success('Prescription created successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create prescription');
    }
  };

  // ---- Doctor: Save profile updates ----
  const handleProfileSave = async (e) => {
    e.preventDefault();
    try {
      await doctorAPI.updateProfile(profileData);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    }
  };

  // ---- Helper: Format date for display ----
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    // Outputs like: "Mon, Jan 15, 2024"
  };

  // ---- Helper: Status badge color ----
  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* ---- Notification Banner (Doctor: pending appointments) ---- */}
      {isDoctor && appointments.filter(a => a.status === 'pending').length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center gap-3">
          <span className="text-2xl">🔔</span>
          <div>
            <p className="font-semibold text-yellow-800">
              You have {appointments.filter(a => a.status === 'pending').length} new appointment request{appointments.filter(a => a.status === 'pending').length > 1 ? 's' : ''}!
            </p>
            <p className="text-sm text-yellow-700">Please confirm or reject them from the Appointments tab below.</p>
          </div>
        </div>
      )}

      {/* ---- Welcome Header ---- */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          Welcome, {user?.name}!
        </h1>
        <p className="text-gray-600 mt-1">
          {isDoctor ? 'Manage your practice and appointments' : 'View your appointments and find doctors'}
        </p>
      </div>

      {/* ---- Tab Navigation (Doctor gets more tabs) ---- */}
      <div className="flex border-b mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('appointments')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'appointments'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          My Appointments
        </button>

        {isDoctor && (
          <>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Edit Profile
            </button>
            <button
              onClick={() => setActiveTab('availability')}
              className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'availability'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Availability
            </button>
            <button
              onClick={() => setActiveTab('patientReports')}
              className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'patientReports'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Patient Reports
            </button>
          </>
        )}
        {isPatient && (
          <>
            <button
              onClick={() => setActiveTab('prescriptions')}
              className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'prescriptions'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Prescriptions
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'reports'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              My Reports
            </button>
            <button
              onClick={() => setActiveTab('complaints')}
              className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'complaints'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Complaints
            </button>
          </>
        )}
        <button
          onClick={() => setActiveTab('account')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'account'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Account Settings
        </button>
      </div>

      {/* ---- Tab Content ---- */}

      {/* === APPOINTMENTS TAB === */}
      {activeTab === 'appointments' && (
        <div>
          {/* Quick actions */}
          {isPatient && (
            <div className="mb-6">
              <Link
                to="/doctors"
                className="inline-block bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
              >
                + Book New Appointment
              </Link>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-600">Loading appointments...</div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-md">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="text-xl font-medium text-gray-700">No appointments yet</h3>
              <p className="text-gray-500 mt-2">
                {isPatient
                  ? 'Browse doctors and book your first appointment!'
                  : 'Your upcoming appointments will appear here.'}
              </p>
            </div>
          ) : (
            // Appointment list
            <div className="space-y-4">
              {/* space-y-4 = vertical gap between each card */}
              {appointments.map((apt) => (
                <div
                  key={apt._id}
                  className="bg-white rounded-xl shadow-md p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  {/* Appointment info */}
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-800">
                        {isPatient
                          ? `Dr. ${apt.doctor?.name || 'Unknown'}`
                          : apt.patient?.name || 'Unknown Patient'}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(apt.status)}`}>
                        {apt.status}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">
                      {formatDate(apt.date)} • {apt.timeSlot}
                    </p>
                    {isDoctor && apt.patient?.phone && (
                      <p className="text-gray-600 text-sm mt-1">
                        Patient Phone: <a href={`tel:${apt.patient.phone}`} className="text-primary-600 hover:underline">{apt.patient.phone}</a>
                      </p>
                    )}
                    <p className="text-gray-500 text-sm mt-1">
                      Reason: {apt.reason}
                    </p>
                    {apt.notes && (
                      <p className="text-gray-500 text-sm mt-1 italic">
                        Notes: {apt.notes}
                      </p>
                    )}
                    {apt.meetingLink && (
                      <a
                        href={apt.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                      >
                        Join Meeting Link
                      </a>
                    )}
                    {/* Payment info for patients */}
                    {isPatient && apt.status === 'confirmed' && apt.paymentStatus !== 'paid' && (
                      <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-sm font-medium text-orange-800">Payment Required</p>
                        <p className="text-sm text-orange-700 mt-1">
                          Pay ₹{apt.doctor?.consultationFee || 'as discussed'} via UPI
                        </p>
                        <p className="text-sm font-mono text-orange-900 mt-1 font-semibold">
                          UPI: {apt.doctor?.upiId || 'Dr.poojasingh410@okicici'}
                        </p>
                        <a
                          href={`upi://pay?pa=${apt.doctor?.upiId || 'Dr.poojasingh410@okicici'}&pn=${encodeURIComponent(apt.doctor?.name || 'Doctor')}&am=${apt.doctor?.consultationFee || ''}&cu=INR&tn=Consultation fee`}
                          className="inline-block mt-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
                        >
                          Pay via UPI App
                        </a>
                      </div>
                    )}
                    {apt.paymentStatus === 'paid' && (
                      <span className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        ✓ Payment Received
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-shrink-0">
                    {/* Doctor actions */}
                    {isDoctor && apt.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusUpdate(apt._id, 'confirmed')}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(apt._id, 'cancelled')}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {isDoctor && apt.status === 'confirmed' && (
                      <button
                        onClick={() => handleStatusUpdate(apt._id, 'completed')}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                      >
                        Mark Complete
                      </button>
                    )}
                    {isDoctor && apt.status === 'completed' && (
                      <button
                        onClick={() => handleWritePrescription(apt._id, apt.patient?._id || apt.patient)}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600"
                      >
                        Write Prescription
                      </button>
                    )}
                    {isDoctor && apt.paymentStatus !== 'paid' && ['confirmed', 'completed'].includes(apt.status) && (
                      <button
                        onClick={async () => {
                          await appointmentAPI.markPayment(apt._id);
                          toast.success('Payment marked as received');
                          fetchAppointments();
                        }}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600"
                      >
                        Mark Paid
                      </button>
                    )}

                    {/* Patient actions */}
                    {isPatient && ['pending', 'confirmed'].includes(apt.status) && (
                      <button
                        onClick={() => handleCancel(apt._id)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === EDIT PROFILE TAB (Doctor only) === */}
      {activeTab === 'profile' && isDoctor && (
        <div className="bg-white rounded-xl shadow-md p-8 max-w-2xl">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Update Your Profile</h2>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
              <input
                type="text"
                value={profileData.specialization}
                onChange={(e) => setProfileData(prev => ({ ...prev, specialization: e.target.value }))}
                placeholder="e.g., Cardiologist, Dentist, General Physician"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Qualification</label>
              <input
                type="text"
                value={profileData.qualification}
                onChange={(e) => setProfileData(prev => ({ ...prev, qualification: e.target.value }))}
                placeholder="e.g., MBBS, MD - Cardiology"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
              <input
                type="number"
                value={profileData.experience}
                onChange={(e) => setProfileData(prev => ({ ...prev, experience: e.target.value }))}
                placeholder="e.g., 10"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Consultation Fee (₹)</label>
              <input
                type="number"
                value={profileData.consultationFee}
                onChange={(e) => setProfileData(prev => ({ ...prev, consultationFee: e.target.value }))}
                placeholder="e.g., 100"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clinic Address</label>
              <input
                type="text"
                value={profileData.clinicAddress}
                onChange={(e) => setProfileData(prev => ({ ...prev, clinicAddress: e.target.value }))}
                placeholder="e.g., 123 Health Street, Medical City"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio / About</label>
              <textarea
                value={profileData.bio}
                onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Tell patients about yourself, your approach to care..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                // resize-none = prevent user from dragging to resize the textarea
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+91 9876543210"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
              <input
                type="tel"
                value={profileData.whatsappNumber}
                onChange={(e) => setProfileData(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                placeholder="+91 9876543210 (patients can message you directly)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">This will be shown on your public profile so patients can reach you</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID (for receiving payments)</label>
              <input
                type="text"
                value={profileData.upiId}
                onChange={(e) => setProfileData(prev => ({ ...prev, upiId: e.target.value }))}
                placeholder="e.g., Dr.poojasingh410@okicici"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Patients will pay consultation fees to this UPI ID</p>
            </div>
            <button
              type="submit"
              className="bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              Save Profile
            </button>
          </form>
        </div>
      )}

      {/* === AVAILABILITY TAB (Doctor only) === */}
      {activeTab === 'availability' && isDoctor && (
        <DoctorAvailability />
      )}

      {/* === PATIENT REPORTS TAB (Doctor only) === */}
      {activeTab === 'patientReports' && isDoctor && (
        <DoctorPatientReports />
      )}

      {/* === PRESCRIPTIONS TAB (Patient only) === */}
      {activeTab === 'prescriptions' && isPatient && (
        <PatientPrescriptions />
      )}

      {/* === REPORTS TAB (Patient only) === */}
      {activeTab === 'reports' && isPatient && (
        <PatientReports />
      )}

      {/* === COMPLAINTS TAB (Patient only) === */}
      {activeTab === 'complaints' && isPatient && (
        <PatientComplaints />
      )}

      {/* === ACCOUNT SETTINGS TAB (All roles) === */}
      {activeTab === 'account' && (
        <AccountSettings />
      )}
    </div>
  );
}

// ---- Doctor Patient Reports Sub-component ----
// Doctor views reports uploaded by patients and can add comments

function DoctorPatientReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await reportAPI.getMine();
        setReports(response.data.reports);
      } catch (error) {
        console.error('Fetch reports error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const handleReview = async (reportId) => {
    const comment = window.prompt('Add your review/comment for this report:');
    if (!comment) return;

    try {
      await reportAPI.review(reportId, { doctorComment: comment });
      toast.success('Report reviewed');
      // Refresh
      const response = await reportAPI.getMine();
      setReports(response.data.reports);
    } catch (error) {
      toast.error('Failed to review report');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  if (loading) return <div className="text-center py-8 text-gray-600">Loading...</div>;

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Patient Reports</h2>

      {reports.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-xl font-medium text-gray-700">No reports shared yet</h3>
          <p className="text-gray-500 mt-2">When patients upload test reports for you, they'll appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report._id} className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-800">{report.title}</h3>
                  <p className="text-sm text-gray-500">
                    Patient: {report.patient?.name} ({report.patient?.phone || report.patient?.email}) • {formatDate(report.createdAt)}
                  </p>
                  {report.description && (
                    <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={report.filePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-primary-100 text-primary-700 rounded-lg text-sm hover:bg-primary-200"
                  >
                    View File
                  </a>
                  {!report.isReviewed && (
                    <button
                      onClick={() => handleReview(report._id)}
                      className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
                    >
                      Review
                    </button>
                  )}
                </div>
              </div>
              {report.isReviewed && report.doctorComment && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800">Your Review:</p>
                  <p className="text-sm text-green-700 mt-1">{report.doctorComment}</p>
                </div>
              )}
              {!report.isReviewed && (
                <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                  Pending Review
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Patient Prescriptions Sub-component ----
// Shows prescriptions written by doctors for this patient

function PatientPrescriptions() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrescriptions = async () => {
      try {
        const response = await prescriptionAPI.getMine();
        setPrescriptions(response.data.prescriptions);
      } catch (error) {
        console.error('Fetch prescriptions error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPrescriptions();
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  if (loading) return <div className="text-center py-8 text-gray-600">Loading...</div>;

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">My Prescriptions</h2>

      {prescriptions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <div className="text-5xl mb-4">💊</div>
          <h3 className="text-xl font-medium text-gray-700">No prescriptions yet</h3>
          <p className="text-gray-500 mt-2">Prescriptions from your doctors will appear here after consultations.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx) => (
            <div key={rx._id} className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">Dr. {rx.doctor?.name}</h3>
                  <p className="text-sm text-gray-500">{rx.doctor?.specialization} • {formatDate(rx.createdAt)}</p>
                </div>
                {rx.appointment && (
                  <span className="text-xs text-gray-400">
                    Appt: {formatDate(rx.appointment.date)} {rx.appointment.timeSlot}
                  </span>
                )}
              </div>

              {/* Diagnosis */}
              <div className="mb-3">
                <span className="text-sm font-medium text-gray-700">Diagnosis: </span>
                <span className="text-sm text-gray-800">{rx.diagnosis}</span>
              </div>

              {/* Medicines */}
              {rx.medicines && rx.medicines.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">Medicines:</p>
                  <div className="space-y-1 ml-3">
                    {rx.medicines.map((med, idx) => (
                      <div key={idx} className="text-sm text-gray-600">
                        • <span className="font-medium">{med.name}</span>
                        {med.dosage && ` (${med.dosage})`}
                        {med.frequency && ` — ${med.frequency}`}
                        {med.duration && ` — ${med.duration}`}
                        {med.instructions && <span className="text-gray-500 italic"> ({med.instructions})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tests recommended */}
              {rx.testsRecommended && rx.testsRecommended.length > 0 && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800 mb-1">Tests Recommended:</p>
                  <div className="space-y-1 ml-3">
                    {rx.testsRecommended.map((test, idx) => (
                      <div key={idx} className="text-sm text-yellow-700">• {test}</div>
                    ))}
                  </div>
                  <p className="text-xs text-yellow-600 mt-2">
                    After completing these tests, upload your reports in the "My Reports" tab.
                  </p>
                </div>
              )}

              {/* Notes */}
              {rx.notes && (
                <div className="mb-2">
                  <span className="text-sm font-medium text-gray-700">Notes: </span>
                  <span className="text-sm text-gray-600 italic">{rx.notes}</span>
                </div>
              )}

              {/* Follow-up */}
              {rx.followUpDate && (
                <p className="text-sm text-primary-600 font-medium mt-2">
                  Follow-up: {formatDate(rx.followUpDate)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Patient Reports Sub-component ----
// Patient uploads test reports and views doctor comments

function PatientReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', doctorId: '' });
  const [file, setFile] = useState(null);
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    fetchReports();
    fetchDoctors();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await reportAPI.getMine();
      setReports(response.data.reports);
    } catch (error) {
      console.error('Fetch reports error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch doctors the patient has visited (for dropdown)
  const fetchDoctors = async () => {
    try {
      const response = await appointmentAPI.getMine({ limit: 50 });
      // Extract unique doctors from appointments
      const uniqueDoctors = [];
      const seen = new Set();
      response.data.appointments.forEach(apt => {
        const docId = apt.doctor?._id;
        if (docId && !seen.has(docId)) {
          seen.add(docId);
          uniqueDoctors.push({ _id: docId, name: apt.doctor.name, specialization: apt.doctor.specialization });
        }
      });
      setDoctors(uniqueDoctors);
    } catch (error) {
      console.error('Fetch doctors error:', error);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.doctorId || !file) {
      toast.error('Please fill title, select doctor, and upload a file');
      return;
    }

    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description);
    data.append('doctorId', formData.doctorId);
    data.append('reportFile', file);

    try {
      await reportAPI.upload(data);
      toast.success('Report uploaded! Your doctor can now view it.');
      setShowForm(false);
      setFormData({ title: '', description: '', doctorId: '' });
      setFile(null);
      fetchReports();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload report');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  if (loading) return <div className="text-center py-8 text-gray-600">Loading...</div>;

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">My Medical Reports</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Upload Report'}
        </button>
      </div>

      {/* Upload form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="font-medium text-gray-800 mb-4">Upload Test Report</h3>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Blood Test Report, MRI Scan"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Doctor</label>
              <select
                value={formData.doctorId}
                onChange={(e) => setFormData(prev => ({ ...prev, doctorId: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              >
                <option value="">Choose doctor to share with...</option>
                {doctors.map(doc => (
                  <option key={doc._id} value={doc._id}>
                    Dr. {doc.name} ({doc.specialization || 'General'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Any notes about this report"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload File (PDF or Image)</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Upload Report
            </button>
          </form>
        </div>
      )}

      {/* Reports list */}
      {reports.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-xl font-medium text-gray-700">No reports uploaded</h3>
          <p className="text-gray-500 mt-2">Upload your test reports here so your doctor can review them.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report._id} className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-800">{report.title}</h3>
                  <p className="text-sm text-gray-500">
                    Shared with: Dr. {report.doctor?.name} • {formatDate(report.createdAt)}
                  </p>
                  {report.description && (
                    <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    report.isReviewed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {report.isReviewed ? 'Reviewed' : 'Pending Review'}
                  </span>
                  <a
                    href={report.filePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 text-sm hover:underline"
                  >
                    View File
                  </a>
                </div>
              </div>
              {report.doctorComment && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">Doctor's Comment:</p>
                  <p className="text-sm text-blue-700 mt-1">{report.doctorComment}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Patient Complaints Sub-component ----
// Lets patients file and view their complaints

function PatientComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    description: ''
  });

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      const response = await complaintAPI.getMine();
      setComplaints(response.data.complaints);
    } catch (error) {
      console.error('Fetch complaints error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject || !formData.description) {
      toast.error('Please fill in subject and description');
      return;
    }
    try {
      await complaintAPI.create(formData);
      toast.success('Complaint submitted successfully');
      setShowForm(false);
      setFormData({ subject: '', description: '' });
      fetchComplaints();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit complaint');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'open': 'bg-yellow-100 text-yellow-800',
      'in-progress': 'bg-blue-100 text-blue-800',
      'resolved': 'bg-green-100 text-green-800',
      'closed': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading...</div>;
  }

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">My Complaints</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Complaint'}
        </button>
      </div>

      {/* Complaint form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="font-medium text-gray-800 mb-4">File a Complaint</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Brief title of your complaint"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
                maxLength={200}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your complaint in detail..."
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                required
              />
            </div>
            <button
              type="submit"
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Submit Complaint
            </button>
          </form>
        </div>
      )}

      {/* Complaints list */}
      {complaints.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-xl font-medium text-gray-700">No complaints filed</h3>
          <p className="text-gray-500 mt-2">
            If you have any issues with our service, click "New Complaint" to let us know.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {complaints.map((complaint) => (
            <div key={complaint._id} className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-gray-800">{complaint.subject}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(complaint.status)}`}>
                  {complaint.status}
                </span>
              </div>
              <p className="text-gray-600 text-sm mt-2">{complaint.description}</p>
              {complaint.doctor && (
                <p className="text-gray-500 text-xs mt-2">
                  Regarding: Dr. {complaint.doctor.name} ({complaint.doctor.specialization})
                </p>
              )}
              <p className="text-gray-400 text-xs mt-2">Filed on: {formatDate(complaint.createdAt)}</p>
              {complaint.response && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800">Admin Response:</p>
                  <p className="text-sm text-green-700 mt-1">{complaint.response}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Account Settings Sub-component ----
// Allows users to change email/phone and delete their account

function AccountSettings() {
  const { user, logout } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdateAccount = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await authAPI.updateAccount({ email, phone });
      toast.success('Account updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update account');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirm1 = window.confirm('Are you sure you want to delete your account? This cannot be undone.');
    if (!confirm1) return;

    const confirm2 = window.confirm('All your data (appointments, profile) will be permanently deleted. Continue?');
    if (!confirm2) return;

    try {
      await authAPI.deleteAccount();
      toast.success('Account deleted. Goodbye!');
      logout();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete account');
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Account Settings</h2>

      {/* Update email/phone */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="font-medium text-gray-800 mb-4">Update Contact Information</h3>
        <form onSubmit={handleUpdateAccount} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9876543210"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Update Account'}
          </button>
        </form>
      </div>

      {/* Delete account */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-red-200">
        <h3 className="font-medium text-red-700 mb-2">Danger Zone</h3>
        <p className="text-gray-600 text-sm mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button
          onClick={handleDeleteAccount}
          className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Delete My Account
        </button>
      </div>
    </div>
  );
}

// ---- Doctor Availability Sub-component ----
// Lets doctors set their weekly schedule
// Supports selecting MULTIPLE days and adding the same time slot across all selected days

function DoctorAvailability() {
  const [schedule, setSchedule] = useState([]);
  const [slotDuration, setSlotDuration] = useState(30);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState([]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Fetch current availability on load
  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const response = await availabilityAPI.getMine();
        setSchedule(response.data.availability || []);
        setSlotDuration(response.data.slotDuration || 30);
      } catch (error) {
        console.error('Fetch availability error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAvailability();
  }, []);

  // Toggle a day selection
  const toggleDay = (day) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)    // Remove if already selected
        : [...prev, day]                  // Add if not selected
    );
  };

  // Select all weekdays (Mon-Sat)
  const selectWeekdays = () => {
    setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  };

  // Clear all selections
  const clearDays = () => {
    setSelectedDays([]);
  };

  // Add time slot for ALL selected days
  const handleAddSlots = () => {
    if (selectedDays.length === 0) {
      toast.error('Please select at least one day');
      return;
    }
    if (startTime >= endTime) {
      toast.error('Start time must be before end time');
      return;
    }

    // Create a slot entry for each selected day
    const newSlots = selectedDays.map(day => ({
      day,
      startTime,
      endTime
    }));

    // Filter out duplicates (same day + same time already exists)
    const filteredNewSlots = newSlots.filter(newSlot =>
      !schedule.some(existing =>
        existing.day === newSlot.day &&
        existing.startTime === newSlot.startTime &&
        existing.endTime === newSlot.endTime
      )
    );

    if (filteredNewSlots.length === 0) {
      toast.error('These slots already exist in your schedule');
      return;
    }

    setSchedule(prev => [...prev, ...filteredNewSlots]);
    toast.success(`Added ${filteredNewSlots.length} slot(s) to schedule`);
  };

  // Remove a time slot
  const handleRemoveSlot = (index) => {
    setSchedule(prev => prev.filter((_, i) => i !== index));
  };

  // Remove all slots for a specific day
  const handleRemoveDay = (day) => {
    setSchedule(prev => prev.filter(slot => slot.day !== day));
    toast.success(`Removed all ${day} slots`);
  };

  // Save schedule to backend
  const handleSave = async () => {
    try {
      await availabilityAPI.set({ availability: schedule, slotDuration });
      toast.success('Availability saved!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save availability');
    }
  };

  // Group schedule by day for display
  const groupedSchedule = days.reduce((acc, day) => {
    const daySlots = schedule.filter(slot => slot.day === day);
    if (daySlots.length > 0) acc[day] = daySlots;
    return acc;
  }, {});

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading...</div>;
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Set Your Weekly Schedule</h2>

      {/* Slot duration setting */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Appointment Duration (minutes)
        </label>
        <select
          value={slotDuration}
          onChange={(e) => setSlotDuration(Number(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
        >
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={45}>45 minutes</option>
          <option value={60}>60 minutes</option>
        </select>
        <p className="text-sm text-gray-500 mt-1">
          Each booking slot will be this long
        </p>
      </div>

      {/* Add new slots form — supports multiple days */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="font-medium text-gray-800 mb-4">Add Available Time</h3>
        
        {/* Day selection — checkboxes */}
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-2">Select Days</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {days.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                  selectedDays.includes(day)
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {day.substring(0, 3)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectWeekdays}
              className="text-xs text-primary-600 hover:underline"
            >
              Select Mon–Sat
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={clearDays}
              className="text-xs text-gray-500 hover:underline"
            >
              Clear all
            </button>
          </div>
        </div>

        {/* Time selection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-sm text-gray-600 mb-1">From</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">To</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <button
            onClick={handleAddSlots}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            + Add to {selectedDays.length || 0} day(s)
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Tip: Select multiple days, set the time, and click Add. You can add different times by repeating this.
        </p>
      </div>

      {/* Current schedule — grouped by day */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="font-medium text-gray-800 mb-4">Your Current Schedule</h3>
        {Object.keys(groupedSchedule).length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No availability set yet. Select days and time above, then click Add.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedSchedule).map(([day, slots]) => (
              <div key={day} className="border border-gray-200 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-800">{day}</span>
                  <button
                    onClick={() => handleRemoveDay(day)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    Remove all {day}
                  </button>
                </div>
                <div className="space-y-1">
                  {slots.map((slot, idx) => {
                    // Find the actual index in the full schedule array
                    const actualIndex = schedule.findIndex(
                      (s, i) => s.day === slot.day && s.startTime === slot.startTime && s.endTime === slot.endTime &&
                      schedule.slice(0, i).filter(x => x.day === slot.day && x.startTime === slot.startTime && x.endTime === slot.endTime).length === idx
                    );
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded"
                      >
                        <span className="text-gray-600 text-sm">
                          {slot.startTime} — {slot.endTime}
                        </span>
                        <button
                          onClick={() => handleRemoveSlot(actualIndex >= 0 ? actualIndex : schedule.indexOf(slot))}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        className="bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
      >
        Save Availability
      </button>
    </div>
  );
}

export default Dashboard;
