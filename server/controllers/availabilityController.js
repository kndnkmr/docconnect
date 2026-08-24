// ============================================
// Availability Controller - Time Slot Management
// ============================================
// This handles:
// - Doctor sets/updates their weekly availability
// - Doctor gets their current schedule
// - Patient gets FREE slots for a specific doctor on a specific date
//
// HOW FREE SLOTS WORK:
// 1. Get the day of the week for the selected date (e.g., "Monday")
// 2. Look up doctor's availability for that day
// 3. Generate all possible slots (e.g., 09:00, 09:30, 10:00, ...)
// 4. Check which slots are already booked (from Appointments collection)
// 5. Return only the slots that are NOT booked

const User = require('../models/User');
const Appointment = require('../models/Appointment');

// ============================================
// SET AVAILABILITY - Doctor updates their schedule
// ============================================
// Endpoint: PUT /api/availability
// Body: { availability: [...], slotDuration: 30 }
//
// Example body:
// {
//   "availability": [
//     { "day": "Monday", "startTime": "09:00", "endTime": "12:00" },
//     { "day": "Monday", "startTime": "14:00", "endTime": "17:00" },
//     { "day": "Wednesday", "startTime": "10:00", "endTime": "16:00" }
//   ],
//   "slotDuration": 30
// }

const setAvailability = async (req, res) => {
  try {
    const { availability, slotDuration } = req.body;

    // Validate
    if (!availability || !Array.isArray(availability)) {
      return res.status(400).json({
        message: 'Please provide availability as an array'
      });
    }

    // Validate each entry
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    for (const slot of availability) {
      if (!slot.day || !slot.startTime || !slot.endTime) {
        return res.status(400).json({
          message: 'Each availability entry must have day, startTime, and endTime'
        });
      }
      if (!validDays.includes(slot.day)) {
        return res.status(400).json({
          message: `Invalid day: "${slot.day}". Must be one of: ${validDays.join(', ')}`
        });
      }
      // Check time format (basic validation)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      // Matches: 09:00, 14:30, 23:59 — NOT 25:00 or 9:00
      if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
        return res.status(400).json({
          message: `Invalid time format. Use 24-hour format like "09:00" or "14:30"`
        });
      }
      // Check startTime < endTime.
      // Treat an end time of "00:00" (12 AM) as end-of-day (midnight), so a slot
      // like 23:30 -> 00:00 is valid.
      const toMinutes = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };
      const startM = toMinutes(slot.startTime);
      let endM = toMinutes(slot.endTime);
      if (endM === 0) endM = 24 * 60; // midnight = end of day
      if (startM >= endM) {
        return res.status(400).json({
          message: `Start time (${slot.startTime}) must be before end time (${slot.endTime})`
        });
      }
    }

    // Validate slot duration
    const validDurations = [15, 30, 45, 60];
    const duration = slotDuration || 30;
    if (!validDurations.includes(duration)) {
      return res.status(400).json({
        message: `Slot duration must be one of: ${validDurations.join(', ')} minutes`
      });
    }

    // Update the doctor's availability
    const doctor = await User.findByIdAndUpdate(
      req.user._id,
      {
        availability,
        slotDuration: duration
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Availability updated successfully!',
      availability: doctor.availability,
      slotDuration: doctor.slotDuration
    });

  } catch (error) {
    console.error('Set availability error:', error.message);
    res.status(500).json({
      message: 'Error updating availability'
    });
  }
};

// ============================================
// GET MY AVAILABILITY - Doctor views their schedule
// ============================================
// Endpoint: GET /api/availability
// Returns the doctor's current availability settings

const getMyAvailability = async (req, res) => {
  try {
    const doctor = await User.findById(req.user._id).select('availability slotDuration');

    res.json({
      availability: doctor.availability || [],
      slotDuration: doctor.slotDuration || 30
    });

  } catch (error) {
    console.error('Get availability error:', error.message);
    res.status(500).json({
      message: 'Error fetching availability'
    });
  }
};

// ============================================
// GET FREE SLOTS - Patient checks available times
// ============================================
// Endpoint: GET /api/availability/:doctorId/slots?date=2024-03-15
//
// This is the KEY function — it calculates what's free vs booked.
//
// ALGORITHM:
// 1. Parse the date → get day of week ("Monday")
// 2. Find doctor's availability for that day
// 3. Generate all possible time slots from availability
// 4. Query appointments that are already booked for that date
// 5. Filter out booked slots → return only free ones

const getFreeSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    // Validate date
    if (!date) {
      return res.status(400).json({
        message: 'Please provide a date query parameter (format: YYYY-MM-DD)'
      });
    }

    // Parse the date
    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Get day of week name
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[selectedDate.getDay()];
    // getDay() returns 0 (Sunday) to 6 (Saturday)

    // Find the doctor
    const doctor = await User.findOne({ _id: doctorId, role: 'doctor' })
      .select('availability slotDuration name blockedDates');

    if (!doctor) {
      return res.status(404).json({
        message: 'Doctor not found'
      });
    }

    // If the doctor has blocked this exact date (vacation / day off), there
    // are no bookable slots — regardless of their weekly schedule.
    const isBlocked = (doctor.blockedDates || []).some((b) => b.date === date);
    if (isBlocked) {
      return res.json({
        date,
        dayOfWeek,
        doctorName: doctor.name,
        message: `Dr. ${doctor.name} is not available on ${date}`,
        slots: []
      });
    }

    // Get doctor's availability for this day of the week
    const dayAvailability = doctor.availability.filter(a => a.day === dayOfWeek);
    // Could be multiple entries (morning + afternoon sessions)

    if (dayAvailability.length === 0) {
      return res.json({
        date,
        dayOfWeek,
        message: `Dr. ${doctor.name} is not available on ${dayOfWeek}s`,
        slots: []
      });
    }

    // Generate all possible time slots
    const slotDuration = doctor.slotDuration || 30;
    const allSlots = [];

    for (const session of dayAvailability) {
      // Generate slots for this session (e.g., 09:00-12:00)
      const slots = generateTimeSlots(session.startTime, session.endTime, slotDuration);
      allSlots.push(...slots);
      // ...slots = "spread" the array items into allSlots
    }

    // Find already-booked appointments for this doctor on this date
    // We need to match the DATE (ignoring time), so we create a range
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedAppointments = await Appointment.find({
      doctor: doctorId,
      date: { $gte: startOfDay, $lte: endOfDay },
      // $gte = greater than or equal, $lte = less than or equal
      // This finds all appointments on this specific day
      status: { $nin: ['cancelled'] }
      // Ignore cancelled appointments — those slots are free again
    }).select('timeSlot');

    // Extract booked time slots as strings
    const bookedSlots = bookedAppointments.map(apt => apt.timeSlot);
    // Example: ["09:00 AM - 09:30 AM", "10:00 AM - 10:30 AM"]

    // Filter: remove booked slots from all slots
    let freeSlots = allSlots.filter(slot => !bookedSlots.includes(slot));

    // Filter: remove past time slots if the selected date is TODAY (in IST)
    // Use Intl to get the actual IST date/time regardless of server timezone
    const nowInIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayIST = nowInIST.getFullYear() + '-' +
      String(nowInIST.getMonth() + 1).padStart(2, '0') + '-' +
      String(nowInIST.getDate()).padStart(2, '0');

    if (date === todayIST) {
      // Current time in IST as minutes since midnight
      const currentMinutes = nowInIST.getHours() * 60 + nowInIST.getMinutes();

      freeSlots = freeSlots.filter(slot => {
        const startTimeStr = slot.split(' - ')[0]; // "09:30 AM"
        const slotMinutes = timeStringToMinutes(startTimeStr);
        return slotMinutes > currentMinutes;
      });
    }

    res.json({
      date,
      dayOfWeek,
      doctorName: doctor.name,
      slotDuration,
      totalSlots: allSlots.length,
      bookedCount: bookedSlots.length,
      freeCount: freeSlots.length,
      slots: freeSlots
    });

  } catch (error) {
    console.error('Get free slots error:', error.message);
    res.status(500).json({
      message: 'Error fetching available slots'
    });
  }
};

// ============================================
// HELPER: Generate time slots between start and end
// ============================================
// Input: startTime="09:00", endTime="12:00", duration=30
// Output: ["09:00 AM - 09:30 AM", "09:30 AM - 10:00 AM", "10:00 AM - 10:30 AM", ...]
//
// This converts 24-hour times to 12-hour format for display

