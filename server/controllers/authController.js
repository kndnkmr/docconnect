// ============================================
// Auth Controller - Register & Login Logic
// ============================================
// This file contains the ACTUAL LOGIC for authentication.
// Routes point here. When someone hits /api/auth/register, this code runs.
//
// PATTERN: Route → Controller → Database
// The route defines the URL, the controller does the work.

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
// crypto = built-in Node.js module for generating random tokens and hashing
// We use it to create secure, unguessable reset tokens
const User = require('../models/User');
const { getNextSequence } = require('../models/Counter');
const { formatIndianPhone, isValidIndianPhone } = require('../utils/formatPhone');
const { sendEmail } = require('../utils/sendEmail');

// ---- Helper: Generate JWT Token ----
// We'll call this after successful register or login.
// It creates a token containing the user's ID, signed with our secret key.

const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    // ^ Payload: the data stored inside the token (just the user ID)
    // Anyone can DECODE a JWT and read this, so never put passwords in here!

    process.env.JWT_SECRET,
    // ^ Secret key: only our server knows this. Used to verify the token is real.

    { expiresIn: '30d' }
    // ^ The token expires after 30 days. User must login again after that.
    // Shorter = more secure (less time for stolen tokens to be misused)
    // Longer = more convenient (user doesn't have to login often)
  );
};

// ============================================
// REGISTER - Create a new account
// ============================================
// Endpoint: POST /api/auth/register
// Body: { name, email, password, role }

