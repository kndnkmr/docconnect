import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

// Patient-facing page → bilingual (English / हिंदी), same lightweight approach
// as Home.jsx and BookAppointment.jsx: a per-page string dictionary keyed by
// language, with the shared localStorage 'promedicoz_lang' choice so the
// patient's selection carries across the site. Only fixed UI labels are
// translated — no medical content is machine-translated. Hindi copy should be
// proofread by a native speaker before being treated as final.
const TXT = {
  en: {
    heroTitle: 'How ProMedicoz works',
    heroSubtitle: 'Find the right doctor and consult by video, phone, or in person — in a few simple steps. Signing up and browsing is free.',
    findDoctor: 'Find a Doctor',
    createAccount: 'Create Account',

    stepsHeading: 'Booking in 4 steps',
    steps: [
      { t: 'Find a doctor.', d: "Search by symptom, specialization, city, or the language you're comfortable in. Each profile shows the doctor's qualification, experience, fee, and patient reviews." },
      { t: 'Book a slot.', d: "Pick a date, an available time, and how you'd like to consult — video, phone, or in person." },
      { t: 'Doctor confirms.', d: 'The doctor confirms your request, usually within a few hours. You are notified in the app (and by push/email if you enable it).' },
      { t: 'Pay & consult.', d: "After confirmation, pay the doctor's fee and join your consultation at the booked time." },
    ],

    payHeading: '💳 How payment works',
    pay: [
      'Signing up and browsing doctors is free.',
      'You pay only after the doctor confirms your appointment.',
      'You pay the doctor directly via UPI — scan their QR code or use their UPI ID, then tap "I Have Paid" (you can also upload a payment receipt).',
      'The doctor confirms they received it, and you are set for the consultation. ProMedicoz never collects or holds your money and takes no commission.',
    ],

    joinHeading: 'Joining your consultation',
    join: [
      'Video or phone: at your appointment time, a secure call opens right inside ProMedicoz — no separate app or extra login. You will get a ringing alert when it is time, and the "Join" button appears on the day of your appointment.',
      "In person: visit the doctor's clinic at your booked time (the profile shows the address and a \"Get Directions\" link).",
      'After the consultation, your prescription appears in your account automatically, and you can upload test reports for the doctor to review.',
    ],

    knowHeading: 'Good to know',
    know: [
      'You can register with just your phone number — email is optional.',
      'You can book for family members from your account.',
      'You can cancel from your dashboard before the appointment; there are no cancellation charges from ProMedicoz.',
      "In a medical emergency, don't use the platform — call 112 or 108, or go to your nearest hospital.",
    ],

    ctaHeading: 'Ready to consult a doctor?',
  },
  hi: {
    heroTitle: 'ProMedicoz कैसे काम करता है',
    heroSubtitle: 'सही डॉक्टर खोजें और वीडियो, फ़ोन या क्लिनिक पर परामर्श करें — कुछ आसान चरणों में। साइन अप करना और डॉक्टर देखना मुफ़्त है।',
    findDoctor: 'डॉक्टर खोजें',
    createAccount: 'खाता बनाएं',

    stepsHeading: '4 आसान चरणों में बुकिंग',
    steps: [
      { t: 'डॉक्टर खोजें।', d: 'लक्षण, विशेषज्ञता, शहर, या जिस भाषा में आप सहज हैं उसके अनुसार खोजें। हर प्रोफ़ाइल में डॉक्टर की योग्यता, अनुभव, शुल्क और मरीज़ों की समीक्षाएं दिखती हैं।' },
      { t: 'स्लॉट बुक करें।', d: 'तारीख, उपलब्ध समय, और परामर्श का तरीका चुनें — वीडियो, फ़ोन या क्लिनिक पर।' },
      { t: 'डॉक्टर पुष्टि करते हैं।', d: 'डॉक्टर आमतौर पर कुछ ही घंटों में आपकी बुकिंग की पुष्टि कर देते हैं। आपको ऐप में सूचना मिलती है (और पुश/ईमेल से, अगर आपने चालू किया हो)।' },
      { t: 'भुगतान करें और परामर्श लें।', d: 'पुष्टि के बाद, डॉक्टर का शुल्क चुकाएं और बुक किए गए समय पर परामर्श में शामिल हों।' },
    ],

    payHeading: '💳 भुगतान कैसे होता है',
    pay: [
      'साइन अप करना और डॉक्टर ब्राउज़ करना मुफ़्त है।',
      'आप केवल तभी भुगतान करते हैं जब डॉक्टर आपकी अपॉइंटमेंट की पुष्टि कर देता है।',
      'आप सीधे डॉक्टर को UPI से भुगतान करते हैं — उनका QR कोड स्कैन करें या उनकी UPI ID इस्तेमाल करें, फिर "मैंने भुगतान कर दिया" पर टैप करें (आप रसीद भी अपलोड कर सकते हैं)।',
      'डॉक्टर पुष्टि करते हैं कि उन्हें भुगतान मिल गया, और आप परामर्श के लिए तैयार हैं। ProMedicoz कभी आपका पैसा नहीं लेता या रखता, और कोई कमीशन नहीं लेता।',
    ],

    joinHeading: 'अपने परामर्श में शामिल होना',
    join: [
      'वीडियो या फ़ोन: आपके अपॉइंटमेंट के समय, एक सुरक्षित कॉल सीधे ProMedicoz के अंदर खुलती है — किसी अलग ऐप या लॉगिन की ज़रूरत नहीं। समय होने पर आपको घंटी की सूचना मिलेगी, और "शामिल हों" बटन आपके अपॉइंटमेंट वाले दिन दिखता है।',
      'क्लिनिक पर: अपने बुक किए गए समय पर डॉक्टर के क्लिनिक जाएं (प्रोफ़ाइल में पता और "रास्ता देखें" लिंक दिखता है)।',
      'परामर्श के बाद, आपका प्रिस्क्रिप्शन अपने आप आपके खाते में आ जाता है, और आप डॉक्टर को दिखाने के लिए जांच रिपोर्ट अपलोड कर सकते हैं।',
    ],

    knowHeading: 'जानने योग्य बातें',
    know: [
      'आप केवल अपने फ़ोन नंबर से रजिस्टर कर सकते हैं — ईमेल वैकल्पिक है।',
      'आप अपने खाते से परिवार के सदस्यों के लिए बुकिंग कर सकते हैं।',
      'आप अपॉइंटमेंट से पहले अपने डैशबोर्ड से रद्द कर सकते हैं; ProMedicoz की ओर से कोई रद्दीकरण शुल्क नहीं है।',
      'मेडिकल इमरजेंसी में इस प्लेटफ़ॉर्म का उपयोग न करें — 112 या 108 पर कॉल करें, या अपने नज़दीकी अस्पताल जाएं।',
    ],

    ctaHeading: 'डॉक्टर से परामर्श के लिए तैयार हैं?',
  },
};

