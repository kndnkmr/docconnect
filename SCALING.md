# ProMedicoz — Scaling Guide

A practical, ordered plan for scaling the platform as real users arrive. Nothing
here is needed right now — it's the roadmap for when growth justifies it.

---

## Current setup (as of this writing)

| Layer | Service | Tier | Notes |
|-------|---------|------|-------|
| Frontend | Vercel | Free | Auto-deploys `main`. Static/CDN — scales fine. |
| Backend | Render | **Starter (~$7/mo, ~₹600/mo)** | Always-on — no cold starts (health check ~0.3-0.8s). 512 MB RAM, 0.5 CPU. |
| Database | MongoDB Atlas (M0) | Free | 512 MB, shared CPU, 500 connection limit. Mumbai region. |
| Images/files | Cloudinary | Free | QR codes, payment screenshots, medical reports. 25 GB storage/bandwidth. |
| Video/Audio calls | Daily.co | Free | 10,000 participant-minutes/month. |
| Email | Resend | Free | Verification + password reset emails. |

**Current data footprint:** app database (`docconnect`) is ~1–3 MB. Images are
now stored on Cloudinary (not in the DB), so records stay small.

---

## What will hit limits first (in order)

### 1. Render backend ✅ Done
Upgraded to the Render **Starter** plan (~$7/month, ~₹600/month, paid via card
after enabling international transactions). Confirmed fix: health check now
responds in ~0.3-0.8s instead of the old ~50s cold-start delay.
- Always-on — no more cold starts
- More CPU/RAM headroom
- Keeps WebSocket connections alive (needed for #2 below)

### 2. Polling → WebSockets ✅ Done
Added **Socket.io** on top of the existing REST + polling APIs for instant chat
delivery and instant call ringing, cutting server load from constant polling.

**What was built:**
- `server/socket.js` — Socket.io server attached to the same HTTP server as
  Express. Each connecting socket is authenticated with the user's JWT (same
  verification logic as `middleware/auth.js`).
- Every connected user auto-joins a `user:<userId>` room (used to push
  incoming-call/call-ended/unread-badge events to them on any page).
- A socket joins an `appointment:<id>` room only after the client asks
  (`join-appointment`), and only once we confirm that user is the doctor or
  patient on that appointment — so chat events never leak to the wrong person.
- `messageController.js` emits `new-message` to the appointment room and
  `message-notification` to the recipient's user room on every send.
- `appointmentController.js` emits `incoming-call` / `call-ended` to the other
  participant's user room from `setCallStatus`.
- Frontend (`client/src/services/socket.js`) — one shared socket connection,
  reused by `ChatBox.jsx` and `Dashboard.jsx`.
- **Polling kept as an automatic fallback**, just at a lower frequency now
  that it's a safety net rather than the primary delivery path: chat polling
  3s → 15s, incoming-call polling 5s → 20s. If the socket connection drops or
  is blocked by a network/proxy, the UI still updates within that window.
- At multi-instance scale, add a Redis adapter for Socket.io (far off — not
  needed on a single Render instance).

**Verified:** server test suite (10/10) still passes, client build succeeds,
production health check OK post-deploy, and the live Socket.io endpoint was
confirmed to correctly reject an invalid JWT on the production URL. Full
two-account realtime testing (confirming instant chat/ringing between an
actual doctor and patient account) still needs manual verification in the
browser — that wasn't done as part of this change.

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

- [x] Real users report the app feels slow to wake / respond → **upgrade Render (always-on)** — done
- [x] Chat/ringing delay feels sluggish to real users → **WebSockets** (with Render upgrade) — done
- [ ] Daily.co usage nears 10,000 min/month → move to a Daily paid plan
- [ ] Cloudinary nears 25 GB → paid plan (very far off)
- [ ] MongoDB nears 512 MB or 500 connections, or queries slow → **paid Atlas tier + indexes**

---

## Phone-only patient gaps ✅ Fixed

Patients can register with phone only (no email required) — a real, deliberate
choice to reduce signup friction. That surfaced two gaps that were only found
by explicitly checking the code, not by assumption:

**1. Password reset was a dead end for phone-only accounts.** `forgotPassword`
only accepted an email and looked the user up by it — a patient with no email
on file had no self-service way to recover their account.
- Fixed: `forgotPassword` now accepts `phone` too. If the account has an
  email, the link is emailed as before. If not, the patient is told to
  reach out via WhatsApp instead of hitting a dead end.
- Added a manual recovery assist for admins: `POST /api/admin/users/:id/reset-link`
  generates a valid reset link (emails it automatically if the account has an
  email, otherwise gives a link to copy and relay manually, e.g. via
  WhatsApp) — surfaced as a "Reset Link" button in Admin → Users.

