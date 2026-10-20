// ============================================
// Login Page - User Sign In Form
// ============================================
// A form where users enter email + password to log in.
//
// KEY CONCEPTS:
// - Controlled inputs: React controls the form values (via useState)
// - Form submission: prevent default, send data to API
// - Error handling: show user-friendly messages
// - Redirect after login: send user to dashboard
//
// WHAT IS A "CONTROLLED INPUT"?
// In regular HTML, the browser manages input values.
// In React, WE manage them with state:
//   value={email}          → React controls what's displayed
//   onChange={setEmail}    → React updates when user types
// This gives us full control (validation, formatting, etc.)

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import SEO from '../components/SEO';
import AuthLayout from '../components/AuthLayout';
import PasswordToggleIcon from '../components/PasswordToggleIcon';
import Spinner from '../components/Spinner';
import toast from 'react-hot-toast';

function Login() {
  // ---- State for form fields ----
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState('phone'); // 'email' or 'phone'
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  // login function from our AuthContext

  const navigate = useNavigate();
  // For redirecting after successful login

  const location = useLocation();
  // Where the user was headed before being bounced to login (set by
  // ProtectedRoute, or by a "Log in to Book" link). Used to return them there
  // after a successful login instead of dumping them on the dashboard.
  const returnTo = location.state?.from || null;

  // ---- Handle form submission ----
  const handleSubmit = async (e) => {
    e.preventDefault();
    // preventDefault() stops the browser from reloading the page
    // (default form behavior is to submit and reload — we don't want that in React)

    // Basic validation
    const identifier = loginMethod === 'email' ? email : phone;
    if (!identifier || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      // Send login request to our backend
      const response = await authAPI.login(
        loginMethod === 'email'
          ? { email, password }
          : { phone, password }
      );

      // If successful, the response contains { token, user }
      const { token, user } = response.data;

      // Save to auth context (and localStorage)
      login(token, user);

      toast.success(`Welcome back, ${user.name}!`);

      // Admins always go to the Admin Panel (a patient booking page etc. is
      // never meaningful for them). Everyone else is returned to where they
      // were headed before login (e.g. the doctor's booking page they tapped
      // "Book" on), falling back to the dashboard. `replace` so Back doesn't
      // land on the login screen again.
      if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate(returnTo || '/dashboard', { replace: true });
      }

    } catch (error) {
      // error.response.data.message = the error message from our backend
      const message = error.response?.data?.message || 'Login failed. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
      // "finally" runs whether success OR error — always stop loading
    }
  };

  return (
    <AuthLayout title="Welcome Back" subtitle="Sign in to your ProMedicoz account — works for both Doctors and Patients.">
      <SEO title="Login" description="Sign in to your ProMedicoz account. Manage appointments, view prescriptions, and book doctors." path="/login" noindex />

      {/* Form Card */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <form onSubmit={handleSubmit}>

            {/* Login method toggle — segmented pill control */}
            <div className="flex mb-5 bg-gray-100 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setLoginMethod('phone')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loginMethod === 'phone' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📱 Phone
              </button>
              <button
                type="button"
                onClick={() => setLoginMethod('email')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loginMethod === 'email' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                ✉️ Email
              </button>
            </div>

            {/* Email or Phone Field */}
            <div className="mb-5">
              {loginMethod === 'phone' ? (
                <>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true">📱</span>
                    <input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      autoFocus
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:bg-white outline-none transition"
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true">✉️</span>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:bg-white outline-none transition"
                      required
                    />
                  </div>
                </>
              )}
            </div>

            {/* Password Field with show/hide toggle */}
            <div className="mb-6">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true">🔒</span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:bg-white outline-none transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  <PasswordToggleIcon visible={showPassword} />
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading && <Spinner />}
              {isLoading ? 'Signing in...' : 'Sign In'}
              {/* Show a spinner + different text while loading */}
            </button>
          </form>

          {/* Forgot password link */}
          <p className="text-center mt-4">
            <Link to="/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline">
              Forgot your password?
            </Link>
          </p>

          {/* Link to register page */}
          <p className="text-center text-gray-600 mt-4">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">
              Register here
            </Link>
          </p>
        </div>
    </AuthLayout>
  );
}

export default Login;
