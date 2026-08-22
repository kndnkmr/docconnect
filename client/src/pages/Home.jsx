import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { reviewAPI } from '../services/api';
import SEO from '../components/SEO';
import { WebsiteSchema } from '../components/StructuredData';
import { Helmet } from 'react-helmet-async';

// Bilingual UI strings for the patient-facing home page (Phase 1).
// Only fixed UI labels are translated. Brand name, Login/Register, and
// anything a doctor types (profiles, specializations, prescriptions) stay in
// English on purpose. Hindi copy should be proofread by a native speaker
// before treating it as final brand voice.
const TXT = {
  en: {
    heroTitle: 'Find the Right Doctor & Book Instantly',
    heroSubtitle: 'Video, phone, or in-person consultations with verified doctors across India.',
    searchPlaceholder: 'Describe your problem (e.g., back pain, fever...)',
    findDoctor: 'Find Doctor',
    suggested: 'Suggested',
    statDoctors: 'Doctors',
    statSpecializations: 'Specializations',
    statAppointments: 'Appointments',
    areYouDoctor: 'Are you a doctor?',
    joinLink: 'Join ProMedicoz →',
    specHeading: 'Consult by Specialization',
    specSubtitle: "Tap your concern — we'll show the right specialists",
    browseAll: '🔍 Browse All Specializations →',
    howHeading: 'How ProMedicoz Works',
    howSubtitle: 'Book a consultation in 4 simple steps',
    testimonialsHeading: 'What Our Patients Say',
    testimonialsSubtitle: 'Real reviews from real patients',
    faqHeading: 'Frequently Asked Questions',
    ctaHeading: 'Are You a Doctor?',
    ctaText: 'Join ProMedicoz to reach more patients, manage your schedule, and grow your practice effortlessly.',
    ctaButton: 'Register Now',
    steps: [
      { title: 'Create Account', desc: 'Sign up free in seconds.', cta: 'Register →' },
      { title: 'Find a Doctor', desc: 'Browse by specialization or fee.', cta: 'Browse →' },
      { title: 'Book a Slot', desc: 'Pick date, time & consultation type.', cta: 'Book Now →' },
      { title: 'Get Confirmed', desc: 'Doctor confirms, you get notified.', cta: 'Dashboard →' },
    ],
    faqs: [
      { q: 'How do I book a doctor on ProMedicoz?', a: 'Search by specialization or symptom, pick a doctor, select a date and time slot, and confirm your booking. The doctor confirms within hours.' },
      { q: 'Is ProMedicoz free to use?', a: 'Signing up and browsing doctors is free. You only pay the consultation fee directly to the doctor via UPI when your appointment is confirmed.' },
      { q: 'Can I consult a doctor online through video call?', a: 'Yes, ProMedicoz supports video, phone, and in-person consultations. Choose your preferred mode while booking.' },
      { q: 'How do I know if a doctor is good?', a: 'Each doctor profile shows their qualification, years of experience, consultation fee, and patient reviews with star ratings.' },
      { q: 'Can I book an appointment for a family member?', a: 'Yes, you can add family members to your account and book appointments on their behalf.' },
      { q: 'What if I need to cancel my appointment?', a: 'You can cancel from your dashboard at any time before the appointment. There are no cancellation charges.' },
    ],
  },
  hi: {
    heroTitle: 'सही डॉक्टर खोजें और तुरंत बुक करें',
    heroSubtitle: 'भारत भर के सत्यापित डॉक्टरों से वीडियो, फ़ोन या क्लिनिक पर परामर्श।',
    searchPlaceholder: 'अपनी समस्या बताएं (जैसे: कमर दर्द, बुखार...)',
    findDoctor: 'डॉक्टर खोजें',
    suggested: 'सुझाव',
    statDoctors: 'डॉक्टर',
    statSpecializations: 'विशेषज्ञताएं',
    statAppointments: 'अपॉइंटमेंट',
    areYouDoctor: 'क्या आप डॉक्टर हैं?',
    joinLink: 'ProMedicoz से जुड़ें →',
    specHeading: 'बीमारी के अनुसार परामर्श करें',
    specSubtitle: 'अपनी समस्या चुनें — हम सही विशेषज्ञ दिखाएंगे',
    browseAll: '🔍 सभी विशेषज्ञताएं देखें →',
    howHeading: 'ProMedicoz कैसे काम करता है',
    howSubtitle: '4 आसान चरणों में परामर्श बुक करें',
    testimonialsHeading: 'हमारे मरीज़ क्या कहते हैं',
    testimonialsSubtitle: 'असली मरीज़ों की असली समीक्षाएं',
    faqHeading: 'अक्सर पूछे जाने वाले प्रश्न',
    ctaHeading: 'क्या आप डॉक्टर हैं?',
    ctaText: 'अधिक मरीज़ों तक पहुंचने, अपना शेड्यूल प्रबंधित करने और अपनी प्रैक्टिस बढ़ाने के लिए ProMedicoz से जुड़ें।',
    ctaButton: 'अभी रजिस्टर करें',
    steps: [
      { title: 'खाता बनाएं', desc: 'कुछ ही सेकंड में मुफ़्त साइन अप करें।', cta: 'रजिस्टर →' },
      { title: 'डॉक्टर खोजें', desc: 'विशेषज्ञता या शुल्क के अनुसार खोजें।', cta: 'देखें →' },
      { title: 'स्लॉट बुक करें', desc: 'तारीख, समय और परामर्श का तरीका चुनें।', cta: 'अभी बुक करें →' },
      { title: 'पुष्टि पाएं', desc: 'डॉक्टर पुष्टि करता है, आपको सूचना मिलती है।', cta: 'डैशबोर्ड →' },
    ],
    faqs: [
      { q: 'ProMedicoz पर डॉक्टर कैसे बुक करें?', a: 'विशेषज्ञता या लक्षण के अनुसार खोजें, डॉक्टर चुनें, तारीख और समय चुनें, और अपनी बुकिंग की पुष्टि करें। डॉक्टर कुछ ही घंटों में पुष्टि कर देते हैं।' },
      { q: 'क्या ProMedicoz उपयोग करने के लिए मुफ़्त है?', a: 'साइन अप करना और डॉक्टर ब्राउज़ करना मुफ़्त है। अपॉइंटमेंट की पुष्टि होने पर आप केवल परामर्श शुल्क सीधे डॉक्टर को UPI के ज़रिए देते हैं।' },
      { q: 'क्या मैं वीडियो कॉल से ऑनलाइन डॉक्टर से परामर्श कर सकता हूं?', a: 'हां, ProMedicoz वीडियो, फ़ोन और क्लिनिक पर परामर्श की सुविधा देता है। बुकिंग के समय अपना पसंदीदा तरीका चुनें।' },
      { q: 'मुझे कैसे पता चलेगा कि डॉक्टर अच्छा है?', a: 'हर डॉक्टर की प्रोफ़ाइल में उनकी योग्यता, अनुभव, परामर्श शुल्क, और स्टार रेटिंग के साथ मरीज़ों की समीक्षाएं दिखती हैं।' },
      { q: 'क्या मैं परिवार के किसी सदस्य के लिए अपॉइंटमेंट बुक कर सकता हूं?', a: 'हां, आप अपने खाते में परिवार के सदस्यों को जोड़ सकते हैं और उनकी ओर से अपॉइंटमेंट बुक कर सकते हैं।' },
      { q: 'अगर मुझे अपना अपॉइंटमेंट रद्द करना हो तो क्या करूं?', a: 'आप अपॉइंटमेंट से पहले कभी भी अपने डैशबोर्ड से इसे रद्द कर सकते हैं। कोई रद्दीकरण शुल्क नहीं है।' },
    ],
  },
};

