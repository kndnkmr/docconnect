// ============================================
// Thesis List Page - Browse Public Publications
// ============================================
// Anyone can browse published research papers by doctors.
// Supports search by keyword and filter by tag.
//
// KEY CONCEPTS:
// - Public page (no login needed)
// - Search + tag filtering
// - Card layout with truncated abstracts
// - Link to full detail page via slug

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { thesisAPI } from '../services/api';
import toast from 'react-hot-toast';

function ThesisList() {
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalPublications: 0
  });

  // Search/filter state
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Fetch publications
  const fetchPublications = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 9 };
      if (search) params.search = search;
      if (tag) params.tag = tag;
      if (sortBy === 'popular') params.sort = 'popular';
      if (sortBy === 'oldest') params.sort = 'oldest';

      const response = await thesisAPI.getAll(params);
      setPublications(response.data.publications);
      setPagination(response.data.pagination);
    } catch (error) {
      toast.error('Failed to load publications');
      console.error('Fetch publications error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on first load
  useEffect(() => {
    fetchPublications();
  }, []);

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    fetchPublications(1);
  };

  // Pagination
  const goToPage = (page) => {
    fetchPublications(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Medical Publications</h1>
        <p className="text-gray-600 mt-2">
          Browse research papers and thesis shared by our doctors
        </p>
      </div>

      {/* Search and filter bar */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Keyword search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or abstract..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Tag filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g., cardiology"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Sort + search button */}
          <div className="flex items-end gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="newest">Newest</option>
              <option value="popular">Most Viewed</option>
              <option value="oldest">Oldest</option>
            </select>
            <button
              type="submit"
              className="bg-primary-600 text-white py-2 px-6 rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Search
            </button>
          </div>
        </div>
      </form>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-lg text-gray-600">Loading publications...</div>
        </div>
      ) : publications.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">📚</div>
          <h3 className="text-xl font-medium text-gray-700">No publications found</h3>
          <p className="text-gray-500 mt-2">Try different search terms or tags</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {publications.map((pub) => (
            <Link
              key={pub._id}
              to={`/publications/${pub.slug}`}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden block"
            >
              {/* Colored top bar */}
              <div className="h-2 bg-gradient-to-r from-primary-500 to-primary-700"></div>

              <div className="p-6">
                {/* Title */}
                <h3 className="text-lg font-semibold text-gray-800 line-clamp-2">
                  {pub.title}
                </h3>
                {/* line-clamp-2 = show max 2 lines, truncate with ... */}

                {/* Author */}
                <p className="text-primary-600 text-sm font-medium mt-2">
                  {pub.author?.name || 'Unknown Author'}
                  {pub.author?.specialization && ` • ${pub.author.specialization}`}
                </p>

                {/* Abstract preview */}
                <p className="text-gray-600 text-sm mt-3 line-clamp-3">
                  {pub.abstract}
                </p>

                {/* Tags */}
                {pub.tags && pub.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {pub.tags.slice(0, 3).map((t, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                      >
                        {t}
                      </span>
                    ))}
                    {pub.tags.length > 3 && (
                      <span className="text-gray-400 text-xs">+{pub.tags.length - 3} more</span>
                    )}
                  </div>
                )}

                {/* Footer: date + views */}
                <div className="flex justify-between items-center mt-4 pt-4 border-t text-sm text-gray-500">
                  <span>{formatDate(pub.createdAt)}</span>
                  <span>{pub.viewCount} views</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-8">
          <button
            onClick={() => goToPage(pagination.currentPage - 1)}
            disabled={pagination.currentPage <= 1}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-gray-600 px-4">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <button
            onClick={() => goToPage(pagination.currentPage + 1)}
            disabled={pagination.currentPage >= pagination.totalPages}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default ThesisList;
