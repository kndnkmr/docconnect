// ============================================
// Home Page - Landing Page
// ============================================
// The first thing users see when they visit the website.
// It should: explain what the app does, look professional,
// and guide users to take action (register, find doctors).
//
// KEY CONCEPTS:
// - Component structure: JSX that returns HTML-like elements
// - Tailwind responsive classes: sm:, md:, lg: prefixes
// - Link navigation: buttons that go to other pages

import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div>
      {/* ---- Hero Section (the big banner at the top) ---- */}
      <section className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        {/*
          bg-gradient-to-r = background gradient going left → right
          from-primary-600 to-primary-800 = blue gradient
        */}
        <div className="container mx-auto px-4 py-20 md:py-32">
          {/* py-20 on mobile, py-32 on medium+ screens */}
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Find the Right Doctor, Book Instantly
            </h1>
            <p className="text-xl md:text-2xl text-primary-100 mb-8">
              Connect with qualified healthcare professionals. 
              Browse profiles, read publications, and book consultations — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* flex-col on mobile (stacked), flex-row on sm+ (side by side) */}
              <Link
                to="/doctors"
                className="bg-white text-primary-700 px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors text-center"
              >
                Find a Doctor
              </Link>
              {!isAuthenticated && (
                <Link
                  to="/register"
                  className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-white hover:text-primary-700 transition-colors text-center"
                >
                  Join as a Doctor
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Features Section ---- */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
            How DocConnect Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/*
              grid = CSS Grid layout
              grid-cols-1 = 1 column on mobile
              md:grid-cols-3 = 3 columns on medium+ screens
              gap-8 = space between grid items
            */}

            {/* Feature Card 1 */}
            <div className="text-center p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                Search Doctors
              </h3>
              <p className="text-gray-600">
                Browse our network of qualified doctors. 
                Filter by specialization, experience, and location.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="text-center p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-5xl mb-4">📅</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                Book Appointment
              </h3>
              <p className="text-gray-600">
                Choose a convenient time slot and book your consultation. 
                In-person, video, or phone — your choice.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="text-center p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-5xl mb-4">📄</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                Read Research
              </h3>
              <p className="text-gray-600">
                Access doctors' published research and thesis papers. 
                Stay informed about the latest medical findings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Stats Section ---- */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary-600">100+</div>
              <div className="text-gray-600 mt-2">Doctors</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary-600">20+</div>
              <div className="text-gray-600 mt-2">Specializations</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary-600">1000+</div>
              <div className="text-gray-600 mt-2">Appointments</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary-600">50+</div>
              <div className="text-gray-600 mt-2">Publications</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- CTA (Call to Action) Section ---- */}
      <section className="py-16 bg-primary-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Are You a Doctor?
          </h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Join DocConnect to reach more patients, share your research, 
            and manage appointments efficiently.
          </p>
          {!isAuthenticated && (
            <Link
              to="/register"
              className="bg-white text-primary-700 px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors inline-block"
            >
              Register Now
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

export default Home;
