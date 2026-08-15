# How DocConnect Works — Full Technical Documentation

This document explains how the entire application works — the architecture, data flow, user journeys, and how all services connect.

---

## Architecture Overview

```
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│       VERCEL             │     │       RENDER             │     │    MONGODB ATLAS         │
│    (Frontend)            │────▶│    (Backend)             │────▶│    (Database)            │
│                          │     │                          │     │                          │
│ React pages + Tailwind   │     │ Node.js + Express        │     │ Stores all data          │
│ What users see & click   │     │ Business logic + auth    │     │ Users, bookings, etc.    │
│                          │     │ API endpoints            │     │                          │
│ docconnect-mocha         │     │ docconnect-fcg6          │     │ docconnect cluster       │
│   .vercel.app            │     │   .onrender.com          │     │   .mongodb.net           │
└─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘
```

### What each service does:

| Service | Role | Analogy |
|---------|------|---------|
| **Vercel** | Serves the frontend (HTML/CSS/JS) to the browser | The hospital reception desk — what you see |
| **Render** | Processes all requests — login, booking, data | The hospital staff — does the work behind the scenes |
| **MongoDB Atlas** | Stores all data permanently | The hospital filing cabinet — stores records |

### How they communicate:

```
Browser → Vercel: "Give me the website"
Vercel → Browser: Here's the React app (HTML/JS/CSS)

Browser → Render: "Register this user" (API call with data)
Render → MongoDB: "Save this user document"
MongoDB → Render: "Done, here's the saved document"
Render → Browser: "Success! Here's your login token"
```

---

## Environment Variables (The Configuration)

These are settings stored on each platform — they tell the services how to find each other.

| Where | Variable | Value | Purpose |
|-------|----------|-------|---------|
| Vercel | `VITE_API_URL` | `https://docconnect-fcg6.onrender.com/api` | Frontend knows where to send API requests |
| Render | `MONGODB_URI` | `mongodb+srv://...@docconnect.mongodb.net/docconnect` | Backend knows where the database is |
| Render | `JWT_SECRET` | `docconnect_secret_key_2024` | Secret key for signing login tokens |
| Render | `NODE_ENV` | `production` | Tells app to hide error details from users |

---

## Database Structure

MongoDB stores data in "collections" (like tables). Each collection holds "documents" (like rows, but flexible JSON).

### Collection: users

Stores all doctor and patient accounts.

```json
{
  "_id": "auto-generated-unique-id",
  "name": "Dr. Priya Sharma",
  "email": "priya@example.com",
  "password": "$2a$10$hashed...",
  "role": "doctor",
  "specialization": "Neurologist",
  "experience": 12,
  "qualification": "MBBS, MD - Neurology",
  "clinicAddress": "Apollo Hospital, Mumbai",
  "consultationFee": 500,
  "bio": "Specializing in neurological disorders...",
  "profilePhoto": "/uploads/abc123-1705312000000.jpg",
  "availability": [
    { "day": "Monday", "startTime": "09:00", "endTime": "12:00" },
    { "day": "Monday", "startTime": "14:00", "endTime": "17:00" },
    { "day": "Wednesday", "startTime": "10:00", "endTime": "16:00" }
  ],
  "slotDuration": 30,
  "createdAt": "2024-08-03T10:00:00.000Z"
}
```

### Collection: appointments

Stores all bookings between patients and doctors.

```json
{
  "_id": "auto-generated-unique-id",
  "patient": "patient-user-id",
  "doctor": "doctor-user-id",
  "date": "2024-08-10T00:00:00.000Z",
  "timeSlot": "09:30 AM - 10:00 AM",
  "status": "pending",
  "reason": "Frequent headaches for the last week",
  "consultationType": "in-person",
  "notes": "",
  "cancellationReason": "",
  "createdAt": "2024-08-03T11:00:00.000Z"
}
```

---

## User Journeys — What Happens at Each Step

---

### Journey 1: Doctor Registration

