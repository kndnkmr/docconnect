// ============================================
// Register Page - Create New Account
// ============================================
// A form where new users create an account.
// They choose whether they're a DOCTOR or PATIENT.
//
// KEY CONCEPT: Form with multiple fields + role selection
// The role determines what they can do after registering:
// - Doctor: update profile, manage appointments, set availability
// - Patient: browse doctors, book appointments

import { useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import SEO from '../components/SEO';
import AuthLayout from '../components/AuthLayout';
import PasswordToggleIcon from '../components/PasswordToggleIcon';
import Spinner from '../components/Spinner';
import toast from 'react-hot-toast';
import { trackEvent } from '../components/Analytics';

function Register() {
  const [searchParams] = useSearchParams();
  // Read ?role=doctor from the URL (if present)
  const defaultRole = searchParams.get('role') === 'doctor' ? 'doctor' : 'patient';
  const location = useLocation();
  // Carried from the login page / doctor page: where to return after signing
  // up, which doctor they're booking, and the phone they already typed.
  const doctorName = location.state?.doctorName || '';
  const prefillPhone = String(location.state?.phone || '').replace(/\D/g, '').slice(-10);

  // ---- Form state ----
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: prefillPhone,
    role: defaultRole
  });
  // "This phone is already registered" → offer to log in instead (box, not toast).
  const [phoneTaken, setPhoneTaken] = useState(false);
  const lang = (() => { try { return localStorage.getItem('promedicoz_lang') === 'hi' ? 'hi' : 'en'; } catch { return 'en'; } })();
  // Using ONE state object for all fields (alternative to separate useState for each)
  // This is common for forms with many fields

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  // Where the user was headed before auth (carried through from a "Log in to
  // Book" link that also offers "create an account"), so a brand-new patient
  // who signs up mid-booking is returned to that booking page.
  const returnTo = location.state?.from || null;
  const bookingIntent = Boolean(returnTo && returnTo.startsWith('/book-appointment'));
  const toLogin = () => navigate('/login', { state: { from: returnTo, doctorName, phone: formData.phone, skipAsk: true } });

  // ---- Handle input changes ----
  // ONE handler for ALL fields (instead of one per field)
  const handleChange = (e) => {
    const { name, value } = e.target;
    // name = the "name" attribute of the input (e.g., "email")
    // value = what the user typed

    // Phone: only digits, capped at 10 (matches Indian mobile number length)
    const cleanedValue = name === 'phone' ? value.replace(/\D/g, '').slice(0, 10) : value;
    if (name === 'phone') setPhoneTaken(false);

    setFormData(prev => ({
      ...prev,        // Keep all existing fields
      [name]: cleanedValue   // Update ONLY the field that changed
    }));
    // This is called "computed property names" — [name] becomes "email", "password", etc.
    // ...prev is the "spread operator" — copies all properties from the previous state
  };

  // ---- Handle form submission ----
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.password) {
      toast.error('Please fill in name and password');
      return;
    }

    // Patients must always give a mobile number (email is optional).
    if (formData.role === 'patient' && formData.phone.length !== 10) {
      toast.error('Please enter your 10-digit mobile number');
      return;
    }

    if (!formData.email && !formData.phone) {
      toast.error('Please provide either email or phone number');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      // Send registration request
      const response = await authAPI.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        role: formData.role
      });
      // Note: we don't send confirmPassword to the server — it's just for client validation

      const { token, user } = response.data;

      // Auto-login after registration
      login(token, user);

      toast.success('Account created successfully! Welcome to ProMedicoz.');
      trackEvent('register_success', { role: user.role, booking: bookingIntent ? 'yes' : 'no' });
      // A new doctor always lands on their dashboard to finish onboarding; a
      // new patient is returned to wherever they were headed (e.g. the booking
      // page), falling back to the dashboard.
      navigate(user.role === 'doctor' ? '/dashboard' : (returnTo || '/dashboard'), { replace: true });

    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed. Please try again.';
      if (/phone number already exists/i.test(message)) {
        setPhoneTaken(true);
        trackEvent('register_phone_taken', { booking: bookingIntent ? 'yes' : 'no' });
      } else {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Create Account" subtitle="Join ProMedicoz today — free in seconds.">
      <SEO title="Register" description="Create your free ProMedicoz account. Book doctors, manage appointments, and access prescriptions online." path="/register" noindex />

      {/* Form Card */}
        <div className="bg-white rounded-xl shadow-md p-8">
          {/* Booking context — the patient sees why they're registering and
              that they'll come straight back to book. */}
          {bookingIntent && (
            <div className="mb-5 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
              <p className="text-xs text-green-800">{lang === 'hi' ? 'इनसे अपॉइंटमेंट' : 'Booking with'}</p>
              <p className="font-bold text-green-900">{doctorName || (lang === 'hi' ? 'आपकी अपॉइंटमेंट' : 'Your appointment')}</p>
              <p className="mt-1 text-xs text-green-800">
                {lang === 'hi'
                  ? 'मुफ़्त खाता बनाएं — बनते ही आप सीधे बुकिंग पर लौटेंगे।'
                  : "Create your free account — you'll go straight back to booking."}
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit}>

            {/* Role Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                I am a...
              </label>
              <div className="grid grid-cols-2 gap-3">
                {/* Two buttons side by side — one for each role */}
                <button
                  type="button"
                  // type="button" prevents form submission when clicked
                  onClick={() => setFormData(prev => ({ ...prev, role: 'patient' }))}
                  className={`py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                    formData.role === 'patient'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                  // Dynamic classes: different styles based on which role is selected
                  // Template literal with ternary: `${condition ? 'classA' : 'classB'}`
                >
                  🙋 Patient
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, role: 'doctor' }))}
                  className={`py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                    formData.role === 'doctor'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  👨‍⚕️ Doctor
                </button>
              </div>
            </div>

            {/* Name Field */}
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true">👤</span>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  autoFocus
                  value={formData.name}
                  onChange={handleChange}
                  placeholder={formData.role === 'doctor' ? 'Dr. John Smith' : 'John Smith'}
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:bg-white outline-none transition"
                  required
                />
              </div>
            </div>

            {/* Email Field (optional for patients) */}
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address {formData.role === 'patient' && <span className="text-gray-400">(optional)</span>}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true">✉️</span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:bg-white outline-none transition"
                  required={formData.role === 'doctor'}
                />
              </div>
            </div>

            {/* Phone Number Field (always required for patients) */}
            <div className="mb-4">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number {formData.role === 'patient' && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true">📱</span>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="9876543210 (10 digits, +91 added automatically)"
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:bg-white outline-none transition"
                  required={formData.role === 'patient'}
                  pattern={formData.role === 'patient' ? '\\d{10}' : undefined}
                  title={formData.role === 'patient' ? 'Enter your 10-digit mobile number' : undefined}
                />
              </div>
              {formData.role === 'patient' && (
                <p className="text-xs text-gray-500 mt-1">Required — you'll log in with this number. Email is optional. We'll add +91 automatically.</p>
              )}
              {phoneTaken && (
                <div role="alert" className="mt-3 rounded-2xl border-2 border-primary-300 bg-primary-50 p-4">
                  <p className="font-bold text-primary-900">
                    ✓ {lang === 'hi' ? 'यह नंबर पहले से रजिस्टर है' : 'This number is already registered'}
                  </p>
                  <p className="mt-1 text-sm text-primary-900">
                    {lang === 'hi'
                      ? 'आपका खाता पहले से है — नया बनाने की ज़रूरत नहीं। इसी नंबर से लॉग इन करें।'
                      : 'You already have an account — no need to create a new one. Log in with this number.'}
                  </p>
                  <button type="button" onClick={toLogin} className="mt-3 w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold">
                    {lang === 'hi' ? 'इसी नंबर से लॉग इन करें →' : 'Log in with this number →'}
                  </button>
                  <Link to="/forgot-password" className="mt-2 block text-center text-sm font-medium text-primary-700 hover:underline">
                    {lang === 'hi' ? 'पासवर्ड याद नहीं? नया बनाएं →' : "Don't remember the password? Reset it →"}
                  </Link>
                </div>
              )}
            </div>

            {/* Password Field */}
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true">🔒</span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="At least 6 characters"
                  className="w-full pl-11 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:bg-white outline-none transition"
                  required
                  minLength={6}
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

            {/* Confirm Password Field */}
            <div className="mb-6">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true">🔒</span>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  className="w-full pl-11 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:bg-white outline-none transition"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading && <Spinner />}
              {isLoading ? 'Creating Account...' : `Register as ${formData.role === 'doctor' ? 'Doctor' : 'Patient'}`}
            </button>
          </form>

          {/* Link to login page */}
          <p className="text-center text-gray-600 mt-6">
            Already have an account?{' '}
            <Link to="/login" state={{ from: returnTo, doctorName, phone: formData.phone, skipAsk: true }} className="text-primary-600 font-medium hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
    </AuthLayout>
  );
}

export default Register;
