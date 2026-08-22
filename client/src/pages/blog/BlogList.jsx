import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { articles } from './blogData';

function BlogList() {
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
        <div className="container mx-auto px-4 pt-10 pb-16 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold">Health Blog</h1>
          <p className="text-primary-100 mt-2 text-sm sm:text-base">Expert articles to help you make informed health decisions</p>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto -mt-8 relative z-10">
        {/* Newest first — so recently added articles surface at the top
            instead of being buried at the end of the list. */}
        {[...articles].sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate)).map((article) => (
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
      </div>
    </div>
  );
}

export default BlogList;
