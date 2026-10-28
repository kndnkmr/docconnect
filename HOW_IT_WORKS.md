# How ProMedicoz Works — Full Technical Documentation

> Note: this project's repo/older docs use the name "DocConnect"; the live product is **ProMedicoz**. They refer to the same app.

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
│ docconnect-mocha         │     │ docconnect-sg            │     │ docconnect cluster       │
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
| Vercel | `VITE_API_URL` | `https://docconnect-sg.onrender.com/api` | Frontend knows where to send API requests |
| Render | `MONGODB_URI` | `mongodb+srv://...@docconnect.mongodb.net/docconnect` | Backend knows where the database is |
| Render | `JWT_SECRET` | *(a long random string — set only in the Render dashboard, never written in docs)* | Secret key for signing login tokens |
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
  "paymentStatus": "pending",          // pending | patient_claimed | paid
  "paymentScreenshot": "",             // receipt the patient uploaded
  "paymentUTR": "",                    // 12-digit UPI reference the patient typed
  "paymentClaimedAt": null,            // when the patient said "I've paid"
  "paymentMarkedBy": null,             // who marked paid / reset (doctor or admin)
  "isFollowUp": false,                 // free follow-up (one per original visit)
  "originalAppointment": null,         // repeat / follow-up link
  "consentBy": "patient",              // or "admin" (booked via Help patient)
  "confirmReminderSentAt": null,       // automatic reminders, once each
  "payReminderSentAt": null,
  "createdAt": "2024-08-03T11:00:00.000Z"
}
```

**Double-booking guard:** a unique partial index `unique_active_slot` on `{ doctor, date, timeSlot }` lets the database itself refuse a second ACTIVE booking for the same slot, even if two patients tap Book at the same instant. Its filter is `status > 'cancelled'`, which works because the statuses sort alphabetically as cancelled < completed < confirmed < pending. **If a new status is ever added, re-check that ordering.** (The first version used `$ne`, which MongoDB doesn't allow in a partial index, so it was silently never created.) The server checks and builds it on every start (`utils/fixIndexes.js`), and Admin → Overview shows "🛡 Double-booking guard: ✓ On".

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
        POST https://docconnect-sg.onrender.com/api/auth/register
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
        PUT https://docconnect-sg.onrender.com/api/doctors/profile
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
   - Does the user still exist, and is it not deleted or suspended?
     (a deleted/suspended account is refused at once, even with a token
     issued before — it doesn't have to wait out the 30 days)
5. If a request gets 401 while logged in, the app shows ONE banner:
   "Please log in again — your work on this page is saved" and returns
   the person to the same page after login (components/SessionExpired.jsx).
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

### `JWT_SECRET` — keep it secret, rotate if it leaks

- **Why it matters:** whoever knows `JWT_SECRET` can create a valid token for ANY account (admin included) without a password. Account ids aren't secret (doctor ids appear in public URLs), so this secret is the only thing standing in the way.
- **History:** an early version of this file contained the real value, so it is in the public git history. It was **rotated on Render in Oct 2026** and verified: a token signed with the old value is now rejected ("invalid token"). Never put the real value in any file, commit, chat or screenshot; use a placeholder in docs.
- **How to rotate** (if it ever leaks again):
  1. Make a new one: `openssl rand -hex 32` (Mac/Linux Terminal).
  2. Render → backend service → **Environment** → edit `JWT_SECRET` → paste → **Save and deploy**.
  3. Wait for **Live**, then log in again.
- **Effect:** every existing login stops working, so everyone logs in once more (passwords don't change). Appointments, payments, prescriptions and push notifications are unaffected; open forms come back after login (drafts are kept on the device).

### Role-based access:

```
Patient can:     register, login, browse doctors, book, cancel/reschedule own appointments, pay
Doctor can:      register, login, update profile, set availability, confirm/complete appointments,
                 mark payment, write prescriptions, block a patient
Admin can:       everything in the Admin panel: users, appointments, Help patient, Payment help,
                 Needs help, confirm on a doctor's behalf (admin accounts are never created via
                 public registration — only via the ADMIN_EMAIL bootstrap)
