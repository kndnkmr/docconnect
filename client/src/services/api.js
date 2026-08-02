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
  baseURL: '/api',
  // ^ Base URL prepended to all requests
  // So API.get('/doctors') actually calls /api/doctors
  // The Vite proxy then forwards this to http://localhost:5000/api/doctors

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

export default API;
