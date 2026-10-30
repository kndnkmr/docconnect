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

import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import SEO from '../components/SEO';
import AuthLayout from '../components/AuthLayout';
import PasswordToggleIcon from '../components/PasswordToggleIcon';
import Spinner from '../components/Spinner';
import toast from 'react-hot-toast';
import { trackEvent } from '../components/Analytics';
import { loadDraft, clearDraft, DRAFT_TTL } from '../utils/drafts';
import useAutoDraft from '../utils/useAutoDraft';
import { useLang } from '../context/LangContext';

// Fixed text on this page (follows the app-wide language). Server messages
// are shown as they come.
const REG_TXT = {
  en: {
    title: 'Create Account',
    subtitle: 'Join ProMedicoz today — free in seconds.',
    bookingWith: 'Booking with',
    yourAppointment: 'Your appointment',
    bookingNote: "Create your free account — you'll go straight back to booking.",
    iAmA: 'I am a...',
    patient: 'Patient',
    doctor: 'Doctor',
    fullName: 'Full Name',
    emailLabel: 'Email Address',
    optional: '(optional)',
    phoneLabel: 'Phone Number',
    phonePh: '9876543210 (10 digits, +91 added automatically)',
    phoneTitle: 'Enter your 10-digit mobile number',
    phoneHint: "Required — you'll log in with this number. Email is optional. We'll add +91 automatically.",
    takenTitle: 'This number is already registered',
    takenText: 'You already have an account — no need to create a new one. Log in with this number.',
    takenBtn: 'Log in with this number →',
    takenForgot: "Don't remember the password? Reset it →",
    passwordLabel: 'Password',
    passwordPh: 'At least 6 characters',
    hidePw: 'Hide password',
    showPw: 'Show password',
    confirmLabel: 'Confirm Password',
    confirmPh: 'Re-enter your password',
    creating: 'Creating Account...',
    registerAs: (isDoctor) => `Register as ${isDoctor ? 'Doctor' : 'Patient'}`,
    haveAccount: 'Already have an account?',
    signInHere: 'Sign in here',
    errNamePw: 'Please fill in name and password',
    errMobile: 'Please enter your 10-digit mobile number',
    errContact: 'Please provide either email or phone number',
    errMatch: 'Passwords do not match',
    errLength: 'Password must be at least 6 characters',
    success: 'Account created successfully! Welcome to ProMedicoz.',
    failed: 'Registration failed. Please try again.',
  },
  hi: {
    title: 'खाता बनाएं',
    subtitle: 'आज ही ProMedicoz से जुड़ें — मुफ़्त, कुछ ही सेकंड में।',
    bookingWith: 'इनसे अपॉइंटमेंट',
    yourAppointment: 'आपकी अपॉइंटमेंट',
    bookingNote: 'मुफ़्त खाता बनाएं — बनते ही आप सीधे बुकिंग पर लौटेंगे।',
    iAmA: 'मैं हूँ...',
    patient: 'मरीज़',
    doctor: 'डॉक्टर',
    fullName: 'पूरा नाम',
    emailLabel: 'ईमेल',
    optional: '(ज़रूरी नहीं)',
    phoneLabel: 'मोबाइल नंबर',
    phonePh: '9876543210 (10 अंक, +91 अपने-आप जुड़ेगा)',
    phoneTitle: 'अपना 10 अंक का मोबाइल नंबर लिखें',
    phoneHint: 'ज़रूरी है — इसी नंबर से लॉग इन करेंगे। ईमेल ज़रूरी नहीं। +91 हम अपने-आप जोड़ देंगे।',
    takenTitle: 'यह नंबर पहले से रजिस्टर है',
    takenText: 'आपका खाता पहले से है — नया बनाने की ज़रूरत नहीं। इसी नंबर से लॉग इन करें।',
    takenBtn: 'इसी नंबर से लॉग इन करें →',
    takenForgot: 'पासवर्ड याद नहीं? नया बनाएं →',
    passwordLabel: 'पासवर्ड',
    passwordPh: 'कम से कम 6 अक्षर',
    hidePw: 'पासवर्ड छुपाएं',
    showPw: 'पासवर्ड दिखाएं',
    confirmLabel: 'पासवर्ड दोबारा लिखें',
    confirmPh: 'वही पासवर्ड फिर से लिखें',
    creating: 'खाता बन रहा है...',
    registerAs: (isDoctor) => (isDoctor ? 'डॉक्टर के रूप में रजिस्टर करें' : 'मरीज़ के रूप में रजिस्टर करें'),
    haveAccount: 'पहले से खाता है?',
    signInHere: 'यहाँ लॉग इन करें',
    errNamePw: 'कृपया नाम और पासवर्ड भरें',
    errMobile: 'कृपया अपना 10 अंक का मोबाइल नंबर लिखें',
    errContact: 'कृपया ईमेल या मोबाइल नंबर में से एक भरें',
    errMatch: 'दोनों पासवर्ड एक जैसे नहीं हैं',
    errLength: 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए',
    success: 'खाता बन गया! ProMedicoz में आपका स्वागत है।',
    failed: 'रजिस्टर नहीं हो पाया। फिर से कोशिश करें।',
  },
};

