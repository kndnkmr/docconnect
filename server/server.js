// ============================================
// DocConnect - Main Server File
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

// ---- STEP 4: Set up middleware ----
// Middleware = functions that run on EVERY request before reaching routes

app.use(cors());
// Allow requests from our frontend (different port/domain)

app.use(express.json());
// Parse JSON request bodies (so we can read data sent from the frontend)

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

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully!');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message);
    console.error('Make sure MongoDB is running on your machine.');
    // The server will still start, but database operations will fail
    // This is intentional — you can still test non-database routes
  });

// ---- STEP 6: Define routes ----

// Home route — quick check that the server is alive
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to DocConnect API!',
    status: 'Server is running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth (register, login, profile)',
      doctors: '/api/doctors (browse, view, update profiles)',
      appointments: '/api/appointments (book, view, manage)',
      thesis: '/api/thesis (publications, share links)',
      availability: '/api/availability (doctor schedule, free slots)',
      health: '/api/health'
    }
  });
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
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

// Thesis routes — publish, browse, share research papers
// Any request starting with /api/thesis → use the thesis router
const thesisRoutes = require('./routes/thesis');
app.use('/api/thesis', thesisRoutes);

// Availability routes — doctor schedule management, free slot lookup
// Any request starting with /api/availability → use the availability router
const availabilityRoutes = require('./routes/availability');
app.use('/api/availability', availabilityRoutes);

// ---- STEP 7: Handle 404 (route not found) ----
// If none of the routes above matched, this catches it
// Must be AFTER all other routes!
app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    hint: 'Check the URL and HTTP method. Available routes: /api/auth, /api/doctors, /api/appointments, /api/thesis, /api/availability, /api/health'
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

// ---- STEP 9: Start the server ----
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
  ==========================================
  DocConnect Server is running!
  ==========================================
  URL:          http://localhost:${PORT}
  Health Check: http://localhost:${PORT}/api/health
  Auth API:     http://localhost:${PORT}/api/auth
  Doctors API:  http://localhost:${PORT}/api/doctors
  Booking API:  http://localhost:${PORT}/api/appointments
  Thesis API:   http://localhost:${PORT}/api/thesis
  ==========================================
  Environment: ${process.env.NODE_ENV || 'development'}
  ==========================================
  `);
});
