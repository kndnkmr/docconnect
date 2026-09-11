import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { articles } from './blogData';

// Parse simple **bold** markers inside a text string into React nodes, so
// writers can emphasise key phrases without any HTML. Everything else stays
// plain text (safe — no dangerouslySetInnerHTML).
function renderInline(text) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-gray-800">{part.slice(2, -2)}</strong>;
    }
    return part;
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
function renderBlock(block, idx) {
  switch (block.type) {
    case 'intro':
      return <p key={idx} className="text-gray-700 text-lg leading-relaxed mb-6 border-l-4 border-primary-400 pl-4 italic">{renderInline(block.text)}</p>;

    case 'heading':
      return <h2 key={idx} className="text-2xl font-bold text-gray-800 mt-10 mb-4">{renderInline(block.text)}</h2>;

    case 'paragraph':
      return <p key={idx} className="text-gray-700 leading-relaxed mb-5 whitespace-pre-line text-[1.05rem]">{renderInline(block.text)}</p>;

    case 'list':
      return (
        <ul key={idx} className="mb-6 space-y-2">
          {(block.items || []).map((item, i) => (
            <li key={i} className="flex gap-3 text-gray-700 leading-relaxed">
              <span className="text-primary-500 mt-1 flex-shrink-0">●</span>
              <span>{renderInline(item)}</span>
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
              {block.text && <p className="text-gray-700 leading-relaxed whitespace-pre-line">{renderInline(block.text)}</p>}
              {block.items && (
                <ul className="space-y-1.5 mt-1">
                  {block.items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-gray-700 leading-relaxed">
                      <span className="flex-shrink-0">{s.icon === '⚠️' ? '•' : '•'}</span>
                      <span>{renderInline(item)}</span>
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

  // Private "was this helpful?" feedback — local only (no backend, no public
  // counter). Just lets a reader give a quick reaction and remembers it on
  // this device so we don't nag them again. No spam/moderation/misinfo risk.
  const feedbackKey = `blog_feedback_${slug}`;
  const [feedback, setFeedback] = useState(() => {
    try { return localStorage.getItem(feedbackKey) || ''; } catch { return ''; }
  });
  const giveFeedback = (value) => {
    setFeedback(value);
    try { localStorage.setItem(feedbackKey, value); } catch { /* ignore */ }
    toast.success('Thanks for your feedback!');
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

  // Article structured data for Google
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: article.publishedDate,
    author: { '@type': 'Organization', name: 'ProMedicoz' },
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
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">{article.title}</h1>
          <p className="text-lg text-gray-600">{article.description}</p>
        </div>

        {/* Content */}
        <div className="max-w-none">
          {article.content.map((block, idx) => renderBlock(block, idx))}
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
          <button onClick={nativeShare} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">📤 Share</button>
          <button onClick={copyLink} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">🔗 Copy link</button>
        </div>

        {/* Was this helpful? — private feedback (local only), not a public counter */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-wrap items-center gap-3">
          {feedback ? (
            <p className="text-sm text-gray-600">Thanks for your feedback! 🙏</p>
          ) : (
            <>
              <span className="text-sm font-medium text-gray-700">Was this article helpful?</span>
              <button onClick={() => giveFeedback('up')} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-white" aria-label="Helpful">👍 Yes</button>
              <button onClick={() => giveFeedback('down')} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-white" aria-label="Not helpful">👎 No</button>
            </>
          )}
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
