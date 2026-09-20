import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { articles } from './blogData';
import { blogViewAPI } from '../../services/api';
import { INTERNAL_LINKS } from './linkMap';

// ---- Internal auto-linking ----
// Turn key topic phrases in the body into links to their article (big SEO win
// + keeps readers moving between articles). See linkMap.js for the rationale
// and the curated phrase→slug map.
//
// We precompile the phrase list once: sorted LONGEST-first so a specific phrase
// ("high blood pressure") wins over a shorter overlapping one, and escaped for
// safe use in a regex. Matching is whole-word and case-insensitive.
const LINK_PHRASES = Object.keys(INTERNAL_LINKS).sort((a, b) => b.length - a.length);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// One combined regex with word boundaries; \b keeps us from linking inside a
// larger word (e.g. "stroke" inside "strokes" still matches on the word, but
// not inside unrelated letters).
const LINK_REGEX = LINK_PHRASES.length
  ? new RegExp(`\\b(${LINK_PHRASES.map(escapeRegex).join('|')})\\b`, 'gi')
  : null;

// Turn a plain string into an array of text + <Link> nodes. `ctx` carries the
// current article slug (so we never self-link) and a shared `used` Set (so each
// target article is linked at most once per article — no spammy repeats).
function linkifyText(text, ctx, keyPrefix) {
  if (!text || !LINK_REGEX || !ctx) return text;

  const out = [];
  let lastIndex = 0;
  let match;
  let n = 0;
  LINK_REGEX.lastIndex = 0;

  while ((match = LINK_REGEX.exec(text)) !== null) {
    const phrase = match[0];
    const slug = INTERNAL_LINKS[phrase.toLowerCase()];

    // Skip if: no mapping, it's the current article, or we've already linked
    // this target once in this article.
    if (!slug || slug === ctx.currentSlug || ctx.used.has(slug)) {
      continue;
    }

    ctx.used.add(slug);

    // Push the text before the match, then the link.
    if (match.index > lastIndex) out.push(text.slice(lastIndex, match.index));
    out.push(
      <Link
        key={`${keyPrefix}-lnk-${n++}`}
        to={`/blog/${slug}`}
        className="text-primary-600 underline decoration-primary-300 underline-offset-2 hover:text-primary-700"
      >
        {phrase}
      </Link>
    );
    lastIndex = match.index + phrase.length;
  }

  if (lastIndex === 0) return text; // no links added — return original string
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}

// Parse simple **bold** markers inside a text string into React nodes, so
// writers can emphasise key phrases without any HTML. Everything else stays
// plain text (safe — no dangerouslySetInnerHTML).
//
// `ctx` (optional) enables internal auto-linking of the non-bold segments.
// Bold segments are left as-is (not linked) to keep emphasis clean.
function renderInline(text, ctx) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-gray-800">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{ctx ? linkifyText(part, ctx, `i${i}`) : part}</span>;
  });
}

// Callout box styling by variant — a colored, icon-led box that makes tips,
// warnings, and takeaways pop out of the page.
const CALLOUT_STYLES = {
  tip: { box: 'bg-blue-50 border-blue-200', icon: '💡', label: 'text-blue-800' },
  warning: { box: 'bg-red-50 border-red-200', icon: '⚠️', label: 'text-red-800' },
  success: { box: 'bg-green-50 border-green-200', icon: '✅', label: 'text-green-800' },
  info: { box: 'bg-primary-50 border-primary-200', icon: 'ℹ️', label: 'text-primary-800' },
};

