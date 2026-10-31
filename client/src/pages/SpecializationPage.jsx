import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { pageHasPrerenderedLd } from '../utils/prerenderLd';
import { doctorAPI, getUploadUrl } from '../services/api';
import SEO from '../components/SEO';
import { Helmet } from 'react-helmet-async';
import { trackEvent } from '../components/Analytics';
import { dueDatePath, ovulationPath, vaccinePath, reportPath } from './tools/toolLinks';
import { cityToSlug, slugToCityName, cityHeading, citySearchTitle, citySummary, cityGuide, cityFaqs, hoursSummary, nearbyCitySlugs, modesText } from '../utils/cityPage';
import { formatDoctorName } from '../utils/formatName';

// City slug helpers + city facts/guide/FAQ copy are shared with the build
// (scripts/prerender.mjs) — see src/utils/cityPage.js. Specialty data:
// ./specializationData.js (also imported by the build).
import { specializationData, specializationHi } from './specializationData';
import { useLang } from '../context/LangContext';
import useSpecialtyCounts from '../utils/useSpecialtyCounts';
import { fallbackFor, hasDoctors, slugForName, notifyMeText, pluralSpec } from '../utils/specialtyAvailability';

// UI labels for the page chrome (headings, buttons). English + Hindi.
const UI = {
  en: {
    conditionsTitle: 'Common Conditions Treated',
    topDoctors: (s, city) => city ? `Top ${s} Doctors in ${city}` : `Top ${s} Doctors on ProMedicoz`,
    loadingDoctors: 'Loading doctors...',
    noneCity: (s, city) => `No ${s} doctors in ${city} yet.`,
    noneAll: (s) => `No ${s} doctors registered yet.`,
    areYou: (s) => `Are you a ${s}? Register now →`,
    yrsExp: 'yrs exp', consultation: 'Consultation', bookAppointment: 'Book Appointment →',
    viewAll: (s) => `View all ${s} doctors →`,
    findByCity: (s) => `Find ${s} Doctors by City`,
    inCity: (s, city) => `${s} in ${city}`,
    allDoctors: (s) => `← All ${s} doctors`,
    bookConsult: (s) => `Book ${s} Consultation`,
    faqTitle: 'Frequently Asked Questions',
    ctaTitle: (s) => `Need a ${s} consultation?`,
    ctaText: 'Book an appointment in under 2 minutes. Video, phone, or in-person.',
    ctaBtn: (s) => `Find ${s} Doctors`,
    soonTitle: (s) => `${pluralSpec(s)} are joining ProMedicoz soon`,
    soonCityTitle: (s, city) => `No ${s} in ${city} yet`,
    altIntro: (alt) => `Meanwhile, these ${pluralSpec(alt)} can see you now and guide you on next steps:`,
    altCityIntro: (s) => `These ${pluralSpec(s)} consult online (video or phone):`,
    seeAllAlt: (alt) => `See all ${pluralSpec(alt)} →`,
    notifyMe: '🔔 Notify me on WhatsApp',
  },
  hi: {
    conditionsTitle: 'आमतौर पर इलाज की जाने वाली समस्याएं',
    topDoctors: (s, city) => city ? `${city} में शीर्ष ${s} डॉक्टर` : `ProMedicoz पर शीर्ष ${s} डॉक्टर`,
    loadingDoctors: 'डॉक्टर लोड हो रहे हैं...',
    noneCity: (s, city) => `${city} में अभी कोई ${s} डॉक्टर नहीं है।`,
    noneAll: (s) => `अभी कोई ${s} डॉक्टर पंजीकृत नहीं है।`,
    areYou: (s) => `क्या आप ${s} हैं? अभी पंजीकरण करें →`,
    yrsExp: 'वर्ष अनुभव', consultation: 'परामर्श', bookAppointment: 'अपॉइंटमेंट बुक करें →',
    viewAll: (s) => `सभी ${s} डॉक्टर देखें →`,
    findByCity: (s) => `शहर के अनुसार ${s} डॉक्टर खोजें`,
    inCity: (s, city) => `${city} में ${s}`,
    allDoctors: (s) => `← सभी ${s} डॉक्टर`,
    bookConsult: (s) => `${s} परामर्श बुक करें`,
    faqTitle: 'अक्सर पूछे जाने वाले प्रश्न',
    ctaTitle: (s) => `${s} परामर्श चाहिए?`,
    ctaText: '2 मिनट से भी कम में अपॉइंटमेंट बुक करें। वीडियो, फोन या क्लिनिक पर।',
    ctaBtn: (s) => `${s} डॉक्टर खोजें`,
    soonTitle: (s) => `${s} जल्द ProMedicoz पर जुड़ रहे हैं`,
    soonCityTitle: (s, city) => `${city} में अभी कोई ${s} नहीं`,
    altIntro: (alt) => `तब तक ये ${alt} अभी आपको देख सकते हैं और आगे का रास्ता बताएंगे:`,
    altCityIntro: (s) => `ये ${s} ऑनलाइन (वीडियो या फ़ोन) परामर्श देते हैं:`,
    seeAllAlt: (alt) => `सभी ${alt} देखें →`,
    notifyMe: '🔔 WhatsApp पर बताएं',
  },
};

