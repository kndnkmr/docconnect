// ============================================
// Doctor List Page - Browse & Search Doctors
// ============================================
// Patients use this page to find doctors by name or specialization.
//
// KEY CONCEPTS:
// - useEffect: fetch data when page loads
// - Search/filter: update results as user types
// - Pagination: load results page by page
// - Card layout: display each doctor as a card
// - Debounce-like behavior: search on submit (not every keystroke)

import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { doctorAPI, getUploadUrl } from '../services/api';
import SEO from '../components/SEO';
import VerifiedBadge from '../components/VerifiedBadge';
import { SPOKEN_LANGUAGE_OPTIONS } from '../utils/languages';
import { formatDoctorName } from '../utils/formatName';
import toast from 'react-hot-toast';

// Patient-facing page → bilingual (English / हिंदी) for the fixed UI labels,
// using the shared 'promedicoz_lang' choice. Doctor-entered content (names,
// specializations, cities, bios) is shown as-is and never translated.
const TXT = {
  en: {
    headerTitle: 'Find a Doctor',
    headerSubtitle: (n) => `Browse our network of ${n} verified doctor${n === 1 ? '' : 's'} — book by video, phone, or in person`,
    specialization: 'Specialization', specializationPh: 'e.g., Gynaecologist, Cardiologist...',
    doctorName: 'Doctor Name', doctorNamePh: 'Search by name...',
    maxFee: 'Max Fee (₹)', maxFeePh: 'e.g., 500',
    city: 'City', cityPh: 'e.g., Delhi, Mumbai',
    consultation: 'Consultation', allTypes: 'All Types',
    inPerson: '🏥 In-Person', video: '📹 Video Call', phone: '📞 Phone Call',
    language: 'Language', anyLanguage: 'Any Language',
    availableToday: 'Available Today', search: 'Search',
    loading: 'Loading doctors...', noMatches: 'No matches found',
    yearsExp: (y) => `${y} years experience`,
    reviews: (c) => `(${c} review${c > 1 ? 's' : ''})`,
    nextAt: (time) => `Next available at ${time}`,
    nextTomorrow: (time) => `Next available tomorrow at ${time}`,
    nextDay: (day, time) => `Next available ${day} at ${time}`,
    noUpcoming: 'No upcoming availability',
    newDoctor: '🆕 New on ProMedicoz',
    speaks: 'Speaks', viewProfile: 'View Profile →',
    prev: 'Previous', next: 'Next', pageOf: (c, tot) => `Page ${c} of ${tot}`,
    noResultsTitle: (s) => s ? `No ${s} available yet` : 'No doctors found',
    noResultsMsgSpec: (s) => `We're actively adding doctors. Tell us what you need and we'll help you find a ${s || 'specialist'} — often within a day.`,
    noResultsMsgGeneric: 'Try adjusting your search, or let us help you find the right doctor.',
    cantFind: "Can't find the right doctor? We'll find one for you.",
    chatWhatsApp: '💬 Chat with us on WhatsApp',
    chatHint: "Tell us your concern — we'll connect you with the right specialist",
    browseAll: '← Browse all available doctors',
  },
  hi: {
    headerTitle: 'डॉक्टर खोजें',
    headerSubtitle: (n) => `हमारे ${n} सत्यापित डॉक्टर${n === 1 ? '' : 'ों'} में से चुनें — वीडियो, फ़ोन या क्लिनिक पर बुक करें`,
    specialization: 'विशेषज्ञता', specializationPh: 'जैसे: स्त्री रोग विशेषज्ञ, हृदय रोग विशेषज्ञ...',
    doctorName: 'डॉक्टर का नाम', doctorNamePh: 'नाम से खोजें...',
    maxFee: 'अधिकतम शुल्क (₹)', maxFeePh: 'जैसे: 500',
    city: 'शहर', cityPh: 'जैसे: दिल्ली, मुंबई',
    consultation: 'परामर्श', allTypes: 'सभी प्रकार',
    inPerson: '🏥 क्लिनिक पर', video: '📹 वीडियो कॉल', phone: '📞 फ़ोन कॉल',
    language: 'भाषा', anyLanguage: 'कोई भी भाषा',
    availableToday: 'आज उपलब्ध', search: 'खोजें',
    loading: 'डॉक्टर लोड हो रहे हैं...', noMatches: 'कोई मिलान नहीं मिला',
    yearsExp: (y) => `${y} वर्ष का अनुभव`,
    reviews: (c) => `(${c} समीक्षा${c > 1 ? 'एं' : ''})`,
    nextAt: (time) => `अगली उपलब्धता ${time} बजे`,
    nextTomorrow: (time) => `अगली उपलब्धता कल ${time} बजे`,
    nextDay: (day, time) => `अगली उपलब्धता ${day} को ${time} बजे`,
    noUpcoming: 'आगे कोई उपलब्धता नहीं',
    newDoctor: '🆕 ProMedicoz पर नया',
    speaks: 'बोलते हैं', viewProfile: 'प्रोफ़ाइल देखें →',
    prev: 'पिछला', next: 'अगला', pageOf: (c, tot) => `पृष्ठ ${c} / ${tot}`,
    noResultsTitle: (s) => s ? `अभी कोई ${s} उपलब्ध नहीं` : 'कोई डॉक्टर नहीं मिला',
    noResultsMsgSpec: (s) => `हम लगातार डॉक्टर जोड़ रहे हैं। हमें बताएं आपको क्या चाहिए, हम आपको ${s || 'विशेषज्ञ'} खोजने में मदद करेंगे — अक्सर एक दिन के भीतर।`,
    noResultsMsgGeneric: 'अपनी खोज बदलकर देखें, या सही डॉक्टर खोजने में हमसे मदद लें।',
    cantFind: 'सही डॉक्टर नहीं मिल रहा? हम आपके लिए खोज देंगे।',
    chatWhatsApp: '💬 WhatsApp पर हमसे बात करें',
    chatHint: 'हमें अपनी समस्या बताएं — हम आपको सही विशेषज्ञ से जोड़ेंगे',
    browseAll: '← सभी उपलब्ध डॉक्टर देखें',
  },
};

