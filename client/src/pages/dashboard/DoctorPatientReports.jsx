import { useState, useEffect } from 'react';
import { reportAPI } from '../../services/api';
import { PromptModal } from '../../components/Modal';
import toast from 'react-hot-toast';

function DoctorPatientReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState({ open: false, reportId: null });

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

  const handleReview = async (values) => {
    if (!values.comment) return;
    try {
      await reportAPI.review(reviewModal.reportId, { doctorComment: values.comment });
      toast.success('Report reviewed');
      setReviewModal({ open: false, reportId: null });
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
                      onClick={() => setReviewModal({ open: true, reportId: report._id })}
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

      {/* Review Modal */}
      <PromptModal
        open={reviewModal.open}
        title="Review Report"
        description="Add your comment or review for this patient's report."
        fields={[{ name: 'comment', label: 'Your Review', type: 'textarea', placeholder: 'Enter your review/observations...', required: true }]}
        submitText="Submit Review"
        onSubmit={handleReview}
        onCancel={() => setReviewModal({ open: false, reportId: null })}
      />
    </div>
  );
}

export default DoctorPatientReports;
