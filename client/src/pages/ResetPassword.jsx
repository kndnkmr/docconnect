// ============================================
// Reset Password Page - Set New Password
// ============================================
// User lands here after clicking the reset link.
// The token is in the URL: /reset-password/:token
// They enter a new password, and it's updated in the database.
//
// KEY CONCEPTS:
// - useParams to get the token from the URL
// - Password confirmation (enter twice to avoid typos)
// - Auto-login after successful reset

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

function ResetPassword() {
  const { token } = useParams();
  // URL: /reset-password/a3f7b2c4d8e9... → token = "a3f7b2c4d8e9..."

  const navigate = useNavigate();
  const { login } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!password || !confirmPassword) {
      toast.error('Please fill in both fields');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.resetPassword(token, { password });

      // Auto-login after reset
      const { token: loginToken, user } = response.data;
      login(loginToken, user);

      toast.success('Password reset successful! You are now logged in.');
      navigate('/dashboard');

    } catch (error) {
      const message = error.response?.data?.message || 'Reset failed. The link may have expired.';
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
          <h1 className="text-3xl font-bold text-gray-800">Set New Password</h1>
          <p className="text-gray-600 mt-2">
            Enter your new password below
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <form onSubmit={handleSubmit}>

            {/* New Password */}
            <div className="mb-4">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                required
                minLength={6}
              />
            </div>

            {/* Confirm Password */}
            <div className="mb-6">
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                required
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          {/* Links */}
          <div className="text-center mt-6 space-y-2">
            <p className="text-gray-600 text-sm">
              Link expired?{' '}
              <Link to="/forgot-password" className="text-primary-600 font-medium hover:underline">
                Request a new one
              </Link>
            </p>
            <p className="text-gray-600 text-sm">
              <Link to="/login" className="text-primary-600 font-medium hover:underline">
                ← Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
