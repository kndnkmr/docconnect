import { useState, useEffect } from 'react';
import { prescriptionAPI } from '../../services/api';

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
                    After completing these tests, upload your reports in the "My Reports" tab.
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PatientPrescriptions;
