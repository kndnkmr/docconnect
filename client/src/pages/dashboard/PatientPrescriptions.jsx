import { useState, useEffect } from 'react';
import { prescriptionAPI } from '../../services/api';
import { downloadPrescriptionPdf, getPrescriptionPdfFile } from '../../utils/prescriptionPdf';
import toast from 'react-hot-toast';

function PatientPrescriptions({ onNavigateTab }) {
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

  const handleDownload = async (rx) => {
    try {
      await downloadPrescriptionPdf(rx);
    } catch (error) {
      console.error('Generate PDF error:', error);
      toast.error('Could not generate PDF. Please try again.');
    }
  };

  // Share via WhatsApp: on mobile browsers that support the Web Share API with
  // files, this opens the native share sheet with the actual PDF attached
  // (WhatsApp shows up as a target). On desktop / unsupported browsers, we
  // fall back to downloading the PDF and opening WhatsApp with a text message,
  // since wa.me links cannot carry a file — the user attaches the downloaded
  // PDF manually in that case.
  const handleShareWhatsApp = async (rx) => {
    try {
      const file = await getPrescriptionPdfFile(rx);
      const shareText = `Prescription from Dr. ${rx.doctor?.name || ''} (${formatDate(rx.createdAt)}) — via ProMedicoz`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Prescription', text: shareText });
        return;
      }

      // Fallback: download the PDF, then open WhatsApp with a text message
      await downloadPrescriptionPdf(rx);
      toast('PDF downloaded — attach it in WhatsApp to share.', { icon: '📎', duration: 5000 });
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    } catch (error) {
      if (error?.name !== 'AbortError') { // user cancelling the native share sheet isn't an error
        console.error('Share prescription error:', error);
        toast.error('Could not share. Please try downloading instead.');
      }
    }
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
                  {rx.doctor?.medicalRegistrationNo && (
                    <p className="text-xs text-gray-400 mt-0.5">Reg. No: {rx.doctor.medicalRegistrationNo}</p>
                  )}
                </div>
                {rx.appointment && (
                  <span className="text-xs text-gray-400">
                    Appt: {formatDate(rx.appointment.date)} {rx.appointment.timeSlot}
                  </span>
                )}
              </div>

              <div className="mb-3">
                <span className="text-sm font-medium text-gray-700">Diagnosis: </span>
                <span className="text-sm text-gray-800">{rx.diagnosis}</span>
              </div>

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

              {rx.testsRecommended && rx.testsRecommended.length > 0 && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800 mb-1">Tests Recommended:</p>
                  <div className="space-y-1 ml-3">
                    {rx.testsRecommended.map((test, idx) => (
                      <div key={idx} className="text-sm text-yellow-700">• {test}</div>
                    ))}
                  </div>
                  <p className="text-xs text-yellow-600 mt-2">
                    After completing these tests,{' '}
                    {onNavigateTab ? (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('reports')}
                        className="underline font-semibold hover:text-yellow-800"
                      >
                        upload your reports here →
                      </button>
                    ) : (
                      'upload your reports in the "My Reports" tab.'
                    )}
                  </p>
                </div>
              )}

              {rx.notes && (
                <div className="mb-2">
                  <span className="text-sm font-medium text-gray-700">Notes: </span>
                  <span className="text-sm text-gray-600 italic">{rx.notes}</span>
                </div>
              )}

              {rx.followUpDate && (
                <p className="text-sm text-primary-600 font-medium mt-2">
                  Follow-up: {formatDate(rx.followUpDate)}
                </p>
              )}

              {/* Download / Share */}
              <div className="flex gap-2 mt-4 pt-3 border-t">
                <button
                  onClick={() => handleDownload(rx)}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  ⬇️ Download PDF
                </button>
                <button
                  onClick={() => handleShareWhatsApp(rx)}
                  className="px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
                >
                  📤 Share via WhatsApp
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PatientPrescriptions;
