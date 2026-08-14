# ProMedicoz — Doctor Consultation Platform

A full-stack web application where doctors register profiles, patients browse and book consultations, and doctors can be reached directly via WhatsApp for emergencies.

**Live Website:** https://www.promedicoz.in (custom domain) | https://docconnect-mocha.vercel.app (backup)

Built as a learning project covering: authentication, CRUD operations, file uploads, role-based access, relational data, and responsive UI.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Prerequisites](#prerequisites)
5. [Local Setup (Step by Step)](#local-setup-step-by-step)
6. [Environment Variables](#environment-variables)
7. [Running the Application](#running-the-application)
8. [API Endpoints](#api-endpoints)
9. [Testing the App](#testing-the-app)
10. [Troubleshooting](#troubleshooting)
11. [Deployment Guide](#deployment-guide)
12. [Learning Roadmap](#learning-roadmap)

---

## Features

- Doctor and patient registration with role-based access
- Smart specialization search with fuzzy matching (handles misspellings)
- Advanced doctor search filters: specialization, name, max fee, "Available Today"
- Phone number auto-formatting with +91 validation for Indian numbers
- Patients can register with phone number only (email optional)
- Doctors register with email (required)
- Login via phone (default) OR email (toggle switch)
- Show/hide password toggle on login and registration pages
- JWT token authentication (login persists across sessions)
- Rate limiting on auth endpoints (prevents brute force attacks)
- Password reset with secure token (logged to console for local testing)
- Doctor profile management with photo upload
- Phone number and WhatsApp contact for doctors
- Search and filter doctors by name or specialization
- Real-time availability: doctors set weekly schedule (multi-day selection), patients see only free slots
- Appointment booking with status workflow (pending → confirmed → completed/cancelled)
- Family members: patients can add/manage family members and book appointments on their behalf
- Repeat booking: rebook a past appointment with same doctor/details (one-click "Book Again")
- Meeting link sharing: doctor adds Google Meet/Zoom link when confirming (patient sees "Join" button)
- UPI Payment: each doctor sets own fee + UPI ID, patient pays directly via UPI app
- Prescription: doctor writes prescription via styled modal (diagnosis, medicines, tests, notes)
- Medical Reports: patient uploads test reports (PDF/image), doctor reviews and comments
- Patient complaints: patients file complaints, admin reviews and responds
- Floating WhatsApp emergency button on all pages (configurable via env var)
- Email notifications: doctor notified on new booking, patient notified on confirmation (via Resend)
- In-app notification banner: doctor sees pending appointment count on Dashboard
- Doctor rating & review system via modal (1-5 stars + text, shown on doctor profile)
- Auto-scrolling patient testimonials on homepage (with placeholders when no reviews yet)
- Admin panel: view stats, manage users, view all appointments, handle complaints
- Admin bootstrap: promote/create the first admin automatically via ADMIN_EMAIL env var (no manual database editing)
- Admin can deactivate/reactivate a doctor (hides them from patients and blocks login while keeping all records) as a safe alternative to permanent delete
- Account settings: users can update email/phone or delete their account (with confirmation modal)
- Doctor profile edit pre-fills with existing data (edit only what you need)
- Styled modal dialogs replace all browser prompts/confirms (modern UX)
- Paginated appointment history in Dashboard (Previous/Next navigation)
- Modular Dashboard architecture: each tab is a separate component for maintainability
- PWA support: installable on phone, offline caching, custom app icon
- SEO optimized: unique page titles, meta descriptions, Open Graph tags per page
- Structured data (Schema.org): MedicalBusiness, Physician, FAQPage schemas
- 10 dedicated specialization landing pages with FAQs (targets long-tail keywords)
- Homepage FAQ section with expandable questions and structured data
- Google Analytics integration for visitor tracking
- Google Search Console with sitemap (14 indexed pages)
- robots.txt configured (blocks private pages from indexing)
- Email verification for doctors (must verify email to appear in patient search)
- Dashboard verification banner with "Resend Email" button for unverified doctors
- Consultation fees displayed in ₹ (Indian Rupees)
- "Available Today" badge on doctor cards
- Share doctor profile via WhatsApp (word-of-mouth marketing)
- Booking confirmation page with full summary
- Past time slots hidden when booking for today (IST timezone — works on any server regardless of hosting region)
- Patients can replace/update uploaded report files anytime
- In-app video/audio calling (Daily.co) — private per-appointment rooms with server-issued join tokens; no login or sign-in for doctor/patient
- Audio-only mode for phone consultations (camera off by default)
- Incoming-call "ringing" notification — when one party joins, the other sees a full-screen banner + ringtone (with vibration on mobile) and can Accept/Decline
- "Join Call" button appears only on the appointment date (hidden once the day passes)
- In-app chat messaging per appointment (unread badge, ~3s refresh, optimistic instant-send)
- UPI QR code payment — doctor uploads QR, patient scans and pays
- "I Have Paid" quick confirmation + optional receipt upload
- Payment screenshot stored permanently in MongoDB (base64)
- Medical reports stored permanently in MongoDB (no file loss on redeploy)
- Block patient feature for doctors (prevents messaging from abusive patients)
- Free follow-up booking — doctor sets period (7/15/30 days), patient books without payment
- Sequential doctor workflow (Confirm → Mark Paid → Join Call → Mark Complete → Prescription)
- Step-by-step guidance messages for both patient and doctor on every appointment
- City and consultation mode (in-person/video/phone) filters on doctor search
- Google Maps "Get Directions" for in-person appointments
- Doctor name displayed with "Dr." prefix across the platform
- Bottom navigation bar for mobile (Home, Doctors, My Appts, Blog)
- Terms & Conditions and Privacy Policy pages (legal compliance)
- Medical Registration Number is mandatory for doctor profiles (existing profiles untouched until next edit)
- Bilingual consent (English + Hindi) before booking (teleconsultation agreement), enforced on both frontend and backend
- Consent recorded per appointment (timestamp + IP address) for audit/legal protection
- Calls restricted to the booked time-slot window (5 min before to 20 min after), enforced frontend + backend, so patients can't call at random times
- Doctor (moderator) can end the call for everyone; patient can leave for themselves
- Call tracking: every doctor–patient in-app call is logged (start/end/duration) for analytics
- Admin call analytics: total calls, total minutes, and per-doctor connection breakdown
- Admin announcements: broadcast dismissible banners to doctors, patients, or everyone (fee notices, policy updates, etc.)
- Appointments ordered upcoming-first (earliest) then completed/cancelled (newest first)
- Backend smoke test suite (Node built-in test runner + supertest) — `npm test` verifies health, 404s, and auth-protected routes with no database needed
- IP address logging and consent timestamp for audit/legal protection
- Soft-delete accounts (data retained for legal, user can re-register fresh)
- Responsive design (mobile + desktop)

---

## Tech Stack

### Backend
| Technology | Purpose |
|-----------|---------|
| Node.js | JavaScript runtime |
| Express.js | Web server framework |
| MongoDB | NoSQL database |
| Mongoose | MongoDB object modeling |
| JWT (jsonwebtoken) | Authentication tokens |
| bcryptjs | Password hashing |
| multer | File upload handling |
| express-rate-limit | Brute force protection |
| cors | Cross-origin requests |
| dotenv | Environment variable management |

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 18 | User interface library |
| Vite | Build tool and dev server |
| Tailwind CSS | Utility-first styling |
| React Router v6 | Client-side navigation |
| Axios | HTTP client for API calls |
| React Hot Toast | Notification popups |

---

## Project Structure

```
docconnect/
├── README.md                    ← You are here
├── HOW_IT_WORKS.md              ← Full technical documentation
├── WINDOWS_SETUP.md             ← Windows laptop setup guide
├── .gitignore                   ← Files excluded from Git
│
├── server/                      ← BACKEND
│   ├── .env                     ← Secret config (create manually after clone)
│   ├── package.json             ← Backend dependencies
│   ├── server.js                ← Entry point: starts server, connects DB, loads routes
│   │
│   ├── models/                  ← Database schemas (shape of data)
│   │   ├── User.js              ← Doctor/patient/admin accounts
│   │   ├── Appointment.js       ← Booking records + payment status
│   │   ├── Prescription.js     ← Doctor prescriptions (medicines, tests)
│   │   ├── MedicalReport.js    ← Patient uploaded test reports
│   │   ├── Complaint.js        ← Patient complaints
│   │   ├── CallLog.js          ← In-app call tracking (start/end/duration)
│   │   └── Announcement.js     ← Admin broadcast announcements
│   │
│   ├── middleware/              ← Code that runs before route handlers
│   │   ├── auth.js              ← Token verification + role checking
│   │   └── upload.js            ← File upload config (images + PDFs)
│   │
│   ├── controllers/             ← Business logic
│   │   ├── authController.js    ← Register, login, password reset, update/delete account
│   │   ├── doctorController.js  ← Profile CRUD, doctor search
│   │   ├── appointmentController.js ← Booking management + meeting links + payment
│   │   ├── availabilityController.js ← Schedule + free slot calculation
│   │   ├── familyMemberController.js ← Patient family member CRUD
│   │   ├── prescriptionController.js ← Doctor writes prescriptions
│   │   ├── reportController.js  ← Patient uploads test reports
│   │   ├── complaintController.js ← Patient complaints
│   │   ├── adminController.js   ← Admin: stats, user management, analytics
│   │   └── announcementController.js ← Admin broadcast announcements
│   │
│   ├── routes/                  ← URL → controller mapping
│   │   ├── auth.js
│   │   ├── doctor.js
│   │   ├── appointment.js
│   │   ├── availability.js
│   │   ├── familyMember.js
│   │   ├── prescription.js
│   │   ├── report.js
│   │   ├── complaint.js
│   │   ├── admin.js
│   │   └── announcement.js
│   │
│   ├── utils/                   ← Helpers
│   │   ├── sendEmail.js         ← Email notifications (Resend)
│   │   ├── formatPhone.js       ← Indian phone number formatting
│   │   └── daily.js             ← Daily.co room + join-token helper
│   │
│   ├── tests/                   ← Backend smoke tests (npm test)
│   │   └── api.test.js
│   │
│   └── uploads/                 ← Uploaded files stored here
│       └── .gitkeep
│
└── client/                      ← FRONTEND
    ├── package.json             ← Frontend dependencies
    ├── index.html               ← Single HTML page (React mounts here)
    ├── vercel.json              ← Vercel routing config
    ├── vite.config.js           ← Dev server + API proxy config
    ├── tailwind.config.js       ← CSS theme configuration
    ├── postcss.config.js        ← CSS processing
    │
    └── src/
        ├── main.jsx             ← React entry point
        ├── index.css            ← Global styles + Tailwind
        ├── App.jsx              ← Routes + layout
        │
        ├── context/
        │   └── AuthContext.jsx  ← Global auth state (login/logout)
        │
        ├── services/
        │   └── api.js           ← All API call functions
        │
        ├── components/
        │   ├── Navbar.jsx       ← Navigation bar (with PWA install button)
        │   ├── Modal.jsx        ← Reusable ConfirmModal & PromptModal
        │   ├── ChatBox.jsx      ← In-app messaging per appointment
        │   ├── VideoCall.jsx    ← Daily.co video/audio calling integration
        │   ├── SEO.jsx          ← Per-page title, description, Open Graph tags
        │   ├── StructuredData.jsx ← Schema.org JSON-LD markup
        │   └── WhatsAppButton.jsx ← Floating emergency WhatsApp button
        │
        └── pages/
            ├── Home.jsx         ← Landing page (FAQs + structured data)
            ├── Login.jsx        ← Login form
            ├── Register.jsx     ← Registration form (with phone number)
            ├── ForgotPassword.jsx ← Request password reset
            ├── ResetPassword.jsx  ← Set new password
            ├── DoctorList.jsx   ← Browse/search doctors (with filters)
            ├── DoctorProfile.jsx ← View single doctor + Schema.org
            ├── SpecializationPage.jsx ← SEO landing pages per specialty
            ├── BookAppointment.jsx ← Book with slot selection + family member
            ├── BookingConfirmation.jsx ← Post-booking summary
            ├── Dashboard.jsx    ← Main dashboard layout + appointments tab
            ├── dashboard/       ← Dashboard sub-components
            │   ├── DoctorAvailability.jsx
            │   ├── DoctorPatientReports.jsx
            │   ├── PatientFamilyMembers.jsx
            │   ├── PatientPrescriptions.jsx
            │   ├── PatientReports.jsx
            │   ├── PatientComplaints.jsx
            │   └── AccountSettings.jsx
            └── AdminDashboard.jsx ← Admin panel
```

---

## Prerequisites

Install these on your machine before running the app:

### 1. Node.js (v18 or higher)
- Download: https://nodejs.org (choose LTS version)
- Verify: `node --version` (should show v18.x or higher)
- npm comes bundled with Node.js: `npm --version`

### 2. Git
- Download: https://git-scm.com
- Verify: `git --version`
- Usually pre-installed on Mac/Linux

### 3. MongoDB (choose ONE option)

**Option A: MongoDB Atlas (Cloud — Recommended)**
- Free, no installation, works anywhere with internet
- Setup: https://www.mongodb.com/atlas
- Steps:
  1. Create free account
  2. Create a free cluster (choose any region close to you)
  3. Under "Database Access": create a user with username + password
  4. Under "Network Access": click "Allow Access from Anywhere" (for development)
  5. Click "Connect" → "Connect your application" → copy the connection string
  6. Replace `<password>` in the string with your actual password

**Option B: MongoDB Community (Local)**
- Download: https://www.mongodb.com/try/download/community
- After installing, start it with: `mongod`
- Connection string: `mongodb://localhost:27017/docconnect`

### 4. A Code Editor
- VS Code (free): https://code.visualstudio.com
- Or any editor you prefer

---

## Local Setup (Step by Step)

### Step 1: Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### Step 2: Setup the Backend

```bash
cd server
npm install
```

This downloads all libraries listed in package.json (creates a node_modules folder).

### Step 3: Create the .env file

The .env file contains secret configuration. It's NOT in the repository (security).
Create it manually inside the `server/` folder:

```bash
# Create the file (Mac/Linux)
touch .env

# Or create it manually in your editor
```

Add this content to `server/.env`:

```
PORT=5000
MONGODB_URI=your_mongodb_connection_string_here
JWT_SECRET=any_random_string_like_this_abc123xyz789
```

Replace `your_mongodb_connection_string_here` with:
- Atlas: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/docconnect`
- Local: `mongodb://localhost:27017/docconnect`

### Step 4: Setup the Frontend

```bash
cd ../client
npm install
```

### Step 5: You're ready to run!

---

## Running the Application

You need TWO terminal windows/tabs running simultaneously:

### Terminal 1: Start the Backend

```bash
cd server
npm start
```

You should see:
```
DocConnect Server is running!
URL: http://localhost:5000
Connected to MongoDB successfully!
```

If you see "MongoDB connection error" — check your .env MONGODB_URI.

### Terminal 2: Start the Frontend

```bash
cd client
npm run dev
```

You should see:
```
VITE v5.x.x ready
Local: http://localhost:5173
```

### Step 3: Open in Browser

Go to: **http://localhost:5173**

You should see the DocConnect landing page!

---

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| PORT | No (default 5000) | Backend server port | 5000 |
| MONGODB_URI | Yes | Database connection string | mongodb+srv://user:pass@cluster.mongodb.net/docconnect |
| JWT_SECRET | Yes | Secret key for token signing (any random string) | my_super_secret_key_12345 |
| NODE_ENV | No | Environment mode | development |
| RESEND_API_KEY | No | Resend email API key (enables email notifications) | re_xxxx... |
| ADMIN_EMAIL | No | Email promoted to admin on startup (auto-creates the account if it doesn't exist) | admin@example.com |
| ADMIN_PASSWORD | No | Password used only when auto-creating a new admin account | (strong password) |
| ADMIN_NAME | No | Display name for an auto-created admin account | Administrator |
| DAILY_API_KEY | No | Daily.co API key (enables in-app video/audio calls) | (secret, server only) |
| DAILY_DOMAIN | No | Your Daily.co subdomain | promedicoz.daily.co |
| VITE_WHATSAPP_NUMBER | No | WhatsApp number for floating button (frontend) | 919997019900 |
| VITE_API_URL | No | Backend API URL for production frontend | https://your-backend.onrender.com/api |

---

## API Endpoints

### Authentication
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /api/auth/register | Public | Create account |
| POST | /api/auth/login | Public | Log in, get token |
| GET | /api/auth/me | Protected | Get own profile |
| POST | /api/auth/forgot-password | Public | Request reset link |
| PUT | /api/auth/reset-password/:token | Public | Set new password |
| PUT | /api/auth/update-account | Protected | Change email/phone |
| DELETE | /api/auth/delete-account | Protected | Delete own account |
| GET | /api/auth/verify-email/:token | Public | Verify doctor email via link |
| POST | /api/auth/resend-verification | Protected | Resend verification email |

### Doctors
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/doctors | Public | Browse/search doctors |
| GET | /api/doctors/:id | Public | View doctor profile |
| PUT | /api/doctors/profile | Doctor only | Update own profile |

### Appointments
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /api/appointments | Patient only | Book appointment (supports family member + repeat; records consent) |
| GET | /api/appointments/my | Protected | View my appointments |
| GET | /api/appointments/incoming-calls | Protected | Poll for an incoming call (ringing) |
| GET | /api/appointments/:id | Protected | View single appointment |
| GET | /api/appointments/:id/video-token | Protected | Get Daily.co room URL + join token (slot-window enforced) |
| POST | /api/appointments/:id/call-log | Protected | Start a call log (doctor connection) |
| PUT | /api/appointments/:id/call-log/:logId/end | Protected | Finalize a call log with duration |
| PUT | /api/appointments/:id/status | Doctor only | Confirm/complete appointment |
| PUT | /api/appointments/:id/call | Protected | Set call active/inactive (ringing signal) |
| PUT | /api/appointments/:id/cancel | Patient only | Cancel booking |
| PUT | /api/appointments/:id/payment | Doctor only | Mark payment received |

### Family Members
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/family-members | Patient only | List my family members |
| POST | /api/family-members | Patient only | Add a family member |
| PUT | /api/family-members/:id | Patient only | Update a family member |
| DELETE | /api/family-members/:id | Patient only | Remove a family member |

### Availability
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/availability | Doctor only | View own schedule |
| PUT | /api/availability | Doctor only | Set weekly schedule |
| GET | /api/availability/:doctorId/slots?date=YYYY-MM-DD | Public | Get free slots |

### Prescriptions
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /api/prescriptions | Doctor only | Create prescription |
| GET | /api/prescriptions/my | Protected | View my prescriptions |
| GET | /api/prescriptions/appointment/:id | Protected | Get prescription for appointment |
| PUT | /api/prescriptions/:id | Doctor only | Update prescription |

### Medical Reports
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /api/reports | Patient only | Upload test report (with file) |
| GET | /api/reports/my | Protected | View my reports |
| PUT | /api/reports/:id/review | Doctor only | Review/comment on report |

### Complaints
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /api/complaints | Patient only | File a complaint |
| GET | /api/complaints/my | Patient only | View my complaints |
| GET | /api/complaints | Admin only | View all complaints |
| PUT | /api/complaints/:id | Admin only | Update status/respond |

### Admin
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/admin/stats | Admin only | Dashboard stats |
| GET | /api/admin/users | Admin only | List all users |
| GET | /api/admin/appointments | Admin only | List all appointments |
| GET | /api/admin/analytics | Admin only | Revenue + call analytics (calls, minutes, per-doctor) |
| DELETE | /api/admin/users/:id | Admin only | Delete a user (permanent) |
| PUT | /api/admin/users/:id/suspension | Admin only | Deactivate/reactivate a user (keeps records) |

### Announcements
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/announcements | Protected | Active announcements for my role (banner) |
| GET | /api/announcements/all | Admin only | List all announcements |
| POST | /api/announcements | Admin only | Create an announcement |
| PUT | /api/announcements/:id | Admin only | Update / toggle active |
| DELETE | /api/announcements/:id | Admin only | Delete an announcement |

---

## Testing the App

### Quick test after setup:

1. Open http://localhost:5000/api/health in browser
   - Should show: `{"status":"OK","database":"Connected"}`
   - If database is "Disconnected", fix your MONGODB_URI

2. Open http://localhost:5173 in browser
   - Should show the DocConnect landing page

### Full test flow:

1. **Register a doctor** — click Register, choose "Doctor", fill form
2. **Register a patient** — open incognito/another browser, register as patient
3. **Doctor: set profile** — go to Dashboard → Edit Profile → fill details
4. **Doctor: set availability** — Dashboard → Availability → add time slots → save
5. **Patient: browse doctors** — click "Find Doctors"
6. **Patient: book appointment** — click a doctor → Book → pick date (slots appear!) → confirm
7. **Doctor: confirm appointment** — Dashboard → see pending booking → click Confirm
8. **Doctor: upload thesis** — Dashboard → Publications → New Publication → fill and publish
9. **Anyone: view publication** — click Publications in navbar → click a paper → see full content
10. **Test password reset** — Logout → Login → "Forgot password?" → enter email → check SERVER TERMINAL for the link → copy link to browser → set new password

### Testing with Postman (optional, for API testing):

1. Download Postman: https://www.postman.com
2. Send POST to http://localhost:5000/api/auth/register with JSON body:
   ```json
   { "name": "Dr. Test", "email": "test@test.com", "password": "123456", "role": "doctor" }
   ```
3. Copy the token from the response
4. Use it in Authorization header for protected routes: `Bearer <token>`

---

## Troubleshooting

### "MongoDB connection error"
- Check MONGODB_URI in .env is correct
- Atlas: ensure "Network Access" allows your IP (or 0.0.0.0/0 for development)
- Local: ensure `mongod` is running

### "Module not found" error
- Run `npm install` in the relevant folder (server/ or client/)

### Blank page in browser
- Open browser console (F12 → Console tab) for error details
- Ensure both backend AND frontend are running

### "CORS error" or "Network Error"
- Backend must be running on port 5000
- Frontend must be running on port 5173
- The Vite proxy in vite.config.js handles the connection

### Port already in use
- Another process is using port 5000 or 5173
- Kill it: `lsof -ti:5000 | xargs kill` (Mac/Linux)
- Or change PORT in .env

### "Cannot POST /api/auth/register" returns 404
- Check that server.js properly loads the route files
- Restart the server after any backend changes

### Password reset link doesn't appear
- Look at the TERMINAL where the server is running (not the browser console)
- The link is printed there with `console.log`

---

## Deployment Guide

When you're ready to put the app online so others can access it:

### Database: MongoDB Atlas (you may already have this)
- Free tier: 512MB storage, shared cluster
- Keep using the same Atlas cluster from development

### Backend Hosting Options

| Service | Free Tier | Best For | Limitations |
|---------|-----------|----------|-------------|
| **Render** | Yes (750 hrs/month) | Beginners | Spins down after inactivity (cold starts) |
| **Railway** | $5 free credit/month | Small projects | Credit-based |
| **AWS EC2** | 12 months free (t2.micro) | Production / Learning AWS | Requires more setup |
| **AWS Elastic Beanstalk** | Free tier eligible | Managed Node.js hosting | AWS ecosystem |
| **DigitalOcean App Platform** | $0 for static, $5/mo for backend | Simple deployment | Paid |

### Frontend Hosting Options

| Service | Free Tier | Best For |
|---------|-----------|----------|
| **Vercel** | Yes (generous) | React apps (one-click deploy from GitHub) |
| **Netlify** | Yes (generous) | Static sites + React |
| **AWS S3 + CloudFront** | Free tier eligible | Production / Learning AWS |
| **AWS Amplify** | Free tier eligible | Full-stack React on AWS |

### About AWS (Amazon Cloud)

AWS is a solid choice, especially if you want to learn cloud infrastructure (a highly valued skill in the industry). Here's a realistic breakdown:

**Pros of AWS:**
- Industry standard (most companies use it)
- 12-month free tier for new accounts
- Teaches you real cloud skills (useful for career)
- Extremely scalable if your project grows

**Cons of AWS:**
- Steeper learning curve than Render/Vercel
- Easy to accidentally incur charges if not careful
- Overkill for a simple learning project
- More configuration needed

**AWS services you'd use:**
| Service | Purpose | Free Tier |
|---------|---------|-----------|
| EC2 (or Elastic Beanstalk) | Run your Node.js backend | 750 hrs/month for 12 months (t2.micro) |
| S3 + CloudFront | Host React frontend | 5GB storage, 15GB transfer |
| MongoDB Atlas | Database (not AWS, but works with it) | Always free (shared tier) |
| Or: Amazon DocumentDB | AWS-native MongoDB alternative | NOT free (expensive) |

**My recommendation:**

| Your Goal | Use This |
|-----------|----------|
| Just want it online quickly | Render (backend) + Vercel (frontend) |
| Want to learn cloud/AWS | AWS EC2 + S3 (steeper but valuable) |
| Planning to grow this into a real product | AWS (Elastic Beanstalk or ECS) |
| Budget-conscious | Render + Vercel + Atlas (all free) |

For learning purposes, I'd suggest: **Start with Render + Vercel (free, instant).** Once you're comfortable with deployment, try migrating to AWS to learn cloud skills. Don't fight two battles at once (learning web dev AND learning AWS simultaneously).

---

## Learning Roadmap

### What this project teaches you:

| Concept | Where you'll see it |
|---------|-------------------|
| REST API design | All route files |
| Database modeling | Model files (relationships, schemas) |
| Authentication & security | auth middleware, bcrypt, JWT |
| File uploads | upload middleware |
| React component architecture | All page/component files |
| State management | AuthContext |
| API integration | services/api.js |
| Responsive design | Tailwind classes throughout |
| Form handling | Login, Register, BookAppointment |
| Pagination | DoctorList, ThesisList |
| Role-based access | ProtectedRoute, authorize middleware |

### Suggested next steps (after testing):
1. Fix any bugs you find while testing
2. Add doctor reviews/ratings (new model, new routes, new page)
3. Deploy to Render + Vercel (experience deployment)
4. Try AWS deployment (learn cloud)
5. Add email notifications (learn third-party API integration)

---

## Contributing

This is a learning project. Feel free to experiment, break things, and rebuild. That's how you learn.

---

## License

MIT — use this code however you like.
