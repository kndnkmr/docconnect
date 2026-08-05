// ============================================
// Phone Number Formatting Utility
// ============================================
// Ensures all phone numbers are stored in consistent format: +91XXXXXXXXXX
//
// Handles various input formats:
//   "9599150825"      → "+919599150825"
//   "09599150825"     → "+919599150825"
//   "+919599150825"   → "+919599150825" (already correct)
//   "919599150825"    → "+919599150825"
//   "+91 9599150825"  → "+919599150825"
//   "95991 50825"     → "+919599150825"

const formatIndianPhone = (phone) => {
  if (!phone) return '';

  // Remove all spaces, dashes, dots, and parentheses
  let cleaned = phone.replace(/[\s\-\.\(\)]/g, '');

  // Remove leading + if present (we'll add it back)
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Remove leading 0 (some people dial 0 before the number)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // If starts with 91 and is 12 digits, it already has country code
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return '+' + cleaned;
  }

  // If it's 10 digits, add +91
  if (cleaned.length === 10) {
    return '+91' + cleaned;
  }

  // If it already starts with 91 and is correct length
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return '+' + cleaned;
  }

  // Return as-is with + if we can't parse it (international numbers)
  if (cleaned.length > 10) {
    return '+' + cleaned;
  }

  // Can't format — return original
  return phone;
};

// Validate Indian phone number
const isValidIndianPhone = (phone) => {
  if (!phone) return false;
  const formatted = formatIndianPhone(phone);
  // Valid Indian mobile: +91 followed by 10 digits starting with 6-9
  return /^\+91[6-9]\d{9}$/.test(formatted);
};

module.exports = { formatIndianPhone, isValidIndianPhone };
