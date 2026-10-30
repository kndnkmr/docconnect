import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { useLang } from '../context/LangContext';

// Patient-facing page → bilingual (English / हिंदी), same lightweight approach
// as HowItWorks.jsx and Home.jsx: a per-page string dictionary keyed by
// language, with the shared localStorage 'promedicoz_lang' choice so the
// patient's selection carries across the site.
//
// IMPORTANT: the copy here states ONLY facts that were already on this page —
// the no-commission / pay-the-doctor-directly model, verified doctors, the
// three consult modes, language search, family accounts, and the
// platform-not-a-clinic positioning. No invented numbers, founder story, or
// claims. The wording is sharpened and warmed; the substance is unchanged.
const TXT = {
  en: {
    heroH1: "Quality healthcare, within everyone's reach",
    heroSub:
      'ProMedicoz connects patients across India with verified doctors — by video, phone, or in person. Finding the right care should be as simple as booking in a couple of minutes.',
    pillVerified: 'Verified doctors',
    pillNoCommission: 'No commission',
    pillModes: 'Video · Phone · In-person',

    whyH: 'Why we exist',
    whyP1:
      'For too many people in India, seeing the right doctor still means long queues, long journeys, and long waits — sometimes only to learn you needed a different specialist all along.',
    whyP2:
      'It is harder still outside the big cities. The specialist you need may be hours away, and it is not always clear who to trust. ProMedicoz was built to close that gap: bring verified doctors online, show their experience and fees up front, and let anyone, anywhere, book a consultation from home — or in person when that is what is needed.',

    doH: 'What we do',
    doItems: [
      { icon: '✅', t: 'Connect you with verified doctors.', d: "Every doctor's qualification, registration, experience, and fee is shown up front — so you choose with confidence, not guesswork." },
      { icon: '💬', t: 'Let you consult your way.', d: 'Video, phone, or in person — you pick the mode that suits you when you book.' },
      { icon: '🗣️', t: 'Help you find care in your language.', d: 'Search doctors by the languages they speak, so you can explain your problem comfortably.' },
      { icon: '📄', t: 'Keep everything in one place.', d: 'Appointments, prescriptions, and reports stay together in your account, ready for your next visit.' },
      { icon: '👨‍👩‍👧', t: 'Work for your whole family.', d: 'Add family members and book on their behalf.' },
    ],

    freeH: 'Free to use. No commission. Ever.',
    freeP:
      'ProMedicoz does not charge patients or doctors, and we take no commission. When you consult a doctor, the fee goes directly to that doctor (for example, by UPI) — ProMedicoz never collects or holds your money. Our only job is to connect the right patient with the right doctor.',

    platH: 'A platform, not a clinic',
    platP:
      'ProMedicoz is a platform that connects you with doctors — we do not practise medicine ourselves. The doctors here are independent, registered practitioners, responsible for the advice they give. That lets patients choose freely and doctors practise independently, while we focus on making the connection safe, simple, and trustworthy.',
    platLinks: 'Read more in our',

    trustH: 'Our commitment to you',
    trustP:
      'Health is personal, and trust has to be earned. We keep your health information confidential, never use it for advertising, and show only real, honest information about the doctors on our platform. We are building ProMedicoz steadily and carefully — because when it comes to your health, doing it right matters more than doing it fast.',

    ctaH: 'Get started',
    ctaP: 'Find a doctor in minutes, or join us as a practitioner.',
    findDoctor: 'Find a Doctor',
    joinDoctor: 'Join as a Doctor',
    questions: 'Questions? Reach us at',

    disclaimer: 'Medical Disclaimer', terms: 'Terms', privacy: 'Privacy Policy',
  },
  hi: {
    heroH1: 'अच्छी सेहत-सुविधा, सबकी पहुंच में',
    heroSub:
      'ProMedicoz भारत भर के मरीज़ों को सत्यापित डॉक्टरों से जोड़ता है — वीडियो, फ़ोन या क्लिनिक पर। सही इलाज पाना उतना ही आसान होना चाहिए जितना कुछ मिनटों में बुकिंग करना।',
    pillVerified: 'सत्यापित डॉक्टर',
    pillNoCommission: 'कोई कमीशन नहीं',
    pillModes: 'वीडियो · फ़ोन · क्लिनिक',

    whyH: 'हम क्यों हैं',
    whyP1:
      'भारत में बहुत से लोगों के लिए सही डॉक्टर तक पहुंचना आज भी लंबी कतारों, लंबे सफ़र और लंबे इंतज़ार का मतलब है — और कभी-कभी तो यह पता चलने के लिए कि आपको किसी और विशेषज्ञ की ज़रूरत थी।',
    whyP2:
      'बड़े शहरों से बाहर यह और भी मुश्किल है। जिस विशेषज्ञ की ज़रूरत है वह घंटों दूर हो सकता है, और यह साफ़ नहीं होता कि किस पर भरोसा करें। ProMedicoz इसी दूरी को पाटने के लिए बना है: सत्यापित डॉक्टरों को ऑनलाइन लाना, उनका अनुभव और शुल्क पहले से दिखाना, और किसी को भी, कहीं से भी, घर बैठे परामर्श बुक करने देना — या ज़रूरत पड़ने पर क्लिनिक पर मिलना।',

    doH: 'हम क्या करते हैं',
    doItems: [
      { icon: '✅', t: 'सत्यापित डॉक्टरों से जोड़ते हैं।', d: 'हर डॉक्टर की योग्यता, रजिस्ट्रेशन, अनुभव और शुल्क पहले से दिखता है — ताकि आप अंदाज़े से नहीं, भरोसे से चुनें।' },
      { icon: '💬', t: 'अपने तरीके से परामर्श।', d: 'वीडियो, फ़ोन या क्लिनिक पर — बुकिंग के समय अपना पसंदीदा तरीका चुनें।' },
      { icon: '🗣️', t: 'अपनी भाषा में इलाज।', d: 'डॉक्टरों को उनकी बोली जाने वाली भाषाओं से खोजें, ताकि आप अपनी समस्या आराम से बता सकें।' },
      { icon: '📄', t: 'सब कुछ एक जगह।', d: 'अपॉइंटमेंट, प्रिस्क्रिप्शन और रिपोर्ट आपके खाते में एक साथ रहते हैं, अगली बार के लिए तैयार।' },
      { icon: '👨‍👩‍👧', t: 'पूरे परिवार के लिए।', d: 'परिवार के सदस्यों को जोड़ें और उनकी ओर से बुकिंग करें।' },
    ],

    freeH: 'उपयोग मुफ़्त। कोई कमीशन नहीं। कभी नहीं।',
    freeP:
      'ProMedicoz न मरीज़ों से शुल्क लेता है, न डॉक्टरों से, और कोई कमीशन नहीं लेता। जब आप परामर्श लेते हैं, तो शुल्क सीधे उसी डॉक्टर को जाता है (जैसे UPI से) — ProMedicoz कभी आपका पैसा नहीं लेता या रखता। हमारा एकमात्र काम है सही मरीज़ को सही डॉक्टर से जोड़ना।',

    platH: 'एक प्लेटफ़ॉर्म, क्लिनिक नहीं',
    platP:
      'ProMedicoz एक प्लेटफ़ॉर्म है जो आपको डॉक्टरों से जोड़ता है — हम खुद इलाज नहीं करते। यहां के डॉक्टर स्वतंत्र, रजिस्टर्ड प्रैक्टिशनर हैं, और अपनी दी गई सलाह के लिए खुद ज़िम्मेदार हैं। इससे मरीज़ खुलकर चुन पाते हैं और डॉक्टर स्वतंत्र रूप से काम करते हैं, जबकि हम इस जुड़ाव को सुरक्षित, सरल और भरोसेमंद बनाने पर ध्यान देते हैं।',
    platLinks: 'और पढ़ें हमारे',

    trustH: 'आपके प्रति हमारा वादा',
    trustP:
      'सेहत निजी बात है, और भरोसा कमाना पड़ता है। हम आपकी स्वास्थ्य जानकारी गोपनीय रखते हैं, उसे कभी विज्ञापन के लिए इस्तेमाल नहीं करते, और अपने प्लेटफ़ॉर्म के डॉक्टरों की केवल असली, ईमानदार जानकारी दिखाते हैं। हम ProMedicoz को धीरे और सावधानी से बना रहे हैं — क्योंकि जब बात सेहत की हो, तो जल्दी करने से ज़्यादा सही करना मायने रखता है।',

    ctaH: 'शुरू करें',
    ctaP: 'कुछ मिनटों में डॉक्टर खोजें, या एक प्रैक्टिशनर के रूप में हमसे जुड़ें।',
    findDoctor: 'डॉक्टर खोजें',
    joinDoctor: 'डॉक्टर के रूप में जुड़ें',
    questions: 'कोई सवाल? हमसे संपर्क करें',

    disclaimer: 'मेडिकल अस्वीकरण', terms: 'नियम', privacy: 'गोपनीयता नीति',
  },
};

