import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { reviewAPI } from '../services/api';

function Home() {
  const { isAuthenticated } = useAuth();
  const [symptomSearch, setSymptomSearch] = useState('');
  const [topReviews, setTopReviews] = useState([]);

  useEffect(() => {
    const fetchTopReviews = async () => {
      try {
        const response = await reviewAPI.getTopReviews();
        setTopReviews(response.data.reviews || []);
      } catch (error) {
        console.error('Fetch reviews error:', error);
      }
    };
    fetchTopReviews();
  }, []);

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
    return 'General Physician';
  };

  return (
    <div>
      {/* ---- Hero Section with inline stats ---- */}
      <section className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Find the Right Doctor, Book Instantly
            </h1>
            <p className="text-lg md:text-xl text-primary-100 mb-6">
              Connect with qualified healthcare professionals.
              Browse profiles and book consultations — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link to="/doctors" className="bg-white text-primary-700 px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors text-center">
                Find a Doctor
              </Link>
              {!isAuthenticated && (
                <Link to="/register?role=doctor" className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-white hover:text-primary-700 transition-colors text-center">
                  Join as a Doctor
                </Link>
              )}
              {!isAuthenticated && (
                <Link to="/login" className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-white hover:text-primary-700 transition-colors text-center">
                  Sign In
                </Link>
              )}
            </div>

            {/* Stats inline in hero — saves a full section */}
            <div className="flex gap-8 pt-4 border-t border-primary-500">
              <div>
                <div className="text-2xl font-bold">100+</div>
                <div className="text-primary-200 text-sm">Doctors</div>
              </div>
              <div>
                <div className="text-2xl font-bold">20+</div>
                <div className="text-primary-200 text-sm">Specializations</div>
              </div>
              <div>
                <div className="text-2xl font-bold">1000+</div>
                <div className="text-primary-200 text-sm">Appointments</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Consult Now — top 6 symptoms only ---- */}
      <section className="py-10 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Consult Now</h2>
          <p className="text-center text-gray-500 mb-6 text-sm">Select your concern — we'll find the right specialist</p>

          {/* Symptom search */}
          <div className="max-w-xl mx-auto mb-6">
            <div className="relative">
              <input
                type="text"
                value={symptomSearch}
                onChange={(e) => setSymptomSearch(e.target.value)}
                placeholder="Describe your problem (e.g., back pain, fever, anxiety...)"
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

          {/* Symptom cards — all departments */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-w-5xl mx-auto">
            {[
              { symptom: 'Fever / Cold', icon: '🤒', specialization: 'General Physician' },
              { symptom: 'Headache', icon: '🤕', specialization: 'Neurologist' },
              { symptom: 'Pregnancy', icon: '🤰', specialization: 'Gynaecologist' },
              { symptom: 'Skin / Hair', icon: '🧴', specialization: 'Dermatologist' },
              { symptom: 'Heart / BP', icon: '❤️', specialization: 'Cardiologist' },
              { symptom: 'Bone / Joint', icon: '🦴', specialization: 'Orthopedic' },
              { symptom: 'Child Health', icon: '👶', specialization: 'Pediatrician' },
              { symptom: 'Dental', icon: '🦷', specialization: 'Dentist' },
              { symptom: 'Eye / Vision', icon: '👁️', specialization: 'Ophthalmologist' },
              { symptom: 'Mental Health', icon: '🧠', specialization: 'Psychiatrist' },
              { symptom: 'Ear / Nose', icon: '👂', specialization: 'ENT Specialist' },
              { symptom: 'Stomach', icon: '🤢', specialization: 'Gastroenterologist' },
              { symptom: 'Lungs', icon: '🫁', specialization: 'Pulmonologist' },
              { symptom: 'Kidney / Urine', icon: '💧', specialization: 'Urologist' },
              { symptom: 'Diabetes', icon: '💉', specialization: 'Endocrinologist' },
              { symptom: 'Cancer', icon: '🎗️', specialization: 'Oncologist' },
              { symptom: 'Kidney Disease', icon: '🫘', specialization: 'Nephrologist' },
              { symptom: 'Arthritis', icon: '🖐️', specialization: 'Rheumatologist' },
              { symptom: 'Surgery', icon: '🔪', specialization: 'Surgeon' },
              { symptom: 'Physiotherapy', icon: '🏃', specialization: 'Physiotherapist' },
              { symptom: 'Sexual Health', icon: '🔒', specialization: 'Sexologist' },
              { symptom: 'Homeopathy', icon: '🌿', specialization: 'Homeopathy' },
              { symptom: 'Ayurveda', icon: '🍃', specialization: 'Ayurveda' },
              { symptom: 'Diet / Nutrition', icon: '🥗', specialization: 'Dietitian' },
            ].map((item, idx) => (
              <Link
                key={idx}
                to={`/doctors?specialization=${encodeURIComponent(item.specialization)}`}
                className="bg-gray-50 p-3 rounded-xl hover:shadow-md transition-all text-center border border-gray-100 hover:border-primary-200 hover:bg-primary-50"
              >
                <div className="text-3xl mb-1">{item.icon}</div>
                <p className="text-xs font-medium text-gray-700 leading-tight">{item.symptom}</p>
              </Link>
            ))}
          </div>

          {/* See all link */}
          <div className="text-center mt-5">
            <Link
              to="/doctors"
              className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 text-primary-700 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary-100 transition-colors"
            >
              🔍 Browse All Specializations →
            </Link>
          </div>
        </div>
      </section>

      {/* ---- How It Works ---- */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">How ProMedicoz Works</h2>
          <p className="text-center text-gray-500 mb-10 text-sm">Book a consultation in 4 simple steps</p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { step: 1, icon: '👤', title: 'Create Account', desc: 'Sign up free in seconds.', to: '/register', cta: 'Register →' },
              { step: 2, icon: '🔍', title: 'Find a Doctor', desc: 'Browse by specialization or fee.', to: '/doctors', cta: 'Browse →' },
              { step: 3, icon: '📅', title: 'Book a Slot', desc: 'Pick date, time & consultation type.', to: '/doctors', cta: 'Book Now →' },
              { step: 4, icon: '✅', title: 'Get Confirmed', desc: 'Doctor confirms, you get notified.', to: '/dashboard', cta: 'Dashboard →' },
            ].map(({ step, icon, title, desc, to, cta }) => (
              <Link key={step} to={to} className="group text-center p-5 rounded-xl border-2 border-gray-100 bg-white hover:border-primary-300 hover:shadow-md transition-all">
                <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold mx-auto mb-3 group-hover:bg-primary-600 group-hover:text-white transition-colors text-sm">
                  {step}
                </div>
                <div className="text-3xl mb-2">{icon}</div>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">{title}</h3>
                <p className="text-gray-500 text-xs mb-2">{desc}</p>
                <span className="text-primary-600 text-xs font-medium group-hover:underline">{cta}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Testimonials ---- */}
      <section className="py-10 bg-white overflow-hidden">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-1">What Our Patients Say</h2>
          <p className="text-center text-gray-500 mb-6 text-sm">Real reviews from real patients</p>
        </div>
        {topReviews.length > 0 ? (
          <div className="relative">
            <div className="flex animate-scroll gap-6 px-4">
              {[...topReviews, ...topReviews].map((review, idx) => (
                <div key={idx} className="min-w-[280px] max-w-[280px] bg-gray-50 border border-gray-100 rounded-xl p-4 flex-shrink-0">
                  <div className="text-yellow-400 text-sm mb-2">{'⭐'.repeat(review.rating)}</div>
                  <p className="text-gray-700 text-sm line-clamp-3">"{review.comment}"</p>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-800">{review.patient?.name}</span>
                    <span className="text-xs text-gray-400">Dr. {review.doctor?.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {[
                { stars: 5, text: 'Very easy to book an appointment. The doctor was on time and professional.', name: 'Priya S.' },
                { stars: 5, text: 'Great platform! Found a specialist within minutes and got confirmed quickly.', name: 'Rahul M.' },
                { stars: 4, text: 'Convenient and simple. No more waiting on phone calls to book a doctor.', name: 'Anita K.' },
              ].map((item, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <div className="text-yellow-400 text-sm mb-2">{'⭐'.repeat(item.stars)}</div>
                  <p className="text-gray-700 text-sm italic">"{item.text}"</p>
                  <p className="text-xs font-medium text-gray-500 mt-2">— {item.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ---- CTA ---- */}
      <section className="py-12 bg-primary-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-3">Are You a Doctor?</h2>
          <p className="text-primary-100 mb-6 max-w-xl mx-auto">
            Join ProMedicoz to reach more patients, manage your schedule, and grow your practice effortlessly.
          </p>
          {!isAuthenticated && (
            <Link to="/register" className="bg-white text-primary-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block">
              Register Now
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

export default Home;
