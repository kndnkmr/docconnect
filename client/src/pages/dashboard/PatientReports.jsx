import { useState, useEffect, useRef } from 'react';
import { reportAPI, appointmentAPI } from '../../services/api';
import { getSocket } from '../../services/socket';
import LoadingBlock from '../../components/LoadingBlock';
import toast from 'react-hot-toast';
import { useLang } from '../../context/LangContext';

// Bilingual fixed UI text. Report titles/notes, doctor names, dates, statuses
// and server messages stay as they are.
const REPORTS_TXT = {
  en: {
    reviewedToast: 'Your doctor reviewed your report!',
    fillAll: 'Please fill title, select doctor, and upload a file',
    uploaded: 'Report uploaded! Your doctor can now view it.',
    uploadFailed: 'Failed to upload report',
    heading: 'My Medical Reports',
    cancel: 'Cancel',
    uploadBtn: '+ Upload Report',
    formTitle: 'Upload Test Report',
    titleLabel: 'Report Title',
    titlePlaceholder: 'e.g., Blood Test Report, MRI Scan',
    selectDoctor: 'Select Doctor',
    chooseDoctor: 'Choose doctor to share with...',
    general: 'General',
    whichVisit: 'Which visit is this for? (optional)',
    whichVisitHint: 'Linking it helps your doctor see it right on that appointment, not just in the Reports list.',
    noVisit: 'General — not tied to a specific visit',
    descLabel: 'Description (optional)',
    descPlaceholder: 'Any notes about this report',
    fileLabel: 'Upload File (PDF or Image)',
    submit: 'Upload Report',
    emptyTitle: 'No reports uploaded',
    emptyText: 'Upload your test reports here so your doctor can review them.',
    sharedWith: (name) => `Shared with: Dr. ${name}`,
    reviewed: 'Reviewed',
    pending: 'Pending Review',
    viewFile: 'View File',
    replaceFile: 'Replace File',
    replaced: 'File replaced successfully',
    replaceFailed: 'Failed to replace file',
    doctorComment: "Doctor's Comment:",
    aptStatus: {},
  },
  hi: {
    reviewedToast: 'आपके डॉक्टर ने आपकी रिपोर्ट देख ली है!',
    fillAll: 'कृपया रिपोर्ट का नाम लिखें, डॉक्टर चुनें और फ़ाइल डालें',
    uploaded: 'रिपोर्ट अपलोड हो गई! अब आपके डॉक्टर इसे देख सकते हैं।',
    uploadFailed: 'रिपोर्ट अपलोड नहीं हो पाई',
    heading: 'मेरी मेडिकल रिपोर्ट',
    cancel: 'रद्द करें',
    uploadBtn: '+ रिपोर्ट अपलोड करें',
    formTitle: 'जाँच की रिपोर्ट अपलोड करें',
    titleLabel: 'रिपोर्ट का नाम',
    titlePlaceholder: 'जैसे: खून की जाँच, MRI स्कैन',
    selectDoctor: 'डॉक्टर चुनें',
    chooseDoctor: 'किस डॉक्टर को दिखानी है, चुनें...',
    general: 'सामान्य',
    whichVisit: 'यह किस अपॉइंटमेंट की है? (ज़रूरी नहीं)',
    whichVisitHint: 'जोड़ देने से डॉक्टर इसे उसी अपॉइंटमेंट पर देख पाएँगे, सिर्फ़ रिपोर्ट की लिस्ट में नहीं।',
    noVisit: 'सामान्य — किसी खास अपॉइंटमेंट से नहीं जुड़ी',
    descLabel: 'जानकारी (ज़रूरी नहीं)',
    descPlaceholder: 'इस रिपोर्ट के बारे में कुछ बताना हो तो लिखें',
    fileLabel: 'फ़ाइल डालें (PDF या फ़ोटो)',
    submit: 'रिपोर्ट अपलोड करें',
    emptyTitle: 'अभी कोई रिपोर्ट अपलोड नहीं की',
    emptyText: 'अपनी जाँच की रिपोर्ट यहाँ अपलोड करें ताकि डॉक्टर उन्हें देख सकें।',
    sharedWith: (name) => `किसे भेजी: डॉ. ${name}`,
    reviewed: 'डॉक्टर ने देख ली',
    pending: 'देखना बाकी है',
    viewFile: 'फ़ाइल देखें',
    replaceFile: 'फ़ाइल बदलें',
    replaced: 'फ़ाइल बदल दी गई',
    replaceFailed: 'फ़ाइल नहीं बदल पाई',
    doctorComment: 'डॉक्टर की राय:',
    aptStatus: { pending: 'पुष्टि बाकी', confirmed: 'पक्का', completed: 'पूरा हुआ', cancelled: 'रद्द' },
  },
};