**What the user does:**
1. Opens the website → clicks "Register"
2. Selects "Doctor" role
3. Fills: name, email, password
4. Clicks "Register"

**What happens behind the scenes:**

```
Step 1: Browser shows Register.jsx page (served by Vercel)

Step 2: User clicks submit
        → Frontend validates: all fields filled? passwords match? length >= 6?

Step 3: Frontend sends to backend:
        POST https://docconnect-fcg6.onrender.com/api/auth/register
        Body: { name: "Dr. Priya", email: "priya@email.com", password: "123456", role: "doctor" }

Step 4: Backend (authController.js) receives request:
        → Checks: are all fields present? ✓
        → Checks: does this email already exist in database? (queries MongoDB)
        → If exists: returns error "An account with this email already exists"
        → If new: continues...

Step 5: Backend creates user in database:
        → Mongoose calls User.create({ name, email, password, role })
        → BEFORE saving, the pre-save hook in User.js runs:
          - Generates salt: await bcrypt.genSalt(10)
          - Hashes password: await bcrypt.hash("123456", salt) → "$2a$10$xKd8..."
          - Replaces plain password with hash
        → Document saved to MongoDB "users" collection

Step 6: Backend generates JWT token:
        → jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' })
        → Creates: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        → This token contains the user's ID, signed with the secret key

Step 7: Backend sends response:
        { message: "Registration successful!", token: "eyJ...", user: { id, name, email, role } }

Step 8: Frontend receives response:
        → Calls login(token, user) in AuthContext
        → Saves token to localStorage
        → Sets axios default header: Authorization: Bearer eyJ...
        → Updates state: user = { name: "Dr. Priya", role: "doctor" }

Step 9: Frontend navigates to /dashboard
        → Dashboard.jsx loads
        → Shows: "Welcome, Dr. Priya!"
        → Tabs: My Appointments, Edit Profile, Availability
```

---

### Journey 2: Doctor Sets Up Profile

**What the user does:**
1. Goes to Dashboard → clicks "Edit Profile" tab
2. Fills: specialization, experience, qualification, fees, clinic address, bio
3. Clicks "Save Profile"

**What happens behind the scenes:**

```
Step 1: Dashboard.jsx shows the profile form (already pre-loaded)

Step 2: User fills form and clicks save
        → Frontend sends:
        PUT https://docconnect-fcg6.onrender.com/api/doctors/profile
        Header: Authorization: Bearer eyJ... (proves who they are)
        Body: { specialization: "Neurologist", experience: 12, consultationFee: 500, ... }

Step 3: Backend receives request → middleware chain runs:
        1. protect middleware (auth.js):
           → Extracts token from Authorization header
           → jwt.verify(token, JWT_SECRET) → decoded = { id: "user-id" }
           → Finds user in database: User.findById(decoded.id)
           → Attaches to request: req.user = userDocument
           → Calls next() (passes to next middleware)

        2. authorize('doctor') middleware:
           → Checks: req.user.role === 'doctor'? ✓
           → Calls next()

        3. upload middleware (for optional photo):
           → Checks if a file was attached. If no file, passes through.

        4. updateDoctorProfile controller runs:
           → Whitelist check: only allows specific fields to be updated
           → User.findByIdAndUpdate(req.user._id, updates, { new: true })
           → MongoDB updates the document

Step 4: Backend responds:
        { message: "Profile updated successfully!", doctor: { ...updated data } }

Step 5: Frontend shows toast: "Profile updated successfully!"
```

---

### Journey 3: Doctor Sets Availability

**What the user does:**
1. Dashboard → Availability tab
2. Adds: Monday 09:00-12:00, Monday 14:00-17:00, Wednesday 10:00-16:00
3. Sets slot duration: 30 minutes
4. Clicks "Save Availability"

**What happens behind the scenes:**

