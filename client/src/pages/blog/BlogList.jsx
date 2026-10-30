// ============================================
// Blog list — search by problem, topics, continue reading, compact cards
// ============================================
// Fast: compact cards (no big colour block each), the first 12 drawn at once
// and more as you scroll (search still covers every article). Easier: one
// search box that understands English, Hinglish and Hindi words (+ 🎤),
// topics in one swipeable row, "Continue reading" / "Saved" from this phone,
// one "Most read" row. Follows the top-bar English / हिंदी switch: Hindi shows
// the Hinglish titles and opens the Hinglish version of each article.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
// Light metadata only (no article bodies) — see scripts/gen-blog-meta.mjs.
import { articleMeta as articles } from './blogMeta';
import { blogViewAPI } from '../../services/api';
import { trackEvent } from '../../components/Analytics';
import { useLang } from '../../context/LangContext';
import VoiceSearch, { isVoiceSupported } from '../../components/VoiceSearch';
import { searchArticles } from '../../utils/blogSearch';
import { getContinue, getSaved } from '../../utils/blogReading';
// Fetch-ahead helpers, themselves loaded after the list has shown (the map of
// all article files is ~12 KB; the list's first paint shouldn't wait for it).
const bodies = () => import('./articleBodies');
const prefetchArticle = (slug) => { bodies().then((m) => m.prefetchArticle(slug)).catch(() => {}); };
const prefetchArticlePage = () => { bodies().then((m) => m.prefetchArticlePage()).catch(() => {}); };

const PAGE = 12;

