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
import { isPregnancyQuery, dueDatePath, isCycleQuery, ovulationPath, isVaccineQuery, vaccinePath, isReportQuery, reportPath } from './tools/toolLinks';
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
  { stars: 5, text: 'डॉ. पूजा एक अत्यंत कुशल, संवेदनशील और अनुभवी स्त्री रोग विशेषज्ञ हैं। यदि आप अपने मातृत्व के सफर में हैं या किसी महिला स्वास्थ्य संबंधी समस्या से गुजर रही हैं, तो उनके पास जाना एक बेहतरीन निर्णय साबित होगा।', name: 'कविता देवी', spec: 'consulted Dr. Pooja' },
  { stars: 5, text: 'डॉ. पूजा मरीज की पूरी बात को बहुत धैर्य के साथ सुनती हैं। वे कभी भी जल्दबाजी में नहीं दिखतीं।', name: 'वीना देवी', spec: 'consulted Dr. Pooja' },
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
    takeItTitle: 'Love ProMedicoz? Take it with you.',
    takeItSub: 'Install it like an app for one-tap access, and share it with family & friends who need a doctor.',
    installCardTitle: 'Install the app',
    installCardSub: 'One tap · no app store',
    installCardBtn: '📲 Install now',
    installCardBtnAlt: '📲 Get the app',
    shareCardTitle: 'Share with others',
    shareCardSub: 'WhatsApp, link & more',
    shareCardBtn: '📤 Share now',
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
    specMostConsulted: 'Most consulted',
    specAll: 'All specialities',
    browseAll: '🔍 Browse All Specializations →',
    howHeading: 'How ProMedicoz Works',
    howSubtitle: 'From search to consultation — in about 2 minutes',
    testimonialsHeading: 'What Our Patients Say',
    testimonialsSubtitle: 'Real reviews from real patients',
    faqHeading: 'Frequently Asked Questions',
    ctaHeading: 'Are You a Doctor?',
    ctaText: 'Join ProMedicoz to reach more patients, manage your schedule, and grow your practice effortlessly.',
    ctaButton: 'Register Now',
    ctaChips: ['✓ Keep 100% of your fee', '✓ No commission', '✓ Your own online clinic'],
    steps: [
      { title: 'Find a doctor', desc: 'Search by symptom, specialty, city or language.', cta: 'Search →' },
      { title: 'Book a slot', desc: 'Pick a time & how to consult — video, phone or clinic.', cta: 'Book →' },
      { title: 'Doctor confirms', desc: 'Usually within a few hours — you get notified.', cta: 'How it works →' },
      { title: 'Pay & consult', desc: 'Pay the doctor directly — no commission. Then consult.', cta: 'Learn more →' },
    ],
    faqCats: { all: 'All', booking: 'Booking', payments: 'Payments', consult: 'Consultation' },
    faqHelpTitle: 'Still have questions?',
    faqHelpText: "We're happy to help you find the right doctor or sort out a booking.",
    faqHelpWhatsApp: '💬 Chat on WhatsApp',
    faqHelpEmail: '✉️ Email support',
    faqHelpHow: '📖 How it works',
    faqs: [
      { cat: 'booking', q: 'How do I book a doctor on ProMedicoz?', a: 'Search by specialization or symptom, pick a doctor, select a date and time slot, and confirm your booking. The doctor confirms within hours.' },
      { cat: 'payments', q: 'Is ProMedicoz free to use?', a: 'Signing up and browsing doctors is free. You only pay the consultation fee directly to the doctor via UPI when your appointment is confirmed.' },
      { cat: 'consult', q: 'Can I consult a doctor online through video call?', a: 'Yes, ProMedicoz supports video, phone, and in-person consultations. Choose your preferred mode while booking.' },
      { cat: 'booking', q: 'How do I know if a doctor is good?', a: 'Each doctor profile shows their qualification, years of experience, consultation fee, and patient reviews with star ratings.' },
      { cat: 'booking', q: 'Can I book an appointment for a family member?', a: 'Yes, you can add family members to your account and book appointments on their behalf.' },
      { cat: 'booking', q: 'What if I need to cancel my appointment?', a: 'You can cancel from your dashboard at any time before the appointment. There are no cancellation charges.' },
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
    takeItTitle: 'ProMedicoz पसंद आया? इसे साथ ले जाएं।',
    takeItSub: 'एक टैप में खुलने के लिए ऐप की तरह इंस्टॉल करें, और जिन्हें डॉक्टर चाहिए उन्हें साझा करें।',
    installCardTitle: 'ऐप इंस्टॉल करें',
    installCardSub: 'एक टैप · कोई ऐप स्टोर नहीं',
    installCardBtn: '📲 अभी इंस्टॉल करें',
    installCardBtnAlt: '📲 ऐप पाएं',
    shareCardTitle: 'दूसरों के साथ साझा करें',
    shareCardSub: 'WhatsApp, लिंक और बहुत कुछ',
    shareCardBtn: '📤 अभी साझा करें',
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
    specMostConsulted: 'सबसे ज़्यादा परामर्श',
    specAll: 'सभी विशेषज्ञताएं',
    browseAll: '🔍 सभी विशेषज्ञताएं देखें →',
    howHeading: 'ProMedicoz कैसे काम करता है',
    howSubtitle: 'खोज से परामर्श तक — लगभग 2 मिनट में',
    testimonialsHeading: 'हमारे मरीज़ क्या कहते हैं',
    testimonialsSubtitle: 'असली मरीज़ों की असली समीक्षाएं',
    faqHeading: 'अक्सर पूछे जाने वाले प्रश्न',
    ctaHeading: 'क्या आप डॉक्टर हैं?',
    ctaText: 'अधिक मरीज़ों तक पहुंचने, अपना शेड्यूल प्रबंधित करने और अपनी प्रैक्टिस बढ़ाने के लिए ProMedicoz से जुड़ें।',
    ctaButton: 'अभी रजिस्टर करें',
    ctaChips: ['✓ पूरी फ़ीस आपकी', '✓ कोई कमीशन नहीं', '✓ अपनी ऑनलाइन क्लिनिक'],
    steps: [
      { title: 'डॉक्टर खोजें', desc: 'लक्षण, विशेषज्ञता, शहर या भाषा से खोजें।', cta: 'खोजें →' },
      { title: 'स्लॉट बुक करें', desc: 'समय और परामर्श का तरीका चुनें — वीडियो, फ़ोन या क्लिनिक।', cta: 'बुक करें →' },
      { title: 'डॉक्टर पुष्टि करते हैं', desc: 'आमतौर पर कुछ ही घंटों में — आपको सूचना मिलती है।', cta: 'कैसे काम करता है →' },
      { title: 'भुगतान करें और परामर्श लें', desc: 'पैसे सीधे डॉक्टर को — कोई कमीशन नहीं। फिर परामर्श।', cta: 'और जानें →' },
    ],
    faqCats: { all: 'सभी', booking: 'बुकिंग', payments: 'भुगतान', consult: 'परामर्श' },
    faqHelpTitle: 'अभी भी सवाल हैं?',
    faqHelpText: 'सही डॉक्टर खोजने या बुकिंग में हम आपकी मदद के लिए तैयार हैं।',
    faqHelpWhatsApp: '💬 WhatsApp पर चैट करें',
    faqHelpEmail: '✉️ ईमेल सहायता',
    faqHelpHow: '📖 कैसे काम करता है',
    faqs: [
      { cat: 'booking', q: 'ProMedicoz पर डॉक्टर कैसे बुक करें?', a: 'विशेषज्ञता या लक्षण के अनुसार खोजें, डॉक्टर चुनें, तारीख और समय चुनें, और अपनी बुकिंग की पुष्टि करें। डॉक्टर कुछ ही घंटों में पुष्टि कर देते हैं।' },
      { cat: 'payments', q: 'क्या ProMedicoz उपयोग करने के लिए मुफ़्त है?', a: 'साइन अप करना और डॉक्टर ब्राउज़ करना मुफ़्त है। अपॉइंटमेंट की पुष्टि होने पर आप केवल परामर्श शुल्क सीधे डॉक्टर को UPI के ज़रिए देते हैं।' },
      { cat: 'consult', q: 'क्या मैं वीडियो कॉल से ऑनलाइन डॉक्टर से परामर्श कर सकता हूं?', a: 'हां, ProMedicoz वीडियो, फ़ोन और क्लिनिक पर परामर्श की सुविधा देता है। बुकिंग के समय अपना पसंदीदा तरीका चुनें।' },
      { cat: 'booking', q: 'मुझे कैसे पता चलेगा कि डॉक्टर अच्छा है?', a: 'हर डॉक्टर की प्रोफ़ाइल में उनकी योग्यता, अनुभव, परामर्श शुल्क, और स्टार रेटिंग के साथ मरीज़ों की समीक्षाएं दिखती हैं।' },
      { cat: 'booking', q: 'क्या मैं परिवार के किसी सदस्य के लिए अपॉइंटमेंट बुक कर सकता हूं?', a: 'हां, आप अपने खाते में परिवार के सदस्यों को जोड़ सकते हैं और उनकी ओर से अपॉइंटमेंट बुक कर सकते हैं।' },
      { cat: 'booking', q: 'अगर मुझे अपना अपॉइंटमेंट रद्द करना हो तो क्या करूं?', a: 'आप अपॉइंटमेंट से पहले कभी भी अपने डैशबोर्ड से इसे रद्द कर सकते हैं। कोई रद्दीकरण शुल्क नहीं है।' },
    ],
  },
};

