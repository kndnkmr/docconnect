// ============================================
// App Component - The Main App with Routing
// ============================================
// This is the "root" component. It defines:
// 1. Which URL shows which page
// 2. The layout (Navbar on top, page content below)
// 3. Protected routes (pages that require login)
//
// KEY CONCEPT: React Router
// In a traditional website, clicking a link loads a NEW page from the server.
// In React (SPA), clicking a link just SWAPS the component shown — no reload!
// This makes navigation instant and smooth.

import { lazy, Suspense } from 'react';
// lazy + Suspense = load a page's code only when it's first visited
// (code-splitting), instead of shipping it in the initial bundle.

import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
// Routes = container for all route definitions
// Route = defines one path → component mapping
// Navigate = redirects to another route

import { Toaster } from 'react-hot-toast';
// Toaster = renders toast notifications (popup messages)

import { useAuth } from './context/AuthContext';
// Custom hook to access auth state (is user logged in? what role?)

import { usePwa } from './context/PwaContext';
// Shared PWA install prompt — lets the footer "Get the App" offer 1-tap
// install, the same as the navbar and Home strip.

// ---- Import Page Components ----
import Navbar from './components/Navbar';
import WhatsAppButton from './components/WhatsAppButton';
import BottomNav from './components/BottomNav';
import ScrollToTop from './components/ScrollToTop';
import Analytics from './components/Analytics';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import DoctorList from './pages/DoctorList';
import DoctorProfile from './pages/DoctorProfile';
import SpecializationPage from './pages/SpecializationPage';
// Blog pages are lazy-loaded so they only download when a visitor opens /blog.
// The LIST page loads only the light article metadata (blogMeta.js); the
// ARTICLE page loads just the one article being read (one small file per
// article, see BlogArticle.jsx) — so blog pages stay light however many
// articles we add.
const BlogList = lazy(() => import('./pages/blog/BlogList'));
const BlogArticle = lazy(() => import('./pages/blog/BlogArticle'));