const register = async (req, res) => {
  try {
    // Step 1: Extract data from the request body
    const { name, email, password, role, phone } = req.body;

    // Step 2: Validate required fields
    // For patients: either email OR phone is required
    // For doctors: email is required (more professional)
    if (!name || !password || !role) {
      return res.status(400).json({
        message: 'Please provide name, password, and role'
      });
    }

    if (!email && !phone) {
      return res.status(400).json({
        message: 'Please provide either email or phone number'
      });
    }

    // Step 3: Check if a user with this email or phone already exists
    // Normalize BEFORE comparing — email is stored lowercased/trimmed (schema
    // default), but that transform only applies on save, not on a plain query
    // filter. Comparing raw input against a normalized stored value is the
    // same class of bug as the phone one just above/below: a case mismatch
    // (very common — many keyboards auto-capitalize the first letter) would
    // silently miss an existing account instead of catching the duplicate.
    const normalizedEmail = email ? email.toLowerCase().trim() : '';
    if (normalizedEmail) {
      const existingByEmail = await User.findOne({ email: normalizedEmail });
      if (existingByEmail) {
        if (existingByEmail.isDeleted) {
          // Disassociate email from deleted account (keep record for legal) and allow re-registration
          existingByEmail.email = `deleted_${Date.now()}_${existingByEmail.email}`;
          await existingByEmail.save({ validateModifiedOnly: true });
        } else {
          return res.status(400).json({
            message: 'An account with this email already exists'
          });
        }
      }
    }

    // Validate + format the phone BEFORE using it for the duplicate check below —
    // phone is always stored in formatted form ("+91XXXXXXXXXX"), so checking
    // against the raw input (e.g. "9997019900") would never match an existing
    // formatted record. That mismatch let TWO accounts end up sharing the same
    // real phone number (no unique index on phone, unlike email) whenever
    // someone re-registered after deleting - the old "deleted" duplicate never
    // got renamed out of the way, since the lookup silently found nothing.
    const formattedPhone = phone ? formatIndianPhone(phone) : '';
    if (phone && !isValidIndianPhone(phone)) {
      return res.status(400).json({
        message: 'Please enter a valid 10-digit Indian mobile number'
      });
    }

    if (formattedPhone) {
      const existingByPhone = await User.findOne({ phone: formattedPhone });
      if (existingByPhone) {
        if (existingByPhone.isDeleted) {
          // Disassociate phone from deleted account and allow re-registration
          existingByPhone.phone = `deleted_${Date.now()}_${existingByPhone.phone}`;
          await existingByPhone.save({ validateModifiedOnly: true });
        } else {
          return res.status(400).json({
            message: 'An account with this phone number already exists'
          });
        }
      }
    }

    // Step 4: Validate role
    if (!['doctor', 'patient', 'admin'].includes(role)) {
      return res.status(400).json({
        message: 'Role must be "doctor", "patient", or "admin"'
      });
    }

    // Step 5: Create the user in the database
    const user = await User.create({
      name,
      email,
      password,
      role,
      phone: formattedPhone,
      isVerified: role === 'patient',
      consentAcceptedAt: new Date(),
      lastLoginIP: req.headers['x-forwarded-for'] || req.ip || ''
    });

    // Step 5b: Assign a human-readable Patient ID (patients only) — lets a
    // doctor identify/search for a specific patient by something shorter
    // and more memorable than a MongoDB id.
    if (role === 'patient') {
      const seq = await getNextSequence('patientId');
      user.patientId = `PT${String(seq).padStart(6, '0')}`;
      await user.save({ validateBeforeSave: false });
    }

    // Step 6: If doctor, send verification email
    if (role === 'doctor' && email) {
      const verifyToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(verifyToken).digest('hex');

      user.verificationToken = hashedToken;
      user.verificationTokenExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      await user.save({ validateBeforeSave: false });

      const verifyUrl = `https://www.promedicoz.in/verify-email/${verifyToken}`;

      await sendEmail({
        to: email,
        subject: 'Verify Your ProMedicoz Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 20px;">🏥 ProMedicoz</h1>
            </div>
            <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
              <h2 style="color: #1f2937;">Verify Your Email</h2>
              <p style="color: #4b5563;">Hi Dr. ${name},</p>
              <p style="color: #4b5563;">Thank you for registering on ProMedicoz. Please verify your email to activate your account and appear in patient search results.</p>
              <a href="${verifyUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 12px;">
                Verify My Email
              </a>
              <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">📌 If this email landed in your <b>Spam/Junk</b> folder, please mark it <b>"Not spam"</b> first — the verify button may not work while it's flagged as spam.</p>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">This link expires in 24 hours. If you didn't register, ignore this email.</p>
            </div>
          </div>
        `
      });
    }

    // Step 7: Generate a token for the new user
    const token = generateToken(user._id);

    // Step 8: Send back the response
    res.status(201).json({
      message: role === 'doctor'
        ? 'Registration successful! Please check your email to verify your account.'
        : 'Registration successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        patientId: user.patientId
      }
    });

  } catch (error) {
    console.error('Register error:', error.message);

    // A schema validation failure (e.g. password too short) is the user's
    // input problem, not a server fault — surface it as a clear 400 with the
    // actual message instead of a scary generic "server error".
    if (error.name === 'ValidationError') {
      const firstMessage = Object.values(error.errors)[0]?.message || 'Please check the details you entered.';
      return res.status(400).json({ message: firstMessage });
    }

    // Duplicate key (email/phone already taken) — also a user-facing 400.
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const label = field === 'phone' ? 'phone number' : field === 'email' ? 'email' : 'account';
      return res.status(400).json({ message: `An account with this ${label} already exists.` });
    }

    res.status(500).json({
      message: 'Server error during registration. Please try again.'
    });
  }
};

// ============================================
// LOGIN - Verify credentials and return token
// ============================================
// Endpoint: POST /api/auth/login
// Body: { email, password }

const login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // Step 1: Validate input — need either email or phone + password
    if ((!email && !phone) || !password) {
      return res.status(400).json({
        message: 'Please provide email or phone number, and password'
      });
    }

    // Step 2: Find the user by email OR phone
    // Normalize email the same way it's stored (lowercase/trim) — otherwise
    // typing an email with different capitalization than it was registered
    // with (very common; many keyboards auto-capitalize) would silently fail
    // to find the account at all, showing a generic "Invalid email or
    // password" even though the password would've been correct.
    let user;
    if (email) {
      user = await User.findOne({ email: email.toLowerCase().trim() });
    } else if (phone) {
      // Format phone to match how it was stored during registration
      const formattedPhone = formatIndianPhone(phone);
      user = await User.findOne({ phone: formattedPhone });
      // Also try raw input in case formatting doesn't match
      if (!user) {
        user = await User.findOne({ phone });
      }
    }

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    // Block deleted accounts from logging in
    if (user.isDeleted) {
      return res.status(401).json({
        message: 'This account has been deleted. Contact support@promedicoz.in if you need assistance.'
      });
    }

    // Block suspended accounts from logging in
    if (user.isSuspended) {
      return res.status(401).json({
        message: 'This account has been suspended. Contact support@promedicoz.in if you believe this is a mistake.'
      });
    }

    // Step 3: Compare the provided password with the stored hash
    const isPasswordMatch = await user.comparePassword(password);
    // This calls the method we defined in User.js

    if (!isPasswordMatch) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
      // Same generic message — don't reveal which field was wrong
    }

    // Step 4: Password matches! Generate a token
    const token = generateToken(user._id);

    // Save login info for audit
    user.lastLoginAt = new Date();
    user.lastLoginIP = req.headers['x-forwarded-for'] || req.ip || '';
    await user.save({ validateModifiedOnly: true });

    // Step 5: Send back user data + token
    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePhoto: user.profilePhoto,
        isVerified: user.isVerified,
        patientId: user.patientId
      }
    });

  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({
      message: 'Server error during login. Please try again.'
    });
  }
};

// ============================================
// GET PROFILE - Fetch logged-in user's data
// ============================================
// Endpoint: GET /api/auth/me
// Requires: valid token (protected by auth middleware)

const getMe = async (req, res) => {
  try {
    // req.user was already set by the auth middleware (protect function)
    // It contains the full user object (minus password)
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
      // 404 = Not Found
    }

    res.json({
      user
    });

  } catch (error) {
    console.error('Get profile error:', error.message);
    res.status(500).json({
      message: 'Server error fetching profile'
    });
  }
};

// ============================================
// FORGOT PASSWORD - Request a reset link
// ============================================
// Endpoint: POST /api/auth/forgot-password
// Body: { email } OR { phone }
//
// HOW IT WORKS:
// 1. User provides their email OR phone (patients can register with phone only)
// 2. We generate a random token
// 3. Hash the token and store it in the database (with an expiry)
// 4. If the account has an email, we email the link. If not (phone-only
//    account, no SMS gateway configured), we can't deliver it automatically —
//    so we tell the user to reach out via WhatsApp, and an admin can look up
//    their account and relay a reset link manually (see adminController.js
//    generateResetLink). This avoids leaving phone-only patients with no way
//    to ever recover their account.
//
// WHY HASH THE TOKEN?
// Same reason we hash passwords. If someone steals the database,
// they can't use the stored hash to reset other people's passwords.
// The plain token is only sent to the user (via console/email).

const buildResetUrl = (resetToken) => `https://www.promedicoz.in/reset-password/${resetToken}`;

const sendResetEmail = async (user, resetUrl) => {
  try {
    await sendEmail({
      to: user.email,
      subject: 'Reset Your ProMedicoz Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">🏥 ProMedicoz</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937;">Reset Your Password</h2>
            <p style="color: #4b5563;">We received a request to reset your ProMedicoz password. Click the button below to set a new one.</p>
            <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 12px;">
              Reset My Password
            </a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">This link expires in 30 minutes. If you didn't request this, you can safely ignore this email — your password won't change.</p>
          </div>
        </div>
      `
    });
  } catch (mailErr) {
    console.error('Failed to send reset email:', mailErr.message);
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        message: 'Please provide your email address or phone number'
      });
    }

    // Find the user by email or phone (normalize email the same way it's
    // stored — see the same fix in login() for why this matters)
    let user;
    if (email) {
      user = await User.findOne({ email: email.toLowerCase().trim() });
    } else {
      const formattedPhone = formatIndianPhone(phone);
      user = await User.findOne({ phone: formattedPhone }) || await User.findOne({ phone });
    }

    const genericMessage = email
      ? 'If an account with that email exists, a password reset link has been emailed to you.'
      : 'If an account with that phone number exists, we\'ve sent you next steps.';

    if (!user) {
      // SECURITY: Don't reveal whether the account exists or not
      return res.json({ message: genericMessage });
    }

    // Generate a random token (32 bytes → 64 hex characters)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 minutes
    await user.save({ validateBeforeSave: false });

    const resetUrl = buildResetUrl(resetToken);

    if (user.email) {
      // Normal path: email the link.
      await sendResetEmail(user, resetUrl);
      console.log(`[password-reset] link for ${user.email}: ${resetUrl} (expires 30 min)`);
      return res.json({
        message: genericMessage,
        ...(process.env.NODE_ENV !== 'production' && { resetToken, resetUrl })
      });
    }

    // Phone-only account with no email on file — we have no automatic way to
    // deliver the link (no SMS gateway configured). Tell the patient how to
    // get help instead of leaving them stuck, and log it so an admin can
    // relay the link manually if the patient reaches out.
    console.log(`[password-reset] phone-only account (${user.phone}) requested reset. No email on file — link not auto-delivered: ${resetUrl} (expires 30 min)`);
    return res.json({
      message: 'This account has no email on file, so we can\'t send a reset link automatically. Please contact us on WhatsApp and we\'ll help you regain access.',
      noEmailOnFile: true,
      ...(process.env.NODE_ENV !== 'production' && { resetToken, resetUrl })
    });

  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({
      message: 'Error processing password reset request'
    });
  }
};

// ============================================
// RESET PASSWORD - Set a new password using token
// ============================================
// Endpoint: PUT /api/auth/reset-password/:token
// Body: { password }
//
// The :token in the URL is the UNHASHED token from the reset link.
// We hash it and compare with what's stored in the database.

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        message: 'Please provide a new password'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters'
      });
    }

    // Hash the token from the URL (to compare with the stored hashed version)
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with this token AND where the token hasn't expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
      // $gt = "greater than" → expiry must be in the future (not expired)
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired reset token. Please request a new reset link.'
      });
    }

    // Set the new password
    user.password = password;
    // The pre-save hook in User.js will hash this automatically!

    // Clear the reset token fields (one-time use)
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();
    // This triggers the password hashing pre-save hook

    // Generate a new login token (auto-login after reset)
    const loginToken = generateToken(user._id);

    res.json({
      message: 'Password reset successful! You are now logged in.',
      token: loginToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Reset password error:', error.message);
    res.status(500).json({
      message: 'Error resetting password'
    });
  }
};

// ============================================
// UPDATE MEDICAL INFO - Patient's own medical profile
// ============================================
// Endpoint: PUT /api/auth/medical-info
// Body: { bloodGroup, allergies, currentMedications, medicalHistory, emergencyContactName, emergencyContactPhone, insuranceProvider, insurancePolicyNumber }
// Patient-only — this is set once and reused for every appointment they
// book, so the doctor sees it on the appointment card without having to
// ask each time.

const updateMedicalInfo = async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ message: 'Only patients can update medical information' });
    }

    const { bloodGroup, allergies, currentMedications, medicalHistory, emergencyContactName, emergencyContactPhone, insuranceProvider, insurancePolicyNumber } = req.body;

    const updates = {};
    if (bloodGroup !== undefined) updates.bloodGroup = bloodGroup;
    if (allergies !== undefined) updates.allergies = allergies;
    if (currentMedications !== undefined) updates.currentMedications = currentMedications;
    if (medicalHistory !== undefined) updates.medicalHistory = medicalHistory;
    if (emergencyContactName !== undefined) updates.emergencyContactName = emergencyContactName;
    if (emergencyContactPhone !== undefined) {
      updates.emergencyContactPhone = emergencyContactPhone ? formatIndianPhone(emergencyContactPhone.trim()) : '';
    }
    if (insuranceProvider !== undefined) updates.insuranceProvider = insuranceProvider;
    if (insurancePolicyNumber !== undefined) updates.insurancePolicyNumber = insurancePolicyNumber;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Medical information updated',
      user
    });

  } catch (error) {
    console.error('Update medical info error:', error.message);
    res.status(500).json({ message: 'Error updating medical information' });
  }
};

// ============================================
// UPDATE ACCOUNT - Change email or phone
// ============================================
// Endpoint: PUT /api/auth/update-account
// Body: { email, phone }
// Requires: valid token (must be logged in)

const updateAccount = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        message: 'Please provide email or phone to update'
      });
    }

    // If changing email, check it's not already taken by another user.
    // Normalize both sides before comparing (stored emails are always
    // lowercase/trimmed) — same fix as register()/login() above, for the
    // same reason: a case mismatch would otherwise let this check silently
    // miss an existing account and let two accounts collide on one email.
    const normalizedNewEmail = email ? email.toLowerCase().trim() : '';
    if (normalizedNewEmail && normalizedNewEmail !== req.user.email) {
      const existingUser = await User.findOne({ email: normalizedNewEmail });
      if (existingUser) {
        return res.status(400).json({
          message: 'This email is already in use by another account'
        });
      }
    }

    // Build updates
    const updates = {};
    if (email) updates.email = email.toLowerCase().trim();
    if (phone) updates.phone = formatIndianPhone(phone.trim());

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Account updated successfully!',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Update account error:', error.message);
    res.status(500).json({ message: 'Error updating account' });
  }
};

// ============================================
// DELETE ACCOUNT - User deletes their own profile
// ============================================
// Endpoint: DELETE /api/auth/delete-account
// Requires: valid token (must be logged in)
// Also deletes their appointments

const deleteAccount = async (req, res) => {
  try {
    const user = req.user;

    // Don't allow admins to delete themselves
    if (user.role === 'admin') {
      return res.status(400).json({
        message: 'Admin accounts cannot be self-deleted. Use the database directly.'
      });
    }

    // Soft-delete: mark as deleted but keep data for 90 days (legal protection)
    await User.findByIdAndUpdate(user._id, {
      isDeleted: true,
      deletedAt: new Date()
    });

    res.json({
      message: 'Your account has been deleted successfully. Data will be retained for 90 days as per our privacy policy.'
    });

  } catch (error) {
    console.error('Delete account error:', error.message);
    res.status(500).json({ message: 'Error deleting account' });
  }
};

// ============================================
// VERIFY EMAIL - Doctor clicks link from email
// ============================================
// Endpoint: GET /api/auth/verify-email/:token

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Look up by token WITHOUT filtering on expiry yet, and don't clear the
    // token on success (see below) — this is what actually fixes the "says
    // expired" bug. Many email clients/security gateways (Outlook Safe
    // Links, corporate scanners, some spam filters) automatically pre-visit
    // links in an email to check them BEFORE the user ever clicks - if the
    // old code cleared the token on that first (automated) visit, the
    // doctor's real click a moment later would find no matching token at
    // all and show "expired", even though nothing had actually timed out.
    const user = await User.findOne({ verificationToken: hashedToken });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid verification link. Please register again or contact support.'
      });
    }

    // Already verified (by this same link, possibly visited more than once)
    // — this is the case above, made harmless: just confirm it, don't error.
    if (user.isVerified) {
      return res.json({
        message: 'Your email is already verified — you\'re all set!',
        verified: true
      });
    }

    if (!user.verificationTokenExpire || user.verificationTokenExpire < Date.now()) {
      return res.status(400).json({
        message: 'This verification link has expired. Please request a new one from the login page.'
      });
    }

    user.isVerified = true;
    await user.save({ validateBeforeSave: false });

    res.json({
      message: 'Email verified successfully! Your profile is now visible to patients.',
      verified: true
    });

  } catch (error) {
    console.error('Verify email error:', error.message);
    res.status(500).json({ message: 'Error verifying email' });
  }
};

// ============================================
// RESEND VERIFICATION - Doctor requests a new link
// ============================================
// Endpoint: POST /api/auth/resend-verification

const resendVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    if (!user.email) {
      return res.status(400).json({ message: 'No email address on file' });
    }

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verifyToken).digest('hex');

    user.verificationToken = hashedToken;
    user.verificationTokenExpire = Date.now() + 24 * 60 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const verifyUrl = `https://www.promedicoz.in/verify-email/${verifyToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Verify Your ProMedicoz Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">🏥 ProMedicoz</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937;">Verify Your Email</h2>
            <p style="color: #4b5563;">Hi Dr. ${user.name},</p>
            <p style="color: #4b5563;">Click below to verify your email and activate your account.</p>
            <a href="${verifyUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 12px;">
              Verify My Email
            </a>
            <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">📌 If this email landed in your <b>Spam/Junk</b> folder, please mark it <b>"Not spam"</b> first — the verify button may not work while it's flagged as spam.</p>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">This link expires in 24 hours.</p>
          </div>
        </div>
      `
    });

    res.json({ message: 'Verification email sent! Check your inbox.' });

  } catch (error) {
    console.error('Resend verification error:', error.message);
    res.status(500).json({ message: 'Error sending verification email' });
  }
};

// ---- Export all controller functions ----
module.exports = { register, login, getMe, forgotPassword, resetPassword, updateAccount, updateMedicalInfo, deleteAccount, verifyEmail, resendVerification };
