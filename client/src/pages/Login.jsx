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
import toast from 'react-hot-toast';

function Login() {
  // ---- State for form fields ----
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // isLoading = disable the button while waiting for the server

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
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      // Send login request to our backend
      const response = await authAPI.login({ email, password });

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
      {/* min-h-[80vh] = at least 80% of viewport height (centers the form nicely) */}

      <div className="w-full max-w-md">
        {/* max-w-md = max width ~448px (keeps form from being too wide) */}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Welcome Back</h1>
          <p className="text-gray-600 mt-2">Sign in to your DocConnect account</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <form onSubmit={handleSubmit}>
            {/* onSubmit = run handleSubmit when the form is submitted (Enter key or button click) */}

            {/* Email Field */}
            <div className="mb-5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email Address
              </label>
              {/* htmlFor connects the label to the input (accessibility) */}
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                // e.target.value = what the user typed
                placeholder="you@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                // focus:ring-2 = blue ring appears when input is focused (clicked)
                // outline-none = removes the default browser outline
                required
              />
            </div>

            {/* Password Field */}
            <div className="mb-6">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                // type="password" hides the characters as dots
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              // disabled:opacity-50 = button looks faded when disabled
              // disabled:cursor-not-allowed = shows "not allowed" cursor
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
              {/* Show different text while loading */}
            </button>
          </form>

          {/* Forgot password link */}
          <p className="text-center mt-4">
            <Link to="/forgot-password" className="text-sm text-gray-500 hover:text-primary-600">
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
