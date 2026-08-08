import { useParams, Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { Helmet } from 'react-helmet-async';
import { articles } from './blogData';

function BlogArticle() {
  const { slug } = useParams();
  const article = articles.find(a => a.slug === slug);

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