```
Step 1: Frontend sends:
        PUT https://.../api/availability
        Header: Authorization: Bearer eyJ...
        Body: {
          availability: [
            { day: "Monday", startTime: "09:00", endTime: "12:00" },
            { day: "Monday", startTime: "14:00", endTime: "17:00" },
            { day: "Wednesday", startTime: "10:00", endTime: "16:00" }
          ],
          slotDuration: 30
        }

Step 2: Backend validates:
        → Each day must be valid (Monday-Sunday)
        → Times must be in HH:MM format
        → startTime must be before endTime
        → slotDuration must be 15, 30, 45, or 60

Step 3: Backend updates user document in MongoDB:
        → User.findByIdAndUpdate(req.user._id, { availability, slotDuration })

Step 4: Response: { message: "Availability updated successfully!" }
```

---

### Journey 4: Patient Registration

Exact same flow as Doctor Registration but with `role: "patient"`.
Patient dashboard shows only: "My Appointments" tab + "Book New Appointment" button.

---

### Journey 5: Patient Searches for a Doctor

**What the user does:**
1. Clicks "Find Doctors" in navbar
2. Types "Neuro" in specialization field
3. Clicks "Search"

**What happens behind the scenes:**

```
Step 1: DoctorList.jsx loads → useEffect fires → fetches all doctors
        GET https://.../api/doctors?page=1&limit=9

Step 2: User types "Neuro" and searches
        GET https://.../api/doctors?page=1&limit=9&specialization=Neuro

Step 3: Backend (doctorController.js):
        → Builds filter: { role: 'doctor', specialization: /Neuro/i }
        → /Neuro/i = case-insensitive regex (matches "Neurologist", "neurology", etc.)
        → Queries: User.find(filter).select('-password').skip(0).limit(9)
        → Counts total: User.countDocuments(filter)

Step 4: Response:
        {
          doctors: [{ name: "Dr. Priya", specialization: "Neurologist", ... }],
          pagination: { currentPage: 1, totalPages: 1, totalDoctors: 1 }
        }

Step 5: Frontend renders doctor cards in a grid
```

---

### Journey 6: Patient Books an Appointment

**What the user does:**
1. Clicks on a doctor card → sees full profile
2. Clicks "Book Appointment"
3. Picks a date (e.g., next Monday)
4. Sees available time slots → picks one
5. Fills reason → clicks "Confirm Booking"

**What happens behind the scenes:**

```
Step 1: User picks date "2024-08-05" (a Monday)
        → useEffect fires:
        GET https://.../api/availability/doctor-id/slots?date=2024-08-05

Step 2: Backend (availabilityController.js - getFreeSlots):
        → Parses date → getDay() → "Monday"
        → Finds doctor's Monday schedule: [09:00-12:00, 14:00-17:00]
        → Generates ALL slots (30 min each):
          Morning: 09:00-09:30, 09:30-10:00, 10:00-10:30, 10:30-11:00, 11:00-11:30, 11:30-12:00
          Afternoon: 14:00-14:30, 14:30-15:00, 15:00-15:30, 15:30-16:00, 16:00-16:30, 16:30-17:00
          Total: 12 slots
        → Queries existing appointments for that day:
          Appointment.find({ doctor: id, date: "2024-08-05", status: { $nin: ['cancelled'] } })
        → Finds 2 booked: "10:00 AM - 10:30 AM", "14:30 PM - 15:00 PM"
        → Filters them out: 12 - 2 = 10 free slots

Step 3: Response:
        {
          slots: ["09:00 AM - 09:30 AM", "09:30 AM - 10:00 AM", "10:30 AM - 11:00 AM", ...],
          freeCount: 10, bookedCount: 2
        }

Step 4: Frontend shows 10 clickable slot buttons
        User picks "09:30 AM - 10:00 AM"

Step 5: User fills reason, clicks confirm:
        POST https://.../api/appointments
        Header: Authorization: Bearer eyJ... (patient's token)
        Body: {
          doctorId: "doctor-id",
          date: "2024-08-05",
          timeSlot: "09:30 AM - 10:00 AM",
          reason: "Frequent headaches",
          consultationType: "in-person"
        }

Step 6: Backend (appointmentController.js - bookAppointment):
        → Verifies token → confirms role is 'patient'
        → Verifies doctor exists
        → Double-checks slot isn't taken (race condition protection)
        → Checks date is in the future
        → Creates appointment: status = "pending"
        → Saves to MongoDB appointments collection

Step 7: Response: { message: "Appointment booked! Waiting for doctor confirmation." }

Step 8: Frontend shows success toast → redirects to Dashboard
```

