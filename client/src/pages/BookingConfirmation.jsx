// ============================================
// Booking page — live: "request sent" → doctor confirms → PAY HERE → done
// ============================================
// Opened right after booking (/booking-confirmation?id=<appointment id>),
// from the "doctor confirmed — pay" notification, or from the email. It loads
// the real booking and keeps it up to date (socket push + a light poll), so
// the moment the doctor confirms, the payment box appears on THIS page —
// the patient never has to hunt for "where do I pay?".
// Old links without ?id still work from the navigation state.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { enablePushNotifications, getPushPermission, isPushSupported } from '../services/push';
import { appointmentAPI } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import PaymentBox from '../components/PaymentBox';
import { bookingStage, BOOKING_STEP } from '../utils/paymentFlow';
import { formatDoctorName } from '../utils/formatName';
import { useLang } from '../context/LangContext';

// Patient-facing → bilingual via shared promedicoz_lang.
const TXT = {
  en: {
    noBooking: 'No booking details found', goDashboard: 'Open my appointments',
    hero: {
      confirming: (dr) => ({ icon: '📨', title: `Request sent to ${dr}`, sub: 'Doctors usually confirm within a few hours. You can close this page — we\'ll tell you.' }),
      pay: (dr, fee) => ({ icon: '✅', title: `${dr} confirmed!`, sub: fee ? `Pay Rs. ${fee} now to lock your slot.` : 'Your slot is confirmed.' }),
      checking: (dr) => ({ icon: '🧾', title: 'Payment sent — thank you', sub: `${dr} will check it and mark it paid. Nothing else to do.` }),
      ready: () => ({ icon: '🎉', title: 'You\'re all set', sub: 'Your appointment is confirmed and paid.' }),
      done: () => ({ icon: '✅', title: 'Consultation completed', sub: 'Your prescription and notes are in your appointments.' }),
      cancelled: (dr) => ({ icon: '😔', title: 'This booking was cancelled', sub: `${dr} couldn't take this slot. Please pick another time — it only takes a minute.` }),
    },
    summary: 'Booking Summary',
    date: 'Date', timeSlot: 'Time', type: 'Consultation', reason: 'Reason', fee: 'Fee',
    feeLater: 'pay after the doctor confirms',
    live: 'Live — this page updates by itself',
    nextTitle: 'What happens next?',
    steps: (fee, type, waiting) => [
      'Doctor confirms your appointment',
      fee ? `Pay Rs. ${fee} right here (UPI)${waiting ? ' — the button appears once confirmed' : ''}` : 'No payment needed',
      'Send the payment screenshot (or "I\'ve paid" + UTR)',
      type === 'in-person' ? 'Visit the clinic at your time' : `Join the ${type} call at your time`,
    ],
    now: 'now',
    payTitle: 'Pay now',
    bookAgain: 'Book another slot',
    browseMore: 'Browse More Doctors',
    dateLocale: 'en-IN',
    notifyTitle: 'Tell me when the doctor confirms',
    notifyText: 'Turn on notifications — you\'ll get an alert that opens this page straight at "Pay", plus a reminder before your appointment.',
    notifyEnable: 'Turn on alerts', notifyLater: 'Maybe later', notifyEnabling: 'Turning on…',
    notifyDone: '✓ Alerts on — we\'ll tell you when the doctor confirms.',
    notifyFailed: 'Could not turn on alerts. You can turn them on later from your dashboard.',
    types: { 'in-person': 'Clinic visit', video: 'Video', phone: 'Phone' },
  },
  hi: {
    noBooking: 'कोई बुकिंग विवरण नहीं मिला', goDashboard: 'मेरे अपॉइंटमेंट खोलें',
    hero: {
      confirming: (dr) => ({ icon: '📨', title: `${dr} को अनुरोध भेजा गया`, sub: 'डॉक्टर आमतौर पर कुछ घंटों में पुष्टि करते हैं। आप यह पेज बंद कर सकते हैं — हम आपको बताएंगे।' }),
      pay: (dr, fee) => ({ icon: '✅', title: `${dr} ने पुष्टि कर दी!`, sub: fee ? `अपना स्लॉट पक्का करने के लिए अभी Rs. ${fee} का भुगतान करें।` : 'आपका स्लॉट पक्का है।' }),
      checking: (dr) => ({ icon: '🧾', title: 'भुगतान भेज दिया — धन्यवाद', sub: `${dr} इसे जांचकर पेड मार्क करेंगे। आपको और कुछ नहीं करना है।` }),
      ready: () => ({ icon: '🎉', title: 'सब तैयार है', sub: 'आपका अपॉइंटमेंट पक्का और भुगतान हो चुका है।' }),
      done: () => ({ icon: '✅', title: 'परामर्श पूरा हुआ', sub: 'आपका पर्चा और नोट्स आपके अपॉइंटमेंट में हैं।' }),
      cancelled: (dr) => ({ icon: '😔', title: 'यह बुकिंग रद्द हो गई', sub: `${dr} यह स्लॉट नहीं ले सके। कृपया दूसरा समय चुनें — बस एक मिनट लगेगा।` }),
    },
    summary: 'बुकिंग सारांश',
    date: 'तारीख', timeSlot: 'समय', type: 'परामर्श', reason: 'कारण', fee: 'शुल्क',
    feeLater: 'डॉक्टर की पुष्टि के बाद भुगतान',
    live: 'लाइव — यह पेज अपने आप अपडेट होता है',
    nextTitle: 'आगे क्या होगा?',
    steps: (fee, type, waiting) => [
      'डॉक्टर आपकी अपॉइंटमेंट की पुष्टि करेंगे',
      fee ? `यहीं Rs. ${fee} का भुगतान करें (UPI)${waiting ? ' — पुष्टि होते ही बटन दिखेगा' : ''}` : 'कोई भुगतान नहीं',
      'भुगतान का स्क्रीनशॉट भेजें (या "मैंने भुगतान किया" + UTR)',
      type === 'in-person' ? 'अपने समय पर क्लिनिक जाएं' : 'अपने समय पर कॉल से जुड़ें',
    ],
    now: 'अभी',
    payTitle: 'अभी भुगतान करें',
    bookAgain: 'दूसरा स्लॉट बुक करें',
    browseMore: 'और डॉक्टर देखें',
    dateLocale: 'hi-IN',
    notifyTitle: 'डॉक्टर की पुष्टि होते ही बताएं',
    notifyText: 'नोटिफिकेशन चालू करें — अलर्ट सीधे यही पेज "भुगतान" पर खोलेगा, और अपॉइंटमेंट से पहले याद भी दिलाएगा।',
    notifyEnable: 'अलर्ट चालू करें', notifyLater: 'बाद में', notifyEnabling: 'चालू हो रहा है…',
    notifyDone: '✓ अलर्ट चालू — डॉक्टर की पुष्टि होते ही हम बताएंगे।',
    notifyFailed: 'अलर्ट चालू नहीं हो सका। आप इसे बाद में डैशबोर्ड से चालू कर सकते हैं।',
    types: { 'in-person': 'क्लिनिक', video: 'वीडियो', phone: 'फ़ोन' },
  },
};

