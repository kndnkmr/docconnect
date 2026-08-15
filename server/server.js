// ============================================
// ProMedicoz - Main Server File
// ============================================
// This file is the ENTRY POINT of our backend.
// When you run "node server.js", this is what executes.
// It sets up our web server, connects to the database, and loads all routes.
//
// WHAT HAPPENS WHEN THE SERVER STARTS:
// 1. Load libraries and configuration
// 2. Connect to MongoDB database
// 3. Set up middleware (security checks that run on every request)
// 4. Load routes (URL endpoints)
// 5. Start listening for requests

// ---- STEP 1: Import libraries ----
const express = require('express');
const mongoose = require('mongoose');
// Mongoose = a library for connecting to and interacting with MongoDB.
// MongoDB is a "NoSQL" database — it stores data as flexible JSON-like documents
// instead of rigid tables (like MySQL/PostgreSQL).

const path = require('path');
// path = built-in Node.js module for working with file/directory paths
// We'll use it to serve uploaded files (profile photos)

const cors = require('cors');
const dotenv = require('dotenv');

// ---- STEP 2: Load environment variables ----
// This reads the .env file and makes its values available via process.env
dotenv.config();

// ---- STEP 3: Create the Express app ----
const app = express();

// Trust proxy (needed for rate limiting behind Render's proxy)
app.set('trust proxy', 1);

// ---- STEP 4: Set up middleware ----
// Middleware = functions that run on EVERY request before reaching routes

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  // In production: only allow requests from your Vercel frontend URL
  // In development: allow everything ('*')
  credentials: true
}));
// Allow requests from our frontend (different port/domain)

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve uploaded files as static assets
// This means: if someone requests /uploads/photo.jpg,
// Express will look in the "uploads" folder and send that file back
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// __dirname = the folder where THIS file (server.js) lives
// path.join() safely combines folder paths (handles / vs \ on different OS)

// ---- STEP 5: Connect to MongoDB ----
// mongoose.connect() establishes a connection to our database.
// It's async — we use .then() and .catch() to handle success/failure.
//
// The connection string comes from our .env file:
// MONGODB_URI=mongodb://localhost:27017/docconnect
//
// "docconnect" at the end is the database NAME. MongoDB creates it automatically.

// Only connect to the database when this file is run directly (node server.js),
// not when it's imported by the test suite (which tests the app without a DB).
if (require.main === module) {
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully!');
    // Promote the configured admin email to admin role (one-time bootstrap).
    // Set ADMIN_EMAIL in environment variables. Safe to run on every startup:
    // it only promotes an existing user, and only if not already an admin.
    ensureAdmin();
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message);
    console.error('Make sure MongoDB is running on your machine.');
    // The server will still start, but database operations will fail
    // This is intentional — you can still test non-database routes
  });
}

// ---- Admin bootstrap ----
// Ensures a dedicated admin account exists on startup, using env variables:
//   ADMIN_EMAIL     (required) - the admin login email
//   ADMIN_PASSWORD  (optional) - password used ONLY when creating a new admin
//   ADMIN_NAME      (optional) - display name for a newly created admin
//
// Behaviour:
//   - If a user with ADMIN_EMAIL already exists → promote to admin (if not already).
//   - If no such user exists AND ADMIN_PASSWORD is set → create a fresh admin account.
//   - This removes the need to edit the database manually. It is an admin-only
//     account: admins are never listed publicly (only doctors are), so it stays hidden.
// Safe to run on every startup (idempotent).
async function ensureAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return; // Nothing configured, skip silently

    const User = require('./models/User');
    const normalizedEmail = adminEmail.trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail });

    if (existing) {
      if (existing.role === 'admin') {
        console.log(`[admin-bootstrap] ${normalizedEmail} is already an admin.`);
        return;
      }
      existing.role = 'admin';
      await existing.save({ validateModifiedOnly: true });
      console.log(`[admin-bootstrap] Promoted existing account ${normalizedEmail} to admin.`);
      return;
    }

    // No account exists yet — create one if a password was provided.
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.log(`[admin-bootstrap] No account found for ${normalizedEmail} and ADMIN_PASSWORD is not set. Set ADMIN_PASSWORD to auto-create the admin account.`);
      return;
    }

    await User.create({
      name: process.env.ADMIN_NAME || 'Administrator',
      email: normalizedEmail,
      password: adminPassword, // hashed automatically by the User model pre-save hook
      role: 'admin',
      isVerified: true
    });
    console.log(`[admin-bootstrap] Created new admin account for ${normalizedEmail}.`);
  } catch (error) {
    console.error('[admin-bootstrap] Error while ensuring admin:', error.message);
  }
}

