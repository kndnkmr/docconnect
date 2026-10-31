// ============================================
// Doctor Controller - Profile Management Logic
// ============================================
// This handles everything related to doctor profiles:
// - A doctor updating their own profile (specialization, bio, fee, etc.)
// - Anyone viewing a list of all doctors
// - Anyone viewing a single doctor's full profile
//
// CRUD = Create, Read, Update, Delete
// We already "Create" doctors during registration (authController).
// Here we focus on Read and Update.

const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Review = require('../models/Review');
const { safeContainsRegex, getPagination } = require('../utils/queryHelpers');
const { getSpecializationSynonyms } = require('../utils/specializationSynonyms');
const { countBySpecialty } = require('../utils/specialtyCounts');
const { formatIndianPhone } = require('../utils/formatPhone');
const { uploadFile } = require('../utils/uploadFile');
const { checkPhone, checkOptionalPhone, ContactError, releaseFromDeletedAccounts } = require('../utils/contactChecks');

// Fields a PUBLIC doctor endpoint must never return. Doctor profiles are
// public, but the account record also holds login secrets (reset/verify
// tokens), push endpoints, login IP, the doctor's block list, admin audit
// notes, and the login email. Patient-only health fields are excluded too.
const DOCTOR_PRIVATE_FIELDS = [
  'password', 'email', 'resetPasswordToken', 'resetPasswordExpire',
  'verificationToken', 'verificationTokenExpire', 'pushSubscriptions',
  'lastLoginIP', 'lastLoginAt', 'blockedPatients', 'adminEdits', 'createdByAdmin',
  'managedConsentAt', 'managedConsentBy', // Admin → Manage doctor bookkeeping
  'suspendedReason', 'suspendedAt', 'deletedAt', 'consentAcceptedAt',
  'familyMembers', 'bloodGroup', 'allergies', 'currentMedications', 'medicalHistory',
  'emergencyContactName', 'emergencyContactPhone', 'insuranceProvider', 'insurancePolicyNumber',
].map((f) => `-${f}`).join(' ');

