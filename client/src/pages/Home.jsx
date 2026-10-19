import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePwa } from '../context/PwaContext';
import { reviewAPI, doctorAPI, getUploadUrl } from '../services/api';
import SEO from '../components/SEO';
import { WebsiteSchema } from '../components/StructuredData';
import { Helmet } from 'react-helmet-async';
import { trackEvent } from '../components/Analytics';
import VerifiedBadge from '../components/VerifiedBadge';
import { formatDoctorName } from '../utils/formatName';
// NOTE: blogData is NOT imported statically here — that would pull the entire
// ~210 KB of article content into the main app bundle just for the daily-tip
// card. Instead we load it dynamically after mount (see useEffect below), so
// the home page stays lean regardless of how many articles exist.

// Curated REAL patient reviews, provided and confirmed as genuine by the
// ProMedicoz team. These are shown in the testimonials marquee alongside any
// live reviews pulled from the API, so the section always reflects real
// patient experiences. (Kept module-level so it isn't rebuilt each render.)
// Add new confirmed reviews here as they come in.
const CURATED_REVIEWS = [
  { stars: 5, text: 'Online doctor consultations are a game-changer — giving you a fast, stress-free way to connect with real physicians right from your couch.', name: 'Chandan', spec: 'Online consultation' },
  { stars: 5, text: 'Dr. Pooja is an incredible gynecologist — her virtual consultation gave me the exact guidance and relief I needed for period pain right when I needed it.', name: 'Naina', spec: 'consulted Dr. Pooja' },
  { stars: 5, text: 'A huge thank you to gynecologist Dr. Pooja; her online consultation provided fast, compassionate relief for my severe period pain without the hassle of a clinic visit.', name: 'Geeta', spec: 'consulted Dr. Pooja' },
  { stars: 5, text: 'Highly recommend Dr. Pooja for gynecological consultations. She explained the root cause of my menstrual pain clearly and provided a very effective management plan online.', name: 'Kia', spec: 'consulted Dr. Pooja' },
  { stars: 5, text: "Managing PCOS/PCOD symptoms can be overwhelming, but Dr. Pooja's expert guidance during our virtual consultation gave me the exact dietary and medical steps I needed to get my cycle back on track.", name: 'Sonam Tiwari', spec: 'consulted Dr. Pooja' },
  { stars: 5, text: 'The most comfortable way to get expert gynecological advice — thank you, Dr. Pooja, for making women\'s healthcare so accessible!', name: 'Sagufta Sultana', spec: 'consulted Dr. Pooja' },
  { stars: 5, text: 'Navigating menopause symptoms was becoming exhausting, but Dr. Pooja\'s online consultation changed everything. She carefully analyzed my hot flashes and mood shifts, creating a personalized management plan that has truly restored my energy.', name: 'Mandakini Chandrakar', spec: 'consulted Dr. Pooja' },
];