// ---- STEP 6: Define routes ----

// Home route — quick check that the server is alive
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to ProMedicoz API!',
    status: 'Server is running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth (register, login, profile)',
      doctors: '/api/doctors (browse, view, update profiles)',
      appointments: '/api/appointments (book, view, manage)',
      availability: '/api/availability (doctor schedule, free slots)',
      health: '/api/health'
    }
  });
});

// Health check route
app.get('/api/health', (req, res) => {
  const cloudinaryConfigured = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    cloudinary: cloudinaryConfigured ? 'configured' : 'not configured'
  });
});

// Auth routes — register, login, get profile
// This says: "Any request starting with /api/auth → use the auth router"
// So POST /api/auth/register → goes to auth.js router → calls register controller
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Doctor routes — browse doctors, view profiles, update profile
// Any request starting with /api/doctors → use the doctor router
const doctorRoutes = require('./routes/doctor');
app.use('/api/doctors', doctorRoutes);

// Appointment routes — book, view, manage appointments
// Any request starting with /api/appointments → use the appointment router
const appointmentRoutes = require('./routes/appointment');
app.use('/api/appointments', appointmentRoutes);

// Availability routes — doctor schedule management, free slot lookup
// Any request starting with /api/availability → use the availability router
const availabilityRoutes = require('./routes/availability');
app.use('/api/availability', availabilityRoutes);

// Admin routes — admin panel (users, appointments, stats)
// Any request starting with /api/admin → use the admin router
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Complaint routes — patient complaints and feedback
// Any request starting with /api/complaints → use the complaint router
const complaintRoutes = require('./routes/complaint');
app.use('/api/complaints', complaintRoutes);

// Review routes — patient rates doctors after consultation
const reviewRoutes = require('./routes/review');
app.use('/api/reviews', reviewRoutes);

// Prescription routes — doctor writes prescriptions for patients
const prescriptionRoutes = require('./routes/prescription');
app.use('/api/prescriptions', prescriptionRoutes);

// Medical report routes — patient uploads test reports for doctor
const reportRoutes = require('./routes/report');
app.use('/api/reports', reportRoutes);

// Family member routes
const familyMemberRoutes = require('./routes/familyMember');
app.use('/api/family-members', familyMemberRoutes);

// Message routes — in-app chat between patient and doctor
const messageRoutes = require('./routes/message');
app.use('/api/messages', messageRoutes);

// Announcement routes — admin broadcast banners to doctors/patients
const announcementRoutes = require('./routes/announcement');
app.use('/api/announcements', announcementRoutes);

// ---- STEP 7: Handle 404 (route not found) ----
// If none of the routes above matched, this catches it
// Must be AFTER all other routes!
app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    hint: 'Check the URL and HTTP method. Available routes: /api/auth, /api/doctors, /api/appointments, /api/availability, /api/health'
  });
});

// ---- STEP 8: Global error handler ----
// If any route throws an error, this catches it instead of crashing the server
// The 4 parameters (err, req, res, next) tell Express "this is an error handler"
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({
    message: 'Something went wrong on the server',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
    // Only show error details in development, not in production (security)
  });
});

// ---- STEP 9: Attach Socket.io (real-time chat + call ringing) ----
// Socket.io needs a raw http.Server to attach to (not just the Express app),
// so we wrap "app" in one here. This does NOT change how "app" behaves for
// the test suite: supertest wraps "app" in its own temporary server and never
// touches the "server"/"io" variables below.
const http = require('http');
const server = http.createServer(app);
const { initSocket } = require('./socket');
const io = initSocket(server);
// Controllers reach the socket server via req.app.get('io') to push events
// (e.g. a new chat message, an incoming call) - see messageController.js and
// appointmentController.js. Polling stays as a fallback if this is unset
// (e.g. during tests, where the socket layer is never exercised).
app.set('io', io);

// ---- STEP 10: Start the server ----
// Only listen when run directly (node server.js), not when imported by tests.
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`
  ==========================================
  ProMedicoz Server is running!
  ==========================================
  URL:          http://localhost:${PORT}
  Health Check: http://localhost:${PORT}/api/health
  Auth API:     http://localhost:${PORT}/api/auth
  Doctors API:  http://localhost:${PORT}/api/doctors
  Booking API:  http://localhost:${PORT}/api/appointments
  Realtime:     Socket.io attached (chat + call ringing)
  ==========================================
  Environment: ${process.env.NODE_ENV || 'development'}
  ==========================================
  `);
  });
}

// Export the configured Express app so the test suite can exercise it
// without starting a live server or connecting to the database.
module.exports = app;
