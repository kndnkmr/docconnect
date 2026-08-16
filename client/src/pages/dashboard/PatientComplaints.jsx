import { useState, useEffect } from 'react';
import { complaintAPI, appointmentAPI } from '../../services/api';
import { getSocket } from '../../services/socket';
import toast from 'react-hot-toast';

function PatientComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ subject: '', description: '', doctorId: '', appointmentId: '' });

  // For the optional "which doctor/visit is this about?" selectors — a
  // complaint filed without either is still allowed (a general complaint),
  // but linking one makes it far more useful for admin to act on.
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    fetchComplaints();
    fetchAppointmentsAndDoctors();
  }, []);

  const fetchAppointmentsAndDoctors = async () => {
    try {
      const response = await appointmentAPI.getMine({ limit: 50 });
      const appts = response.data.appointments || [];
      setAppointments(appts);
      const uniqueDoctors = [];
      const seen = new Set();
      appts.forEach((apt) => {
        const docId = apt.doctor?._id;
        if (docId && !seen.has(docId)) {
          seen.add(docId);
          uniqueDoctors.push({ _id: docId, name: apt.doctor.name, specialization: apt.doctor.specialization });
        }
      });
      setDoctors(uniqueDoctors);
    } catch (error) {
      console.error('Fetch appointments error:', error);
    }
  };

  const formatDateShort = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const appointmentsForSelectedDoctor = formData.doctorId
    ? appointments.filter((apt) => apt.doctor?._id === formData.doctorId).sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];

  // Realtime: the moment admin responds/updates status, refresh this list
  // instantly instead of the patient needing to reload the page.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleComplaintUpdate = () => {
      fetchComplaints();
      toast.success('Your complaint was updated!');
    };

    socket.on('complaint-updated', handleComplaintUpdate);
    return () => socket.off('complaint-updated', handleComplaintUpdate);
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
      await complaintAPI.create({
        subject: formData.subject,
        description: formData.description,
        doctorId: formData.doctorId || undefined,
        appointmentId: formData.appointmentId || undefined
      });
      toast.success('Complaint submitted successfully');
      setShowForm(false);
      setFormData({ subject: '', description: '', doctorId: '', appointmentId: '' });
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

  if (loading) return <div className="text-center py-8 text-gray-600">Loading...</div>;

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
            {doctors.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Which doctor is this about? (optional)</label>
                <select
                  value={formData.doctorId}
                  onChange={(e) => setFormData(prev => ({ ...prev, doctorId: e.target.value, appointmentId: '' }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">General — not about a specific doctor</option>
                  {doctors.map((doc) => (
                    <option key={doc._id} value={doc._id}>
                      Dr. {doc.name} ({doc.specialization || 'General'})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {formData.doctorId && appointmentsForSelectedDoctor.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Which visit is this about? (optional)</label>
                <select
                  value={formData.appointmentId}
                  onChange={(e) => setFormData(prev => ({ ...prev, appointmentId: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">Not tied to a specific visit</option>
                  {appointmentsForSelectedDoctor.map((apt) => (
                    <option key={apt._id} value={apt._id}>
                      {formatDateShort(apt.date)} • {apt.timeSlot} ({apt.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button type="submit" className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors">
              Submit Complaint
            </button>
          </form>
        </div>
      )}

      {complaints.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-xl font-medium text-gray-700">No complaints filed</h3>
          <p className="text-gray-500 mt-2">If you have any issues with our service, click "New Complaint" to let us know.</p>
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
                  {complaint.appointment && ` — visit on ${formatDate(complaint.appointment.date)}, ${complaint.appointment.timeSlot}`}
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

export default PatientComplaints;