function formatViews(n) {
  if (n == null) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

// Soft tint behind each card's emoji, by specialty.
const TINT = {
  Cardiologist: 'bg-rose-100', Gynaecologist: 'bg-pink-100', Psychiatrist: 'bg-violet-100', Gastroenterologist: 'bg-emerald-100',
  Endocrinologist: 'bg-amber-100', Orthopedic: 'bg-orange-100', Physiotherapist: 'bg-orange-100', Dermatologist: 'bg-fuchsia-100',
  Pediatrician: 'bg-sky-100', Neurologist: 'bg-indigo-100', Ophthalmologist: 'bg-teal-100', 'ENT Specialist': 'bg-cyan-100',
  Urologist: 'bg-cyan-100', Pulmonologist: 'bg-blue-100', Dentist: 'bg-slate-100', 'General Physician': 'bg-primary-100',
};

const CATEGORIES = [
  { key: 'all', en: 'All', hi: 'सभी', icon: '📚', specs: null },
  { key: 'women', en: "Women's Health", hi: 'महिला स्वास्थ्य', icon: '🌸', specs: ['Gynaecologist'] },
  { key: 'diabetes', en: 'Diabetes & Hormones', hi: 'शुगर व हार्मोन', icon: '💉', specs: ['Endocrinologist'] },
  { key: 'heart', en: 'Heart & BP', hi: 'दिल व BP', icon: '❤️', specs: ['Cardiologist'] },
  { key: 'kids', en: 'Kids', hi: 'बच्चे', icon: '👶', specs: ['Pediatrician'] },
  { key: 'digestion', en: 'Digestion', hi: 'पेट व पाचन', icon: '🍎', specs: ['Gastroenterologist'] },
  { key: 'mind', en: 'Mental Health', hi: 'मन व तनाव', icon: '🧠', specs: ['Psychiatrist'] },
  { key: 'bones', en: 'Bones & Joints', hi: 'हड्डी व जोड़', icon: '🦴', specs: ['Orthopedic', 'Physiotherapist'] },
  { key: 'skin', en: 'Skin & Hair', hi: 'त्वचा व बाल', icon: '🧴', specs: ['Dermatologist'] },
  { key: 'brain', en: 'Brain & Nerves', hi: 'दिमाग व नसें', icon: '🧩', specs: ['Neurologist'] },
  { key: 'eyes', en: 'Eyes', hi: 'आंखें', icon: '👁️', specs: ['Ophthalmologist'] },
  { key: 'ent', en: 'ENT', hi: 'कान-नाक-गला', icon: '👂', specs: ['ENT Specialist'] },
  { key: 'kidney', en: 'Kidney & Urinary', hi: 'किडनी व पेशाब', icon: '💧', specs: ['Urologist'] },
  { key: 'lungs', en: 'Lungs', hi: 'फेफड़े', icon: '🫁', specs: ['Pulmonologist'] },
  { key: 'dental', en: 'Dental', hi: 'दांत', icon: '🦷', specs: ['Dentist'] },
  { key: 'general', en: 'General & Wellness', hi: 'सामान्य स्वास्थ्य', icon: '🩺', specs: ['General Physician'] },
];
const catOf = (spec) => CATEGORIES.find((c) => c.specs && c.specs.includes(spec));

// Popular fallback before any read counts exist.
const START_HERE_SLUGS = ['why-preventive-health-checkups-matter', 'silent-signs-high-blood-sugar', 'high-bp-the-silent-killer', 'stop-googling-symptoms-do-this-instead'];

const TXT = {
  en: {
    title: 'Health Blog', sub: (n) => `${n} articles · simple, doctor-checked health information`, reads: (r) => ` · ${r} reads`,
    searchPh: 'What is the problem? e.g. stomach pain, sugar, periods…', clear: 'Clear search', resultsFor: (n, q) => `${n} ${n === 1 ? 'article' : 'articles'} for “${q}”`,
    noResults: (q) => `No articles for “${q}”`, noResultsHint: 'Try a simpler word (e.g. "fever", "BP"), or pick a topic.', showAll: 'Show all articles',
    continue: '↩ Continue reading', saved: '⭐ Saved', popular: '🔥 Most read', latest: 'Latest articles', topicArticles: (t) => `${t} articles`,
    more: 'Show more articles ↓', min: 'read', consult: '🩺 Talk to a doctor from home', consultBtn: 'Find a doctor →', readPct: (p) => `${p}% read`,
    suggestionsFor: (q) => `Top matches for “${q}”`, seeAll: (n) => `See all ${n} →`,
  },
  hi: {
    title: 'स्वास्थ्य जानकारी', sub: (n) => `${n} लेख · आसान भाषा में, डॉक्टरों द्वारा जाँचे हुए`, reads: (r) => ` · ${r} बार पढ़े गए`,
    searchPh: 'क्या परेशानी है? जैसे: पेट दर्द, शुगर, पीरियड…', clear: 'खोज हटाएं', resultsFor: (n, q) => `“${q}” के लिए ${n} लेख`,
    noResults: (q) => `“${q}” के लिए कोई लेख नहीं मिला`, noResultsHint: 'कोई आसान शब्द लिखें (जैसे "बुखार", "BP"), या कोई विषय चुनें।', showAll: 'सभी लेख दिखाएं',
    continue: '↩ पढ़ना जारी रखें', saved: '⭐ सेव किए हुए', popular: '🔥 सबसे ज़्यादा पढ़े गए', latest: 'नए लेख', topicArticles: (t) => `${t} के लेख`,
    more: 'और लेख देखें ↓', min: 'में पढ़ें', consult: '🩺 घर बैठे डॉक्टर से बात करें', consultBtn: 'डॉक्टर खोजें →', readPct: (p) => `${p}% पढ़ा`,
    suggestionsFor: (q) => `“${q}” से मिलते लेख`, seeAll: (n) => `सभी ${n} देखें →`,
  },
};

function BlogList() {
  const { lang } = useLang();
  const hi = lang === 'hi';
  const t = TXT[hi ? 'hi' : 'en'];
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [shown, setShown] = useState(PAGE);
  const [views, setViews] = useState({});
  const [titlesHi, setTitlesHi] = useState(null);
  const [voiceOk] = useState(() => isVoiceSupported());
  const [cont] = useState(() => getContinue());
  const [saved] = useState(() => getSaved());
  const sentinel = useRef(null);

  // Read counts (non-blocking; the page works without them).
  useEffect(() => {
    let cancelled = false;
    blogViewAPI.getAll().then(({ data }) => { if (!cancelled && data && data.counts) setViews(data.counts); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  // Hinglish titles only when needed (Hindi mode, or someone searches) — a
  // separate small file so English readers never download it.
  useEffect(() => {
    if (titlesHi || (!hi && !query)) return;
    import('./titlesHi').then((m) => setTitlesHi(m.titlesHi)).catch(() => {});
  }, [hi, query, titlesHi]);

  const titleOf = (a) => (hi && titlesHi && titlesHi[a.slug]) || a.title;
  const hrefOf = (slug) => `/blog/${slug}${hi ? '/hi' : ''}`;
  const catLabel = (c) => (c ? (hi ? c.hi : c.en) : '');

  const sorted = useMemo(() => [...articles].sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate)), []);
  const q = query.trim();
  const active = CATEGORIES.find((c) => c.key === category) || CATEGORIES[0];
  const list = useMemo(() => {
    const base = q ? searchArticles(sorted, q, titlesHi || {}) : sorted;
    return active.specs ? base.filter((a) => active.specs.includes(a.specialization)) : base;
  }, [q, sorted, titlesHi, active]);
  useEffect(() => { setShown(PAGE); }, [q, category]);

  // Draw more as the reader nears the end (button stays as a fallback).
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [list.length, shown]);

  const isDefault = !q && category === 'all';
  const totalReads = Object.values(views).reduce((s, n) => s + (Number(n) || 0), 0);
  const popular = useMemo(() => {
    const ranked = [...articles].map((a) => ({ a, n: views[a.slug] || 0 })).filter((x) => x.n > 0).sort((x, y) => y.n - x.n).slice(0, 8);
    return ranked.length ? ranked : START_HERE_SLUGS.map((s) => ({ a: articles.find((x) => x.slug === s), n: 0 })).filter((x) => x.a);
  }, [views]);
  const suggestions = q ? list.slice(0, 4) : [];

  // ---- Open articles fast: download ahead of the tap ----
  // A finger touching / mouse hovering / keyboard focusing a card starts its
  // download (a touch comes ~100–300 ms before the tap registers).
  const early = (slug) => ({ onPointerDown: () => prefetchArticle(slug), onMouseEnter: () => prefetchArticle(slug), onFocus: () => prefetchArticle(slug) });
  // Once the list has shown: the article page's code, and the "Continue
  // reading" article (likely the next tap).
  useEffect(() => {
    const go = () => { prefetchArticlePage(); if (cont) prefetchArticle(cont.slug); };
    if ('requestIdleCallback' in window) { const id = requestIdleCallback(go, { timeout: 2500 }); return () => cancelIdleCallback(id); }
    const id = setTimeout(go, 1200);
    return () => clearTimeout(id);
  }, [cont]);
  // Search / voice results: fetch the top matches once the words settle
  // (each is a small file, ~3–8 KB).
  const suggestionKey = suggestions.map((a) => a.slug).join(',');
  useEffect(() => {
    if (!suggestionKey) return undefined;
    const id = setTimeout(() => suggestionKey.split(',').forEach(prefetchArticle), 350);
    return () => clearTimeout(id);
  }, [suggestionKey]);

  const card = (a) => {
    const c = catOf(a.specialization);
    return (
      <Link key={a.slug} to={hrefOf(a.slug)} {...early(a.slug)} className="flex gap-3 items-start bg-white rounded-2xl border border-gray-100 p-3 shadow-sm hover:shadow-md hover:border-primary-200 transition-all">
        <span className={`flex-shrink-0 w-12 h-12 rounded-xl ${TINT[a.specialization] || 'bg-primary-100'} flex items-center justify-center text-2xl`} aria-hidden="true">{a.image}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-gray-900 leading-snug line-clamp-2">{titleOf(a)}</span>
          <span className="block text-xs text-gray-600 mt-1">
            {[catLabel(c) || a.specialization, `${a.readTime} ${t.min}`, views[a.slug] > 0 ? `👁 ${formatViews(views[a.slug])}` : ''].filter(Boolean).join(' · ')}
          </span>
        </span>
      </Link>
    );
  };

  return (
    <div>
      <SEO
        title="Health Blog — Expert Medical Articles"
        description="Read expert health articles on ProMedicoz. Learn about symptoms, when to see a doctor, treatment options, and preventive care tips."
        path="/blog"
      />

      {/* Compact header: title + one search box that understands problems */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="container mx-auto px-4 pt-6 pb-7 max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-bold">{t.title}</h1>
          <p className="text-primary-100 text-sm mt-1">{t.sub(articles.length)}{totalReads > 0 ? t.reads(formatViews(totalReads)) : ''}</p>
          <div className="relative mt-4">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true">🔍</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPh}
              aria-label={t.searchPh}
              className={`w-full pl-11 ${voiceOk ? 'pr-24' : 'pr-11'} py-3 rounded-full text-gray-900 outline-none focus:ring-2 focus:ring-white/70 shadow-md`}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label={t.clear} className={`absolute ${voiceOk ? 'right-14' : 'right-3'} top-1/2 -translate-y-1/2 w-8 h-8 rounded-full text-gray-500 hover:bg-gray-100`}>✕</button>
            )}
            {voiceOk && <VoiceSearch lang={lang} hideHint onResult={(said) => { setQuery(said); trackEvent('blog_voice_search', { lang }); }} />}
          </div>
          {/* Live top matches right under the box */}
          {suggestions.length > 0 && (
            <div className="mt-2 bg-white rounded-2xl shadow-lg overflow-hidden text-gray-900" role="list" aria-label={t.suggestionsFor(q)}>
              <p className="px-4 pt-3 pb-1 text-xs text-gray-600">{t.suggestionsFor(q)}</p>
              {suggestions.map((a) => (
                <Link key={a.slug} to={hrefOf(a.slug)} role="listitem" {...early(a.slug)} onClick={() => trackEvent('blog_suggestion_click', { article_slug: a.slug })}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 border-t border-gray-100">
                  <span className="text-xl" aria-hidden="true">{a.image}</span>
                  <span className="text-sm font-medium line-clamp-1">{titleOf(a)}</span>
                </Link>
              ))}
              {list.length > suggestions.length && (
                <a href="#blog-results" className="block px-4 py-2.5 text-sm font-semibold text-primary-700 border-t border-gray-100 hover:bg-primary-50">{t.seeAll(list.length)}</a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 pb-10 max-w-3xl">
        {/* Topics: one swipeable row */}
        <div className="-mx-4 px-4 py-3 flex gap-2 overflow-x-auto snap-x" role="tablist" aria-label="Topics">
          {CATEGORIES.map((c) => (
            <button key={c.key} type="button" role="tab" aria-selected={category === c.key} onClick={() => setCategory(c.key)}
              className={`snap-start flex-shrink-0 px-3.5 py-2 rounded-full text-sm font-medium border transition-colors ${category === c.key ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-300 text-gray-800 hover:border-primary-400'}`}>
              <span aria-hidden="true">{c.icon}</span> {hi ? c.hi : c.en}
            </button>
          ))}
        </div>

        {isDefault && cont && (
          <Link to={`/blog/${cont.slug}${cont.hi ? '/hi' : ''}`} {...early(cont.slug)} className="mt-1 mb-4 flex items-center gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-3 hover:bg-primary-100">
            <span className="text-2xl" aria-hidden="true">{cont.image}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-primary-800">{t.continue} · {t.readPct(cont.pct)}</span>
              <span className="block text-sm font-semibold text-gray-900 line-clamp-1">{(hi && titlesHi && titlesHi[cont.slug]) || cont.title}</span>
              <span className="block h-1.5 mt-1.5 rounded-full bg-primary-100 overflow-hidden"><span className="block h-full bg-primary-600" style={{ width: `${cont.pct}%` }} /></span>
            </span>
          </Link>
        )}

        {isDefault && saved.length > 0 && (
          <section className="mb-5" aria-label={t.saved}>
            <h2 className="text-base font-bold text-gray-900 mb-2">{t.saved}</h2>
            <div className="-mx-4 px-4 flex gap-3 overflow-x-auto snap-x pb-1">
              {saved.map((s) => (
                <Link key={s.slug} to={hrefOf(s.slug)} {...early(s.slug)} className="snap-start flex-shrink-0 w-44 bg-white rounded-2xl border border-gray-100 p-3 shadow-sm hover:border-primary-200">
                  <span className="text-2xl" aria-hidden="true">{s.image}</span>
                  <span className="block text-sm font-semibold text-gray-900 mt-1 line-clamp-2">{(hi && titlesHi && titlesHi[s.slug]) || s.title}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {isDefault && popular.length > 0 && (
          <section className="mb-5" aria-label={t.popular}>
            <h2 className="text-base font-bold text-gray-900 mb-2">{t.popular}</h2>
            <div className="-mx-4 px-4 flex gap-3 overflow-x-auto snap-x pb-1">
              {popular.map(({ a, n }, i) => (
                <Link key={a.slug} to={hrefOf(a.slug)} {...early(a.slug)} className="snap-start flex-shrink-0 w-48 bg-white rounded-2xl border border-gray-100 p-3 shadow-sm hover:border-primary-200">
                  <span className="flex items-center justify-between">
                    <span className="text-2xl" aria-hidden="true">{a.image}</span>
                    <span className="text-xs font-bold text-gray-500">#{i + 1}</span>
                  </span>
                  <span className="block text-sm font-semibold text-gray-900 mt-1 line-clamp-2">{titleOf(a)}</span>
                  <span className="block text-xs text-gray-600 mt-1">{[n > 0 ? `👁 ${formatViews(n)}` : '', `${a.readTime} ${t.min}`].filter(Boolean).join(' · ')}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section id="blog-results" className="scroll-mt-20">
          <h2 className="text-base font-bold text-gray-900 mb-2">
            {q ? t.resultsFor(list.length, q) : category === 'all' ? t.latest : t.topicArticles(hi ? active.hi : active.en)}
          </h2>
          {list.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <div className="text-4xl mb-3" aria-hidden="true">🔍</div>
              <p className="font-semibold text-gray-800">{t.noResults(q)}</p>
              <p className="text-gray-600 text-sm mt-1">{t.noResultsHint}</p>
              <button type="button" onClick={() => { setQuery(''); setCategory('all'); }} className="mt-4 px-5 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700">{t.showAll}</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {list.slice(0, shown).map(card)}
              </div>
              {shown < list.length && (
                <div ref={sentinel} className="text-center mt-5">
                  <button type="button" onClick={() => setShown((n) => n + PAGE)} className="px-5 py-2.5 rounded-full border border-primary-600 text-primary-700 text-sm font-semibold hover:bg-primary-50">{t.more}</button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Readers here are often deciding whether to see a doctor */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-green-600 text-white p-4">
          <span className="font-semibold">{t.consult}</span>
          <Link to="/doctors" onClick={() => trackEvent('find_doctor_click', { source: 'blog_list_footer' })} className="px-4 py-2 rounded-lg bg-white text-green-800 text-sm font-bold hover:bg-green-50">{t.consultBtn}</Link>
        </div>
      </div>
    </div>
  );
}

export default BlogList;
