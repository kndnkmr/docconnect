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
import { trackEvent } from '../components/Analytics';

// Same help number as the floating WhatsApp button.
const WHATSAPP_HELP = import.meta.env.VITE_WHATSAPP_NUMBER || '919997019900';
const spacedPhone = (p) => (p && p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p || '');

// Guidance text for first-time patients (follows the saved language; the
// rest of this page stays English as before).
const GUIDE = {
  en: {
    bookTitle: 'Book your appointment',
    bookSub: "One quick step — then you'll pick your time.",
    bookingWith: 'Booking with',
    yourAppointment: 'Your appointment',
    askQ: 'Have you used ProMedicoz before?',
    newBtn: "No, I'm new here",
    newSub: 'Create a free account in 30 seconds, then book',
    oldBtn: 'Yes, I have an account',
    oldSub: 'Log in with my phone and password',
    notRegTitle: 'This number is not registered',
    notRegText: (p) => `${p} doesn't have a ProMedicoz account yet. First-time patients need to create one first (free, 30 seconds).`,
    notRegBtn: 'Create account with this number →',
    notRegNote: (d) => `Your number is filled in, and you'll come straight back to book${d ? ` ${d}` : ''}.`,
    typo: 'Typed the number wrong? Edit it above and try again.',
    wrongTitle: 'Wrong password',
    wrongText: "This number has an account, but the password doesn't match. Tap the eye icon to check what you typed.",
    invalidTitle: 'Details or password are wrong',
    invalidText: 'Please check both. New to ProMedicoz? Create a free account first.',
    invalidBtn: 'Create a free account →',
    forgot: 'Forgot password? Reset it →',
    help: '💬 Still stuck? Get help on WhatsApp',
    helpMsg: (p, d) => `Hi ProMedicoz, I can't log in.${p ? ` My number: ${p}.` : ''}${d ? ` I want to book ${d}.` : ''}`,
  },
  hi: {
    bookTitle: 'अपनी अपॉइंटमेंट बुक करें',
    bookSub: 'एक छोटा कदम — फिर आप अपना समय चुनेंगे।',
    bookingWith: 'इनसे अपॉइंटमेंट',
    yourAppointment: 'आपकी अपॉइंटमेंट',
    askQ: 'क्या आपने पहले ProMedicoz इस्तेमाल किया है?',
    newBtn: 'नहीं, मैं नया हूँ',
    newSub: '30 सेकंड में मुफ़्त खाता बनाएं, फिर बुक करें',
    oldBtn: 'हाँ, मेरा खाता है',
    oldSub: 'फ़ोन नंबर और पासवर्ड से लॉग इन करें',
    notRegTitle: 'यह नंबर रजिस्टर नहीं है',
    notRegText: (p) => `${p} का ProMedicoz पर अभी कोई खाता नहीं है। पहली बार आने वाले मरीज़ों को पहले खाता बनाना होता है (मुफ़्त, 30 सेकंड)।`,
    notRegBtn: 'इसी नंबर से खाता बनाएं →',
    notRegNote: (d) => `आपका नंबर भर दिया जाएगा, और खाता बनते ही आप सीधे${d ? ` ${d} की` : ''} बुकिंग पर लौटेंगे।`,
    typo: 'नंबर गलत लिखा? ऊपर ठीक करके फिर कोशिश करें।',
    wrongTitle: 'पासवर्ड गलत है',
    wrongText: 'इस नंबर का खाता है, पर पासवर्ड मेल नहीं खा रहा। आँख वाले बटन से देखें कि क्या लिखा है।',
    invalidTitle: 'जानकारी या पासवर्ड गलत है',
    invalidText: 'दोनों दोबारा जाँचें। ProMedicoz पर नए हैं? पहले मुफ़्त खाता बनाएं।',
    invalidBtn: 'मुफ़्त खाता बनाएं →',
    forgot: 'पासवर्ड भूल गए? नया बनाएं →',
    help: '💬 फिर भी दिक्कत? WhatsApp पर मदद लें',
    helpMsg: (p, d) => `Hi ProMedicoz, I can't log in.${p ? ` My number: ${p}.` : ''}${d ? ` I want to book ${d}.` : ''}`,
  },
};

