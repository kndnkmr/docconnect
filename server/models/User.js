// ============================================
// User Model - The shape of user data in our database
// ============================================
// This file defines WHAT a user looks like in MongoDB.
// Both doctors and patients are "users" — they just have different roles.
// 
// WHY one model for both? It's simpler. A user logs in the same way
// whether they're a doctor or patient. The "role" field tells us which they are.

const mongoose = require('mongoose');
// Mongoose = a library that makes working with MongoDB easier.
// It lets us define schemas (rules for our data) and provides
// helpful methods for saving, finding, updating, and deleting data.

const bcrypt = require('bcryptjs');
// bcrypt = a library for hashing passwords.
// Hashing = turning "mypassword123" into "$2a$10$xKd8f..." (unreadable)
// Even if a hacker steals the database, they can't reverse the hash.

// ---- Define the Schema ----
// A schema is like a blueprint. It says:
// "Every user MUST have these fields, with these types and rules"

const userSchema = new mongoose.Schema({
  
  // --- Basic Info ---
  name: {
    type: String,          // The data type (text)
    required: [true, 'Name is required'],  // Can't be empty. Error message if missing.
    trim: true             // Removes extra spaces ("  John  " becomes "John")
  },

  email: {
    type: String,
    unique: true,          // No two users can have the same email
    sparse: true,          // Allows multiple users with no email (sparse index)
    lowercase: true,       // Converts "John@Gmail.COM" to "john@gmail.com"
    trim: true,
    default: undefined
    // Email is optional for patients — they can register with just a phone.
    // IMPORTANT: default MUST be `undefined`, not `''`. A sparse unique index
    // only exempts documents where the field is ABSENT — an empty string is a
    // real value, so with default '' the FIRST phone-only patient saves fine
    // but EVERY later one collides on the duplicate '' and registration 500s.
    // Same sparse-index rule as patientId/verificationToken elsewhere here.
  },

  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
    // We'll hash this before saving — never stored as plain text!
  },

  // --- Role ---
  // This is how we know if someone is a doctor or patient
  role: {
    type: String,
    enum: ['doctor', 'patient', 'admin'],
    // enum = "only these values are allowed". Anything else gets rejected.
    required: [true, 'Role is required']
  },

  // --- Profile Photo ---
  profilePhoto: {
    type: String,          // Will store the file path/URL of the photo
    default: ''            // Empty by default (no photo uploaded yet)
  },

  // --- Phone Number ---
  phone: {
    type: String,
    default: ''
    // Contact number for calls/SMS. Added during registration or profile edit.
    // e.g., "+919599150825"
  },

  // --- WhatsApp Number (Doctor-specific) ---
  whatsappNumber: {
    type: String,
    default: ''
    // Doctors can set their WhatsApp number so patients can reach them directly
    // Shown on the doctor's public profile page
  },

  // --- UPI ID (Doctor-specific, for receiving payments) ---
  upiId: {
    type: String,
    default: ''
    // Doctor's UPI ID where patients pay consultation fees
    // e.g., "Dr.poojasingh410@okicici"
  },

  // --- UPI QR Code (Doctor uploads payment QR image) ---
  upiQrCode: {
    type: String,
    default: ''
    // Path to uploaded QR code image
    // Patients scan this to pay
  },

  // --- Doctor-specific fields ---
  // These only matter if role === 'doctor', but we keep them here for simplicity
  specialization: {
    type: String,
    default: ''
    // e.g., "Cardiologist", "Dermatologist", "General Physician"
  },

  experience: {
    type: Number,          // Years of experience
    default: 0,
    min: [0, 'Experience cannot be negative'],
    max: [70, 'Experience seems unrealistically high — please double check']
  },

  qualification: {
    type: String,
    default: ''
    // e.g., "MBBS, MD - Cardiology"
  },

  medicalRegistrationNo: {
    type: String,
    default: ''
    // NMC or State Medical Council registration number
  },

  clinicAddress: {
    type: String,
    default: ''
  },

  city: {
    type: String,
    default: ''
    // e.g., "Delhi", "Mumbai", "Rishikesh"
  },

  googleMapsLink: {
    type: String,
    default: ''
    // Doctor pastes their Google Maps location URL
  },

  consultationModes: {
    type: [String],
    enum: ['in-person', 'video', 'phone'],
    default: ['in-person']
    // What consultation types this doctor offers
  },

  // --- Languages the doctor can CONSULT in (doctor-specific) ---
  // Free-form list of language names (e.g. ["Hindi", "English", "Bengali"]).
  // Shown on the doctor's card/profile ("Speaks: ...") and patients can
  // filter doctors by language. This is a spoken-language attribute the
  // doctor picks themselves — NOT a translation of anything they type.
  // Deliberately not an enum: the master list lives in the frontend so new
  // languages can be added without a schema/migration change, and we don't
  // want to reject a language a doctor legitimately speaks.
  languagesSpoken: {
    type: [String],
    default: []
  },

  consultationFee: {
    type: Number,          // Fee in your currency
    default: 0,
    min: [0, 'Consultation fee cannot be negative'],
    max: [100000, 'Consultation fee seems unrealistically high — please double check']
  },

  bio: {
    type: String,
    default: ''
    // A short description about the doctor
  },

  // --- Doctor Availability Schedule ---
  // An array of objects — one per day the doctor is available.
  // Example:
  // [
  //   { day: 'Monday', startTime: '09:00', endTime: '12:00' },
  //   { day: 'Monday', startTime: '14:00', endTime: '17:00' },
  //   { day: 'Wednesday', startTime: '10:00', endTime: '15:00' }
  // ]
  // A doctor can have MULTIPLE entries per day (morning + afternoon sessions)
  availability: {
    type: [{
      day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        required: true
      },
      startTime: {
        type: String,  // Format: "09:00" (24-hour)
        required: true
      },
      endTime: {
        type: String,  // Format: "17:00" (24-hour)
        required: true
      }
    }],
    default: []
    // Empty by default — doctor must set their schedule
  },

  // Slot duration in minutes (how long each appointment lasts)
  slotDuration: {
    type: Number,
    default: 30,
    // Default 30 minutes per appointment
    // Doctor can change this to 15, 45, 60, etc.
    min: [5, 'Slot duration must be at least 5 minutes'],
    max: [180, 'Slot duration cannot exceed 3 hours']
  },

  // --- Family Members ---
  // Patients can add family members and book appointments on their behalf.
  // Each family member is an embedded subdocument (stored within the user document).
  familyMembers: {
    type: [{
      name: {
        type: String,
        required: [true, 'Family member name is required'],
        trim: true
      },
      relationship: {
        type: String,
        enum: ['spouse', 'child', 'parent', 'sibling', 'other'],
        required: [true, 'Relationship is required']
      },
      age: {
        type: Number,
        default: null
      },
      gender: {
        type: String,
        enum: ['male', 'female', 'other'],
        default: 'other'
      },
      phone: {
        type: String,
        default: ''
      }
    }],
    default: []
  },

  // --- Patient Medical Information (patients only) ---
  // Set once by the patient in Account Settings, reused for every
  // appointment they book — shown to the doctor on the appointment card so
  // they don't have to ask each time. Free-text fields (not structured
  // lists) to keep this simple, matching how doctor profile fields like
  // `bio`/`clinicAddress` already work in this schema.
  bloodGroup: {
    type: String,
    enum: ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    default: ''
  },

  allergies: {
    type: String,
    default: ''
    // e.g., "Penicillin, Peanuts" — free text, patient's own words
  },

  currentMedications: {
    type: String,
    default: ''
  },

  medicalHistory: {
    type: String,
    default: ''
    // e.g., "Type 2 diabetes, hypertension"
  },

  emergencyContactName: {
    type: String,
    default: ''
  },

  emergencyContactPhone: {
    type: String,
    default: ''
  },

  // --- Insurance (patients only, optional) ---
  insuranceProvider: {
    type: String,
    default: ''
    // e.g., "Star Health", "HDFC Ergo"
  },

  insurancePolicyNumber: {
    type: String,
    default: ''
  },

  // --- Patient ID ---
  // A short, human-readable identifier for patients (e.g. "PT000123") -
  // separate from the MongoDB ObjectId, which isn't practical to read over
  // the phone or search by. Assigned once at registration (see
  // authController.register) and never changes. null/absent for doctors
  // and admins - "sparse" lets many documents share that same null value
  // without violating the unique constraint.
  patientId: {
    type: String,
    unique: true,
    sparse: true,
    // IMPORTANT: default must be `undefined`, not `null`. A sparse index
    // only exempts documents where the field is completely ABSENT — an
    // explicit `null` still counts as a value, so every doctor/admin (and
    // every patient before this migration runs) would collide on the same
    // "null" and violate the unique constraint. Same reasoning as
    // verificationToken/resetPasswordToken below.
    default: undefined
  },

  // --- Soft Delete ---
  isDeleted: {
    type: Boolean,
    default: false
  },

  deletedAt: {
    type: Date,
    default: null
  },

  // --- Admin Verification (trust badge) ---
  // Set by an admin after manually confirming a doctor's credentials
  // (medical registration number, qualifications, etc.). Defaults to false for
  // everyone — the badge only appears for doctors an admin has actually checked.
  isAdminVerified: {
    type: Boolean,
    default: false
  },

  adminVerifiedAt: {
    type: Date,
    default: null
  },

  // --- Admin Suspension (Deactivate) ---
  // Set by an admin to hide a doctor from patients and block their login,
  // while keeping all their records intact (for legal/audit purposes).
  isSuspended: {
    type: Boolean,
    default: false
  },

  suspendedAt: {
    type: Date,
    default: null
  },

  suspendedReason: {
    type: String,
    default: ''
  },

  // --- Last Login Info (for security/audit) ---
  lastLoginAt: {
    type: Date,
    default: null
  },

  lastLoginIP: {
    type: String,
    default: ''
  },

  consentAcceptedAt: {
    type: Date,
    default: null
    // When user first agreed to T&C (stored during registration)
  },

  // --- Email Verification ---
  isVerified: {
    type: Boolean,
    default: true
    // Default true so existing doctors (before this feature) remain visible
    // New doctor registrations explicitly set this to false until they verify
  },

  // --- Blocked Patients (Doctor/Admin can block abusive patients) ---
  blockedPatients: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: []
  },

  // --- Web Push Subscriptions ---
  // A user can have multiple subscriptions (one per browser/device they've
  // enabled notifications on). Each one is what the browser's Push API gives
  // us when the user grants permission — we use it to send them a
  // notification (appointment confirmed, new message, incoming call) even
  // when the app isn't open. No email or phone number needed, so this works
  // for phone-only patients too.
  pushSubscriptions: {
    type: [{
      endpoint: { type: String, required: true },
      keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true }
      },
      createdAt: { type: Date, default: Date.now }
    }],
    default: []
  },

  verificationToken: {
    type: String,
    default: undefined
  },

  verificationTokenExpire: {
    type: Date,
    default: undefined
  },

  // --- Password Reset Fields ---
  // These are used ONLY during the "forgot password" flow.
  // They're empty most of the time — only filled when a reset is requested.
  resetPasswordToken: {
    type: String,
    default: undefined
    // A random token (hashed) that proves the user requested a reset
    // We hash it before storing (same idea as passwords — don't store secrets in plain text)
  },

  resetPasswordExpire: {
    type: Date,
    default: undefined
    // When the reset token expires (usually 10-30 minutes)
    // After this time, the token is invalid and user must request again
  },

  // --- Timestamps ---
  // Mongoose adds "createdAt" and "updatedAt" automatically with the option below

}, {
  timestamps: true
  // This automatically adds:
  // createdAt: when the user first registered
  // updatedAt: when their profile was last modified
});

