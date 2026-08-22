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

- Green WhatsApp icon floating on the bottom-right corner
- **Shown to GUESTS only** — hidden the moment a user logs in (patient or
  doctor). The component checks `isAuthenticated` from `useAuth()` and
  returns `null` when logged in. Previously it only hid on `/dashboard`,
  which was inconsistent (a logged-in patient still saw it on the doctor
  list, profiles, home, etc.)
- Rationale: the button exists to help not-yet-registered visitors reach
  us (find a doctor, book, general help). Logged-in users already have
  proper in-app channels — chat with their doctor, the booking flow, and
  the footer Grievance/Support link — so for them the floating button was
  just clutter, worst on mobile where it overlaps content
- Number is configurable via `VITE_WHATSAPP_NUMBER` (falls back to
  `919997019900`); clicking opens WhatsApp with a pre-filled help message
- Component: `client/src/components/WhatsAppButton.jsx`
- Rendered once in `client/src/App.jsx` (the auth check lives in the
  component, so App just always renders it)

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

### Patient Medical Information

- Optional fields on `User` (patient-only): `bloodGroup`, `allergies`,
  `currentMedications`, `medicalHistory`, `emergencyContactName`,
  `emergencyContactPhone`, `insuranceProvider`, `insurancePolicyNumber`
- Set once in Dashboard → Account Settings via `PUT /api/auth/medical-info`
  (`authController.updateMedicalInfo`, patient-role-gated), reused for
  every appointment they book — deliberately NOT copied/snapshotted onto
  the Appointment itself, so the doctor always sees the current version
  rather than a possibly-stale one from whenever they booked
- Shown to the doctor on the appointment card: allergies always visible
  (safety-critical), the rest behind a "More medical info" `<details>`
  expander (`Dashboard.jsx`) — requires the field to actually be included
  in the `.populate('patient', ...)` select list wherever a doctor views
  an appointment; if you add a new medical-info field, it needs adding to
  ALL of appointmentController.js's doctor-facing populate calls, not just
  one, or it'll silently not show up depending on which endpoint served
  the page
- Also surfaced as a reminder on `BookAppointment.jsx` itself (only for
  booking-for-self, never for a family member — it's the account holder's
  own info) — either a confirmation of what's on file, or a nudge to add
  it, so a doctor isn't relying on the patient having found Account
  Settings on their own before the first visit

### Structured Symptom Tags

- Optional `symptoms: [String]` field on `Appointment`, supplementing
  (not replacing) the existing free-text `reason` field
- Quick-pick tag buttons on the booking form from a fixed common-symptoms
  list — sanitized server-side in `bookAppointment()` (array only, string
  values only, capped at 20 tags / 50 chars each) since this reaches the
  database with no prior validation
- Shown as small tags on the appointment card, both roles

### Admin Complaints View

- The server (`getAllComplaints`, `updateComplaint`) and client API
  wrapper (`complaintAPI.getAll/.update`) existed for a while before the
  admin panel actually had a tab that called them — patients could file
  complaints with literally no way for admin to see or act on them
- `AdminDashboard.jsx` Complaints tab: filter by status, "Respond"
  (prompts for a response, marks resolved), "Mark In Progress", "Close"
- Responding notifies the patient instantly via Socket.io + Web Push
  (`notifyComplaintUpdate` in `complaintController.js`) — patient's
  Complaints tab (`PatientComplaints.jsx`) listens for `complaint-updated`