// Renders one content block. Supported types (all backward-compatible — the
// original intro/heading/paragraph still work exactly as before):
//   intro      — lead paragraph (accent bar)
//   heading    — section title
//   paragraph  — body text (supports **bold**, and \n line breaks)
//   list       — { items: [] } styled bullet list (supports **bold**)
//   callout    — { variant:'tip|warning|success|info', title?, text? , items?[] }
//   table      — { headers: [], rows: [[]] } comparison table
//   steps      — { items: [] } numbered visual step flow
// `ctx` = { currentSlug, used } enables internal auto-linking. We link the body
// prose (paragraph, list, callout text/items) but deliberately NOT headings,
// the intro, tables, or step labels — those read best clean.
function renderBlock(block, idx, ctx) {
  switch (block.type) {
    case 'intro':
      return <p key={idx} className="text-gray-700 text-lg leading-relaxed mb-6 border-l-4 border-primary-400 pl-4 italic">{renderInline(block.text)}</p>;

    case 'heading':
      return <h2 key={idx} className="text-2xl font-bold text-gray-800 mt-10 mb-4">{renderInline(block.text)}</h2>;

    case 'paragraph':
      return <p key={idx} className="text-gray-700 leading-relaxed mb-5 whitespace-pre-line text-[1.05rem]">{renderInline(block.text, ctx)}</p>;

    case 'list':
      return (
        <ul key={idx} className="mb-6 space-y-2">
          {(block.items || []).map((item, i) => (
            <li key={i} className="flex gap-3 text-gray-700 leading-relaxed">
              <span className="text-primary-500 flex-shrink-0 leading-relaxed select-none" aria-hidden="true">•</span>
              <span className="flex-1">{renderInline(item, ctx)}</span>
            </li>
          ))}
        </ul>
      );

    case 'callout': {
      const s = CALLOUT_STYLES[block.variant] || CALLOUT_STYLES.info;
      return (
        <div key={idx} className={`my-6 rounded-xl border p-4 sm:p-5 ${s.box}`}>
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">{s.icon}</span>
            <div className="flex-1">
              {block.title && <p className={`font-semibold mb-1 ${s.label}`}>{renderInline(block.title)}</p>}
              {block.text && <p className="text-gray-700 leading-relaxed whitespace-pre-line">{renderInline(block.text, ctx)}</p>}
              {block.items && (
                <ul className="space-y-1.5 mt-1">
                  {block.items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-gray-700 leading-relaxed">
                      <span className="flex-shrink-0 leading-relaxed select-none" aria-hidden="true">•</span>
                      <span className="flex-1">{renderInline(item, ctx)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      );
    }

    case 'table':
      return (
        <div key={idx} className="my-6 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-primary-50">
                {(block.headers || []).map((h, i) => (
                  <th key={i} className="text-left font-semibold text-gray-800 p-3 border border-gray-200">{renderInline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(block.rows || []).map((row, r) => (
                <tr key={r} className={r % 2 ? 'bg-gray-50' : 'bg-white'}>
                  {row.map((cell, c) => (
                    <td key={c} className={`p-3 border border-gray-200 text-gray-700 align-top ${c === 0 ? 'font-medium text-gray-800' : ''}`}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'steps':
      return (
        <ol key={idx} className="my-6 space-y-3">
          {(block.items || []).map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center">{i + 1}</span>
              <span className="text-gray-700 leading-relaxed pt-0.5">{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );

    default:
      return null;
  }
}

function BlogArticle() {
  const { slug } = useParams();
  const article = articles.find(a => a.slug === slug);

  // ---- Language (English | Hinglish) ----
  // Some articles have a Hinglish version (contentHi) for readers who find
  // English hard. The toggle only appears when contentHi exists; otherwise the
  // article stays English exactly as before. Default is always English.
  const hasHindi = Array.isArray(article?.contentHi) && article.contentHi.length > 0;
  const [lang, setLang] = useState('en');
  // If the reader navigates to a different article that has no Hinglish
  // version, fall back to English so we never try to render a missing array.
  useEffect(() => { setLang('en'); }, [slug]);
  const activeContent = (lang === 'hi' && hasHindi) ? article.contentHi : article?.content;

  // ---- ❤️ Like ----
  // A friendly heart "like" backed by our DB (no dislike — deliberately, on a
  // health blog). This browser remembers whether IT has liked the article, so
  // the reader can toggle their own like on/off; the visible number is the
  // aggregate like count across everyone. Powers the "Most Loved" section too.
  const likedKey = `blog_liked_${slug}`;
  const [liked, setLiked] = useState(() => {
    try { return localStorage.getItem(likedKey) === '1'; } catch { return false; }
  });
  const [likeCount, setLikeCount] = useState(null);

  const toggleLike = async () => {
    const next = !liked;
    // Optimistic update so the heart feels instant.
    setLiked(next);
    setLikeCount((c) => Math.max(0, (c ?? 0) + (next ? 1 : -1)));
    try { localStorage.setItem(likedKey, next ? '1' : '0'); } catch { /* ignore */ }
    try {
      const { data } = await blogViewAPI.setLike(slug, next);
      if (data && typeof data.likes === 'number') setLikeCount(data.likes);
    } catch {
      // Roll back the optimistic change if the server call failed.
      setLiked(!next);
      setLikeCount((c) => Math.max(0, (c ?? 0) + (next ? -1 : 1)));
      toast.error('Could not save your like. Please try again.');
    }
  };

  // ---- Public "reads" counter (our own numbers, stored in our DB) ----
  // Shows how many times this article has been read, as light social proof.
  // Behaviour:
  //   - On open, fetch the current count to display.
  //   - Record ONE view per browser per article at most once every few hours
  //     (throttled via localStorage) so a refresh or quick re-open doesn't
  //     inflate the number. The increment endpoint returns the fresh count,
  //     which we then show (so the reader sees their own view included).
  //   - Fully non-blocking: if the API is unreachable, we just don't show a
  //     number — the article renders exactly as before.
  const [views, setViews] = useState(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const VIEW_THROTTLE_MS = 4 * 60 * 60 * 1000; // 4 hours per browser per article
    const throttleKey = `blog_viewed_${slug}`;

    const shouldCount = () => {
      try {
        const last = Number(localStorage.getItem(throttleKey) || 0);
        return !last || Date.now() - last > VIEW_THROTTLE_MS;
      } catch {
        return true;
      }
    };

    const run = async () => {
      try {
        if (shouldCount()) {
          // Record a view and use the returned fresh counts.
          const { data } = await blogViewAPI.increment(slug);
          if (!cancelled && data) {
            setViews(data.count);
            if (typeof data.likes === 'number') setLikeCount(data.likes);
          }
          try { localStorage.setItem(throttleKey, String(Date.now())); } catch { /* ignore */ }
        } else {
          // Already counted recently — just read the current counts to display.
          const { data } = await blogViewAPI.get(slug);
          if (!cancelled && data) {
            setViews(data.count);
            if (typeof data.likes === 'number') setLikeCount(data.likes);
          }
        }
      } catch {
        // Silent: counter is a nice-to-have, never block the article.
      }
    };

    run();
    return () => { cancelled = true; };
  }, [slug]);

  // Format a count compactly: 1240 -> "1.2k", 980 -> "980".
  const formatViews = (n) => {
    if (n == null) return null;
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
    return String(n);
  };

  // Share the article (grows reach via word of mouth — the safe alternative
  // to a public comment section on a health blog).
  const articleUrl = `https://www.promedicoz.in/blog/${slug}`;
  const shareText = article ? `${article.title} — ProMedicoz\n${articleUrl}` : articleUrl;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(articleUrl); toast.success('Link copied!'); }
    catch { window.prompt('Copy this link:', articleUrl); }
  };
  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: article?.title, text: article?.title, url: articleUrl }); return; } catch { /* cancelled */ }
    }
    copyLink();
  };
  // Instagram gives websites NO way to post a link directly (its API forbids
  // it). The closest real path: on a phone, the native share sheet lets the
  // user "Share to Instagram Story"; on desktop there's no such option, so we
  // copy the link and tell them to paste it into their bio / Story. This keeps
  // the promise honest instead of pretending a direct post is possible.
  const shareInstagram = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: article?.title, text: article?.title, url: articleUrl }); return; } catch { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(articleUrl); }
    catch { window.prompt('Copy this link:', articleUrl); }
    toast('Link copied — open Instagram and paste it in your Story or bio 📸', { icon: '📸' });
  };

  if (!article) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-800">Article not found</h1>
        <Link to="/blog" className="text-primary-600 hover:underline mt-4 inline-block">← Back to blog</Link>
      </div>
    );
  }

  // Related articles: same specialty first (most relevant to what the reader
  // is already interested in), then fill up to 3 with other recent articles.
  const others = articles.filter(a => a.slug !== slug);
  const sameSpecialty = others
    .filter(a => a.specialization === article.specialization)
    .sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate));
  const rest = others
    .filter(a => a.specialization !== article.specialization)
    .sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate));
  const relatedArticles = [...sameSpecialty, ...rest].slice(0, 3);

  // Article structured data for Google. Richer fields (image, dateModified,
  // mainEntityOfPage) improve eligibility for article rich results. We reuse
  // the site's OG image since articles use an emoji, not a photo.
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    image: 'https://www.promedicoz.in/og-image.png',
    datePublished: article.publishedDate,
    dateModified: article.publishedDate,
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
    author: { '@type': 'Organization', name: 'ProMedicoz', url: 'https://www.promedicoz.in' },
    publisher: { '@type': 'Organization', name: 'ProMedicoz', logo: { '@type': 'ImageObject', url: 'https://www.promedicoz.in/icons/icon-512.png' } }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <SEO
        title={article.title}
        description={article.description}
        path={`/blog/${slug}`}
        type="article"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
      </Helmet>

      <div className="max-w-3xl mx-auto">
        <Link to="/blog" className="text-primary-600 hover:underline text-sm mb-6 inline-block">← Back to all articles</Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs font-medium">{article.specialization}</span>
            <span className="text-xs text-gray-400">{article.readTime} read</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-400">{new Date(article.publishedDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            {/* Public read counter — only shown once we have a number, so the
                header doesn't flash an empty element while it loads. */}
            {views != null && (
              <>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-400">👁 {formatViews(views)} {views === 1 ? 'read' : 'reads'}</span>
              </>
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">{article.title}</h1>
          <p className="text-lg text-gray-600">{article.description}</p>
        </div>

        {/* Language toggle — only shown for articles that have a Hinglish
            version. Lets readers who find English hard switch to Hinglish
            (Hindi in Roman letters). Defaults to English. */}
        {hasHindi && (
          <div className="mb-6 flex items-center gap-2">
            <span className="text-sm text-gray-500">भाषा / Language:</span>
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setLang('en')}
                aria-pressed={lang === 'en'}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${lang === 'en' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >English</button>
              <button
                type="button"
                onClick={() => setLang('hi')}
                aria-pressed={lang === 'hi'}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-300 ${lang === 'hi' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >हिंदी (Hinglish)</button>
            </div>
          </div>
        )}

        {/* Content — `linkCtx` is created fresh per render so internal
            auto-links are deduped across the whole article (each target linked
            once) and never link back to this same article. Renders either the
            English content or, when the reader picks it, the Hinglish version. */}
        <div className="max-w-none">
          {(() => {
            const linkCtx = { currentSlug: slug, used: new Set() };
            return activeContent.map((block, idx) => renderBlock(block, idx, linkCtx));
          })()}
        </div>

        {/* CTA */}
        <div className="mt-10 p-6 bg-primary-50 border border-primary-200 rounded-xl text-center">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Need a {article.specialization} consultation?</h3>
          <p className="text-gray-600 text-sm mb-4">Book an appointment with a verified {article.specialization.toLowerCase()} on ProMedicoz. Video, phone, or in-person.</p>
          <Link
            to={`/doctors?specialization=${encodeURIComponent(article.specialization)}`}
            className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            Find {article.specialization} Doctors
          </Link>
        </div>

        {/* Share this article — safe engagement that grows reach (vs a public
            comment section, which we deliberately avoid on a health blog). */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Found this useful? Share it:</span>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
          >💬 WhatsApp</a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`}
            target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-medium hover:bg-[#0d65d9]"
          >📘 Facebook</a>
          <button
            onClick={shareInstagram}
            className="px-4 py-2 text-white rounded-lg text-sm font-medium bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] hover:opacity-90"
          >📸 Instagram</button>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article?.title ? article.title + ' — ProMedicoz' : 'ProMedicoz')}&url=${encodeURIComponent(articleUrl)}`}
            target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"
          >𝕏 Twitter</a>
          <button onClick={nativeShare} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">📤 Share</button>
          <button onClick={copyLink} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">🔗 Copy link</button>
        </div>

        {/* ❤️ Like — a friendly heart backed by our DB, with a visible count.
            Toggles this browser's own like on/off; the number is the total
            across all readers. Feeds the "Most Loved" section on the blog list. */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">{liked ? 'Glad you loved it!' : 'Enjoyed this article?'}</span>
          <button
            onClick={toggleLike}
            aria-pressed={liked}
            aria-label={liked ? 'Unlike this article' : 'Like this article'}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              liked
                ? 'bg-red-50 border-red-200 text-red-600'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
            }`}
          >
            <span className={`text-lg leading-none ${liked ? '' : 'grayscale'}`}>{liked ? '❤️' : '🤍'}</span>
            <span>{liked ? 'Liked' : 'Like'}</span>
            {likeCount != null && likeCount > 0 && (
              <span className={`ml-1 ${liked ? 'text-red-600' : 'text-gray-500'}`}>{formatViews(likeCount)}</span>
            )}
          </button>
        </div>

        {/* Related articles — prefer the SAME specialty first (so a reader on
            "cholesterol" is offered "high BP", "belly fat", etc.), then fill
            with other recent articles. This keeps people reading instead of
            bouncing after one article. */}
        <div className="mt-10">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">More to read</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedArticles.map(a => (
              <Link key={a.slug} to={`/blog/${a.slug}`} className="p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md transition-shadow">
                <span className="text-2xl">{a.image}</span>
                <span className="block text-xs text-primary-600 font-medium mt-2">{a.specialization}</span>
                <h4 className="font-medium text-gray-800 mt-1 text-sm line-clamp-2">{a.title}</h4>
                <span className="text-primary-600 text-xs mt-2 inline-block">Read →</span>
              </Link>
            ))}
          </div>
          <div className="mt-5 text-center">
            <Link to="/blog" className="text-primary-600 hover:underline text-sm font-medium">Browse all health articles →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BlogArticle;
