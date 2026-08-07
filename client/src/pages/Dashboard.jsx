// ============================================
// Dashboard Page - User's Personal Dashboard
// ============================================
// Shows different content based on the user's role.
// Sub-components are split into separate files for maintainability.

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { appointmentAPI, doctorAPI, authAPI, prescriptionAPI, reviewAPI } from '../services/api';
import { ConfirmModal, PromptModal } from '../components/Modal';
import ChatBox from '../components/ChatBox';
import toast from 'react-hot-toast';

// Extracted sub-components
import DoctorAvailability from './dashboard/DoctorAvailability';
import DoctorPatientReports from './dashboard/DoctorPatientReports';
import PatientFamilyMembers from './dashboard/PatientFamilyMembers';
import PatientPrescriptions from './dashboard/PatientPrescriptions';
import PatientReports from './dashboard/PatientReports';
import PatientComplaints from './dashboard/PatientComplaints';
import AccountSettings from './dashboard/AccountSettings';

function Dashboard() {
  const { user, isDoctor, isPatient } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('appointments');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  // Modal state
  const [cancelModal, setCancelModal] = useState({ open: false, id: null });
  const [rateModal, setRateModal] = useState({ open: false, id: null });
  const [meetingLinkModal, setMeetingLinkModal] = useState({ open: false, id: null });
  const [prescriptionModal, setPrescriptionModal] = useState({ open: false, id: null });
  const [chatAppointmentId, setChatAppointmentId] = useState(null);

  // Doctor profile state
  const [profileData, setProfileData] = useState({
    specialization: '', experience: '', qualification: '',
    clinicAddress: '', consultationFee: '', bio: '',
    phone: '', whatsappNumber: '', upiId: ''
  });

  useEffect(() => {
    fetchAppointments();
    if (isDoctor) fetchProfile();
  }, [page]);

  const fetchProfile = async () => {
    try {
      const response = await authAPI.getMe();
      const d = response.data.user;
      setProfileData({
        specialization: d.specialization || '', experience: d.experience || '',
        qualification: d.qualification || '', clinicAddress: d.clinicAddress || '',
        consultationFee: d.consultationFee || '', bio: d.bio || '',
        phone: d.phone || '', whatsappNumber: d.whatsappNumber || '', upiId: d.upiId || ''
      });
    } catch (error) { console.error('Fetch profile error:', error); }
  };

  const fetchAppointments = async () => {
    try {
      const response = await appointmentAPI.getMine({ limit: 10, page });
      setAppointments(response.data.appointments);
      setPagination(response.data.pagination);
    } catch (error) { console.error('Fetch appointments error:', error); }
    finally { setLoading(false); }
  };

  // ---- Doctor: Update appointment status ----
  const handleStatusUpdate = async (appointmentId, newStatus, meetingLink) => {
    try {
      let data = { status: newStatus };
      if (meetingLink) data.meetingLink = meetingLink;
      await appointmentAPI.updateStatus(appointmentId, data);
      toast.success(`Appointment ${newStatus}`);
      fetchAppointments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    }
  };

  // ---- Patient: Cancel appointment ----
  const handleCancel = async () => {
    try {
      await appointmentAPI.cancel(cancelModal.id, { cancellationReason: 'Cancelled by patient from dashboard' });
      toast.success('Appointment cancelled');
      setCancelModal({ open: false, id: null });
      fetchAppointments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel');
    }
  };

  // ---- Patient: Rate doctor ----
  const handleRateDoctor = async (values) => {
    const rating = parseInt(values.rating);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      toast.error('Please enter a rating between 1 and 5');
      return;
    }
    try {
      await reviewAPI.create({ appointmentId: rateModal.id, rating, comment: values.comment || '' });
      toast.success('Thank you for your review!');
      setRateModal({ open: false, id: null });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit review');
    }
  };

  // ---- Doctor: Write Prescription ----
  const handleWritePrescription = async (values) => {
    const medicines = values.medicines ? values.medicines.split(',').map(m => {
      const parts = m.trim().split(' - ');
      return { name: parts[0] || m.trim(), dosage: '', frequency: parts[1] || '', duration: parts[2] || '', instructions: parts[3] || '' };
    }) : [];
    const testsRecommended = values.tests ? values.tests.split(',').map(t => t.trim()).filter(t => t) : [];
    try {
      await prescriptionAPI.create({
        appointmentId: prescriptionModal.id, diagnosis: values.diagnosis,
        medicines, testsRecommended, notes: values.notes || ''
      });
      toast.success('Prescription created!');
      setPrescriptionModal({ open: false, id: null });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create prescription');
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();

    // Validate all fields are filled
    const requiredFields = [
      { key: 'specialization', label: 'Specialization' },
      { key: 'qualification', label: 'Qualification' },
      { key: 'experience', label: 'Years of Experience' },
      { key: 'consultationFee', label: 'Consultation Fee' },
      { key: 'clinicAddress', label: 'Clinic Address' },
      { key: 'phone', label: 'Phone Number' },
      { key: 'whatsappNumber', label: 'WhatsApp Number' },
      { key: 'upiId', label: 'UPI ID' },
    ];
    const missing = requiredFields.filter(f => !profileData[f.key]);
    if (missing.length > 0) {
      toast.error(`Please fill: ${missing.map(f => f.label).join(', ')}`);
      return;
    }

    try {
      await doctorAPI.updateProfile(profileData);
      toast.success('Profile updated!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    }
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  const getStatusColor = (status) => ({ pending: 'bg-yellow-100 text-yellow-800', confirmed: 'bg-green-100 text-green-800', completed: 'bg-blue-100 text-blue-800', cancelled: 'bg-red-100 text-red-800' }[status] || 'bg-gray-100 text-gray-800');

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Email Verification Banner for unverified doctors */}
      {isDoctor && user && !user.isVerified && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📧</span>
            <div>
              <p className="font-semibold text-orange-800">Verify your email to go live</p>
              <p className="text-sm text-orange-700">Your profile won't appear in patient search until you verify your email.</p>
            </div>
          </div>
          <button
            onClick={async () => { try { await authAPI.resendVerification(); toast.success('Verification email sent! Check your inbox.'); } catch(e) { toast.error(e.response?.data?.message || 'Failed to send'); } }}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 whitespace-nowrap"
          >
            Resend Email
          </button>
        </div>
      )}

      {/* Notification Banner */}
      {isDoctor && appointments.filter(a => a.status === 'pending').length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center gap-3">
          <span className="text-2xl">🔔</span>
          <div>
            <p className="font-semibold text-yellow-800">You have {appointments.filter(a => a.status === 'pending').length} new appointment request{appointments.filter(a => a.status === 'pending').length > 1 ? 's' : ''}!</p>
            <p className="text-sm text-yellow-700">Please confirm or reject them from the Appointments tab below.</p>
          </div>
        </div>
      )}

      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Welcome, {user?.name}!</h1>
        <p className="text-gray-600 mt-1">{isDoctor ? 'Manage your practice and appointments' : 'View your appointments and find doctors'}</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b mb-6 overflow-x-auto">
        {[
          { key: 'appointments', label: 'My Appointments', show: true },
          { key: 'profile', label: 'Edit Profile', show: isDoctor },
          { key: 'availability', label: 'Availability', show: isDoctor },
          { key: 'patientReports', label: 'Patient Reports', show: isDoctor },
          { key: 'familyMembers', label: 'Family Members', show: isPatient },
          { key: 'prescriptions', label: 'Prescriptions', show: isPatient },
          { key: 'reports', label: 'My Reports', show: isPatient },
          { key: 'complaints', label: 'Complaints', show: isPatient },
          { key: 'account', label: 'Account Settings', show: true },
        ].filter(t => t.show).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* === APPOINTMENTS TAB === */}
      {activeTab === 'appointments' && (
        <div>
          {isPatient && (
            <div className="mb-6">
              <Link to="/doctors" className="inline-block bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors">+ Book New Appointment</Link>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-600">Loading appointments...</div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-md">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="text-xl font-medium text-gray-700">No appointments yet</h3>
              <p className="text-gray-500 mt-2">{isPatient ? 'Browse doctors and book your first appointment!' : 'Your upcoming appointments will appear here.'}</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {appointments.map((apt) => (
                  <div key={apt._id} className="bg-white rounded-xl shadow-md p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-800">{isPatient ? `Dr. ${apt.doctor?.name || 'Unknown'}` : apt.patient?.name || 'Unknown Patient'}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(apt.status)}`}>{apt.status}</span>
                      </div>
                      <p className="text-gray-600 text-sm">{formatDate(apt.date)} • {apt.timeSlot}</p>
                      {isDoctor && apt.patient?.phone && <p className="text-gray-600 text-sm mt-1">Patient Phone: <a href={`tel:${apt.patient.phone}`} className="text-primary-600 hover:underline">{apt.patient.phone}</a></p>}
                      <p className="text-gray-500 text-sm mt-1">Reason: {apt.reason}</p>
                      {apt.bookedFor === 'family' && apt.familyMemberName && <p className="text-purple-600 text-sm mt-1 font-medium">Booked for: {apt.familyMemberName} (family member)</p>}
                      {apt.notes && <p className="text-gray-500 text-sm mt-1 italic">Notes: {apt.notes}</p>}
                      {apt.meetingLink && <a href={apt.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors">Join Meeting Link</a>}
                      {isPatient && apt.status === 'confirmed' && apt.paymentStatus !== 'paid' && (
                        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <p className="text-sm font-medium text-orange-800">Payment Required — ₹{apt.doctor?.consultationFee || 'as discussed'}</p>
                          {apt.doctor?.upiId && (
                            <>
                              <div className="mt-2 p-2 bg-white border border-orange-200 rounded-lg text-center">
                                <p className="text-xs text-orange-600 mb-1">Pay to UPI ID:</p>
                                <p className="text-lg font-mono font-bold text-orange-900 select-all">{apt.doctor.upiId}</p>
                                {apt.doctor?.phone && (
                                  <p className="text-xs text-orange-600 mt-2">Or pay to mobile number: <span className="font-mono font-bold text-orange-900">{apt.doctor.phone}</span></p>
                                )}
                              </div>
                              <div className="flex gap-2 mt-2">
                                <a
                                  href={`upi://pay?pa=${apt.doctor.upiId}&pn=${encodeURIComponent(apt.doctor.name || 'Doctor')}&cu=INR&tn=Consultation fee`}
                                  className="flex-1 text-center px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
                                >
                                  Open UPI App to Pay
                                </a>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(apt.doctor.upiId); toast.success('UPI ID copied!'); }}
                                  className="px-4 py-2 border border-orange-300 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-100"
                                >
                                  Copy ID
                                </button>
                              </div>
                              <p className="text-xs text-orange-600 mt-2">If "Open UPI App" doesn't work, enter the UPI ID or mobile number above in your GPay/PhonePe/Paytm.</p>
                            </>
                          )}
                        </div>
                      )}
                      {apt.paymentStatus === 'paid' && <span className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">✓ Payment Received</span>}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-shrink-0 flex-wrap">
                      {isDoctor && apt.status === 'pending' && (
                        <>
                          <button onClick={() => setMeetingLinkModal({ open: true, id: apt._id })} className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">Confirm</button>
                          <button onClick={() => handleStatusUpdate(apt._id, 'cancelled')} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">Reject</button>
                        </>
                      )}
                      {isDoctor && apt.status === 'confirmed' && <button onClick={() => handleStatusUpdate(apt._id, 'completed')} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">Mark Complete</button>}
                      {isDoctor && apt.status === 'completed' && <button onClick={() => setPrescriptionModal({ open: true, id: apt._id })} className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600">Write Prescription</button>}
                      {isDoctor && apt.paymentStatus !== 'paid' && ['confirmed', 'completed'].includes(apt.status) && (
                        <button onClick={async () => { await appointmentAPI.markPayment(apt._id); toast.success('Payment marked as received'); fetchAppointments(); }} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600">Mark Paid</button>
                      )}
                      {isPatient && ['pending', 'confirmed'].includes(apt.status) && <button onClick={() => setCancelModal({ open: true, id: apt._id })} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">Cancel</button>}
                      {isPatient && apt.status === 'completed' && (
                        <>
                          <button onClick={() => navigate(`/book-appointment/${apt.doctor?._id}`, { state: { repeatBooking: true, originalAppointmentId: apt._id, reason: apt.reason, consultationType: apt.consultationType, bookedFor: apt.bookedFor || 'self', familyMemberName: apt.familyMemberName || '' } })} className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600">Book Again</button>
                          <button onClick={() => setRateModal({ open: true, id: apt._id })} className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600">⭐ Rate</button>
                        </>
                      )}
                      {/* Chat button — for confirmed/completed appointments */}
                      {['confirmed', 'completed'].includes(apt.status) && (
                        <button onClick={() => setChatAppointmentId(apt._id)} className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600">💬 Chat</button>
                      )}
                      {/* Payment screenshot upload — patient only, confirmed appointments */}
                      {isPatient && apt.status === 'confirmed' && apt.paymentStatus !== 'paid' && (
                        <label className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 cursor-pointer">
                          📎 Upload Receipt
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const data = new FormData();
                            data.append('screenshot', file);
                            try {
                              await appointmentAPI.uploadScreenshot(apt._id, data);
                              toast.success('Payment screenshot uploaded!');
                              fetchAppointments();
                            } catch (err) { toast.error('Failed to upload screenshot'); }
                          }} />
                        </label>
                      )}
                      {apt.paymentScreenshot && (
                        <a href={apt.paymentScreenshot} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">View Receipt</a>
                      )}
                      {/* Block patient — doctor only */}
                      {isDoctor && apt.patient && (
                        <button onClick={async () => { try { await (await import('../services/api')).messageAPI.blockPatient(apt.patient._id || apt.patient); toast.success('Patient blocked'); } catch(e) { toast.error('Failed to block'); } }} className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50">Block</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-8">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-200">Previous</button>
                  <span className="text-sm text-gray-600">Page {page} of {pagination.totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-200">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* === EDIT PROFILE TAB (Doctor only) === */}
      {activeTab === 'profile' && isDoctor && (
        <div className="bg-white rounded-xl shadow-md p-8 max-w-2xl">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Update Your Profile</h2>
          <form onSubmit={handleProfileSave} className="space-y-4">
            {[
              { key: 'specialization', label: 'Specialization *', placeholder: 'e.g., Cardiologist, Dentist' },
              { key: 'qualification', label: 'Qualification *', placeholder: 'e.g., MBBS, MD - Cardiology' },
              { key: 'experience', label: 'Years of Experience *', placeholder: 'e.g., 10', type: 'number' },
              { key: 'consultationFee', label: 'Consultation Fee (₹) *', placeholder: 'e.g., 500', type: 'number' },
              { key: 'clinicAddress', label: 'Clinic Address *', placeholder: 'e.g., 123 Health Street' },
              { key: 'phone', label: 'Phone Number *', placeholder: '+91 9876543210', type: 'tel' },
              { key: 'whatsappNumber', label: 'WhatsApp Number *', placeholder: '+91 9876543210', type: 'tel' },
              { key: 'upiId', label: 'UPI ID (for payments) *', placeholder: 'e.g., doctor@upi' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                <input
                  type={field.type || 'text'}
                  value={profileData[field.key]}
                  onChange={(e) => setProfileData(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio / About</label>
              <textarea value={profileData.bio} onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))} placeholder="Tell patients about yourself..." rows={4} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none" />
            </div>
            <button type="submit" className="bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors">Save Profile</button>
          </form>
        </div>
      )}

      {/* Sub-component tabs */}
      {activeTab === 'availability' && isDoctor && <DoctorAvailability />}
      {activeTab === 'patientReports' && isDoctor && <DoctorPatientReports />}
      {activeTab === 'familyMembers' && isPatient && <PatientFamilyMembers />}
      {activeTab === 'prescriptions' && isPatient && <PatientPrescriptions />}
      {activeTab === 'reports' && isPatient && <PatientReports />}
      {activeTab === 'complaints' && isPatient && <PatientComplaints />}
      {activeTab === 'account' && <AccountSettings />}

      {/* === MODALS === */}
      <ConfirmModal
        open={cancelModal.open}
        title="Cancel Appointment"
        message="Are you sure you want to cancel this appointment?"
        confirmText="Cancel Appointment"
        variant="danger"
        onConfirm={handleCancel}
        onCancel={() => setCancelModal({ open: false, id: null })}
      />

      <PromptModal
        open={rateModal.open}
        title="Rate Your Doctor"
        description="How was your experience?"
        fields={[
          { name: 'rating', label: 'Rating (1-5 stars)', type: 'number', min: 1, max: 5, required: true, placeholder: '5' },
          { name: 'comment', label: 'Review (optional)', type: 'textarea', placeholder: 'Write a short review...' }
        ]}
        submitText="Submit Review"
        onSubmit={handleRateDoctor}
        onCancel={() => setRateModal({ open: false, id: null })}
      />

      <PromptModal
        open={meetingLinkModal.open}
        title="Confirm Appointment"
        description="Add a meeting link for video/phone consultations (leave empty for in-person)."
        fields={[{ name: 'meetingLink', label: 'Meeting Link (optional)', type: 'text', placeholder: 'https://meet.google.com/...' }]}
        submitText="Confirm"
        onSubmit={(values) => { handleStatusUpdate(meetingLinkModal.id, 'confirmed', values.meetingLink); setMeetingLinkModal({ open: false, id: null }); }}
        onCancel={() => setMeetingLinkModal({ open: false, id: null })}
      />

      <PromptModal
        open={prescriptionModal.open}
        title="Write Prescription"
        description="Enter the prescription details for this patient."
        fields={[
          { name: 'diagnosis', label: 'Diagnosis', type: 'text', required: true, placeholder: 'e.g., Upper respiratory infection' },
          { name: 'medicines', label: 'Medicines (comma separated)', type: 'textarea', placeholder: 'Paracetamol 500mg - Twice daily - 5 days, Vitamin D - Once daily - 30 days' },
          { name: 'tests', label: 'Recommended Tests (comma separated)', type: 'text', placeholder: 'Complete Blood Count, Thyroid Profile' },
          { name: 'notes', label: 'Additional Notes', type: 'textarea', placeholder: 'Rest, drink fluids...' }
        ]}
        submitText="Create Prescription"
        onSubmit={handleWritePrescription}
        onCancel={() => setPrescriptionModal({ open: false, id: null })}
      />

      {/* Chat Modal */}
      {chatAppointmentId && (
        <ChatBox appointmentId={chatAppointmentId} onClose={() => setChatAppointmentId(null)} />
      )}
    </div>
  );
}

export default Dashboard;
