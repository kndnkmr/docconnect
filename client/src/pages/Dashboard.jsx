// ============================================
// Dashboard Page - User's Personal Dashboard
// ============================================
// Shows different content based on the user's role:
// - PATIENT: their booked appointments, quick links
// - DOCTOR: their appointments, profile edit, thesis management
//
// KEY CONCEPTS:
// - Role-based rendering: same page, different content per role
// - Tabs: switch between different sections within one page
// - Status badges: visual indicators for appointment status
// - Date formatting: display dates in human-readable format

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { appointmentAPI, doctorAPI, thesisAPI, availabilityAPI } from '../services/api';
import toast from 'react-hot-toast';

function Dashboard() {
  const { user, isDoctor, isPatient } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('appointments');
  // Tabs: 'appointments', 'profile' (doctor), 'publications' (doctor)

  // Doctor-specific state
  const [profileData, setProfileData] = useState({
    specialization: '',
    experience: '',
    qualification: '',
    clinicAddress: '',
    consultationFee: '',
    bio: ''
  });

  // ---- Fetch appointments on load ----
  useEffect(() => {
    fetchAppointments();
  }, []);

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
      await appointmentAPI.updateStatus(appointmentId, { status: newStatus });
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
              onClick={() => setActiveTab('publications')}
              className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'publications'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              My Publications
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
          </>
        )}
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
                    <p className="text-gray-500 text-sm mt-1">
                      Reason: {apt.reason}
                    </p>
                    {apt.notes && (
                      <p className="text-gray-500 text-sm mt-1 italic">
                        Notes: {apt.notes}
                      </p>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Consultation Fee ($)</label>
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
            <button
              type="submit"
              className="bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              Save Profile
            </button>
          </form>
        </div>
      )}

      {/* === PUBLICATIONS TAB (Doctor only) === */}
      {activeTab === 'publications' && isDoctor && (
        <DoctorPublications />
      )}

      {/* === AVAILABILITY TAB (Doctor only) === */}
      {activeTab === 'availability' && isDoctor && (
        <DoctorAvailability />
      )}
    </div>
  );
}

// ---- Doctor Publications Sub-component ----
// Separated for cleanliness — manages its own state

function DoctorPublications() {
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    abstract: '',
    tags: '',
    visibility: 'public'
  });

  useEffect(() => {
    fetchPublications();
  }, []);

  const fetchPublications = async () => {
    try {
      const response = await thesisAPI.getMine();
      setPublications(response.data.publications);
    } catch (error) {
      console.error('Fetch publications error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await thesisAPI.create(formData);
      toast.success('Publication created!');
      setShowForm(false);
      setFormData({ title: '', abstract: '', tags: '', visibility: 'public' });
      fetchPublications();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create publication');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this publication?')) return;
    try {
      await thesisAPI.delete(id);
      toast.success('Publication deleted');
      fetchPublications();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">My Publications</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Publication'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-md p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Research paper title"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Abstract</label>
            <textarea
              value={formData.abstract}
              onChange={(e) => setFormData(prev => ({ ...prev, abstract: e.target.value }))}
              placeholder="Brief summary of your research..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="e.g., cardiology, research, prevention"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
            <select
              value={formData.visibility}
              onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="public">Public (anyone can view)</option>
              <option value="private">Private (only you can see)</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Publish
          </button>
        </form>
      )}

      {/* Publications list */}
      {loading ? (
        <div className="text-center py-8 text-gray-600">Loading...</div>
      ) : publications.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <div className="text-5xl mb-4">📝</div>
          <h3 className="text-xl font-medium text-gray-700">No publications yet</h3>
          <p className="text-gray-500 mt-2">Share your research with the community!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {publications.map((pub) => (
            <div key={pub._id} className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-800 text-lg">{pub.title}</h3>
                  <p className="text-gray-600 text-sm mt-1 line-clamp-2">{pub.abstract}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      pub.visibility === 'public'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {pub.visibility}
                    </span>
                    <span className="text-gray-400 text-sm">
                      {pub.viewCount} views
                    </span>
                    {pub.slug && (
                      <span className="text-primary-600 text-sm">
                        /publications/{pub.slug}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(pub._id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Doctor Availability Sub-component ----
// Lets doctors set their weekly schedule

function DoctorAvailability() {
  const [schedule, setSchedule] = useState([]);
  const [slotDuration, setSlotDuration] = useState(30);
  const [loading, setLoading] = useState(true);
  const [newSlot, setNewSlot] = useState({ day: 'Monday', startTime: '09:00', endTime: '17:00' });

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

  // Add a new time slot
  const handleAddSlot = () => {
    if (newSlot.startTime >= newSlot.endTime) {
      toast.error('Start time must be before end time');
      return;
    }
    setSchedule(prev => [...prev, { ...newSlot }]);
  };

  // Remove a time slot
  const handleRemoveSlot = (index) => {
    setSchedule(prev => prev.filter((_, i) => i !== index));
    // filter keeps all items EXCEPT the one at this index
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

      {/* Add new slot form */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="font-medium text-gray-800 mb-4">Add Available Time</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Day</label>
            <select
              value={newSlot.day}
              onChange={(e) => setNewSlot(prev => ({ ...prev, day: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              {days.map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">From</label>
            <input
              type="time"
              value={newSlot.startTime}
              onChange={(e) => setNewSlot(prev => ({ ...prev, startTime: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">To</label>
            <input
              type="time"
              value={newSlot.endTime}
              onChange={(e) => setNewSlot(prev => ({ ...prev, endTime: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <button
            onClick={handleAddSlot}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Current schedule */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="font-medium text-gray-800 mb-4">Your Current Schedule</h3>
        {schedule.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No availability set yet. Add your available hours above.
          </p>
        ) : (
          <div className="space-y-2">
            {schedule.map((slot, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <span className="font-medium text-gray-800">{slot.day}</span>
                  <span className="text-gray-600 ml-3">
                    {slot.startTime} — {slot.endTime}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveSlot(index)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  Remove
                </button>
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
