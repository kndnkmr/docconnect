// ============================================
// Home Page - Landing Page
// ============================================
// The first thing users see when they visit the website.
// It should: explain what the app does, look professional,
// and guide users to take action (register, find doctors).
//
// KEY CONCEPTS:
// - Component structure: JSX that returns HTML-like elements
// - Tailwind responsive classes: sm:, md:, lg: prefixes
// - Link navigation: buttons that go to other pages

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { reviewAPI } from '../services/api';

function Home() {
  const { isAuthenticated } = useAuth();
  const [symptomSearch, setSymptomSearch] = useState('');
  const [topReviews, setTopReviews] = useState([]);

  // Fetch top reviews for testimonials
  useEffect(() => {
    const fetchTopReviews = async () => {
      try {
        // Get reviews from all doctors — we'll use a general endpoint
        const response = await reviewAPI.getTopReviews();
        setTopReviews(response.data.reviews || []);
      } catch (error) {
        // Silently fail — testimonials are optional
        console.error('Fetch reviews error:', error);
      }
    };
    fetchTopReviews();
  }, []);

  // Smart symptom → specialization mapping
  const getSpecializationFromSymptom = (input) => {
    const lower = input.toLowerCase();
    const mapping = [
      { keywords: ['fever', 'cold', 'cough', 'flu', 'infection', 'weakness', 'fatigue'], specialization: 'General Physician' },
      { keywords: ['head', 'migraine', 'brain', 'nerve', 'seizure', 'numbness', 'dizziness'], specialization: 'Neurologist' },
      { keywords: ['pregnan', 'ivf', 'period', 'menstrual', 'pcod', 'pcos', 'fertility', 'gynae', 'uterus', 'ovary'], specialization: 'Gynaecologist' },
      { keywords: ['skin', 'acne', 'hair', 'rash', 'itch', 'pimple', 'dandruff', 'allergy'], specialization: 'Dermatologist' },
      { keywords: ['heart', 'chest pain', 'bp', 'blood pressure', 'cholesterol'], specialization: 'Cardiologist' },
      { keywords: ['bone', 'joint', 'knee', 'back pain', 'spine', 'fracture', 'shoulder'], specialization: 'Orthopedic' },
      { keywords: ['child', 'baby', 'infant', 'kid', 'vaccination', 'newborn'], specialization: 'Pediatrician' },
      { keywords: ['tooth', 'teeth', 'dental', 'gum', 'cavity', 'braces'], specialization: 'Dentist' },
      { keywords: ['eye', 'vision', 'glass', 'cataract', 'spectacle'], specialization: 'Ophthalmologist' },
      { keywords: ['depress', 'anxiety', 'stress', 'sleep', 'mental', 'panic', 'mood'], specialization: 'Psychiatrist' },
      { keywords: ['ear', 'nose', 'throat', 'sinus', 'hearing', 'tonsil', 'snoring'], specialization: 'ENT Specialist' },
      { keywords: ['stomach', 'digest', 'acid', 'gastric', 'liver', 'constipat', 'diarr', 'bloat'], specialization: 'Gastroenterologist' },
      { keywords: ['urine', 'kidney', 'bladder', 'prostate'], specialization: 'Urologist' },
      { keywords: ['diabetes', 'thyroid', 'hormone', 'sugar'], specialization: 'Endocrinologist' },
      { keywords: ['lung', 'breath', 'asthma', 'wheez', 'pneumonia'], specialization: 'Pulmonologist' },
    ];

    for (const entry of mapping) {
      if (entry.keywords.some(keyword => lower.includes(keyword))) {
        return entry.specialization;
      }
    }
    return 'General Physician'; // Default fallback
  };

  return (
    <div>
      {/* ---- Hero Section (the big banner at the top) ---- */}
      <section className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        {/*
          bg-gradient-to-r = background gradient going left → right
          from-primary-600 to-primary-800 = blue gradient
        */}
        <div className="container mx-auto px-4 py-20 md:py-32">
          {/* py-20 on mobile, py-32 on medium+ screens */}
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Find the Right Doctor, Book Instantly
            </h1>
            <p className="text-xl md:text-2xl text-primary-100 mb-8">
              Connect with qualified healthcare professionals. 
              Browse profiles and book consultations — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* flex-col on mobile (stacked), flex-row on sm+ (side by side) */}
              <Link
                to="/doctors"
                className="bg-white text-primary-700 px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors text-center"
              >
                Find a Doctor
              </Link>
              {!isAuthenticated && (
                <Link
                  to="/register?role=doctor"
                  className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-white hover:text-primary-700 transition-colors text-center"
                >
                  Join as a Doctor
                </Link>
              )}
              {!isAuthenticated && (
                <Link
                  to="/login"
                  className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-white hover:text-primary-700 transition-colors text-center"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Consult Now Section (Symptom-based search) — FIRST after hero ---- */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">
            Consult Now
          </h2>
          <p className="text-center text-gray-600 mb-6">
            Select your symptom or concern — we'll connect you with the right specialist
          </p>

          {/* Text input for custom symptoms */}
          <div className="max-w-xl mx-auto mb-8">
            <div className="relative">
              <input
                type="text"
                value={symptomSearch}
                onChange={(e) => setSymptomSearch(e.target.value)}
                placeholder="Describe your problem (e.g., back pain, irregular periods, anxiety...)"
                className="w-full px-5 py-3 pr-24 border-2 border-gray-200 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              />
              {symptomSearch && (
                <Link
                  to={`/doctors?specialization=${encodeURIComponent(getSpecializationFromSymptom(symptomSearch))}`}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-primary-700"
                >
                  Find Doctor
                </Link>
              )}
            </div>
            {symptomSearch && (
              <p className="text-xs text-primary-600 mt-2 text-center">
                Suggested: {getSpecializationFromSymptom(symptomSearch)}
              </p>
            )}
          </div>

          {/* Symptom cards grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
            {[
              { symptom: 'Fever / Cold', icon: '🤒', specialization: 'General Physician' },
              { symptom: 'Headache / Migraine', icon: '🤕', specialization: 'Neurologist' },
              { symptom: 'Pregnancy / IVF', icon: '🤰', specialization: 'Gynaecologist' },
              { symptom: 'Skin / Hair', icon: '🧴', specialization: 'Dermatologist' },
              { symptom: 'Heart / BP', icon: '❤️', specialization: 'Cardiologist' },
              { symptom: 'Bone / Joint Pain', icon: '🦴', specialization: 'Orthopedic' },
              { symptom: 'Child Health', icon: '👶', specialization: 'Pediatrician' },
              { symptom: 'Dental / Teeth', icon: '🦷', specialization: 'Dentist' },
              { symptom: 'Eye / Vision', icon: '👁️', specialization: 'Ophthalmologist' },
              { symptom: 'Mental Health', icon: '🧠', specialization: 'Psychiatrist' },
              { symptom: 'Ear / Nose / Throat', icon: '👂', specialization: 'ENT Specialist' },
              { symptom: 'Stomach / Digestion', icon: '🫁', specialization: 'Gastroenterologist' },
            ].map((item, idx) => (
              <Link
                key={idx}
                to={`/doctors?specialization=${encodeURIComponent(item.specialization)}`}
                className="bg-gray-50 p-4 rounded-xl hover:shadow-md transition-all text-center border border-gray-100 hover:border-primary-200 hover:bg-primary-50"
              >
                <div className="text-3xl mb-2">{item.icon}</div>
                <p className="text-sm font-medium text-gray-800">{item.symptom}</p>
                <p className="text-xs text-primary-600 mt-1">{item.specialization}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Features Section ---- */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
            How DocConnect Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/*
              grid = CSS Grid layout
              grid-cols-1 = 1 column on mobile
              md:grid-cols-3 = 3 columns on medium+ screens
              gap-8 = space between grid items
            */}

            {/* Feature Card 1 */}
            <div className="text-center p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                Search Doctors
              </h3>
              <p className="text-gray-600">
                Browse our network of qualified doctors. 
                Filter by specialization, experience, and location.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="text-center p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-5xl mb-4">📅</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                Book Appointment
              </h3>
              <p className="text-gray-600">
                Choose a convenient time slot and book your consultation. 
                In-person, video, or phone — your choice.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ---- Stats Section ---- */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary-600">100+</div>
              <div className="text-gray-600 mt-2">Doctors</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary-600">20+</div>
              <div className="text-gray-600 mt-2">Specializations</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary-600">1000+</div>
              <div className="text-gray-600 mt-2">Appointments</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Testimonials Section (Auto-scrolling reviews) ---- */}
      <section className="py-12 bg-white overflow-hidden">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
            What Our Patients Say
          </h2>
          <p className="text-center text-gray-500 mb-8 text-sm">Real reviews from real patients</p>
        </div>

        {/* Scrolling marquee */}
        {topReviews.length > 0 ? (
          <div className="relative">
            <div className="flex animate-scroll gap-6 px-4">
              {[...topReviews, ...topReviews].map((review, idx) => (
                <div
                  key={idx}
                  className="min-w-[300px] max-w-[300px] bg-gray-50 border border-gray-100 rounded-xl p-5 flex-shrink-0"
                >
                  <div className="text-yellow-400 text-sm mb-2">{'⭐'.repeat(review.rating)}</div>
                  <p className="text-gray-700 text-sm line-clamp-3">"{review.comment}"</p>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-800">{review.patient?.name}</span>
                    <span className="text-xs text-gray-400">
                      for Dr. {review.doctor?.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-400 text-sm">Reviews will appear here once patients start rating.</p>
        )}
      </section>

      {/* ---- CTA (Call to Action) Section ---- */}
      <section className="py-16 bg-primary-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Are You a Doctor?
          </h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Join DocConnect to reach more patients, manage your schedule, 
            and grow your practice effortlessly.
          </p>
          {!isAuthenticated && (
            <Link
              to="/register"
              className="bg-white text-primary-700 px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors inline-block"
            >
              Register Now
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

export default Home;
