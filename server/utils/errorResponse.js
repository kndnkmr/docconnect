// ============================================
// Standardized Error Response Helper
// ============================================
// Ensures all API errors follow the same format:
// { success: false, message: '...', error: '...' (dev only) }

const sendError = (res, statusCode, message, error) => {
  const response = {
    success: false,
    message
  };

  // Include error details only in development
  if (process.env.NODE_ENV === 'development' && error) {
    response.error = error.message || error;
  }

  return res.status(statusCode).json(response);
};

// Common error helpers
const badRequest = (res, message = 'Bad request') => sendError(res, 400, message);
const unauthorized = (res, message = 'Unauthorized') => sendError(res, 401, message);
const forbidden = (res, message = 'Forbidden') => sendError(res, 403, message);
const notFound = (res, message = 'Not found') => sendError(res, 404, message);
const serverError = (res, message = 'Internal server error', error) => sendError(res, 500, message, error);

module.exports = { sendError, badRequest, unauthorized, forbidden, notFound, serverError };