function Login() {
  // ---- State for form fields ----
  const [email, setEmail] = useState('');
  const location = useLocation();
  // Where the user was headed before being bounced to login (set by
  // ProtectedRoute, or by a "Log in to Book" link). Used to return them there
  // after a successful login instead of dumping them on the dashboard.
  const returnTo = location.state?.from || null;
  // Pre-filled when coming back from the register page ("already registered").
  const [phone, setPhone] = useState(() => String(location.state?.phone || '').replace(/\D/g, '').slice(-10));
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState('phone'); // 'email' or 'phone'
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  // login function from our AuthContext

  const navigate = useNavigate();
  // For redirecting after successful login

  // ---- Booking-aware guidance for new patients ----
  // Coming from a "Log in to Book" button (or a protected booking page), a
  // first-time patient used to type a phone + password they never created
  // and only saw a vague, disappearing error. Now: ask "new or existing?"
  // first, and if the number isn't registered, say so plainly with a
  // one-tap "create account with this number" that returns to the booking.
  const doctorName = location.state?.doctorName || '';
  const bookingIntent = Boolean(returnTo && returnTo.startsWith('/book-appointment'));
  const [step, setStep] = useState(() => (bookingIntent && !location.state?.skipAsk ? 'ask' : 'form'));
  const [loginError, setLoginError] = useState(null); // { code, phone }
  const [wrongTries, setWrongTries] = useState(0);
  const lang = (() => { try { return localStorage.getItem('promedicoz_lang') === 'hi' ? 'hi' : 'en'; } catch { return 'en'; } })();
  const L = GUIDE[lang];
  const carry = { from: returnTo, doctorName };
  const goRegister = (withPhone, source) => {
    trackEvent('login_to_register', { source, booking: bookingIntent ? 'yes' : 'no' });
    navigate('/register', { state: { ...carry, phone: withPhone || '' } });
  };
  const helpUrl = `https://wa.me/${WHATSAPP_HELP}?text=${encodeURIComponent(L.helpMsg(loginError?.phone || phone, doctorName))}`;

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
      const data = error.response?.data || {};
      const credentialError = error.response?.status === 401
        && (data.code === 'NOT_REGISTERED' || data.code === 'WRONG_PASSWORD' || data.message === 'Invalid email or password');
      if (credentialError) {
        // Shown as a box that STAYS on screen with the next step, not a toast.
        const code = data.code || 'INVALID';
        setLoginError({ code, phone: loginMethod === 'phone' ? phone : '' });
        if (code === 'WRONG_PASSWORD' || code === 'INVALID') setWrongTries((n) => n + 1);
        trackEvent('login_error', { code: code.toLowerCase(), booking: bookingIntent ? 'yes' : 'no' });
      } else {
        // Deleted/suspended accounts, network errors etc. — as before.
        const message = data.message || 'Login failed. Please try again.';
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
      // "finally" runs whether success OR error — always stop loading
    }
  };

  return (
    <AuthLayout
      title={bookingIntent ? L.bookTitle : 'Welcome Back'}
      subtitle={bookingIntent ? L.bookSub : 'Sign in to your ProMedicoz account — works for both Doctors and Patients.'}
    >
      <SEO title="Login" description="Sign in to your ProMedicoz account. Manage appointments, view prescriptions, and book doctors." path="/login" noindex />

      {/* Form Card */}
        <div className="bg-white rounded-xl shadow-md p-8">
          {/* Who they're booking with — keeps the goal visible. */}
          {bookingIntent && (
            <div className="mb-5 rounded-xl bg-primary-50 border border-primary-200 px-4 py-3">
              <p className="text-xs text-primary-700">{L.bookingWith}</p>
              <p className="font-bold text-primary-900">{doctorName || L.yourAppointment}</p>
            </div>
          )}

          {step === 'ask' ? (
            <div>
              <p className="text-base font-bold text-gray-900 mb-3">{L.askQ}</p>
              <button
                type="button"
                onClick={() => { trackEvent('login_choice', { choice: 'new' }); goRegister('', 'ask_new'); }}
                className="w-full rounded-2xl bg-green-600 hover:bg-green-700 text-white px-4 py-4 text-center transition-colors"
              >
                <span className="block text-base font-bold">🆕 {L.newBtn}</span>
                <span className="block text-xs text-green-50 mt-0.5">{L.newSub}</span>
              </button>
              <button
                type="button"
                onClick={() => { trackEvent('login_choice', { choice: 'existing' }); setStep('form'); }}
                className="mt-3 w-full rounded-2xl border-2 border-primary-600 bg-white hover:bg-primary-50 px-4 py-4 text-center transition-colors"
              >
                <span className="block text-base font-bold text-primary-700">✓ {L.oldBtn}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{L.oldSub}</span>
              </button>
            </div>
          ) : (
          <>
          <form onSubmit={handleSubmit}>

            {/* Login method toggle — segmented pill control */}
            <div className="flex mb-5 bg-gray-100 rounded-xl p-1">
              <button
                type="button"
                onClick={() => { setLoginMethod('phone'); setLoginError(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loginMethod === 'phone' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📱 Phone
              </button>
              <button
                type="button"
                onClick={() => { setLoginMethod('email'); setLoginError(null); }}
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
                      onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setLoginError(null); }}
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
                      onChange={(e) => { setEmail(e.target.value); setLoginError(null); }}
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

            {/* Clear, persistent guidance when login fails (not a toast). */}
            {loginError?.code === 'NOT_REGISTERED' && (
              <div role="alert" className="mb-5 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4">
                <p className="font-bold text-amber-900">📵 {L.notRegTitle}</p>
                <p className="mt-1 text-sm text-amber-900">{L.notRegText(spacedPhone(loginError.phone))}</p>
                <button
                  type="button"
                  onClick={() => goRegister(loginError.phone, 'not_registered')}
                  className="mt-3 w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-colors"
                >
                  {L.notRegBtn}
                </button>
                {bookingIntent && <p className="mt-2 text-xs text-amber-800">{L.notRegNote(doctorName)}</p>}
                <p className="mt-1 text-xs text-primary-700">{L.typo}</p>
              </div>
            )}
            {(loginError?.code === 'WRONG_PASSWORD' || loginError?.code === 'INVALID') && (
              <div role="alert" className="mb-5 rounded-2xl border-2 border-red-300 bg-red-50 p-4">
                <p className="font-bold text-red-900">🔒 {loginError.code === 'WRONG_PASSWORD' ? L.wrongTitle : L.invalidTitle}</p>
                <p className="mt-1 text-sm text-red-900">{loginError.code === 'WRONG_PASSWORD' ? L.wrongText : L.invalidText}</p>
                <Link
                  to="/forgot-password"
                  onClick={() => trackEvent('login_forgot_click', { booking: bookingIntent ? 'yes' : 'no' })}
                  className="mt-3 block w-full py-2.5 rounded-xl border border-red-400 bg-white text-center text-sm font-bold text-red-700 hover:bg-red-50"
                >
                  {L.forgot}
                </Link>
                {loginError.code === 'INVALID' && (
                  <button type="button" onClick={() => goRegister(loginError.phone, 'invalid')} className="mt-2 w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold">
                    {L.invalidBtn}
                  </button>
                )}
                {wrongTries >= 2 && (
                  <a
                    href={helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent('login_whatsapp_help', { booking: bookingIntent ? 'yes' : 'no' })}
                    className="mt-3 block text-center text-sm font-bold text-green-700 hover:underline"
                  >
                    {L.help}
                  </a>
                )}
              </div>
            )}

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

          {/* Link to register page — carries the booking so a new patient
              comes straight back to it after signing up. */}
          <p className="text-center text-gray-600 mt-4">
            Don't have an account?{' '}
            <Link to="/register" state={carry} onClick={() => trackEvent('login_to_register', { source: 'footer_link', booking: bookingIntent ? 'yes' : 'no' })} className="text-primary-600 font-medium hover:underline">
              Register here
            </Link>
          </p>
          </>
          )}
        </div>
    </AuthLayout>
  );
}

export default Login;
