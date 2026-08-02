// ============================================
// Navbar Component - Navigation Bar
// ============================================
// The navigation bar appears at the TOP of every page.
// It shows different links depending on whether the user is logged in
// and what their role is (doctor vs patient).
//
// KEY CONCEPTS:
// - Link (from react-router-dom): navigates without page reload
// - Conditional rendering: show different content based on state
// - useState: toggle mobile menu open/close
// - Responsive design: looks different on mobile vs desktop

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Link = like an <a> tag but doesn't reload the page
// useNavigate = programmatic navigation (redirect from code, not a click)

import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

function Navbar() {
  const { user, isAuthenticated, isDoctor, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // State to track if the mobile hamburger menu is open

  // Handle logout
  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/');
    // Redirect to home after logout
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      {/*
        shadow-md = subtle shadow below the navbar
        sticky top-0 = stays at the top when scrolling
        z-50 = stays ABOVE other content (z-index)
      */}
      <div className="container mx-auto px-4">
        {/* container mx-auto = centered with max width, px-4 = horizontal padding */}

        <div className="flex items-center justify-between h-16">
          {/* flex = horizontal layout, items-center = vertically centered, h-16 = height */}

          {/* ---- Logo / Brand ---- */}
          <Link to="/" className="flex items-center space-x-2">
            {/* space-x-2 = gap between children */}
            <span className="text-2xl">🏥</span>
            <span className="text-xl font-bold text-primary-600">DocConnect</span>
          </Link>

          {/* ---- Desktop Navigation Links ---- */}
          {/* hidden md:flex = hidden on mobile, visible on medium+ screens */}
          <div className="hidden md:flex items-center space-x-6">

            <Link
              to="/doctors"
              className="text-gray-600 hover:text-primary-600 transition-colors"
            >
              Find Doctors
            </Link>

            {/* Show different links based on auth status */}
            {isAuthenticated ? (
              <>
                {/* Fragment (<>) = groups elements without adding extra HTML */}
                <Link
                  to="/dashboard"
                  className="text-gray-600 hover:text-primary-600 transition-colors"
                >
                  Dashboard
                </Link>

                {/* User info + logout */}
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500">
                    {user.name}
                    <span className="ml-1 px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs">
                      {user.role}
                    </span>
                  </span>
                  <button
                    onClick={handleLogout}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Not logged in — show login/register buttons */}
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-primary-600 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Register
                </Link>
              </>
            )}
          </div>

          {/* ---- Mobile Menu Button (hamburger icon) ---- */}
          {/* md:hidden = only visible on mobile (hidden on medium+ screens) */}
          <button
            className="md:hidden text-gray-600 focus:outline-none"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {/* Simple hamburger icon using spans */}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                // X icon (close)
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                // Hamburger icon (three lines)
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* ---- Mobile Menu (dropdown) ---- */}
        {/* Only shows when isMobileMenuOpen is true */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col space-y-3">
              {/* flex-col = stack vertically, space-y-3 = gap between items */}

              <Link
                to="/doctors"
                className="text-gray-600 hover:text-primary-600 px-2 py-1"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Find Doctors
              </Link>

              {isAuthenticated ? (
                <>
                  <Link
                    to="/dashboard"
                    className="text-gray-600 hover:text-primary-600 px-2 py-1"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <div className="px-2 py-1 text-sm text-gray-500">
                    Signed in as {user.name} ({user.role})
                  </div>
                  <button
                    onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                    className="text-left text-red-500 hover:text-red-600 px-2 py-1"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-gray-600 hover:text-primary-600 px-2 py-1"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="text-primary-600 font-medium px-2 py-1"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