---

### Journey 7: Doctor Manages Appointments

**What the user does:**
1. Doctor logs in → goes to Dashboard
2. Sees pending appointment from the patient
3. Clicks "Confirm"
4. Later, clicks "Mark Complete" and adds notes

**What happens behind the scenes:**

```
Step 1: Dashboard loads → fetches appointments:
        GET https://.../api/appointments/my
        → Backend filters: { doctor: req.user._id }
        → Returns appointments with populated patient info

Step 2: Doctor clicks "Confirm":
        PUT https://.../api/appointments/appointment-id/status
        Body: { status: "confirmed" }

Step 3: Backend validates:
        → Is this doctor's appointment? ✓
        → Is transition valid? pending → confirmed ✓
        → Updates: appointment.status = "confirmed"
        → Saves to database

Step 4: Later, doctor clicks "Mark Complete":
        PUT https://.../api/appointments/appointment-id/status
        Body: { status: "completed", notes: "Prescribed medication for migraines" }

Step 5: Backend validates:
        → confirmed → completed ✓
        → Updates status + notes
        → Saves to database
```

---

### Journey 8: Patient Cancels Appointment

```
Step 1: Patient goes to Dashboard → sees their booking

Step 2: Clicks "Cancel":
        PUT https://.../api/appointments/appointment-id/cancel
        Body: { cancellationReason: "Schedule conflict" }

Step 3: Backend:
        → Verifies this is the patient's appointment
        → Checks status isn't already completed/cancelled
        → Updates: status = "cancelled", cancellationReason = "Schedule conflict"

Step 4: That time slot becomes available again for other patients
        (because getFreeSlots excludes cancelled appointments)
```

---

### Journey 9: Password Reset

```
Step 1: User clicks "Forgot password?" on Login page
        → ForgotPassword.jsx loads

Step 2: User enters email → clicks "Send Reset Link"
        POST https://.../api/auth/forgot-password
        Body: { email: "priya@email.com" }

Step 3: Backend:
        → Finds user by email
        → Generates 32 random bytes → converts to hex string (the token)
        → Hashes the token (sha256) → stores hash + expiry in database
        → Logs the plain token as a URL to the SERVER CONSOLE:
          "http://localhost:5173/reset-password/a3f7b2c4d8e9..."
        → In production, this would be EMAILED to the user

Step 4: Response: { message: "If an account exists, a reset link was generated" }
        (Same message whether email exists or not — security)

Step 5: User gets the link → opens it:
        → ResetPassword.jsx loads
        → Token extracted from URL: useParams() → { token: "a3f7b2c4d8e9..." }

Step 6: User enters new password → clicks "Reset Password"
        PUT https://.../api/auth/reset-password/a3f7b2c4d8e9...
        Body: { password: "newpassword123" }

Step 7: Backend:
        → Hashes the token from URL (sha256)
        → Searches database: user with matching hash AND expiry > now
        → If found: updates password (pre-save hook hashes it)
        → Clears reset token fields
        → Generates new login token (auto-login)

Step 8: Response: { token: "eyJ...", user: { ... } }
        → Frontend logs user in → redirects to Dashboard
```

---

## Security Model

### How authentication works:

```
1. User logs in → server creates JWT token (contains user ID, signed with secret)
2. Token saved in browser's localStorage
3. Every API request includes: Authorization: Bearer <token>
4. Server verifies token on every protected request:
   - Is the signature valid? (not tampered)
   - Is it expired? (30-day expiry)
   - Does the user still exist? (not deleted)
```