// Bilingual UI strings for the patient-facing home page (Phase 1).
// Only fixed UI labels are translated. Brand name, Login/Register, and
// anything a doctor types (profiles, specializations, prescriptions) stay in
// English on purpose. Hindi copy should be proofread by a native speaker
// before treating it as final brand voice.
const TXT = {
  en: {
    heroTitle: 'Find the Right Doctor & Book Instantly',
    heroSubtitle: 'Consult trusted doctors across India — booked in under 2 minutes.',
    trustVerified: 'Verified doctors',
    trustNoCommission: 'Pay the doctor directly',
    trustModes: 'Video, phone or in-person',
    heroPill: 'No commission · fair fees',
    searchLabel: 'What do you need help with?',
    searchPlaceholder: 'Describe your problem (e.g., back pain, fever...)',
    findDoctor: 'Find Doctor',
    quickLabel: 'Popular',
    suggested: 'Suggested',
    statDoctors: 'Doctors',
    statSpecializations: 'Specialities',
    statAppointments: 'Booked',
    areYouDoctor: 'Are you a doctor?',
    joinLink: 'Join ProMedicoz →',
    tipBadge: '💡 Health Tip of the Day',
    tipRead: 'Read the full article →',
    tipMore: 'More health articles →',
    shareHeading: 'Know someone who needs a doctor?',
    shareSub: 'Verified doctors, fair fees, no commission. Share ProMedicoz with family and friends.',
    shareBtn: '📤 Share with family & friends',
    shareMsg:
      '🏥 Found a great way to see a doctor: *ProMedicoz*\n\n' +
      '✅ Verified doctors — video, phone, or in-person\n' +
      '💸 Fair, honest fees — you pay the doctor directly, no commission\n' +
      '⏱️ Book in under 2 minutes\n\n' +
      '👉 https://www.promedicoz.in\n\n' +
      'Sharing because good, affordable healthcare is worth passing on. ❤️',
    shareCopied: 'Message copied! Paste it in WhatsApp or anywhere to share.',
    availNowHeading: 'Doctors available today',
    availNowSub: 'Real, verified doctors with open slots right now — tap to book',
    availToday: 'Available today',
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
    heroSubtitle: 'भारत भर के भरोसेमंद डॉक्टर — 2 मिनट से भी कम में बुक करें।',
    trustVerified: 'सत्यापित डॉक्टर',
    trustNoCommission: 'पैसे सीधे डॉक्टर को',
    trustModes: 'वीडियो, फ़ोन या क्लिनिक पर',
    heroPill: 'कोई कमीशन नहीं · वाजिब फ़ीस',
    searchLabel: 'आपको किसमें मदद चाहिए?',
    searchPlaceholder: 'अपनी समस्या बताएं (जैसे: कमर दर्द, बुखार...)',
    findDoctor: 'डॉक्टर खोजें',
    quickLabel: 'लोकप्रिय',
    suggested: 'सुझाव',
    statDoctors: 'डॉक्टर',
    statSpecializations: 'विशेषज्ञताएं',
    statAppointments: 'बुकिंग',
    areYouDoctor: 'क्या आप डॉक्टर हैं?',
    joinLink: 'ProMedicoz से जुड़ें →',
    tipBadge: '💡 आज का स्वास्थ्य सुझाव',
    tipRead: 'पूरा लेख पढ़ें →',
    tipMore: 'और स्वास्थ्य लेख →',
    shareHeading: 'किसी को डॉक्टर की ज़रूरत है?',
    shareSub: 'सत्यापित डॉक्टर, वाजिब फ़ीस, कोई कमीशन नहीं। ProMedicoz परिवार और दोस्तों के साथ साझा करें।',
    shareBtn: '📤 परिवार और दोस्तों के साथ साझा करें',
    shareMsg:
      '🏥 डॉक्टर दिखाने का एक बढ़िया तरीका मिला: *ProMedicoz*\n\n' +
      '✅ सत्यापित डॉक्टर — वीडियो, फ़ोन या क्लिनिक पर\n' +
      '💸 वाजिब और ईमानदार फ़ीस — पैसे सीधे डॉक्टर को, कोई कमीशन नहीं\n' +
      '⏱️ 2 मिनट से भी कम में बुक करें\n\n' +
      '👉 https://www.promedicoz.in\n\n' +
      'शेयर इसलिए, क्योंकि अच्छी और सस्ती सेहत-सुविधा सबके काम आती है। ❤️',
    shareCopied: 'संदेश कॉपी हो गया! WhatsApp या कहीं भी पेस्ट करके साझा करें।',
    availNowHeading: 'आज उपलब्ध डॉक्टर',
    availNowSub: 'सत्यापित डॉक्टर, अभी खाली स्लॉट के साथ — बुक करने के लिए टैप करें',
    availToday: 'आज उपलब्ध',
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
  const { canInstall, promptInstall } = usePwa();
  const navigate = useNavigate();
  const [symptomSearch, setSymptomSearch] = useState('');

  // Hero Share: use the phone's native share sheet when available; otherwise
  // send the user to the /install page which has all the per-platform share
  // buttons (WhatsApp, Facebook, copy link, QR).
  const handleHeroShare = async () => {
    const shareData = {
      title: 'ProMedicoz',
      text: 'Consult verified doctors online on ProMedicoz — video, phone, or in-person.',
      url: 'https://www.promedicoz.in',
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
      return;
    }
    navigate('/install');
  };
  const [topReviews, setTopReviews] = useState([]);
  // "Doctors available today" strip — real, verified doctors who have BOTH a
  // profile photo AND a free slot today. We filter to those two conditions so
  // the row always looks populated and trustworthy (never a wall of generic
  // placeholder icons, never a doctor you can't actually book today). If fewer
  // than 3 qualify, the whole section hides itself — so it can't look sparse.
  const [availableDoctors, setAvailableDoctors] = useState([]);
  // Language toggle (Phase 1: Home page). Remembered across visits.
  const [lang, setLang] = useState(() => localStorage.getItem('promedicoz_lang') || 'en');
  const t = TXT[lang];
  const changeLang = (l) => { setLang(l); localStorage.setItem('promedicoz_lang', l); };

  // "Health Tip of the Day" — one article, chosen deterministically from the
  // date (same for everyone on a given day, rotates daily). Article content is
  // loaded lazily (dynamic import) after the page renders, so it never weighs
  // down the initial home-page load. The tip card simply appears a moment
  // later once the data is fetched (and is hidden until then).
  const [dailyTip, setDailyTip] = useState(null);

  // Share ProMedicoz with family/friends — uses the phone's native share sheet
  // (WhatsApp, etc.) when available; otherwise falls back to copying the message
  // and a WhatsApp web link. Self-contained (no toast dependency), and tracked
  // so we can see how word-of-mouth sharing performs. Safe: wrapped so a share
  // failure never breaks the page.
  const handleShareSite = async () => {
    trackEvent('share_site', { source: 'home' });
    const msg = t.shareMsg;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'ProMedicoz', text: msg });
        return;
      }
    } catch { /* user cancelled the native share — do nothing */ return; }
    // Fallback (mostly desktop): copy the message, then open WhatsApp web.
    try { await navigator.clipboard.writeText(msg); } catch { /* ignore */ }
    try {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    } catch { /* popup blocked — the message is already copied */ }
  };

  useEffect(() => {
    let cancelled = false;
    // Load only the lightweight article metadata (not the full article bodies)
    // for the daily-tip card — it just needs slug/title/description/image.
    import('./blog/blogMeta').then(({ articleMeta: articles }) => {
      if (cancelled || !articles || !articles.length) return;
      const now = new Date();
      const dayNumber = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
      setDailyTip(articles[dayNumber % articles.length]);
    }).catch(() => { /* non-critical — just skip the tip if it fails to load */ });
    return () => { cancelled = true; };
  }, []);

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

  // Fetch doctors available TODAY (server computes real, unbooked, future
  // slots), then keep only those with a real photo for the strip. Non-critical
  // and fully guarded: any failure just leaves the strip hidden.
  useEffect(() => {
    let cancelled = false;
    doctorAPI.getAll({ availableToday: 'true', limit: 12 })
      .then((res) => {
        if (cancelled) return;
        const docs = (res.data.doctors || []).filter(
          (d) => d.profilePhoto && d.profilePhoto.trim() && d.nextAvailable && d.nextAvailable.isToday
        );
        setAvailableDoctors(docs);
      })
      .catch(() => { /* non-critical — strip simply won't show */ });
    return () => { cancelled = true; };
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

  // One-tap "popular" chips under the search — the single biggest modern
  // health-app upgrade: a patient who doesn't want to type can jump straight
  // into a specialty. Gynaecologist + General Physician lead (the platform's
  // focus). Each `spec` is a real specialization the backend/synonyms match,
  // so a tap lands on a populated doctor list. Labels are bilingual.
  const quickPicks = [
    { en: "Women's health", hi: 'महिला स्वास्थ्य', emoji: '🌸', spec: 'Gynaecologist' },
    { en: 'General Physician', hi: 'सामान्य चिकित्सक', emoji: '🩺', spec: 'General Physician' },
    { en: 'Skin & hair', hi: 'त्वचा व बाल', emoji: '✨', spec: 'Dermatologist' },
    { en: 'Child care', hi: 'बाल रोग', emoji: '🧸', spec: 'Pediatrician' },
    { en: 'Mental health', hi: 'मानसिक स्वास्थ्य', emoji: '🧠', spec: 'Psychiatrist' },
  ];

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
      <section className="hero-animated-gradient relative overflow-hidden bg-gradient-to-br from-primary-800 via-primary-600 to-primary-700 text-white">
        {/* Depth layers (all decorative + pointer-events-none, so nothing
            interactive moves):
            1. a faint medical-cross motif (on-brand, radially masked so it
               fades toward the edges),
            2. two slowly floating "aurora" glow blobs for app-like depth,
            3. a soft dark vignette at the bottom so the content below reads
               as a clean seam rather than a hard gradient cut. */}
        <div className="hero-cross-pattern pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden="true"></div>
        <div className="hero-float-slow pointer-events-none absolute -top-24 -left-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" aria-hidden="true"></div>
        <div className="hero-float-slower pointer-events-none absolute -bottom-28 -right-16 w-96 h-96 rounded-full bg-cyan-300/20 blur-3xl" aria-hidden="true"></div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/15 to-transparent" aria-hidden="true"></div>

        <div className="relative container mx-auto px-4 py-10 sm:py-16 md:py-24">
          <div className="max-w-2xl mx-auto text-center">
            {/* Top row: language toggle centered, with Install (left) and
                Share (right) filling the empty space on either side. Wraps
                cleanly on small screens. Language toggle stays prominent in
                the hero (not the navbar) so a non-English speaker sees it. */}
            <div className="hero-rise hero-rise-1 flex items-center justify-center gap-1.5 sm:gap-2 mb-6">
              {/* Install — one-tap when the browser supports it, else the
                  /install page (iOS steps). */}
              {canInstall ? (
                <button
                  onClick={promptInstall}
                  className="inline-flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
                >
                  📲 {lang === 'hi' ? 'इंस्टॉल' : 'Install'}
                </button>
              ) : (
                <Link
                  to="/install"
                  className="inline-flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
                >
                  📲 {lang === 'hi' ? 'ऐप' : 'Get App'}
                </Link>
              )}

              <div className="inline-flex items-center bg-white/15 rounded-full p-1 text-xs sm:text-sm">
                <button
                  onClick={() => changeLang('en')}
                  className={`px-2.5 sm:px-4 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap ${lang === 'en' ? 'bg-white text-primary-700' : 'text-white hover:bg-white/10'}`}
                >
                  English
                </button>
                <button
                  onClick={() => changeLang('hi')}
                  className={`px-2.5 sm:px-4 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap ${lang === 'hi' ? 'bg-white text-primary-700' : 'text-white hover:bg-white/10'}`}
                >
                  हिंदी
                </button>
              </div>

              {/* Share — native share sheet on mobile; otherwise go to the
                  /install page which has all the per-platform share buttons. */}
              <button
                onClick={handleHeroShare}
                className="inline-flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
              >
                📤 {lang === 'hi' ? 'साझा' : 'Share'}
              </button>
            </div>

            {/* One differentiator pill above the title — "no commission" is
                the genuine edge over Practo/1mg, so it leads. The old trio of
                pills duplicated the subtitle (verified + modes) and has been
                folded into the glass card's trust strip below. */}
            <span className="hero-rise hero-rise-1 inline-flex items-center gap-1.5 bg-white/12 border border-white/20 rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-medium mb-4 backdrop-blur-sm">
              <span className="text-cyan-200" aria-hidden="true">●</span>
              {t.heroPill}
            </span>

            <h1 className="hero-rise hero-rise-2 text-[26px] leading-tight sm:text-4xl md:text-5xl font-extrabold mb-3 tracking-tight">
              {t.heroTitle}
            </h1>
            <p className="hero-rise hero-rise-2 text-sm sm:text-lg text-primary-100 mb-6 max-w-lg mx-auto">
              {t.heroSubtitle}
            </p>

            {/* Booking card — the hero's centrepiece, lifted onto a frosted
                glass panel so it reads as a real, tappable object (the app
                feel) instead of a bare input floating on the gradient. */}
            <div className="hero-rise hero-rise-3 max-w-xl mx-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl ring-1 ring-black/5 p-3.5 sm:p-4 text-left">
              <label htmlFor="hero-symptom" className="block text-xs font-semibold text-gray-500 mb-2 px-1">
                {t.searchLabel}
              </label>
              <div className="relative">
                <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 110-14 7 7 0 010 14z" />
                </svg>
                <input
                  id="hero-symptom"
                  type="text"
                  value={symptomSearch}
                  onChange={(e) => setSymptomSearch(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  aria-label={t.searchLabel}
                  className="w-full pl-11 pr-3 py-3.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 text-sm sm:text-base outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:bg-white transition-colors"
                />
              </div>

              {symptomSearch && (
                <p className="text-xs text-gray-500 mt-2 px-1">
                  {t.suggested}: <span className="font-semibold text-primary-700">{getSpecializationFromSymptom(symptomSearch)}</span>
                </p>
              )}

              <Link
                to={symptomSearch
                  ? `/doctors?specialization=${encodeURIComponent(getSpecializationFromSymptom(symptomSearch))}`
                  : '/doctors'}
                onClick={() => trackEvent('find_doctor_click', {
                  source: 'home_hero_search',
                  specialization: symptomSearch ? getSpecializationFromSymptom(symptomSearch) : 'none',
                  had_symptom: symptomSearch ? 'yes' : 'no',
                })}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-5 py-3.5 rounded-xl text-sm sm:text-base font-semibold shadow-sm transition-all duration-200 hover:bg-primary-700 hover:shadow-md active:scale-[0.99]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 110-14 7 7 0 010 14z" />
                </svg>
                {t.findDoctor}
              </Link>

              {/* One-tap popular specialties — lets a patient who doesn't want
                  to type jump straight into a populated doctor list. */}
              <div className="mt-3.5 pt-3.5 border-t border-gray-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2 px-1">{t.quickLabel}</p>
                <div className="flex flex-wrap gap-2">
                  {quickPicks.map((q) => (
                    <Link
                      key={q.spec}
                      to={`/doctors?specialization=${encodeURIComponent(q.spec)}`}
                      onClick={() => trackEvent('find_doctor_click', { source: 'home_hero_quickpick', specialization: q.spec, had_symptom: 'no' })}
                      className="inline-flex items-center gap-1.5 bg-primary-50 text-primary-700 border border-primary-100 rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors hover:bg-primary-100 active:scale-[0.97]"
                    >
                      <span aria-hidden="true">{q.emoji}</span>
                      {lang === 'hi' ? q.hi : q.en}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Trust strip — the two credibility points (verified + modes),
                now shown ONCE here instead of duplicating the subtitle. */}
            <div className="hero-rise hero-rise-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-5 text-xs sm:text-sm text-primary-100">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-cyan-200" aria-hidden="true">✓</span>{t.trustVerified}
              </span>
              <span className="text-white/30" aria-hidden="true">•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-cyan-200" aria-hidden="true">✓</span>{t.trustModes}
              </span>
            </div>

            {/* Compact stat row — flat, inline numbers (no boxed cards), so it
                reads as a confident footer to the hero rather than more UI. */}
            <div className="hero-rise hero-rise-5 flex items-center justify-center divide-x divide-white/20 mt-6 max-w-sm mx-auto">
              {[
                { num: '100+', label: t.statDoctors },
                { num: '20+', label: t.statSpecializations },
                { num: '1000+', label: t.statAppointments },
              ].map((s, i) => (
                <div key={i} className="px-4 sm:px-6 text-center">
                  <div className="text-xl sm:text-2xl font-bold leading-none">{s.num}</div>
                  <div className="text-primary-200 text-[11px] sm:text-xs mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {!isAuthenticated && (
              <p className="hero-rise hero-rise-5 text-primary-100 text-xs sm:text-sm mt-6">
                {t.areYouDoctor}{' '}
                <Link to="/register?role=doctor" className="underline font-semibold hover:text-white">{t.joinLink}</Link>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ---- Doctors available today ---- Real faces + "available now" is the
           strongest "this platform is alive" trust signal. We only show
           doctors with a photo AND a genuine free slot today, and hide the
           whole section unless at least 3 qualify — so it always reads as
           populated and never exposes thin supply or placeholder icons.
           Gentle auto-scroll (reusing the testimonial keyframe) gives the
           "floating" feel; it pauses on hover and each card books that doctor. */}
      {availableDoctors.length >= 3 && (
        <section className="pt-8 pb-6 bg-white">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-2xl font-bold text-gray-800">{t.availNowHeading}</h2>
              <Link to="/doctors?availableToday=true" className="text-primary-600 text-sm font-medium hover:underline whitespace-nowrap">
                {t.browseAll}
              </Link>
            </div>
            <p className="text-gray-500 mb-5 text-sm">{t.availNowSub}</p>
          </div>

          {/* Edge-to-edge scroller. The inner track is duplicated so the
              auto-scroll loops seamlessly; it pauses on hover (see
              .animate-scroll in index.css) and respects reduced-motion. */}
          <div className="overflow-x-auto">
            <div className="flex gap-4 px-4 w-max animate-scroll">
              {[...availableDoctors, ...availableDoctors].map((doc, idx) => {
                const nextTime = (doc.nextAvailable?.timeSlot || '').split(' - ')[0];
                return (
                  <Link
                    key={`${doc._id}-${idx}`}
                    to={`/doctors/${doc._id}`}
                    onClick={() => trackEvent('find_doctor_click', { source: 'home_available_now', doctor_id: doc._id, specialization: doc.specialization || 'unknown' })}
                    className="card-lift flex-shrink-0 w-56 bg-white border border-gray-100 rounded-2xl shadow-sm p-4 text-center"
                    aria-hidden={idx >= availableDoctors.length ? 'true' : undefined}
                  >
                    <div className="relative inline-block">
                      <img
                        src={getUploadUrl(doc.profilePhoto, { width: 200 })}
                        alt={formatDoctorName(doc.name)}
                        className="w-20 h-20 rounded-full object-cover border-2 border-primary-100 mx-auto"
                        loading="lazy"
                      />
                      {/* Green "available now" dot — the big-platform cue, and
                          honest here because we already filtered to isToday. */}
                      <span className="absolute bottom-0 right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" title={t.availToday} />
                    </div>
                    <h3 className="mt-3 font-semibold text-gray-800 text-sm leading-snug flex items-center justify-center gap-1">
                      {formatDoctorName(doc.name)}
                      {doc.isAdminVerified && <VerifiedBadge size={14} />}
                    </h3>
                    <p className="text-primary-600 text-xs font-medium mt-0.5 truncate">{doc.specialization}</p>
                    {doc.rating && doc.rating.count > 0 && (
                      <p className="text-xs mt-1 text-gray-600">⭐ {doc.rating.average} <span className="text-gray-400">({doc.rating.count})</span></p>
                    )}
                    <p className="text-green-600 text-xs font-medium mt-1.5">🟢 {t.availToday}{nextTime ? ` · ${nextTime}` : ''}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

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

      {/* ---- Health Tip of the Day ---- rotates daily; a gentle nudge to
           read the free health content and come back for more. */}
      {dailyTip && (
        <section className="py-8 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <Link
                to={`/blog/${dailyTip.slug}`}
                onClick={() => trackEvent('daily_tip_click', { article_slug: dailyTip.slug })}
                className="group block bg-white border border-primary-100 rounded-2xl p-5 sm:p-6 hover:shadow-md hover:border-primary-300 transition-all"
              >
                <span className="inline-block bg-primary-50 text-primary-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">
                  {t.tipBadge}
                </span>
                <div className="flex items-start gap-4">
                  <div className="text-4xl sm:text-5xl flex-shrink-0">{dailyTip.image}</div>
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 group-hover:text-primary-700 transition-colors">
                      {dailyTip.title}
                    </h3>
                    <p className="text-gray-600 text-sm mt-1 line-clamp-2">{dailyTip.description}</p>
                    <span className="text-primary-600 text-sm font-medium mt-2 inline-block group-hover:underline">
                      {t.tipRead}
                    </span>
                  </div>
                </div>
              </Link>
              <div className="text-center mt-3">
                <Link to="/blog" className="text-primary-600 text-sm font-medium hover:underline">{t.tipMore}</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---- Share ProMedicoz ---- a prominent, friendly nudge for word-of-mouth
           growth. Leads with the honest value angle (verified doctors, fair fees,
           no commission). Styled to match the "Install like an app" card below
           so the two read as a consistent pair. */}
      <section className="py-8 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="text-4xl">📤</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-800">{t.shareHeading}</h3>
              <p className="text-gray-600 text-sm mt-0.5">{t.shareSub}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleShareSite}
                className="btn btn-success whitespace-nowrap"
              >
                {t.shareBtn}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ---- How It Works ---- */}
      <section className="py-12 bg-gray-50 bg-dotted">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-800">{t.howHeading}</h2>
            <span className="inline-block mt-2 mb-3 h-1 w-12 rounded-full bg-primary-500" aria-hidden="true"></span>
            <p className="text-gray-500 text-sm">{t.howSubtitle}</p>
          </div>

          {/* A dashed line runs behind the four cards on desktop so the steps
              read as a connected journey (1 → 2 → 3 → 4) rather than four
              loose tiles. The numbered badge overlaps the top of each card and
              fills with primary on hover, while the whole card lifts. */}
          <div className="relative max-w-4xl mx-auto">
            <div className="hidden lg:block absolute top-7 left-[12.5%] right-[12.5%] border-t-2 border-dashed border-primary-200" aria-hidden="true"></div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative">
              {[
                { step: 1, icon: '👤', to: '/register' },
                { step: 2, icon: '🔍', to: '/doctors' },
                { step: 3, icon: '📅', to: '/doctors' },
                { step: 4, icon: '✅', to: '/dashboard' },
              ].map(({ step, icon, to }) => {
                const s = t.steps[step - 1];
                return (
                <Link
                  key={step}
                  to={to}
                  className="group relative text-center pt-9 pb-5 px-4 mt-4 rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-primary-200"
                >
                  {/* Numbered badge sits half-over the top edge of the card */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-9 h-9 bg-white border-2 border-primary-200 text-primary-600 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-colors duration-200 group-hover:bg-primary-600 group-hover:text-white group-hover:border-primary-600">
                    {step}
                  </div>
                  <div className="text-3xl mb-2 transition-transform duration-200 group-hover:scale-110">{icon}</div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-1">{s.title}</h3>
                  <p className="text-gray-500 text-xs mb-2 leading-relaxed">{s.desc}</p>
                  <span className="inline-flex items-center gap-0.5 text-primary-600 text-xs font-semibold">
                    {s.cta.replace(/\s*→\s*$/, '')}
                    <span className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true">→</span>
                  </span>
                </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Testimonials ---- */}
      <section className="py-10 bg-white overflow-hidden">
        <div className="container mx-auto px-4 text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">{t.testimonialsHeading}</h2>
          <span className="inline-block mt-2 mb-2 h-1 w-12 rounded-full bg-primary-500" aria-hidden="true"></span>
          <p className="text-gray-500 text-sm">{t.testimonialsSubtitle}</p>
        </div>
        {(() => {
          // Build ONE list of real reviews to show: live reviews from the API
          // first, then the curated real reviews. Both are normalised to the
          // same { stars, text, name, meta } shape so a single card template
          // renders either. This is all genuine patient feedback, so it uses
          // the honest "What Our Patients Say" framing (no "sample" tag).
          const apiReviews = topReviews.map((r) => ({
            stars: Math.max(0, Math.min(5, Math.round(Number(r.rating) || 0))),
            text: r.comment,
            name: r.patient?.name || 'Patient',
            meta: r.doctor?.name ? `consulted Dr. ${r.doctor.name}` : 'Verified patient',
          }));
          const curated = CURATED_REVIEWS.map((r) => ({
            stars: r.stars, text: r.text, name: r.name, meta: r.spec,
          }));
          const realReviews = [...apiReviews, ...curated];

          // Generic placeholder experiences — only used as a cold-start safety
          // net if there are somehow no real reviews at all. Tagged as samples
          // so they're never passed off as genuine patient reviews.
          const samples = [
            { stars: 5, text: 'Very easy to book an appointment. The doctor was on time and professional.', name: 'Priya S.', meta: 'General Physician' },
            { stars: 5, text: 'Found a specialist within minutes and got confirmed the same day. Smooth experience.', name: 'Rahul M.', meta: 'Dermatologist' },
            { stars: 4, text: 'Convenient and simple. No more waiting on phone calls to book a doctor.', name: 'Anita K.', meta: 'Gynaecologist' },
          ];

          const showingReal = realReviews.length > 0;
          const list = showingReal ? realReviews : samples;
          // Duplicate the list so the marquee loop is seamless.
          const loop = [...list, ...list];

          return (
            <div className="relative">
              {!showingReal && (
                <p className="text-center text-[11px] uppercase tracking-wide text-gray-400 mb-4">Sample experiences</p>
              )}
              {/* Soft fade masks on the edges so cards slide in/out instead of
                  being hard-clipped at the screen edge. */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-12 z-10 bg-gradient-to-r from-white to-transparent" aria-hidden="true"></div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-12 z-10 bg-gradient-to-l from-white to-transparent" aria-hidden="true"></div>
              {/* Auto-scrolling marquee — faster variant (more cards than the
                  doctors strip) and pauses on hover. w-max + flex-nowrap keep
                  all cards in ONE long row (wider than the screen) so the
                  marquee actually scrolls through every review instead of the
                  flex row collapsing to viewport width and showing only a few. */}
              <div className="flex flex-nowrap w-max animate-scroll-fast gap-6 px-4">
                {loop.map((item, idx) => (
                  <div key={idx} className="min-w-[280px] max-w-[300px] bg-white border border-gray-100 rounded-2xl p-5 flex-shrink-0 shadow-sm transition-shadow duration-200 hover:shadow-md">
                    <div className="text-primary-200 text-3xl leading-none mb-1" aria-hidden="true">&ldquo;</div>
                    <div className="text-yellow-400 text-sm mb-2" aria-label={`${item.stars} out of 5 stars`}>{'⭐'.repeat(item.stars)}</div>
                    <p className="text-gray-700 text-sm leading-relaxed">{item.text}</p>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold uppercase shrink-0">{item.name?.charAt(0) || '?'}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-800 truncate">{item.name}</div>
                        <div className="text-xs text-gray-400 truncate">{item.meta}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </section>

      {/* ---- FAQs for Google "People Also Ask" ---- */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800">{t.faqHeading}</h2>
            <span className="inline-block mt-2 h-1 w-12 rounded-full bg-primary-500" aria-hidden="true"></span>
          </div>
          <div className="space-y-3">
            {t.faqs.map((faq, idx) => (
              // Each FAQ is a <details> card that lifts on hover and gets a
              // primary tint + ring when open. The chevron sits in a circular
              // badge that turns primary and rotates as it opens, so the whole
              // row clearly reads as an interactive accordion.
              <details
                key={idx}
                className="group bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary-200 open:border-primary-200 open:ring-1 open:ring-primary-100 open:bg-primary-50/30"
              >
                <summary className="font-semibold text-gray-800 cursor-pointer list-none flex justify-between items-center gap-4 group-open:text-primary-700">
                  <span className="flex items-start gap-2.5">
                    <span className="text-primary-500 shrink-0" aria-hidden="true">❓</span>
                    {faq.q}
                  </span>
                  <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-full bg-gray-100 text-gray-500 transition-all duration-200 group-hover:bg-primary-100 group-hover:text-primary-600 group-open:bg-primary-600 group-open:text-white group-open:rotate-180">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </summary>
                <p className="text-gray-600 text-sm mt-3 pl-7 leading-relaxed">{faq.a}</p>
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
            <div className="flex gap-2 flex-shrink-0">
              {canInstall ? (
                <button
                  onClick={promptInstall}
                  className="btn btn-primary whitespace-nowrap"
                >
                  {lang === 'hi' ? '📲 इंस्टॉल करें' : '📲 Install now'}
                </button>
              ) : (
                <Link
                  to="/install"
                  className="btn btn-primary whitespace-nowrap"
                >
                  {lang === 'hi' ? 'ऐप पाएं' : 'Get the App'}
                </Link>
              )}
              <Link
                to="/install"
                className="whitespace-nowrap bg-white text-primary-700 border border-primary-300 px-6 py-2.5 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
              >
                {lang === 'hi' ? '📤 साझा करें' : '📤 Share'}
              </Link>
            </div>
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