// ============================================
// Next-available-slot helpers (all in IST)
// ============================================
const _dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Convert minutes-since-midnight to a display label like "09:00 AM" / "12:00 AM".
function _minutesToLabel(minutes) {
  let h = Math.floor(minutes / 60);
  const m = minutes % 60;
  h = h % 24; // 24:00 (midnight end) → 12:00 AM
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

// Generate a day's slots as { startMin, label } (label matches booked timeSlot strings).
function _genDaySlots(startTime, endTime, duration) {
  const [sh, sm] = (startTime || '').split(':').map(Number);
  const [eh, em] = (endTime || '').split(':').map(Number);
  let cur = (sh || 0) * 60 + (sm || 0);
  let end = (eh || 0) * 60 + (em || 0);
  if (end === 0) end = 24 * 60; // midnight end
  const out = [];
  while (cur + duration <= end) {
    out.push({ startMin: cur, label: `${_minutesToLabel(cur)} - ${_minutesToLabel(cur + duration)}` });
    cur += duration;
  }
  return out;
}

// Find the earliest free, future, unbooked slot for a doctor (searches up to 14 days).
// bookedByDate: { 'YYYY-MM-DD': Set(timeSlotLabels) } for this doctor.
function computeNextAvailable(doctor, bookedByDate) {
  const availability = doctor.availability || [];
  if (availability.length === 0) return null;
  const duration = doctor.slotDuration || 30;

  const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const nowMinutes = istNow.getHours() * 60 + istNow.getMinutes();

  for (let offset = 0; offset < 14; offset++) {
    const d = new Date(istNow);
    d.setDate(d.getDate() + offset);
    const dayName = _dayNames[d.getDay()];
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Skip dates the doctor has blocked (vacation / day off) — keeps
    // "next available" and "available today" consistent with the slot endpoint.
    if ((doctor.blockedDates || []).some((b) => b.date === dateStr)) continue;

    const sessions = availability.filter((a) => a.day === dayName);
    if (sessions.length === 0) continue;

    let daySlots = [];
    for (const s of sessions) daySlots = daySlots.concat(_genDaySlots(s.startTime, s.endTime, duration));
    daySlots.sort((a, b) => a.startMin - b.startMin);

    const bookedSet = (bookedByDate && bookedByDate[dateStr]) || null;
    for (const slot of daySlots) {
      if (offset === 0 && slot.startMin <= nowMinutes) continue; // past today
      if (bookedSet && bookedSet.has(slot.label)) continue; // already booked
      return { date: dateStr, dayName, timeSlot: slot.label, isToday: offset === 0 };
    }
  }
  return null;
}

// Attach `nextAvailable` to a set of doctor docs. Runs ONE booked-appointments
// query for all of them (efficient), then computes each doctor's next free slot.
// Returns plain objects (not Mongoose docs).
async function attachNextAvailable(docs) {
  const docIds = docs.map((d) => d._id);
  const bookedByDoctor = {};
  if (docIds.length > 0) {
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const appts = await Appointment.find({
      doctor: { $in: docIds },
      status: { $nin: ['cancelled'] },
      date: { $gte: new Date(todayIST) }
    }).select('doctor date timeSlot');

    for (const a of appts) {
      const dId = a.doctor.toString();
      const dStr = new Date(a.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      bookedByDoctor[dId] = bookedByDoctor[dId] || {};
      bookedByDoctor[dId][dStr] = bookedByDoctor[dId][dStr] || new Set();
      bookedByDoctor[dId][dStr].add(a.timeSlot);
    }
  }

  return docs.map((d) => {
    const obj = typeof d.toObject === 'function' ? d.toObject() : { ...d };
    obj.nextAvailable = computeNextAvailable(obj, bookedByDoctor[d._id.toString()]);
    return obj;
  });
}

// Rating stats for EVERY doctor in one aggregate ({ doctorId: { average,
// count } }). Used by the doctor list so ratings can be fetched at the same
// time as the doctors themselves (the reviews collection is small), instead
// of after them and then again for the page.
async function ratingMapAll() {
  const stats = await Review.aggregate([
    { $match: { isHidden: { $ne: true } } },
    { $group: { _id: '$doctor', average: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  const byId = {};
  stats.forEach((s) => {
    if (s._id) byId[s._id.toString()] = { average: Math.round(s.average * 10) / 10, count: s.count };
  });
  return byId;
}

// ============================================
// Profile completeness / quality score
// ============================================
// Ranks doctors so complete, high-quality profiles lead the list and
// half-empty ones sink — instead of the old "newest registration first",
// which floated brand-new empty profiles above established doctors.
//
// Scoring is intentionally simple and explainable (no black-box ML):
//   1. Completeness  — does the profile have the things a patient needs to
//      decide and book? (specialization, fee, photo, qualification, bio,
//      experience, city, availability). This is the dominant factor.
//   2. Rating        — real average rating, weighted by how many reviews
//      (so 1 five-star review doesn't outrank 20 four-star ones).
//   3. Admin-verified trust badge — a small, honest boost.
//   4. Experience    — mild tiebreaker.
//   5. Freshness (createdAt) — used only as the FINAL tiebreaker so brand-new
//      doctors still surface among equally-complete peers, but never jump
//      ahead of a more complete/higher-rated profile just for being new.
//
// `doc` here is a plain object that already has `rating` attached (see
// ratingMapAll) OR we default rating to 0 when it hasn't been attached yet.
function computeProfileScore(doc) {
  let score = 0;

  // ---- 1. Completeness (max 60) ----
  // Each field a patient relies on to choose/book is worth points.
  if (doc.specialization && doc.specialization.trim()) score += 12;
  if (Number(doc.consultationFee) > 0) score += 10;
  if (Array.isArray(doc.availability) && doc.availability.length > 0) score += 12; // bookable at all
  if (doc.profilePhoto && doc.profilePhoto.trim()) score += 8;
  if (doc.qualification && doc.qualification.trim()) score += 6;
  if (Number(doc.experience) > 0) score += 5;
  if (doc.bio && doc.bio.trim()) score += 4;
  if (doc.city && doc.city.trim()) score += 3;

  // ---- 2. Rating (max ~25) ----
  // Weight the average by review count so a single review can't dominate.
  // confidence ramps from 0 → 1 over the first ~5 reviews.
  const avg = doc.rating && doc.rating.average ? doc.rating.average : 0;
  const count = doc.rating && doc.rating.count ? doc.rating.count : 0;
  if (count > 0) {
    const confidence = Math.min(count / 5, 1);
    score += (avg / 5) * 25 * confidence; // up to 25 when 5-star with >=5 reviews
  }

  // ---- 3. Admin-verified trust badge (max 8) ----
  if (doc.isAdminVerified) score += 8;

  // ---- 4. Experience tiebreaker (max ~5) ----
  // Capped so a very senior doctor with an empty profile still can't beat a
  // complete one; experience only nudges among otherwise-similar profiles.
  score += Math.min(Number(doc.experience) || 0, 25) / 5; // up to 5

  return score;
}

// Sort a list of doctor plain-objects by quality score (desc), then by
// newest registration as the final tiebreaker. Mutates + returns the array.
function sortByQuality(docs) {
  return docs.sort((a, b) => {
    const diff = computeProfileScore(b) - computeProfileScore(a);
    if (diff !== 0) return diff;
    // Tiebreaker: newer first (stable, meaningful for equally-complete peers)
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

// ============================================
// GET ALL DOCTORS - Public (anyone can browse)
// ============================================
// Endpoint: GET /api/doctors
// Optional query params: ?specialization=Cardiologist&page=1&limit=10
//
// This is what patients use to BROWSE available doctors.

const getAllDoctors = async (req, res) => {
  try {
    // ---- Build a filter object ----
    // Show verified doctors and legacy doctors (who don't have isVerified field yet)
    const filter = { role: 'doctor', isVerified: { $ne: false }, isDeleted: { $ne: true }, isSuspended: { $ne: true } };

    // Hide empty "shell" profiles from the public browse list. A doctor with no
    // specialization at all is an incomplete registration — there is nothing a
    // patient can act on (they already never appear on any /specialization page,
    // since there's nothing to match, and with no schedule they can't be booked).
    // Showing them in the generic /doctors list only produced blank, name-only,
    // "No upcoming availability" cards. Requiring a non-empty specialization keeps
    // the browse list to real, usable profiles. (A doctor who fills in their
    // specialization immediately reappears — this filters nothing from a complete
    // profile, and doesn't touch direct profile views via GET /api/doctors/:id.)
    filter.specialization = { $nin: [null, ''] };

    // If the user added ?specialization=something in the URL, filter by it
    // Example: /api/doctors?specialization=Cardiologist
    if (req.query.specialization) {
      // Case-insensitive "contains" search, e.g. "cardio" matches
      // "Cardiologist"/"Cardiology" — input is escaped so it's always
      // treated as a literal substring, never as a regex pattern.
      //
      // We also expand the term to its equivalents (e.g. "General Physician"
      // also matches doctors who wrote "Internal Medicine" / "Family Medicine"
      // — they treat the same everyday problems). For terms with no synonyms
      // this is just the single original term, so behaviour is unchanged.
      const synonyms = getSpecializationSynonyms(req.query.specialization);
      if (synonyms.length > 1) {
        filter.specialization = { $in: synonyms.map((s) => safeContainsRegex(s)) };
      } else {
        filter.specialization = safeContainsRegex(req.query.specialization);
      }
    }

    // If filtering by name (search)
    if (req.query.name) {
      filter.name = safeContainsRegex(req.query.name);
    }

    // Filter by max consultation fee
    if (req.query.maxFee) {
      filter.consultationFee = { $lte: Number(req.query.maxFee) };
    }

    // Filter by city
    if (req.query.city) {
      filter.city = safeContainsRegex(req.query.city);
    }

    // Filter by consultation mode
    if (req.query.consultationMode) {
      filter.consultationModes = req.query.consultationMode;
    }

    // Filter by a language the doctor consults in. languagesSpoken is an
    // array; matching a scalar against an array field matches when the array
    // CONTAINS that value. Use an anchored, case-insensitive regex (escaped)
    // so "bengali" matches a stored "Bengali" without matching substrings of
    // an unrelated language.
    if (req.query.language) {
      const escaped = req.query.language.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.languagesSpoken = { $elemMatch: { $regex: `^${escaped}$`, $options: 'i' } };
    }

    const wantAvailableToday = req.query.availableToday === 'true';

    // As a cheap pre-filter for "available today", narrow to doctors who have a
    // session on today's weekday (in IST). We still verify a REAL free slot below.
    if (wantAvailableToday) {
      const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const today = _dayNames[istNow.getDay()];
      filter['availability.day'] = today;
    }

    // ---- Pagination ----
    const { page, limit, skip } = getPagination(req, { defaultLimit: 10 });

    // Ranking note: we sort by a profile-quality score (see computeProfileScore),
    // NOT by registration date. The score depends on each doctor's rating, so we
    // fetch all matching candidates, attach ratings, score+sort, and only THEN
    // paginate in memory. next-available (the more expensive per-doctor compute)
    // is attached to just the page we return. Doctor counts here are modest
    // (tens, not thousands), so loading all candidates to rank them is fine and
    // is the same approach the "available today" path already used.
    let doctorsWithAvailability;
    let total;

    // Fetch every candidate matching the filter (no DB-level pagination — we
    // need the whole set to rank it correctly before slicing a page), and the
    // ratings for all doctors AT THE SAME TIME (two parallel database round
    // trips instead of four one-after-another). lean() = plain objects,
    // cheaper than full Mongoose documents for a read-only list.
    const [candidates, ratingById] = await Promise.all([
      User.find(filter).select(`${DOCTOR_PRIVATE_FIELDS} -upiQrCode`).lean(),
      ratingMapAll(),
    ]);
    const withRating = (d) => ({ ...d, rating: ratingById[String(d._id)] || { average: 0, count: 0 } });

    if (wantAvailableToday) {
      // Honest "available today": compute each candidate's next free slot and
      // keep only those genuinely free TODAY, then rank + paginate.
      const withNA = await attachNextAvailable(candidates);
      const freeToday = withNA.filter((d) => d.nextAvailable && d.nextAvailable.isToday).map(withRating);
      sortByQuality(freeToday);
      total = freeToday.length;
      doctorsWithAvailability = freeToday.slice(skip, skip + limit);
    } else {
      // Normal path: rank everyone by quality (ratings feed the score), slice
      // the page, then attach next-available to just that page (one query).
      const scored = candidates.map(withRating);
      sortByQuality(scored);
      total = scored.length;
      doctorsWithAvailability = await attachNextAvailable(scored.slice(skip, skip + limit));
    }

    // ---- Send response ----
    res.json({
      doctors: doctorsWithAvailability,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalDoctors: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get all doctors error:', error.message);
    res.status(500).json({
      message: 'Error fetching doctors list'
    });
  }
};

// ============================================
// GET DISTINCT CITIES - Public
// ============================================
// Endpoint: GET /api/doctors/cities?specialization=Dermatologist
// Returns the cities that actually have active doctors (optionally within a
// specialization), each with a count. Powers the "Find [specialization] in
// your city" links on the specialization landing pages.
//
// IMPORTANT: this is intentionally data-driven, not a hardcoded city list.
// We only ever want to link to city pages that have real doctors on them —
// generating/linking empty city pages would create "doorway pages", which
// search engines actively penalize.

const getDoctorCities = async (req, res) => {
  try {
    const match = {
      role: 'doctor',
      isVerified: { $ne: false },
      isDeleted: { $ne: true },
      isSuspended: { $ne: true },
      city: { $nin: [null, ''] }
    };
    if (req.query.specialization) {
      // Expand to equivalents (e.g. General Physician ⇄ Internal Medicine) so
      // the "find in your city" counts stay consistent with the doctor list.
      const synonyms = getSpecializationSynonyms(req.query.specialization);
      match.specialization = synonyms.length > 1
        ? { $in: synonyms.map((s) => safeContainsRegex(s)) }
        : safeContainsRegex(req.query.specialization);
    }

    const rows = await User.aggregate([
      { $match: match },
      // Group case-insensitively (so "Delhi" and "delhi" count as one), but
      // keep an actual original spelling to display.
      { $group: { _id: { $toLower: '$city' }, city: { $first: '$city' }, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 100 }
    ]);

    const cities = rows
      .map((r) => ({ city: (r.city || '').trim(), count: r.count }))
      .filter((r) => r.city.length > 0);

    res.json({ cities });
  } catch (error) {
    console.error('Get doctor cities error:', error.message);
    res.status(500).json({ message: 'Error fetching cities' });
  }
};

// ============================================
// GET SINGLE DOCTOR - Public (view full profile)
// ============================================
// Endpoint: GET /api/doctors/:id
// ":id" is a URL parameter — the actual doctor's database ID
// Example: GET /api/doctors/65a1b2c3d4e5f6789...

const getDoctorById = async (req, res) => {
  try {
    // req.params.id = the ":id" part from the URL
    // Profile and its completed-consultation count are fetched together.
    const [doctor, completedConsultations] = await Promise.all([
      User.findOne({
        _id: req.params.id,
        role: 'doctor'
        // Make sure we're fetching a doctor, not a patient
      }).select(DOCTOR_PRIVATE_FIELDS),
      Appointment.countDocuments({ doctor: req.params.id, status: 'completed' }),
    ]);

    if (!doctor) {
      return res.status(404).json({
        message: 'Doctor not found'
      });
    }

    // Hide deleted or suspended doctors from public view
    if (doctor.isDeleted || doctor.isSuspended) {
      return res.status(404).json({
        message: 'Doctor not found'
      });
    }

    // Real social proof: how many consultations this doctor has completed on
    // the platform (fetched above, in parallel). The frontend hides it when 0.
    const doctorObj = doctor.toObject();
    doctorObj.completedConsultations = completedConsultations;
    // Earliest free slot (same calculation as the doctor list) — the booking
    // page's "⚡ Earliest" button. Best effort: never blocks the profile.
    try {
      const [withNA] = await attachNextAvailable([doctor]);
      doctorObj.nextAvailable = (withNA && withNA.nextAvailable) || null;
    } catch {
      doctorObj.nextAvailable = null;
    }

    res.json({ doctor: doctorObj });

  } catch (error) {
    // If the ID format is wrong (not a valid MongoDB ObjectId), this catches it
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        message: 'Invalid doctor ID format'
      });
    }
    console.error('Get doctor by ID error:', error.message);
    res.status(500).json({
      message: 'Error fetching doctor profile'
    });
  }
};

// ============================================
// UPDATE DOCTOR PROFILE - Protected (doctor only)
// ============================================
// Endpoint: PUT /api/doctors/profile
// Body: { specialization, experience, qualification, clinicAddress, consultationFee, bio }
//
// A doctor can only update THEIR OWN profile (we use req.user from auth middleware)

// Length caps for the doctor's free-text fields (bio is the longest).
const DOCTOR_TEXT_CAPS = {
  name: 100, specialization: 100, qualification: 200, medicalRegistrationNo: 50,
  clinicAddress: 500, city: 100, googleMapsLink: 500, googleReviewLink: 300, bio: 3000, upiId: 100,
};

// Google review link must really point at Google (patients are sent there).
// Accepts the forms Google Business gives out: g.page/r/…, maps.app.goo.gl/…,
// search.google.com/local/writereview?…, google.com/maps/…, g.co/kgs/….
const GOOGLE_REVIEW_HOSTS = /^(g\.page|g\.co|maps\.app\.goo\.gl|goo\.gl|search\.google\.com|(www\.)?google\.(com|co\.in)|maps\.google\.(com|co\.in))$/i;
function googleReviewLinkProblem(raw) {
  const link = String(raw || '').trim();
  if (!link) return null; // empty = remove it
  let u;
  try { u = new URL(link); } catch { return 'Google review link must be a full link starting with https://'; }
  if (u.protocol !== 'https:') return 'Google review link must start with https://';
  if (!GOOGLE_REVIEW_HOSTS.test(u.hostname)) return 'Please paste the review link from your Google Business Profile (it starts with https://g.page/ or https://search.google.com/)';
  if ((u.hostname === 'goo.gl' || /google\./i.test(u.hostname)) && !/^\/(maps|local|search)/.test(u.pathname)) {
    return 'Please paste the review link from your Google Business Profile';
  }
  return null;
}
// Links/images patients will open or load: block script-type schemes.
// (Profile photos can be https URLs, legacy relative paths, or base64
// data:image/... fallbacks from uploadFile, so those stay allowed.)
const UNSAFE_URL = /^\s*(javascript|vbscript|file):|^\s*data:(?!image\/)/i;
// Same rule as the client (utils/upiQr.js) and the UPI apps: handle@provider.
const UPI_ID_RE = /^[\w.-]{2,256}@[a-zA-Z][\w.-]{1,64}$/;

// Returns a message for the first invalid field in `updates`, or null.
function validateDoctorUpdates(updates) {
  for (const [field, max] of Object.entries(DOCTOR_TEXT_CAPS)) {
    if (updates[field] === undefined) continue;
    if (typeof updates[field] !== 'string') return `${field} must be text`;
    if (updates[field].length > max) return `${field} is too long (max ${max} characters)`;
  }
  if (updates.name !== undefined && !updates.name.trim()) return 'Name cannot be empty';
  if (updates.googleMapsLink) {
    const link = updates.googleMapsLink.trim();
    // Must be a web link if it has a scheme at all.
    if (/^[a-z][a-z0-9+.-]*:/i.test(link) && !/^https?:\/\//i.test(link)) {
      return 'Google Maps link must start with https://';
    }
  }
  if (updates.googleReviewLink !== undefined) {
    const p = googleReviewLinkProblem(updates.googleReviewLink);
    if (p) return p;
  }
  // UPI ID: empty (= remove it) or a real-looking ID. Patients' "Pay with UPI
  // app" button pays exactly this, so a typo would send money nowhere.
  if (typeof updates.upiId === 'string' && updates.upiId.trim() && !UPI_ID_RE.test(updates.upiId.trim())) {
    return "That doesn't look like a UPI ID. It looks like name@okicici or 98xxxxxxxx@ybl (no spaces).";
  }
  for (const f of ['profilePhoto', 'upiQrCode']) {
    if (updates[f] === undefined) continue;
    if (typeof updates[f] !== 'string' || UNSAFE_URL.test(updates[f])) return `${f} is not a valid image`;
  }
  if (updates.consultationModes !== undefined) {
    if (!Array.isArray(updates.consultationModes)
      || updates.consultationModes.some((m) => !['in-person', 'video', 'phone'].includes(m))) {
      return 'Consultation modes must be any of: in-person, video, phone';
    }
  }
  if (updates.languagesSpoken !== undefined) {
    const l = updates.languagesSpoken;
    if (!Array.isArray(l) || l.length > 20 || l.some((x) => typeof x !== 'string' || x.length > 40)) {
      return 'Languages must be a list of up to 20 language names';
    }
  }
  return null;
}

const updateDoctorProfile = async (req, res) => {
  try {
    // Partial saves are allowed: the Dashboard autosaves only the fields that
    // changed, so a doctor never has to fill everything in one sitting. What
    // a profile still needs before patients can book is shown by the
    // onboarding checklist, not enforced here. Each field that IS sent is
    // still checked below (format, length, phone clash, schema validation).

    // These are the fields a doctor is ALLOWED to update
    const allowedUpdates = [
      'name',
      'specialization',
      'experience',
      'qualification',
      'medicalRegistrationNo',
      'clinicAddress',
      'city',
      'googleMapsLink',
      'googleReviewLink',
      'consultationModes',
      'languagesSpoken',
      'consultationFee',
      'bio',
      'profilePhoto',
      'phone',
      'whatsappNumber',
      'upiId',
      'upiQrCode'
    ];

    // Build an object with only the allowed fields that were actually sent
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        // Format phone numbers with +91
        if ((field === 'phone' || field === 'whatsappNumber') && req.body[field]) {
          updates[field] = formatIndianPhone(req.body[field]);
        } else {
          updates[field] = req.body[field];
        }
      }
    });
    // This prevents someone from sending { role: "admin" } and changing their role!

    // If a file was uploaded, store it (Cloudinary URL, or base64 fallback)
    if (req.file) {
      const isQr = req.body.fieldName === 'upiQrCode';
      // Photo / QR must be an image (the shared upload filter also lets PDFs
      // through for reports; a PDF "QR" can't be shown to patients).
      if (!/^image\//.test(req.file.mimetype || '')) {
        return res.status(400).json({ message: isQr ? 'Please upload a picture of your UPI QR code (JPG or PNG), not a PDF.' : 'Please upload a photo (JPG or PNG).' });
      }
      try {
        const imageUrl = await uploadFile(
          req.file.buffer,
          req.file.mimetype,
          isQr ? 'promedicoz/qr' : 'promedicoz/profile'
        );
        if (isQr) {
          updates.upiQrCode = imageUrl;
        } else {
          updates.profilePhoto = imageUrl;
        }
      } catch (fileErr) {
        console.error('File processing error:', fileErr.message, 'file keys:', Object.keys(req.file));
        return res.status(500).json({ message: 'Error processing uploaded file' });
      }
    }

    // If no updates at all, return error
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No updates provided' });
    }

    // Validate what's being saved (the save below now runs schema validation
    // too). Phone: valid Indian mobile, not used by another active account.
    // WhatsApp: valid format (a clinic line may be shared). Text is capped.
    const problem = validateDoctorUpdates(updates);
    if (problem) {
      return res.status(400).json({ message: problem });
    }
    if (typeof updates.googleReviewLink === 'string') updates.googleReviewLink = updates.googleReviewLink.trim();
    if (typeof updates.upiId === 'string') updates.upiId = updates.upiId.trim();
    if (req.body.phone !== undefined) {
      updates.phone = await checkPhone(req.body.phone, { selfId: req.user._id });
    }
    if (req.body.whatsappNumber !== undefined) {
      updates.whatsappNumber = checkOptionalPhone(req.body.whatsappNumber, 'WhatsApp number');
    }

    // Find the doctor and update their profile
    const doctor = await User.findById(req.user._id).select('-password');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Apply updates
    Object.keys(updates).forEach(key => {
      doctor[key] = updates[key];
    });
    if (doctor.isModified('phone')) {
      await releaseFromDeletedAccounts({ phone: doctor.phone, selfId: doctor._id });
    }
    // Validate only the fields that changed: new values are checked, while an
    // older profile with some legacy value elsewhere still saves.
    await doctor.save({ validateModifiedOnly: true });

    res.json({
      message: 'Profile updated successfully!',
      doctor
    });

  } catch (error) {
    if (error instanceof ContactError) {
      return res.status(error.status).json({ message: error.message });
    }
    if (error && error.name === 'ValidationError') {
      const first = Object.values(error.errors || {})[0];
      return res.status(400).json({ message: (first && first.message) || 'Some profile details are not valid' });
    }
    console.error('Update doctor profile error:', error.message);
    res.status(500).json({
      message: 'Error updating profile',
      // Only expose internal error details in explicit development — matches
      // the global error handler. The previous "!== 'production'" check leaked
      // details whenever NODE_ENV was unset (e.g. staging), which is unsafe.
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// GET DOCTOR BY SLUG - Public (branded "My Clinic" page)
// ============================================
// Endpoint: GET /api/doctors/by-slug/:slug
// Resolves a doctor from their vanity handle (e.g. "pooja-singh") for the
// branded /dr/:slug booking page. Increments a lightweight page-view counter
// (fire-and-forget — a counter hiccup must never fail the page load) and, like
// getDoctorById, attaches the real completed-consultation count. Hidden
// (deleted/suspended) doctors 404 just as they do on the id route.
const getDoctorBySlug = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) {
      return res.status(400).json({ message: 'Missing doctor handle' });
    }

    const doctor = await User.findOne({ slug, role: 'doctor' }).select(DOCTOR_PRIVATE_FIELDS);

    if (!doctor || doctor.isDeleted || doctor.isSuspended) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Count a page view — never block the response on it.
    User.updateOne({ _id: doctor._id }, { $inc: { pageViews: 1 } }).catch(() => {});

    const completedConsultations = await Appointment.countDocuments({
      doctor: doctor._id,
      status: 'completed'
    });

    const doctorObj = doctor.toObject();
    doctorObj.completedConsultations = completedConsultations;
    // Earliest free slot (same calculation as the doctor list) — the booking
    // page's "⚡ Earliest" button. Best effort: never blocks the profile.
    try {
      const [withNA] = await attachNextAvailable([doctor]);
      doctorObj.nextAvailable = (withNA && withNA.nextAvailable) || null;
    } catch {
      doctorObj.nextAvailable = null;
    }

    res.json({ doctor: doctorObj });
  } catch (error) {
    console.error('Get doctor by slug error:', error.message);
    res.status(500).json({ message: 'Error fetching doctor profile' });
  }
};

// ============================================
// TRACK LINK BOOKING START - Public (best-effort)
// ============================================
// Endpoint: POST /api/doctors/:id/link-booking
// Called by the branded /dr/:slug page when a visitor taps "Book" from it, so
// the doctor can see how many bookings their shared link drove. Pure counter —
// no auth, no side effects, always 200 so it can never interfere with the
// patient actually proceeding to book.
const trackLinkBooking = async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.params.id, role: 'doctor' },
      { $inc: { linkBookings: 1 } }
    );
  } catch (error) {
    // Swallow — this is a nice-to-have metric, never a blocker.
    console.error('Track link booking error:', error.message);
  }
  res.json({ ok: true });
};

// ============================================
// GET MY STATS - Protected (doctor only)
// ============================================
// Endpoint: GET /api/doctors/me/stats
// The data behind the doctor's own "Promote Me" numbers strip. Everything here
// is the doctor's OWN data (req.user._id), computed live from Appointments +
// Reviews — not invented. "This month" = the current calendar month in IST.
//   - consultationsThisMonth: appointments completed this month
//   - earningsThisMonth: sum of amountCollected on paid appointments this month
//   - earningsAllTime: sum of amountCollected on all paid appointments
//   - uniquePatients / repeatPatients: distinct patients + how many came back
//   - rating: live average + count from (non-hidden) reviews
//   - pageViews / linkBookings: the branded-page counters stored on the user
const getMyStats = async (req, res) => {
  try {
    const doctorId = req.user._id;

    // Start of the current month in IST, expressed as a UTC Date.
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const monthStart = new Date(`${nowIST.getFullYear()}-${String(nowIST.getMonth() + 1).padStart(2, '0')}-01T00:00:00+05:30`);

    const [
      consultationsThisMonth,
      earnThisMonthAgg,
      earnAllTimeAgg,
      patientAgg,
      ratingAgg,
      me
    ] = await Promise.all([
      Appointment.countDocuments({ doctor: doctorId, status: 'completed', date: { $gte: monthStart } }),
      Appointment.aggregate([
        { $match: { doctor: doctorId, paymentStatus: 'paid', paidAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$amountCollected', 0] } } } }
      ]),
      Appointment.aggregate([
        { $match: { doctor: doctorId, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$amountCollected', 0] } } } }
      ]),
      // Distinct patients + repeat count (patients with >1 appointment).
      Appointment.aggregate([
        { $match: { doctor: doctorId, status: { $in: ['confirmed', 'completed'] } } },
        { $group: { _id: '$patient', visits: { $sum: 1 } } },
        { $group: { _id: null, unique: { $sum: 1 }, repeat: { $sum: { $cond: [{ $gt: ['$visits', 1] }, 1, 0] } } } }
      ]),
      Review.aggregate([
        { $match: { doctor: doctorId, isHidden: { $ne: true } } },
        { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]),
      User.findById(doctorId).select('pageViews linkBookings slug')
    ]);

    const earningsThisMonth = (earnThisMonthAgg[0] && earnThisMonthAgg[0].total) || 0;
    const earningsAllTime = (earnAllTimeAgg[0] && earnAllTimeAgg[0].total) || 0;
    const uniquePatients = (patientAgg[0] && patientAgg[0].unique) || 0;
    const repeatPatients = (patientAgg[0] && patientAgg[0].repeat) || 0;
    const ratingAverage = ratingAgg[0] && ratingAgg[0].average ? Math.round(ratingAgg[0].average * 10) / 10 : 0;
    const ratingCount = (ratingAgg[0] && ratingAgg[0].count) || 0;

    res.json({
      stats: {
        consultationsThisMonth,
        earningsThisMonth,
        earningsAllTime,
        uniquePatients,
        repeatPatients,
        rating: { average: ratingAverage, count: ratingCount },
        pageViews: (me && me.pageViews) || 0,
        linkBookings: (me && me.linkBookings) || 0,
        slug: (me && me.slug) || null
      }
    });
  } catch (error) {
    console.error('Get my stats error:', error.message);
    res.status(500).json({ message: 'Error fetching your stats' });
  }
};

// ---- Export all controller functions ----

// ============================================
// GET SPECIALTY COUNTS - Public
// ============================================
// Endpoint: GET /api/doctors/specialty-counts
// { counts: { Gynaecologist: 8, 'General Physician': 4, Dermatologist: 0, … } }
// Same visibility rules and matching as the doctor list, so the website can
// put specialties with doctors first and never send a patient to an empty
// list. See utils/specialtyCounts.js.
const getSpecialtyCounts = async (req, res) => {
  try {
    const rows = await User.aggregate([
      { $match: {
        role: 'doctor', isVerified: { $ne: false }, isDeleted: { $ne: true }, isSuspended: { $ne: true },
        specialization: { $nin: [null, ''] },
      } },
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
    ]);
    res.json({ counts: countBySpecialty(rows.map((r) => ({ specialization: r._id, count: r.count }))) });
  } catch (error) {
    console.error('Get specialty counts error:', error.message);
    res.status(500).json({ message: 'Error fetching specialty counts' });
  }
};

module.exports = {
  getAllDoctors,
  getDoctorCities,
  getSpecialtyCounts,
  getDoctorById,
  getDoctorBySlug,
  trackLinkBooking,
  getMyStats,
  updateDoctorProfile,
  googleReviewLinkProblem, // exported for tests
  validateDoctorUpdates // reused by Admin → Manage doctor (same rules)
};
