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
    if (email) {
      const existingByEmail = await User.findOne({ email });
      if (existingByEmail) {
        return res.status(400).json({
          message: 'An account with this email already exists'
        });
      }
    }

    if (phone) {
      const existingByPhone = await User.findOne({ phone });
      if (existingByPhone) {
        return res.status(400).json({
          message: 'An account with this phone number already exists'
        });
      }
    }

    // Step 4: Validate role
    if (!['doctor', 'patient', 'admin'].includes(role)) {
      return res.status(400).json({
        message: 'Role must be "doctor", "patient", or "admin"'
      });
    }

    // Validate phone number if provided
    const formattedPhone = phone ? formatIndianPhone(phone) : '';
    if (phone && !isValidIndianPhone(phone)) {
      return res.status(400).json({
        message: 'Please enter a valid 10-digit Indian mobile number'
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
              <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">This link expires in 24 hours. If you didn't register, ignore this email.</p>
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
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    // Something unexpected went wrong (database error, etc.)
    console.error('Register error:', error.message);
    res.status(500).json({
      message: 'Server error during registration. Please try again.'
    });
    // 500 = Internal Server Error (something broke on our end)
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
    let user;
    if (email) {
      user = await User.findOne({ email });
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
      // 401 = Unauthorized
      // SECURITY TIP: We say "invalid email or password" instead of
      // "email not found" — this prevents attackers from knowing which emails exist
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
        isVerified: user.isVerified
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
// Body: { email }
//
// HOW IT WORKS:
// 1. User provides their email
// 2. We generate a random token
// 3. Hash the token and store it in the database (with an expiry)
// 4. Log the reset URL to the console (in production, you'd EMAIL this)
// 5. User clicks the link → goes to reset page with the token in the URL
//
// WHY HASH THE TOKEN?
// Same reason we hash passwords. If someone steals the database,
// they can't use the stored hash to reset other people's passwords.
// The plain token is only sent to the user (via console/email).

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Please provide your email address'
      });
    }

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      // SECURITY: Don't reveal whether the email exists or not
      // Always return the same response regardless
      return res.json({
        message: 'If an account with that email exists, a reset link has been generated. Check the server console.'
      });
    }

    // Generate a random token (32 bytes → 64 hex characters)
    const resetToken = crypto.randomBytes(32).toString('hex');
    // Example output: "a3f7b2c4d8e9f0a1b2c3d4e5f6a7b8c9..."
    // This is the token we send to the user (unhashed)

    // Hash the token before storing in database
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    // sha256 = a one-way hash function
    // We store the HASHED version. We compare against it later.

    // Set the token and expiry on the user document
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
    // 30 minutes from now (30 min × 60 sec × 1000 ms)

    await user.save({ validateBeforeSave: false });
    // validateBeforeSave: false = skip validation (we're not changing password here)

    // Build the reset URL
    // In production: this would be emailed to the user
    // For local development: we log it to the console
    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

    console.log(`
    ==========================================
    PASSWORD RESET LINK (copy this to browser):
    ==========================================
    Email: ${user.email}
    Link:  ${resetUrl}
    Expires: 30 minutes
    ==========================================
    `);

    res.json({
      message: 'If an account with that email exists, a reset link has been generated. Check the server console.',
      // In development, also return the token for easy testing:
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

    // If changing email, check it's not already taken by another user
    if (email && email !== req.user.email) {
      const existingUser = await User.findOne({ email });
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

    // Don't allow admins to delete themselves (use MongoDB Atlas for that)
    if (user.role === 'admin') {
      return res.status(400).json({
        message: 'Admin accounts cannot be self-deleted. Use the database directly.'
      });
    }

    // Delete associated appointments
    const Appointment = require('../models/Appointment');
    if (user.role === 'patient') {
      await Appointment.deleteMany({ patient: user._id });
    } else if (user.role === 'doctor') {
      await Appointment.deleteMany({ doctor: user._id });
    }

    // Delete the user
    await User.findByIdAndDelete(user._id);

    res.json({
      message: 'Your account has been deleted successfully. We\'re sorry to see you go.'
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

    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired verification link. Please register again or contact support.'
      });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpire = undefined;
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
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">This link expires in 24 hours.</p>
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
module.exports = { register, login, getMe, forgotPassword, resetPassword, updateAccount, deleteAccount, verifyEmail, resendVerification };
