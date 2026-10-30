import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { prescriptionAPI, familyMemberAPI } from '../../services/api';
import { personOf, personKey, peopleOf, personEmoji, hasFamilyPrescriptions } from '../../utils/familyChart';
import { downloadPrescriptionPdf, getPrescriptionPdfFile } from '../../utils/prescriptionPdf';
import { getSocket } from '../../services/socket';
import toast from 'react-hot-toast';
import LoadingBlock from '../../components/LoadingBlock';
import { trackEvent } from '../../components/Analytics';
import { useLang } from '../../context/LangContext';

// The daily medicine chart and the family view load only when opened.
const RxChart = lazy(() => import('./RxChart'));
const FamilyMeds = lazy(() => import('./FamilyMeds'));

// Bilingual fixed UI text. Doctor names, diagnosis, medicines, tests, notes,
// registration numbers and dates are shown exactly as the doctor wrote them.
const RX_TXT = {
  en: {
    newRxToast: 'New prescription received!',
    pdfFailed: 'Could not generate PDF. Please try again.',
    shareText: (doc, date) => `Prescription from Dr. ${doc} (${date}) — via ProMedicoz`,
    shareTitle: 'Prescription',
    pdfDownloadedAttach: 'PDF downloaded — attach it in WhatsApp to share.',
    shareFailed: 'Could not share. Please try downloading instead.',
    heading: 'My Prescriptions',
    emptyTitle: 'No prescriptions yet',
    emptyText: 'Prescriptions from your doctors will appear here after consultations.',
    regNo: 'Reg. No:',
    appt: 'Appt:',
    diagnosis: 'Diagnosis: ',
    medicines: 'Medicines:',
    tests: 'Tests Recommended:',
    afterTests: 'After completing these tests,',
    uploadHere: 'upload your reports here →',
    uploadInTab: 'upload your reports in the "My Reports" tab.',
    notes: 'Notes: ',
    followUp: 'Follow-up:',
    download: '⬇️ Download PDF',
    shareWa: '📤 Share via WhatsApp',
  },
  hi: {
    newRxToast: 'नया पर्चा आया है!',
    pdfFailed: 'PDF नहीं बन पाई। कृपया दोबारा कोशिश करें।',
    shareText: (doc, date) => `डॉ. ${doc} का पर्चा (${date}) — ProMedicoz से`,
    shareTitle: 'पर्चा',
    pdfDownloadedAttach: 'PDF डाउनलोड हो गई — भेजने के लिए इसे WhatsApp में जोड़ें।',
    shareFailed: 'भेज नहीं पाए। कृपया PDF डाउनलोड कर लें।',
    heading: 'मेरे पर्चे',
    emptyTitle: 'अभी कोई पर्चा नहीं है',
    emptyText: 'डॉक्टर को दिखाने के बाद उनके लिखे पर्चे यहाँ दिखेंगे।',
    regNo: 'रजि. नं.:',
    appt: 'अपॉइंटमेंट:',
    diagnosis: 'बीमारी: ',
    medicines: 'दवाएं:',
    tests: 'ये जाँच करवाएं:',
    afterTests: 'जाँच हो जाने के बाद,',
    uploadHere: 'अपनी रिपोर्ट यहाँ अपलोड करें →',
    uploadInTab: '"मेरी रिपोर्ट" टैब में अपनी रिपोर्ट अपलोड करें।',
    notes: 'डॉक्टर की सलाह: ',
    followUp: 'दोबारा दिखाने की तारीख:',
    download: '⬇️ PDF डाउनलोड करें',
    shareWa: '📤 WhatsApp पर भेजें',
  },
};

