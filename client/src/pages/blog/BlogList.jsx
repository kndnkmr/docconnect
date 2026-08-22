import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { articles } from './blogData';

function BlogList() {
  const [query, setQuery] = useState('');

  // Client-side search — all articles are already loaded, so we filter
  // instantly across title, description, and specialization. No backend needed.
  const q = query.trim().toLowerCase();
  const sorted = [...articles].sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate));
  const filtered = q
    ? sorted.filter((a) =>
        `${a.title} ${a.description} ${a.specialization}`.toLowerCase().includes(q)
      )
    : sorted;

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

          {/* Search box */}
          <div className="max-w-lg mx-auto mt-6 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles (e.g. toothache, diabetes, headache)..."
              className="w-full pl-11 pr-4 py-3 rounded-full text-gray-800 outline-none focus:ring-2 focus:ring-white/60 shadow-md"
              aria-label="Search health articles"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-10">
        {filtered.length === 0 ? (
          <div className="text-center py-16 -mt-8 relative z-10">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-medium text-gray-700">No articles found for “{query}”</h3>
            <p className="text-gray-500 mt-2">Try a different word, or browse all articles.</p>
            <button
              onClick={() => setQuery('')}
              className="mt-5 inline-block bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Show all articles
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto -mt-8 relative z-10">
            {filtered.map((article) => (
              <Link
                key={article.slug}
                to={`/blog/${article.slug}`}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden block"
              >
                <div className="h-32 bg-gradient-to-r from-primary-100 to-primary-200 flex items-center justify-center">
                  <span className="text-5xl">{article.image}</span>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs font-medium">{article.specialization}</span>
                    <span className="text-xs text-gray-400">{article.readTime} read</span>
                  </div>
                  <h2 className="font-semibold text-gray-800 mb-2 line-clamp-2">{article.title}</h2>
                  <p className="text-gray-500 text-sm line-clamp-2">{article.description}</p>
                  <span className="text-primary-600 text-sm font-medium mt-3 inline-block">Read article →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BlogList;
