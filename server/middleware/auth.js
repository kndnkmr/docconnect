// ============================================
// Auth Middleware - The Security Guard
// ============================================
// This file checks if a user is logged in before allowing access to protected routes.
//
// HOW IT WORKS:
// 1. When a user logs in, they receive a JWT token (like a wristband at a concert)
// 2. For every request to a protected route, they must send this token
// 3. This middleware checks: "Is the token valid? Has it expired? Who does it belong to?"
// 4. If valid → let them through. If not → reject with "Unauthorized" error.
//
// WHERE TOKENS ARE SENT:
// The frontend sends the token in the request headers like this:
// Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
// The "Bearer " prefix is a standard convention.

const jwt = require('jsonwebtoken');
// jsonwebtoken = library to create and verify JWT tokens

const User = require('../models/User');
// We need the User model to find the user that the token belongs to

// ---- Main Auth Middleware ----
// "protect" is a function we'll attach to any route that requires login

const protect = async (req, res, next) => {
  // "next" is a function that says "ok, move on to the next step"
  // If we DON'T call next(), the request stops here (blocked!)

  // Step 1: Extract a Bearer token from the Authorization header.
  // Rewritten as a single early-return flow so there is exactly ONE response
  // on every path — the previous split-if structure could, for an odd header
  // (e.g. "Bearer" with nothing after it, or a non-Bearer scheme), leave the
  // request without a clear single response. This guarantees we always either
  // call next() once or send exactly one error response.
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()   // everything after "Bearer "
    : '';

  // No (usable) token provided → not authorized.
  if (!token) {
    return res.status(401).json({
      message: 'Not authorized - no token provided'
    });
  }

  try {
    // Step 2: Verify the token (real? signed with our secret? not expired?).
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Step 3: Load the user (minus the password) and attach to the request.
    req.user = await User.findById(decoded.id).select('-password');

    // Step 4: If the user no longer exists (e.g. account deleted).
    if (!req.user) {
      return res.status(401).json({
        message: 'User no longer exists'
      });
    }

    // All good — continue to the route handler.
    return next();

  } catch (error) {
    // Token verification failed (expired, tampered, or invalid).
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({
      message: 'Not authorized - invalid token'
    });
  }
};

// ---- Role-based Authorization ----
// Sometimes we want ONLY doctors or ONLY patients to access a route.
// This middleware checks the user's role AFTER they've been authenticated.
//
// Usage example:
//   router.get('/doctor-only', protect, authorize('doctor'), someController);
//   This means: first check login (protect), then check role (authorize)

const authorize = (...roles) => {
  // "...roles" = accepts multiple roles like authorize('doctor', 'admin')
  // It returns a middleware function:
  return (req, res, next) => {
    // req.user was set by the "protect" middleware above
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`
      });
      // 403 = Forbidden (you're logged in, but you don't have permission)
      // Different from 401 = Unauthorized (you're not logged in at all)
    }
    next(); // Role matches, let them through
  };
};

// Export both middleware functions so other files can use them
module.exports = { protect, authorize };