function PatientPrescriptions({ onNavigateTab }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartRx, setChartRx] = useState(null);
  // Caregiver view: who each prescription is for, a person filter, and the
  // "Family's medicines today" view. Family members are only used for the
  // relationship emoji — if that call fails, everything still works.
  const [familyMembers, setFamilyMembers] = useState([]);
  const [personFilter, setPersonFilter] = useState('all');
  const [familyOpen, setFamilyOpen] = useState(false);
  useEffect(() => {
    familyMemberAPI.getAll().then((r) => setFamilyMembers(r.data.familyMembers || [])).catch(() => {});
  }, []);
  // Button label follows the patient's saved language (the card itself stays as today).
  const hiLang = useLang().lang === 'hi';
  const t = hiLang ? RX_TXT.hi : RX_TXT.en;
  // The socket listener is registered once; read the latest text through a ref.
  const tRef = useRef(t);
  tRef.current = t;

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

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  // Realtime: the moment a doctor writes/updates a prescription, refresh this
  // list instantly instead of the patient needing to reload the page.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return; // not logged in — the page will show current data on next visit either way

    const handlePrescriptionUpdate = () => {
      fetchPrescriptions();
      toast.success(tRef.current.newRxToast);
    };

    socket.on('prescription-updated', handlePrescriptionUpdate);
    return () => socket.off('prescription-updated', handlePrescriptionUpdate);
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
      toast.error(t.pdfFailed);
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
      const shareText = t.shareText(rx.doctor?.name || '', formatDate(rx.createdAt));

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: t.shareTitle, text: shareText });
        return;
      }

      // Fallback: download the PDF, then open WhatsApp with a text message
      await downloadPrescriptionPdf(rx);
      toast(t.pdfDownloadedAttach, { icon: '📎', duration: 5000 });
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    } catch (error) {
      if (error?.name !== 'AbortError') { // user cancelling the native share sheet isn't an error
        console.error('Share prescription error:', error);
        toast.error(t.shareFailed);
      }
    }
  };

  if (loading) return <LoadingBlock />;

  const hasFamily = hasFamilyPrescriptions(prescriptions);
  const people = hasFamily ? peopleOf(prescriptions) : [];
  const visible = personFilter === 'all' ? prescriptions : prescriptions.filter((rx) => personKey(rx) === personFilter);
  const label = (name) => (name === 'self' ? (hiLang ? 'मैं' : 'Me') : name);

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">{t.heading}</h2>

      {/* Family: one tap to today's medicines for everyone, plus a person filter. */}
      {hasFamily && (
        <div className="mb-5">
          <button
            type="button"
            onClick={() => { setFamilyOpen(true); trackEvent('family_meds_open', { people: people.length }); }}
            className="w-full py-3 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            <span className="block text-sm font-bold">👨‍👩‍👧 {hiLang ? 'आज की दवाई — पूरा परिवार' : "Family's medicines today"}</span>
            <span className="block text-xs text-amber-50">{hiLang ? 'सबकी दवाई एक जगह · सुबह, दोपहर, रात' : 'Everyone in one place · morning, afternoon, night'}</span>
          </button>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={hiLang ? 'किसके पर्चे' : 'Show prescriptions for'}>
            {[{ key: 'all', name: hiLang ? 'सभी' : 'All' }, ...people].map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={personFilter === p.key}
                onClick={() => setPersonFilter(p.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${personFilter === p.key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              >
                {p.key === 'all' ? p.name : `${personEmoji(p.key === 'self' ? 'self' : p.name, familyMembers)} ${label(p.key === 'self' ? 'self' : p.name)}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {prescriptions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <div className="text-5xl mb-4">💊</div>
          <h3 className="text-xl font-medium text-gray-700">{t.emptyTitle}</h3>
          <p className="text-gray-500 mt-2">{t.emptyText}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((rx) => (
            <div key={rx._id} className="bg-white rounded-xl shadow-md p-6">
              {personOf(rx) !== 'self' && (
                <span className="inline-block mb-2 px-2.5 py-0.5 rounded-full text-xs font-bold bg-pink-50 text-pink-800 border border-pink-200">
                  {personEmoji(personOf(rx), familyMembers)} {hiLang ? `किसके लिए: ${personOf(rx)}` : `For: ${personOf(rx)}`}
                </span>
              )}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">Dr. {rx.doctor?.name}</h3>
                  <p className="text-sm text-gray-500">{rx.doctor?.specialization} • {formatDate(rx.createdAt)}</p>
                  {rx.doctor?.medicalRegistrationNo && (
                    <p className="text-xs text-gray-400 mt-0.5">{t.regNo} {rx.doctor.medicalRegistrationNo}</p>
                  )}
                </div>
                {rx.appointment && (
                  <span className="text-xs text-gray-400">
                    {t.appt} {formatDate(rx.appointment.date)} {rx.appointment.timeSlot}
                  </span>
                )}
              </div>

              <div className="mb-3">
                <span className="text-sm font-medium text-gray-700">{t.diagnosis}</span>
                <span className="text-sm text-gray-800">{rx.diagnosis}</span>
              </div>

              {rx.medicines && rx.medicines.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">{t.medicines}</p>
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
                  <p className="text-sm font-medium text-yellow-800 mb-1">{t.tests}</p>
                  <div className="space-y-1 ml-3">
                    {rx.testsRecommended.map((test, idx) => (
                      <div key={idx} className="text-sm text-yellow-700">• {test}</div>
                    ))}
                  </div>
                  <p className="text-xs text-yellow-600 mt-2">
                    {t.afterTests}{' '}
                    {onNavigateTab ? (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('reports')}
                        className="underline font-semibold hover:text-yellow-800"
                      >
                        {t.uploadHere}
                      </button>
                    ) : (
                      t.uploadInTab
                    )}
                  </p>
                </div>
              )}

              {rx.notes && (
                <div className="mb-2">
                  <span className="text-sm font-medium text-gray-700">{t.notes}</span>
                  <span className="text-sm text-gray-600 italic">{rx.notes}</span>
                </div>
              )}

              {rx.followUpDate && (
                <p className="text-sm text-primary-600 font-medium mt-2">
                  {t.followUp} {formatDate(rx.followUpDate)}
                </p>
              )}

              {/* Daily medicine chart — when to take what, in Hindi or English. */}
              {rx.medicines && rx.medicines.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setChartRx(rx); trackEvent('rx_chart_open', {}); }}
                  className="mt-4 w-full py-3 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                  <span className="block text-sm font-bold">🗓️ {hiLang ? 'रोज़ की दवाई का चार्ट' : 'Daily medicine chart'}</span>
                  <span className="block text-xs text-primary-100">{hiLang ? 'कौन सी दवा कब लेनी है · हिंदी या English' : 'When to take what · in Hindi or English'}</span>
                </button>
              )}

              {/* Download / Share */}
              <div className="flex gap-2 mt-4 pt-3 border-t">
                <button
                  onClick={() => handleDownload(rx)}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  {t.download}
                </button>
                <button
                  onClick={() => handleShareWhatsApp(rx)}
                  className="px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
                >
                  {t.shareWa}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {chartRx && (
        <Suspense fallback={null}>
          <RxChart rx={chartRx} onClose={() => setChartRx(null)} />
        </Suspense>
      )}
      {familyOpen && (
        <Suspense fallback={null}>
          <FamilyMeds prescriptions={prescriptions} familyMembers={familyMembers} onClose={() => setFamilyOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

export default PatientPrescriptions;