const HERO_STYLE = {
  confirming: 'from-primary-600 to-primary-700',
  pay: 'from-green-600 to-emerald-700',
  checking: 'from-green-600 to-emerald-700',
  ready: 'from-green-600 to-emerald-700',
  done: 'from-green-600 to-emerald-700',
  cancelled: 'from-gray-600 to-gray-700',
};

function BookingConfirmation() {
  const location = useLocation();
  const [params] = useSearchParams();
  const id = params.get('id');
  const fromBooking = location.state; // instant details right after booking
  const { user } = useAuth();
  const { lang, setLang } = useLang(); // app-wide (top-bar switch)
  const t = TXT[lang];
  const [apt, setApt] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const payRef = useRef(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await appointmentAPI.getById(id);
      setApt(data.appointment);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [id]);

  // Load once, then stay live: socket push from the server when anything on
  // this booking changes, a light 20 s poll as a fallback (only while the
  // tab is visible and something can still change), and a refresh when the
  // patient comes back to the tab/app.
  const stage = bookingStage(apt);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!id) return undefined;
    const socket = getSocket();
    const onUpdate = () => load();
    if (socket) socket.on('appointment-updated', onUpdate);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      if (socket) socket.off('appointment-updated', onUpdate);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [id, load]);
  useEffect(() => {
    if (!id || !(stage === null || stage === 'confirming' || stage === 'checking')) return undefined;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 20000);
    return () => clearInterval(timer);
  }, [id, stage, load]);

  // When it flips to "pay" while the patient is looking, bring the payment
  // box into view.
  const prevStage = useRef(stage);
  useEffect(() => {
    if (prevStage.current && prevStage.current !== 'pay' && stage === 'pay' && payRef.current) {
      payRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    prevStage.current = stage;
  }, [stage]);

  const [notifyState, setNotifyState] = useState(() =>
    isPushSupported() && getPushPermission() === 'default' ? 'prompt' : 'hidden'
  );
  const handleEnableNotify = async () => {
    setNotifyState('enabling');
    const ok = await enablePushNotifications();
    setNotifyState(ok ? 'done' : 'failed');
  };

  // What to show: the live booking, else the details passed from booking.
  const view = apt ? {
    doctorName: apt.doctor?.name, specialization: apt.doctor?.specialization, date: apt.date,
    timeSlot: apt.timeSlot, consultationType: apt.consultationType, reason: apt.reason,
    fee: apt.doctor?.consultationFee, doctorId: apt.doctor?._id,
  } : fromBooking;

  if (!view) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        {id && !loadFailed ? (
          <p className="text-gray-500" role="status">…</p>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-gray-800">{t.noBooking}</h2>
            <Link to="/dashboard" className="text-primary-600 hover:underline mt-4 inline-block">{t.goDashboard}</Link>
          </>
        )}
      </div>
    );
  }

  const dr = formatDoctorName(view.doctorName);
  const s = stage || 'confirming';
  const hero = t.hero[s](dr, view.fee);
  const step = BOOKING_STEP[s] ?? 0;
  const live = Boolean(id && apt && (s === 'confirming' || s === 'checking'));

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <div className="max-w-lg mx-auto">
        {/* Status hero — changes live: sent → confirmed (pay) → paid. */}
        <div className={`text-center mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-br ${HERO_STYLE[s]} text-white p-6 sm:p-8 shadow-md`} role="status" aria-live="polite">
          <div className="text-4xl mb-2" aria-hidden="true">{hero.icon}</div>
          <h1 className="text-xl sm:text-2xl font-bold">{hero.title}</h1>
          <p className="text-white/90 mt-2 text-sm sm:text-base">{hero.sub}</p>
        </div>

        {/* PAY HERE — the payment box appears as soon as the doctor confirms. */}
        {apt && (s === 'pay' || s === 'checking') && (
          <div ref={payRef} className={`mb-6 rounded-2xl p-4 ${s === 'pay' ? 'bg-white border-2 border-orange-300 shadow-md' : 'bg-white border border-gray-200'}`}>
            {s === 'pay' && <h2 className="font-bold text-gray-800 mb-1">💳 {t.payTitle}</h2>}
            <PaymentBox apt={apt} user={user} onChanged={load} onViewReceipt={(url) => window.open(url, '_blank', 'noopener,noreferrer')} />
          </div>
        )}

        {s === 'cancelled' && (
          <div className="flex gap-3 mb-6">
            {view.doctorId && <Link to={`/book-appointment/${view.doctorId}`} className="btn btn-primary flex-1">{t.bookAgain}</Link>}
            <Link to="/doctors" className="btn btn-outline flex-1">{t.browseMore}</Link>
          </div>
        )}

        {/* Booking ticket */}
        <div className="bg-white rounded-2xl shadow-md mb-6 overflow-hidden">
          <div className="flex items-center gap-3 p-5 border-b border-dashed border-gray-200">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-xl flex-shrink-0" aria-hidden="true">🧑‍⚕️</div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-800 truncate">{dr}</p>
              {view.specialization && <p className="text-primary-700 text-sm truncate">{String(view.specialization).trim()}</p>}
            </div>
            {view.fee > 0 && (
              <div className="flex-shrink-0 text-center bg-green-50 border border-green-100 rounded-xl px-3 py-1.5">
                <div className="text-sm font-extrabold text-green-800 leading-none">Rs. {view.fee}</div>
                <div className="text-[10px] text-green-700 mt-0.5">{t.fee}</div>
              </div>
            )}
          </div>
          <div className="p-5 space-y-3 text-sm">
            <Row icon="📅" label={t.date} value={new Date(view.date).toLocaleDateString(t.dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
            <Row icon="🕐" label={t.timeSlot} value={view.timeSlot} />
            <Row icon="💬" label={t.type} value={t.types[view.consultationType] || view.consultationType} />
            {view.reason && <Row icon="📝" label={t.reason} value={view.reason} />}
            {s === 'confirming' && view.fee > 0 && <p className="text-xs text-gray-600">💳 Rs. {view.fee} · {t.feeLater}</p>}
            {live && <p className="text-xs text-green-700 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />{t.live}</p>}
          </div>
        </div>

        {/* Steps — the current one is highlighted and moves forward live. */}
        {s !== 'cancelled' && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4">{t.nextTitle}</h3>
            <ol className="relative space-y-4">
              <span className="absolute left-[11px] top-1 bottom-1 w-0.5 bg-blue-100" aria-hidden="true" />
              {t.steps(view.fee > 0 ? view.fee : 0, view.consultationType, s === 'confirming').map((label, i) => {
                const doneStep = i < step || s === 'done';
                const current = i === step && s !== 'done';
                return (
                  <li key={i} className="relative flex items-start gap-3" aria-current={current ? 'step' : undefined}>
                    <span className={`relative z-10 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${doneStep ? 'bg-green-600 text-white' : current ? 'bg-primary-600 text-white' : 'bg-blue-100 text-blue-700'}`}>
                      {doneStep ? '✓' : i + 1}
                    </span>
                    <span className={`text-sm leading-snug pt-0.5 ${current ? 'text-gray-900 font-semibold' : doneStep ? 'text-gray-500' : 'text-gray-600'}`}>
                      {label}{current && <span className="ml-1.5 text-primary-700">👈 {t.now}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Alerts opt-in — most useful while waiting for the doctor. */}
        {notifyState !== 'hidden' && s === 'confirming' && (
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-5 mb-6">
            {notifyState === 'done' ? (
              <p className="text-sm font-medium text-green-700">{t.notifyDone}</p>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0" aria-hidden="true">🔔</span>
                  <div>
                    <h3 className="font-semibold text-gray-800">{t.notifyTitle}</h3>
                    <p className="text-sm text-gray-600 mt-1">{t.notifyText}</p>
                  </div>
                </div>
                {notifyState === 'failed' && <p className="text-sm text-amber-700 mt-3">{t.notifyFailed}</p>}
                {notifyState !== 'failed' && (
                  <div className="flex gap-3 mt-4">
                    <button onClick={handleEnableNotify} disabled={notifyState === 'enabling'} className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
                      {notifyState === 'enabling' ? t.notifyEnabling : t.notifyEnable}
                    </button>
                    <button onClick={() => setNotifyState('hidden')} className="px-5 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100">
                      {t.notifyLater}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {s !== 'cancelled' && (
          <div className="flex gap-3">
            <Link to={id ? `/dashboard?apt=${id}` : '/dashboard'} className="btn btn-primary flex-1">{t.goDashboard}</Link>
            <Link to="/doctors" className="btn btn-outline flex-1">{t.browseMore}</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon, label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-600 flex items-center gap-2 flex-shrink-0"><span aria-hidden="true">{icon}</span>{label}</span>
      <span className="font-semibold text-gray-800 text-right">{value}</span>
    </div>
  );
}

export default BookingConfirmation;