### JWT Token anatomy:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1YTFiMmMzZDRlNWY2Nzg5IiwiaWF0IjoxNzA1MzEyMDAwfQ.abc123signature

[Header].[Payload].[Signature]

Header: { alg: "HS256", typ: "JWT" }
Payload: { id: "65a1b2c3d4e5f6789", iat: 1705312000 }
Signature: HMAC-SHA256(header + payload, JWT_SECRET)
```

Anyone can decode the header and payload (it's just base64, not encrypted). But ONLY the server can create a valid signature because only it knows `JWT_SECRET`. If anyone changes the payload, the signature won't match → rejected.

### Role-based access:

```
Patient can:     register, login, browse doctors, book, cancel own appointments
Doctor can:      register, login, update profile, set availability, confirm/complete appointments
Nobody can:      access other users' data, change roles, bypass authentication
```

---

## What Happens When You Push New Code

```
1. You edit code in Kiro
2. Run: git add . → git commit -m "message" → git push
3. GitHub receives the new code
4. Vercel detects the push → auto-rebuilds frontend (1-2 min)
5. Render detects the push → auto-rebuilds backend (2-3 min)
6. Your live site is updated — no manual deployment needed!
```

---

## Costs

| Service | Cost | Limits |
|---------|------|--------|
| GitHub | Free | Unlimited public repos |
| MongoDB Atlas | Free forever | 512 MB storage, 500 connections |
| Render | Free forever | Sleeps after 15 min inactivity (50s cold start) |
| Vercel | Free forever | 100GB bandwidth/month |

**Total cost: $0/month**

---

## Common Questions

**Q: What happens if Render sleeps?**
A: Free tier spins down after 15 minutes of no requests. First visitor after sleep waits ~50 seconds. Subsequent requests are fast. Paid tier ($7/mo) removes this.

**Q: Where are uploaded files stored?**
A: On Render's server disk (in `/uploads/`). Note: On the free tier, these files are lost when the server redeploys. For permanent file storage, you'd use AWS S3 or Cloudinary.

**Q: Can the database run out of space?**
A: Free tier has 512 MB. Text data is tiny — you'd need thousands of users before hitting this. If needed, upgrade to the Flex tier ($0.011/hr).

**Q: Is my data safe?**
A: MongoDB Atlas has automatic replication (3 copies of your data). Atlas handles backups on paid tiers. On free tier, data is replicated but not backed up.

**Q: Can I add a custom domain (like docconnect.com)?**
A: Yes. Buy a domain ($10-15/year from Namecheap/GoDaddy), then add it in Vercel dashboard → Domains.

---

## Recently Added Features

### Phone Number (Registration + Profile)

- Both doctors and patients provide phone number during registration
- Doctors can update it in Dashboard → Edit Profile
- Stored in User model: `phone` field
- Used for contact between doctor and patient

### WhatsApp Number (Doctor Profile)

- Doctors set their WhatsApp number in Dashboard → Edit Profile → "WhatsApp Number" field
- When set, a green **"Message on WhatsApp"** button appears on their public profile
- Clicking it opens WhatsApp with a pre-filled message: "Hi Doctor, I would like to consult with you."
- URL format: `https://wa.me/919876543210?text=...`

### Floating WhatsApp Emergency Button

- Green WhatsApp icon floating on the bottom-right corner of EVERY page
- Visible to ALL users (even without login)
- Clicking opens WhatsApp to: **+919997019900**
- Pre-filled message: "Hi, I need to consult with a doctor. Can you help me?"
- Purpose: patients in emergency can reach out instantly without going through registration
- Component: `client/src/components/WhatsAppButton.jsx`
- Added to: `client/src/App.jsx` (renders on all pages)

### Meeting Link (Video/Phone Consultations)