// Pages most visitors never open on their first visit are also loaded on
// demand, so the first download (Home / doctor list / doctor profile /
// specialty pages / login) stays small and fast on mobile. Each shows the same
// "Loading…" fallback below for a moment the first time it's opened.
// Behaviour and design are unchanged.
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const MedicalDisclaimer = lazy(() => import('./pages/MedicalDisclaimer'));
const CancellationRefund = lazy(() => import('./pages/CancellationRefund'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const ForDoctors = lazy(() => import('./pages/ForDoctors'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const InstallApp = lazy(() => import('./pages/InstallApp'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const BookAppointment = lazy(() => import('./pages/BookAppointment'));
const BookingConfirmation = lazy(() => import('./pages/BookingConfirmation'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
// Free patient tools (loaded on demand).
const DueDateCalculator = lazy(() => import('./pages/tools/DueDateCalculator'));
const OvulationCalculator = lazy(() => import('./pages/tools/OvulationCalculator'));
const VaccinationSchedule = lazy(() => import('./pages/tools/VaccinationSchedule'));
const ToolsHub = lazy(() => import('./pages/tools/ToolsHub'));
const ReportSamjhao = lazy(() => import('./pages/tools/ReportSamjhao'));

// ---- Protected Route Component ----
// A wrapper that checks: "Is the user logged in? If not, redirect to login."
// We use this for pages that require authentication (Dashboard, Book Appointment, etc.)

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // While checking auth status, show loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  // Not logged in → redirect to login, REMEMBERING where they were headed so
  // Login/Register can send them straight back after auth (e.g. a patient who
  // tapped "Book" on a doctor is returned to that booking page, not dumped on
  // an empty dashboard). Includes the query string (carries ?date=&slot=).
  if (!user) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" state={{ from }} replace />;
    // "replace" = don't add this redirect to browser history
    // So pressing "Back" won't loop between login and protected page
  }

  // If specific roles are required, check them
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
    // Wrong role → send to home page
  }

  // All good → render the protected page
  return children;
}

// ---- Main App Component ----
function App() {
  const { canInstall, promptInstall } = usePwa();

  return (
    <div className="min-h-screen flex flex-col">
      {/* 
        min-h-screen = minimum height is the full screen
        flex flex-col = use flexbox in column direction (stack vertically)
      */}

      {/* Reset scroll to the top on every route change (SPA nav doesn't do
          this automatically — otherwise a page opened from a link clicked at
          the bottom of another page starts scrolled to the bottom). */}
      <ScrollToTop />

      {/* Sends a GA4 page_view on every route change — essential for a SPA,
          otherwise only the first page a visitor lands on gets counted (see
          Analytics.jsx). Renders nothing. */}
      <Analytics />

      {/* Navbar appears on ALL pages */}
      <Navbar />

      {/* Main content area — grows to fill available space so the footer
          stays at the bottom on short pages (sticky footer). It's also a
          flex column so a page can let its last section stretch to fill the
          leftover space (avoids an orphan pale gap between a page's final
          colored band and the dark footer on tall screens). */}
      <main className="flex-grow flex flex-col">
        {/*
          Routes = "Look at the current URL and render the matching component"
          Each Route maps a path to a page component
        */}
        {/* Suspense boundary for lazy-loaded pages (e.g. the blog). Shows a
            tiny loader for the brief moment a page's chunk is fetched. */}
        <Suspense fallback={<div className="flex-grow flex items-center justify-center py-20 text-gray-500">Loading…</div>}>
        <Routes>
          {/* ---- Public Routes (anyone can access) ---- */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/doctors" element={<DoctorList />} />
          <Route path="/doctors/:id" element={<DoctorProfile />} />
          {/* A doctor's own branded "My Clinic" booking page, reached via their
              vanity handle (e.g. /dr/pooja-singh). Same component in clinicMode:
              single-doctor focus, quiet ProMedicoz co-brand, footer-only
              "explore" link. The link doctors share to promote themselves. */}
          <Route path="/dr/:slug" element={<DoctorProfile clinicMode />} />
          <Route path="/specialization/:slug" element={<SpecializationPage />} />
          {/* City-specific SEO landing page, e.g. /specialization/dermatologist/rishikesh
              — "Best Dermatologists in Rishikesh". Same component, city-aware. */}
          <Route path="/specialization/:slug/:city" element={<SpecializationPage />} />
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogArticle />} />
          {/* Hinglish version of an article as its own indexable page (for Hindi
              searches). Same component, opened in Hindi; the in-page toggle
              still works. /blog/:slug above is unchanged. */}
          <Route path="/blog/:slug/hi" element={<BlogArticle defaultLang="hi" />} />
          {/* Pregnancy due-date calculator: English, Hindi, and the share-link
              landing (/tools/due-date-calculator/2027-03). React Router ranks the
              static "/hi" above the ":month" param, so they never clash. */}
          <Route path="/tools/due-date-calculator" element={<DueDateCalculator />} />
          <Route path="/tools/due-date-calculator/hi" element={<DueDateCalculator defaultLang="hi" />} />
          <Route path="/tools/due-date-calculator/:month" element={<DueDateCalculator />} />
          {/* Ovulation & period calculator: English + Hindi. */}
          <Route path="/tools/ovulation-calculator" element={<OvulationCalculator />} />
          <Route path="/tools/ovulation-calculator/hi" element={<OvulationCalculator defaultLang="hi" />} />
          {/* Baby vaccination schedule: English + Hindi. */}
          <Route path="/tools/vaccination-schedule" element={<VaccinationSchedule />} />
          <Route path="/tools/vaccination-schedule/hi" element={<VaccinationSchedule defaultLang="hi" />} />
          {/* Report Samjhao (blood report explained): English + Hindi. */}
          <Route path="/tools/blood-report" element={<ReportSamjhao />} />
          <Route path="/tools/blood-report/hi" element={<ReportSamjhao defaultLang="hi" />} />
          {/* Hub page listing all free tools. */}
          <Route path="/tools" element={<ToolsHub />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/medical-disclaimer" element={<MedicalDisclaimer />} />
          <Route path="/cancellation-refund" element={<CancellationRefund />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/for-doctors" element={<ForDoctors />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/install" element={<InstallApp />} />
          {/* 
            ":id" = dynamic segment. Any value works here.
            /doctors/abc123 → DoctorProfile gets "abc123" as the id param
          */}

          {/* ---- Protected Routes (login required) ---- */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/book-appointment/:doctorId"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <BookAppointment />
              </ProtectedRoute>
            }
          />
          {/* Only patients can book appointments */}

          <Route
            path="/booking-confirmation"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <BookingConfirmation />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          {/* Only admins can access the admin panel */}

          {/* ---- Catch-all: 404 page ---- */}
          <Route
            path="*"
            element={
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-800 mb-4">404</h1>
                  <p className="text-gray-600 mb-4">Page not found</p>
                  <a href="/" className="text-primary-600 hover:underline">
                    Go back home
                  </a>
                </div>
              </div>
            }
          />
          {/* path="*" matches any URL that didn't match above */}
        </Routes>
        </Suspense>
      </main>

      {/* Footer */}
      {/* Extra bottom padding on mobile (pb-24) so the fixed BottomNav bar
          doesn't cover the footer's last line; removed at md+ where there's
          no bottom nav. This lives on the footer (not main) so it never
          creates a white gap between a page's content and the footer. */}
      <footer className="bg-gray-800 text-white pt-10 pb-24 md:pb-6 mt-4">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🏥</span>
                <span className="text-lg font-bold">ProMedicoz</span>
              </div>
              <p className="text-gray-400 text-sm">
                Book verified doctors online — video, phone, or in-person consultations across India.
              </p>
              {/* Role-neutral links (apply to patients and doctors alike).
                  About Us is a subtle outline pill; Install/Get the App is the
                  primary action, so it gets a solid green accent, a hover lift,
                  and a scaling phone icon to draw the eye. */}
              <div className="flex flex-wrap gap-2 mt-4">
                <a
                  href="/about"
                  className="group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/25 text-white font-semibold text-sm transition-all duration-200 hover:bg-white/15 hover:border-white/40 hover:-translate-y-0.5"
                >
                  <span aria-hidden="true">ℹ️</span>
                  About Us
                  <span className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true">→</span>
                </a>
                {canInstall ? (
                  <button
                    onClick={promptInstall}
                    className="group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-green-600 text-white font-semibold text-sm shadow-sm transition-all duration-200 hover:bg-green-500 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-400/60"
                  >
                    <span className="transition-transform duration-200 group-hover:scale-110" aria-hidden="true">📲</span>
                    Install App
                  </button>
                ) : (
                  <a
                    href="/install"
                    className="group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-green-600 text-white font-semibold text-sm shadow-sm transition-all duration-200 hover:bg-green-500 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-400/60"
                  >
                    <span className="transition-transform duration-200 group-hover:scale-110" aria-hidden="true">📲</span>
                    Get the App
                  </a>
                )}
              </div>
              {/* Official social profiles. These reinforce the brand signal
                  (same URLs are in the Organization JSON-LD "sameAs") and give
                  visitors a way to follow us. Open in a new tab; rel prevents
                  the linked site from accessing window.opener. */}
              <div className="mt-4">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">Follow Us</p>
                <div className="flex items-center gap-3">
                  <a
                    href="https://www.facebook.com/profile.php?id=61594649995593"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="ProMedicoz on Facebook"
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.9h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94z" />
                    </svg>
                  </a>
                  <a
                    href="https://www.instagram.com/promedicoz"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="ProMedicoz on Instagram"
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 01-1.38-.9 3.7 3.7 0 01-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 1.62c-3.15 0-3.52.01-4.76.07-1.15.05-1.77.24-2.19.41-.55.21-.94.47-1.35.88-.41.41-.67.8-.88 1.35-.17.42-.36 1.04-.41 2.19-.06 1.24-.07 1.61-.07 4.76s.01 3.52.07 4.76c.05 1.15.24 1.77.41 2.19.21.55.47.94.88 1.35.41.41.8.67 1.35.88.42.17 1.04.36 2.19.41 1.24.06 1.61.07 4.76.07s3.52-.01 4.76-.07c1.15-.05 1.77-.24 2.19-.41.55-.21.94-.47 1.35-.88.41-.41.67-.8.88-1.35.17-.42.36-1.04.41-2.19.06-1.24.07-1.61.07-4.76s-.01-3.52-.07-4.76c-.05-1.15-.24-1.77-.41-2.19a3.63 3.63 0 00-.88-1.35 3.63 3.63 0 00-1.35-.88c-.42-.17-1.04-.36-2.19-.41-1.24-.06-1.61-.07-4.76-.07zm0 2.76a5.3 5.3 0 110 10.6 5.3 5.3 0 010-10.6zm0 1.62a3.68 3.68 0 100 7.36 3.68 3.68 0 000-7.36zm5.48-.66a1.24 1.24 0 110 2.48 1.24 1.24 0 010-2.48z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* For Patients. Each link is an icon + label with an arrow that
                slides in and a label that nudges right on hover, so the whole
                column reads as interactive rather than flat text. The heading
                carries a short green accent bar for visual rhythm. */}
            <div>
              <h3 className="font-semibold text-sm mb-3 text-gray-200 inline-flex flex-col">
                For Patients
                <span className="mt-1 h-0.5 w-8 rounded-full bg-green-500" aria-hidden="true"></span>
              </h3>
              <ul className="space-y-1 text-sm">
                <li><a href="/doctors" className="group flex items-center gap-2 py-1 text-gray-400 hover:text-white transition-colors"><span className="w-4 text-center" aria-hidden="true">🔍</span><span className="transition-transform duration-200 group-hover:translate-x-0.5">Find Doctors</span><span className="ml-auto opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 text-green-400" aria-hidden="true">→</span></a></li>
                <li><a href="/how-it-works" className="group flex items-center gap-2 py-1 text-gray-400 hover:text-white transition-colors"><span className="w-4 text-center" aria-hidden="true">📝</span><span className="transition-transform duration-200 group-hover:translate-x-0.5">How It Works</span><span className="ml-auto opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 text-green-400" aria-hidden="true">→</span></a></li>
                <li><a href="/blog" className="group flex items-center gap-2 py-1 text-gray-400 hover:text-white transition-colors"><span className="w-4 text-center" aria-hidden="true">📰</span><span className="transition-transform duration-200 group-hover:translate-x-0.5">Health Blog</span><span className="ml-auto opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 text-green-400" aria-hidden="true">→</span></a></li>
                <li><a href="/tools" className="group flex items-center gap-2 py-1 text-gray-400 hover:text-white transition-colors"><span className="w-4 text-center" aria-hidden="true">🧰</span><span className="transition-transform duration-200 group-hover:translate-x-0.5">Free Health Tools</span><span className="ml-auto opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 text-green-400" aria-hidden="true">→</span></a></li>
                <li><a href="/register" className="group flex items-center gap-2 py-1 text-gray-400 hover:text-white transition-colors"><span className="w-4 text-center" aria-hidden="true">👤</span><span className="transition-transform duration-200 group-hover:translate-x-0.5">Create Account</span><span className="ml-auto opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 text-green-400" aria-hidden="true">→</span></a></li>
              </ul>
            </div>

            {/* For Doctors */}
            <div>
              <h3 className="font-semibold text-sm mb-3 text-gray-200 inline-flex flex-col">
                For Doctors
                <span className="mt-1 h-0.5 w-8 rounded-full bg-green-500" aria-hidden="true"></span>
              </h3>
              <ul className="space-y-1 text-sm">
                <li><a href="/for-doctors" className="group flex items-center gap-2 py-1 text-gray-400 hover:text-white transition-colors"><span className="w-4 text-center" aria-hidden="true">💡</span><span className="transition-transform duration-200 group-hover:translate-x-0.5">How It Works</span><span className="ml-auto opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 text-green-400" aria-hidden="true">→</span></a></li>
                <li><a href="/register?role=doctor" className="group flex items-center gap-2 py-1 text-gray-400 hover:text-white transition-colors"><span className="w-4 text-center" aria-hidden="true">🩺</span><span className="transition-transform duration-200 group-hover:translate-x-0.5">Join ProMedicoz</span><span className="ml-auto opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 text-green-400" aria-hidden="true">→</span></a></li>
                <li><a href="/login" className="group flex items-center gap-2 py-1 text-gray-400 hover:text-white transition-colors"><span className="w-4 text-center" aria-hidden="true">🔑</span><span className="transition-transform duration-200 group-hover:translate-x-0.5">Doctor Login</span><span className="ml-auto opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 text-green-400" aria-hidden="true">→</span></a></li>
              </ul>
            </div>

            {/* Legal & Support — grouped the way established health platforms
                do (legal policies + a clear support/grievance contact), and
                includes the Medical Disclaimer expected of a health site. */}
            <div>
              <h3 className="font-semibold text-sm mb-3 text-gray-200 inline-flex flex-col">
                Legal & Support
                <span className="mt-1 h-0.5 w-8 rounded-full bg-green-500" aria-hidden="true"></span>
              </h3>
              <ul className="space-y-1 text-sm">
                <li><a href="/terms" className="group flex items-center gap-2 py-1 text-gray-400 hover:text-white transition-colors"><span className="w-4 text-center" aria-hidden="true">📄</span><span className="transition-transform duration-200 group-hover:translate-x-0.5">Terms & Conditions</span><span className="ml-auto opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 text-green-400" aria-hidden="true">→</span></a></li>
                <li><a href="/privacy" className="group flex items-center gap-2 py-1 text-gray-400 hover:text-white transition-colors"><span className="w-4 text-center" aria-hidden="true">🔒</span><span className="transition-transform duration-200 group-hover:translate-x-0.5">Privacy Policy</span><span className="ml-auto opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 text-green-400" aria-hidden="true">→</span></a></li>
                <li><a href="/medical-disclaimer" className="group flex items-center gap-2 py-1 text-gray-400 hover:text-white transition-colors"><span className="w-4 text-center" aria-hidden="true">⚕️</span><span className="transition-transform duration-200 group-hover:translate-x-0.5">Medical Disclaimer</span><span className="ml-auto opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 text-green-400" aria-hidden="true">→</span></a></li>
                <li><a href="/cancellation-refund" className="group flex items-center gap-2 py-1 text-gray-400 hover:text-white transition-colors"><span className="w-4 text-center" aria-hidden="true">↩️</span><span className="transition-transform duration-200 group-hover:translate-x-0.5">Cancellation & Refund</span><span className="ml-auto opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 text-green-400" aria-hidden="true">→</span></a></li>
                <li><a href="mailto:support@promedicoz.in?subject=Contact%20%2F%20Grievance%20-%20ProMedicoz" className="group flex items-center gap-2 py-1 text-gray-400 hover:text-white transition-colors"><span className="w-4 text-center" aria-hidden="true">✉️</span><span className="transition-transform duration-200 group-hover:translate-x-0.5">Contact / Grievance</span><span className="ml-auto opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 text-green-400" aria-hidden="true">→</span></a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-5 text-center">
            <p className="text-gray-400 text-sm">
              &copy; {new Date().getFullYear()} ProMedicoz. Your health, our priority.
            </p>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp button — shown to guests only (hidden once
          logged in; the component itself checks auth) */}
      <WhatsAppButton />

      {/* Bottom navigation — mobile only */}
      <BottomNav />

      {/* Toast notification container */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          // Each toast disappears after 3 seconds
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </div>
  );
}

export default App;
