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
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import SEO from '../components/SEO';
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

      // Redirect to dashboard
      navigate('/dashboard');

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
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <SEO title="Login" description="Sign in to your ProMedicoz account. Manage appointments, view prescriptions, and book doctors." path="/login" />

      <div className="w-full max-w-md">
        {/* max-w-md = max width ~448px (keeps form from being too wide) */}

        {/* Header — no logo here on purpose; the navbar already shows the
            ProMedicoz brand on every page, so repeating it here read as a
            duplicate. */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Welcome Back</h1>
          <p className="text-gray-600 mt-2">Sign in to your ProMedicoz account</p>
          <p className="text-gray-500 text-sm mt-1">
            Works for both Doctors and Patients
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <form onSubmit={handleSubmit}>

            {/* Login method toggle */}
            <div className="flex mb-5 border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setLoginMethod('phone')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  loginMethod === 'phone' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600'
                }`}
              >
                Phone
              </button>
              <button
                type="button"
                onClick={() => setLoginMethod('email')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  loginMethod === 'email' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600'
                }`}
              >
                Email
              </button>
            </div>

            {/* Email or Phone Field */}
            <div className="mb-5">
              {loginMethod === 'phone' ? (
                <>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                    required
                  />
                </>
              ) : (
                <>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                    required
                  />
                </>
              )}
            </div>

            {/* Password Field with show/hide toggle */}
            <div className="mb-6">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
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
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              // disabled:opacity-50 = button looks faded when disabled
              // disabled:cursor-not-allowed = shows "not allowed" cursor
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
      </div>
    </div>
  );
}

export default Login;
