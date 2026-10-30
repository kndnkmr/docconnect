import { useState, useEffect, useRef } from 'react';
import { complaintAPI, appointmentAPI } from '../../services/api';
import { getSocket } from '../../services/socket';
import LoadingBlock from '../../components/LoadingBlock';
import toast from 'react-hot-toast';
import { useLang } from '../../context/LangContext';

// Bilingual fixed UI text. Complaint subject/description, admin responses,
// doctor names, dates and server messages stay as they are. Status labels are
// display-only; unknown statuses fall back to the raw value.
const COMPLAINTS_TXT = {
  en: {
    updatedToast: 'Your complaint was updated!',
    fillAll: 'Please fill in subject and description',
    submitted: 'Complaint submitted successfully',
    submitFailed: 'Failed to submit complaint',
    heading: 'My Complaints',
    cancel: 'Cancel',
    newBtn: '+ New Complaint',
    formTitle: 'File a Complaint',
    subjectLabel: 'Subject',
    subjectPlaceholder: 'Brief title of your complaint',
    descLabel: 'Description',
    descPlaceholder: 'Describe your complaint in detail...',
    whichDoctor: 'Which doctor is this about? (optional)',
    noDoctor: 'General — not about a specific doctor',
    general: 'General',
    whichVisit: 'Which visit is this about? (optional)',
    noVisit: 'Not tied to a specific visit',
    submit: 'Submit Complaint',
    emptyTitle: 'No complaints filed',
    emptyText: 'If you have any issues with our service, click "New Complaint" to let us know.',
    status: {},
    aptStatus: {},
    regarding: (name, spec) => `Regarding: Dr. ${name} (${spec})`,
    visitOn: (date, slot) => ` — visit on ${date}, ${slot}`,
    filedOn: (date) => `Filed on: ${date}`,
    adminResponse: 'Admin Response:',
  },
  hi: {
    updatedToast: 'आपकी शिकायत पर अपडेट आया है!',
    fillAll: 'कृपया विषय और पूरी बात लिखें',
    submitted: 'शिकायत दर्ज हो गई',
    submitFailed: 'शिकायत दर्ज नहीं हो पाई',
    heading: 'मेरी शिकायतें',
    cancel: 'रद्द करें',
    newBtn: '+ नई शिकायत',
    formTitle: 'शिकायत दर्ज करें',
    subjectLabel: 'विषय',
    subjectPlaceholder: 'शिकायत किस बारे में है, छोटे में लिखें',
    descLabel: 'पूरी बात',
    descPlaceholder: 'अपनी शिकायत पूरी बताएं...',
    whichDoctor: 'यह किस डॉक्टर के बारे में है? (ज़रूरी नहीं)',
    noDoctor: 'सामान्य — किसी खास डॉक्टर के बारे में नहीं',
    general: 'सामान्य',
    whichVisit: 'यह किस अपॉइंटमेंट के बारे में है? (ज़रूरी नहीं)',
    noVisit: 'किसी खास अपॉइंटमेंट से नहीं जुड़ी',
    submit: 'शिकायत भेजें',
    emptyTitle: 'अभी कोई शिकायत दर्ज नहीं की',
    emptyText: 'हमारी सेवा में कोई परेशानी हो तो "नई शिकायत" दबाकर हमें बताएं।',
    status: { open: 'खुली', 'in-progress': 'काम चल रहा है', resolved: 'हल हो गई', closed: 'बंद' },
    aptStatus: { pending: 'पुष्टि बाकी', confirmed: 'पक्का', completed: 'पूरा हुआ', cancelled: 'रद्द' },
    regarding: (name, spec) => `किसके बारे में: डॉ. ${name} (${spec})`,
    visitOn: (date, slot) => ` — अपॉइंटमेंट ${date}, ${slot}`,
    filedOn: (date) => `दर्ज की: ${date}`,
    adminResponse: 'एडमिन का जवाब:',
  },
};

function PatientComplaints() {
  const { lang } = useLang();
  const t = COMPLAINTS_TXT[lang] || COMPLAINTS_TXT.en;
  // The socket listener is registered once; read the latest text through a ref.
  const tRef = useRef(t);
  tRef.current = t;
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
      toast.success(tRef.current.updatedToast);
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
      toast.error(t.fillAll);
      return;
    }
    try {
      await complaintAPI.create({
        subject: formData.subject,
        description: formData.description,
        doctorId: formData.doctorId || undefined,
        appointmentId: formData.appointmentId || undefined
      });
      toast.success(t.submitted);
      setShowForm(false);
      setFormData({ subject: '', description: '', doctorId: '', appointmentId: '' });
      fetchComplaints();
    } catch (error) {
      toast.error(error.response?.data?.message || t.submitFailed);
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

  if (loading) return <LoadingBlock />;

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">{t.heading}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          {showForm ? t.cancel : t.newBtn}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="font-medium text-gray-800 mb-4">{t.formTitle}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.subjectLabel}</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder={t.subjectPlaceholder}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
                maxLength={200}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.descLabel}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t.descPlaceholder}
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                required
              />
            </div>
            {doctors.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.whichDoctor}</label>
                <select
                  value={formData.doctorId}
                  onChange={(e) => setFormData(prev => ({ ...prev, doctorId: e.target.value, appointmentId: '' }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">{t.noDoctor}</option>
                  {doctors.map((doc) => (
                    <option key={doc._id} value={doc._id}>
                      Dr. {doc.name} ({doc.specialization || t.general})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {formData.doctorId && appointmentsForSelectedDoctor.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.whichVisit}</label>
                <select
                  value={formData.appointmentId}
                  onChange={(e) => setFormData(prev => ({ ...prev, appointmentId: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">{t.noVisit}</option>
                  {appointmentsForSelectedDoctor.map((apt) => (
                    <option key={apt._id} value={apt._id}>
                      {formatDateShort(apt.date)} • {apt.timeSlot} ({t.aptStatus[apt.status] || apt.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button type="submit" className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors">
              {t.submit}
            </button>
          </form>
        </div>
      )}

      {complaints.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-xl font-medium text-gray-700">{t.emptyTitle}</h3>
          <p className="text-gray-500 mt-2">{t.emptyText}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {complaints.map((complaint) => (
            <div key={complaint._id} className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-gray-800">{complaint.subject}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(complaint.status)}`}>
                  {t.status[complaint.status] || complaint.status}
                </span>
              </div>
              <p className="text-gray-600 text-sm mt-2">{complaint.description}</p>
              {complaint.doctor && (
                <p className="text-gray-500 text-xs mt-2">
                  {t.regarding(complaint.doctor.name, complaint.doctor.specialization)}
                  {complaint.appointment && t.visitOn(formatDate(complaint.appointment.date), complaint.appointment.timeSlot)}
                </p>
              )}
              <p className="text-gray-400 text-xs mt-2">{t.filedOn(formatDate(complaint.createdAt))}</p>
              {complaint.response && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800">{t.adminResponse}</p>
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