Nobody can:      access other users' data, change roles, bypass authentication
```

---

## What Happens When You Push New Code

```
1. You edit code in Kiro
2. Run: git add . → git commit -m "message" → git push
3. GitHub receives the new code
4. Vercel detects the push → auto-rebuilds frontend (1-2 min):
   a. `npm test` — the client safety tests run FIRST. If any fails, the build
      stops and the old site stays live (nothing broken is deployed)
   b. prebuild: generate blog metadata + copy the photo-reader files
   c. vite build
   d. postbuild: prerender ~840 static pages, sitemap, llms.txt, IndexNow ping
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
- **Backend region: Render Singapore** (`docconnect-sg`, moved from Oregon
  in Oct 2026). The database is in Atlas Mumbai and users are in India;
  from Oregon every database lookup crossed the Pacific (~0.25 s each), so
  the doctor list took ~1.5 s. From Singapore it's ~0.4 s (cities 0.54 →
  0.2 s). Render can't change a service's region: the move was a new
  service with the same settings + env vars (JWT_SECRET and VAPID keys
  copied exactly, so logins and call alerts carried over), then Vercel's
  `VITE_API_URL` → `https://docconnect-sg.onrender.com/api` + redeploy.
  `VITE_API_URL` must be type **Config**, not Secret (Vercel refuses
  secret `VITE_` vars; they're public in the built JS anyway).
- **Network Access** is restricted to Render's actual outbound IP ranges
  for the backend service (Render → service → Connect → Outbound tab) plus
  one personal IP. **Any new/moved Render service needs its Outbound ranges
  added here**, or it stays "database: Disconnected" (the server now
  retries every 30 s, so no restart is needed once they're added).
  Current Singapore entries: `74.220.52.0/24`, `74.220.60.0/24` (comment
  "Render Singapore"); the two "Render outbound range" entries
  (`74.220.48.0/24`, `74.220.56.0/24`) belonged to the retired Oregon
  service and can be removed once it's deleted. Previously `0.0.0.0/0` ("allow from anywhere"),
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
- Implementation is a per-page string dictionary (`TXT`/`BOOKING_TXT`/
  `PATIENT_TXT`) keyed by language — deliberately lightweight, no i18n
  framework. The shared choice is just the localStorage key; each page owns
  its own strings. Pages that aren't the "entry" toggle simply READ the stored
  choice with `const [lang] = useState(() => localStorage.getItem('promedicoz_lang') || 'en')`
  and don't render their own toggle.
- Home symptom cards are ALWAYS bilingual (English + Hindi together) — the
  point is a Hindi-speaking patient can tap the right card instead of typing
  English. Booking symptom chips display in the chosen language but STORE the
  English value, so the doctor always sees English.
- **Deliberately English:** brand name, Login/Register, and anything a doctor
  types (profiles, specializations, prescriptions). Medical content is never
  machine-translated — a mistranslated drug/condition is dangerous. Only fixed
  UI labels get curated Hindi. The Hindi copy should be proofread by a native
  speaker before being treated as final.
- **Scope (current):** the whole patient discovery→booking journey is
  bilingual — `Home.jsx`, `DoctorList.jsx` (Find a Doctor: header, all search
  fields/placeholders, filters, empty state, pagination, and the `DoctorCard`
  labels via a `t` prop), `DoctorProfile.jsx` (badges, buttons, section
  headings, reviews), `BookAppointment.jsx`, `BookingConfirmation.jsx`,
  `HowItWorks.jsx`, and `InstallApp.jsx` (install steps + share + the share
  message itself). Doctor-entered content on those pages (names,
  specializations, bios, addresses, review text) is shown as-is.
- **Patient dashboard — PARTIAL Hindi (important nuance):** `Dashboard.jsx`
  is a SHARED component (same file for doctors and patients). Translating it
  wholesale would wrongly flip the doctor UI to Hindi. So it uses a
  patient-only layer: `const pt = PATIENT_TXT[isPatient && _lang === 'hi' ? 'hi' : 'en']`
  — Hindi ONLY when the viewer is a patient who chose Hindi; `pt` falls back to
  English for doctors. Only high-value patient labels are translated so far
  (welcome header/subtitle, patient-visible tab labels, "+ Book New
  Appointment"). The denser appointment-card status/next-step guidance text is
  intentionally left English for now — deliberately partial. If you extend it,
  keep the `pt`-only guard so you never translate a doctor-facing branch.

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
Render backend (`https://docconnect-sg.onrender.com/api`):
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

### Social sharing + link previews

- **Link previews (Open Graph):** the OG + `twitter:summary_large_image` tags
  live in the STATIC `index.html` (and mirrored in `SEO.jsx`) because social
  scrapers usually don't run JS — JS-injected tags aren't seen. They point at
  a real 1200×630 `client/public/og-image.png`. **Gotcha:** the file must
  actually exist — a missing `/og-image.png` still returns 200 via the SPA
  HTML fallback, so a broken image looks "present". Facebook caches previews,
  so after changes you must re-scrape once in Facebook's Sharing Debugger.
- **Images are generated from SVG via `rsvg-convert`** (SVG sources kept next
  to the PNGs in `client/public/` and `client/public/social/`). `rsvg` can't
  render color emoji — use drawn shapes (e.g. the medical-cross logo tile),
  not emoji, in these SVGs. Sizes: `og-image` 1200×630 (feed/link),
  `social/story` 1080×1920 (Stories), `social/square` + post graphics 1080×1080.
- **Share UI (`InstallApp.jsx`):** native `navigator.share`, per-platform
  links (WhatsApp/Facebook/Telegram/X/LinkedIn/Email — Facebook's sharer only
  takes the URL, so its card comes from the OG tags), copy-link, and a
  copy-caption button (uploading an image to a story carries no text, so the
  caption is copied separately). Bilingual.
- `qrcode.react` renders the QR client-side as SVG (no third-party call).

### Free phone reach (no paid SMS/WhatsApp API)

- **Web Push** already delivers booking/confirm/message/call alerts to phones
  automatically and free (works for phone-only users). The only gate is opt-in,
  so the enable-prompt in `Dashboard.jsx` was made prominent + benefit-driven +
  role-aware to lift adoption. This is the primary, automatic phone channel.
- **Doctor click-to-WhatsApp on a confirmed appointment:** a secondary,
  clearly-optional outline button ("📱 Also message on WhatsApp (optional)")
  that opens `wa.me` to the patient's phone with a pre-filled confirmation. The
  DOCTOR taps send — manual, free, no API, no ban risk. Deliberately styled as
  secondary (not solid) with an explicit tooltip so doctors don't think it's a
  required second confirmation step (the real confirm is the in-app button).
- Why not automated SMS/WhatsApp: automated WhatsApp needs the paid WhatsApp
  Business API (Meta verification + approved templates) or a DLT-registered SMS
  gateway (MSG91/Fast2SMS) — both cost money and setup, deferred until volume.

### Doctor growth: share-your-profile + name formatting

- **`utils/formatName.js`** (`cleanDoctorName`/`formatDoctorName`): doctors type
  their own name, so we saw "Dr. Dr Akash verma" (doubled prefix) and casing
  like "verma". The formatter strips a leading "Dr"/"Dr."/"doctor" and
  title-cases the name — DISPLAY only, stored name unchanged. Applied on
  `DoctorProfile.jsx` (heading, SEO, WhatsApp/share text) and `DoctorList.jsx`
  cards. If you show a doctor name with a "Dr." prefix anywhere new, use
  `formatDoctorName` so it stays consistent.
- **Doctor "share your profile" card** on the dashboard (verified doctors):
  WhatsApp-share + copy of their public profile URL
  (`/doctors/{user._id}`) so they seed their own patients — highest-trust,
  zero-cost growth. Doctor-facing card, English.

### SEO blog articles (growth)

- `blog/blogData.js` holds static articles (`{slug,title,description,
  specialization,publishedDate,readTime,image,content:[{type,...}],contentHi?:[{type,...}]}`).
  `contentHi` is the Hinglish (Hindi-in-Roman-script) version of the
  same article, rendered when the per-article EN/हिंदी toggle is set to Hindi.
  Every article now has a `contentHi`, so the blog is 100% bilingual.
  The renderer (`BlogArticle.jsx`) supports rich block types beyond plain prose:
  `intro`, `heading`, `paragraph`, `list` (`{items:[]}`), `callout`
  (`{variant:'tip'|'warning'|'success'|'info', title?, text?, items?}`), `table`
  (`{headers:[], rows:[[]]}`), and `steps` (`{items:[]}`), plus inline
  `**bold**` via `renderInline()`. All 370+ articles use these so reads are
  scannable (tables/callouts/step-lists), not walls of text; adding a new block
  type means extending the renderer's switch, and old `{type,text}` blocks still
  render (backward-compatible). `renderInline()` also auto-links key topic
  phrases to their article (internal linking, see `linkMap.js`). Grew to 370+
  articles across many kinds:
  per-specialty "when to see a [specialist]", symptom/question explainers
  (frequent-headaches, fever-home-care, is-online-consultation-safe, silent-
  signs-high-blood-sugar, always-tired, high-bp, stop-googling-symptoms), and
  responsibly-framed wellness/traditional-habit pieces (ancient-indian-wellness,
  gut-health, sleep, immunity).
- **Hinglish (`contentHi`) convention:** the Hindi version is written in Roman
  script only (NO Devanagari), medical terms kept in English, and ALL safety
  framing (emergency numbers like 112/108/Tele-MANAS 14416, red flags, "see a
  doctor" lines) preserved. All 373 articles are now translated; when adding
  or editing one, run a Devanagari leak sweep over `blogData.js`
  (`grep -noE '[A-Za-z]*[ऀ-ॿ]+[A-Za-z]*'` for mixed words and `grep -cE '[ऀ-ॿ]'`
  for a total count — both should be 0) plus the same sweep for Cyrillic
  (`[Ѐ-ӿ]`) before building/committing, since stray Devanagari or Cyrillic
  characters occasionally slip into otherwise-Roman words.
- **Each article's `specialization` must map to a real specialty** — the
  article page's CTA links to `/doctors?specialization=...`. New articles must
  also be added to `client/public/sitemap.xml` (SEO is a slow burn; resubmit
  the sitemap in Search Console after adding).
- **Content rules (important for a health platform):** articles are written
  ORIGINAL (never copied — duplicate content is plagiarism and Google penalizes
  it). Wellness/Ayurvedic/traditional content is framed as SUPPORTIVE LIFESTYLE
  habits, NOT cures — every such article explicitly says it doesn't replace
  medical care and points to a doctor. Do NOT add content claiming a
  herb/remedy treats or cures a disease (unsafe + liability). Keep the "see a
  doctor" framing on every article.
- **Blog discovery (`BlogList.jsx`, all client-side):** newest-first ordering
  (sort by `publishedDate` desc on a COPY, never mutate the imported array); an
  instant search box (filters title/description/specialization — not full body,
  which is noisy); and topic filter chips auto-derived from the set of
  `specialization` values (so they stay in sync as articles are added). Topic +
  search combine; the no-results state resets both.
- **Per-article engagement (`BlogArticle.jsx`):** share buttons (WhatsApp/
  Facebook/native/copy) to grow reach, a "👁 reads" badge, and a ❤️ "like"
  button backed by our own DB (`/api/blog-views`, `BlogView` model). Each
  browser can toggle its own like; the number shown is the aggregate, and view
  counts + likes power the "🔥 Most Read" and "❤️ Most Loved" lists on the blog
  list page. There is deliberately NO "dislike" and NO open comments — on a
  health blog those invite spam and medical misinformation. Views are recorded
  once per browser per article (throttled ~4h) so a refresh doesn't inflate the
  count.
- **Blog data split for performance:** `blogData.js` holds full article bodies;
  a build step (`scripts/gen-blog-meta.mjs`, run via `prebuild`) generates a
  lightweight `blogMeta.js` (metadata only). `BlogList` and the homepage
  daily-tip import `blogMeta` (small); `BlogArticle` imports `blogData` (full
  content) — so opening the blog list no longer downloads every article's text.
- **Build-time prerendering (`scripts/prerender.mjs`, run via `postbuild`):**
  writes a static HTML file per public route with correct per-page
  title/description/canonical/OG baked in, so crawlers/social scrapers see the
  right tags without running JS (a client-only SPA otherwise serves the same
  generic homepage tags on every route).
- The floating WhatsApp button is hidden on `/blog` and `/blog/<slug>` (see
  `WhatsAppButton.jsx`) so it doesn't distract readers or get mis-tapped.

### Blog growth: categories, Start Here, health tip, related articles

- **Blog grew to 63 original articles** (from ~25). Same `blogData.js` schema
  and content rules as above (original text, wellness framed as lifestyle
  support never cures, every article's `specialization` maps to a real
  specialty for the CTA, new slugs added to `client/public/sitemap.xml`). All
  articles were later reformatted into the rich block types (tables/callouts/
  step-lists/bold) noted above — visible on-screen text only; slugs,
  specializations, `<SEO>` tags, and JSON-LD schema were left untouched so SEO
  and links are unchanged.
- **Category browsing (`BlogList.jsx`):** the raw ~15 specialization chips are
  grouped into broad, icon-labelled categories (Heart & BP, Women's Health,
  Mental Health, Digestion, Diabetes & Hormones, Bones & Joints, Skin & Hair,
  Kids, Brain & Nerves, Eyes, ENT, Kidney & Urinary, Lungs, Dental, General &
  Wellness) via a `CATEGORIES` map — each category lists the specialties it
  covers, so it stays browsable as articles grow. Every current specialty maps
  to a category; any future unmapped specialty just stays visible under "All"
  (safe fallback — nothing disappears).
- **"Start Here" strip:** a hand-picked shortlist (`START_HERE_SLUGS`) of
  broadly-useful reads shown ONLY on the default view (no search, "All"
  selected), so first-timers aren't faced with 60+ articles at once. Disappears
  the moment someone searches or picks a category.
- **Smarter related articles (`BlogArticle.jsx`):** each article now suggests
  up to 3 others — SAME specialty first (most relevant to what the reader is
  already interested in), then filled with the most recent others — plus a
  "browse all" link, to keep people reading instead of bouncing.
- **Health Tip of the Day (`Home.jsx`):** picks one article deterministically
  from the date (`dayNumber % articles.length`), so it's the SAME for everyone
  on a given day and rotates daily — a gentle reason for casual visitors to
  return. The surrounding UI labels are bilingual (badge, "read the full
  article", "more health articles"); the article title/description stay English
  on purpose (same rule as all medical content — never machine-translated).
  Rolls over at UTC midnight (5:30 AM IST) and walks the array in order (not
  curated-by-impact) — both deliberate, minor, left simple.

### Automated appointment reminders (cut no-shows)

- **Why:** before this, a confirmed appointment arrived with no nudge at all
  unless the patient happened to open the dashboard — a real no-show driver.
- **How:** `server/utils/appointmentReminder.js` — a once-a-minute clock-based
  job (scheduled in `server.js` next to the existing `callReminder`) that, ~1
  hour before a `confirmed` appointment (ANY consultation type), pushes a
  reminder to BOTH the patient and the doctor via Web Push (free, works when
  the app is closed). Patient's push names the doctor; the doctor's is generic
  (doesn't leak the patient's name).
- **Timing:** fires once in the 60→55-min-before window (job runs every
  minute), guarded so a late server start won't send a stale reminder for a
  slot about to begin (the at-start call reminder covers that case). Reuses the
  same IST slot-time parsing helpers as `callReminder.js`.
- **Dedupe:** a new `reminderSentAt` field on `Appointment` (separate from
  `callReminderSentAt`, which fires AT slot start for calls) — so the two
  reminders never interfere and each fires once. Reschedule resets both flags
  so reminders re-fire for the new time.

### Doctor block dates / vacation

- **What:** doctors mark specific dates (single day or a range) as unavailable,
  ON TOP OF their weekly `availability`. Stored as a new `blockedDates`
  array on `User` (`[{ date: "YYYY-MM-DD", reason }]`) — plain date strings so
  comparison is IST-calendar-agnostic; a UI range is expanded into individual
  dates before saving, keeping the model simple.
- **Enforced in ALL THREE slot-computation paths** (this consistency is the
  crux — a blocked date must never leak a bookable slot anywhere):
  1. Public free-slots endpoint (`availabilityController.getFreeSlots`) —
     returns `slots: []` for a blocked date.
  2. Booking guard (`appointmentController.bookAppointment`) — rejects a direct
     API booking on a blocked date the UI would never have offered.
  3. Next-available / "available today" (`doctorController.computeNextAvailable`)
     — skips blocked days, so a doctor's card never advertises a slot they're off.
     (The reschedule handler reuses the same booking guard.)
- **Endpoints:** `GET`/`PUT /api/availability/blocked-dates` (doctor only).
  `setBlockedDates` replaces the whole list, drops past dates, de-dupes, sorts.
- **UI:** a "Block Dates / Vacation" section in `DoctorAvailability.jsx`
  (auto-saves like the rest of that screen; From/To/reason; unblock button).
- **Deliberate limitation:** blocking a date does NOT auto-cancel appointments
  already booked on it — the UI warns (amber note) to handle those manually.
  Auto-cancelling a patient's confirmed appointment is a bigger decision left
  to the doctor.

### Patient reschedule (pending or confirmed, paid or not)

- **What:** a patient moves a `pending` OR `confirmed` appointment (completed/
  cancelled are final) to a different free slot with the SAME doctor. New
  `PUT /api/appointments/:id/reschedule` (patient-only), and a Reschedule
  button + `dashboard/RescheduleModal.jsx` (reuses the public free-slots picker,
  so it only offers genuinely open slots and honours blocked dates).
- **Same-doctor only, by design.** Switching doctors = a new booking — mixing
  that into "reschedule" would create refund/ownership messiness (payment is
  already with the original doctor via direct UPI).
- **What's preserved vs reset** (`rescheduleAppointment` in
  `appointmentController.js`):
  - Preserved: identity, `paymentStatus`/`paidAt`/`amountCollected` (paid stays
    paid — no re-payment), `reason`, `symptoms`, `consultationType`, consent,
    family info, notes, `isFollowUp`.
  - Reset: `date`/`timeSlot` (the move), `status` → `pending` (doctor
    re-confirms), `meetingLink` → `''`, the call flags, and BOTH reminder
    dedupe flags (`callReminderSentAt`, `reminderSentAt`) so reminders re-fire
    for the new time.
- **Guards reused from booking:** blocked date, not-in-past, and slot-taken —
  the slot-taken check EXCLUDES the appointment itself (`_id: { $ne: ... }`) so
  "rescheduling to the same slot" doesn't collide with itself.
- **Notifications:** the doctor gets push + email that it moved and needs
  re-confirming.
- **No time cutoff yet** — a patient could technically reschedule minutes
  before the slot. Kept simple; add a "can't reschedule within X hours" rule
  later if it's abused. Direct-UPI payment is why reschedule needs no refund
  logic (same doctor, same fee).

---

### Patient "Health History" timeline

- **What:** a patient-only dashboard tab (`Health History`) that shows a
  single chronological, newest-first, month-grouped timeline merging the
  patient's consultations, prescriptions, and uploaded reports — the
  "see my whole health story in one place" view larger platforms have.
  Component: `client/src/pages/dashboard/PatientHealthTimeline.jsx`, wired
  into `Dashboard.jsx` (import, `VALID_TAB_KEYS`, `PATIENT_TXT` EN/HI labels,
  a patient-only tab button, and the tab render — all `isPatient`-gated).
- **Purely client-side aggregation — deliberately no new backend/schema.** It
  reuses the three existing "get mine" endpoints in one `Promise.all`:
  `appointmentAPI.getMine({limit:100})`, `prescriptionAPI.getMine({limit:100})`,
  `reportAPI.getMine()`. Each result is mapped to a common
  `{ id, type, date, data }` entry (appointment→`date`, prescription/report→
  `createdAt`), merged, sorted newest-first, then grouped by month for
  scannable headers. This is why it couldn't break anything the rest of the
  app relies on — it only READS data that already exists and never mutates.
- **Field dependencies (verified against the controllers):** appointments
  populate `doctor.name/specialization` (+ `date/timeSlot/reason/status/
  consultationType/bookedFor/familyMemberName`); prescriptions populate
  `doctor` and return `diagnosis/medicines/createdAt`; reports return
  `title/doctor.name/isReviewed/createdAt`. If any of those populate lists
  change, re-check this component.
- **Type filter** (All / Consultations / Prescriptions / Reports) with live
  counts; **jump-to-detail** links call `onNavigateTab` (`goToTab`) to switch
  to the full Prescriptions/Reports tab. **Realtime:** listens to the same
  `prescription-updated` / `report-updated` socket events the individual tabs
  use, and refetches so the timeline stays current. Bilingual tab label
  (`tabTimeline`); the record content itself is not machine-translated (same
  rule as the rest of the app).

---

## Free Health Tools, Medicine Chart, Caregiver View & SEO (how they work)

### The pattern every tool follows

```
src/pages/tools/<tool>.js     ← ALL logic + copy (EN + Hinglish), plain JS, no JSX
        │                        (imported by the page, the prerender and the tests)
        ├──▶ <Tool>.jsx           ← the page (lazy-loaded route, Hindi at /hi)
        ├──▶ scripts/prerender.mjs ← crawler HTML for /tools/<tool> and /hi:
        │                           title, description, hreflang, JSON-LD
        │                           (WebApplication + FAQPage + Breadcrumb)
        └──▶ tests/<tool>.test.mjs ← pins the numbers; runs before every build
```

- **Private by design:** everything is calculated in the browser. Nothing is sent to the server (tick-offs, reminder times, etc. stay in `localStorage`).
- **Reminders** are `.ics` calendar files built on the phone and downloaded. A website can't add calendar events by itself; the phone always asks first.
- **Share buttons** send the tool **link** only, never the user's dates or values. The exception is the due-date tool, whose share page shows only the month, by the user's choice.
- **Entry points** (`toolLinks.js`): Home smart-search suggestions (keyword matchers per tool, including Hinglish and Devanagari), one "🧰 Free tools" chip, cards on related blog articles (slug lists), strips on related specialty pages, the `/tools` hub and the footer.
- **Share cards** are 1200×630 PNGs drawn as SVG and rasterised locally with `rsvg-convert` (scripts in `client/scripts/gen-*-card*.mjs`; the PNGs are committed). `gen-due-date-cards.mjs` writes one card per month, so **re-run it about once a year**.

### Report Samjhao (blood report explained)

```
Photo of PRINTED report
  → reportOcr.js: enlarge to ~2400 px + greyscale (the reader drops small
    decimal points on low-res images) → Tesseract.js in a Web Worker,
    files self-hosted at /tesseract/<version>/ (copied at build time)
  → reportParse.js: find each test by name (HbA1c before Hb; skips MCH/MPV
    look-alikes), read value + printed range + unit, convert units,
    undo a ×10/×100 dropped-decimal slip ONLY when the value is physically
    implausible (a real TSH of 60 is never "corrected"), mark doubtful
    readings amber
  → user checks/edits numbers, ticks "I checked these numbers"
  → reports.js: interpret() → Low / Normal range / High, or bands
    (sugar: normal / prediabetes / diabetes range; vit D: low/borderline/ok)
    using the report's own printed range when present (range-type tests)
  → urgent box ("see a doctor today") for: Hb < 7, platelets < 0.5 lakh,
    WBC < 2,000 or > 30,000, fasting/PP sugar < 54 or ≥ 300
```

- **Typed values:** in the default unit, the scale is detected from the size of the number (`normalizeTyped`), so platelets typed as "40000" are read as 0.4 lakh (urgent low), never as 40,000 lakh ("High").
- **Wording rules** (enforced by a test): never name a disease, always "common reasons — your doctor will tell", always end with "show your doctor". Adults only, not for pregnancy.
- **Why no cloud AI:** the free Gemini tier lets Google use and human-review submissions, and its terms say not to send personal or sensitive data; the paid tier still bars "medical advice". Printed reports are read for free on the phone instead. Handwritten prescriptions would need paid AI with guardrails, so that's deferred.

### Daily medicine chart (patient) — `utils/rxChart.js`

- **Input:** the doctor's free text per medicine (`frequency`, `duration`, `instructions`), read together:
  - `1-0-1` / `½-0-½` / `1-0-0-1` → slots as written
  - `BD` → morning + night
  - `TDS` → morning + afternoon + night
  - `HS` → night
  - `OD` → "once a day" (the time is **not** guessed unless stated, e.g. "OD at night")
  - `SOS` → when needed
  - weekly → the prescription's weekday
  - `QID` → "4 times a day" (not spread by us)
- **Durations:** days, weeks, months or "Continue". Each course's end date is counted from the prescription date in **IST**.
- **Unreadable entries** go to "Check with your doctor" with the doctor's exact words. The original text is always one tap away.
- **Reminders:** one repeating event per slot **and per end date**. A 5-day tablet and a 7-day syrup at 8 AM become two alarms, so an alarm never lists a medicine after its course ends. Reminders start "today", never in the past.
- **Follow-up date:** comes from `appointment.followUpDeadline`, which `getMyPrescriptions` populates.

### Doctor prescription box — `components/MedicineEditor.jsx` + `utils/rxRows.js`

- It's a `type: 'custom'` field inside the existing `PromptModal`, and it's lazy-loaded (doctors only).
- **What the doctor fills in:** one card per medicine `{ name, freq, food, days, note }`.
- **How it's saved:** in the SAME model fields as before: `frequency = freq`, `duration = "5 days" | "Continue" | text`, and `instructions = "After food; <note>"`. So the PDF, patient card, WhatsApp share and chart need no change.
- Old prescriptions load back into cards field by field, so the old blank-field shift is fixed. Anything unusual is kept as typed.
- Commas are safe, because cards aren't comma-split.
- **Enter key:** inside the editor, Enter never submits the form; in the name box, it adds the next card.

### Caregiver view — `utils/familyChart.js` + `pages/dashboard/FamilyMeds.jsx`

- **Who it's for:** `appointment.bookedFor` / `familyMemberName`, which already exist on every family booking and are now also populated in `getMyPrescriptions`. They drive the "For: Mummy" tag, the person filter and the family view.
- **Access is unchanged:** only the account holder sees their own prescriptions, behind the same owner filter. Linking two separate accounts (a parent's own login shared with a child) is a deliberate future step, because it changes who can see health data.
- **Safety rules:**
  - "Continue"/no-duration medicines only count from prescriptions written in the last **90 days**.
  - The same medicine from two doctors stays two entries, each labelled with its doctor. It's never merged.

### Voice search — `components/VoiceSearch.jsx`

- **How it works:** it uses `SpeechRecognition` / `webkitSpeechRecognition` with `hi-IN` or `en-IN` and puts the text into the Home symptom box. The existing matcher already understands Devanagari.
- **Where it shows:** only where the API exists (Chrome on Android, Safari on iPhone).
- **Privacy note in the UI:** the phone's own speech service (Google/Apple) converts the voice to text, the same as the keyboard mic. ProMedicoz never records or stores audio.

### SEO pipeline — `scripts/prerender.mjs` (runs after every build)

- **Static HTML per public route** (~840): title, description, canonical, OG and hreflang, plus a hidden crawler-readable body (`data-prerender="seo"`) and JSON-LD.
  - Routes covered: home, listings, `/dr/:slug` doctors, specialties and city pages, every article, Hindi article pages `/blog/:slug/hi`, and the tools.
  - The canonical for doctors is `/dr/:slug`.
- **`sitemap.xml`** with honest `lastmod`, plus **`llms.txt`**.
- **IndexNow ping** on production builds only (Bing and others). The key file is in `public/`, and the Bing verification tag is in `index.html`.

### Safety tests — `client/tests/` (see its README)

- **What they are:** Node's built-in test runner (`npm test`), importing the same plain-JS files the pages use.
- **When they run:** first in `prebuild`, so a failing check **stops the deploy**.
- **What they cover:** every medical range, urgent limit, band edge, vaccine schedule entry, chart-reading rule and reminder rule.

### Service worker reload (fixed)

- **How it works now:** `main.jsx` reloads the page once when a NEW service worker takes control, so users get the latest deploy.
- **What was wrong:** on a first visit there's no previous worker, and the first one taking control used to trigger the same reload ~2 s after opening the site. That wiped whatever a first-time visitor had started.
- **The fix:** it now reloads only if a controller existed before (`hadController`).


## Keeping Patients Unstuck (2026): payments, Needs help, drafts, validation

Real patients got stuck in places the code didn't expect (a patient registered without a phone; a patient tapped "I Have Paid", lost the QR and had no way forward). The rule since then: **every state has a next step, a way back, and someone who gets nudged automatically if it stalls.**

### 1. Payments with no dead ends — `controllers/paymentController.js` + `components/PaymentBox.jsx`

ProMedicoz doesn't take the money: the patient pays the doctor by UPI, tells us, and the doctor (or admin) presses "Mark Paid".

| Payment state | What the patient sees | Ways out |
|---|---|---|
| `pending` (confirmed, not paid) | "Pay Rs. X to Dr. Y" | 📱 Pay with UPI app (phones; `upi://pay` link with amount + Patient ID in the note), QR (tap to enlarge in-page, Back closes it), copy UPI ID → 📎 upload screenshot (counts as "I've paid"), type the 12-digit UTR, or "I've paid, just tell the doctor" |
| `patient_claimed`, no proof | "⏳ Waiting for the doctor to confirm" | Add screenshot / UTR, 💳 Show QR / pay again, ↩ I haven't paid yet, 🔔 Remind doctor, 💬 WhatsApp support |
| `patient_claimed`, proof sent | "✓ Screenshot sent" + thumbnail | View / Replace, same buttons as above |
| `paid` | "✓ Payment Confirmed" | — (only doctor/admin change it) |

- **Notifications:** "I've paid" and uploads push the doctor (generic text, no patient name on the lock screen) and refresh their open dashboard (socket `appointment-updated`). Mark Paid pushes the patient.
- **Timing rules:** "Remind doctor" 2 h after claiming, then at most every 6 h (server returns 429 + `nextReminderAt` otherwise).
- **Automatic follow-up** (`utils/paymentFollowUp.js`, every 10 min): doctor nudged once at 3 h, admin emailed + pushed once at 24 h. Claims made before this existed have no `paymentClaimedAt`, so `updatedAt` is used for them.
- **Admin → Appointments → 💳 Payment help** (`pages/admin/PaymentHelp.jsx`): shows status, UTR, screenshot, both phones; **Mark paid** (after checking with the doctor; amount defaults to the fee) or **Reset** (patient sees QR/upload again; a note is required to reset a *paid* one). Both record `paymentMarkedBy` + `paymentMarkedByRole: 'admin'` + the note.
- **Caveat:** some UPI apps limit pay links to personal UPI IDs, so the QR always stays as the fallback. The UPI button only shows on phones and only if the doctor saved a UPI ID.

### 2. Admin "🚨 Needs help" — `utils/needsHelp.js` + `pages/admin/NeedsHelp.jsx`

Built live on each open (`GET /api/admin/needs-help`), first item in the admin sidebar with a red count, plus a banner on Overview.

| Group | Rule | Row actions |
|---|---|---|
| Slot soon, not confirmed | `pending`, slot not started, booked 3 h+ ago **or** slot within 4 h | ✓ Confirm, WhatsApp doctor |
| Patient says paid, not confirmed | `patient_claimed` for 3 h+ | 💳 Payment help, WhatsApp doctor |
| Confirmed, unpaid, within 2 h | `confirmed`, `paymentStatus: pending`, not a free follow-up | Payment help, WhatsApp patient |
| Slot passed, still open | slot ended 2 h+ ago (last 30 days), still pending/confirmed | WhatsApp doctor / patient |
| Paid, then cancelled | cancelled while paid or claimed (last 60 days), refund not checked | ✓ Refund checked (with note), WhatsApp |
| No mobile number | patient accounts without a phone | 🤝 Help patient |

WhatsApp buttons open `wa.me` with a pre-filled message (patient, doctor, slot, UTR) for the admin to review and send; no paid API. Slot times are computed exactly in IST by `slotWindowMs` in `utils/slots.js`.

**Automatic reminders first** (`utils/journeyReminders.js`, every 10 min, once each; reschedule resets them):
- Doctor "Please confirm a booking": pending 3 h after booking or 4 h before the slot, whichever first (not in the first 30 min).
- Patient "Payment pending for your appointment": confirmed, unpaid, slot within 2 h.

**Admin Appointments search:** `?search=` matches Patient ID / patient or doctor name / phone across ALL appointments (people first, then their appointments), plus `?paymentStatus=` and "Load more".

### 3. Pick up where you left off — `utils/drafts.js`, `utils/useAutoDraft.js`, `utils/profileAutosave.js`

Nobody presses save to keep progress.

- **Device drafts** (localStorage key `pmz_draft:<userId|guest>:<name>`, value `{ v, savedAt, data }`), saved ~0.8 s after typing stops and immediately when the page is hidden (switching to WhatsApp / UPI app):

  | Draft | Name | Expires | Restored where |
  |---|---|---|---|
  | Booking form | `booking:<doctorId>` | 24 h | BookAppointment ("↩ Picked up where you left off · Start fresh"); Dashboard "Continue where you left off" card |
  | Prescription | `rx:<appointmentId>` | 7 days | PromptModal ("✓ Draft restored"; outside tap asks "Keep this draft for later?") |
  | Doctor profile (unsaved bits only) | `profile` | 7 days | Merged back on load, then autosaved |
  | Register form | `register` (guest) | 2 h | Register (name/email/phone/role) |

- **Privacy rules:** device-only (never sent to the server), per account, deleted on explicit logout (`clearAllDrafts`) and after a successful booking/prescription/registration. **Never stored:** passwords, consent ticks, payment details. An *expired* login keeps drafts (`logout({ keepDrafts: true })`) so the work is there after logging in.
- **Booking restore:** skipped for repeat/follow-up bookings (they carry their own context) and quick-pick deep links. A restored slot is re-selected only if it's still in the fresh free list; otherwise "10:30 AM was booked by someone else meanwhile. Everything else is kept." Past dates are dropped.
- **"← Back to your booking":** the booking form's "Add family member" / "Account Settings" links add `&back=/book-appointment/<doctorId>`; Dashboard shows the button.
- **Doctor profile autosave:** ~1 s after typing stops, only changed fields are sent (`diffProfile`). A field with an obvious problem (short phone, fee out of range, `javascript:` link) is shown inline and held back while the rest saves (`profileProblems`). The server allows partial saves (no more "fill all 7 fields at once"); what's still needed is shown as "5 of 8 done · Left: …" in the onboarding checklist. Photo / QR keep their own upload buttons. If a save fails (offline), the unsaved changes stay on the device and save on the next visit.

### 4. Booking rules — `utils/booking.js` (one place for patient AND admin bookings)

- Doctor must be bookable (same filter as the public list: not unverified/deleted/suspended); a patient the doctor blocked is refused.
- Slot must come from the doctor's weekly hours for that date, be a real `YYYY-MM-DD`, not past, not on a blocked day, and (today) not already started (`slotProblem` in `utils/slots.js`, shared with the free-slots endpoint and reschedule).
- Only a consultation type the doctor offers (default: the doctor's first). The booking page and Help patient show only those types.
- Family bookings must name a member saved on the account (saved spelling is used).
- Free follow-up: needs the patient's own original appointment with the same doctor, inside `followUpDeadline`, and **only one** non-cancelled follow-up per original visit (a cancelled one frees it again). The patient card shows "✓ Free follow-up booked: date". Paid "Book again" isn't limited.

### 5. Validation & authorization audit (what the server now refuses)

- Public doctor endpoints exclude login tokens, email, push endpoints, login IP/time, block list, admin notes and patient-only health fields (`DOCTOR_PRIVATE_FIELDS` in `doctorController.js`).
- Deleted/suspended accounts are refused even with an old token (`middleware/auth.js`).
- Phone/email changes (account settings, doctor profile, Help patient) are format-checked and refused if another active account uses them (`utils/contactChecks.js`; admins are told whose account it is, patients aren't). Deleted accounts holding the value are moved aside, like registration does.
- Payment: no downgrade of `paid`, no claims/marks on cancelled appointments, amount capped at Rs. 1,00,000.
- Calls ring only during the booked slot (ending a call is always allowed); meeting links must be `https://`.
- Prescriptions: only for confirmed/completed appointments; `followUpDays` parsed as a number 0–90 (the old code could string-join "6"+"7" into a date months away); medicines/tests/text capped.
- Push subscriptions: `https` endpoint + valid keys, max 10 devices per account.
- Medical info: valid blood group, emergency phone format, 1000-character caps.

### 6. Call alarm — `utils/callReminder.js`, `client/public/sw.js`, `utils/callAlarm.js`, `components/CallAlertsBox.jsx`

For confirmed + paid video/phone appointments (job every 20 s):

| When | What | Notes |
|---|---|---|
| −10 min | "⏰ starts in 10 min" (both) | once (`callPreAlertSentAt`) |
| 0 min | 📞 ring (both) | `kind: 'call'` push: stays on screen (`requireInteraction`), long vibrate, `renotify`, **Join now** / **In 5 min**; urgency high, TTL 90 s |
| +40 s, +80 s | ring again | max 3 (`callRingCount`); stops as soon as either side joins (`callStartedAt`) |
| "In 5 min" | that person rung again 5 min later | SW posts a signed ring token (`utils/ringToken.js`, HMAC with JWT_SECRET) to `POST /api/push/snooze`; needs `PUBLIC_API_URL` or Render's `RENDER_EXTERNAL_URL`, else the button is hidden |

- **Join now** opens `/dashboard?join=<id>`; the Dashboard opens the call directly if it's within the call window.
- **Incoming call** (other side tapped Join) uses the same alarm style. Doctor-facing text never names the patient.
- **In-app:** phone-style double ring via Web Audio (unlocked on the first tap), vibration pattern every cycle, flashing tab title; the SW forwards call pushes to open tabs (`pmz-call` message) so they ring too.
- **Call alerts box** on video/phone cards within 48 h: on (Test my alarm → `POST /api/push/test-alarm`) / off (Turn on) / blocked (how to allow) / iPhone not on Home Screen (how to add).
- **No-show help** from 2 min after the start: doctor → tel: + WhatsApp patient; patient → chat + WhatsApp support.
- **Limits:** a website can't override silent mode or pick the ringtone; iPhone web push needs ProMedicoz added to the Home Screen.

### 7. Live updates everywhere — `utils/live.js` + Dashboard socket handlers

- Server emits `appointment-updated` to both sides on: booking (patient and admin), confirm/complete/cancel, patient cancel, reschedule, mark paid, admin confirm, admin payment help; payment steps notify the doctor; prescriptions emit `prescription-updated` to the patient (+ `appointment-updated` to the doctor).
- `GET /appointments/my` adds `prescriptionInfo { _id, medicineCount }` per appointment, so the patient card shows "💊 Prescription ready" and the toast "Your doctor sent your prescription · View".
- **Never missed:** refetch on socket (re)connect and when the tab becomes visible; a 60 s check while disconnected; "● Live / Reconnecting…" under the welcome header.

### Tests for all of the above

- Server: `cd server && npm test` (~97 checks, no DB): `callAlarm.test.js`, `gaps.test.js`, `payment.test.js`, `needsHelp.test.js`, `slotIndex.test.js`, `adminPatient.test.js`, `login.test.js`, `register.test.js`.
- Client: `cd client && npm test` (runs before every build): `callAlarm`, `paymentFlow`, `needsHelp`, `consultModes`, `drafts`, `profileAutosave` and the medical tests.

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
| `controllers/paymentController.js` | Patient payment steps (screenshot, "I've paid" + UTR, undo, remind) + admin Payment help + refund checked |
| `controllers/adminPatientController.js` | Admin Help patient (details, family, book on behalf) + New patient |
| `utils/booking.js` | `createBooking` — every booking rule, used by patient and admin paths |
| `utils/slots.js` | Slot labels, `slotProblem` (real/offered/not past/not started), `slotWindowMs` (exact IST start/end) |
| `utils/contactChecks.js` | Phone/email format + "used by another account" checks; moves deleted holders aside |
| `utils/paymentFollowUp.js` · `utils/journeyReminders.js` | Every-10-min jobs: payment nudges (3 h doctor / 24 h admin); confirm + pay reminders |
| `utils/needsHelp.js` | Admin Needs help groups (`classify` is unit-tested) |
| `utils/fixIndexes.js` | Startup: email index (sparse unique) + double-booking guard (`unique_active_slot`) |

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
| `pages/dashboard/PatientHealthTimeline.jsx` | Patient "Health History" tab — client-side merge of appointments + prescriptions + reports into one chronological, month-grouped timeline (read-only) |
| `pages/dashboard/PatientPrescriptions.jsx` | Patient prescriptions — "For:" tags, person filter, chart + family view buttons, PDF/WhatsApp share |
| `pages/dashboard/RxChart.jsx` | Daily medicine chart for one prescription (reminders, share, large text, print) |
| `pages/dashboard/FamilyMeds.jsx` | "Family's medicines today" (caregiver view) |
| `components/MedicineEditor.jsx` | Doctor's one-card-per-medicine prescription editor (lazy-loaded) |
| `components/VoiceSearch.jsx` | Hindi/English voice search for the Home symptom box |
| `utils/rxChart.js` · `utils/rxRows.js` · `utils/familyChart.js` | Pure logic for the chart, the doctor box and the caregiver view (unit-tested) |
| `pages/tools/*.jsx` + `*.js` | Free health tools: page + shared logic/copy (`reports.js`, `reportParse.js`, `reportOcr.js`, `dueDate.js`, `ovulation.js`, `vaccines.js`, `toolLinks.js`, `toolsList.js`) |
| `components/PaymentBox.jsx` · `utils/paymentFlow.js` | Patient payment box (all states) + UPI link / UTR / reminder timing |
| `components/SessionExpired.jsx` | "Please log in again — your work is saved" banner (listens for `pmz:session-expired` from `services/api.js`) |
| `utils/drafts.js` · `utils/useAutoDraft.js` | Device-only drafts (per account, expiry) + autosave hook |
| `utils/profileAutosave.js` | Doctor profile autosave: changed fields, inline checks, progress |
| `utils/consultModes.js` | Only the consultation types a doctor offers |
| `pages/admin/NeedsHelp.jsx` · `PaymentHelp.jsx` · `HelpPatient.jsx` · `utils/needsHelp.js` | Admin Needs help, Payment help, Help patient / New patient |
| `tests/*.test.mjs` | Client safety tests (run before every build) |
| `scripts/prerender.mjs` | Post-build static HTML, crawler bodies, JSON-LD, sitemap, llms.txt, IndexNow |
| `scripts/copy-tesseract.mjs` | Pre-build: self-hosts the photo-reader files in `public/tesseract/<version>/` |

---

## Live URLs

| What | URL |
|------|-----|
| Website (custom domain) | https://www.promedicoz.in |
| Free health tools | https://www.promedicoz.in/tools |
| Frontend (Vercel backup) | https://docconnect-mocha.vercel.app |
| Backend (API) | https://docconnect-sg.onrender.com |
| API Health Check | https://docconnect-sg.onrender.com/api/health |
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

### "My Clinic" — Doctor-Owned Branded Booking Page (`/dr/:slug`)

The strategic goal: make a doctor treat ProMedicoz as *their own* app so they
actively promote it. A marketplace listing (one doctor among many) gives them
no reason to send their own patients here. A page that is *only about them*
does — sharing it promotes themselves.

- **Vanity slug.** `User.slug` (unique + sparse, `default: undefined` — same
  sparse-index rule as `email`/`patientId`, so non-doctors don't collide on a
  shared value). Generated from the doctor's name by `slugifyName()` +
  `User.generateUniqueSlug()` (strips a leading "Dr.", lowercases, hyphenates,
  appends `-2`, `-3`… on collision). A `pre('save')` hook assigns it the first
  time a doctor is saved without one, and `utils/backfillSlugs.js` (run on
  startup, idempotent) gives every pre-existing doctor one. "Pooja Singh" →
  `pooja-singh` → `promedicoz.in/dr/pooja-singh`.
- **The page.** `GET /api/doctors/by-slug/:slug` resolves the doctor (and
  `$inc`s a `pageViews` counter, fire-and-forget). The frontend renders the
  SAME `DoctorProfile` component with a `clinicMode` prop rather than a second
  copy that could drift: in clinic mode it fetches by slug, locks the resolved
  Mongo id into state so every downstream call (reviews, free slots, booking)
  works unchanged, shows a quiet "Verified clinic page" co-brand bar, drops the
  "back to all doctors" nav, and moves the only "explore more doctors" link to
  the footer. The old `/doctors/:id` URL is untouched.
- **Why reuse, not duplicate:** DoctorProfile already has ~700 lines of
  bilingual logic (reviews, curated reviews, availability, sticky booking bar,
  share). A second branded page would inevitably fall out of sync. `clinicMode`
  is a thin presentational switch over identical data/logic.

### "Promote Me" — Doctor Dashboard Tab (`dashboard/PromoteMe.jsx`)

Turns the branded page into a shareable asset and gives the doctor a reason to
open the app daily:

- Personal link with copy + the Web Share API (native share sheet on mobile,
  the same pattern already used for sharing prescriptions).
- **QR code** (`qrcode.react`'s `QRCodeCanvas`) with a PNG download (rasterized
  from the canvas).
- **Printable A5 "clinic card" poster** (PDF) built with `jsPDF` (lazy-imported
  so it never weighs down other pages) — header band, the QR, the booking URL,
  "Powered by ProMedicoz" — for the reception desk / notice board.
- One-tap share to WhatsApp (wa.me), Instagram (copy for bio), Google Business
  (copy), and SMS.
- **Live "this month" stats strip** — `GET /api/doctors/me/stats` (doctor-only)
  computes, from the doctor's OWN appointments + reviews: consultations this
  month, earnings collected this month and all-time (sum of `amountCollected`
  on `paid` appointments), unique vs repeat patients, rating, page views, and
  link bookings. Nothing is invented; if it fails to load the strip just hides.
- `POST /api/doctors/:id/link-booking` is a best-effort counter the branded
  page pings when a visitor taps "Book" (always 200, never blocks booking).

### Admins Land on the Admin Panel (not the generic dashboard)

An admin is neither patient nor doctor, so the shared `/dashboard` (with its
`isDoctor`/`isPatient` branches) was never meaningful for them — it showed an
odd "welcome + appointments" view.

- `AuthContext` now exposes `isAdmin`.
- `Login.jsx` routes `role === 'admin'` to `/admin`, everyone else to
  `/dashboard`.
- `Dashboard.jsx` has a guard effect: an admin who lands there is
  `navigate('/admin', { replace: true })`'d away.
- `Navbar.jsx` and `BottomNav.jsx` show admins a single "Admin Panel" link
  instead of a confusing "Dashboard" + "Admin Panel" pair.

### Admin User Detail Drill-Down

Clicking a user's **name** anywhere in the admin panel (the Users list OR the
Appointments list) opens a read-only detail modal.

- `GET /api/admin/users/:id` returns the complete user record (minus password)
  plus their recent appointments (as patient or doctor), so the modal is rich
  regardless of where it was opened — the Appointments list only populates a
  few patient fields, so the modal fetches the full record on open (showing the
  partial data instantly, then filling in).
- Shows: identity/contact; for patients their medical info + family members
  (both already embedded on the user doc); for doctors their full professional
  profile; and a "Recent appointments" section (other party, date/time, status,
  amount paid).

### Rupees Shown as "Rs." (not ₹)

The ₹ glyph renders as an empty box or a "$"-looking mark on some Indian
devices/fonts, which is misleading on a fee. All fee displays use the plain
`Rs.` prefix instead. (Doctor avatars likewise use a gender-neutral 🧑‍⚕️
fallback — there's no gender field on a doctor, so never assume one.)

### Blog List Redesign

The blog LIST cards are now category-colored (a `SPEC_THEME` map drives each
card's header gradient, specialty chip, and link accent per specialty, falling
back to brand blue), with a featured hero article on the default view and a 🔥
"Most read" badge on the single most-read card — so the grid reads like a
browsable magazine instead of identical blue tiles. All existing logic (search,
category chips, Most Read / Most Loved / Start Here, read counts) is unchanged.

---

## Pending Cleanup (after the Oregon → Singapore move, Oct 2026)

Optional, low risk. Do on or after **4 Nov 2026** if everything has been fine:

- [ ] **Render:** delete the suspended Oregon service `docconnect` (Settings → Delete Web Service). The live backend is `docconnect-sg` — don't touch that one.
- [ ] **MongoDB Atlas → Network Access:** remove the two Oregon entries "Render outbound range 1" (`74.220.48.0/24`) and "Render outbound range 2" (`74.220.56.0/24`). Keep the two "Render Singapore" entries and the personal IP. Don't switch to `0.0.0.0/0` (see Production Security Configuration).
- [ ] **Render:** the region list showed "Oregon: 2 existing services" — find out what the second one is before changing or deleting it.
- [ ] **Server dependencies:** Render's `npm install` reports 10 vulnerabilities (4 low, 2 moderate, 3 high, 1 critical). Review with `cd server && npm audit`, update with pinned versions, run `npm test`, then deploy.
- [ ] **Vercel:** the deployment page shows "2 Recommendations" — review.
- [ ] *(No need)* Atlas index `doctor_1_date_1_timeSlot_1` on appointments is a harmless leftover next to the working `unique_active_slot` guard.

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

