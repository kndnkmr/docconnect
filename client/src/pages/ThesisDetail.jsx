// ============================================
// Thesis Detail Page - View Full Publication
// ============================================
// Displays the full content of a thesis/publication.
// Accessed via the share link (slug in the URL).
//
// KEY CONCEPTS:
// - useParams to get the slug from URL
// - Display rich content (title, abstract, full text, tags)
// - Show author info
// - View count (incremented on the backend when fetched)

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { thesisAPI } from '../services/api';
import toast from 'react-hot-toast';

function ThesisDetail() {
  const { slug } = useParams();
  // URL: /publications/:slug → slug = "heart-disease-prevention-abc123"

  const [thesis, setThesis] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch thesis by slug
  useEffect(() => {
    const fetchThesis = async () => {
      try {
        const response = await thesisAPI.getBySlug(slug);
        setThesis(response.data.thesis);
      } catch (error) {
        console.error('Fetch thesis error:', error);
        toast.error('Publication not found');
      } finally {
        setLoading(false);
      }
    };
    fetchThesis();
  }, [slug]);

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg text-gray-600">Loading publication...</div>
      </div>
    );
  }

  // Not found
  if (!thesis) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl mb-4">📄</div>
          <h2 className="text-2xl font-bold text-gray-800">Publication Not Found</h2>
          <p className="text-gray-600 mt-2">
            This publication doesn't exist, was removed, or is private.
          </p>
          <Link to="/publications" className="text-primary-600 hover:underline mt-4 inline-block">
            ← Browse all publications
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back link */}
      <Link to="/publications" className="text-primary-600 hover:underline mb-6 inline-block">
        ← Back to publications
      </Link>

      {/* Main content card */}
      <article className="bg-white rounded-xl shadow-md overflow-hidden max-w-4xl mx-auto">
        {/* Colored header bar */}
        <div className="h-3 bg-gradient-to-r from-primary-500 to-primary-700"></div>

        <div className="p-8 md:p-12">
          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 leading-tight">
            {thesis.title}
          </h1>

          {/* Author info */}
          <div className="flex items-center gap-4 mt-6 pb-6 border-b">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              {thesis.author?.profilePhoto ? (
                <img
                  src={thesis.author.profilePhoto}
                  alt={thesis.author.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <span className="text-xl">👨‍⚕️</span>
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-800">{thesis.author?.name}</p>
              <p className="text-sm text-gray-500">
                {thesis.author?.specialization}
                {thesis.institution && ` • ${thesis.institution}`}
              </p>
            </div>
          </div>

          {/* Meta info (date, views, co-authors) */}
          <div className="flex flex-wrap gap-4 mt-6 text-sm text-gray-500">
            <span>Published: {formatDate(thesis.publicationDate || thesis.createdAt)}</span>
            <span>•</span>
            <span>{thesis.viewCount} views</span>
            {thesis.coAuthors && thesis.coAuthors.length > 0 && (
              <>
                <span>•</span>
                <span>Co-authors: {thesis.coAuthors.join(', ')}</span>
              </>
            )}
          </div>

          {/* Tags */}
          {thesis.tags && thesis.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {thesis.tags.map((t, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Abstract */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Abstract</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {thesis.abstract}
            </p>
            {/*
              whitespace-pre-line = preserves line breaks from the text
              Without it, all text appears in one paragraph even if the author
              pressed Enter to create paragraphs
            */}
          </div>

          {/* Full content (if available) */}
          {thesis.content && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">Full Text</h2>
              <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                {thesis.content}
              </div>
            </div>
          )}

          {/* PDF download link (if available) */}
          {thesis.pdfFile && (
            <div className="mt-8 p-4 bg-gray-50 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📎</span>
                <div>
                  <p className="font-medium text-gray-800">PDF Document Available</p>
                  <p className="text-sm text-gray-500">Download the full paper</p>
                </div>
              </div>
              <a
                href={thesis.pdfFile}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
              >
                Download PDF
              </a>
            </div>
          )}

          {/* Share link info */}
          <div className="mt-8 pt-6 border-t">
            <p className="text-sm text-gray-500">
              Share this publication: {' '}
              <span className="text-primary-600 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {window.location.href}
              </span>
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}

export default ThesisDetail;
