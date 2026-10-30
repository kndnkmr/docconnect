// ============================================
// Forgot Password Page - Request Reset Link
// ============================================
// Patients can register with phone only (no email required), so this form
// accepts either — matching the same toggle pattern as the Login page.
//
// KEY CONCEPTS:
// - Simple single-field form (email OR phone, picked via toggle)
// - Success message shown after submission (even if account doesn't exist — security)
// - Phone-only accounts with no email on file can't get an automatic link
//   (no SMS gateway configured) — we tell them to reach out via WhatsApp
//   instead of silently failing.
// - Links back to login page

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import SEO from '../components/SEO';
import AuthLayout from '../components/AuthLayout';
import toast from 'react-hot-toast';
import { useLang } from '../context/LangContext';

// Fixed text on this page (follows the app-wide language). Server messages
// are shown as they come.
const FORGOT_TXT = {
  en: {
    title: 'Forgot Password',
    subtitle: "Enter your phone or email and we'll help you reset it.",
    errEmail: 'Please enter your email address',
    errPhone: 'Please enter your phone number',
    failed: 'Something went wrong. Please try again.',
    verifyTitle: "We need to verify it's you",
    verifyText: "This account has no email on file, so we can't send a reset link automatically. Message us on WhatsApp and we'll help you regain access.",
    whatsapp: 'Chat with us on WhatsApp',
    checkTitle: 'Check Your Email',
    checkText: (isEmail) => `If an account with that ${isEmail ? 'email' : 'phone number'} exists, a password reset link has been emailed to it.`,
    backToLogin: '← Back to Login',
    tryAgain: 'Try again',
    phoneTab: 'Phone',
    emailTab: 'Email',
    phoneLabel: 'Phone Number',
    emailLabel: 'Email Address',
    sending: 'Sending...',
    send: 'Send Reset Link',
    remember: 'Remember your password?',
    signIn: 'Sign in',
  },
  hi: {
    title: 'पासवर्ड भूल गए',
    subtitle: 'अपना मोबाइल नंबर या ईमेल लिखें, हम नया पासवर्ड बनाने में मदद करेंगे।',
    errEmail: 'कृपया अपना ईमेल लिखें',
    errPhone: 'कृपया अपना मोबाइल नंबर लिखें',
    failed: 'कुछ गड़बड़ हो गई। फिर से कोशिश करें।',
    verifyTitle: 'हमें पक्का करना है कि यह आप ही हैं',
    verifyText: 'इस खाते में कोई ईमेल नहीं है, इसलिए हम अपने-आप लिंक नहीं भेज सकते। WhatsApp पर मैसेज करें, हम आपका खाता फिर से चालू करने में मदद करेंगे।',
    whatsapp: 'WhatsApp पर बात करें',
    checkTitle: 'अपना ईमेल देखें',
    checkText: (isEmail) => `अगर इस ${isEmail ? 'ईमेल' : 'मोबाइल नंबर'} का खाता है, तो नया पासवर्ड बनाने का लिंक उसके ईमेल पर भेज दिया गया है।`,
    backToLogin: '← लॉग इन पर वापस जाएं',
    tryAgain: 'फिर से कोशिश करें',
    phoneTab: 'फ़ोन',
    emailTab: 'ईमेल',
    phoneLabel: 'मोबाइल नंबर',
    emailLabel: 'ईमेल',
    sending: 'भेज रहे हैं...',
    send: 'पासवर्ड बदलने का लिंक भेजें',
    remember: 'पासवर्ड याद आ गया?',
    signIn: 'लॉग इन करें',
  },
};

function ForgotPassword() {
  const { lang } = useLang(); // app-wide (top-bar switch)
  const T = FORGOT_TXT[lang] || FORGOT_TXT.en;
  const [method, setMethod] = useState('phone'); // 'phone' or 'email'
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null); // { noEmailOnFile } once submitted

  const handleSubmit = async (e) => {
    e.preventDefault();

    const identifier = method === 'email' ? email : phone;
    if (!identifier) {
      toast.error(method === 'email' ? T.errEmail : T.errPhone);
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.forgotPassword(method === 'email' ? { email } : { phone });

      setResult({ noEmailOnFile: !!response.data.noEmailOnFile });

      if (response.data.resetUrl) {
        // Development only — production never returns this
        console.log('Reset URL:', response.data.resetUrl);
      }

    } catch (error) {
      const message = error.response?.data?.message || T.failed;
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title={T.title} subtitle={T.subtitle}>
      <SEO title="Forgot Password" description="Reset your ProMedicoz account password." path="/forgot-password" noindex />

      {/* Form Card */}
        <div className="bg-white rounded-xl shadow-md p-8">

          {result ? (
            // Success state — show after submission
            <div className="text-center">
              {result.noEmailOnFile ? (
                <>
                  <div className="text-5xl mb-4">💬</div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">{T.verifyTitle}</h2>
                  <p className="text-gray-600 mb-4">
                    {T.verifyText}
                  </p>
                  <a
                    href="https://wa.me/919997019900?text=Hi%2C%20I%20need%20help%20resetting%20my%20ProMedicoz%20password"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
                  >
                    {T.whatsapp}
                  </a>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-4">✉️</div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">{T.checkTitle}</h2>
                  <p className="text-gray-600 mb-4">
                    {T.checkText(method === 'email')}
                  </p>
                </>
              )}
              <div className="space-y-3 mt-6">
                <Link
                  to="/login"
                  className="block text-primary-600 font-medium hover:underline"
                >
                  {T.backToLogin}
                </Link>
                <button
                  onClick={() => { setResult(null); setEmail(''); setPhone(''); }}
                  className="text-gray-500 text-sm hover:underline"
                >
                  {T.tryAgain}
                </button>
              </div>
            </div>
          ) : (
            // Form state — before submission
            <form onSubmit={handleSubmit}>
              {/* Method toggle */}
              <div className="flex mb-5 border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setMethod('phone')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    method === 'phone' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600'
                  }`}
                >
                  {T.phoneTab}
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('email')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    method === 'email' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600'
                  }`}
                >
                  {T.emailTab}
                </button>
              </div>

              <div className="mb-6">
                {method === 'phone' ? (
                  <>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      {T.phoneLabel}
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
                      {T.emailLabel}
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? T.sending : T.send}
              </button>
            </form>
          )}

          {/* Back to login link */}
          {!result && (
            <p className="text-center text-gray-600 mt-6">
              {T.remember}{' '}
              <Link to="/login" className="text-primary-600 font-medium hover:underline">
                {T.signIn}
              </Link>
            </p>
          )}
        </div>
    </AuthLayout>
  );
}

export default ForgotPassword;
