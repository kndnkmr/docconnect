# ProMedicoz — Scaling Guide

A practical, ordered plan for scaling the platform as real users arrive. Nothing
here is needed right now — it's the roadmap for when growth justifies it.

---

## Current setup (as of this writing)

| Layer | Service | Tier | Notes |
|-------|---------|------|-------|
| Frontend | Vercel | Free | Auto-deploys `main`. Static/CDN — scales fine. |
| Backend | Render | Free | **Sleeps after 15 min inactivity** (~50s cold start). Single small instance. |
| Database | MongoDB Atlas (M0) | Free | 512 MB, shared CPU, 500 connection limit. Mumbai region. |
| Images/files | Cloudinary | Free | QR codes, payment screenshots, medical reports. 25 GB storage/bandwidth. |
| Video/Audio calls | Daily.co | Free | 10,000 participant-minutes/month. |
| Email | Resend | Free | Verification + password reset emails. |

**Current data footprint:** app database (`docconnect`) is ~1–3 MB. Images are
now stored on Cloudinary (not in the DB), so records stay small.

---

## What will hit limits first (in order)

### 1. Render backend (the first real bottleneck) 🔴
The free instance sleeps and is a single small box. Chat polls every 3s and call
ringing every 5s per open dashboard, so many concurrent users create constant load.

**Fix when:** you have steady daily active users, or notice slowness / the 50s
cold-start delay hurting real users.

**Action:** upgrade Render to a paid **always-on** plan (~$7/month starter).
- Removes cold starts (no more 50s first-request delay)
- More CPU/RAM headroom
- Keeps WebSocket connections alive (see #2)

### 2. Polling → WebSockets 🟡
Once on an always-on server, replace polling with **Socket.io** for instant chat
and instant call ringing, and to cut server load.

**Why paired with #1:** WebSockets need an always-on server. On the free tier the
instance sleeps and drops the connection, so there's little benefit until Render
is upgraded. Do both together.

**Action (implementation outline):**
- Add Socket.io to the backend; authenticate each socket with the user's JWT
- One room per appointment (only the right doctor/patient receive events)
- Frontend: chat + ringing listen for pushed events instead of polling
- **Keep polling as a fallback** so it degrades gracefully if a socket drops
- At multi-instance scale, add a Redis adapter for Socket.io (far off)

### 3. MongoDB paid tier 🟢 (much later)
Free M0 (512 MB, shared CPU, 500 connections) comfortably handles the first several
thousand users now that images are on Cloudinary. Upgrade only when you approach the
storage/connection/performance limits.

**Action:** move to a shared (M2/M5) or dedicated (M10) Atlas cluster. Add indexes
for any slow queries; consider archiving very old appointments/messages.

---

## Rough capacity on the current free stack (post-Cloudinary)

With images external, records are ~0.5–2 KB each:

| Data | Example volume | Approx size |
|------|----------------|-------------|
| Users (100 doctors + 5,000 patients) | 5,100 | ~10 MB |
| Appointments | 20,000 | ~20 MB |
| Chat messages | 50,000 | ~25 MB |
| Reports / call logs / etc. | — | ~15 MB |
| **Total** | | **~70 MB** (of 512 MB) |

So **MongoDB storage is not the near-term constraint** — Render performance is.

---

## Upgrade triggers (quick checklist)

- [ ] Real users report the app feels slow to wake / respond → **upgrade Render (always-on)**
- [ ] Chat/ringing 3–5s delay feels sluggish to real users → **WebSockets** (with Render upgrade)
- [ ] Daily.co usage nears 10,000 min/month → move to a Daily paid plan
- [ ] Cloudinary nears 25 GB → paid plan (very far off)
- [ ] MongoDB nears 512 MB or 500 connections, or queries slow → **paid Atlas tier + indexes**

---

## Other future improvements (not urgent)

- **Appointment reminders** (email before the slot) to reduce no-shows — uses existing Resend.
- **Daily.co webhooks** for exact call durations (current call logs can miss abrupt disconnects).
- **Payment gateway (e.g. Razorpay)** if you ever want verified payments / to take a commission (currently direct UPI, doctor confirms manually).
- **Error monitoring** (e.g. Sentry) for production visibility.
- **Deeper automated tests** (current suite is smoke-level: health, 404s, auth-protected routes).
