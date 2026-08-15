import { useState, useEffect } from 'react';
import { reportAPI } from '../../services/api';
import { PromptModal } from '../../components/Modal';
import { getSocket } from '../../services/socket';
import toast from 'react-hot-toast';

function DoctorPatientReports() {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState({ open: false, reportId: null });

  // Search by patient name/phone/Patient ID — resolved server-side so this
  // scales the same way as the Appointments tab, instead of fetching every
  // report a busy doctor has ever received just to filter it in the browser.
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  const fetchReports = async () => {
    try {
      const response = await reportAPI.getMine({ page, limit: 10, search: searchDebounced || undefined });
      setReports(response.data.reports);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Fetch reports error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchDebounced]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Realtime: the moment a patient uploads or replaces a report, refresh this
  // list instantly instead of the doctor needing to reload the page.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleReportUpdate = () => {
      fetchReports();
      toast.success('New report from a patient!');
    };

    socket.on('report-updated', handleReportUpdate);
    return () => socket.off('report-updated', handleReportUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchDebounced]);

  const handleReview = async (values) => {
    if (!values.comment) return;
    try {
      await reportAPI.review(reviewModal.reportId, { doctorComment: values.comment });
      toast.success('Report reviewed');
      setReviewModal({ open: false, reportId: null });
      fetchReports();
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

      {(pagination?.total > 5 || searchDebounced) && (
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search by patient name, phone, or Patient ID..."
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
          />
        </div>
      )}

      {reports.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <div className="text-5xl mb-4">{searchDebounced ? '🔍' : '📋'}</div>
          <h3 className="text-xl font-medium text-gray-700">{searchDebounced ? `No reports match "${searchDebounced}"` : 'No reports shared yet'}</h3>
          {searchDebounced ? (
            <button onClick={() => setSearch('')} className="text-primary-600 text-sm font-medium hover:underline mt-3 inline-block">Clear search</button>
          ) : (
            <p className="text-gray-500 mt-2">When patients upload test reports for you, they'll appear here.</p>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report._id} className="bg-white rounded-xl shadow-md p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-800">{report.title}</h3>
                    <p className="text-sm text-gray-500">
                      Patient: {report.patient?.name}{report.patient?.patientId && ` (${report.patient.patientId})`} ({report.patient?.phone || report.patient?.email}) • {formatDate(report.createdAt)}
                    </p>
                    {report.description && (
                      <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        if (report.filePath.startsWith('data:application/pdf')) {
                          const win = window.open();
                          win.document.write(`<iframe src="${report.filePath}" style="width:100%;height:100%;border:none;"></iframe>`);
                        } else {
                          const modal = document.createElement('div');
                          modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:1rem;cursor:pointer;';
                          modal.onclick = () => modal.remove();
                          const img = document.createElement('img');
                          img.src = report.filePath.startsWith('data:') ? report.filePath : '';
                          img.style.cssText = 'max-width:90%;max-height:90%;border-radius:8px;';
                          img.onerror = () => { modal.remove(); alert('File unavailable'); };
                          modal.appendChild(img);
                          document.body.appendChild(modal);
                        }
                      }}
                      className="px-3 py-1 bg-primary-100 text-primary-700 rounded-lg text-sm hover:bg-primary-200"
                    >
                      View File
                    </button>
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

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-200">Previous</button>
              <span className="text-sm text-gray-600">Page {page} of {pagination.totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-200">Next</button>
            </div>
          )}
        </>
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
