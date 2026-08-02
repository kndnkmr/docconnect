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
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

function Register() {
  // ---- Form state ----
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'patient'   // Default role
  });
  // Using ONE state object for all fields (alternative to separate useState for each)
  // This is common for forms with many fields

  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // ---- Handle input changes ----
  // ONE handler for ALL fields (instead of one per field)
  const handleChange = (e) => {
    const { name, value } = e.target;
    // name = the "name" attribute of the input (e.g., "email")
    // value = what the user typed

    setFormData(prev => ({
      ...prev,        // Keep all existing fields
      [name]: value   // Update ONLY the field that changed
    }));
    // This is called "computed property names" — [name] becomes "email", "password", etc.
    // ...prev is the "spread operator" — copies all properties from the previous state
  };

  // ---- Handle form submission ----
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Please fill in all required fields');
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
        role: formData.role
      });
      // Note: we don't send confirmPassword to the server — it's just for client validation

      const { token, user } = response.data;

      // Auto-login after registration
      login(token, user);

      toast.success('Account created successfully! Welcome to DocConnect.');
      navigate('/dashboard');

    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Create Account</h1>
          <p className="text-gray-600 mt-2">Join DocConnect today</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-md p-8">
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
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder={formData.role === 'doctor' ? 'Dr. John Smith' : 'John Smith'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                required
              />
            </div>

            {/* Email Field */}
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                required
              />
            </div>

            {/* Password Field */}
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 6 characters"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                required
                minLength={6}
              />
            </div>

            {/* Confirm Password Field */}
            <div className="mb-6">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating Account...' : `Register as ${formData.role === 'doctor' ? 'Doctor' : 'Patient'}`}
            </button>
          </form>

          {/* Link to login page */}
          <p className="text-center text-gray-600 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
