// ============================================
// Doctor List Page - Browse & Search Doctors
// ============================================
// Patients use this page to find doctors by name or specialization.
//
// KEY CONCEPTS:
// - useEffect: fetch data when page loads
// - Search/filter: update results as user types
// - Pagination: load results page by page
// - Card layout: display each doctor as a card
// - Debounce-like behavior: search on submit (not every keystroke)

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doctorAPI } from '../services/api';
import toast from 'react-hot-toast';

function DoctorList() {
  // ---- State ----
  const [doctors, setDoctors] = useState([]);
  // Array of doctor objects from the API

  const [loading, setLoading] = useState(true);
  // Show loading spinner while fetching

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalDoctors: 0
  });

  // Search/filter state
  const [searchName, setSearchName] = useState('');
  const [searchSpecialization, setSearchSpecialization] = useState('');

  // ---- Fetch doctors from API ----
  // This function is called on page load and when filters change

  const fetchDoctors = async (page = 1) => {
    setLoading(true);
    try {
      // Build query parameters
      const params = { page, limit: 9 };
      // limit: 9 = show 9 doctors per page (fits nicely in a 3-column grid)

      if (searchName) params.name = searchName;
      if (searchSpecialization) params.specialization = searchSpecialization;

      const response = await doctorAPI.getAll(params);
      // This calls GET /api/doctors?page=1&limit=9&name=...&specialization=...

      setDoctors(response.data.doctors);
      setPagination(response.data.pagination);

    } catch (error) {
      toast.error('Failed to load doctors');
      console.error('Fetch doctors error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ---- useEffect: Fetch on first load ----
  useEffect(() => {
    fetchDoctors();
  }, []);
  // Empty dependency array [] = run ONCE when component mounts (loads)
  // Without [], it would run on every re-render (infinite loop!)

  // ---- Handle search form submission ----
  const handleSearch = (e) => {
    e.preventDefault();
    fetchDoctors(1); // Reset to page 1 when searching
  };

  // ---- Handle pagination ----
  const goToPage = (page) => {
    fetchDoctors(page);
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* ---- Page Title ---- */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Find a Doctor</h1>
        <p className="text-gray-600 mt-2">
          Browse our network of {pagination.totalDoctors} qualified professionals
        </p>
      </div>

      {/* ---- Search/Filter Bar ---- */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search by name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Doctor Name
            </label>
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Search by name..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Search by specialization */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Specialization
            </label>
            <input
              type="text"
              value={searchSpecialization}
              onChange={(e) => setSearchSpecialization(e.target.value)}
              placeholder="e.g., Cardiologist, Dentist..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Search button */}
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-primary-600 text-white py-2 px-6 rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Search
            </button>
          </div>
        </div>
      </form>

      {/* ---- Results ---- */}
      {loading ? (
        // Loading state
        <div className="text-center py-12">
          <div className="text-lg text-gray-600">Loading doctors...</div>
        </div>
      ) : doctors.length === 0 ? (
        // No results
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-xl font-medium text-gray-700">No doctors found</h3>
          <p className="text-gray-500 mt-2">Try adjusting your search criteria</p>
        </div>
      ) : (
        // Doctor cards grid
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/*
            .map() = loop through the doctors array and create a card for each
            This is how React renders lists — transform data into JSX elements
          */}
          {doctors.map((doctor) => (
            <DoctorCard key={doctor._id} doctor={doctor} />
            // "key" = unique identifier React uses to track list items
            // Without key, React can't efficiently update the list
          ))}
        </div>
      )}

      {/* ---- Pagination Controls ---- */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-8">
          {/* Previous button */}
          <button
            onClick={() => goToPage(pagination.currentPage - 1)}
            disabled={!pagination.hasPrevPage}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {/* Page info */}
          <span className="text-gray-600 px-4">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>

          {/* Next button */}
          <button
            onClick={() => goToPage(pagination.currentPage + 1)}
            disabled={!pagination.hasNextPage}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Doctor Card Component ----
// A smaller component used inside DoctorList
// This is "component composition" — building UIs from small reusable pieces

function DoctorCard({ doctor }) {
  // { doctor } = destructuring props (the data passed from parent)
  return (
    <Link
      to={`/doctors/${doctor._id}`}
      className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden block"
      // "block" makes the entire card clickable
    >
      {/* Doctor Photo */}
      <div className="h-48 bg-gradient-to-r from-primary-100 to-primary-200 flex items-center justify-center">
        {doctor.profilePhoto ? (
          <img
            src={doctor.profilePhoto}
            alt={doctor.name}
            className="h-full w-full object-cover"
            // object-cover = fills the space without distortion (crops if needed)
          />
        ) : (
          // Default avatar if no photo
          <span className="text-6xl">👨‍⚕️</span>
        )}
      </div>

      {/* Doctor Info */}
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-800">{doctor.name}</h3>

        {doctor.specialization && (
          <p className="text-primary-600 text-sm font-medium mt-1">
            {doctor.specialization}
          </p>
        )}

        {doctor.experience > 0 && (
          <p className="text-gray-500 text-sm mt-1">
            {doctor.experience} years experience
          </p>
        )}

        {doctor.consultationFee > 0 && (
          <p className="text-gray-700 font-medium mt-2">
            Consultation: ₹{doctor.consultationFee}
          </p>
        )}

        {/* View Profile button */}
        <div className="mt-4">
          <span className="text-primary-600 text-sm font-medium hover:underline">
            View Profile →
          </span>
        </div>
      </div>
    </Link>
  );
}

export default DoctorList;