function HowItWorks() {
  const [lang, setLang] = useState(() => localStorage.getItem('promedicoz_lang') || 'en');
  const t = TXT[lang];
  const changeLang = (l) => { setLang(l); localStorage.setItem('promedicoz_lang', l); };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <SEO title="How It Works — For Patients" description="How ProMedicoz works for patients: find a verified doctor, book a slot, pay the doctor directly via UPI after confirmation, and consult by video, phone, or in person." path="/how-it-works" />

      {/* Language toggle (patient-facing page) */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center bg-gray-100 rounded-full p-1 text-sm">
          <button
            onClick={() => changeLang('en')}
            className={`px-4 py-1.5 rounded-full font-medium transition-colors ${lang === 'en' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            English
          </button>
          <button
            onClick={() => changeLang('hi')}
            className={`px-4 py-1.5 rounded-full font-medium transition-colors ${lang === 'hi' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            हिंदी
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-800">{t.heroTitle}</h1>
        <p className="text-gray-600 mt-3 max-w-2xl mx-auto">{t.heroSubtitle}</p>
        <div className="flex flex-wrap justify-center gap-3 mt-5">
          <Link to="/doctors" className="bg-primary-600 text-white py-2.5 px-8 rounded-lg hover:bg-primary-700 transition-colors font-medium">{t.findDoctor}</Link>
          <Link to="/register" className="bg-white text-primary-700 border border-primary-200 py-2.5 px-8 rounded-lg hover:bg-primary-100 transition-colors font-medium">{t.createAccount}</Link>
        </div>
      </div>

      <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
        {/* Steps */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">{t.stepsHeading}</h2>
          <ol className="list-decimal ml-6 space-y-2">
            {t.steps.map((s, i) => (
              <li key={i}><strong>{s.t}</strong> {s.d}</li>
            ))}
          </ol>
        </section>

        {/* Payment */}
        <section className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">{t.payHeading}</h2>
          <ul className="space-y-2">
            {t.pay.map((p, i) => (
              <li key={i} className="flex gap-2"><span>•</span><span>{p}</span></li>
            ))}
          </ul>
        </section>

        {/* Joining */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">{t.joinHeading}</h2>
          <ul className="list-disc ml-6 space-y-2">
            {t.join.map((j, i) => (
              <li key={i}>{j}</li>
            ))}
          </ul>
        </section>

        {/* Good to know */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">{t.knowHeading}</h2>
          <ul className="list-disc ml-6 space-y-2">
            {t.know.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="bg-primary-50 rounded-xl p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">{t.ctaHeading}</h2>
          <div className="flex flex-wrap justify-center gap-3 mt-3">
            <Link to="/doctors" className="bg-primary-600 text-white py-2.5 px-8 rounded-lg hover:bg-primary-700 transition-colors font-medium">{t.findDoctor}</Link>
            <Link to="/register" className="bg-white text-primary-700 border border-primary-200 py-2.5 px-8 rounded-lg hover:bg-primary-100 transition-colors font-medium">{t.createAccount}</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default HowItWorks;
