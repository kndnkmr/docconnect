// ============================================
// API Service - All backend communication
// ============================================
// This file centralizes ALL API calls to the backend.
// Instead of writing axios.get('/api/doctors') in every component,
// we create clean functions: api.getDoctors()
//
// WHY centralize?
// 1. If the API URL changes, you update ONE file (not 20 components)
// 2. Error handling in one place
// 3. Cleaner components (they just call functions, not manage HTTP details)
//
// WHAT IS AXIOS?
// Axios is a library for making HTTP requests (like fetch, but nicer).
// Advantages over native fetch():
// - Automatically parses JSON responses
// - Better error handling (throws on 4xx/5xx status codes)
// - Request/response interceptors
// - Simpler syntax for sending data

import axios from 'axios';

// Create an axios instance with default config
// All requests will use this base configuration
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // ^ In production: uses the real backend URL from environment variable
  // In development: falls back to '/api' (Vite proxy forwards to localhost:5000)
  // VITE_API_URL is set in Vercel dashboard when deploying

  headers: {
    'Content-Type': 'application/json'
    // Tell the server: "I'm sending JSON data"
  }
});

// ---- Request Interceptor ----
// Runs BEFORE every request is sent
// Automatically attaches the auth token if available

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- Response Interceptor ----
// Runs AFTER every response is received
// Handles common errors globally

API.interceptors.response.use(
  (response) => response,
  // ^ If successful, just return the response as-is

  (error) => {
    // If the server returns 401 (unauthorized), the token might be expired
    if (error.response?.status === 401) {
      // Optional: auto-logout if token is invalid
      // localStorage.removeItem('token');
      // window.location.href = '/login';
    }
    return Promise.reject(error);
    // Re-throw so the calling component can handle specific errors
  }
);

// ============================================
// AUTH API calls
// ============================================

export const authAPI = {
  // Register a new user
  register: (data) => API.post('/auth/register', data),
  // data = { name, email, password, role }

  // Log in
  login: (data) => API.post('/auth/login', data),
  // data = { email, password }

  // Get current user's profile
  getMe: () => API.get('/auth/me'),

  // Request password reset
  forgotPassword: (data) => API.post('/auth/forgot-password', data),
  // data = { email }

  // Reset password with token
  resetPassword: (token, data) => API.put(`/auth/reset-password/${token}`, data),
  // data = { password }

  // Update email/phone
  updateAccount: (data) => API.put('/auth/update-account', data),
  // data = { email, phone }

  // Delete own account
  deleteAccount: () => API.delete('/auth/delete-account'),
};

// ============================================
// DOCTOR API calls
// ============================================

export const doctorAPI = {
  // Get all doctors (with optional filters)
  getAll: (params) => API.get('/doctors', { params }),
  // params = { specialization, name, page, limit }
  // axios automatically converts { page: 1 } to ?page=1 in the URL

  // Get single doctor by ID
  getById: (id) => API.get(`/doctors/${id}`),

  // Update own profile (for logged-in doctors)
  updateProfile: (data) => {
    // If data includes a file, we need to use FormData instead of JSON
    if (data instanceof FormData) {
      return API.put('/doctors/profile', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
        // Tell server: "This request contains files, not just JSON"
      });
    }
    return API.put('/doctors/profile', data);
  },
};

// ============================================
// APPOINTMENT API calls
// ============================================

export const appointmentAPI = {
  // Book a new appointment (patient only)
  book: (data) => API.post('/appointments', data),
  // data = { doctorId, date, timeSlot, reason, consultationType }

  // Get my appointments
  getMine: (params) => API.get('/appointments/my', { params }),
  // params = { status, page, limit }

  // Get single appointment
  getById: (id) => API.get(`/appointments/${id}`),

  // Update status (doctor only)
  updateStatus: (id, data) => API.put(`/appointments/${id}/status`, data),
  // data = { status, notes }

  // Cancel appointment (patient only)
  cancel: (id, data) => API.put(`/appointments/${id}/cancel`, data),
  // data = { cancellationReason }

  // Mark payment received (doctor only)
  markPayment: (id) => API.put(`/appointments/${id}/payment`, { paymentStatus: 'paid' }),
};

// ============================================
// AVAILABILITY API calls
// ============================================

export const availabilityAPI = {
  // Get my availability schedule (doctor only)
  getMine: () => API.get('/availability'),

  // Set/update my availability (doctor only)
  set: (data) => API.put('/availability', data),
  // data = { availability: [...], slotDuration: 30 }

  // Get free slots for a doctor on a specific date (public)
  getFreeSlots: (doctorId, date) => API.get(`/availability/${doctorId}/slots`, { params: { date } }),
  // date = "2024-03-15" (YYYY-MM-DD format)
};

// ============================================
// ADMIN API calls
// ============================================

export const adminAPI = {
  // Get dashboard stats
  getStats: () => API.get('/admin/stats'),

  // Get all users (with optional filters)
  getUsers: (params) => API.get('/admin/users', { params }),

  // Get all appointments (with optional filters)
  getAppointments: (params) => API.get('/admin/appointments', { params }),

  // Delete a user
  deleteUser: (id) => API.delete(`/admin/users/${id}`),

  // Get analytics (revenue, consultation types, top doctors)
  getAnalytics: () => API.get('/admin/analytics'),
};

// ============================================
// COMPLAINT API calls
// ============================================

export const complaintAPI = {
  // Patient files a complaint
  create: (data) => API.post('/complaints', data),
  // data = { subject, description, doctorId (optional), appointmentId (optional) }

  // Patient views their complaints
  getMine: () => API.get('/complaints/my'),

  // Admin views all complaints
  getAll: (params) => API.get('/complaints', { params }),
  // params = { status, page, limit }

  // Admin updates complaint status/response
  update: (id, data) => API.put(`/complaints/${id}`, data),
  // data = { status, response }
};

// ============================================
// PRESCRIPTION API calls
// ============================================

export const prescriptionAPI = {
  // Doctor creates prescription
  create: (data) => API.post('/prescriptions', data),
  // data = { appointmentId, diagnosis, medicines, testsRecommended, notes, followUpDate }

  // Get my prescriptions (both roles)
  getMine: () => API.get('/prescriptions/my'),

  // Get prescription for a specific appointment
  getByAppointment: (appointmentId) => API.get(`/prescriptions/appointment/${appointmentId}`),

  // Doctor updates prescription
  update: (id, data) => API.put(`/prescriptions/${id}`, data),
};

// ============================================
// MEDICAL REPORT API calls
// ============================================

export const reportAPI = {
  // Patient uploads a report (form-data with file)
  upload: (data) => API.post('/reports', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getMine: () => API.get('/reports/my'),
  review: (id, data) => API.put(`/reports/${id}/review`, data),
};

// ============================================
// REVIEW API calls
// ============================================

export const reviewAPI = {
  // Patient submits review
  create: (data) => API.post('/reviews', data),
  // data = { appointmentId, rating, comment }

  // Get reviews for a doctor (public)
  getDoctorReviews: (doctorId) => API.get(`/reviews/doctor/${doctorId}`),
};

export default API;