function AboutUs() {
  const { lang, setLang } = useLang(); // app-wide (top-bar switch)
  const t = TXT[lang];

  return (
    <div>
      {/* SEO title/description stay ENGLISH on purpose — they feed Google's
          index and OG previews, and must not change with the on-screen toggle. */}
      <SEO title="About Us — Verified Doctors, Fair Fees, No Commission" description="ProMedicoz connects patients across India with verified doctors for video, phone, and in-person consultations — a free platform where you pay the doctor directly, with no commission, built to make quality healthcare easy to reach." path="/about" />

      {/* Gradient hero band — brings the About page in line with the rest of
          the site (Home/booking/profile) instead of a bare heading on white.
          Decorative layers are pointer-events-none. Language toggle lives in
          the band so a Hindi-speaking visitor sees it immediately. */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 text-white">
        <div className="pointer-events-none absolute -top-16 -left-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 -right-16 w-80 h-80 bg-cyan-300/15 rounded-full blur-3xl" aria-hidden="true" />
        <div className="relative container mx-auto px-4 py-12 sm:py-16 max-w-3xl text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-2xl" aria-hidden="true">🏥</span>
            <span className="text-xl font-bold">ProMedicoz</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">{t.heroH1}</h1>
          <p className="text-primary-100 mt-3 max-w-2xl mx-auto text-sm sm:text-base">{t.heroSub}</p>

          {/* Trust pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6 text-xs sm:text-sm">
            {[t.pillVerified, t.pillNoCommission, t.pillModes].map((label, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 bg-white/12 border border-white/20 rounded-full px-3 py-1.5 font-medium">
                <span className="text-cyan-200" aria-hidden="true">✓</span>{label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-10 max-w-3xl space-y-8 text-gray-700 text-sm leading-relaxed">
        <section>
          <h2 className="flex items-center gap-2.5 text-xl font-bold text-gray-800 mb-2">
            <span className="w-1.5 h-5 rounded-full bg-primary-600" aria-hidden="true" />{t.whyH}
          </h2>
          <p>{t.whyP1}</p>
          <p className="mt-3">{t.whyP2}</p>
        </section>

        <section>
          <h2 className="flex items-center gap-2.5 text-xl font-bold text-gray-800 mb-4">
            <span className="w-1.5 h-5 rounded-full bg-primary-600" aria-hidden="true" />{t.doH}
          </h2>
          {/* Each "what we do" point is a card with a circular icon badge and a
              subtle hover lift, so the section reads as a set of features
              rather than a flat bulleted list. */}
          <ul className="grid sm:grid-cols-2 gap-3">
            {t.doItems.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary-200"
              >
                <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-primary-50 text-lg" aria-hidden="true">{item.icon}</span>
                <span className="leading-relaxed"><strong className="text-gray-800">{item.t}</strong> <span className="text-gray-600">{item.d}</span></span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-green-50 border border-green-100 rounded-2xl p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800 mb-2"><span aria-hidden="true">🧾</span>{t.freeH}</h2>
          <p>{t.freeP}</p>
        </section>

        <section>
          <h2 className="flex items-center gap-2.5 text-xl font-bold text-gray-800 mb-2">
            <span className="w-1.5 h-5 rounded-full bg-primary-600" aria-hidden="true" />{t.platH}
          </h2>
          <p>
            {t.platP}{' '}
            {t.platLinks}{' '}
            <Link to="/medical-disclaimer" className="text-primary-600 hover:underline">{t.disclaimer}</Link>,{' '}
            <Link to="/terms" className="text-primary-600 hover:underline">{t.terms}</Link>
            {lang === 'hi' ? ' और ' : ', and '}
            <Link to="/privacy" className="text-primary-600 hover:underline">{t.privacy}</Link>.
          </p>
        </section>

        <section>
          <h2 className="flex items-center gap-2.5 text-xl font-bold text-gray-800 mb-2">
            <span className="w-1.5 h-5 rounded-full bg-primary-600" aria-hidden="true" />{t.trustH}
          </h2>
          <p>{t.trustP}</p>
        </section>

        {/* CTAs */}
        <section className="bg-primary-50 border border-primary-100 rounded-2xl p-6 text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">{t.ctaH}</h2>
          <p className="text-gray-600 mb-4">{t.ctaP}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/doctors" className="btn btn-primary">{t.findDoctor}</Link>
            <Link to="/register?role=doctor" className="btn btn-outline">{t.joinDoctor}</Link>
          </div>
        </section>

        <section className="text-center">
          <p className="text-gray-500">{t.questions} <a href="mailto:support@promedicoz.in" className="text-primary-600 hover:underline">support@promedicoz.in</a></p>
        </section>
      </div>
    </div>
  );
}

export default AboutUs;
