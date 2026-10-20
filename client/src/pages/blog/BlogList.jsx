import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
// Use the lightweight, auto-generated metadata (titles/descriptions only, no
// article bodies) so the blog LIST page doesn't download every article's full
// text. blogMeta.js is generated from blogData.js at build time — same data,
// just without the heavy `content`. The article PAGE still uses blogData.
import { articleMeta as articles } from './blogMeta';
import { blogViewAPI } from '../../services/api';
import { trackEvent } from '../../components/Analytics';

// Format a read count compactly: 1240 -> "1.2k", 980 -> "980".
function formatViews(n) {
  if (n == null) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

// Per-specialty colour theme for article cards. Each entry drives the card's
// header gradient, the specialty chip, and the "Read article →" accent — so
// the grid reads like a lively, browsable magazine instead of 55 identical
// blue tiles. Anything unmapped falls back to the primary (blue) theme, so new
// specialties still look correct, just in brand blue.
const SPEC_THEME = {
  Cardiologist:        { grad: 'from-rose-400 to-rose-600',      chipBg: 'bg-rose-50',    chipText: 'text-rose-700',    link: 'text-rose-600',    border: 'hover:border-rose-200' },
  Gynaecologist:       { grad: 'from-pink-400 to-pink-600',      chipBg: 'bg-pink-50',    chipText: 'text-pink-700',    link: 'text-pink-600',    border: 'hover:border-pink-200' },
  Psychiatrist:        { grad: 'from-violet-400 to-violet-600',  chipBg: 'bg-violet-50',  chipText: 'text-violet-700',  link: 'text-violet-600',  border: 'hover:border-violet-200' },
  Gastroenterologist:  { grad: 'from-emerald-400 to-emerald-600',chipBg: 'bg-emerald-50', chipText: 'text-emerald-700', link: 'text-emerald-600', border: 'hover:border-emerald-200' },
  Endocrinologist:     { grad: 'from-amber-400 to-amber-600',    chipBg: 'bg-amber-50',   chipText: 'text-amber-700',   link: 'text-amber-600',   border: 'hover:border-amber-200' },
  Orthopedic:          { grad: 'from-orange-400 to-orange-600',  chipBg: 'bg-orange-50',  chipText: 'text-orange-700',  link: 'text-orange-600',  border: 'hover:border-orange-200' },
  Physiotherapist:     { grad: 'from-orange-400 to-orange-600',  chipBg: 'bg-orange-50',  chipText: 'text-orange-700',  link: 'text-orange-600',  border: 'hover:border-orange-200' },
  Dermatologist:       { grad: 'from-fuchsia-400 to-fuchsia-600',chipBg: 'bg-fuchsia-50', chipText: 'text-fuchsia-700', link: 'text-fuchsia-600', border: 'hover:border-fuchsia-200' },
  Pediatrician:        { grad: 'from-sky-400 to-sky-600',        chipBg: 'bg-sky-50',     chipText: 'text-sky-700',     link: 'text-sky-600',     border: 'hover:border-sky-200' },
  Neurologist:         { grad: 'from-indigo-400 to-indigo-600',  chipBg: 'bg-indigo-50',  chipText: 'text-indigo-700',  link: 'text-indigo-600',  border: 'hover:border-indigo-200' },
  Ophthalmologist:     { grad: 'from-teal-400 to-teal-600',      chipBg: 'bg-teal-50',    chipText: 'text-teal-700',    link: 'text-teal-600',    border: 'hover:border-teal-200' },
  'ENT Specialist':    { grad: 'from-cyan-400 to-cyan-600',      chipBg: 'bg-cyan-50',    chipText: 'text-cyan-700',    link: 'text-cyan-600',    border: 'hover:border-cyan-200' },
  Urologist:           { grad: 'from-cyan-400 to-cyan-600',      chipBg: 'bg-cyan-50',    chipText: 'text-cyan-700',    link: 'text-cyan-600',    border: 'hover:border-cyan-200' },
  Pulmonologist:       { grad: 'from-blue-400 to-blue-600',      chipBg: 'bg-blue-50',    chipText: 'text-blue-700',    link: 'text-blue-600',    border: 'hover:border-blue-200' },
  Dentist:             { grad: 'from-slate-400 to-slate-600',    chipBg: 'bg-slate-100',  chipText: 'text-slate-700',   link: 'text-slate-600',   border: 'hover:border-slate-300' },
  'General Physician': { grad: 'from-primary-400 to-primary-600',chipBg: 'bg-primary-50', chipText: 'text-primary-700', link: 'text-primary-600', border: 'hover:border-primary-200' },
};

const FALLBACK_THEME = { grad: 'from-primary-400 to-primary-600', chipBg: 'bg-primary-50', chipText: 'text-primary-700', link: 'text-primary-600', border: 'hover:border-primary-200' };

function themeFor(spec) {
  return SPEC_THEME[spec] || FALLBACK_THEME;
}

// Broad, friendly categories so ~55 articles feel browsable instead of
// overwhelming. Each maps to one or more of the underlying `specialization`
// values used on the articles. New specialties fall into "More" until mapped.
const CATEGORIES = [
  { label: 'All', icon: '📚', specs: null },
  { label: 'Heart & BP', icon: '❤️', specs: ['Cardiologist'] },
  { label: "Women's Health", icon: '🌸', specs: ['Gynaecologist'] },
  { label: 'Mental Health', icon: '🧠', specs: ['Psychiatrist'] },
  { label: 'Digestion', icon: '🍎', specs: ['Gastroenterologist'] },
  { label: 'Diabetes & Hormones', icon: '💉', specs: ['Endocrinologist'] },
  { label: 'Bones & Joints', icon: '🦴', specs: ['Orthopedic', 'Physiotherapist'] },
  { label: 'Skin & Hair', icon: '🧴', specs: ['Dermatologist'] },
  { label: 'Kids', icon: '👶', specs: ['Pediatrician'] },
  { label: 'Brain & Nerves', icon: '🧩', specs: ['Neurologist'] },
  { label: 'Eyes', icon: '👁️', specs: ['Ophthalmologist'] },
  { label: 'ENT', icon: '👂', specs: ['ENT Specialist'] },
  { label: 'Kidney & Urinary', icon: '💧', specs: ['Urologist'] },
  { label: 'Lungs', icon: '🫁', specs: ['Pulmonologist'] },
  { label: 'Dental', icon: '🦷', specs: ['Dentist'] },
  { label: 'General & Wellness', icon: '🩺', specs: ['General Physician'] },
];

// A short, hand-picked "Start Here" set for first-time visitors — broadly
// useful, high-interest reads so they aren't faced with 55 articles at once.
// Shown only on the default view (no search, "All" selected).
const START_HERE_SLUGS = [
  'why-preventive-health-checkups-matter',
  'silent-signs-high-blood-sugar',
  'high-bp-the-silent-killer',
  'stop-googling-symptoms-do-this-instead',
];

function BlogList() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  // Read counts and likes for all articles, as { slug: n } maps. Fetched once
  // on load. Powers the per-card "reads" badge, the "Most Read" section, and
  // the "Most Loved" section. Non-blocking: if it fails, the page just renders
  // without any numbers.
  const [views, setViews] = useState({});
  const [likes, setLikes] = useState({});
  useEffect(() => {
    let cancelled = false;
    blogViewAPI.getAll()
      .then(({ data }) => {
        if (cancelled || !data) return;
        if (data.counts) setViews(data.counts);
        if (data.likes) setLikes(data.likes);
      })
      .catch(() => { /* counter is a nice-to-have; ignore errors */ });
    return () => { cancelled = true; };
  }, []);

  // Total reads across all articles — a headline "X,XXX reads" number that
  // shows the blog is actively read (social proof). Only shown once > 0.
  const totalReads = Object.values(views).reduce((sum, n) => sum + (Number(n) || 0), 0);

  // Client-side filtering — all articles are already loaded, so we filter
  // instantly by category (a group of specializations) and search text.
  const q = query.trim().toLowerCase();
  const activeCategory = CATEGORIES.find((c) => c.label === category) || CATEGORIES[0];
  const sorted = [...articles].sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate));
  const filtered = sorted.filter((a) => {
    const categoryOk = !activeCategory.specs || activeCategory.specs.includes(a.specialization);
    const searchOk = !q || `${a.title} ${a.description} ${a.specialization}`.toLowerCase().includes(q);
    return categoryOk && searchOk;
  });

  // Show the "Start Here" strip only on the default, unfiltered view.
  const showStartHere = category === 'All' && !q;

  // Featured hero — one standout article at the top of the default view. We
  // pick the genuinely most-read article when we have view data; otherwise the
  // newest. It's pulled out of the grid below so it isn't shown twice. Only on
  // the default, unfiltered view so it never competes with search results.
  const featured = showStartHere
    ? (sorted
        .map((a) => ({ a, count: views[a.slug] || 0 }))
        .sort((x, y) => y.count - x.count)[0]?.a) || sorted[0]
    : null;
  // The slug of the single most-read article overall — used to stamp a "🔥
  // Most read" badge on exactly one card in the grid.
  const topReadSlug = Object.keys(views).length
    ? Object.entries(views).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0]
    : null;
  const startHere = showStartHere
    ? START_HERE_SLUGS.map((s) => articles.find((a) => a.slug === s)).filter(Boolean)
    : [];

  // "Most Read" — the genuinely most-viewed articles, ranked by real read
  // counts. Shown only on the default view, and only once we actually have
  // some views (so it doesn't show noise on a fresh counter). Top 6.
  const mostRead = showStartHere
    ? [...articles]
        .map((a) => ({ article: a, count: views[a.slug] || 0 }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
    : [];

  // "Most Loved" — the most ❤️-liked articles, ranked by like count. Same
  // rules: default view only, and only once there are real likes. Top 6.
  const mostLoved = showStartHere
    ? [...articles]
        .map((a) => ({ article: a, count: likes[a.slug] || 0 }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
    : [];

  return (
    <div>
      <SEO
        title="Health Blog — Expert Medical Articles"
        description="Read expert health articles on ProMedicoz. Learn about symptoms, when to see a doctor, treatment options, and preventive care tips."
        path="/blog"
      />

      {/* Gradient header band — consistent with Home/Doctors/Profile so the
          whole app shares one polished visual language. */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="container mx-auto px-4 pt-10 pb-20 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold">Health Blog</h1>
          <p className="text-primary-100 mt-2 text-sm sm:text-base">Expert articles to help you make informed health decisions</p>
          {/* Social proof: total reads across the blog + article count. Shows
              the blog is trusted and actively read across India. Only shows the
              reads figure once there's real data. */}
          <p className="text-primary-100/90 mt-2 text-xs sm:text-sm">
            {articles.length}+ articles
            {totalReads > 0 && <> · <span className="font-semibold text-white">{formatViews(totalReads)}</span> reads and counting</>}
          </p>

          {/* Conversion nudge: readers browsing health content are warm leads —
              offer a one-tap path to consult a doctor. Tracked so we can see how
              the blog list drives doctor-finding. */}
          <Link
            to="/doctors"
            onClick={() => trackEvent('find_doctor_click', { source: 'blog_list_header' })}
            className="inline-block mt-4 bg-white text-primary-700 px-5 py-2 rounded-full text-sm font-semibold hover:bg-primary-50 transition-colors"
          >
            Consult a doctor online →
          </Link>

          {/* Search box — filters instantly as you type (no button needed).
              The live result line + clear button make that obvious. */}
          <div className="max-w-lg mx-auto mt-6 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles (e.g. toothache, diabetes, headache)..."
              className="w-full pl-11 pr-11 py-3 rounded-full text-gray-800 outline-none focus:ring-2 focus:ring-white/60 shadow-md"
              aria-label="Search health articles"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          {/* Live feedback so it's obvious the search works as you type and the
              results are just below — no hidden "Search" button to hunt for. */}
          {q && (
            <p className="text-primary-100 text-sm mt-3">
              {filtered.length > 0
                ? `Showing ${filtered.length} ${filtered.length === 1 ? 'result' : 'results'} for “${query.trim()}” below ↓`
                : `No articles match “${query.trim()}”`}
            </p>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 pb-10">
        {/* Category filter chips — browse by broad topic with one tap */}
        <div className="max-w-5xl mx-auto -mt-4 mb-6 relative z-10 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.label}
              onClick={() => setCategory(c.label)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                category === c.label
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className="mr-1">{c.icon}</span>{c.label}
            </button>
          ))}
        </div>

        {/* Most Read — the actually most-viewed articles (by real read counts),
            ranked. A "what everyone's reading" list that both helps readers
            find popular content and encourages more reading. Shown only on the
            default view, and only once we have real view data. */}
        {mostRead.length > 0 && (
          <div className="max-w-5xl mx-auto mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">🔥 Most Read</h2>
            <p className="text-gray-500 text-sm mb-4">The articles readers across India are reading most right now.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mostRead.map(({ article: a, count }, i) => (
                <Link
                  key={a.slug}
                  to={`/blog/${a.slug}`}
                  className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-primary-200 transition-all flex gap-3 items-start"
                >
                  {/* Rank badge — a subtle "#1, #2…" that makes it feel like a
                      chart of popular reads. */}
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center">{i + 1}</span>
                  <div className="min-w-0">
                    <span className="block text-xs text-primary-600 font-medium">{a.specialization}</span>
                    <h3 className="font-medium text-gray-800 mt-0.5 text-sm line-clamp-2">{a.title}</h3>
                    <span className="text-xs text-gray-400 mt-1 inline-block">👁 {formatViews(count)} {count === 1 ? 'read' : 'reads'}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Most Loved — the most ❤️-liked articles, ranked. Reader-chosen
            favourites (vs Most Read which is just traffic). Shown only on the
            default view, and only once there are real likes. */}
        {mostLoved.length > 0 && (
          <div className="max-w-5xl mx-auto mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">❤️ Most Loved</h2>
            <p className="text-gray-500 text-sm mb-4">The articles readers loved most — hand-picked by our readers, not us.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mostLoved.map(({ article: a, count }, i) => (
                <Link
                  key={a.slug}
                  to={`/blog/${a.slug}`}
                  className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-red-200 transition-all flex gap-3 items-start"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-red-500 text-white text-sm font-bold flex items-center justify-center">{i + 1}</span>
                  <div className="min-w-0">
                    <span className="block text-xs text-primary-600 font-medium">{a.specialization}</span>
                    <h3 className="font-medium text-gray-800 mt-0.5 text-sm line-clamp-2">{a.title}</h3>
                    <span className="text-xs text-gray-400 mt-1 inline-block">❤️ {formatViews(count)} {count === 1 ? 'like' : 'likes'}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Start Here — a friendly on-ramp for first-time visitors, shown only
            on the default view so it never gets in the way of searching. */}
        {startHere.length > 0 && (
          <div className="max-w-5xl mx-auto mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">✨ Start Here</h2>
            <p className="text-gray-500 text-sm mb-4">New here? These popular reads are a great place to begin.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {startHere.map((a) => (
                <Link
                  key={a.slug}
                  to={`/blog/${a.slug}`}
                  className="bg-white border border-primary-100 rounded-xl p-4 hover:shadow-md hover:border-primary-300 transition-all block"
                >
                  <div className="text-3xl mb-2">{a.image}</div>
                  <span className="block text-xs text-primary-600 font-medium">{a.specialization}</span>
                  <h3 className="font-medium text-gray-800 mt-1 text-sm line-clamp-2">{a.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Featured read — one standout article as a wide 2-panel hero at the
            top of the default view. Gives first-time visitors a clear, inviting
            entry point instead of a flat wall of equal cards. */}
        {featured && (
          <div className="max-w-5xl mx-auto mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-primary-600" aria-hidden="true" />
              Featured read
            </h2>
            <p className="text-gray-500 text-sm mb-4">A great place to start today.</p>
            <Link
              to={`/blog/${featured.slug}`}
              className="card-lift group flex flex-col sm:flex-row bg-white rounded-2xl shadow-md overflow-hidden"
            >
              <div className={`sm:w-64 flex-shrink-0 bg-gradient-to-br ${themeFor(featured.specialization).grad} flex items-center justify-center py-10 sm:py-0`}>
                <span className="text-6xl drop-shadow-sm">{featured.image}</span>
              </div>
              <div className="p-6 flex flex-col justify-center">
                <span className={`self-start px-2.5 py-0.5 rounded-full text-xs font-semibold ${themeFor(featured.specialization).chipBg} ${themeFor(featured.specialization).chipText}`}>
                  {featured.specialization}
                </span>
                <h3 className="font-bold text-gray-900 text-xl mt-3 leading-snug">{featured.title}</h3>
                <p className="text-gray-500 text-sm mt-2 line-clamp-2">{featured.description}</p>
                <div className="flex items-center gap-2 mt-4 text-xs text-gray-400">
                  <span>{featured.readTime} read</span>
                  {views[featured.slug] > 0 && (
                    <>
                      <span>•</span>
                      <span>👁 {formatViews(views[featured.slug])} reads</span>
                    </>
                  )}
                </div>
                <span className={`text-sm font-semibold mt-3 inline-block ${themeFor(featured.specialization).link}`}>Read article →</span>
              </div>
            </Link>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-medium text-gray-700">No articles found{query ? ` for “${query}”` : ''}</h3>
            <p className="text-gray-500 mt-2">Try a different word or topic, or browse all articles.</p>
            <button
              onClick={() => { setQuery(''); setCategory('All'); }}
              className="mt-5 inline-block bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Show all articles
            </button>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
          {q && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                {filtered.length} {filtered.length === 1 ? 'result' : 'results'} for “{query.trim()}”
              </h2>
              <button
                onClick={() => { setQuery(''); setCategory('All'); }}
                className="text-primary-600 hover:underline text-sm font-medium"
              >
                Clear search
              </button>
            </div>
          )}
          {/* Section heading for the main grid on the default view (when there
              are curated strips above it, this labels where "everything" starts). */}
          {showStartHere && (
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-primary-600" aria-hidden="true" />
              All articles
            </h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* On the default view the featured article is already shown as the
                hero above, so drop it from the grid to avoid a duplicate. */}
            {filtered
              .filter((article) => !(featured && article.slug === featured.slug))
              .map((article) => {
                const theme = themeFor(article.specialization);
                const isTopRead = topReadSlug && article.slug === topReadSlug;
                return (
                  <Link
                    key={article.slug}
                    to={`/blog/${article.slug}`}
                    className={`card-lift bg-white rounded-2xl shadow-md border border-transparent ${theme.border} overflow-hidden block transition-all`}
                  >
                    {/* Category-colored header — gives each card a distinct,
                        topic-driven look so the grid reads like a magazine. */}
                    <div className={`relative h-28 bg-gradient-to-br ${theme.grad} flex items-center justify-center`}>
                      <span className="text-5xl drop-shadow-sm">{article.image}</span>
                      {isTopRead && (
                        <span className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-sm text-rose-600 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                          🔥 Most read
                        </span>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${theme.chipBg} ${theme.chipText}`}>{article.specialization}</span>
                        <span className="text-xs text-gray-400">{article.readTime} read</span>
                        {/* Per-card read count — only shown for articles that
                            have been read, so fresh articles don't show "0". */}
                        {views[article.slug] > 0 && (
                          <>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-400">👁 {formatViews(views[article.slug])}</span>
                          </>
                        )}
                      </div>
                      <h2 className="font-semibold text-gray-800 mb-2 line-clamp-2">{article.title}</h2>
                      <p className="text-gray-500 text-sm line-clamp-2">{article.description}</p>
                      <span className={`text-sm font-semibold mt-3 inline-block ${theme.link}`}>Read article →</span>
                    </div>
                  </Link>
                );
              })}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BlogList;