- When a patient books a video or phone consultation, the doctor needs a way to share the meeting link
- **Flow:**
  1. Patient books appointment (consultationType: "video" or "phone")
  2. Doctor sees the appointment in Dashboard → clicks "Confirm"
  3. A prompt appears: "Add a meeting link (Google Meet/Zoom) for this appointment?"
  4. Doctor pastes their Google Meet / Zoom link
  5. Link is saved in the appointment: `meetingLink` field
  6. Patient sees a green **"Join Meeting Link"** button in their Dashboard next to the appointment
  7. Clicking opens the meeting in a new tab
- Stored in Appointment model: `meetingLink` field
- If doctor leaves it empty (in-person visit), no button is shown

### Login Page Clarification

- Login page now shows: "Works for both Doctors and Patients — just use the email you registered with"
- The system automatically detects the role from the database after login
- No role selection needed at login — only during registration

---

## Complete File Reference

### Backend (server/)

| File | What it does |
|------|-------------|
| `server.js` | Entry point — connects MongoDB, loads routes, serves uploads, CORS config |
| `models/User.js` | User schema: name, email, password (hashed), role, phone, whatsappNumber, specialization, availability, reset tokens |
| `models/Appointment.js` | Booking schema: patient, doctor, date, timeSlot, status, reason, meetingLink, notes |
| `middleware/auth.js` | JWT verification (protect) + role check (authorize) |
| `middleware/upload.js` | File uploads: images + PDFs, 10MB limit, disk storage |
| `controllers/authController.js` | Register, login, getMe, forgotPassword, resetPassword |
| `controllers/doctorController.js` | getAllDoctors (search/paginate), getDoctorById, updateDoctorProfile |
| `controllers/appointmentController.js` | book, getMyAppointments, getById, updateStatus (with meetingLink), cancel |
| `controllers/availabilityController.js` | setAvailability, getMyAvailability, getFreeSlots (dynamic calculation) |
| `routes/auth.js` | POST /register, /login, /forgot-password; PUT /reset-password/:token; GET /me |
| `routes/doctor.js` | GET / (public browse), GET /:id (public profile), PUT /profile (doctor only) |
| `routes/appointment.js` | POST / (patient books), GET /my, GET /:id, PUT /:id/status, PUT /:id/cancel |
| `routes/availability.js` | GET /:doctorId/slots (public), GET / (doctor own), PUT / (doctor sets) |

### Frontend (client/src/)

| File | What it does |
|------|-------------|
| `main.jsx` | React entry — wraps app in BrowserRouter + AuthProvider |
| `App.jsx` | All routes, ProtectedRoute wrapper, Navbar, Footer, WhatsAppButton, Toaster |
| `context/AuthContext.jsx` | Global auth state, login/logout functions, token persistence, API_BASE_URL |
| `services/api.js` | All API calls: authAPI, doctorAPI, appointmentAPI, availabilityAPI |
| `components/Navbar.jsx` | Top nav — responsive, role-based links, mobile menu |
| `components/WhatsAppButton.jsx` | Floating green button → opens WhatsApp to emergency number |
| `pages/Home.jsx` | Landing: hero, features (search + book), stats, CTA |
| `pages/Login.jsx` | Email+password form, "works for both roles" note, forgot password link |
| `pages/Register.jsx` | Role selector (Doctor/Patient), name, email, phone, password, confirm |
| `pages/ForgotPassword.jsx` | Enter email → server logs reset link |
| `pages/ResetPassword.jsx` | Token from URL → new password → auto-login |
| `pages/DoctorList.jsx` | Search/filter doctors, card grid, pagination |
| `pages/DoctorProfile.jsx` | Full profile, book button, WhatsApp "Message" button |
| `pages/BookAppointment.jsx` | Date picker → dynamic free slots → consultation type → reason → book |
| `pages/Dashboard.jsx` | Tabs: Appointments (both), Edit Profile (doctor), Availability (doctor) |

---

## Live URLs