function Register() {
  // While the person fills in this form, quietly download the Dashboard
  // code, so the page after "Create account" / "Log in" opens straight away
  // instead of loading it then (it's ~125 KB). Same file the app uses.
  useEffect(() => {
    const t = setTimeout(() => { import('./Dashboard').catch(() => {}); }, 1200);
    return () => clearTimeout(t);
  }, []);

  const [searchParams] = useSearchParams();
  // Read ?role=doctor from the URL (if present)
  const defaultRole = searchParams.get('role') === 'doctor' ? 'doctor' : 'patient';
  const location = useLocation();
  // Carried from the login page / doctor page: where to return after signing
  // up, which doctor they're booking, and the phone they already typed.
  const doctorName = location.state?.doctorName || '';
  const prefillPhone = String(location.state?.phone || '').replace(/\D/g, '').slice(-10);

  // ---- Form state ----
  // Name / email / phone / role are kept on this device while typing (never
  // the password), so a refresh or switching apps doesn't empty the form.
  const [formData, setFormData] = useState(() => {
    const d = loadDraft('register', null, DRAFT_TTL.register);
    const x = (d && d.data) || {};
    return {
      name: typeof x.name === 'string' ? x.name : '',
      email: typeof x.email === 'string' ? x.email : '',
      password: '',
      confirmPassword: '',
      phone: prefillPhone || (typeof x.phone === 'string' ? x.phone.replace(/\D/g, '').slice(0, 10) : ''),
      role: searchParams.get('role') ? defaultRole : (x.role === 'doctor' ? 'doctor' : defaultRole),
    };
  });
  useAutoDraft('register', { name: formData.name, email: formData.email, phone: formData.phone, role: formData.role }, {
    isEmpty: (d) => !d.name.trim() && !d.email.trim() && !d.phone,
  });
  // "This phone is already registered" → offer to log in instead (box, not toast).
  const [phoneTaken, setPhoneTaken] = useState(false);
  const { lang } = useLang(); // app-wide (top-bar switch)
  const T = REG_TXT[lang] || REG_TXT.en;
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
      toast.error(T.errNamePw);
      return;
    }

    // Patients must always give a mobile number (email is optional).
    if (formData.role === 'patient' && formData.phone.length !== 10) {
      toast.error(T.errMobile);
      return;
    }

    if (!formData.email && !formData.phone) {
      toast.error(T.errContact);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error(T.errMatch);
      return;
    }

    if (formData.password.length < 6) {
      toast.error(T.errLength);
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

      clearDraft('register', null);
      // Auto-login after registration
      login(token, user);

      toast.success(T.success);
      trackEvent('register_success', { role: user.role, booking: bookingIntent ? 'yes' : 'no' });
      // A new doctor always lands on their dashboard to finish onboarding; a
      // new patient is returned to wherever they were headed (e.g. the booking
      // page), falling back to the dashboard.
      navigate(user.role === 'doctor' ? '/dashboard' : (returnTo || '/dashboard'), { replace: true });

    } catch (error) {
      const message = error.response?.data?.message || T.failed;
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
    <AuthLayout title={T.title} subtitle={T.subtitle}>
      <SEO title="Register" description="Create your free ProMedicoz account. Book doctors, manage appointments, and access prescriptions online." path="/register" noindex />

      {/* Form Card */}
        <div className="bg-white rounded-xl shadow-md p-8">
          {/* Booking context — the patient sees why they're registering and
              that they'll come straight back to book. */}
          {bookingIntent && (
            <div className="mb-5 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
              <p className="text-xs text-green-800">{T.bookingWith}</p>
              <p className="font-bold text-green-900">{doctorName || T.yourAppointment}</p>
              <p className="mt-1 text-xs text-green-800">
                {T.bookingNote}
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit}>

            {/* Role Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {T.iAmA}
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
                  🙋 {T.patient}
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
                  👨‍⚕️ {T.doctor}
                </button>
              </div>
            </div>

            {/* Name Field */}
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                {T.fullName}
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
                {T.emailLabel} {formData.role === 'patient' && <span className="text-gray-400">{T.optional}</span>}
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
                {T.phoneLabel} {formData.role === 'patient' && <span className="text-red-500">*</span>}
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
                  placeholder={T.phonePh}
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:bg-white outline-none transition"
                  required={formData.role === 'patient'}
                  pattern={formData.role === 'patient' ? '\\d{10}' : undefined}
                  title={formData.role === 'patient' ? T.phoneTitle : undefined}
                />
              </div>
              {formData.role === 'patient' && (
                <p className="text-xs text-gray-500 mt-1">{T.phoneHint}</p>
              )}
              {phoneTaken && (
                <div role="alert" className="mt-3 rounded-2xl border-2 border-primary-300 bg-primary-50 p-4">
                  <p className="font-bold text-primary-900">
                    ✓ {T.takenTitle}
                  </p>
                  <p className="mt-1 text-sm text-primary-900">
                    {T.takenText}
                  </p>
                  <button type="button" onClick={toLogin} className="mt-3 w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold">
                    {T.takenBtn}
                  </button>
                  <Link to="/forgot-password" className="mt-2 block text-center text-sm font-medium text-primary-700 hover:underline">
                    {T.takenForgot}
                  </Link>
                </div>
              )}
            </div>

            {/* Password Field */}
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                {T.passwordLabel}
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
                  placeholder={T.passwordPh}
                  className="w-full pl-11 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:bg-white outline-none transition"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? T.hidePw : T.showPw}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  <PasswordToggleIcon visible={showPassword} />
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div className="mb-6">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                {T.confirmLabel}
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
                  placeholder={T.confirmPh}
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
              {isLoading ? T.creating : T.registerAs(formData.role === 'doctor')}
            </button>
          </form>

          {/* Link to login page */}
          <p className="text-center text-gray-600 mt-6">
            {T.haveAccount}{' '}
            <Link to="/login" state={{ from: returnTo, doctorName, phone: formData.phone, skipAsk: true }} className="text-primary-600 font-medium hover:underline">
              {T.signInHere}
            </Link>
          </p>
        </div>
    </AuthLayout>
  );
}

export default Register;
