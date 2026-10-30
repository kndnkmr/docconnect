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
import SEO from '../components/SEO';
import AuthLayout from '../components/AuthLayout';
import toast from 'react-hot-toast';
import { useLang } from '../context/LangContext';

// Fixed text on this page (follows the app-wide language). Server messages
// are shown as they come.
const RESET_TXT = {
  en: {
    title: 'Set New Password',
    subtitle: 'Enter your new password below.',
    errBoth: 'Please fill in both fields',
    errLength: 'Password must be at least 6 characters',
    errMatch: 'Passwords do not match',
    success: 'Password reset successful! You are now logged in.',
    failed: 'Reset failed. The link may have expired.',
    newLabel: 'New Password',
    newPh: 'At least 6 characters',
    confirmLabel: 'Confirm New Password',
    confirmPh: 'Re-enter your new password',
    resetting: 'Resetting...',
    reset: 'Reset Password',
    expired: 'Link expired?',
    requestNew: 'Request a new one',
    backToLogin: '← Back to Login',
  },
  hi: {
    title: 'नया पासवर्ड बनाएं',
    subtitle: 'नीचे अपना नया पासवर्ड लिखें।',
    errBoth: 'कृपया दोनों जगह पासवर्ड भरें',
    errLength: 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए',
    errMatch: 'दोनों पासवर्ड एक जैसे नहीं हैं',
    success: 'नया पासवर्ड बन गया! आप लॉग इन हो गए हैं।',
    failed: 'पासवर्ड नहीं बदल पाया। हो सकता है लिंक पुराना हो गया हो।',
    newLabel: 'नया पासवर्ड',
    newPh: 'कम से कम 6 अक्षर',
    confirmLabel: 'नया पासवर्ड दोबारा लिखें',
    confirmPh: 'वही नया पासवर्ड फिर से लिखें',
    resetting: 'बदल रहे हैं...',
    reset: 'पासवर्ड बदलें',
    expired: 'लिंक पुराना हो गया?',
    requestNew: 'नया लिंक मंगाएं',
    backToLogin: '← लॉग इन पर वापस जाएं',
  },
};

function ResetPassword() {
  const { token } = useParams();
  // URL: /reset-password/a3f7b2c4d8e9... → token = "a3f7b2c4d8e9..."

  const navigate = useNavigate();
  const { login } = useAuth();
  const { lang } = useLang(); // app-wide (top-bar switch)
  const T = RESET_TXT[lang] || RESET_TXT.en;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!password || !confirmPassword) {
      toast.error(T.errBoth);
      return;
    }

    if (password.length < 6) {
      toast.error(T.errLength);
      return;
    }

    if (password !== confirmPassword) {
      toast.error(T.errMatch);
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.resetPassword(token, { password });

      // Auto-login after reset
      const { token: loginToken, user } = response.data;
      login(loginToken, user);

      toast.success(T.success);
      navigate('/dashboard');

    } catch (error) {
      const message = error.response?.data?.message || T.failed;
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title={T.title} subtitle={T.subtitle}>
      <SEO title="Reset Password" description="Set a new password for your ProMedicoz account." path="/reset-password" noindex />

      {/* Form Card */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <form onSubmit={handleSubmit}>

            {/* New Password */}
            <div className="mb-4">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {T.newLabel}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={T.newPh}
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
                {T.confirmLabel}
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={T.confirmPh}
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
              {isLoading ? T.resetting : T.reset}
            </button>
          </form>

          {/* Links */}
          <div className="text-center mt-6 space-y-2">
            <p className="text-gray-600 text-sm">
              {T.expired}{' '}
              <Link to="/forgot-password" className="text-primary-600 font-medium hover:underline">
                {T.requestNew}
              </Link>
            </p>
            <p className="text-gray-600 text-sm">
              <Link to="/login" className="text-primary-600 font-medium hover:underline">
                {T.backToLogin}
              </Link>
            </p>
          </div>
        </div>
    </AuthLayout>
  );
}

export default ResetPassword;
