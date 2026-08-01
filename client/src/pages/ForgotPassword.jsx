// ============================================
// Forgot Password Page - Request Reset Link
// ============================================
// User enters their email, server generates a reset token
// and logs the reset link to the console (in production: emailed).
//
// KEY CONCEPTS:
// - Simple single-field form
// - Success message shown after submission (even if email doesn't exist — security)
// - Links back to login page

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  // After submission, show a success message instead of the form

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.forgotPassword({ email });

      setIsSubmitted(true);
      toast.success('Reset link generated! Check the server console.');

      // In development, if the response includes the resetUrl, show it
      if (response.data.resetUrl) {
        console.log('Reset URL:', response.data.resetUrl);
      }

    } catch (error) {
      const message = error.response?.data?.message || 'Something went wrong. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Forgot Password</h1>
          <p className="text-gray-600 mt-2">
            Enter your email and we'll generate a reset link
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-md p-8">

          {isSubmitted ? (
            // Success state — show after submission
            <div className="text-center">
              <div className="text-5xl mb-4">✉️</div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Check Your Console</h2>
              <p className="text-gray-600 mb-4">
                If an account with that email exists, a reset link has been generated.
                Look at your <strong>server terminal</strong> for the link.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                (In production, this link would be emailed to you)
              </p>
              <div className="space-y-3">
                <Link
                  to="/login"
                  className="block text-primary-600 font-medium hover:underline"
                >
                  ← Back to Login
                </Link>
                <button
                  onClick={() => { setIsSubmitted(false); setEmail(''); }}
                  className="text-gray-500 text-sm hover:underline"
                >
                  Try a different email
                </button>
              </div>
            </div>
          ) : (
            // Form state — before submission
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          {/* Back to login link */}
          {!isSubmitted && (
            <p className="text-center text-gray-600 mt-6">
              Remember your password?{' '}
              <Link to="/login" className="text-primary-600 font-medium hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
