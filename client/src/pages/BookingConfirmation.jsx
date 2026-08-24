// ============================================
// Booking Confirmation Page - Shown after successful booking
// ============================================

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { enablePushNotifications, getPushPermission, isPushSupported } from '../services/push';

// Patient-facing → bilingual via shared promedicoz_lang. Only fixed labels
// translate; booking values (doctor name, specialization, reason) stay as-is.
const TXT = {
  en: {
    noBooking: 'No booking details found', goDashboard: 'Go to Dashboard',
    booked: 'Appointment Booked!', bookedSub: 'Your booking is confirmed. Waiting for doctor to accept.',
    summary: 'Booking Summary',
    doctor: 'Doctor', specialization: 'Specialization', date: 'Date',
    timeSlot: 'Time Slot', type: 'Consultation Type', reason: 'Reason', fee: 'Consultation Fee',
    nextTitle: 'What happens next?',
    next: (type) => [
      "Doctor will confirm your appointment (you'll see it in Dashboard)",
      "Once confirmed, you'll see payment details",
      'Complete the payment via UPI',
      `On the appointment day, connect via the method you chose (${type})`,
    ],
    browseMore: 'Browse More Doctors',
    dateLocale: 'en-IN',
    notifyTitle: 'Get a reminder before your appointment',
    notifyText: "Turn on notifications and we'll alert you when the doctor confirms, and remind you about an hour before your appointment — so you never miss it.",
    notifyEnable: 'Enable notifications',
    notifyLater: 'Maybe later',
    notifyEnabling: 'Enabling…',
    notifyDone: '✓ Notifications on — you\'ll get reminders for this appointment.',
    notifyFailed: 'Could not enable notifications. You can turn them on later from your dashboard.',
  },
  hi: {
    noBooking: 'कोई बुकिंग विवरण नहीं मिला', goDashboard: 'डैशबोर्ड पर जाएं',
    booked: 'अपॉइंटमेंट बुक हो गया!', bookedSub: 'आपकी बुकिंग पक्की है। डॉक्टर के स्वीकार करने की प्रतीक्षा है।',
    summary: 'बुकिंग सारांश',
    doctor: 'डॉक्टर', specialization: 'विशेषज्ञता', date: 'तारीख',
    timeSlot: 'समय', type: 'परामर्श का प्रकार', reason: 'कारण', fee: 'परामर्श शुल्क',
    nextTitle: 'आगे क्या होगा?',
    next: (type) => [
      'डॉक्टर आपकी अपॉइंटमेंट की पुष्टि करेंगे (यह आपके डैशबोर्ड में दिखेगी)',
      'पुष्टि होने पर, आपको भुगतान विवरण दिखेगा',
      'UPI के ज़रिए भुगतान पूरा करें',
      `अपॉइंटमेंट के दिन, अपने चुने हुए तरीके (${type}) से जुड़ें`,
    ],
    browseMore: 'और डॉक्टर देखें',
    dateLocale: 'hi-IN',
    notifyTitle: 'अपॉइंटमेंट से पहले याद दिलाएं',
    notifyText: 'नोटिफिकेशन चालू करें — डॉक्टर के पुष्टि करने पर और अपॉइंटमेंट से लगभग एक घंटा पहले हम आपको सूचित करेंगे, ताकि आप कभी न चूकें।',
    notifyEnable: 'नोटिफिकेशन चालू करें',
    notifyLater: 'बाद में',
    notifyEnabling: 'चालू हो रहा है…',
    notifyDone: '✓ नोटिफिकेशन चालू — आपको इस अपॉइंटमेंट के लिए रिमाइंडर मिलेंगे।',
    notifyFailed: 'नोटिफिकेशन चालू नहीं हो सका। आप इसे बाद में अपने डैशबोर्ड से चालू कर सकते हैं।',
  },
};

function BookingConfirmation() {
  const location = useLocation();
  const booking = location.state;
  const [lang] = useState(() => localStorage.getItem('promedicoz_lang') || 'en');
  const t = TXT[lang];
  // Booking data passed from BookAppointment page via navigate state

  // Contextual notification opt-in. Only worth showing when the browser can do
  // push AND the user hasn't already decided — permission 'default' means
  // never asked. If it's 'granted' they're already set; 'denied' means the
  // browser has permanently blocked us and asking again does nothing, so we
  // don't show a dead button. This is the highest-converting moment to ask,
  // because the benefit (a reminder for THIS appointment) is concrete and now.
  const [notifyState, setNotifyState] = useState(() =>
    isPushSupported() && getPushPermission() === 'default' ? 'prompt' : 'hidden'
  );

  const handleEnableNotify = async () => {
    setNotifyState('enabling');
    const ok = await enablePushNotifications();
    setNotifyState(ok ? 'done' : 'failed');
  };

  if (!booking) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-800">{t.noBooking}</h2>
        <Link to="/dashboard" className="text-primary-600 hover:underline mt-4 inline-block">
          {t.goDashboard}
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-lg mx-auto">
        {/* Success icon */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">{t.booked}</h1>
          <p className="text-gray-600 mt-2">{t.bookedSub}</p>
        </div>

        {/* Booking details card */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4 text-lg">{t.summary}</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">{t.doctor}</span>
              <span className="font-medium text-gray-800">{booking.doctorName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">{t.specialization}</span>
              <span className="font-medium text-gray-800">{booking.specialization || '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">{t.date}</span>
              <span className="font-medium text-gray-800">
                {new Date(booking.date).toLocaleDateString(t.dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">{t.timeSlot}</span>
              <span className="font-medium text-gray-800">{booking.timeSlot}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">{t.type}</span>
              <span className="font-medium text-gray-800 capitalize">{booking.consultationType}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">{t.reason}</span>
              <span className="font-medium text-gray-800">{booking.reason}</span>
            </div>
            {booking.fee && (
              <div className="flex justify-between py-2">
                <span className="text-gray-500">{t.fee}</span>
                <span className="font-semibold text-primary-600">₹{booking.fee}</span>
              </div>
            )}
          </div>
        </div>

        {/* What's next */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <h3 className="font-medium text-blue-800 mb-2">{t.nextTitle}</h3>
          <ol className="text-sm text-blue-700 space-y-2 list-decimal ml-4">
            {t.next(booking.consultationType).map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        </div>

        {/* Contextual notification opt-in — benefit-driven, dismissible, and
            only shown when the browser can push and hasn't already decided. */}
        {notifyState !== 'hidden' && (
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-5 mb-6">
            {notifyState === 'done' ? (
              <p className="text-sm font-medium text-green-700">{t.notifyDone}</p>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">🔔</span>
                  <div>
                    <h3 className="font-semibold text-gray-800">{t.notifyTitle}</h3>
                    <p className="text-sm text-gray-600 mt-1">{t.notifyText}</p>
                  </div>
                </div>
                {notifyState === 'failed' && (
                  <p className="text-sm text-amber-600 mt-3">{t.notifyFailed}</p>
                )}
                {notifyState !== 'failed' && (
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={handleEnableNotify}
                      disabled={notifyState === 'enabling'}
                      className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
                    >
                      {notifyState === 'enabling' ? t.notifyEnabling : t.notifyEnable}
                    </button>
                    <button
                      onClick={() => setNotifyState('hidden')}
                      className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
                    >
                      {t.notifyLater}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-4">
          <Link
            to="/dashboard"
            className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-semibold text-center hover:bg-primary-700 transition-colors"
          >
            {t.goDashboard}
          </Link>
          <Link
            to="/doctors"
            className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold text-center hover:bg-gray-50 transition-colors"
          >
            {t.browseMore}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default BookingConfirmation;