| What | URL |
|------|-----|
| Frontend (website) | https://docconnect-mocha.vercel.app |
| Backend (API) | https://docconnect-fcg6.onrender.com |
| API Health Check | https://docconnect-fcg6.onrender.com/api/health |
| GitHub Repo | https://github.com/kndnkmr/docconnect |

---

## Known UI Pitfalls (read before touching appointment status messages)

`client/src/pages/Dashboard.jsx` renders each appointment card with TWO
separate status-message areas that easily end up saying the same thing
twice if you're not careful:

1. A payment-specific **yellow box**, gated on `apt.paymentStatus === 'patient_claimed'`.
2. A generic **"Next step guidance" blue box**, gated on combinations of
   `apt.status` + `apt.paymentStatus`, covering every appointment status —
   not just payment.

Both boxes have their own separate `isPatient`/`isDoctor` branches. Because
they sit right next to each other and their conditions overlap, it's easy
to add or edit a message in one without noticing the other already says
something similar for the same role. They're different colors, so the
duplication isn't obvious just by looking at the rendered UI — you have to
actually read both blocks of JSX to catch it.

**History — this has already happened twice:**
- Fixed for **patients** in commit `61e2eda` ("single clear payment message
  for patient") — removed the redundant blue-box line, kept the yellow box
  (enhanced with the receipt-uploaded/not-uploaded detail).
- Fixed for **doctors** later (same underlying duplicate, just never
  applied to the doctor branch the first time) — removed the doctor branch
  from the yellow box entirely, merged the receipt-uploaded detail into the
  blue box's doctor message instead.

**Before adding or editing any message tied to `paymentStatus` (or any
other combined status), search BOTH boxes for the same `isPatient`/
`isDoctor` + status combination first.** If you're adding a new
payment-status message, prefer putting it in the blue box only (it already
exists for every other status), rather than creating a third place for the
same information to potentially duplicate again.

### "End Call for All" doesn't actually close the other person's call view

Reported twice. First time (fixed): the doctor's Daily.co meeting token was
missing `permissions: { canAdmin: true }` (see `server/utils/daily.js` -
`createMeetingToken`), so `frame.updateParticipants({ '*': { eject: true } })`
in `VideoCall.jsx`'s `handleEndCall` had no real permission to eject anyone.

Second time (fixed): even with that permission correct, the other party's
call view stayed open regardless — because `Dashboard.jsx`'s `call-ended`
socket handler only ever cleared the PRE-JOIN ringing banner
(`incomingCall`). It never closed an *already-open* call
(`videoCallAppointmentId`) if the other person had joined before the call
ended. So the fix depended entirely on Daily's own eject mechanism working
end-to-end (client → Daily's servers → the other client), an external
dependency with no fallback.

**The actual fix:** `handleCallEnded` now also closes an already-open
`videoCallAppointmentId` directly, using our own app-level signal (the same
`setCallStatus` → Socket.io `call-ended` event that already reliably drives
ringing elsewhere). This doesn't replace Daily's eject — both now run
independently, so the call reliably closes on both sides even if Daily's
own eject has any hiccup. **If this gets reported a third time:** check
whether a NEW way of ending a call was added somewhere that doesn't go
through `handleCloseCall` → `setCallStatus(id, false)` — that's the one
call that must always fire for the other party's `call-ended` handler to
have anything to react to.

---

## How to Make Changes (Future You)

1. Open this project in Kiro (or any editor)
2. Edit the code
3. Test locally if possible (or just push and check live site)
4. Run:
   ```bash
   git add .
   git commit -m "description of change"
   git push
   ```
5. Wait 1-2 min → both Vercel and Render auto-redeploy
6. Check live site to verify

---

## Quick Reminder: Accounts You Created

| Service | Login URL | What for |
|---------|-----------|----------|
| GitHub | github.com | Code repository |
| MongoDB Atlas | cloud.mongodb.com | Database |
| Render | dashboard.render.com | Backend hosting |
| Vercel | vercel.com | Frontend hosting |

All use your Google/GitHub account for login — no separate passwords to remember.