- A complaint can optionally be tagged to a specific doctor/appointment
  (selectors on `PatientComplaints.jsx`'s form) — validated server-side:
  an `appointmentId` must actually belong to this patient, and if a
  `doctorId` is also given it must match that appointment's doctor

### Doctor WhatsApp Button + UPI ID Fallback (bug fix)

- `whatsappNumber` and `upiId` had schema fields, controller support, and
  were even documented above as built features, but had NO input in the
  actual Edit Profile form (Dashboard.jsx) — they could never actually be
  set. The "Message on WhatsApp" button on the public profile
  (`DoctorProfile.jsx`) didn't exist in the code at all either
- Fixed: both fields added to the Edit Profile form, the WhatsApp button
  built on the public profile (uses `doctor.whatsappNumber`, separate from
  the generic "Share via WhatsApp" button which shares the profile link,
  not a message to the doctor), and UPI ID shown as a text fallback next
  to the payment QR code for when a patient can't scan it

### Medical Report ↔ Appointment Linking (bug fix)

- The report-upload form (`PatientReports.jsx`) never sent an
  `appointmentId`, even though `MedicalReport.appointment` exists and a
  doctor-side "patient uploaded a report" next-step hint on the
  appointment card depends on exactly that link — every report was always
  unlinked, so that hint could never fire in practice
- Fixed: added a "which visit is this for?" selector (optional — defaults
  to a general/unlinked upload, same as before). Since this path was
  previously dormant it had no ownership validation at all — added
  server-side checks in `uploadReport()` that the given appointment
  actually belongs to this patient and doctor before linking it

### Reset for Re-registration (admin tool)

- Recurring real need: letting someone re-register fresh with the same
  phone/email (e.g. a doctor's profile needs to be redone from scratch)
  had no non-destructive tool — permanent Delete was the only thing that
  reliably freed up the contact info, but it cascade-deletes all their
  appointments too
- Extended the existing `freeUpContactInfo` (previously only usable on
  already-deleted accounts, for duplicate-account cleanup — see below) to
  also work on ACTIVE accounts: renames the phone/email out of the way
  AND deactivates the account (`isSuspended: true`) in the same step,
  since an active account with its contact info pulled out from under it
  would otherwise be a confusing half-state
- "Reset for Re-registration" button in the admin Users table, available
  for any non-admin user, active or already-deleted
- All appointment/prescription/report history stays completely intact —
  the person just needs to register again as a brand new account with
  the same real phone/email

### Email Verification "Expired" Bug (bug fix)

- Root cause: the verification token was cleared from the database the
  instant it was successfully used. Many email clients and corporate
  email security gateways (Outlook Safe Links, phishing/spam scanners)
  automatically pre-visit links in an email to scan them BEFORE the user
  ever sees it — that automated visit consumed the token, so the doctor's
  real click moments later found no matching token and saw "expired",
  even though nothing had actually timed out
- Fixed in `verifyEmail()`: don't clear the token on success; check
  `isVerified` before checking expiry. A repeat visit to an already-used
  link (scanner pre-visit, double click, etc.) now returns a friendly
  "already verified" success instead of an error. A genuinely expired,
  never-used link still correctly shows the expired message

### Reports/Prescriptions Pagination + Search

- `GET /api/reports/my` and `/api/prescriptions/my` previously had no
  pagination at all — fetched every record a doctor had ever received or
  written, unbounded, then filtered client-side. Fine at small scale, a
  real problem as a practice grows
- Both now support `?page=`, `?limit=`, `?search=` (matches the other
  party's name/phone/Patient ID) — `getPagination`/`safeContainsRegex`
  from `queryHelpers.js`, same pattern as appointments
- A param-less call (still what the patient's own "My Reports"/"My
  Prescriptions" views use, and what `Dashboard.jsx`'s
  `doctorReports`/`doctorPrescriptions` cross-reference fetch for the
  Appointments tab's next-step hints uses) defaults to `limit=100` — so
  nothing changes for any realistic personal history, it's just bounded
  now instead of truly unbounded
- The doctor's browsable Prescriptions/Patient Reports tabs use their OWN
  independent paginated+searched fetch, deliberately kept separate from
  that cross-reference data — paginating the shared data would make the
  Appointments tab's hints silently miss anything outside the loaded page

### Appointments Status + Date Filtering

- The Appointments tab (both roles) has status filter tabs (All/Pending/
  Confirmed/Completed/Cancelled) and date filters — quick Today/Tomorrow/
  This Week/Next Week buttons plus a specific-date picker for anything
  else. Deliberately not a full custom calendar-grid widget — quick
  relative buttons + an exact-date picker covers the real need with much
  less UI surface area to get right
- Server: `GET /api/appointments/my` accepts optional `dateFrom`/`dateTo`
  (YYYY-MM-DD, inclusive both ends) alongside the existing `status`/
  `search` params — all combine with AND, not OR
- "This Week"/"Next Week" use Monday-Sunday calendar weeks computed in IST
  (`getWhenDateRange` in Dashboard.jsx) — "This Week" runs from today
  through this Sunday (not from Monday), since past days of the current
  week aren't useful in a forward-looking filter. On a Sunday, "This Week"
  collapses to just today — that's expected behavior of any Mon-Sun week
  definition, not a bug, if it ever looks surprising
- **Bug fixed in the same pass:** the search/status-filter UI across
  Appointments, Patient Reports, and the doctor's Prescriptions tab was
  hidden behind a "more than 5 total records" threshold. This made the
  features effectively undiscoverable for anyone testing with a small
  number of records - removed the threshold, all three are now always
  visible
- **Also fixed:** the "new appointment request" banner counted pending
  appointments from whatever was on the currently loaded page only,
  undercounting once a doctor had more than a page's worth. Now fetches
  the true total via a cheap `limit=1` call that just reads
  `pagination.totalAppointments`

### Production Security Configuration (not in code, but important context)

These are Atlas/Render dashboard settings, not application code, so
there's nothing to grep for — recorded here so the reasoning isn't lost:

- **Atlas org requires MFA** for anyone logging into the Atlas web console
- **Network Access** is restricted to Render's actual outbound IP ranges
  for this service (found via Render → service → Connect → Outbound tab)
  plus one personal IP — previously `0.0.0.0/0` ("allow from anywhere"),
  which meant the database credential alone was the only thing standing
  between the internet and the data. Render's outbound ranges are shared
  with other Render customers in the same region, not unique to this
  workspace — a real improvement over "anyone," not as tight as a
  dedicated IP (Render offers that as a paid add-on if ever needed)
- **Database user is scoped to `readWrite` on the app's own database** -
  it was previously `atlasAdmin` (full project admin rights), which is far
  more than a web app connection should ever have. If you ever need to
  create a new database user or change this one, scope it the same way
  and never assign an admin-level role to an application's own connection
  credential
- **No backups exist** - confirmed this is Atlas's free M0 tier, which
  has zero backup capability regardless of settings. This is a conscious,
  deferred risk, not an oversight - revisit once there's real paying
  usage. In the meantime, the non-destructive admin tools (Deactivate,
  "Reset for Re-registration") cover the most likely accident scenario
  without needing a database backup at all; they just don't help against
  a bug in a future code change or a manual mistake made directly in
  Atlas's Data Explorer

### Privacy Policy Accuracy (maintenance reminder)

Found genuinely out of sync with the actual code during a review: it said
video calls used "Jitsi Meet" (the app switched to Daily.co a while ago)
and that account deletion "permanently removes all data within 30 days"
(the real policy is a 90-day grace period then anonymization only —
appointment/prescription/report records are deliberately retained, not
deleted). Both fixed in `client/src/pages/PrivacyPolicy.jsx`.
**If you ever change**: the video calling provider, the account deletion/
retention window, or add a new category of data collected from patients —
check `PrivacyPolicy.jsx` at the same time. It's easy for this page to
drift out of sync since nothing enforces it staying accurate.

### Bilingual Patient Experience (English / हिंदी)

- A language toggle appears on the home page (prominently in the hero, not
  the navbar) and the booking flow. The choice is stored in localStorage
  (`promedicoz_lang`) so it carries across pages and visits.
- Implementation is a per-page string dictionary (`TXT` in `Home.jsx`,
  `BOOKING_TXT` in `BookAppointment.jsx`) keyed by language — deliberately
  lightweight, no i18n framework. The shared choice is just the localStorage
  key; each page owns its own strings.
- Home symptom cards are ALWAYS bilingual (English + Hindi together) — the
  point is a Hindi-speaking patient can tap the right card instead of typing
  English. Booking symptom chips display in the chosen language but STORE the
  English value, so the doctor always sees English.
- **Deliberately English:** brand name, Login/Register, and anything a doctor
  types (profiles, specializations, prescriptions). Medical content is never
  machine-translated — a mistranslated drug/condition is dangerous. Only fixed
  UI labels get curated Hindi. The Hindi copy should be proofread by a native
  speaker before being treated as final.
- Scope so far: Phase 1 (home) + Phase 2 (booking flow). The patient dashboard
  is still English (a possible Phase 3).

### Local SEO City Pages

- `/specialization/:slug` (e.g. dermatologist) and
  `/specialization/:slug/:city` (e.g. dermatologist/rishikesh, "Best
  Dermatologists in Rishikesh") — same `SpecializationPage.jsx`, city-aware.
- The city links shown come from `GET /api/doctors/cities`, which returns only
  cities that ACTUALLY have active doctors. This is intentional: linking/
  generating empty city pages creates "doorway pages" that search engines
  penalize. City pages are discovered by crawling the internal links on the
  base specialization page.
- City page adds a BreadcrumbList JSON-LD (Home > Specialization > City).
- Note: this is a client-rendered SPA, so these pages rely on Google rendering
  JS (it does, but SSR would be more reliable). The pages existing does not
  equal ranking — it's the foundation; real ranking needs content, time, and
  links.

### Doctor Onboarding Tracking + Reminder

- Admin Users table shows each doctor's setup completeness inline
  ("Setup complete" or red "Needs Email / Availability / Profile" badges),
  computed by the same rule on client and server (`getDoctorMissingSteps`).
- `POST /api/admin/users/:id/setup-reminder` emails an incomplete doctor the
  specific steps still pending. Admin-triggered (a "📧 Remind" button), not an
  automated recurring job — right-sized for a small roster.
- **Manual click-to-WhatsApp reminder** (a "📱 WhatsApp" button next to
  "📧 Remind"): this is FRONTEND-ONLY — no endpoint, no paid WhatsApp
  Business API, no automated sending. `handleWhatsAppReminder` in
  `AdminDashboard.jsx` strips the stored phone (`+91XXXXXXXXXX`) to digits,
  builds a profile-aware English message from the SAME `getDoctorMissingSteps`
  the email uses (names exactly what's missing — verify email + check spam /
  complete profile / add availability — plus a dashboard link), and opens
  `wa.me/<digits>?text=<message>` in a new tab. The admin reviews and presses
  send, so it stays personal and free.
- Why WhatsApp matters here: it reaches phone-only doctors the email can't,
  and sidesteps the new-domain email-spam problem (the verification/reminder
  email often lands in spam). Shown only when there are pending steps AND a
  phone number is on file.
- **Admin email-verification bypass** (`POST /api/admin/users/:id/verify-email`,
  `markEmailVerified` → sets `isVerified: true`, clears the token): when a
  doctor's verification email is stuck in their spam folder, the admin can mark
  their email verified directly from the Users table ("✅ Verify Email" button),
  making them live for patients without waiting on the email. This is
  DISTINCT from the "✅ Verify" admin trust badge
  (`PUT /api/admin/users/:id/verify`, `setDoctorVerification` → `isAdminVerified`):
  one clears the email gate that controls public visibility
  (`getAllDoctors` filters `isVerified: { $ne: false }`), the other is the
  "Verified by ProMedicoz" credential badge. Two different fields, two
  different buttons, easy to confuse.

### Doctor List Ranking (profile quality, not registration date)

**The problem it fixed:** the public doctor list used to sort by
`createdAt: -1` (newest registration first). So a brand-new doctor who
hadn't filled in specialization, fee, photo, or availability appeared
ABOVE established doctors with complete profiles and real reviews — the
opposite of what patients want, and bad competitively.

**How it ranks now** (`computeProfileScore` + `sortByQuality` in
`doctorController.js`) — a simple, explainable score (no black-box ML):
1. **Completeness (dominant factor, ~60 pts):** specialization, fee > 0,
   availability set (bookable at all), photo, qualification, experience > 0,
   bio, city — each worth points.
2. **Rating (~25 pts):** real average, weighted by review count so one
   5-star review can't outrank many 4-star ones (confidence ramps 0→1 over
   the first ~5 reviews).
3. **Admin-verified trust badge (8 pts).**
4. **Experience (mild tiebreaker, ~5 pts, capped)** — a very senior doctor
   with an empty profile still can't beat a complete one.
5. **Newest registration** — used ONLY as the FINAL tiebreaker, so a
   new-but-complete doctor still surfaces among equally-complete peers but
   never jumps ahead of a more complete/higher-rated profile just for being
   new.

**Why it fetches all candidates then paginates in memory:** the score
depends on each doctor's rating, so the whole matching set has to be scored
BEFORE a page can be sliced (DB-level `skip`/`limit` would only sort within
one page). `getAllDoctors` now fetches all candidates, attaches ratings,
ranks, then slices the page — and attaches the more expensive
`nextAvailable` compute to just the returned page. Doctor counts are modest
(tens, not thousands), so this is fine; it's the same approach the
"available today" path already used.

**A subtle gotcha that's easy to reintroduce:** `attachNextAvailable`
returns FRESH plain objects via `.toObject()`, which drops any `rating`
that was attached to the Mongoose docs beforehand. So ratings must be
(re)attached to whatever objects actually get scored/returned — both paths
do this explicitly. If you refactor this and ratings suddenly all read as
0 in the sort, this is why.

**Verified** with an in-memory DB test: a complete admin-verified doctor
ranked first, a partial one in the middle, and an empty newest-registered
profile last (previously first). Confirmed live on production too — the
three incomplete profiles moved to the bottom.

### The phone-only registration 500 (and the verification lesson)

**Symptom:** patients registering WITHOUT an email (phone-only, the common
Indian path) got "server error". The first phone-only patient worked; every
one after failed.

**Root cause:** `User.email` is meant to be unique + sparse, but (a) the schema
stored a missing email as `''` (empty string) via `default: ''`, and (b) the
LIVE database still had an old email index that was unique but NOT sparse. A
sparse index only exempts fields that are truly ABSENT — an empty string is a
real value — so every phone-only patient shared the same `''` email and
collided (E11000), surfacing as a generic 500. Same sparse-index bug class as
`patientId` earlier.

**Fix (two parts, both required):**
1. `User.email` default is now `undefined` (field absent when not provided).
2. `utils/fixIndexes.js` — a guarded, idempotent startup migration that drops
   the old non-sparse email index, unsets any `''`/null emails, and rebuilds
   the index as sparse unique. Runs after DB connect in `server.js`; no-op once
   the index is already sparse.
Also: the register error handler now returns a clean 400 for validation
(e.g. short password) and duplicate-key errors instead of a scary 500.

**The lesson (important for future changes):** the bug slipped through because
verification used a throwaway in-memory database, which builds FRESH indexes
from the current schema — it literally cannot reproduce a mismatch with the
existing production index/data. For any change to schemas, indexes, auth, or
registration/login, verify against the **live production API** as well (a full
register → login → book smoke test), and reason explicitly about the existing
production data state, not just the code.

### Production Smoke Test (run after risky changes)

A fast way to confirm the critical flows work on live, using curl against the
Render backend (`https://docconnect-fcg6.onrender.com/api`):
1. `GET /health` → `"database":"Connected"`
2. Register a patient (phone-only) → expect `201` + `patientId`
3. Login (by phone), `GET /auth/me` → role patient
4. Patient reads: `GET /appointments/my`, `/prescriptions/my`, `/reports/my`,
   `/complaints/my` → all `200`
5. Register a doctor (email), login, same reads → `200`
6. Public: `GET /doctors`, `/doctors/cities` → `200` with data
7. Guards: `GET /appointments/my` with no token → `401`
8. Full booking: doctor `PUT /availability` → patient `GET
   /availability/:docId/slots?date=` → patient `POST /appointments` → confirm
   it appears in BOTH parties' `/appointments/my`
Clean up any throwaway test accounts afterward via the admin Users tab.

### Login Page Clarification

- Login page now shows: "Works for both Doctors and Patients — just use the email you registered with"
- The system automatically detects the role from the database after login
- No role selection needed at login — only during registration
- **Duplicate-logo fix:** Login and Register each used to render their own
  `🏥 ProMedicoz` brand block right below the navbar's brand, so it appeared
  twice and looked unpolished. Removed the in-page brand block on both pages,
  keeping just the page heading ("Welcome Back" / "Create Account"). The
  navbar already shows the brand on every page. Forgot/Reset/Verify pages
  never had this duplication.

### Patient ID

- Every patient gets a short, human-readable id like `PT000123` (a MongoDB
  ObjectId isn't practical to read over a phone call or search by) —
  assigned automatically at registration
- Implementation: `server/models/Counter.js` is an atomic sequence
  generator (MongoDB has no native auto-increment), `patientId` field on
  `User` (unique + sparse — see the pitfall below), assigned in
  `authController.register()`
- Shown to the patient in Dashboard → Account Settings, and to the doctor
  on each appointment card / the Patient Reports list, so it doubles as a
  quick identifier to search by
- **Existing patients** (registered before this feature existed) don't
  have one yet — an admin needs to trigger the one-time backfill ONCE:
  `POST /api/admin/backfill-patient-ids` (admin JWT required, e.g. via
  browser devtools console while logged into `/admin`:
  `fetch('/api/admin/backfill-patient-ids', { method: 'POST', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })`).
  Idempotent — safe to run more than once.
- **Pitfall if you touch this field:** the schema uses `default: undefined`,
  not `default: null`. A sparse index only exempts a field that's
  completely *absent* from the document — an explicit `null` still counts
  as a value, so every doctor/admin (who have no Patient ID) would collide
  on the same `null` and violate the unique constraint. This was caught by
  testing against a real database, not just a build — see
  `verificationToken`/`resetPasswordToken` just above `patientId` in
  `User.js` for the same pattern already in use.

### Search (Doctor's Appointments / Reports / Prescriptions)

- Before this, a doctor's only way to browse their appointments was
  10-per-page pagination with no way to jump to a specific one — as the
  patient list grows, a specific confirmed appointment (e.g. the one you
  need to click "Mark Complete" on) can end up several pages in with no
  way to find it. This is also the likely explanation if "Mark Complete"
  ever seems to have disappeared — it's still there, just possibly on
  another page. Check the search box first before assuming it's a bug.
- `GET /api/appointments/my?search=...` matches the OTHER party's
  name/phone (and a patient's Patient ID), resolved to user ids BEFORE the
  existing sort/pagination pipeline runs (`appointmentController.js`)
- Search box appears in the Appointments tab (both roles) once there's
  more than 5 appointments
- Patient Reports tab (doctor) and the new Prescriptions tab (doctor) use
  a simpler client-side filter instead, since those lists aren't paginated
  server-side
- The doctor's "Prescriptions" tab is new — previously there was no way
  to browse prescriptions at all except through the per-appointment
  Write/Update Prescription button. It reuses the same
  `doctorPrescriptions` data already fetched for the appointment card's
  next-step hint, so it added no new API calls.

### Doctor Languages Spoken + Patient Language Filter

- New `User.languagesSpoken: [String]` (default `[]`). Deliberately NOT an
  enum — the master language list lives in the frontend
  (`client/src/utils/languages.js`, `LANGUAGES` + `SPOKEN_LANGUAGE_OPTIONS`)
  so adding a language needs no schema/migration and we never reject a
  language a doctor legitimately speaks. Doctors pick from checkboxes in Edit
  Profile; it shows as "Speaks: …" on the card (`DoctorList`) and profile
  (`DoctorProfile`).
- Search filter: `GET /api/doctors?language=Bengali` uses `$elemMatch` with an
  anchored, escaped, case-insensitive regex so "bengali" matches a stored
  "Bengali" but "Beng" does NOT partial-match. We store the English name (so
  data stays searchable/consistent) but display "English (native script)".
- This is a spoken-language attribute the doctor selects — NOT a translation
  of anything they type. Prescriptions/notes stay English.
- One-time admin backfill `POST /api/admin/backfill-doctor-languages`
  (`backfillDoctorLanguages`) seeds `['Hindi','English']` on doctors whose
  field is empty/missing, since the field didn't exist when they registered.
  Idempotent (a second run updates 0), never overwrites a doctor who chose
  their own, ignores patients. Verified with an in-memory DB test.

### "Get the App" — install + share (`/install`)

- **Why:** the navbar's quick-install button relies on the `beforeinstallprompt`
  event, which only fires on Chrome/Android. On iOS/Safari it NEVER fires, so
  iPhone users had no way to install and no guidance. There was also no way to
  share the app.
- `InstallApp.jsx`: reuses `beforeinstallprompt` for a one-tap Android/Chrome
  install; gives explicit "Add to Home Screen" steps for iPhone/Safari (the
  only possible path on iOS — Apple allows no install button); a Share section
  using `navigator.share` (same API as prescription sharing) with a WhatsApp
  share + copy-link fallback; and a QR code via `qrcode.react` rendered
  client-side as SVG (no third-party QR service, no data leaves the app).
- Discoverable in three spots: navbar "📲 Get App" link (guests, desktop +
  mobile), a compact bilingual Home-page strip, and a role-neutral footer pill.
  The old standalone Chrome-only "Install" button was removed from the guest
  navbar to avoid duplicating the new link.
- `qrcode.react@4.2.0` is the only new dependency; it adds nothing to `npm
  audit` (the pre-existing warnings are unrelated transitive deps).

### Pre-signup info pages + legal pages

- `/for-doctors` and `/how-it-works` answer "how does payment work / how do
  patients join?" BEFORE signup (a doctor actually asked). Content is grounded
  in the real flow verified in `Dashboard.jsx` (statuses pending/confirmed/
  completed/cancelled; paymentStatus pending/patient_claimed/paid; direct UPI
  patient→doctor, no commission). `/how-it-works` is bilingual (EN/हिंदी) via
  the same per-page dictionary + shared `promedicoz_lang` pattern as Home.
- Legal set: `MedicalDisclaimer.jsx`, `CancellationRefund.jsx`, `AboutUs.jsx`
  (plus the existing Terms/Privacy). The Cancellation & Refund page states the
  factual truth: ProMedicoz holds no money and takes no commission, so refunds
  are strictly between patient and doctor.

### Global scroll-to-top on route change

- `components/ScrollToTop.jsx` (mounted once in `App`) resets scroll to the top
  whenever the URL pathname changes. SPA route changes don't reset scroll
  natively, so a page opened from a link at the bottom of another page used to
  open scrolled to the bottom. Keyed on pathname only, so in-page tab switches
  (Dashboard) and pagination (DoctorList) that scroll within the same route are
  unaffected.

### UI consistency: gradient header bands + sticky-footer gap fix

- Home, Doctors, Doctor Profile, Blog, and the legal pages now share one
  primary gradient header band with the content card overlapping it — one
  visual language across the public site.
- Sticky-footer gap fix: `main` had `pb-16` (mobile bottom-nav clearance) that
  rendered as a large pale box between a page's last section and the dark
  footer on mobile. Moved that clearance onto the footer (`pb-24 md:pb-6`), and
  pages ending in a colored band let that band `flex-grow` to meet the footer.

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