function PatientReports() {
  const { lang } = useLang();
  const t = REPORTS_TXT[lang] || REPORTS_TXT.en;
  // The socket listener is registered once; read the latest text through a ref.
  const tRef = useRef(t);
  tRef.current = t;
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', doctorId: '', appointmentId: '' });
  const [file, setFile] = useState(null);
  const [doctors, setDoctors] = useState([]);
  // Every appointment (not just the unique-doctor summary in `doctors`) so
  // the form can offer "which visit is this for?" once a doctor is picked.
  // Without this, a report never gets linked to an appointment at all -
  // which silently breaks the doctor-side "patient uploaded a report" next-
  // step hint on that appointment's card.
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    fetchReports();
    fetchDoctors();
  }, []);

  // Realtime: the moment a doctor reviews a report, refresh instantly instead
  // of the patient needing to reload the page.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleReportUpdate = () => {
      fetchReports();
      toast.success(tRef.current.reviewedToast);
    };

    socket.on('report-updated', handleReportUpdate);
    return () => socket.off('report-updated', handleReportUpdate);
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

  const fetchDoctors = async () => {
    try {
      const response = await appointmentAPI.getMine({ limit: 50 });
      setAppointments(response.data.appointments || []);
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

  const formatDateShort = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  // Appointments with the currently-selected doctor, newest first — the
  // options for "which visit is this for?".
  const appointmentsForSelectedDoctor = formData.doctorId
    ? appointments.filter((apt) => apt.doctor?._id === formData.doctorId).sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.doctorId || !file) {
      toast.error(t.fillAll);
      return;
    }

    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description);
    data.append('doctorId', formData.doctorId);
    if (formData.appointmentId) data.append('appointmentId', formData.appointmentId);
    data.append('reportFile', file);

    try {
      await reportAPI.upload(data);
      toast.success(t.uploaded);
      setShowForm(false);
      setFormData({ title: '', description: '', doctorId: '', appointmentId: '' });
      setFile(null);
      fetchReports();
    } catch (error) {
      toast.error(error.response?.data?.message || t.uploadFailed);
    }
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
          {showForm ? t.cancel : t.uploadBtn}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="font-medium text-gray-800 mb-4">{t.formTitle}</h3>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.titleLabel}</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder={t.titlePlaceholder}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.selectDoctor}</label>
              <select
                value={formData.doctorId}
                onChange={(e) => setFormData(prev => ({ ...prev, doctorId: e.target.value, appointmentId: '' }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              >
                <option value="">{t.chooseDoctor}</option>
                {doctors.map(doc => (
                  <option key={doc._id} value={doc._id}>
                    Dr. {doc.name} ({doc.specialization || t.general})
                  </option>
                ))}
              </select>
            </div>
            {formData.doctorId && appointmentsForSelectedDoctor.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.whichVisit}</label>
                <p className="text-xs text-gray-500 mb-1">{t.whichVisitHint}</p>
                <select
                  value={formData.appointmentId}
                  onChange={(e) => setFormData(prev => ({ ...prev, appointmentId: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">{t.noVisit}</option>
                  {appointmentsForSelectedDoctor.map(apt => (
                    <option key={apt._id} value={apt._id}>
                      {formatDateShort(apt.date)} • {apt.timeSlot} ({t.aptStatus[apt.status] || apt.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.descLabel}</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t.descPlaceholder}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.fileLabel}</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
              {t.submit}
            </button>
          </form>
        </div>
      )}

      {reports.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-xl font-medium text-gray-700">{t.emptyTitle}</h3>
          <p className="text-gray-500 mt-2">{t.emptyText}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report._id} className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-800">{report.title}</h3>
                  <p className="text-sm text-gray-500">
                    {t.sharedWith(report.doctor?.name)} • {formatDate(report.createdAt)}
                  </p>
                  {report.description && (
                    <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    report.isReviewed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {report.isReviewed ? t.reviewed : t.pending}
                  </span>
                  <button
                    onClick={() => {
                      if (report.filePath.startsWith('data:application/pdf')) {
                        const win = window.open();
                        win.document.write(`<iframe src="${report.filePath}" style="width:100%;height:100%;border:none;"></iframe>`);
                      } else if (report.filePath.startsWith('data:')) {
                        const modal = document.createElement('div');
                        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:1rem;cursor:pointer;';
                        modal.onclick = () => modal.remove();
                        const img = document.createElement('img');
                        img.src = report.filePath;
                        img.style.cssText = 'max-width:90%;max-height:90%;border-radius:8px;';
                        img.onerror = () => { modal.remove(); };
                        modal.appendChild(img);
                        document.body.appendChild(modal);
                      }
                    }}
                    className="text-primary-600 text-sm hover:underline"
                  >
                    {t.viewFile}
                  </button>
                  <label className="cursor-pointer px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 transition-colors">
                    {t.replaceFile}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const data = new FormData();
                        data.append('reportFile', file);
                        try {
                          await reportAPI.update(report._id, data);
                          toast.success(t.replaced);
                          fetchReports();
                        } catch (error) {
                          toast.error(t.replaceFailed);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
              {report.doctorComment && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">{t.doctorComment}</p>
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

export default PatientReports;