// ---- Password Hashing (runs BEFORE saving to database) ----
// "pre" = "before". This runs before every .save() call.
// It ensures we NEVER store plain text passwords.

userSchema.pre('save', async function(next) {
  // Only hash the password if it was changed (or is new)
  // Without this check, the password would get re-hashed every time we update the user
  if (!this.isModified('password')) {
    return next(); // Skip hashing, move to the next step
  }

  // Generate a "salt" — random data mixed into the hash for extra security
  // The number 10 = "salt rounds" (higher = more secure but slower)
  const salt = await bcrypt.genSalt(10);

  // Hash the password with the salt
  this.password = await bcrypt.hash(this.password, salt);

  next(); // Done, proceed with saving
});

// ---- Custom Method: Compare Passwords ----
// We'll use this during LOGIN to check if the typed password matches the stored hash

userSchema.methods.comparePassword = async function(candidatePassword) {
  // bcrypt.compare handles the complex math of checking a plain password against a hash
  return await bcrypt.compare(candidatePassword, this.password);
};

// ---- Create and Export the Model ----
// mongoose.model('User', userSchema) creates a "User" collection in MongoDB
// A collection is like a table in a spreadsheet — it holds all user documents

const User = mongoose.model('User', userSchema);

module.exports = User;
// "module.exports" makes this available to other files when they do:
// const User = require('./models/User');
