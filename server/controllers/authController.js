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
    // req.body contains whatever JSON the frontend sent
    const { name, email, password, role } = req.body;
    // This is "destructuring" — a shortcut for:
    // const name = req.body.name;
    // const email = req.body.email; ... etc.

    // Step 2: Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: 'Please provide all required fields: name, email, password, role'
      });
      // 400 = Bad Request (the client sent incomplete data)
    }

    // Step 3: Check if a user with this email already exists
    const existingUser = await User.findOne({ email });
    // findOne() searches the database for a matching document
    // "await" means "wait for the database to respond before continuing"

    if (existingUser) {
      return res.status(400).json({
        message: 'An account with this email already exists'
      });
    }

    // Step 4: Validate role
    if (!['doctor', 'patient'].includes(role)) {
      return res.status(400).json({
        message: 'Role must be either "doctor" or "patient"'
      });
    }

    // Step 5: Create the user in the database
    // The password will be automatically hashed by our pre-save hook in User.js!
    const user = await User.create({
      name,
      email,
      password,  // Plain text here → hashed automatically before saving
      role
    });

    // Step 6: Generate a token for the new user (log them in immediately)
    const token = generateToken(user._id);
    // user._id is the unique ID that MongoDB assigns to every document

    // Step 7: Send back the response
    res.status(201).json({
      // 201 = Created (a new resource was successfully created)
      message: 'Registration successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
        // Notice we DON'T send back the password!
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
    const { email, password } = req.body;

    // Step 1: Validate input
    if (!email || !password) {
      return res.status(400).json({
        message: 'Please provide email and password'
      });
    }

    // Step 2: Find the user by email
    const user = await User.findOne({ email });

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

    // Step 5: Send back user data + token
    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePhoto: user.profilePhoto
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

// ---- Export all controller functions ----
module.exports = { register, login, getMe, forgotPassword, resetPassword };