**2. Appointment confirmations were silently skipped for phone-only patients.**
`sendAppointmentConfirmation` only fired `if (patient.email)` — no email meant
no notification at all when a doctor confirmed/rejected an appointment; the
patient would only find out by opening the dashboard themselves.
- Fixed by the Web Push rollout below, which doesn't depend on email or phone
  at all — it's tied to browser permission, not an identity channel.

## Web Push Notifications ✅ Done

Added browser push notifications (VAPID — no third-party provider account,
no per-message cost, no DLT registration) for appointment confirmed/cancelled,
new chat messages, and incoming call ringing. This was the practical
alternative to Phone+OTP/SMS reminders (deferred below for cost reasons) —
push works for every patient regardless of whether they gave an email or
just a phone number, since permission is granted per-browser.

**What was built:**
- `server/utils/push.js` — sends via `web-push`, using VAPID keys from env.
  Cleans up subscriptions automatically when the browser reports them as
  expired (404/410).
- `server/controllers/pushController.js` + `routes/push.js` — public-key,
  subscribe, unsubscribe endpoints.
- `pushSubscriptions` field added to the `User` model (one entry per
  browser/device that granted permission).
- Wired into: appointment confirmed/cancelled (notifies patient), patient
  cancels (notifies doctor), incoming call (notifies the other participant,
  alongside the existing Socket.io event), new chat message (notifies the
  recipient, alongside Socket.io).
- Frontend: `client/src/services/push.js` (subscribe/unsubscribe helper),
  `client/public/sw.js` handles the `push` and `notificationclick` events, a
  dismissible nudge banner on the Dashboard asks permission once.
- Logout unsubscribes the browser from push (and disconnects the socket) —
  otherwise a shared device could keep showing a previous user's private
  notifications after they've logged out.
- All of this is additive: email, Socket.io, and REST polling remain as
  fallbacks if push isn't enabled, supported, or the VAPID keys aren't set.

**Setup required in production:** `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` /
`VAPID_SUBJECT` need to be added to Render's environment variables (they're
only in the local `.env` so far, since it's gitignored). Until they're added,
`/api/push/public-key` returns an empty key and push silently stays disabled
— nothing breaks, it just doesn't do anything yet in production.

**Verified:** server test suite (10/10), client build, server boot with push
configured (`/api/push/public-key` returns the key), production health check.
Full end-to-end push delivery (a real device receiving a notification) still
needs manual verification once the VAPID env vars are added to Render — that
wasn't done as part of this change.

## Other future improvements (not urgent)

- **Appointment reminders** (email before the slot) to reduce no-shows — uses existing Resend.
- **Daily.co webhooks** for exact call durations (current call logs can miss abrupt disconnects).
- **Payment gateway (e.g. Razorpay)** if you ever want verified payments / to take a commission (currently direct UPI, doctor confirms manually).
- **Error monitoring** (e.g. Sentry) for production visibility.
- **Deeper automated tests** (current suite is smoke-level: health, 404s, auth-protected routes).
- **Phone + OTP login** — see cost breakdown below.

---

## Phone + OTP login — cost estimate (deferred)

Password login already got a real UX pass (autofill support, autofocus, numeric
keypad, SVG icons). OTP login is a genuine upgrade on top of that — common on
Indian consumer apps — but it's a paid feature with a real setup step, so it's
deferred until there's a concrete need.

**One-time setup — DLT registration (legally required in India for any
commercial/OTP SMS; messages are blocked without it):**

| Item | Cost |
|------|------|
| Entity registration | ₹5,000–6,000 + GST |
| Sender ID (header) + template registration | Often bundled or a few thousand more — several providers assist for free during onboarding |
| **Total one-time** | **≈ ₹5,000–10,000** |
| Approval time | A few days to ~a week (not instant) |

**Ongoing — per-OTP SMS cost:**

| Provider type | Cost per OTP |
|----------------|--------------|
| Indian providers (MSG91, Message Central, SMSCountry) | ₹0.10–0.20 |
| International (Twilio) | ~₹0.45 (avoid for India-only traffic — 3–4x pricier) |

**What that means at realistic volume:**

| Logins/month | Monthly SMS cost |
|---------------|-------------------|
| 100 | ₹10–20 |
| 1,000 | ₹100–200 |
| 10,000 | ₹1,000–2,000 |

**Takeaway:** the ongoing per-message cost is negligible even at real usage. The
actual cost is the one-time ₹5,000–10,000 DLT registration plus the approval wait.

**Trigger to revisit:** steady daily signups AND real users reporting forgotten
passwords as friction. Not worth it before that — same principle as the other
deferred items above (don't pay for infrastructure ahead of real demand).
