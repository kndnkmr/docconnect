# DocConnect — Doctor Consultation Platform

A full-stack web application where doctors register profiles, patients browse and book consultations, and doctors share research publications publicly.

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
- JWT token authentication (login persists across sessions)
- Password reset with secure token (logged to console for local testing)
- Doctor profile management with photo upload
- Search and filter doctors by name or specialization
- Real-time availability: doctors set weekly schedule, patients see only free slots
- Appointment booking with status workflow (pending → confirmed → completed/cancelled)
- Thesis/publication upload with shareable public links, PDF support, tags, and view counter
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
├── .gitignore                   ← Files excluded from Git
│
├── server/                      ← BACKEND
│   ├── .env                     ← Secret config (create manually after clone)
│   ├── package.json             ← Backend dependencies
│   ├── server.js                ← Entry point: starts server, connects DB, loads routes
│   │
│   ├── models/                  ← Database schemas (shape of data)
│   │   ├── User.js              ← Doctor/patient accounts
│   │   ├── Appointment.js       ← Booking records
│   │   └── Thesis.js            ← Research publications
│   │
│   ├── middleware/              ← Code that runs before route handlers
│   │   ├── auth.js              ← Token verification + role checking
│   │   └── upload.js            ← File upload config (images + PDFs)
│   │
│   ├── controllers/             ← Business logic
│   │   ├── authController.js    ← Register, login, password reset
│   │   ├── doctorController.js  ← Profile CRUD, doctor search
│   │   ├── appointmentController.js ← Booking management
│   │   ├── thesisController.js  ← Publication management
│   │   └── availabilityController.js ← Schedule + free slot calculation
│   │
│   ├── routes/                  ← URL → controller mapping
│   │   ├── auth.js
│   │   ├── doctor.js
│   │   ├── appointment.js
│   │   ├── thesis.js
│   │   └── availability.js
│   │
│   └── uploads/                 ← Uploaded files stored here
│       ├── .gitkeep
│       └── thesis/.gitkeep
│
└── client/                      ← FRONTEND
    ├── package.json             ← Frontend dependencies
    ├── index.html               ← Single HTML page (React mounts here)
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
        │   └── Navbar.jsx       ← Navigation bar
        │
        └── pages/
            ├── Home.jsx         ← Landing page
            ├── Login.jsx        ← Login form
            ├── Register.jsx     ← Registration form
            ├── ForgotPassword.jsx ← Request password reset
            ├── ResetPassword.jsx  ← Set new password
            ├── DoctorList.jsx   ← Browse/search doctors
            ├── DoctorProfile.jsx ← View single doctor
            ├── BookAppointment.jsx ← Book with real-time slot selection
            ├── Dashboard.jsx    ← Appointments, profile, publications, availability
            ├── ThesisList.jsx   ← Browse public publications
            └── ThesisDetail.jsx ← Read a publication via share link
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

### Doctors
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/doctors | Public | Browse/search doctors |
| GET | /api/doctors/:id | Public | View doctor profile |
| PUT | /api/doctors/profile | Doctor only | Update own profile |

### Appointments
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /api/appointments | Patient only | Book appointment |
| GET | /api/appointments/my | Protected | View my appointments |
| GET | /api/appointments/:id | Protected | View single appointment |
| PUT | /api/appointments/:id/status | Doctor only | Confirm/complete |
| PUT | /api/appointments/:id/cancel | Patient only | Cancel booking |

### Availability
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/availability | Doctor only | View own schedule |
| PUT | /api/availability | Doctor only | Set weekly schedule |
| GET | /api/availability/:doctorId/slots?date=YYYY-MM-DD | Public | Get free slots |

### Publications
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/thesis | Public | Browse publications |
| GET | /api/thesis/share/:slug | Public | View via share link |
| GET | /api/thesis/my | Doctor only | My publications |
| POST | /api/thesis | Doctor only | Create publication |
| PUT | /api/thesis/:id | Doctor only | Edit publication |
| DELETE | /api/thesis/:id | Doctor only | Delete publication |

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