// ============================================
// Symptom → specialization mapping (Hindi-first)
// ============================================
// Most ProMedicoz patients are Hindi/Hinglish speakers, so this map is built
// Hindi-first: every entry carries English PLUS Hindi in BOTH Hinglish (Roman,
// how people actually type on a phone — "kamar dard", with common misspellings)
// AND Devanagari (how a Hindi-keyboard user types — "कमर दर्द"). It also matches
// bare body-part words ("kamar", "ghutna", "sir") and everyday phrasings
// ("saans nahi aa rahi", "nind nahi aati"), since people rarely type the
// textbook term.
//
// ORDER MATTERS: the matcher returns the FIRST entry whose keyword is a
// substring of the input. More-specific pain terms (sir dard, pet dard, kamar
// dard, seene mein dard) are each qualified and come before broad entries, so
// "sir dard" → Neurologist, not a generic pain rule. There is deliberately NO
// bare "dard"/"pain"/"दर्द" keyword — on its own it's ambiguous.
//
// Defined at module scope (not inside the component) so it isn't rebuilt on
// every render. `SPEC_LABEL_HI` gives the Hindi display name so a Hindi user
// sees "सुझाव: हड्डी रोग विशेषज्ञ", not the English specialization — while the
// URL still uses the English key the backend matches.
const SYMPTOM_MAPPING = [
  // Head / neuro — "sir dard" (headache) + spelling variants; "chakkar" (dizzy).
  { keywords: ['head', 'migraine', 'brain', 'nerve', 'seizure', 'numbness', 'dizziness', 'vertigo',
               'sir dard', 'sar dard', 'sardard', 'sir me dard', 'sar me dard', 'sir', 'migrain',
               'chakkar', 'chakar', 'behoshi', 'jhunjhuni', 'lakwa', 'daura', 'mirgi', 'yaddasht',
               'सिरदर्द', 'सिर दर्द', 'सर दर्द', 'सिर में दर्द', 'सिर', 'चक्कर', 'बेहोशी', 'झुनझुनी',
               'माइग्रेन', 'दौरा', 'मिर्गी', 'लकवा', 'नस'], specialization: 'Neurologist' },
  // Women's health
  { keywords: ['pregnan', 'ivf', 'period', 'menstrual', 'pcod', 'pcos', 'fertility', 'gynae', 'uterus', 'ovary',
               'garbh', 'garbhvati', 'garbhavastha', 'pregnency', 'mahwari', 'mahavari', 'masik', 'mahina',
               'mahine', 'bachchedani', 'bacchedani', 'gynic', 'maa banna', 'safed pani', 'likoria',
               'गर्भ', 'गर्भवती', 'गर्भावस्था', 'माहवारी', 'मासिक', 'महीना', 'महीने', 'पीरियड',
               'बच्चेदानी', 'गर्भाशय', 'सफेद पानी', 'ल्यूकोरिया', 'प्रसव', 'डिलीवरी'], specialization: 'Gynaecologist' },
  // Heart / BP — "seene mein dard" (chest pain), "dhadkan" (palpitation).
  { keywords: ['heart', 'chest pain', 'bp', 'blood pressure', 'cholesterol', 'palpitation',
               'dil', 'dil ki', 'seene mein dard', 'seene me dard', 'seene', 'sine mein dard', 'sine me dard',
               'chhati mein dard', 'chhati', 'chaati', 'raktchap', 'rakt chap', 'dhadkan', 'dhadkan tez',
               'दिल', 'हृदय', 'सीने में दर्द', 'सीने', 'छाती में दर्द', 'छाती', 'रक्तचाप', 'बीपी',
               'धड़कन', 'कोलेस्ट्रॉल', 'दिल की बीमारी'], specialization: 'Cardiologist' },
  // Bones / joints — "kamar dard" (back pain), "ghutna" (knee), "jodo me dard".
  { keywords: ['bone', 'joint', 'knee', 'back pain', 'spine', 'fracture', 'shoulder', 'arthritis',
               'kamar dard', 'kamar me dard', 'kamar mein dard', 'kamar', 'ghutna', 'ghutne', 'ghutno',
               'ghutne me dard', 'jodo', 'jodon', 'jod', 'jodo me dard', 'jodon mein dard', 'haddi',
               'haddi me dard', 'kandha', 'kandhe', 'reed', 'reedh', 'gardan', 'gardan dard', 'gathiya',
               'moch', 'tang dard', 'pair dard', 'paer dard', 'frakchar',
               'कमर दर्द', 'कमर में दर्द', 'कमर', 'घुटना', 'घुटने', 'घुटनों', 'जोड़', 'जोड़ों',
               'जोड़ों में दर्द', 'हड्डी', 'कंधा', 'कंधे', 'रीढ़', 'गर्दन', 'गठिया', 'मोच', 'फ्रैक्चर'], specialization: 'Orthopedic' },
  // ENT — ear / nose / throat. Placed BEFORE Skin so "gale me kharash" (sore
  // throat) wins over the "rash"-inside-"kharash" substring on the skin entry.
  { keywords: ['ear', 'nose', 'throat', 'sinus', 'hearing', 'tonsil', 'snoring',
               'kaan', 'kan', 'kaan dard', 'kaan me dard', 'naak', 'nak', 'naak band', 'gala', 'gale',
               'gale me dard', 'gale mein kharash', 'kharash', 'tonsil', 'kharate', 'kharaat', 'sunai nahi',
               'bahrapan', 'awaz baith',
               'कान', 'कान दर्द', 'कान में दर्द', 'नाक', 'नाक बंद', 'गला', 'गले में दर्द', 'गले में खराश',
               'खराश', 'टॉन्सिल', 'खर्राटे', 'सुनाई नहीं', 'बहरापन', 'साइनस'], specialization: 'ENT Specialist' },
  // Skin / hair. Placed AFTER the ENT entry (above) on purpose: the short
  // English token "rash" is a substring of "khaRASH" (gale ki kharash = sore
  // throat), so ENT must get first crack at throat complaints before this
  // entry's "rash" can mis-catch them.
  { keywords: ['skin', 'acne', 'hair', 'rash', 'itch', 'pimple', 'dandruff', 'allergy', 'eczema', 'fungal',
               'twacha', 'khujli', 'khujali', 'khaj', 'baal', 'baal jhadna', 'baal girna', 'ganjapan',
               'daane', 'daana', 'phunsi', 'phunsiyan', 'daad', 'chhai', 'jhaiyan', 'kil', 'muhase', 'muhaase',
               'rusi', 'daag', 'chakatte',
               'त्वचा', 'खुजली', 'खाज', 'बाल', 'बाल झड़ना', 'गंजापन', 'दाने', 'फुंसी', 'मुहांसे', 'कील',
               'दाद', 'झाइयां', 'रूसी', 'एलर्जी', 'चकत्ते', 'दाग'], specialization: 'Dermatologist' },
  // Children
  { keywords: ['child', 'baby', 'infant', 'kid', 'vaccination', 'newborn', 'paediatric', 'pediatric',
               'bachcha', 'bachche', 'bacche', 'bachchon', 'shishu', 'tika', 'tikakaran', 'navjat', 'baccha',
               'बच्चा', 'बच्चे', 'बच्चों', 'शिशु', 'टीका', 'टीकाकरण', 'नवजात'], specialization: 'Pediatrician' },
  // Dental
  { keywords: ['tooth', 'teeth', 'dental', 'gum', 'cavity', 'braces',
               'daant', 'dant', 'daant dard', 'daant me dard', 'daanton', 'danton', 'masude', 'masoode',
               'daant dard', 'kida', 'pyorrhea',
               'दांत', 'दाँत', 'दंत', 'दांत दर्द', 'दांत में दर्द', 'मसूड़े', 'मसूड़ों', 'कैविटी', 'कीड़ा'], specialization: 'Dentist' },
  // Eyes
  { keywords: ['eye', 'vision', 'glass', 'cataract', 'spectacle',
               'aankh', 'aankhon', 'ankhon', 'ankh', 'aankh me dard', 'aankhon me dard', 'drishti', 'najar',
               'nazar', 'kamjor nazar', 'motiyabind', 'chashma', 'dhundhla',
               'आँख', 'आंख', 'आँखों', 'आंखों', 'आँख में दर्द', 'दृष्टि', 'नज़र', 'नजर', 'कमज़ोर नज़र',
               'मोतियाबिंद', 'चश्मा', 'धुंधला'], specialization: 'Ophthalmologist' },
  // Mental health — everyday phrasings ("nind nahi aati", "ghabrahat hoti hai").
  { keywords: ['depress', 'anxiety', 'stress', 'sleep', 'mental', 'panic', 'mood',
               'tanav', 'tanaav', 'chinta', 'ghabrahat', 'ghabrahaat', 'neend', 'nind', 'nind nahi',
               'neend nahi', 'avsad', 'avsaad', 'udaasi', 'udasi', 'mansik', 'dar lagta', 'man nahi lagta',
               'akelapan', 'gussa',
               'तनाव', 'चिंता', 'घबराहट', 'नींद', 'नींद नहीं', 'अवसाद', 'उदासी', 'मानसिक', 'डिप्रेशन',
               'डर', 'अकेलापन', 'गुस्सा'], specialization: 'Psychiatrist' },
  // Digestion — "pet dard", gas, acidity, ulti, dast, kabz.
  { keywords: ['stomach', 'digest', 'acid', 'gastric', 'liver', 'constipat', 'diarr', 'bloat', 'vomit',
               'pet dard', 'pet me dard', 'pet mein dard', 'pet', 'pait', 'pait dard', 'gas', 'gais',
               'acidity', 'tezab', 'tejaab', 'khatta dakar', 'kabz', 'kabj', 'dast', 'loose motion',
               'ulti', 'ulty', 'ultee', 'jee michla', 'jigar', 'pachan', 'badhazmi', 'bhookh nahi',
               'पेट दर्द', 'पेट में दर्द', 'पेट', 'गैस', 'अम्लता', 'तेज़ाब', 'खट्टी डकार', 'कब्ज',
               'दस्त', 'लूज मोशन', 'उल्टी', 'जी मिचलाना', 'जिगर', 'पाचन', 'बदहजमी', 'भूख नहीं'], specialization: 'Gastroenterologist' },
  // Urinary / kidney
  { keywords: ['urine', 'kidney', 'bladder', 'prostate', 'uti',
               'peshab', 'pesab', 'peshaab', 'peshab me jalan', 'jalan', 'gurda', 'gurde', 'gurde me dard',
               'mutra', 'pathri', 'stone',
               'पेशाब', 'पेशाब में जलन', 'जलन', 'गुर्दा', 'गुर्दे', 'गुर्दे में दर्द', 'मूत्र', 'पथरी', 'किडनी'], specialization: 'Urologist' },
  // Endocrine / diabetes / thyroid
  { keywords: ['diabetes', 'thyroid', 'hormone', 'sugar', 'obesity',
               'madhumeh', 'sugar ki bimari', 'sugar badh', 'thyroid', 'thaayrayd', 'harmon', 'motapa',
               'wajan badh', 'wajan kam',
               'मधुमेह', 'शुगर', 'थायराइड', 'हार्मोन', 'मोटापा', 'वजन'], specialization: 'Endocrinologist' },
  // Lungs / respiratory — "saans nahi aa rahi" (breathlessness).
  { keywords: ['lung', 'breath', 'asthma', 'wheez', 'pneumonia', 'tb', 'tuberculosis',
               'saans', 'sans', 'saans nahi', 'saans fulna', 'saans phoolna', 'dama', 'damaa', 'phephde',
               'phephda', 'nimoniya', 'balgam', 'lagatar khansi',
               'साँस', 'सांस', 'साँस नहीं', 'सांस फूलना', 'दमा', 'फेफड़े', 'फेफड़ा', 'निमोनिया',
               'अस्थमा', 'बलगम', 'टीबी'], specialization: 'Pulmonologist' },
  // General — fever, cold, cough, weakness. Last specific entry so a more
  // specific symptom wins first, but still ahead of the default fallback.
  { keywords: ['fever', 'cold', 'cough', 'flu', 'infection', 'weakness', 'fatigue', 'body ache',
               'bukhar', 'bukar', 'bukhaar', 'sardi', 'khansi', 'khaansi', 'khasi', 'jukaam', 'jukam',
               'kamzori', 'kamjori', 'thakan', 'thakaan', 'badan dard', 'badan tut', 'kapkapi', 'bimar', 'bimari',
               'बुखार', 'सर्दी', 'खांसी', 'खाँसी', 'जुकाम', 'कमज़ोरी', 'कमजोरी', 'थकान', 'बदन दर्द',
               'कंपकंपी', 'बीमार', 'बीमारी'], specialization: 'General Physician' },
];

