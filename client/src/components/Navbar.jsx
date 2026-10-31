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

import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePwa } from '../context/PwaContext';
import toast from 'react-hot-toast';
import HeaderLangSwitch from './HeaderLangSwitch';
import { useLang } from '../context/LangContext';

function Navbar() {
  const { user, isAuthenticated, isDoctor, isPatient, logout } = useAuth();
  const { canInstall, promptInstall, iosInstallable, openIosGuide } = usePwa();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navRef = useRef(null);
  // Labels follow the app-wide English / हिंदी choice for visitors and
  // patients; doctors and admins always see English.
  const { lang } = useLang();
  const hi = lang === 'hi' && !isDoctor && !(user && user.role === 'admin');
  const tr = (en, h) => (hi ? h : en);

  // Close the mobile hamburger menu on any click/tap outside the navbar —
  // before this, the only way to close it was hitting the hamburger icon
  // again, which felt stuck open on a normal page tap.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  // One-tap install using the shared PWA prompt (captured once, app-wide).
  // Closes the mobile menu if it was triggered from there.
  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) toast.success(tr('ProMedicoz installed!', 'ProMedicoz इंस्टॉल हो गया!'));
    setIsMobileMenuOpen(false);
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    toast.success(tr('Logged out successfully', 'आप लॉग आउट हो गए'));
    navigate('/');
    // Redirect to home after logout
  };

  return (
    <nav
      ref={navRef}
      className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm"
    >
      {/*
        SOLID white (not see-through glass): glass let blue/green sections
          tint the bar and fade the links, and phone dark modes could turn it
          dark-on-dark. Guarded by tests/navContrast.test.mjs.
        border-b = crisp hairline instead of a heavy drop shadow
        sticky top-0 z-50 = stays pinned above content while scrolling
      */}
      <div className="container mx-auto px-4">
        {/* container mx-auto = centered with max width, px-4 = horizontal padding */}

        <div className="flex items-center justify-between h-16">
          {/* flex = horizontal layout, items-center = vertically centered, h-16 = height */}

          {/* ---- Logo / Brand ---- */}
          <Link to="/" className="group flex items-center gap-2">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary-50 text-xl transition-transform duration-200 group-hover:scale-105 group-hover:rotate-3">
              🏥
            </span>
            <span className="text-xl font-bold tracking-tight text-primary-600">ProMedicoz</span>
          </Link>

          {/* ---- Desktop Navigation Links ---- */}
          <div className="hidden md:flex items-center space-x-6">

            {/* A logged-in doctor's day-to-day is appointments/profile/
                availability/reports, not browsing other doctors or the blog.
                Same for a logged-in patient — their Dashboard already has
                Appointments/Prescriptions/Reports tabs, and "+ Book New
                Appointment" covers finding a doctor. These marketing links
                are only useful before you've signed up, so guests (and
                admin, who isn't booking anything) still see them. */}
            {!isDoctor && !isPatient && (
              <>
                <Link to="/doctors" className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-primary-700 hover:bg-primary-50/70 transition-colors">
                  {tr('Find Doctors', 'डॉक्टर खोजें')}
                </Link>

                <Link to="/blog" className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-primary-700 hover:bg-primary-50/70 transition-colors">
                  {tr('Blog', 'ब्लॉग')}
                </Link>

                {/* One-tap install when the browser supports it (Chrome/
                    Android/desktop Edge); otherwise a link to the /install
                    page which has the manual Add-to-Home-Screen steps (iOS). */}
                {canInstall ? (
                  <button
                    onClick={handleInstall}
                    className="flex items-center gap-1.5 border border-green-600 text-green-700 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 hover:bg-green-50 hover:-translate-y-0.5"
                  >
                    📲 {tr('Install App', 'ऐप इंस्टॉल करें')}
                  </button>
                ) : iosInstallable ? (
                  // iPhone/iPad: no install prompt exists → the 3-tap guide.
                  <button onClick={openIosGuide} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-primary-700 hover:bg-primary-50/70 transition-colors">
                    📲 {tr('Get App', 'ऐप पाएं')}
                  </button>
                ) : (
                  <Link to="/install" className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-primary-700 hover:bg-primary-50/70 transition-colors">
                    📲 {tr('Get App', 'ऐप पाएं')}
                  </Link>
                )}
              </>
            )}

            {/* Grievance/support contact lives in the site footer now — a
                cleaner, more conventional place than the primary nav (having
                "Grievance" front-and-centre reads as complaint-oriented to a
                first-time visitor). Still reachable site-wide via the footer. */}

            {isAuthenticated ? (
              <>
                {/* Admins go straight to the Admin Panel — the generic
                    patient/doctor dashboard isn't meaningful for them, so we
                    show one clear link instead of both. */}
                {user.role === 'admin' ? (
                  <Link to="/admin" className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-primary-700 hover:bg-primary-50/70 transition-colors">
                    Admin Panel
                  </Link>
                ) : (
                  <Link to="/dashboard" className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-primary-700 hover:bg-primary-50/70 transition-colors">
                    {tr('Dashboard', 'डैशबोर्ड')}
                  </Link>
                )}
                <div className="flex items-center gap-3">
                  {/* Name + role shown as a single soft chip with an avatar
                      initial — reads as a tidy account badge rather than loose
                      text with a tag floating next to it. */}
                  <span className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-gray-100">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-semibold uppercase">
                      {user.name?.charAt(0) || '?'}
                    </span>
                    <span className="text-sm font-medium text-gray-700 max-w-[8rem] truncate">{user.name}</span>
                    <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs capitalize">
                      {user.role === 'patient' ? tr('patient', 'मरीज़') : user.role}
                    </span>
                  </span>
                  {/* Only show when the browser is actually ready to install
                      (shared canInstall) — otherwise it'd be a dead button. */}
                  {canInstall && (
                    <button
                      onClick={handleInstall}
                      className="flex items-center gap-1.5 border border-green-600 text-green-700 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 hover:bg-green-50 hover:-translate-y-0.5"
                    >
                      📲 {tr('Install', 'इंस्टॉल')}
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-red-600 px-3.5 py-1.5 rounded-full text-sm font-medium border border-transparent transition-all duration-200 hover:bg-red-50 hover:border-red-200"
                  >
                    {tr('Logout', 'लॉग आउट')}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Guests already have the '📲 Get App' link above (works on
                    all platforms via /install), so no separate Chrome-only
                    install button here — it read as a duplicate. */}
                <Link to="/login" className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-primary-700 hover:bg-primary-50/70 transition-colors">
                  {tr('Login', 'लॉग इन')}
                </Link>
                <Link to="/register" className="bg-primary-600 text-white px-5 py-2 rounded-full text-sm font-semibold shadow-sm transition-all duration-200 hover:bg-primary-700 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0">
                  {tr('Register', 'रजिस्टर')}
                </Link>
              </>
            )}
            <HeaderLangSwitch />
          </div>

          {/* ---- Phone: language switch + menu button ---- */}
          <div className="md:hidden flex items-center gap-2">
          <HeaderLangSwitch compact />
          <button
            className="md:hidden flex items-center justify-center w-10 h-10 -mr-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={tr('Toggle menu', 'मेनू खोलें / बंद करें')}
            aria-expanded={isMobileMenuOpen}
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
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden pb-4 pt-2 border-t border-gray-200/70 animate-[fadeInDown_0.18s_ease-out]">
            <div className="flex flex-col gap-1">

              {/* One-tap install when the browser supports it; otherwise the
                  /install page (iOS Add-to-Home steps + sharing). Same shared
                  prompt the Home strip and /install page use. */}
              {canInstall ? (
                <button onClick={handleInstall} className="flex items-center gap-2 text-left text-green-700 font-medium hover:bg-green-50 rounded-lg px-3 py-2.5 transition-colors">
                  📲 {tr('Install App (1 tap)', 'ऐप इंस्टॉल करें (1 टैप)')}
                </button>
              ) : iosInstallable ? (
                <button onClick={() => { setIsMobileMenuOpen(false); openIosGuide(); }} className="flex items-center gap-2 text-left text-gray-700 hover:text-primary-600 hover:bg-primary-50/70 rounded-lg px-3 py-2.5 transition-colors">
                  📲 {tr('Add to Home Screen', 'Home Screen पर जोड़ें')}
                </button>
              ) : (
                <Link to="/install" className="flex items-center gap-2 text-gray-700 hover:text-primary-600 hover:bg-primary-50/70 rounded-lg px-3 py-2.5 transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  📲 {tr('Get the App', 'ऐप पाएं')}
                </Link>
              )}

              {isAuthenticated ? (
                <>
                  {/* Account chip at the top of the sheet, matching the desktop
                      badge so the mobile menu feels like the same component. */}
                  <div className="flex items-center gap-2 px-3 py-2 mb-1 rounded-lg bg-gray-100">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-600 text-white text-sm font-semibold uppercase">
                      {user.name?.charAt(0) || '?'}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{user.name}</div>
                      <div className="text-xs text-gray-500 capitalize">{user.role === 'patient' ? tr('patient', 'मरीज़') : user.role}</div>
                    </div>
                  </div>
                  {user.role === 'admin' ? (
                    <Link to="/admin" className="text-gray-700 hover:text-primary-600 hover:bg-primary-50/70 rounded-lg px-3 py-2.5 transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                      Admin Panel
                    </Link>
                  ) : (
                    <Link to="/dashboard" className="text-gray-700 hover:text-primary-600 hover:bg-primary-50/70 rounded-lg px-3 py-2.5 transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                      {tr('Dashboard', 'डैशबोर्ड')}
                    </Link>
                  )}
                  <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="text-left text-red-600 hover:bg-red-50 rounded-lg px-3 py-2.5 transition-colors">
                    {tr('Logout', 'लॉग आउट')}
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-gray-700 hover:text-primary-600 hover:bg-primary-50/70 rounded-lg px-3 py-2.5 transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                    {tr('Login', 'लॉग इन')}
                  </Link>
                  <Link to="/register" className="mt-1 text-center bg-primary-600 text-white font-semibold rounded-lg px-3 py-2.5 shadow-sm transition-colors hover:bg-primary-700" onClick={() => setIsMobileMenuOpen(false)}>
                    {tr('Register', 'रजिस्टर')}
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
