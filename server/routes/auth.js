// ============================================
// Auth Routes - URL endpoints for authentication
// ============================================
// This file defines WHICH URLs trigger WHICH controller functions.
// It's the "table of contents" for our auth API.
//
// PATTERN:
//   router.METHOD(PATH, ...MIDDLEWARE, CONTROLLER)
//
// METHOD = get, post, put, delete (HTTP verbs)
// PATH = the URL after /api/auth
// MIDDLEWARE = optional checks that run before the controller (like auth)
// CONTROLLER = the function that handles the request

const express = require('express');

const router = express.Router();

const rateLimit = require('express-rate-limit');

// Rate limiter for auth endpoints — prevents brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 requests per window per IP
  message: { message: 'Too many attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter limiter for password reset (prevent email spam)
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // max 3 reset requests per hour
  message: { message: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Import our controller functions (the actual logic)
const { register, login, getMe, forgotPassword, resetPassword, updateAccount, deleteAccount, verifyEmail, resendVerification } = require('../controllers/authController');

// Import our auth middleware (the security guard)
const { protect } = require('../middleware/auth');

// ---- Define Routes ----

// POST /api/auth/register
// Anyone can access this (no middleware needed)
// Sends: { name, email, password, role }
// Returns: { message, token, user }
router.post('/register', authLimiter, register);

router.post('/login', authLimiter, login);

// GET /api/auth/me
// PROTECTED - only logged-in users can access this
// The "protect" middleware runs first → checks for valid token
// If token is valid → getMe runs and returns the user's profile
// If token is invalid → protect sends back a 401 error (never reaches getMe)
router.get('/me', protect, getMe);

// POST /api/auth/forgot-password
// Anyone can request a password reset (no login needed — they forgot their password!)
// Sends: { email }
// Returns: success message + logs reset link to server console
router.post('/forgot-password', resetLimiter, forgotPassword);

// GET /api/auth/verify-email/:token
// Public — anyone with the link can verify (token proves ownership)
router.get('/verify-email/:token', verifyEmail);

// POST /api/auth/resend-verification
// Protected — logged-in unverified doctors can request a new link
router.post('/resend-verification', protect, resendVerification);

// PUT /api/auth/reset-password/:token
// Anyone with a valid reset token can set a new password
// The :token comes from the reset link (logged to console / emailed)
// Sends: { password }
// Returns: { message, token, user } (auto-login after reset)
router.put('/reset-password/:token', resetPassword);

// PUT /api/auth/update-account
// Logged-in user can change their email or phone number
router.put('/update-account', protect, updateAccount);

// DELETE /api/auth/delete-account
// Logged-in user can delete their own account
router.delete('/delete-account', protect, deleteAccount);

// ---- Export the router ----
// We'll import this in server.js and tell Express:
// "Any request starting with /api/auth should use this router"
module.exports = router;

// ============================================
// HOW THIS ALL CONNECTS (the full flow):
// ============================================
//
// 1. User sends POST request to http://localhost:5000/api/auth/register
//    with body: { name: "Dr. Smith", email: "dr@email.com", password: "123456", role: "doctor" }
//
// 2. Express sees the URL starts with /api/auth → uses this router
//
// 3. Router matches POST /register → calls the "register" controller
//
// 4. Controller validates data → creates user in database → returns token
//
// 5. User receives: { message: "Registration successful!", token: "eyJ...", user: {...} }
//
// 6. Frontend stores the token → sends it with future requests
//
// 7. For protected routes, the "protect" middleware checks the token first
// ============================================
