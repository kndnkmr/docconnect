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
      <footer className="bg-gray-800 text-white py-6 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">
            &copy; 2024 ProMedicoz. Your health, our priority.
          </p>
          <div className="flex justify-center gap-4 mt-2">
            <a href="/terms" className="text-gray-500 text-xs hover:text-gray-300">Terms & Conditions</a>
            <a href="/privacy" className="text-gray-500 text-xs hover:text-gray-300">Privacy Policy</a>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp button — visible on all pages */}
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