function SpecializationPage() {
  const { pathname: routerPath } = useLocation();
  const { slug, city: citySlug } = useParams();
  const cityName = citySlug ? slugToCityName(citySlug) : '';
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  // Cities that actually have doctors of this specialization — only fetched
  // on the base (non-city) page, to build the "Find X in your city" links.
  const [cities, setCities] = useState([]);

  const { lang, setLang } = useLang(); // app-wide (top-bar switch)
  const ui = UI[lang] || UI.en;

  const data = specializationData[slug];
  const specName = data?.title || slug;
  // Hindi overlay for the VISIBLE content (title stays English — it's a proper
  // noun / the canonical specialty label and also what we search doctors by).
  // Falls back to English fields when a Hindi entry is missing.
  const hi = (lang === 'hi' && specializationHi[slug]) || null;
  const view = data ? {
    title: data.title,
    subtitle: hi?.subtitle || data.subtitle,
    description: hi?.description || data.description,
    conditions: hi?.conditions || data.conditions,
    faqs: hi?.faqs || data.faqs,
    icon: data.icon,
  } : null;

  // City pages: same-specialty doctors in twin/neighbouring cities
  // (Bhilai ↔ Durg ↔ Raipur) — [{ citySlug, cityName, doctors }].
  const [nearby, setNearby] = useState([]);
  useEffect(() => {
    if (!citySlug) { setNearby([]); return undefined; }
    let cancelled = false;
    Promise.all(nearbyCitySlugs(citySlug).map((s) =>
      doctorAPI.getAll({ specialization: specName, city: slugToCityName(s), limit: 6 })
        .then((r) => ({ citySlug: s, cityName: slugToCityName(s), doctors: (r.data.doctors || []).filter((d) => cityToSlug(d.city || '') === s) }))
        .catch(() => ({ citySlug: s, cityName: slugToCityName(s), doctors: [] }))))
      .then((list) => { if (!cancelled) setNearby(list.filter((n) => n.doctors.length)); });
    return () => { cancelled = true; };
  }, [citySlug, specName]);

  useEffect(() => {
    const fetchDoctors = async () => {
      setLoading(true);
      try {
        const params = { specialization: specName, limit: cityName ? 12 : 6 };
        if (cityName) params.city = cityName;
        const response = await doctorAPI.getAll(params);
        setDoctors(response.data.doctors);
      } catch (error) {
        console.error('Fetch doctors error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, [slug, specName, cityName]);

  // No doctors here → show doctors who CAN help now, instead of a dead end:
  // on a city page, this specialty's doctors elsewhere (online); otherwise
  // the closest specialty that has doctors (Skin → General Physician).
  const specCounts = useSpecialtyCounts();
  const [alt, setAlt] = useState(null); // { spec, doctors }
  useEffect(() => {
    if (loading || doctors.length) { setAlt(null); return undefined; }
    const altSpec = cityName && hasDoctors(specName, specCounts) ? specName : fallbackFor(specName, specCounts);
    if (!altSpec) { setAlt(null); return undefined; }
    let cancelled = false;
    doctorAPI.getAll({ specialization: altSpec, limit: 3 })
      .then((r) => { if (!cancelled) setAlt({ spec: altSpec, doctors: r.data.doctors || [] }); })
      .catch(() => { if (!cancelled) setAlt(null); });
    return () => { cancelled = true; };
  }, [loading, doctors.length, specName, cityName, specCounts]);

  useEffect(() => {
    // Only need the city cross-links on the base specialization page.
    if (citySlug) { setCities([]); return; }
    doctorAPI.getCities({ specialization: specName })
      .then((res) => setCities(res.data.cities || []))
      .catch(() => setCities([]));
  }, [slug, specName, citySlug]);

  const renderDoctorCard = (doc) => {
    const hours = hoursSummary(doc.availability, lang);
    const modes = (doc.consultationModes || []);
    return (
    <Link key={doc._id} to={doc.slug ? `/dr/${doc.slug}` : `/doctors/${doc._id}`} className="group card-lift bg-white rounded-2xl p-5 shadow-sm block border border-gray-100">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center text-xl flex-shrink-0 overflow-hidden border-2 border-primary-50">
          {doc.profilePhoto ? <img src={getUploadUrl(doc.profilePhoto, { width: 120 })} alt={formatDoctorName(doc.name)} className="w-14 h-14 rounded-full object-cover" /> : '🧑‍⚕️'}
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-gray-800 truncate">{formatDoctorName(doc.name)}</h3>
          {doc.specialization && <p className="text-sm text-gray-700 truncate">{doc.specialization.trim()}</p>}
          <p className="text-xs text-gray-500">
            {[doc.qualification && doc.qualification.trim(), `${doc.experience || 0} ${ui.yrsExp}`, doc.city && doc.city.trim()].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      {modes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {modes.map((m) => (
            <span key={m} className="px-2 py-0.5 rounded-full bg-green-50 text-green-800 text-xs font-medium">
              {m === 'in-person' ? '🏥' : m === 'phone' ? '📞' : '📹'} {modesText([m], lang)}
            </span>
          ))}
        </div>
      )}
      {Array.isArray(doc.languagesSpoken) && doc.languagesSpoken.length > 0 && (
        <p className="text-xs text-gray-600">🗣 {doc.languagesSpoken.join(', ')}</p>
      )}
      {hours && <p className="text-xs text-gray-600 mt-0.5">🕐 {hours}</p>}
      {doc.consultationFee > 0 && (
        <p className="text-sm text-gray-600 mt-2">{ui.consultation}: <span className="font-bold text-gray-800">Rs. {doc.consultationFee}</span></p>
      )}
      <span className="inline-flex items-center gap-1 text-primary-700 text-sm font-semibold mt-3 group-hover:gap-1.5 transition-all">
        {ui.bookAppointment}
      </span>
    </Link>
    );
  };

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-800">{lang === 'hi' ? 'विशेषज्ञता नहीं मिली' : 'Specialization not found'}</h1>
        <Link to="/doctors" className="text-primary-600 hover:underline mt-4 inline-block">{lang === 'hi' ? 'सभी डॉक्टर देखें →' : 'Browse all doctors →'}</Link>
      </div>
    );
  }

  // City pages: facts, guide and city-specific questions from the doctors'
  // own profiles (shared with the build — src/utils/cityPage.js).
  const cityArgs = cityName ? { slug, specTitle: data.title, cityName, doctors, nearby, conditions: view.conditions } : null;
  // Only once doctors have loaded — never "0 verified …" on a slow/failed fetch.
  const summary = cityArgs && !loading && doctors.length ? citySummary({ ...cityArgs, lang }) : '';
  const guide = cityArgs && !loading && doctors.length ? cityGuide({ ...cityArgs, lang }) : null;
  const cityQs = cityArgs && !loading ? cityFaqs({ ...cityArgs, lang }) : [];
  const cityQsEn = cityArgs && !loading ? cityFaqs({ ...cityArgs, lang: 'en' }) : [];
  const shownFaqs = [...cityQs, ...view.faqs];

  // FAQ structured data for Google "People Also Ask" — ALWAYS English (this
  // feeds Google's index; the visible FAQs may be shown in Hindi via `view`).
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [...cityQsEn, ...data.faqs].map(faq => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a }
    }))
  };

  // Breadcrumb structured data — helps search engines understand the
  // Home > Specialization > City hierarchy on the city pages.
  const breadcrumbSchema = cityName ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.promedicoz.in/' },
      { '@type': 'ListItem', position: 2, name: data.title, item: `https://www.promedicoz.in/specialization/${slug}` },
      { '@type': 'ListItem', position: 3, name: `${data.title} in ${cityName}`, item: `https://www.promedicoz.in/specialization/${slug}/${citySlug}` },
    ]
  } : null;

  return (
    <div>
      <SEO
        title={cityName
          ? citySearchTitle(data.title, cityName)
          : `Best ${data.title} Doctors Online - Book Appointment`}
        description={cityName
          ? `${cityHeading(data.title, cityName)} on ProMedicoz${summary ? `: ${citySummary({ ...cityArgs, lang: 'en' })}` : ''}. ${data.description}`
          : `Consult top ${data.title.toLowerCase()} doctors online on ProMedicoz. ${data.description} Book video, phone or in-person consultation.`}
        path={cityName ? `/specialization/${slug}/${citySlug}` : `/specialization/${slug}`}
      />
      {/* Skip what the pre-built page already provides (utils/prerenderLd.js). */}
      <Helmet>
        {!pageHasPrerenderedLd('FAQPage', routerPath) && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
        {breadcrumbSchema && !pageHasPrerenderedLd('BreadcrumbList', routerPath) && <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>}
      </Helmet>

      {/* Hero section */}
      <section className="bg-gradient-to-r from-primary-600 to-primary-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-4xl sm:text-5xl">{view.icon}</span>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
                {/* City pages: the exact words people search ("best
                    gynecologist in bhilai"), both spellings. */}
                {cityName ? cityHeading(view.title, cityName) : view.title}
              </h1>
              <p className="text-primary-200 text-lg">{view.subtitle}</p>
            </div>
          </div>
          {summary && <p className="text-white/95 font-medium mb-3 max-w-2xl">{summary}</p>}
          {cityName && (
            <p className="text-primary-100 text-sm mb-2">
              <Link to={`/specialization/${slug}`} className="underline hover:text-white">{ui.allDoctors(view.title)}</Link>
            </p>
          )}
          <p className="text-primary-100 max-w-2xl text-lg">{view.description}</p>
          <Link
            to={`/doctors?specialization=${encodeURIComponent(specName)}`}
            onClick={() => trackEvent('find_doctor_click', {
              source: 'specialization_page',
              specialization: specName,
              cta_position: 'hero',
              city: cityName || 'none',
            })}
            className="btn mt-6 bg-white text-primary-700 hover:bg-gray-100 shadow-sm"
          >
            {ui.bookConsult(view.title)}
          </Link>
        </div>
      </section>

      {/* Gynae pages (base + city): slim strip pointing to the free due-date
          tool, right under the header so it's seen without scrolling. */}
      {slug === 'gynaecologist' && (
        <div className="bg-pink-100 border-b border-pink-200">
          <div className="container mx-auto px-4 py-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm">
            <Link
              to={dueDatePath(lang)}
              onClick={() => trackEvent('tool_due_date_entry', { source: 'gynae_strip', city: cityName || 'none' })}
              className="inline-flex items-center gap-1.5 py-0.5 text-pink-800 hover:text-pink-950"
            >
              <span aria-hidden="true">🤰</span>
              <span>
                {lang === 'hi' ? 'प्रेग्नेंट हैं? ' : 'Pregnant? '}
                <span className="font-semibold underline">{lang === 'hi' ? 'ड्यू डेट जानें →' : 'Find your due date →'}</span>
              </span>
            </Link>
            <Link
              to={ovulationPath(lang)}
              onClick={() => trackEvent('tool_ovulation_entry', { source: 'gynae_strip', city: cityName || 'none' })}
              className="inline-flex items-center gap-1.5 py-0.5 text-violet-800 hover:text-violet-950"
            >
              <span aria-hidden="true">🌷</span>
              <span>
                {lang === 'hi' ? 'बेबी प्लान कर रही हैं? ' : 'Planning a baby? '}
                <span className="font-semibold underline">{lang === 'hi' ? 'फ़र्टाइल दिन जानें →' : 'Find your fertile days →'}</span>
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* General physician + endocrinologist pages (base + city): strip
          pointing to Report Samjhao, right under the header. */}
      {(slug === 'general-physician' || slug === 'endocrinologist') && (
        <Link
          to={reportPath(lang)}
          onClick={() => trackEvent('tool_report_entry', { source: `${slug}_strip`, city: cityName || 'none' })}
          className="block bg-indigo-100 hover:bg-indigo-200 transition-colors border-b border-indigo-200"
        >
          <div className="container mx-auto px-4 py-2.5 flex items-center justify-center gap-2 text-sm text-indigo-800">
            <span aria-hidden="true">🧪</span>
            <span>
              {lang === 'hi' ? 'ब्लड रिपोर्ट समझ नहीं आ रही? ' : 'Got a blood report? '}
              <span className="font-semibold underline">{lang === 'hi' ? 'आसान शब्दों में समझें →' : 'Understand it in simple words →'}</span>
            </span>
          </div>
        </Link>
      )}

      {/* Paediatrician pages (base + city): strip pointing to the free
          vaccination schedule, right under the header. */}
      {slug === 'pediatrician' && (
        <Link
          to={vaccinePath(lang)}
          onClick={() => trackEvent('tool_vaccine_entry', { source: 'pediatrician_strip', city: cityName || 'none' })}
          className="block bg-teal-100 hover:bg-teal-200 transition-colors border-b border-teal-200"
        >
          <div className="container mx-auto px-4 py-2.5 flex items-center justify-center gap-2 text-sm text-teal-800">
            <span aria-hidden="true">💉</span>
            <span>
              {lang === 'hi' ? 'बच्चे को टीका कब लगेगा? ' : "Baby's vaccines due? "}
              <span className="font-semibold underline">{lang === 'hi' ? 'हर टीके की तारीख देखें →' : 'See every vaccine date →'}</span>
            </span>
          </div>
        </Link>
      )}

      {/* Gynaecology-only reassurance band. Women's-health consults carry extra
          privacy/comfort concerns, so we address them head-on — but HONESTLY:
          we do NOT claim "all our doctors are women" (the roster includes at
          least one male doctor and records have no gender field to verify
          against). Instead we lead with what is genuinely true and reassuring:
          a private, judgement-free consult, and the freedom to browse profiles
          and choose a woman doctor if that's your preference. Shown only on the
          base gynae page (not city sub-pages, to keep those lean). */}
      {slug === 'gynaecologist' && !cityName && (
        <section className="py-6 bg-pink-50 border-y border-pink-100">
          <div className="container mx-auto px-4">
            <div className="flex items-start gap-4 max-w-3xl">
              <span className="text-3xl flex-shrink-0" aria-hidden="true">👩‍⚕️</span>
              <div>
                <h2 className="font-semibold text-gray-800">
                  {lang === 'hi' ? 'निजी, बिना किसी झिझक के परामर्श' : 'Private, judgement-free consultations'}
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  {lang === 'hi'
                    ? 'महिलाओं के स्वास्थ्य से जुड़ी बातें निजी होती हैं। ProMedicoz पर आप आराम से, बिना किसी झिझक के परामर्श कर सकती हैं — और प्रोफ़ाइल देखकर अपनी पसंद की महिला डॉक्टर चुन सकती हैं। वीडियो, फ़ोन या क्लिनिक पर।'
                    : "Women's health is personal. On ProMedicoz you can consult privately and without judgement — and you're free to browse profiles and choose a woman doctor if you prefer. By video, phone, or in person."}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Common conditions */}
      <section className="py-10 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{ui.conditionsTitle}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {view.conditions.map((condition, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
                <p className="text-sm font-medium text-gray-700">{condition}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Doctors listing */}
      <section className="py-10 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {ui.topDoctors(view.title, cityName)}
          </h2>
          {loading ? (
            <p className="text-gray-500">{ui.loadingDoctors}</p>
          ) : doctors.length === 0 && alt && alt.doctors.length > 0 ? (
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100">
              <p className="text-lg font-semibold text-gray-800">
                <span aria-hidden="true">🌱 </span>
                {cityName ? ui.soonCityTitle(view.title, cityName) : ui.soonTitle(view.title)}
              </p>
              <p className="text-gray-600 text-sm mt-1 mb-4">
                {alt.spec === specName ? ui.altCityIntro(view.title) : ui.altIntro(alt.spec)}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {alt.doctors.map(renderDoctorCard)}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-5">
                <Link
                  to={slugForName(alt.spec) && alt.spec !== specName ? `/specialization/${slugForName(alt.spec)}` : `/doctors?specialization=${encodeURIComponent(alt.spec)}`}
                  onClick={() => trackEvent('find_doctor_click', { source: 'specialization_fallback', specialization: alt.spec, from_specialization: specName })}
                  className="text-primary-700 font-semibold hover:underline"
                >
                  {ui.seeAllAlt(alt.spec)}
                </Link>
                <a
                  href={`https://wa.me/919997019900?text=${encodeURIComponent(notifyMeText(view.title, cityName))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 rounded-lg border border-green-300 bg-green-50 text-green-800 text-sm font-medium hover:bg-green-100 transition-colors"
                >
                  {ui.notifyMe}
                </a>
                <Link to="/register?role=doctor" className="text-sm text-gray-600 hover:underline">
                  {ui.areYou(view.title)}
                </Link>
              </div>
            </div>
          ) : doctors.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <p className="text-gray-600 mb-4">
                {cityName ? ui.noneCity(view.title, cityName) : ui.noneAll(view.title)}
              </p>
              <Link to="/register?role=doctor" className="text-primary-600 font-medium hover:underline">
                {ui.areYou(view.title)}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctors.map(renderDoctorCard)}
            </div>
          )}
          {/* "View all" — not when the list above is empty (the "who can help
              now" box already links to the right list). */}
          {!(doctors.length === 0 && alt && alt.doctors.length > 0) && (
          <div className="text-center mt-6">
            <Link
              to={`/doctors?specialization=${encodeURIComponent(specName)}`}
              onClick={() => trackEvent('find_doctor_click', {
                source: 'specialization_page',
                specialization: specName,
                cta_position: 'view_all',
                city: cityName || 'none',
              })}
              className="text-primary-600 font-medium hover:underline"
            >
              {ui.viewAll(view.title)}
            </Link>
          </div>
          )}
        </div>
      </section>

      {/* City pages: same-specialty doctors in twin/neighbouring cities. */}
      {cityName && nearby.length > 0 && (
        <section className="py-8 bg-gray-50 border-t border-gray-100">
          <div className="container mx-auto px-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">{lang === 'hi' ? `${cityName} के पास` : `Also near ${cityName}`}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {nearby.flatMap((n) => n.doctors.map((d) => (
                <Link key={d._id} to={d.slug ? `/dr/${d.slug}` : `/doctors/${d._id}`} className="flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-primary-300 transition-colors">
                  <span className="min-w-0">
                    <span className="block font-semibold text-gray-800 truncate">{formatDoctorName(d.name)} · {n.cityName}</span>
                    <span className="block text-xs text-gray-600 truncate">
                      {[d.specialization && d.specialization.trim(), d.consultationFee > 0 && `Rs. ${d.consultationFee}`, modesText(d.consultationModes || [], lang)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="text-primary-700 font-semibold" aria-hidden="true">→</span>
                </Link>
              )))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              {nearby.map((n) => (
                <Link key={n.citySlug} to={`/specialization/${slug}/${n.citySlug}`} className="text-sm text-primary-700 font-medium hover:underline">
                  {ui.inCity(view.title, n.cityName)} →
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* City pages: short factual guide (fees, consult types, when to go). */}
      {guide && guide.items.length > 0 && (
        <section className="py-8 bg-white">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-xl font-bold text-gray-800 mb-3">{guide.title}</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-gray-700 text-sm leading-relaxed">
              {guide.items.map((it) => <li key={it}>{it}</li>)}
            </ul>
            {guide.redFlag && (
              <p className="mt-3 text-sm font-medium text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="note">⚠️ {guide.redFlag}</p>
            )}
          </div>
        </section>
      )}

      {/* Find by city — only on the base page, and only cities that actually
          have doctors of this specialization (data-driven, no empty pages).
          These internal links are how search engines discover the city
          landing pages. */}
      {!citySlug && cities.length > 0 && (
        <section className="py-10 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">{ui.findByCity(view.title)}</h2>
            <div className="flex flex-wrap gap-3">
              {cities.map((c) => (
                <Link
                  key={c.city}
                  to={`/specialization/${slug}/${cityToSlug(c.city)}`}
                  className="px-4 py-2 bg-primary-50 border border-primary-100 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors"
                >
                  {ui.inCity(view.title, c.city)}
                  <span className="text-primary-400 ml-1">({c.count})</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQs */}
      <section className="py-10 bg-white">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800">{ui.faqTitle}</h2>
            <span className="inline-block mt-2 h-1 w-12 rounded-full bg-primary-500" aria-hidden="true"></span>
          </div>
          <div className="space-y-3">
            {shownFaqs.map((faq, idx) => (
              // Kept always-open (not collapsible) because this Q&A is SEO
              // content that should stay visible/crawlable; just styled as a
              // card with a question badge and a hover lift for polish.
              <div
                key={idx}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary-200"
              >
                <h3 className="font-semibold text-gray-800 mb-2 flex items-start gap-2.5">
                  <span className="text-primary-500 shrink-0" aria-hidden="true">❓</span>
                  {faq.q}
                </h3>
                <p className="text-gray-600 text-sm pl-7 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-10 bg-primary-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-3">{ui.ctaTitle(view.title)}</h2>
          <p className="text-gray-600 mb-5">{ui.ctaText}</p>
          <Link
            to={`/doctors?specialization=${encodeURIComponent(specName)}`}
            onClick={() => trackEvent('find_doctor_click', {
              source: 'specialization_page',
              specialization: specName,
              cta_position: 'bottom',
              city: cityName || 'none',
            })}
            className="btn btn-primary px-8 text-base"
          >
            {ui.ctaBtn(view.title)}
          </Link>
        </div>
      </section>
    </div>
  );
}

export default SpecializationPage;
