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

import { Routes, Route, Navigate } from 'react-router-dom';
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
import VerifyEmail from './pages/VerifyEmail';
// Blog pages are lazy-loaded so they only download when a visitor opens /blog.
// Data is also split for weight: the LIST page (BlogList) loads only the light
// article metadata (blogMeta.js), while the heavy full article content
// (blogData.js) is bundled with the ARTICLE page (BlogArticle) and only
// downloads when someone actually opens an article — so browsing the blog list
// stays lightweight no matter how many articles we add.
const BlogList = lazy(() => import('./pages/blog/BlogList'));
const BlogArticle = lazy(() => import('./pages/blog/BlogArticle'));
import TermsAndConditions from './pages/TermsAndConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';
import MedicalDisclaimer from './pages/MedicalDisclaimer';
import CancellationRefund from './pages/CancellationRefund';
import AboutUs from './pages/AboutUs';
import ForDoctors from './pages/ForDoctors';
import HowItWorks from './pages/HowItWorks';
import InstallApp from './pages/InstallApp';
import Dashboard from './pages/Dashboard';
import BookAppointment from './pages/BookAppointment';
import BookingConfirmation from './pages/BookingConfirmation';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/AdminDashboard';

// ---- Protected Route Component ----
// A wrapper that checks: "Is the user logged in? If not, redirect to login."
// We use this for pages that require authentication (Dashboard, Book Appointment, etc.)

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  // While checking auth status, show loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  // Not logged in → redirect to login page
  if (!user) {
    return <Navigate to="/login" replace />;
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
          <Route path="/specialization/:slug" element={<SpecializationPage />} />
          {/* City-specific SEO landing page, e.g. /specialization/dermatologist/rishikesh
              — "Best Dermatologists in Rishikesh". Same component, city-aware. */}
          <Route path="/specialization/:slug/:city" element={<SpecializationPage />} />
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogArticle />} />
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
              {/* Role-neutral links (apply to patients and doctors alike) */}
              <div className="flex flex-wrap gap-2 mt-4">
                <a href="/about" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-colors">About Us →</a>
                {canInstall ? (
                  <button onClick={promptInstall} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-colors">📲 Install App</button>
                ) : (
                  <a href="/install" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-colors">📲 Get the App</a>
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

            {/* For Patients */}
            <div>
              <h3 className="font-semibold text-sm mb-3 text-gray-200">For Patients</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="/doctors" className="text-gray-400 hover:text-white transition-colors">Find Doctors</a></li>
                <li><a href="/how-it-works" className="text-gray-400 hover:text-white transition-colors">How It Works</a></li>
                <li><a href="/blog" className="text-gray-400 hover:text-white transition-colors">Health Blog</a></li>
                <li><a href="/register" className="text-gray-400 hover:text-white transition-colors">Create Account</a></li>
              </ul>
            </div>

            {/* For Doctors */}
            <div>
              <h3 className="font-semibold text-sm mb-3 text-gray-200">For Doctors</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="/for-doctors" className="text-gray-400 hover:text-white transition-colors">How It Works</a></li>
                <li><a href="/register?role=doctor" className="text-gray-400 hover:text-white transition-colors">Join ProMedicoz</a></li>
                <li><a href="/login" className="text-gray-400 hover:text-white transition-colors">Doctor Login</a></li>
              </ul>
            </div>

            {/* Legal & Support — grouped the way established health platforms
                do (legal policies + a clear support/grievance contact), and
                includes the Medical Disclaimer expected of a health site. */}
            <div>
              <h3 className="font-semibold text-sm mb-3 text-gray-200">Legal & Support</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="/terms" className="text-gray-400 hover:text-white transition-colors">Terms & Conditions</a></li>
                <li><a href="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="/medical-disclaimer" className="text-gray-400 hover:text-white transition-colors">Medical Disclaimer</a></li>
                <li><a href="/cancellation-refund" className="text-gray-400 hover:text-white transition-colors">Cancellation & Refund</a></li>
                <li><a href="mailto:support@promedicoz.in?subject=Contact%20%2F%20Grievance%20-%20ProMedicoz" className="text-gray-400 hover:text-white transition-colors">Contact / Grievance</a></li>
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
