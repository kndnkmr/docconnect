import { useState, useEffect } from 'react';
import { reportAPI, appointmentAPI } from '../../services/api';
import { getSocket } from '../../services/socket';
import toast from 'react-hot-toast';

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

  // Realtime: the moment a doctor reviews a report, refresh instantly instead
  // of the patient needing to reload the page.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleReportUpdate = () => {
      fetchReports();
      toast.success('Your doctor reviewed your report!');
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
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
              Upload Report
            </button>
          </form>
        </div>
      )}

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
                    View File
                  </button>
                  <label className="cursor-pointer px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 transition-colors">
                    Replace File
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
                          toast.success('File replaced successfully');
                          fetchReports();
                        } catch (error) {
                          toast.error('Failed to replace file');
                        }
                      }}
                    />
                  </label>
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

export default PatientReports;