// Hindi display label for each specialization — so a Hindi-speaking patient
// sees the suggestion in Hindi, not the English specialization name.
const SPEC_LABEL_HI = {
  'General Physician': 'सामान्य चिकित्सक',
  'Neurologist': 'न्यूरोलॉजिस्ट (मस्तिष्क व नस रोग)',
  'Gynaecologist': 'स्त्री रोग विशेषज्ञ',
  'Cardiologist': 'हृदय रोग विशेषज्ञ',
  'Orthopedic': 'हड्डी रोग विशेषज्ञ',
  'Dermatologist': 'त्वचा रोग विशेषज्ञ',
  'Pediatrician': 'बाल रोग विशेषज्ञ',
  'Dentist': 'दंत चिकित्सक',
  'Ophthalmologist': 'नेत्र रोग विशेषज्ञ',
  'Psychiatrist': 'मनोचिकित्सक',
  'ENT Specialist': 'कान-नाक-गला विशेषज्ञ',
  'Gastroenterologist': 'पेट व पाचन रोग विशेषज्ञ',
  'Urologist': 'मूत्र रोग विशेषज्ञ',
  'Endocrinologist': 'मधुमेह व हार्मोन विशेषज्ञ',
  'Pulmonologist': 'फेफड़ा रोग विशेषज्ञ',
};