function generateTimeSlots(startTime, endTime, durationMinutes) {
  const slots = [];

  // Convert "09:00" to minutes since midnight: 9*60 + 0 = 540
  let [startHour, startMin] = startTime.split(':').map(Number);
  let [endHour, endMin] = endTime.split(':').map(Number);

  let currentMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;
  // Treat "00:00" end time as end-of-day (midnight) so 23:30 -> 00:00 works
  if (endMinutes === 0) endMinutes = 24 * 60;

  while (currentMinutes + durationMinutes <= endMinutes) {
    const slotStart = minutesToTimeString(currentMinutes);
    const slotEnd = minutesToTimeString(currentMinutes + durationMinutes);
    slots.push(`${slotStart} - ${slotEnd}`);
    currentMinutes += durationMinutes;
  }

  return slots;
}

// Convert minutes since midnight to "HH:MM AM/PM" format
// 540 → "09:00 AM", 810 → "01:30 PM"
function minutesToTimeString(minutes) {
  let hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  hours24 = hours24 % 24; // 24:00 (midnight end of day) → 0 → shows as 12 AM

  // Convert 24-hour to 12-hour
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;

  // Pad with zeros: 9 → "09", 30 → "30"
  const hoursStr = hours12.toString().padStart(2, '0');
  const minsStr = mins.toString().padStart(2, '0');

  return `${hoursStr}:${minsStr} ${period}`;
}

// Convert "09:30 AM" or "01:30 PM" to minutes since midnight
// "09:30 AM" → 570, "01:30 PM" → 810
function timeStringToMinutes(timeStr) {
  const [time, period] = timeStr.split(' '); // ["09:30", "AM"]
  let [hours, mins] = time.split(':').map(Number); // [9, 30]

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return hours * 60 + mins;
}

// ============================================
// SET BLOCKED DATES - Doctor marks vacation / days off
// ============================================
// Endpoint: PUT /api/availability/blocked-dates
// Body: { blockedDates: [{ date: "2026-08-20", reason: "Vacation" }, ...] }
//
// Replaces the doctor's full blocked-dates list (the client sends the whole
// list, same pattern as setAvailability). Dates in the past are dropped —
// blocking yesterday is meaningless. Validated to YYYY-MM-DD and de-duped.

const setBlockedDates = async (req, res) => {
  try {
    const { blockedDates } = req.body;

    if (!Array.isArray(blockedDates)) {
      return res.status(400).json({ message: 'Please provide blockedDates as an array' });
    }

    // Today in IST (YYYY-MM-DD) — we drop past dates.
    const nowInIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayIST = nowInIST.getFullYear() + '-' +
      String(nowInIST.getMonth() + 1).padStart(2, '0') + '-' +
      String(nowInIST.getDate()).padStart(2, '0');

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const seen = new Set();
    const clean = [];

    for (const entry of blockedDates) {
      const date = entry && typeof entry.date === 'string' ? entry.date.trim() : '';
      if (!dateRegex.test(date)) {
        return res.status(400).json({ message: `Invalid date "${date}". Use YYYY-MM-DD.` });
      }
      if (date < todayIST) continue;      // silently drop past dates
      if (seen.has(date)) continue;       // de-dupe
      seen.add(date);
      const reason = entry.reason ? String(entry.reason).trim().slice(0, 100) : '';
      clean.push({ date, reason });
    }

    // Keep sorted by date for a tidy UI.
    clean.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const doctor = await User.findByIdAndUpdate(
      req.user._id,
      { blockedDates: clean },
      { new: true }
    ).select('blockedDates');

    res.json({
      message: 'Blocked dates updated',
      blockedDates: doctor.blockedDates
    });
  } catch (error) {
    console.error('Set blocked dates error:', error.message);
    res.status(500).json({ message: 'Error updating blocked dates' });
  }
};

// ============================================
// GET MY BLOCKED DATES - Doctor views their vacation days
// ============================================
// Endpoint: GET /api/availability/blocked-dates

const getMyBlockedDates = async (req, res) => {
  try {
    const doctor = await User.findById(req.user._id).select('blockedDates');
    res.json({ blockedDates: (doctor && doctor.blockedDates) || [] });
  } catch (error) {
    console.error('Get blocked dates error:', error.message);
    res.status(500).json({ message: 'Error fetching blocked dates' });
  }
};

// ---- Export ----
module.exports = { setAvailability, getMyAvailability, getFreeSlots, setBlockedDates, getMyBlockedDates };
