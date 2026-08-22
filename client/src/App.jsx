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

import { Routes, Route, Navigate } from 'react-router-dom';
// Routes = container for all route definitions
// Route = defines one path → component mapping
// Navigate = redirects to another route

import { Toaster } from 'react-hot-toast';
// Toaster = renders toast notifications (popup messages)

import { useAuth } from './context/AuthContext';
// Custom hook to access auth state (is user logged in? what role?)

// ---- Import Page Components ----
import Navbar from './components/Navbar';
import WhatsAppButton from './components/WhatsAppButton';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import DoctorList from './pages/DoctorList';
import DoctorProfile from './pages/DoctorProfile';
import SpecializationPage from './pages/SpecializationPage';
import VerifyEmail from './pages/VerifyEmail';
import BlogList from './pages/blog/BlogList';
import BlogArticle from './pages/blog/BlogArticle';
import TermsAndConditions from './pages/TermsAndConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';
import MedicalDisclaimer from './pages/MedicalDisclaimer';
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
  return (
    <div className="min-h-screen flex flex-col">
      {/* 
        min-h-screen = minimum height is the full screen
        flex flex-col = use flexbox in column direction (stack vertically)
      */}

      {/* Navbar appears on ALL pages */}
      <Navbar />

      {/* Main content area — grows to fill available space */}
      <main className="flex-grow pb-16 md:pb-0">
        {/*
          Routes = "Look at the current URL and render the matching component"
          Each Route maps a path to a page component
        */}
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
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white pt-10 pb-6 mt-auto">
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
            </div>

            {/* For Patients */}
            <div>
              <h3 className="font-semibold text-sm mb-3 text-gray-200">For Patients</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="/doctors" className="text-gray-400 hover:text-white transition-colors">Find Doctors</a></li>
                <li><a href="/blog" className="text-gray-400 hover:text-white transition-colors">Health Blog</a></li>
                <li><a href="/register" className="text-gray-400 hover:text-white transition-colors">Create Account</a></li>
              </ul>
            </div>

            {/* For Doctors */}
            <div>
              <h3 className="font-semibold text-sm mb-3 text-gray-200">For Doctors</h3>
              <ul className="space-y-2 text-sm">
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
                <li><a href="mailto:support@promedicoz.in?subject=Grievance%20-%20ProMedicoz" className="text-gray-400 hover:text-white transition-colors">Grievance / Support</a></li>
                <li><a href="mailto:support@promedicoz.in?subject=Support%20-%20ProMedicoz" className="text-gray-400 hover:text-white transition-colors">Contact Us</a></li>
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