function DoctorList() {
  // Read specialization from URL query params (from Consult Now section)
  const [searchParams] = useSearchParams();
  const urlSpecialization = searchParams.get('specialization') || '';
  const [lang] = useState(() => localStorage.getItem('promedicoz_lang') || 'en');
  const t = TXT[lang];

  // ---- State ----
  const [doctors, setDoctors] = useState([]);
  // Array of doctor objects from the API

  const [loading, setLoading] = useState(true);
  // Show loading spinner while fetching

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalDoctors: 0
  });

  // Search/filter state
  const [searchName, setSearchName] = useState('');
  const [searchSpecialization, setSearchSpecialization] = useState(urlSpecialization);
  const [maxFee, setMaxFee] = useState('');
  const [availableToday, setAvailableToday] = useState(false);
  const [city, setCity] = useState('');
  const [consultationMode, setConsultationMode] = useState('');
  const [language, setLanguage] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // List of common specializations (for smart suggestions)
  const specializations = [
    'Gynaecologist', 'Neurologist', 'Cardiologist', 'Dermatologist',
    'Orthopedic', 'Pediatrician', 'Psychiatrist', 'Ophthalmologist',
    'ENT Specialist', 'Dentist', 'General Physician', 'Urologist',
    'Gastroenterologist', 'Pulmonologist', 'Endocrinologist',
    'Oncologist', 'Nephrologist', 'Rheumatologist', 'Surgeon',
    'Physiotherapist', 'Radiologist', 'Anesthesiologist',
    'Plastic Surgeon', 'Sexologist', 'Homeopathy', 'Ayurveda'
  ];

  // Smart/fuzzy matching function
  // Handles misspellings like "Gyeacologist" → suggests "Gynaecologist"
  const getSmartSuggestions = (input) => {
    if (!input || input.length < 2) return [];
    const lower = input.toLowerCase();

    // First try: starts with the input
    const startsWith = specializations.filter(s =>
      s.toLowerCase().startsWith(lower)
    );
    if (startsWith.length > 0) return startsWith;

    // Second try: contains the input anywhere
    const contains = specializations.filter(s =>
      s.toLowerCase().includes(lower)
    );
    if (contains.length > 0) return contains;

    // Third try: fuzzy match — check if most characters match (handles misspellings)
    // Simple approach: check how many characters from input exist in the specialization
    const fuzzy = specializations.filter(s => {
      const sLower = s.toLowerCase();
      let matchCount = 0;
      for (let char of lower) {
        if (sLower.includes(char)) matchCount++;
      }
      // If 60%+ characters match, it's probably what they meant
      return matchCount >= lower.length * 0.6;
    });

    return fuzzy;
  };

  // ---- Fetch doctors from API ----
  // This function is called on page load and when filters change

  const fetchDoctors = async (page = 1) => {
    setLoading(true);
    try {
      // Build query parameters
      const params = { page, limit: 9 };
      // limit: 9 = show 9 doctors per page (fits nicely in a 3-column grid)

      if (searchName) params.name = searchName;
      if (searchSpecialization) params.specialization = searchSpecialization;
      if (maxFee) params.maxFee = maxFee;
      if (availableToday) params.availableToday = 'true';
      if (city) params.city = city;
      if (consultationMode) params.consultationMode = consultationMode;
      if (language) params.language = language;

      const response = await doctorAPI.getAll(params);
      // This calls GET /api/doctors?page=1&limit=9&name=...&specialization=...

      setDoctors(response.data.doctors);
      setPagination(response.data.pagination);

    } catch (error) {
      toast.error('Failed to load doctors');
      console.error('Fetch doctors error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ---- useEffect: Fetch on first load (or when URL param changes) ----
  useEffect(() => {
    fetchDoctors();
  }, [urlSpecialization]);
  // Empty dependency array [] = run ONCE when component mounts (loads)
  // Without [], it would run on every re-render (infinite loop!)

  // ---- Handle search form submission ----
  const handleSearch = (e) => {
    e.preventDefault();
    setShowSuggestions(false);
    fetchDoctors(1); // Reset to page 1 when searching
  };

  // ---- Handle pagination ----
  const goToPage = (page) => {
    fetchDoctors(page);
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <SEO
        title={searchSpecialization ? `${searchSpecialization} Doctors` : 'Find Doctors'}
        description={`Find and book ${searchSpecialization || ''} doctors online. Browse profiles, check availability, read reviews, and book appointments instantly on ProMedicoz.`}
        path="/doctors"
      />

      {/* ---- Header band ---- A compact gradient banner anchors the page
          (instead of a bare heading floating on gray) and gives the search
          card something to sit against for a modern, layered look. */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="container mx-auto px-4 pt-10 pb-20 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold">{t.headerTitle}</h1>
          <p className="text-primary-100 mt-2 text-sm sm:text-base">
            {t.headerSubtitle(pagination.totalDoctors)}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-10">
      {/* ---- Search/Filter Bar ---- pulled up to overlap the header band */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl shadow-lg p-6 mb-8 -mt-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search by specialization with smart suggestions */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.specialization}
            </label>
            <input
              type="text"
              value={searchSpecialization}
              onChange={(e) => {
                setSearchSpecialization(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder={t.specializationPh}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              autoComplete="off"
            />
            {showSuggestions && searchSpecialization.length >= 2 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {getSmartSuggestions(searchSpecialization).map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSearchSpecialization(suggestion);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-primary-50 hover:text-primary-700 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
                {getSmartSuggestions(searchSpecialization).length === 0 && (
                  <div className="px-4 py-2 text-sm text-gray-500">{t.noMatches}</div>
                )}
              </div>
            )}
          </div>

          {/* Search by name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.doctorName}
            </label>
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder={t.doctorNamePh}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Max fee filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.maxFee}</label>
            <input type="number" value={maxFee} onChange={(e) => setMaxFee(e.target.value)} placeholder={t.maxFeePh} min="0" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>

          {/* City filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.city}</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t.cityPh} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>

          {/* Consultation mode filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.consultation}</label>
            <select value={consultationMode} onChange={(e) => setConsultationMode(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
              <option value="">{t.allTypes}</option>
              <option value="in-person">{t.inPerson}</option>
              <option value="video">{t.video}</option>
              <option value="phone">{t.phone}</option>
            </select>
          </div>

          {/* Language filter — find a doctor who speaks the patient's language */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.language}</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
              <option value="">{t.anyLanguage}</option>
              {SPOKEN_LANGUAGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Search button + Available today toggle */}
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={availableToday}
                onChange={(e) => setAvailableToday(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">{t.availableToday}</span>
            </label>
            <button
              type="submit"
              className="w-full bg-primary-600 text-white py-2 px-6 rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              {t.search}
            </button>
          </div>
        </div>
      </form>

      {/* ---- Results ---- */}
      {loading ? (
        // Loading state
        <div className="text-center py-12">
          <div className="text-lg text-gray-600">{t.loading}</div>
        </div>
      ) : doctors.length === 0 ? (
        // No results — make it specific to what they searched for, capture
        // the real demand via a pre-filled WhatsApp message (so we learn
        // which specialists/cities to recruit next), and offer a real
        // alternative instead of a dead end.
        (() => {
          const parts = [];
          if (searchSpecialization) parts.push(searchSpecialization);
          if (city) parts.push(`in ${city}`);
          const searchedFor = parts.join(' ');
          const waMessage = searchedFor
            ? `Hi ProMedicoz, I'm looking for a ${searchedFor} but couldn't find one on the site. Can you help?`
            : `Hi ProMedicoz, I couldn't find the doctor I'm looking for. Can you help?`;
          return (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-xl font-medium text-gray-700">
                {t.noResultsTitle(searchedFor)}
              </h3>
              <p className="text-gray-500 mt-2">
                {searchedFor
                  ? t.noResultsMsgSpec(searchSpecialization)
                  : t.noResultsMsgGeneric}
              </p>

              <div className="mt-6 p-5 bg-green-50 border border-green-200 rounded-xl inline-block max-w-md">
                <p className="text-green-800 font-medium mb-3">{t.cantFind}</p>
                <a
                  href={`https://wa.me/919997019900?text=${encodeURIComponent(waMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                >
                  {t.chatWhatsApp}
                </a>
                <p className="text-xs text-green-600 mt-2">{t.chatHint}</p>
              </div>

              <div className="mt-6">
                <Link to="/doctors" className="text-primary-600 text-sm font-medium hover:underline">
                  {t.browseAll}
                </Link>
              </div>
            </div>
          );
        })()
      ) : (
        // Doctor cards grid
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/*
            .map() = loop through the doctors array and create a card for each
            This is how React renders lists — transform data into JSX elements
          */}
          {doctors.map((doctor) => (
            <DoctorCard key={doctor._id} doctor={doctor} t={t} />
            // "key" = unique identifier React uses to track list items
            // Without key, React can't efficiently update the list
          ))}
        </div>
      )}

      {/* ---- Pagination Controls ---- */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-8">
          {/* Previous button */}
          <button
            onClick={() => goToPage(pagination.currentPage - 1)}
            disabled={!pagination.hasPrevPage}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.prev}
          </button>

          {/* Page info */}
          <span className="text-gray-600 px-4">
            {t.pageOf(pagination.currentPage, pagination.totalPages)}
          </span>

          {/* Next button */}
          <button
            onClick={() => goToPage(pagination.currentPage + 1)}
            disabled={!pagination.hasNextPage}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.next}
          </button>
        </div>
      )}
      </div>
    </div>
  );
}

// ---- Doctor Card Component ----
// A smaller component used inside DoctorList
// This is "component composition" — building UIs from small reusable pieces

function DoctorCard({ doctor, t }) {
  // { doctor } = the data; t = the language dictionary passed from DoctorList

  // Real next-available slot comes from the backend (accounts for past + booked
  // slots), so the card never misleads patients.
  const na = doctor.nextAvailable;
  const availableToday = !!(na && na.isToday);

  // "New on ProMedicoz" — a positive, honest alternative to a consultation
  // count for doctors who joined recently (no fabricated numbers).
  const isNewDoctor = doctor.createdAt &&
    (Date.now() - new Date(doctor.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000;

  // Build a friendly availability label from the next-available slot.
  let availabilityLabel;
  if (na) {
    const startTime = (na.timeSlot || '').split(' - ')[0]; // e.g. "03:30 PM"
    // Is the next slot tomorrow (IST)?
    const tomorrow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    if (na.isToday) {
      // The green "Available Today" pill already conveys today — don't repeat it here.
      availabilityLabel = t.nextAt(startTime);
    } else if (na.date === tomorrowStr) {
      availabilityLabel = t.nextTomorrow(startTime);
    } else {
      availabilityLabel = t.nextDay(na.dayName, startTime);
    }
  } else {
    availabilityLabel = t.noUpcoming;
  }

  // Horizontal card layout — small circular avatar on the left, info stacked on
  // the right. This matches how established telehealth listings (e.g. Practo)
  // present doctor cards, rather than a full-bleed banner photo.
  return (
    <Link
      to={`/doctors/${doctor._id}`}
      className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow block p-5 flex gap-4 items-start"
      // "block" makes the entire card clickable
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {doctor.profilePhoto ? (
          <img
            src={getUploadUrl(doctor.profilePhoto, { width: 200 })}
            alt={doctor.name}
            className="w-20 h-20 rounded-full object-cover border-2 border-primary-100"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-4xl">
            🧑‍⚕️
          </div>
        )}
      </div>

      {/* Doctor Info */}
      <div className="flex-1 min-w-0">
        {/* Name gets the full row width; badges sit on their own line below
            so they never squeeze the name into a narrow, wrapping column. */}
        <h3 className="text-lg font-semibold text-gray-800 leading-snug flex items-center gap-1.5">
          {formatDoctorName(doctor.name)}
          {doctor.isAdminVerified && <VerifiedBadge size={16} />}
        </h3>
        <div className="flex flex-wrap gap-1 mt-1">
          {availableToday && (
            <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium whitespace-nowrap">
              {t.availableToday}
            </span>
          )}
          {isNewDoctor && (
            <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium whitespace-nowrap">
              {t.newDoctor}
            </span>
          )}
        </div>

        {doctor.specialization && (
          <p className="text-primary-600 text-sm font-medium mt-0.5">
            {doctor.specialization}
          </p>
        )}

        {doctor.experience > 0 && (
          <p className="text-gray-500 text-sm mt-0.5">
            {t.yearsExp(doctor.experience)}
          </p>
        )}

        {/* Rating (only shown once the doctor has real reviews) */}
        {doctor.rating && doctor.rating.count > 0 && (
          <p className="text-sm mt-0.5 flex items-center gap-1">
            <span className="text-yellow-500">⭐</span>
            <span className="font-medium text-gray-700">{doctor.rating.average}</span>
            <span className="text-gray-400">{t.reviews(doctor.rating.count)}</span>
          </p>
        )}

        {/* Honest availability signal (next free slot) */}
        <p className={`text-sm mt-1 font-medium flex items-center gap-1 ${availableToday ? 'text-green-600' : na ? 'text-gray-600' : 'text-gray-400'}`}>
          {na && <span>🕐</span>}
          {availabilityLabel}
        </p>

        <div className="flex flex-wrap items-center gap-3 mt-2">
          {doctor.consultationFee > 0 && (
            <span className="text-gray-700 font-medium text-sm">₹{doctor.consultationFee}</span>
          )}
          {doctor.city && (
            <span className="text-gray-500 text-sm">📍 {doctor.city}</span>
          )}
        </div>

        {/* Consultation mode badges */}
        {doctor.consultationModes && doctor.consultationModes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {doctor.consultationModes.includes('in-person') && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">🏥 In-Person</span>}
            {doctor.consultationModes.includes('video') && <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">📹 Video</span>}
            {doctor.consultationModes.includes('phone') && <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">📞 Phone</span>}
          </div>
        )}

        {/* Languages the doctor can consult in — helps local patients find
            someone they can talk to comfortably */}
        {doctor.languagesSpoken && doctor.languagesSpoken.length > 0 && (
          <p className="text-gray-500 text-xs mt-2">
            🗣️ {t.speaks}: {doctor.languagesSpoken.join(', ')}
          </p>
        )}

        {/* View Profile link */}
        <div className="mt-3">
          <span className="text-primary-600 text-sm font-medium hover:underline">
            {t.viewProfile}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default DoctorList;