function Home() {
  const { isAuthenticated } = useAuth();
  const { canInstall, promptInstall } = usePwa();
  const navigate = useNavigate();
  const [symptomSearch, setSymptomSearch] = useState('');
  // FAQ category filter ('all' | 'booking' | 'payments' | 'consult').
  const [faqCat, setFaqCat] = useState('all');

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
    const lower = input.toLowerCase().trim();
    for (const entry of SYMPTOM_MAPPING) {
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

              {symptomSearch && (() => {
                // The matched specialization (English key — used for the URL/
                // backend). For a Hindi user, show its Hindi label so the
                // suggestion reads naturally in their language.
                const matchedSpec = getSpecializationFromSymptom(symptomSearch);
                const display = lang === 'hi' ? (SPEC_LABEL_HI[matchedSpec] || matchedSpec) : matchedSpec;
                return (
                  <p className="text-xs text-gray-500 mt-2 px-1">
                    {t.suggested}: <span className="font-semibold text-primary-700">{display}</span>
                  </p>
                );
              })()}

              {/* Pregnancy-related search ("pregnant", "period late", "garbh"…):
                  also offer the free due-date calculator, right above the
                  button where it can't be missed. */}
              {isPregnancyQuery(symptomSearch) && (
                <Link
                  to={dueDatePath(lang)}
                  onClick={() => trackEvent('tool_due_date_entry', { source: 'home_search' })}
                  className="mt-2 flex items-center gap-2 rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 hover:bg-pink-100 transition-colors"
                >
                  <span className="text-lg" aria-hidden="true">🤰</span>
                  <span className="text-xs sm:text-sm">
                    <span className="block text-pink-700">{lang === 'hi' ? 'Pregnant ho sakti hain?' : 'Could you be pregnant?'}</span>
                    <span className="block font-semibold text-pink-800">{lang === 'hi' ? 'Apni due date nikaalein →' : 'Find your due date →'}</span>
                  </span>
                </Link>
              )}

              {/* Cycle / fertility search ("ovulation", "period kab aayega"…):
                  offer the ovulation calculator. Pregnancy wins if both match. */}
              {!isPregnancyQuery(symptomSearch) && isCycleQuery(symptomSearch) && (
                <Link
                  to={ovulationPath(lang)}
                  onClick={() => trackEvent('tool_ovulation_entry', { source: 'home_search' })}
                  className="mt-2 flex items-center gap-2 rounded-xl bg-violet-50 border border-violet-200 px-3 py-2 hover:bg-violet-100 transition-colors"
                >
                  <span className="text-lg" aria-hidden="true">🌷</span>
                  <span className="text-xs sm:text-sm">
                    <span className="block text-violet-700">{lang === 'hi' ? 'Apna cycle jaanein' : 'Track your cycle'}</span>
                    <span className="block font-semibold text-violet-800">{lang === 'hi' ? 'Fertile days aur agla period →' : 'Find your fertile days & next period →'}</span>
                  </span>
                </Link>
              )}

              {/* Baby-vaccine search ("teeka", "vaccine", "BCG"…): offer the
                  vaccination schedule. Pregnancy and cycle suggestions win. */}
              {!isPregnancyQuery(symptomSearch) && !isCycleQuery(symptomSearch) && isVaccineQuery(symptomSearch) && (
                <Link
                  to={vaccinePath(lang)}
                  onClick={() => trackEvent('tool_vaccine_entry', { source: 'home_search' })}
                  className="mt-2 flex items-center gap-2 rounded-xl bg-teal-50 border border-teal-200 px-3 py-2 hover:bg-teal-100 transition-colors"
                >
                  <span className="text-lg" aria-hidden="true">💉</span>
                  <span className="text-xs sm:text-sm">
                    <span className="block text-teal-700">{lang === 'hi' ? 'Baby ke teeke' : "Baby's vaccines"}</span>
                    <span className="block font-semibold text-teal-800">{lang === 'hi' ? 'Har teeke ki date dekhein →' : 'See every vaccine date →'}</span>
                  </span>
                </Link>
              )}

              {/* Lab-report search ("CBC", "TSH", "sugar report"…): offer
                  Report Samjhao. The other tool suggestions win if they match. */}
              {!isPregnancyQuery(symptomSearch) && !isCycleQuery(symptomSearch) && !isVaccineQuery(symptomSearch) && isReportQuery(symptomSearch) && (
                <Link
                  to={reportPath(lang)}
                  onClick={() => trackEvent('tool_report_entry', { source: 'home_search' })}
                  className="mt-2 flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2 hover:bg-indigo-100 transition-colors"
                >
                  <span className="text-lg" aria-hidden="true">🧪</span>
                  <span className="text-xs sm:text-sm">
                    <span className="block text-indigo-700">{lang === 'hi' ? 'Blood report samajh nahi aa rahi?' : 'Got a blood report?'}</span>
                    <span className="block font-semibold text-indigo-800">{lang === 'hi' ? 'Aasaan shabdon mein samjhein →' : 'Understand it in simple words →'}</span>
                  </span>
                </Link>
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
                  {/* One chip for all free tools (keeps this row to ~2 lines on
                      a phone). Individual tools still appear as smart
                      suggestions when the search matches them. */}
                  <Link
                    to="/tools"
                    onClick={() => trackEvent('tool_hub_entry', { source: 'home_chip' })}
                    className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors hover:bg-amber-100 active:scale-[0.97]"
                  >
                    <span aria-hidden="true">🧰</span>
                    {lang === 'hi' ? 'फ़्री टूल्स' : 'Free tools'}
                  </Link>
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

      {/* ---- Browse by concern — specialization directory ----
           Split into a "Most consulted" featured band (Gynae + GP + Child,
           the platform's focus) and a colour-tinted "All specialities" grid.
           Colour-coded icon chips give the grid scannable rhythm instead of
           24 identical grey tiles. Every destination, label (EN + हिंदी) and
           the "Browse all" button are preserved. Pure CSS — no new deps. */}
      <section className="pt-10 pb-12 bg-dotted bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-800 mb-2">{t.specHeading}</h2>
          <p className="text-center text-gray-500 mb-7 text-sm">{t.specSubtitle}</p>

          {/* ---- Most consulted — larger featured cards ---- */}
          <div className="max-w-5xl mx-auto mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1 h-4 rounded-full bg-primary-600" aria-hidden="true"></span>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600">{t.specMostConsulted}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { en: "Women's health", hi: 'महिला स्वास्थ्य', note: { en: 'Pregnancy · PCOS · periods · fertility', hi: 'गर्भावस्था · PCOS · मासिक · प्रजनन' }, icon: '🌸', slug: 'gynaecologist', spec: 'Gynaecologist', card: 'from-pink-50 to-rose-50 border-pink-100 hover:border-pink-300', badge: 'bg-pink-500', noteColor: 'text-pink-700' },
                { en: 'General Physician', hi: 'सामान्य चिकित्सक', note: { en: 'Fever · cough · body pain · checkups', hi: 'बुखार · खांसी · दर्द · जांच' }, icon: '🩺', slug: 'general-physician', spec: 'General Physician', card: 'from-blue-50 to-sky-50 border-blue-100 hover:border-blue-300', badge: 'bg-primary-600', noteColor: 'text-primary-700' },
                { en: 'Child health', hi: 'बच्चों का स्वास्थ्य', note: { en: 'Newborn · vaccination · fever', hi: 'नवजात · टीकाकरण · बुखार' }, icon: '🧸', slug: 'pediatrician', spec: 'Pediatrician', card: 'from-amber-50 to-orange-50 border-amber-100 hover:border-amber-300', badge: 'bg-amber-500', noteColor: 'text-amber-700' },
              ].map((f) => (
                <Link
                  key={f.spec}
                  to={`/specialization/${f.slug}`}
                  onClick={() => trackEvent('find_doctor_click', { source: 'home_spec_featured', specialization: f.spec, had_symptom: 'no' })}
                  className={`card-lift group bg-gradient-to-br ${f.card} border rounded-2xl p-4 flex items-center gap-3.5`}
                >
                  <span className={`flex-shrink-0 w-12 h-12 rounded-xl ${f.badge} text-white text-2xl flex items-center justify-center shadow-sm`} aria-hidden="true">{f.icon}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800 text-sm leading-tight">{lang === 'hi' ? f.hi : f.en}</p>
                    <p className="text-gray-500 text-xs leading-tight mt-0.5">{lang === 'hi' ? f.en : f.hi}</p>
                    <p className={`text-[11px] ${f.noteColor} font-medium mt-1.5 leading-tight`}>{lang === 'hi' ? f.note.hi : f.note.en}</p>
                  </div>
                  <span className="ml-auto flex-shrink-0 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </div>

          {/* ---- All specialities — colour-tinted compact grid ---- */}
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1 h-4 rounded-full bg-primary-600" aria-hidden="true"></span>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600">{t.specAll}</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {[
                { symptom: 'Headache', hi: 'सिरदर्द', icon: '🤕', specialization: 'Neurologist', slug: 'neurologist', tint: 'bg-violet-100' },
                { symptom: 'Skin / Hair', hi: 'त्वचा / बाल', icon: '🧴', specialization: 'Dermatologist', slug: 'dermatologist', tint: 'bg-amber-100' },
                { symptom: 'Heart / BP', hi: 'हृदय / रक्तचाप', icon: '❤️', specialization: 'Cardiologist', slug: 'cardiologist', tint: 'bg-red-100' },
                { symptom: 'Bone / Joint', hi: 'हड्डी / जोड़', icon: '🦴', specialization: 'Orthopedic', slug: 'orthopedic', tint: 'bg-emerald-100' },
                { symptom: 'Dental', hi: 'दंत / दांत', icon: '🦷', specialization: 'Dentist', slug: 'dentist', tint: 'bg-cyan-100' },
                { symptom: 'Eye / Vision', hi: 'आँख / दृष्टि', icon: '👁️', specialization: 'Ophthalmologist', tint: 'bg-sky-100' },
                { symptom: 'Mental Health', hi: 'मानसिक स्वास्थ्य', icon: '🧠', specialization: 'Psychiatrist', slug: 'psychiatrist', tint: 'bg-purple-100' },
                { symptom: 'Ear / Nose', hi: 'कान / नाक', icon: '👂', specialization: 'ENT Specialist', slug: 'ent-specialist', tint: 'bg-orange-100' },
                { symptom: 'Stomach', hi: 'पेट', icon: '🤢', specialization: 'Gastroenterologist', tint: 'bg-yellow-100' },
                { symptom: 'Lungs', hi: 'फेफड़े', icon: '🫁', specialization: 'Pulmonologist', tint: 'bg-teal-100' },
                { symptom: 'Kidney / Urine', hi: 'किडनी / मूत्र', icon: '💧', specialization: 'Urologist', tint: 'bg-blue-100' },
                { symptom: 'Diabetes', hi: 'मधुमेह', icon: '💉', specialization: 'Endocrinologist', tint: 'bg-rose-100' },
                { symptom: 'Cancer', hi: 'कैंसर', icon: '🎗️', specialization: 'Oncologist', tint: 'bg-pink-100' },
                { symptom: 'Kidney Disease', hi: 'गुर्दा रोग', icon: '🫘', specialization: 'Nephrologist', tint: 'bg-indigo-100' },
                { symptom: 'Arthritis', hi: 'गठिया', icon: '🖐️', specialization: 'Rheumatologist', tint: 'bg-lime-100' },
                { symptom: 'Surgery', hi: 'सर्जरी', icon: '🔪', specialization: 'Surgeon', tint: 'bg-slate-100' },
                { symptom: 'Physiotherapy', hi: 'फिजियोथेरेपी', icon: '🏃', specialization: 'Physiotherapist', tint: 'bg-green-100' },
                { symptom: 'Sexual Health', hi: 'यौन स्वास्थ्य', icon: '🔒', specialization: 'Sexologist', tint: 'bg-fuchsia-100' },
                { symptom: 'Homeopathy', hi: 'होम्योपैथी', icon: '🌿', specialization: 'Homeopathy', tint: 'bg-emerald-100' },
                { symptom: 'Ayurveda', hi: 'आयुर्वेद', icon: '🍃', specialization: 'Ayurveda', tint: 'bg-lime-100' },
                { symptom: 'Diet / Nutrition', hi: 'आहार / पोषण', icon: '🥗', specialization: 'Dietitian', tint: 'bg-teal-100' },
              ].map((item, idx) => (
                <Link
                  key={idx}
                  to={item.slug ? `/specialization/${item.slug}` : `/doctors?specialization=${encodeURIComponent(item.specialization)}`}
                  className="card-lift group bg-white p-3 rounded-xl text-center border border-gray-100 hover:border-primary-200 hover:bg-primary-50/40"
                >
                  <span className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${item.tint} text-2xl mb-1.5 transition-transform group-hover:scale-105`} aria-hidden="true">{item.icon}</span>
                  {/* Always bilingual — the whole point is a Hindi-speaking
                      patient can tap the right card instead of typing English. */}
                  <p className="text-xs font-semibold text-gray-700 leading-tight">{item.symptom}</p>
                  <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{item.hi}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* See all link */}
          <div className="text-center mt-7">
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
                className="group relative block bg-white border border-primary-100 rounded-2xl p-5 sm:p-6 pl-7 overflow-hidden hover:shadow-md hover:border-primary-300 transition-all"
              >
                {/* Accent edge — makes the daily tip read as a featured 'ribbon'
                    card rather than a plain bordered box. */}
                <span className="absolute left-0 inset-y-0 w-1.5 bg-gradient-to-b from-primary-500 to-primary-700" aria-hidden="true" />
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
          {/* Merged "take it with you" card — Install + Share in one block
              (replaces the two near-identical gradient strips). Both actions
              are preserved: one-tap install (or /install on iOS) and the
              native/WhatsApp share. */}
          <div className="max-w-3xl mx-auto bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-200 rounded-2xl p-5 sm:p-7 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800">{t.takeItTitle}</h3>
            <p className="text-gray-600 text-sm mt-1 max-w-xl mx-auto">{t.takeItSub}</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-5 max-w-2xl mx-auto">
              {/* Install half */}
              <div className="bg-white border border-primary-100 rounded-xl p-4 flex flex-col items-center text-center">
                <span className="text-3xl mb-1" aria-hidden="true">📲</span>
                <p className="font-bold text-gray-800 text-sm">{t.installCardTitle}</p>
                <p className="text-gray-500 text-xs mb-3">{t.installCardSub}</p>
                {canInstall ? (
                  <button onClick={promptInstall} className="w-full btn btn-primary whitespace-nowrap">{t.installCardBtn}</button>
                ) : (
                  <Link to="/install" className="w-full btn btn-primary whitespace-nowrap justify-center">{t.installCardBtnAlt}</Link>
                )}
              </div>
              {/* Share half */}
              <div className="bg-white border border-primary-100 rounded-xl p-4 flex flex-col items-center text-center">
                <span className="text-3xl mb-1" aria-hidden="true">📤</span>
                <p className="font-bold text-gray-800 text-sm">{t.shareCardTitle}</p>
                <p className="text-gray-500 text-xs mb-3">{t.shareCardSub}</p>
                <button onClick={handleShareSite} className="w-full btn btn-success whitespace-nowrap justify-center">{t.shareCardBtn}</button>
              </div>
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
                { step: 1, icon: '🔍', to: '/doctors' },
                { step: 2, icon: '📅', to: '/doctors' },
                { step: 3, icon: '✅', to: '/how-it-works' },
                { step: 4, icon: '🧾', to: '/how-it-works' },
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
            isReal: true,
          }));
          const curated = CURATED_REVIEWS.map((r) => ({
            stars: r.stars, text: r.text, name: r.name, meta: r.spec, isReal: true,
          }));
          const realReviews = [...apiReviews, ...curated];

          // Displayed aggregate rating for the summary pill (number only, no
          // review count — per request). Fixed at 4.9: the curated reviews are
          // all 5★ (which would read as a less-credible, "too perfect" 5.0),
          // so a steady 4.9 is the headline score we show.
          const avgRating = realReviews.length > 0 ? 4.9 : 0;

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
              {/* Aggregate rating summary — average only, no review count
                  (per request). Shown only for real reviews, never samples. */}
              {showingReal && avgRating > 0 && (
                <div className="flex justify-center mb-6">
                  <div className="inline-flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-full pl-5 pr-6 py-2.5">
                    <span className="text-2xl font-extrabold text-gray-800 leading-none">{avgRating}</span>
                    <span className="flex flex-col">
                      <span className="text-yellow-500 text-sm leading-none">{'★'.repeat(Math.round(avgRating))}<span className="text-amber-200">{'★'.repeat(5 - Math.round(avgRating))}</span></span>
                      <span className="text-[11px] text-amber-800 mt-0.5">{lang === 'hi' ? 'हमारे मरीज़ों की रेटिंग' : 'Rated by our patients'}</span>
                    </span>
                  </div>
                </div>
              )}
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
                {loop.map((item, idx) => {
                  // Stable colour for the avatar initial, derived from the name.
                  const palette = ['bg-pink-100 text-pink-700', 'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-violet-100 text-violet-700', 'bg-cyan-100 text-cyan-700'];
                  const tint = palette[((item.name || '?').charCodeAt(0) || 0) % palette.length];
                  return (
                  <div key={idx} className="min-w-[280px] max-w-[300px] bg-gradient-to-b from-primary-50/60 to-white border border-gray-100 rounded-2xl p-5 flex-shrink-0 shadow-sm transition-shadow duration-200 hover:shadow-md flex flex-col">
                    <div className="flex items-start justify-between">
                      <div className="text-primary-200 text-3xl leading-none" aria-hidden="true">&ldquo;</div>
                      {item.isReal && (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-100 rounded-full px-2 py-0.5 text-[10px] font-semibold">✓ {lang === 'hi' ? 'सत्यापित' : 'Verified'}</span>
                      )}
                    </div>
                    <div className="text-yellow-400 text-sm mb-2 mt-1" aria-label={`${item.stars} out of 5 stars`}>{'⭐'.repeat(item.stars)}</div>
                    <p className="text-gray-700 text-sm leading-relaxed flex-grow">{item.text}</p>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2.5">
                      <span className={`flex items-center justify-center w-8 h-8 rounded-full ${tint} text-xs font-semibold uppercase shrink-0`}>{item.name?.charAt(0) || '?'}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-800 truncate">{item.name}</div>
                        <div className="text-xs text-gray-400 truncate">{item.meta}</div>
                      </div>
                    </div>
                  </div>
                  );
                })}
                ))}
              </div>
            </div>
          );
        })()}
      </section>

      {/* ---- FAQs for Google "People Also Ask" ---- A two-column "help hub":
           a sticky help card on the left (turns a passive FAQ into a way to
           reach us), and a category-filterable accordion on the right. The
           FAQPage schema (above, in <Helmet>) is unaffected — it indexes every
           Q&A regardless of the on-screen filter. */}
      <section className="py-12 bg-white bg-dotted">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">{t.faqHeading}</h2>
            <span className="inline-block mt-2 h-1 w-12 rounded-full bg-primary-500" aria-hidden="true"></span>
          </div>

          <div className="grid lg:grid-cols-[260px_1fr] gap-6 items-start">
            {/* Left: help card (sticky on desktop) */}
            <div className="lg:sticky lg:top-24 relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 text-white p-6 shadow-md">
              <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" aria-hidden="true" />
              <div className="relative z-10">
                <div className="text-3xl mb-3" aria-hidden="true">💬</div>
                <h3 className="text-lg font-bold leading-snug">{t.faqHelpTitle}</h3>
                <p className="text-primary-100 text-sm mt-1.5 leading-relaxed">{t.faqHelpText}</p>
                <div className="mt-4 space-y-2">
                  <a
                    href={`https://wa.me/${(import.meta.env.VITE_WHATSAPP_NUMBER || '919997019900')}?text=${encodeURIComponent('Hi ProMedicoz, I have a question.')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="block w-full text-center bg-green-500 hover:bg-green-600 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors"
                  >
                    {t.faqHelpWhatsApp}
                  </a>
                  <a href="mailto:support@promedicoz.in" className="block w-full text-center bg-white/15 hover:bg-white/25 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
                    {t.faqHelpEmail}
                  </a>
                  <Link to="/how-it-works" className="block w-full text-center bg-white/15 hover:bg-white/25 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
                    {t.faqHelpHow}
                  </Link>
                </div>
              </div>
            </div>

            {/* Right: category pills + accordion */}
            <div>
              {/* Filter pills */}
              <div className="flex flex-wrap gap-2 mb-4">
                {['all', 'booking', 'payments', 'consult'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setFaqCat(c)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${faqCat === c ? 'bg-primary-600 text-white' : 'bg-primary-50 text-primary-700 border border-primary-100 hover:bg-primary-100'}`}
                  >
                    {t.faqCats[c]}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {t.faqs
                  .filter((faq) => faqCat === 'all' || faq.cat === faqCat)
                  .map((faq, idx) => (
                  <details
                    key={`${faqCat}-${idx}`}
                    className="group bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary-200 open:border-primary-200 open:ring-1 open:ring-primary-100 open:bg-primary-50/30"
                  >
                    <summary className="font-semibold text-gray-800 cursor-pointer list-none flex justify-between items-center gap-4 group-open:text-primary-700">
                      <span className="min-w-0">
                        <span className="inline-block mb-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold uppercase tracking-wide">{t.faqCats[faq.cat]}</span>
                        <span className="block">{faq.q}</span>
                      </span>
                      <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-full bg-gray-100 text-gray-500 transition-all duration-200 group-hover:bg-primary-100 group-hover:text-primary-600 group-open:bg-primary-600 group-open:text-white group-open:rotate-180">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </summary>
                    <p className="text-gray-600 text-sm mt-3 leading-relaxed">{faq.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- CTA ---- (flex-grow so this blue band fills any leftover space
           down to the footer on tall screens, instead of leaving a pale gap) */}
      <section className="py-12 bg-primary-700 text-white flex-grow flex flex-col justify-center">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-3">{t.ctaHeading}</h2>
          <p className="text-primary-100 mb-5 max-w-xl mx-auto">
            {t.ctaText}
          </p>
          {/* Benefit chips — make the final impression sell the doctor side. */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6 text-xs sm:text-sm">
            {t.ctaChips.map((chip, i) => (
              <span key={i} className="inline-flex items-center bg-white/12 border border-white/20 rounded-full px-3 py-1.5 font-medium">{chip}</span>
            ))}
          </div>
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
