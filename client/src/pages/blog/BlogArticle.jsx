import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { articles } from './blogData';

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
        <div className="prose max-w-none">
          {article.content.map((block, idx) => {
            if (block.type === 'intro') {
              return <p key={idx} className="text-gray-700 text-lg leading-relaxed mb-6 border-l-4 border-primary-300 pl-4 italic">{block.text}</p>;
            }
            if (block.type === 'heading') {
              return <h2 key={idx} className="text-xl font-semibold text-gray-800 mt-6 mb-3">{block.text}</h2>;
            }
            if (block.type === 'paragraph') {
              return <p key={idx} className="text-gray-600 leading-relaxed mb-4 whitespace-pre-line">{block.text}</p>;
            }
            return null;
          })}
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

        {/* Related articles */}
        <div className="mt-10">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">More articles</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {articles.filter(a => a.slug !== slug).slice(0, 2).map(a => (
              <Link key={a.slug} to={`/blog/${a.slug}`} className="p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md transition-shadow">
                <span className="text-2xl">{a.image}</span>
                <h4 className="font-medium text-gray-800 mt-2 text-sm">{a.title}</h4>
                <span className="text-primary-600 text-xs mt-1 inline-block">Read →</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BlogArticle;