function Home() {
  const { isAuthenticated } = useAuth();
  const [symptomSearch, setSymptomSearch] = useState('');
  const [topReviews, setTopReviews] = useState([]);
  // Language toggle (Phase 1: Home page). Remembered across visits.
  const [lang, setLang] = useState(() => localStorage.getItem('promedicoz_lang') || 'en');
  const t = TXT[lang];
  const changeLang = (l) => { setLang(l); localStorage.setItem('promedicoz_lang', l); };

  useEffect(() => {
    const fetchTopReviews = async () => {
      try {
        const response = await reviewAPI.getTopReviews();
        setTopReviews(response.data.reviews || []);
      } catch (error) {
        console.error('Fetch reviews error:', error);
      }
    };
    fetchTopReviews();
  }, []);

  const getSpecializationFromSymptom = (input) => {
    const lower = input.toLowerCase();
    const mapping = [
      { keywords: ['fever', 'cold', 'cough', 'flu', 'infection', 'weakness', 'fatigue'], specialization: 'General Physician' },
      { keywords: ['head', 'migraine', 'brain', 'nerve', 'seizure', 'numbness', 'dizziness'], specialization: 'Neurologist' },
      { keywords: ['pregnan', 'ivf', 'period', 'menstrual', 'pcod', 'pcos', 'fertility', 'gynae', 'uterus', 'ovary'], specialization: 'Gynaecologist' },
      { keywords: ['skin', 'acne', 'hair', 'rash', 'itch', 'pimple', 'dandruff', 'allergy'], specialization: 'Dermatologist' },
      { keywords: ['heart', 'chest pain', 'bp', 'blood pressure', 'cholesterol'], specialization: 'Cardiologist' },
      { keywords: ['bone', 'joint', 'knee', 'back pain', 'spine', 'fracture', 'shoulder'], specialization: 'Orthopedic' },
      { keywords: ['child', 'baby', 'infant', 'kid', 'vaccination', 'newborn'], specialization: 'Pediatrician' },
      { keywords: ['tooth', 'teeth', 'dental', 'gum', 'cavity', 'braces'], specialization: 'Dentist' },
      { keywords: ['eye', 'vision', 'glass', 'cataract', 'spectacle'], specialization: 'Ophthalmologist' },
      { keywords: ['depress', 'anxiety', 'stress', 'sleep', 'mental', 'panic', 'mood'], specialization: 'Psychiatrist' },
      { keywords: ['ear', 'nose', 'throat', 'sinus', 'hearing', 'tonsil', 'snoring'], specialization: 'ENT Specialist' },
      { keywords: ['stomach', 'digest', 'acid', 'gastric', 'liver', 'constipat', 'diarr', 'bloat'], specialization: 'Gastroenterologist' },
      { keywords: ['urine', 'kidney', 'bladder', 'prostate'], specialization: 'Urologist' },
      { keywords: ['diabetes', 'thyroid', 'hormone', 'sugar'], specialization: 'Endocrinologist' },
      { keywords: ['lung', 'breath', 'asthma', 'wheez', 'pneumonia'], specialization: 'Pulmonologist' },
    ];
    for (const entry of mapping) {
      if (entry.keywords.some(keyword => lower.includes(keyword))) {
        return entry.specialization;
      }
    }
    return 'General Physician';
  };

  return (
    <div className="flex-grow flex flex-col">
      <SEO
        title="Find & Book Doctors Online in India"
        description="ProMedicoz - Book doctor appointments online. Find gynaecologists, cardiologists, dermatologists and 20+ specialists. Video, phone or in-person consultations."
        path="/"
      />
      <WebsiteSchema />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            { '@type': 'Question', name: 'How do I book a doctor on ProMedicoz?', acceptedAnswer: { '@type': 'Answer', text: 'Search by specialization or symptom, pick a doctor, select a date and time slot, and confirm your booking.' } },
            { '@type': 'Question', name: 'Is ProMedicoz free to use?', acceptedAnswer: { '@type': 'Answer', text: 'Signing up and browsing doctors is free. You only pay the consultation fee directly to the doctor.' } },
            { '@type': 'Question', name: 'Can I consult a doctor online through video call?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, ProMedicoz supports video, phone, and in-person consultations.' } },
            { '@type': 'Question', name: 'Can I book an appointment for a family member?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, you can add family members to your account and book appointments on their behalf.' } },
          ]
        })}</script>
      </Helmet>
      {/* ---- Hero Section — search-first, like Practo/1mg/Apollo ---- */}
      {/* The patient's primary action (describe your problem → find a doctor)
          IS the hero, so it's the first thing on screen — no scrolling past
          marketing to reach it. Login/Register live in the navbar; the hero
          stays focused on the one job a patient came to do. */}
      <section className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="container mx-auto px-4 py-10 sm:py-14 md:py-20">
          <div className="max-w-2xl mx-auto text-center">
            {/* Language toggle — placed prominently in the hero (not the
                navbar, which is easy to miss) so a non-English speaker sees
                it immediately. */}
            <div className="inline-flex items-center bg-white/15 rounded-full p-1 mb-5 text-sm">
              <button
                onClick={() => changeLang('en')}
                className={`px-4 py-1.5 rounded-full font-medium transition-colors ${lang === 'en' ? 'bg-white text-primary-700' : 'text-white hover:bg-white/10'}`}
              >
                English
              </button>
              <button
                onClick={() => changeLang('hi')}
                className={`px-4 py-1.5 rounded-full font-medium transition-colors ${lang === 'hi' ? 'bg-white text-primary-700' : 'text-white hover:bg-white/10'}`}
              >
                हिंदी
              </button>
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-3">
              {t.heroTitle}
            </h1>
            <p className="text-sm sm:text-lg text-primary-100 mb-6">
              {t.heroSubtitle}
            </p>

            {/* Search box — the hero's centerpiece */}
            <div className="max-w-xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  value={symptomSearch}
                  onChange={(e) => setSymptomSearch(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full pl-5 pr-28 py-3.5 rounded-full text-gray-800 text-sm sm:text-base outline-none focus:ring-4 focus:ring-white/30 shadow-lg"
                />
                <Link
                  to={symptomSearch
                    ? `/doctors?specialization=${encodeURIComponent(getSpecializationFromSymptom(symptomSearch))}`
                    : '/doctors'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-primary-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-primary-700 transition-colors"
                >
                  {t.findDoctor}
                </Link>
              </div>
              {symptomSearch && (
                <p className="text-xs text-primary-100 mt-2 text-left pl-4">
                  {t.suggested}: <span className="font-semibold">{getSpecializationFromSymptom(symptomSearch)}</span>
                </p>
              )}
            </div>

            {/* Trust stats — compact, below the action */}
            <div className="flex justify-center gap-6 sm:gap-10 mt-8 pt-5 border-t border-primary-500/50">
              <div>
                <div className="text-lg sm:text-2xl font-bold">100+</div>
                <div className="text-primary-200 text-xs sm:text-sm">{t.statDoctors}</div>
              </div>
              <div>
                <div className="text-lg sm:text-2xl font-bold">20+</div>
                <div className="text-primary-200 text-xs sm:text-sm">{t.statSpecializations}</div>
              </div>
              <div>
                <div className="text-lg sm:text-2xl font-bold">1000+</div>
                <div className="text-primary-200 text-xs sm:text-sm">{t.statAppointments}</div>
              </div>
            </div>

            {!isAuthenticated && (
              <p className="text-primary-100 text-xs sm:text-sm mt-5">
                {t.areYouDoctor}{' '}
                <Link to="/register?role=doctor" className="underline font-semibold hover:text-white">{t.joinLink}</Link>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ---- Browse by concern — full specialization grid ---- */}
      <section className="pt-8 pb-10 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">{t.specHeading}</h2>
          <p className="text-center text-gray-500 mb-6 text-sm">{t.specSubtitle}</p>

          {/* Symptom cards — all departments */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-w-5xl mx-auto">
            {[
              { symptom: 'Fever / Cold', hi: 'बुखार / सर्दी', icon: '🤒', specialization: 'General Physician', slug: 'general-physician' },
              { symptom: 'Headache', hi: 'सिरदर्द', icon: '🤕', specialization: 'Neurologist', slug: 'neurologist' },
              { symptom: 'Pregnancy', hi: 'गर्भावस्था', icon: '🤰', specialization: 'Gynaecologist', slug: 'gynaecologist' },
              { symptom: 'Skin / Hair', hi: 'त्वचा / बाल', icon: '🧴', specialization: 'Dermatologist', slug: 'dermatologist' },
              { symptom: 'Heart / BP', hi: 'हृदय / रक्तचाप', icon: '❤️', specialization: 'Cardiologist', slug: 'cardiologist' },
              { symptom: 'Bone / Joint', hi: 'हड्डी / जोड़', icon: '🦴', specialization: 'Orthopedic', slug: 'orthopedic' },
              { symptom: 'Child Health', hi: 'बच्चों का स्वास्थ्य', icon: '👶', specialization: 'Pediatrician', slug: 'pediatrician' },
              { symptom: 'Dental', hi: 'दंत / दांत', icon: '🦷', specialization: 'Dentist', slug: 'dentist' },
              { symptom: 'Eye / Vision', hi: 'आँख / दृष्टि', icon: '👁️', specialization: 'Ophthalmologist' },
              { symptom: 'Mental Health', hi: 'मानसिक स्वास्थ्य', icon: '🧠', specialization: 'Psychiatrist', slug: 'psychiatrist' },
              { symptom: 'Ear / Nose', hi: 'कान / नाक', icon: '👂', specialization: 'ENT Specialist', slug: 'ent-specialist' },
              { symptom: 'Stomach', hi: 'पेट', icon: '🤢', specialization: 'Gastroenterologist' },
              { symptom: 'Lungs', hi: 'फेफड़े', icon: '🫁', specialization: 'Pulmonologist' },
              { symptom: 'Kidney / Urine', hi: 'किडनी / मूत्र', icon: '💧', specialization: 'Urologist' },
              { symptom: 'Diabetes', hi: 'मधुमेह', icon: '💉', specialization: 'Endocrinologist' },
              { symptom: 'Cancer', hi: 'कैंसर', icon: '🎗️', specialization: 'Oncologist' },
              { symptom: 'Kidney Disease', hi: 'गुर्दा रोग', icon: '🫘', specialization: 'Nephrologist' },
              { symptom: 'Arthritis', hi: 'गठिया', icon: '🖐️', specialization: 'Rheumatologist' },
              { symptom: 'Surgery', hi: 'सर्जरी', icon: '🔪', specialization: 'Surgeon' },
              { symptom: 'Physiotherapy', hi: 'फिजियोथेरेपी', icon: '🏃', specialization: 'Physiotherapist' },
              { symptom: 'Sexual Health', hi: 'यौन स्वास्थ्य', icon: '🔒', specialization: 'Sexologist' },
              { symptom: 'Homeopathy', hi: 'होम्योपैथी', icon: '🌿', specialization: 'Homeopathy' },
              { symptom: 'Ayurveda', hi: 'आयुर्वेद', icon: '🍃', specialization: 'Ayurveda' },
              { symptom: 'Diet / Nutrition', hi: 'आहार / पोषण', icon: '🥗', specialization: 'Dietitian' },
            ].map((item, idx) => (
              <Link
                key={idx}
                to={item.slug ? `/specialization/${item.slug}` : `/doctors?specialization=${encodeURIComponent(item.specialization)}`}
                className="bg-gray-50 p-3 rounded-xl hover:shadow-md transition-all text-center border border-gray-100 hover:border-primary-200 hover:bg-primary-50"
              >
                <div className="text-3xl mb-1">{item.icon}</div>
                {/* Always bilingual — the whole point is a Hindi-speaking
                    patient can tap the right card instead of typing English. */}
                <p className="text-xs font-medium text-gray-700 leading-tight">{item.symptom}</p>
                <p className="text-xs text-gray-500 leading-tight mt-0.5">{item.hi}</p>
              </Link>
            ))}
          </div>

          {/* See all link */}
          <div className="text-center mt-5">
            <Link
              to="/doctors"
              className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 text-primary-700 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary-100 transition-colors"
            >
              {t.browseAll}
            </Link>
          </div>
        </div>
      </section>

      {/* ---- How It Works ---- */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">{t.howHeading}</h2>
          <p className="text-center text-gray-500 mb-10 text-sm">{t.howSubtitle}</p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { step: 1, icon: '👤', to: '/register' },
              { step: 2, icon: '🔍', to: '/doctors' },
              { step: 3, icon: '📅', to: '/doctors' },
              { step: 4, icon: '✅', to: '/dashboard' },
            ].map(({ step, icon, to }) => {
              const s = t.steps[step - 1];
              return (
              <Link key={step} to={to} className="group text-center p-5 rounded-xl border-2 border-gray-100 bg-white hover:border-primary-300 hover:shadow-md transition-all">
                <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold mx-auto mb-3 group-hover:bg-primary-600 group-hover:text-white transition-colors text-sm">
                  {step}
                </div>
                <div className="text-3xl mb-2">{icon}</div>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">{s.title}</h3>
                <p className="text-gray-500 text-xs mb-2">{s.desc}</p>
                <span className="text-primary-600 text-xs font-medium group-hover:underline">{s.cta}</span>
              </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---- Testimonials ---- */}
      <section className="py-10 bg-white overflow-hidden">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-1">{t.testimonialsHeading}</h2>
          <p className="text-center text-gray-500 mb-6 text-sm">{t.testimonialsSubtitle}</p>
        </div>
        {topReviews.length > 0 ? (
          <div className="relative">
            <div className="flex animate-scroll gap-6 px-4">
              {[...topReviews, ...topReviews].map((review, idx) => (
                <div key={idx} className="min-w-[280px] max-w-[280px] bg-gray-50 border border-gray-100 rounded-xl p-4 flex-shrink-0">
                  <div className="text-yellow-400 text-sm mb-2">{'⭐'.repeat(review.rating)}</div>
                  <p className="text-gray-700 text-sm line-clamp-3">"{review.comment}"</p>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-800">{review.patient?.name}</span>
                    <span className="text-xs text-gray-400">Dr. {review.doctor?.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {[
                { stars: 5, text: 'Very easy to book an appointment. The doctor was on time and professional.', name: 'Priya S.' },
                { stars: 5, text: 'Great platform! Found a specialist within minutes and got confirmed quickly.', name: 'Rahul M.' },
                { stars: 4, text: 'Convenient and simple. No more waiting on phone calls to book a doctor.', name: 'Anita K.' },
              ].map((item, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <div className="text-yellow-400 text-sm mb-2">{'⭐'.repeat(item.stars)}</div>
                  <p className="text-gray-700 text-sm italic">"{item.text}"</p>
                  <p className="text-xs font-medium text-gray-500 mt-2">— {item.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ---- FAQs for Google "People Also Ask" ---- */}
      <section className="py-10 bg-gray-50">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">{t.faqHeading}</h2>
          <div className="space-y-3">
            {t.faqs.map((faq, idx) => (
              <details key={idx} className="bg-white border border-gray-200 rounded-xl p-4 group">
                <summary className="font-medium text-gray-800 cursor-pointer list-none flex justify-between items-center">
                  {faq.q}
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="text-gray-600 text-sm mt-3">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Get the App strip ---- compact, so first-time visitors know
           they can install ProMedicoz like an app and share it. */}
      <section className="py-8 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="text-4xl">📲</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-800">
                {lang === 'hi' ? 'ProMedicoz को ऐप की तरह इंस्टॉल करें' : 'Install ProMedicoz like an app'}
              </h3>
              <p className="text-gray-600 text-sm mt-0.5">
                {lang === 'hi'
                  ? 'अपने फ़ोन की होम स्क्रीन पर जोड़ें — तेज़ पहुँच पाएं और परिवार व दोस्तों के साथ साझा करें।'
                  : 'Add it to your phone’s home screen for quick access — and share it with family and friends.'}
              </p>
            </div>
            <Link
              to="/install"
              className="whitespace-nowrap bg-primary-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              {lang === 'hi' ? 'ऐप पाएं' : 'Get the App'}
            </Link>
          </div>
        </div>
      </section>

      {/* ---- CTA ---- (flex-grow so this blue band fills any leftover space
           down to the footer on tall screens, instead of leaving a pale gap) */}
      <section className="py-12 bg-primary-700 text-white flex-grow flex flex-col justify-center">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-3">{t.ctaHeading}</h2>
          <p className="text-primary-100 mb-6 max-w-xl mx-auto">
            {t.ctaText}
          </p>
          {!isAuthenticated && (
            <div className="flex flex-wrap justify-center items-center gap-3">
              <Link to="/register?role=doctor" className="bg-white text-primary-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block">
                {t.ctaButton}
              </Link>
              <Link to="/for-doctors" className="text-white underline font-medium hover:text-primary-100 inline-block">
                {lang === 'hi' ? 'यह कैसे काम करता है जानें →' : 'See how it works →'}
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default Home;
