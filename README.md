# ProMedicoz — Doctor Consultation Platform

A full-stack web application where doctors register profiles, patients browse and book consultations, and doctors can be reached directly via WhatsApp for emergencies.

**Live Website:** https://www.promedicoz.in (custom domain) | https://docconnect-mocha.vercel.app (backup)

Built as a learning project covering: authentication, CRUD operations, file uploads, role-based access, relational data, and responsive UI.

**Related docs:** [SCALING.md](./SCALING.md) — the ordered scale-up plan (Render → WebSockets → Atlas) and upgrade triggers for when real traffic arrives.

---

## Recent Updates

Notable improvements layered on since the core build (newest first):

- **Backend moved to Render Singapore** — next to the Mumbai database and Indian users (was Oregon, USA). Doctor list ~1.5 s → ~0.4 s, other requests 2–3× faster; same plan and price. The server also now keeps retrying the database connection every 30 s instead of giving up at startup.
- **Call alarm + live updates** — at a video/phone appointment both people get "⏰ starts in 10 min", then an alarm-style notification at the start time that stays on screen, vibrates long, re-alerts up to 3 times ~40 s apart (stops as soon as either side joins) and has **Join now** (opens the call directly) / **In 5 min** (rings that person again in 5 minutes). Sent high-priority so phones don't delay it. With the app open: a phone-style ring (sound unlocked by the first tap), repeating vibration and a flashing "📞 Calling…" tab title. Each video/phone card within 48 h shows **Call alerts** status with one-tap **Turn on** / **🔔 Test my alarm** (rings your own phone now) and iPhone "add to Home Screen" help. If someone hasn't joined 2 minutes in, the doctor gets **📞 Call patient / 💬 WhatsApp patient** and the patient gets **Message doctor / WhatsApp support**. **Prescriptions and every appointment change now appear live** on the other side's Dashboard (any tab): "💊 Your doctor sent your prescription · View" and a "💊 Prescription ready" card, with a "● Live" indicator and automatic catch-up when the phone wakes or the connection returns. Limits: a website can't override silent mode; iPhone needs ProMedicoz on the Home Screen for notifications.
- **Pick up where you left off** — nobody fills a form twice. The booking form, register form (name/phone/role, never the password) and prescription box save a draft on the device as you type; coming back restores it ("↩ Picked up where you left off · Start fresh"), and the booking slot is re-checked against the live free list. The patient Dashboard shows "Continue where you left off"; the booking form's "Add family member" / "Account Settings" links come back with "← Back to your booking". The **doctor profile autosaves to the server** (~1 s after typing stops, "✓ All changes saved"), partial profiles are allowed (the checklist shows "5 of 8 done · Left: …"), and a mistyped field is shown inline and held back while the rest saves. An expired login now shows one "Please log in again — your work is saved" banner and returns to the same page. Drafts are device-only, per account, deleted on logout and after a successful submit, and expire (booking 24 h, register 2 h, prescription/profile 7 days).
- **Double-booking guard actually on** — the database rule that stops two active bookings for the same doctor + date + time had a filter MongoDB rejects (`$ne`), so it was never created. Now built with `status > 'cancelled'` (= pending/confirmed/completed), verified on startup, and shown on Admin → Overview ("🛡 Double-booking guard: ✓ On", with a "Turn on" button if ever off).
- **Booking shows only the doctor's own consultation types** (first one pre-selected; a single type is shown as a note; the server refuses others) and **one free follow-up per visit** (the card shows "✓ Free follow-up booked: date"; a cancelled follow-up frees it again; paid "Book again" unchanged).
- **Admin "🚨 Needs help"** — the server finds patients who may be stuck and groups them: slot soon but not confirmed, patient says paid but doctor hasn't confirmed, confirmed but unpaid within 2 h, slot passed still open, paid then cancelled (refund check), patients with no mobile number. Each row has one-tap Confirm / Payment help / Help patient / pre-filled WhatsApp. New automatic reminders: doctor "please confirm" (pending 3 h after booking or 4 h before the slot) and patient "please pay" (confirmed, unpaid, within 2 h), once each. Admin Appointments gained search by Patient ID/name/phone across all appointments, a payment filter and "Load more".
- **Payments with no dead ends** — the patient's payment box has a next step in every state: one-tap "Pay with UPI app" on phones (amount + Patient ID in the note), QR that enlarges in-page (Back closes it), upload screenshot (counts as "I've paid"), or type the 12-digit UPI reference (UTR); while waiting: add/replace proof, show QR again, "I haven't paid yet", "Remind doctor" (after 2 h, every 6 h) and WhatsApp support. The doctor is actually notified (push + live refresh); doctor nudged at 3 h and admin emailed at 24 h automatically. Admin → Appointments → **💳 Payment help** shows the receipt/UTR and can mark paid (on the doctor's behalf, with a note) or reset.
- **Server validation & authorization audit** — public doctor endpoints no longer return login tokens/email/push endpoints/login IP/block list; deleted/suspended accounts are refused even with an old login; booking and reschedule only accept a slot the doctor's hours actually offer (not past, not started, real date) with a bookable doctor, and refuse patients the doctor blocked; free follow-ups need the patient's own original appointment; payment, call-ringing, meeting-link, prescription, push-subscription and account/medical/profile updates all validate their input (phone/email clash checks shared in `utils/contactChecks.js`).
- **Admin "🤝 Help patient" + "+ New patient"** — support can edit a patient's details, medical info and family, and book on their behalf (after the patient agrees on a call/WhatsApp; stored as `consentBy: 'admin'`), or create an account for someone who can't register (they get a 48-hour set-password link).
- **Phone mandatory for patients; clearer login** — patients must give a mobile number (email optional). Coming from "Book", login first asks "Have you used ProMedicoz before?", and a patient phone login says plainly whether the number isn't registered or the password is wrong (with one-tap "create account with this number" and WhatsApp help after two tries).
- **Caregiver view ("Parivaar ki dawai")** — for an account that books for family, every prescription now says who it's for ("👵 For: Mummy"), with a person filter, and a "Family's medicines today" screen groups today's medicines from all running prescriptions by morning/afternoon/night and person, plus "coming up" (last course days, free follow-ups, advised tests), one reminder file for everyone, WhatsApp text and a print-for-the-fridge view. Same data the account already had; no new access rules.
- **Hindi / English voice search** — a 🎤 in the Home symptom box ("पेट में दर्द है" → gastroenterologist). Uses the browser's built-in speech recognition (free); shown only where supported; the UI states honestly that the phone's speech service converts voice to text and ProMedicoz never records it.
- **Doctor prescription box rebuilt** — one card per medicine with quick chips (When: 1-0-0 / 1-0-1 / BD / TDS / OD / HS / SOS…, Food, Days), Enter adds the next medicine, name suggestions from the doctor's own history, "Repeat last", a live "patient's chart will show…" preview, and an optional "type as text" mode (one medicine per line). Fixes the old comma-splitting and field-shifting bugs; saved in the same fields, so PDF/share/chart are unchanged.
- **Daily medicine chart for patients** — on every prescription: medicines by time of day with food tags, course end dates ("till 10 Aug · day 2 of 5"), the free follow-up date, daily reminders (.ics), WhatsApp text for family, large text and print. Reads the doctor's text by common Indian conventions, never guesses, and keeps the doctor's own words one tap away.
- **Free health tools (`/tools`)** — Report Samjhao (blood report explained, with on-phone photo reading), Pregnancy due-date calculator, Ovulation & period calculator, Baby vaccination schedule (govt. UIP). All bilingual, private (no data sent), each with its own SEO page + Hindi page, share card, and entry points (Home smart-search suggestions, article cards, specialty-page strips, one "🧰 Free tools" chip).
- **Permanent safety tests** — `client/tests/` (Node's built-in test runner) pins every medical range, urgent limit, vaccine date, chart-reading and reminder rule. They run before every build (`prebuild`), so a Vercel deploy stops if any check fails.
- **SEO push** — crawler-readable prerendered bodies (not just meta tags) for home, listings, doctors, specialties and cities; Hindi article pages (`/blog/:slug/hi`) with hreflang; city landing pages; 7 more specialty pages; honest `lastmod`; `llms.txt`; IndexNow pings and Bing verification; doctor canonical `/dr/:slug`.
- **Speed** — per-article code chunks and lazy-loaded rarely used pages: main bundle ~334 → ~150 KB gzip; opening an article went from ~1.35 MB to ~160 KB.
- **Fix: first-visit reload** — the service worker no longer reloads the page the first time it takes control (it used to wipe whatever a first-time visitor had just started, ~2 s after opening the site). It still reloads once after a real update.
- **Modals above the mobile menu bar** — shared modals now sit above the bottom tab bar and WhatsApp button, so long forms are never covered.

- **"My Clinic" — a doctor-owned branded booking page** — every doctor gets a vanity URL (`/dr/:slug`, e.g. `promedicoz.in/dr/pooja-singh`, auto-generated from their name and backfilled for existing doctors) that shows ONLY them — their photo, credentials, fee, live availability, and reviews — with ProMedicoz as a quiet "Verified clinic page" trust mark and only a small "explore more doctors" link in the footer. It reuses the full doctor-profile logic in a single-doctor "clinic mode", so a patient who opens the doctor's shared link stays focused on booking with them. The old `/doctors/:id` URL still works.
- **"Promote Me" doctor dashboard tab** — turns that page into a shareable asset: the doctor's personal link with copy + native share sheet, a downloadable QR code (PNG), a printable A5 "clinic card" poster (PDF, with the QR, for the reception desk), one-tap share to WhatsApp / Instagram / Google Business / SMS, and a live "this month" stats strip (page views, bookings from their link, earnings collected, rating, consultations, repeat patients) — all computed from the doctor's own real data, as the reason to open the app daily.
- **Role-aware landing** — admins now go straight to the Admin Panel on login (and are redirected there if they ever land on the generic patient/doctor dashboard), with the navbar/bottom-nav showing a single clear "Admin Panel" link instead of a confusing "Dashboard" + "Admin Panel" pair. An admin is neither patient nor doctor, so the generic dashboard is never shown to them.
- **Admin user drill-down** — clicking a user's name anywhere in the admin panel (Users list OR Appointments list) opens a detail modal with their full record: identity/contact, patient medical info + family members, or a doctor's full professional profile, plus a "Recent appointments" history (other party, date/time, status, amount paid). Backed by a new `GET /api/admin/users/:id`.
- **Rupees shown as "Rs."** everywhere instead of the ₹ glyph, which renders as a box or a "$"-looking mark on some Indian devices/fonts.
- **Site-wide "out of the box" UI pass** — consistent gradient heroes and accent-bar section headings across Home, DoctorProfile, DoctorList, BookAppointment, BookingConfirmation, Login/Register, Dashboard cards, the blog list (category-colored article cards + featured hero), AboutUs, ForDoctors, InstallApp, HowItWorks, and the FAQ help-hub.
- **Blog scaled to 370+ articles** — comprehensive coverage of conditions, symptoms, first aid, life stages, tests/procedures, lifestyle, public health, and everyday "why does this happen?" explainers. Internal auto-linking connects related articles.
- **Fully bilingual blog (English + Hinglish)** — every article now carries a `contentHi` Hindi-in-Roman-script ("Hinglish") version alongside the English one, with a per-article EN/हिंदी toggle. Medical terms are kept in English; all safety framing (emergency numbers, red flags, "see a doctor" lines) is preserved in both.
- **UI polish pass** — frosted-glass top navbar + modernized mobile bottom nav (active-tab pill, safe-area padding), interactive footer link columns (icons, hover arrow-slide, accent bars), accordion FAQ with animated chevron badges, a connected "How ProMedicoz Works" step flow, a faster auto-scrolling testimonials marquee that merges live API reviews with curated real reviews, and hover-lift treatments on the Install App and About Us pages.
- **Blog performance split** — `blogMeta.js` (light metadata) is generated from `blogData.js` at build time so the blog LIST page no longer downloads every article's full text; article bodies load only when an article is opened.
- **Blog view/like counter** — per-article read counts + ❤️ likes stored in our own DB (`BlogView` model, `/api/blog-views`), surfaced as "Most Read"/"Most Loved" and per-article badges.
- **SEO: build-time prerendering** — `scripts/prerender.mjs` bakes correct per-route title/description/canonical/OG into static HTML for every public page (crawlers no longer see generic homepage tags on every route). Auth/utility pages get an `X-Robots-Tag: noindex` header.
- **Security hardening** — `helmet`, global rate limiting, `express-mongo-sanitize` (NoSQL-injection protection), public registration can't self-assign `admin`, `protect` middleware tightened, upload filenames sanitized.
- **Reliability** — process-level unhandledRejection/uncaughtException handlers; a partial UNIQUE index on Appointment(doctor, date, timeSlot) prevents double-booking races at the DB level (see the "Double-booking guard actually on" update above — the first version of this index was never created).
- **Performance** — a `User { role, specialization }` index speeds up the doctor listing; doctor-list loading skeletons for better perceived speed.

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

### Free health tools (`/tools`) — all bilingual, private, no login

| Tool | URL | What it does |
|------|-----|--------------|
| Report Samjhao | `/tools/blood-report` (+ `/hi`) | Explains a blood report in simple words: CBC (Hb, WBC, platelets), thyroid (TSH, Free T4), sugar (fasting, PP, HbA1c), vitamin D, B12. Photo of a **printed** report is read **on the phone** (Tesseract.js, self-hosted — nothing uploaded) or values are typed; the user confirms the numbers; results say Low / Normal range / High (sugar & vit D as standard bands), what the test is, common reasons, which doctor to see, and a red "see a doctor today" box for dangerous values. Never names a disease. Adults only, not for pregnancy. |
| Pregnancy due date | `/tools/due-date-calculator` (+ `/hi`, `/:month` share pages) | Due date (LMP + 280 days, adjusted for cycle length), weeks, trimester, baby-size note; WhatsApp share shows only the month ("Khushkhabri… March 2027") with a per-month preview card. |
| Ovulation & period | `/tools/ovulation-calculator` (+ `/hi`) | Fertile days, likely ovulation, next period, colour calendar, next 3 cycles, calendar reminders, "period late?" link to the due-date tool. States clearly it's not birth control. |
| Baby vaccination schedule | `/tools/vaccination-schedule` (+ `/hi`) | Every vaccine in India's government schedule (UIP, incl. fIPV-3 at 9 months, PCV, JE in some districts) with exact dates from the birth date; tick-offs saved on the phone only; calendar reminders; private vaccines listed by name only. |
| All tools | `/tools` | One page linking every tool. |

Medical numbers (ranges, limits, schedule) live in one plain-JS file per tool (`client/src/pages/tools/*.js`) shared with the build-time prerender, and are pinned by the safety tests. ⚠ They should be confirmed by a ProMedicoz doctor; change one by editing that file **and** its test in the same commit.

### Medicines & family

- **Doctor prescription box:** one card per medicine (name + quick chips for When / Food / Days + optional note), Enter adds the next, suggestions from the doctor's history, "Repeat last", live patient-chart preview, optional one-medicine-per-line text mode. Stored in the existing fields (`name`, `frequency`, `duration`, `instructions`).
- **Patient daily medicine chart:** "🗓️ Daily medicine chart" on each prescription — time-of-day groups, food tags, course end dates and day counts, free follow-up date, reminders (one event per slot *and* end date, so an alarm never lists a finished medicine), WhatsApp text, large text, print. Shorthand understood: 1-0-1 / ½-0-½ / 1-0-0-1, BD, TDS, QID, HS, OD (time not guessed), SOS, weekly, "morning and night", durations in days/weeks/months/"Continue". Unreadable entries go to "Check with your doctor" with the doctor's words.
- **Caregiver view:** "For: Mummy" tags + person filter on prescriptions; "Family's medicines today" across all running prescriptions (old "Continue" medicines only from prescriptions ≤ 90 days old; the same medicine from two doctors is shown twice with each doctor, never merged).
- **Voice search:** Hindi/English 🎤 on the Home symptom box (Web Speech API, shown only where supported).

### Platform

- Doctor and patient registration with role-based access
- Patient ID: every patient gets a short, human-readable id (e.g. `PT000123`) at registration — shown in their Account Settings, on the doctor's appointment card, Patient Reports, Prescriptions, and the downloadable prescription PDF; searchable everywhere a doctor or admin looks up a patient
- Bilingual patient experience (English / हिंदी): a prominent language toggle (on the home page, booking flow, and "Get the App" page) whose choice is remembered across visits and carries through the whole patient journey — Home, Find a Doctor (search fields, filters, doctor cards, empty state, pagination), Doctor Profile (badges, buttons, sections, reviews), Book Appointment, Booking Confirmation, How It Works, and Get the App are all translated, plus a partial Hindi layer on the patient dashboard (welcome header, patient tab labels, book button). The home symptom cards are always bilingual so a Hindi-speaking patient can tap instead of type. Doctor-facing UI and anything a doctor types (profiles, prescriptions) deliberately stay English — no medical content is machine-translated; only fixed UI labels get curated Hindi (which should be proofread by a native speaker before being treated as final)
- Search-first home page (like Practo/1mg): the symptom search is the hero, with the specialization grid, "How it works", real patient reviews, and FAQ below
- Local SEO landing pages: `/specialization/:slug` and `/specialization/:slug/:city` ("Best Dermatologists in Rishikesh"), driven by real doctor-city data so no empty "doorway" pages are created
- Helpful empty states: when a search finds no doctor, the patient gets a pre-filled WhatsApp lead-capture prompt (which also tells the admin what specialties/cities patients actually want)
- Doctor onboarding tracking: the admin Users table shows each doctor's setup completeness (email verified / availability set / profile complete) and can nudge an incomplete doctor with a reminder of exactly what's left — either by email, or via a manual click-to-WhatsApp button that opens WhatsApp with a profile-aware message pre-filled (names the specific missing steps, links to the dashboard) for the admin to review and send. The WhatsApp option needs no paid API and reaches phone-only doctors the email can't
- Doctor list ranking: the public doctor list is ordered by a profile-quality score (completeness of specialization/fee/availability/photo/qualification/experience/bio/city, then real rating weighted by review count, admin-verified badge, and experience), with newest registration used only as a final tiebreaker — so complete, credible profiles lead and half-empty ones sink, instead of a brand-new empty profile floating to the top just for being newest
- Languages spoken: doctors pick the languages they can consult in (English, Hindi, Bengali, Telugu, Odia, Kannada, Tamil, Marathi, Gujarati, Punjabi, Malayalam) — shown as "Speaks: …" on their card/profile, and patients can filter doctors by language so local patients find someone they can talk to comfortably. This is a spoken-language attribute the doctor picks, NOT a translation of anything they type (prescriptions stay English). Includes a one-time admin backfill to seed Hindi + English on doctors who registered before the field existed
- Smart specialization search with fuzzy matching (handles misspellings)
- Advanced doctor search filters: specialization, name, max fee, city, consultation mode, language, and "Available Today" (honest — only doctors with a real free slot left today)
- Phone number auto-formatting with +91 validation for Indian numbers
- Patients can register with phone number only (email optional)
- Doctors register with email (required)
- Login via phone (default) OR email (toggle switch)
- Show/hide password toggle on login and registration pages (crisp SVG icon, not emoji — renders consistently across platforms)
- Login/Register UX polish: autocomplete attributes (password manager support), autofocus on first field, numeric keypad + 10-digit cap for phone input, loading spinner on submit (the brand logo shows once in the navbar, not repeated on the auth card, to avoid a duplicate-logo look)
- JWT token authentication (login persists across sessions)
- Security hardening: `helmet` security headers (HSTS, nosniff, X-Frame-Options), a stricter rate limiter on auth endpoints plus a generous global rate limiter on all routes (prevents brute force + abuse/scraping), and `express-mongo-sanitize` to strip `$`/`.` operators from request data (blocks NoSQL operator injection). Public registration cannot self-assign the `admin` role (admins are created only via the server bootstrap)
- Password reset with secure token — works via email OR phone (patients can register with phone only); phone-only accounts with no email on file are guided to WhatsApp support, and admin can generate/relay a reset link manually as an account-recovery assist
- Doctor profile management with photo upload
- Phone number and WhatsApp contact for doctors — a "Message on WhatsApp" button appears on the doctor's public profile once they've set a WhatsApp number in Edit Profile; UPI ID can also be set there as a text fallback next to the payment QR code, for when a patient can't scan it
- Search and filter doctors by name or specialization
- Real-time availability: doctors set weekly schedule (multi-day selection) that auto-saves on every add/remove (no separate Save step); patients see only free slots
- Appointment booking with status workflow (pending → confirmed → completed/cancelled)
- Patient reschedule: a patient can move a pending OR confirmed appointment (paid or not) to a different free slot with the SAME doctor — payment status, reason, consent, and all details are preserved; it returns to "pending" so the doctor re-confirms the new time, the doctor is notified (push + email), the old slot frees up, and it reuses the same guards as booking (can't land on a blocked/past date or an already-taken slot). Reminder timers reset so both reminders re-fire for the new time
- Automated appointment reminders: an every-minute clock-based job pushes a reminder to BOTH the patient and doctor about an hour before a confirmed appointment (any consultation type), reducing no-shows — free web push, works even when the app isn't open; dedupes so it fires once per appointment
- Doctor block dates / vacation: doctors can mark specific dates (single day or a range) as unavailable on top of their weekly schedule. Blocked dates produce no bookable slots (enforced in the public slot endpoint, the booking guard, and the "next available"/"available today" computation), so patients can't book them. Doesn't auto-cancel appointments already booked on a date later blocked (the UI warns to handle those manually)
- Family members: patients can add/manage family members and book appointments on their behalf
- Repeat booking: rebook a past appointment with same doctor/details (one-click "Book Again")
- Meeting link sharing: doctor adds Google Meet/Zoom link when confirming (patient sees "Join" button)
- UPI Payment: each doctor sets own fee + UPI ID, patient pays directly via UPI app
- Prescription: doctor writes prescription via styled modal (diagnosis, medicines, tests, notes) — appears on the patient's dashboard instantly (Socket.io + Web Push), no manual refresh needed; the modal shows the patient's other prescriptions as reference so the doctor isn't relying on memory of what was prescribed last time
- Doctor has a dedicated, searchable Prescriptions tab (by patient name/phone/Patient ID) — previously the only way to see a written prescription was through the specific appointment it came from
- Medical Reports: patient uploads test reports (PDF/image), doctor reviews and comments — updates appear instantly on both sides the same way; can optionally be linked to a specific appointment, which then surfaces as a "tap to view" prompt directly on that appointment's card so it can't be missed
- Patient "Health History" timeline: a dedicated dashboard tab that pulls a patient's whole record together into one chronological, newest-first, month-grouped view — consultations, prescriptions, and uploaded reports side by side — with a type filter (All / Consultations / Prescriptions / Reports) and jump-to-detail links. Read-only, bilingual tab label, and refreshes live when a doctor writes a prescription or reviews a report (Socket.io). Purely a client-side merge of the existing per-type data, so it adds the "see my whole health story in one place" experience of larger platforms without any new backend or schema
- Doctor's Appointments and Patient Reports tabs are searchable (by patient name/phone/Patient ID) and paginated server-side, so they stay fast as a doctor's patient list grows; search/filter controls are always visible regardless of how many records exist
- Appointments tab has status filter tabs (All/Pending/Confirmed/Completed/Cancelled) and date filters — quick Today/Tomorrow/This Week/Next Week buttons plus a specific-date picker, all combinable with the status filter and search — so a doctor with a large patient list can isolate exactly what needs attention instead of scrolling through everything
- Patient complaints: patients file complaints (optionally tagged to a specific doctor/visit), admin reviews and responds via a dedicated Complaints tab in the admin panel — responding notifies the patient instantly (Socket.io + Web Push)
- Patient medical information (optional): blood group, allergies, current medications, medical history, emergency contact, and insurance details — set once in Account Settings, shown automatically to the doctor on every appointment (allergies always visible, the rest behind an expander) instead of being asked every visit; also surfaced as a reminder on the booking form itself
- Structured symptom tags on the booking form (Fever, Cough, Headache, etc.) — an optional, fast-glance supplement to the free-text "Reason for Visit"
- Floating WhatsApp emergency button (configurable via env var) — shown to guests only; hidden once a user logs in (they already have in-app chat/booking/footer support) and on blog pages (a reader focused on an article doesn't need it, and it avoids accidental taps while scrolling)
- Health blog with discovery built in: an instant client-side search box (by symptom/keyword, e.g. "toothache"), broad category filter chips (Heart & BP, Women's Health, Mental Health, Digestion, Kids, etc. — each grouping one or more specialties, so the large library feels browsable), a hand-picked "Start Here" strip for first-time visitors, plus real-data "🔥 Most Read" and "❤️ Most Loved" sections and a per-article "👁 reads" badge (driven by view/like counts stored in our own DB — see the blog-views API below), newest-first ordering, smarter related-article suggestions on each article (same-specialty first, then recent), automatic internal linking between related articles, per-article share buttons (WhatsApp/Facebook/native/copy), and a ❤️ "like" (backed by our DB, no dislike — deliberately no open comments to avoid spam + medical-misinformation risk on a health blog). **370+ original SEO articles**, every one with a bilingual English + Hinglish (Hindi-in-Roman-script) version behind a per-article EN/हिंदी toggle — each written in a rich, scannable format (short intro, headings, tables, tip/warning/success callouts, step lists, and bold key terms rendered by a shared article renderer, not walls of plain text) — spanning "when to see a [specialist]", symptom/question explainers (frequent headaches, fever care, migraine, UTI, acidity, PCOS, cholesterol, piles, kidney stones, hair fall, knee pain, thyroid, etc.), named conditions (diabetes, TB, hepatitis, HIV, Parkinson's, epilepsy, glaucoma, scoliosis, and many more), everyday "why does my body do this?" explainers, lifestyle/daily-routine guides, first aid, and responsibly-framed wellness pieces — all framed as lifestyle support/awareness, never as cures, always pointing to a doctor
- Blog data is split for performance: a build step (`scripts/gen-blog-meta.mjs`) generates a lightweight `blogMeta.js` (titles/descriptions only, no article bodies) from `blogData.js`, so the blog LIST page and homepage daily-tip load only the light metadata while the full article content downloads only when a specific article is opened
- Blog view & like counter: a public `/api/blog-views` API (backed by a `BlogView` model) records per-article read counts and ❤️ likes in our own database (independent of Google Analytics), shown on articles and powering the "Most Read"/"Most Loved" lists
- Health Tip of the Day on the Home page: one article, rotating daily (deterministic by date — same for everyone on a given day, changes each day), linking to the full read — a gentle reason for casual visitors to come back. Bilingual UI labels; the article title/description stay English (medical content is never machine-translated)
- Email notifications: doctor notified on new booking, patient notified on confirmation (via Resend)
- In-app notification banner: doctor sees pending appointment count on Dashboard
- Doctor rating & review system via modal (1-5 stars + text, shown on doctor profile)
- Auto-scrolling patient testimonials on homepage (with placeholders when no reviews yet)
- Admin panel: view stats, manage users, view all appointments, handle complaints
- Admin bootstrap: promote/create the first admin automatically via ADMIN_EMAIL env var (no manual database editing)
- Admin can deactivate/reactivate a doctor (hides them from patients and blocks login while keeping all records) as a safe alternative to permanent delete
- Admin can "Reset for Re-registration" any user — deactivates the account and frees up their phone/email (renamed out of the way) so they can register fresh with the same details, without losing any existing appointment/prescription/report history. This is the safe alternative to permanent Delete for the common "let this person redo their profile" case
- Admin can generate a password reset link for any user (emails it automatically if they have an email on file, otherwise gives a link to relay manually — e.g. via WhatsApp — for phone-only accounts)
- Admin user search matches name, email, phone, or Patient ID; the Users and Appointments tables show each patient's Patient ID
- Web Push notifications (VAPID, no SMS/email dependency): instant alerts for appointment confirmed/cancelled, new chat message, and incoming call — works even for patients who registered with phone only and no email; a dismissible in-app nudge asks permission once, and REST polling / email stay as fallbacks if push isn't enabled or supported
- Account settings: users can update email/phone or delete their account (with confirmation modal)
- Doctor profile edit pre-fills with existing data (edit only what you need)
- Styled modal dialogs replace all browser prompts/confirms (modern UX)
- Paginated appointment history in Dashboard (Previous/Next navigation)
- Modular Dashboard architecture: each tab is a separate component for maintainability
- PWA support: installable on phone, offline caching, custom app icon
- "Get the App" page (`/install`, bilingual EN/हिंदी): one-tap install on Android/Chrome, clear step-by-step "Add to Home Screen" instructions for iPhone/Safari (where no install button is possible), plus a full Share section — native share sheet, direct per-platform buttons (WhatsApp, Facebook, Telegram, X, LinkedIn, Email), copy-link, a ready-to-post caption with a "Copy caption" button, and a client-side QR code of the site. Surfaced in the navbar, a Home-page strip, and the footer (role-neutral)
- Social link previews: Open Graph + Twitter large-image tags in the static HTML (so Facebook/WhatsApp/LinkedIn show a proper card), pointing at a 1200×630 branded `og-image.png`. Ready-to-post branded social graphics ship in `client/public/social/` (a vertical 1080×1920 Story image, a 1080×1080 square, and health-tip / doctor-recruitment / "book in 2 minutes" posts)
- Doctors can share their own public profile with their existing patients from the dashboard (WhatsApp share + copy profile link) — the highest-trust, zero-cost way to bring patients onto the platform
- "My Clinic" branded booking page per doctor (`/dr/:slug`): a single-doctor page a doctor can treat as their own online clinic — only they are shown (photo, credentials, fee, live availability, reviews), ProMedicoz sits as a quiet trust mark, and the full doctor-profile/booking logic is reused in a "clinic mode" so there's no second page to drift out of sync. Slugs are auto-generated from the doctor's name (unique, with a numeric suffix on collision) and backfilled for pre-existing doctors; the old `/doctors/:id` URL keeps working
- "Promote Me" dashboard tab for doctors: personal link + copy + native share, a downloadable QR code (PNG), a printable A5 clinic-card poster (PDF with the QR), one-tap share to WhatsApp/Instagram/Google Business/SMS, and a live this-month stats strip (page views, bookings from their link, earnings collected, rating, consultations, repeat patients) — the payoff that makes sharing worthwhile and the app worth opening daily
- Admin user drill-down: clicking a user's name in the admin Users OR Appointments list opens a read-only detail modal — identity/contact, patient medical info + family members (or a doctor's full professional profile), plus a recent-appointment history (other party, date/time, status, amount paid)
- Admins land on the Admin Panel (not the generic patient/doctor dashboard): routed there on login and redirected away from `/dashboard` if they land there, with a single clear "Admin Panel" nav link
- Free phone-reach without a paid SMS/WhatsApp API: Web Push delivers booking/confirmation/message/call alerts to phones automatically (a prominent, benefit-driven enable prompt drives opt-in), and doctors get an optional one-tap "message on WhatsApp" button on a confirmed appointment (opens WhatsApp with a pre-filled note; the doctor sends it — the appointment is already confirmed in-app)
- Doctor names are cleaned for display everywhere (strips a doctor-typed "Dr"/"Dr." prefix and title-cases the name, so "Dr akash verma" shows as "Dr. Akash Verma") — display only; the stored name is unchanged
- Auto-update PWA: service worker serves HTML network-first and auto-refreshes to the latest version on each deploy (no manual cache clearing needed), with an "Updating to the latest version…" toast
- SEO optimized: unique page titles, meta descriptions, Open Graph tags per page (via react-helmet-async at runtime), PLUS build-time prerendering — a post-build script (`scripts/prerender.mjs`) writes a static HTML file per public route (home, blog list, every article, specialization pages, static pages) with the correct title/description/canonical/OG baked into the raw HTML. This is critical for a client-only SPA: it means crawlers and social scrapers see the correct per-page tags immediately without running JavaScript (previously every route served the same generic homepage tags in raw HTML). Auth/utility pages are excluded and instead served an `X-Robots-Tag: noindex` header (via vercel.json)
- Structured data (Schema.org): MedicalBusiness, Physician, FAQPage schemas
- 10 dedicated specialization landing pages with FAQs (targets long-tail keywords)
- Homepage FAQ section with expandable questions and structured data
- Google Analytics integration for visitor tracking
- Google Search Console with sitemap (all key pages incl. the health-blog articles and specialization/info pages)
- robots.txt configured (blocks private pages from indexing)
- Email verification for doctors (must verify email to appear in patient search) — verification is idempotent, so an email security scanner pre-visiting the link (common with Outlook Safe Links and similar) no longer causes a false "expired" error on the doctor's real click
- Dashboard verification banner with "Resend Email" button for unverified doctors (includes a "check your spam folder" note, since new-domain verification emails can land there)
- Admin email-verification bypass: when a doctor's verification email is stuck in spam, the admin can mark that doctor's email verified directly from the Users table (`✅ Verify Email`), making them live for patients without waiting on the email. This is separate from the `✅ Verify` admin trust badge (credential check) — one clears the email gate, the other is the "admin verified" badge
- Consultation fees shown as "Rs." (Indian Rupees) — deliberately not the ₹ glyph, which renders as a box or a "$"-looking mark on some devices/fonts
- "Next available" slot shown on each doctor card (e.g. "Next available at 3:30 PM" with an "Available Today" pill, or "Next available tomorrow at 11:00 PM") — computed from real free slots (skips past + booked times), so it never misleads patients
- Share doctor profile via WhatsApp (word-of-mouth marketing)
- Booking confirmation page with full summary
- Past time slots hidden when booking for today (IST timezone — works on any server regardless of hosting region)
- Patients can replace/update uploaded report files anytime
- In-app video/audio calling (Daily.co) — private per-appointment rooms with server-issued join tokens; no login or sign-in for doctor/patient
- Audio-only mode for phone consultations (camera off by default)
- Incoming-call "ringing" notification — when one party joins, the other sees a full-screen banner + ringtone (with vibration on mobile) and can Accept/Decline. Delivered instantly via Socket.io, with REST polling (every 20s) kept as an automatic fallback if the socket connection drops
- Calls also auto-notify based on the clock, not just on the other person clicking Join first — the moment a confirmed/paid video or phone appointment's slot starts, both doctor and patient see the same ringing banner automatically (if their dashboard is open), and get a push notification either way (if it isn't) — so a scheduled call is never missed just because neither side remembered to click Join
- "Join Call" button appears only on the appointment date (hidden once the day passes)
- In-app chat messaging per appointment (optimistic instant-send, instant delivery to the other party via Socket.io, unread badge updates instantly too). REST polling (every 15s) kept as an automatic fallback if the socket connection drops
- UPI QR code payment — doctor uploads QR, patient scans and pays
- "I Have Paid" quick confirmation + optional receipt upload
- Image/file storage on Cloudinary (QR codes, payment screenshots, medical reports, profile photos) — keeps the database small; automatic base64 fallback if Cloudinary isn't configured, so existing data keeps working
- Optimized image delivery via Cloudinary (f_auto format, q_auto quality, per-context resize) — fast loads, low bandwidth
- Uploads accept JPEG/PNG/GIF/WebP/HEIC (iPhone photos) + PDF, up to 10MB, with clear error messages; HEIC is auto-converted to a web-friendly format on delivery
- Doctors can upload a profile photo (one-click "Add Photo" nudge + Edit Profile field); gender-neutral doctor emoji fallback when no photo
- One-time migration script (`server/scripts/migrateImagesToCloudinary.js`) or admin API endpoint to move any legacy base64 images to Cloudinary
- Block patient feature for doctors (prevents messaging from abusive patients)
- Free follow-up booking — doctor sets period (7/15/30 days), patient books without payment
- Sequential doctor workflow (Confirm → Mark Paid → Join Call → Mark Complete → Prescription)
- Step-by-step guidance messages for both patient and doctor on every appointment
- City and consultation mode (in-person/video/phone) filters on doctor search
- Google Maps "Get Directions" for in-person appointments
- Doctor name displayed with "Dr." prefix across the platform
- Bottom navigation bar for mobile (Home, Doctors, My Appts, Blog)
- Legal & info pages: Terms & Conditions, Privacy Policy, Medical Disclaimer, Cancellation & Refund Policy, and an About Us page — all linked in the footer (grouped as "Legal & Support"), stating honestly that ProMedicoz is a free intermediary that takes no commission and never handles payments (direct UPI patient→doctor)
- Pre-signup info pages: `/for-doctors` (how payment works — keep 100%, no commission — how patients join, the consultation flow, getting started, plus a FAQ answering doctors' real objections: "will I lose my existing patients?", "why is it free?", payment/privacy/availability/leave-anytime) and `/how-it-works` (patient-facing: find → book → pay the doctor directly after confirmation → join by video/phone/in-person), each ending in a signup CTA. `/how-it-works` is bilingual (English / हिंदी)
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
- Soft-delete accounts (data retained for 90 days for legal/audit purposes, user can re-register fresh immediately with the same email/phone — old and new accounts never overwrite each other). An automated daily job anonymizes personal details (name/email/phone/photo) once an account passes the 90-day window; appointments/prescriptions/reports are left untouched since those are medical/legal records
- Admin Users table correctly distinguishes Active / Deactivated / Deleted accounts (previously showed "Active" for self-deleted accounts — fixed)
- Server hardening: bounded numeric fields (no negative fees/experience/payment amounts), capped pagination limits, and escaped search input (prevents regex denial-of-service) across all list/search endpoints
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
| socket.io | Real-time chat delivery + call ringing (JWT-authenticated, per-appointment rooms) |
| web-push | Browser push notifications (VAPID) — works without email/SMS, so phone-only patients get instant updates too |

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 18 | User interface library |
| Vite | Build tool and dev server |
| Tailwind CSS | Utility-first styling |
| React Router v6 | Client-side navigation |
| Axios | HTTP client for API calls |
| React Hot Toast | Notification popups |
| socket.io-client | Real-time chat + call ringing (with polling fallback) |
| qrcode.react | Client-side QR code on the "Get the App" page (renders as SVG in-browser — no third-party call) |
| jsPDF | Prescription PDF + doctor clinic-card poster (lazy-loaded) |
| tesseract.js (+ @tesseract.js-data/eng) | On-phone text reading for Report Samjhao photos. Files are copied to `public/tesseract/<version>/` at build time (`scripts/copy-tesseract.mjs`, gitignored) and loaded from promedicoz.in only when a photo is picked |
| Web Speech API (browser built-in) | Voice search on Home — no package, no cost |
| Node test runner (built-in) | Client safety tests (`npm test`, run before every build) |

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
│   ├── socket.js                ← Socket.io setup: JWT auth, per-user + per-appointment rooms
│   │
│   ├── models/                  ← Database schemas (shape of data)
│   │   ├── User.js              ← Doctor/patient/admin accounts
│   │   ├── Appointment.js       ← Booking records + payment status
│   │   ├── Prescription.js     ← Doctor prescriptions (medicines, tests)
│   │   ├── MedicalReport.js    ← Patient uploaded test reports
│   │   ├── Complaint.js        ← Patient complaints
│   │   ├── CallLog.js          ← In-app call tracking (start/end/duration)
│   │   ├── Announcement.js     ← Admin broadcast announcements
│   │   └── Counter.js          ← Atomic sequence generator (used for Patient IDs)
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
│   │   ├── adminController.js   ← Admin: stats, user management, analytics, manual reset-link relay, appointment search, Needs help, db-check
│   │   ├── adminPatientController.js ← Admin "Help patient" + "+ New patient"
│   │   ├── paymentController.js ← Patient payment steps (screenshot / "I've paid" + UTR / undo / remind) + admin Payment help + refund checked
│   │   ├── announcementController.js ← Admin broadcast announcements
│   │   └── pushController.js    ← Web Push subscription management (public key, subscribe, unsubscribe)
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
│   │   ├── announcement.js
│   │   └── push.js
│   │
│   ├── utils/                   ← Helpers
│   │   ├── sendEmail.js         ← Email notifications (Resend)
│   │   ├── formatPhone.js       ← Indian phone number formatting
│   │   ├── daily.js             ← Daily.co room + join-token helper
│   │   ├── push.js              ← Web Push sender (VAPID) — cleans up stale subscriptions automatically
│   │   ├── accountCleanup.js    ← Daily job: anonymizes accounts past the 90-day deletion window
│   │   ├── callReminder.js      ← Every-minute job: pushes "call starting" to both parties, clock-based
│   │   ├── appointmentReminder.js ← Every-minute job: pushes "appointment in ~1 hour" to both parties (cuts no-shows)
│   │   ├── queryHelpers.js      ← Shared pagination cap + regex-escaping helpers for list/search endpoints
│   │   ├── booking.js           ← createBooking: the ONE place appointments are created (patient + admin paths)
│   │   ├── slots.js             ← Slot labels, "is this slot real / not past / not started", slot start/end times
│   │   ├── contactChecks.js     ← Phone/email validation + "already used by another account" checks
│   │   ├── familyMembers.js     ← Family member add/edit/remove rules (patient + admin)
│   │   ├── paymentFollowUp.js   ← Every-10-min job: doctor nudged 3 h / admin alerted 24 h after an unconfirmed payment
│   │   ├── journeyReminders.js  ← Every-10-min job: doctor "please confirm", patient "please pay"
│   │   ├── needsHelp.js         ← Builds the Admin "Needs help" groups
│   │   └── fixIndexes.js        ← Startup migrations: email index (sparse unique) + double-booking guard (unique_active_slot)
│   │
│   ├── tests/                   ← Backend tests, no DB needed (npm test)
│   │   ├── api.test.js / login.test.js / register.test.js / adminContact.test.js / adminPatient.test.js
│   │   ├── gaps.test.js         ← Validation/authorization audit fixes
│   │   ├── payment.test.js / needsHelp.test.js / slotIndex.test.js
│   │
│   └── uploads/                 ← Uploaded files stored here
│       └── .gitkeep
│
└── client/                      ← FRONTEND
    ├── package.json             ← Frontend dependencies + scripts (test → prebuild → build → prerender)
    ├── index.html               ← Single HTML page (React mounts here)
    ├── vercel.json              ← Vercel routing config
    ├── vite.config.js           ← Dev server + API proxy config (+ reader version define)
    ├── tailwind.config.js       ← CSS theme configuration
    ├── postcss.config.js        ← CSS processing
    │
    ├── tests/                   ← Safety tests (npm test) — see tests/README.md
    │   ├── reports.test.mjs     ← Report Samjhao ranges, bands, urgent limits, wording rules
    │   ├── reportParse.test.mjs ← Photo-reader text → values (incl. real OCR slips)
    │   ├── rxChart.test.mjs     ← Medicine chart reading + reminder safety
    │   ├── rxRows.test.mjs      ← Doctor prescription box save/load
    │   ├── familyChart.test.mjs ← Caregiver view rules
    │   ├── vaccines.test.mjs    ← Govt. vaccine schedule + dates
    │   ├── dueDate.test.mjs / ovulation.test.mjs
    │   └── helpers.mjs
    │
    ├── scripts/                 ← Build-time + one-off scripts
    │   ├── gen-blog-meta.mjs    ← prebuild: light blog metadata + per-article bodies
    │   ├── copy-tesseract.mjs   ← prebuild: self-host the photo reader files
    │   ├── prerender.mjs        ← postbuild: per-route static HTML, crawler bodies, JSON-LD, sitemap, llms.txt, IndexNow
    │   ├── gen-og-cards.mjs     ← blog category share cards (run locally)
    │   ├── gen-due-date-cards.mjs ← due-date month share cards (re-run about once a year)
    │   └── gen-ovulation-card.mjs / gen-vaccine-card.mjs / gen-report-card.mjs ← tool share cards
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
        │   ├── api.js           ← All API call functions
        │   └── socket.js        ← Shared Socket.io client connection (chat + call ringing)
        │
        ├── utils/
        │   ├── drafts.js + useAutoDraft.js ← "Pick up where you left off": device-only form drafts (per account, with expiry)
        │   ├── profileAutosave.js ← Doctor profile autosave: changed fields, inline checks, "5 of 8 done"
        │   ├── paymentFlow.js   ← Patient payment states, UPI app link, UTR, reminder timing
        │   ├── consultModes.js  ← Only the consultation types a doctor offers
        │   ├── needsHelp.js     ← Admin Needs help labels + pre-filled WhatsApp messages
        │   ├── rxChart.js       ← Prescription → daily chart, reminders (.ics), share text
        │   ├── rxRows.js        ← Doctor medicine cards ⇄ saved prescription fields
        │   ├── familyChart.js   ← Caregiver "family's medicines today"
        │   └── prescriptionPdf.js ← Prescription PDF
        │
        ├── components/
        │   ├── Navbar.jsx       ← Navigation bar (with PWA install button)
        │   ├── Modal.jsx        ← Reusable ConfirmModal & PromptModal (supports a "custom" field + optional draftKey)
        │   ├── PaymentBox.jsx   ← Patient payment steps on an appointment card (no dead ends)
        │   ├── SessionExpired.jsx ← "Please log in again — your work is saved" banner
        │   ├── MedicineEditor.jsx ← Doctor's one-card-per-medicine prescription editor
        │   ├── VoiceSearch.jsx  ← Hindi/English voice search mic + listening sheet
        │   ├── ChatBox.jsx      ← In-app messaging per appointment
        │   ├── VideoCall.jsx    ← Daily.co video/audio calling integration
        │   ├── SEO.jsx          ← Per-page title, description, Open Graph tags
        │   ├── StructuredData.jsx ← Schema.org JSON-LD markup
        │   ├── WhatsAppButton.jsx ← Floating WhatsApp button (guests only)
        │   └── ScrollToTop.jsx  ← Resets scroll to top on route change
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
            ├── HowItWorks.jsx   ← Patient "how it works" (bilingual EN/हिंदी)
            ├── ForDoctors.jsx   ← Doctor-facing "how it works" + payment/no-commission
            ├── InstallApp.jsx   ← "Get the App": install steps + share + QR
            ├── AboutUs.jsx      ← About page
            ├── TermsAndConditions.jsx / PrivacyPolicy.jsx / MedicalDisclaimer.jsx / CancellationRefund.jsx ← Legal pages
            ├── Dashboard.jsx    ← Main dashboard layout + appointments tab
            ├── tools/           ← Free health tools (logic + copy in plain .js, shared with prerender)
            │   ├── ToolsHub.jsx + toolsList.js        ← /tools
            │   ├── ReportSamjhao.jsx + reports.js     ← ranges, bands, explanations
            │   ├── reportParse.js + reportOcr.js      ← photo text → values; on-phone reader loader
            │   ├── DueDateCalculator.jsx + dueDate.js
            │   ├── OvulationCalculator.jsx + ovulation.js
            │   ├── VaccinationSchedule.jsx + vaccines.js
            │   └── toolLinks.js                       ← tool URLs, search matchers, article lists (entry points)
            ├── dashboard/       ← Dashboard sub-components
            │   ├── DoctorAvailability.jsx
            │   ├── DoctorPatientReports.jsx
            │   ├── PatientFamilyMembers.jsx
            │   ├── PatientPrescriptions.jsx  ← + "For:" tags, person filter, family view button
            │   ├── RxChart.jsx               ← Daily medicine chart (one prescription)
            │   ├── FamilyMeds.jsx            ← Family's medicines today
            │   ├── PatientReports.jsx
            │   ├── PatientComplaints.jsx
            │   ├── RescheduleModal.jsx   ← Patient reschedule modal (date + free-slot picker)
            │   └── AccountSettings.jsx
            ├── admin/           ← Admin panel pieces (lazy-loaded)
            │   ├── HelpPatient.jsx   ← Help patient + New patient
            │   ├── PaymentHelp.jsx   ← View receipt/UTR, mark paid, reset
            │   └── NeedsHelp.jsx     ← 🚨 Needs help list
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
| JWT_SECRET | Yes | Secret key for token signing. Local: any string. **Production: a long random value made with `openssl rand -hex 32`, set only in the Render dashboard — never in a file or commit.** If it ever leaks, rotate it (steps in HOW_IT_WORKS.md → Security Model) | my_super_secret_key_12345 (local only) |
| NODE_ENV | No | Environment mode | development |
| RESEND_API_KEY | No | Resend email API key (enables email notifications) | re_xxxx... |
| ADMIN_EMAIL | No | Email promoted to admin on startup (auto-creates the account if it doesn't exist) | admin@example.com |
| ADMIN_PASSWORD | No | Password used only when auto-creating a new admin account | (strong password) |
| ADMIN_NAME | No | Display name for an auto-created admin account | Administrator |
| DAILY_API_KEY | No | Daily.co API key (enables in-app video/audio calls) | (secret, server only) |
| DAILY_DOMAIN | No | Your Daily.co subdomain | promedicoz.daily.co |
| CLOUDINARY_CLOUD_NAME | No | Cloudinary cloud name (enables hosted image storage) | your-cloud-name |
| CLOUDINARY_API_KEY | No | Cloudinary API key | 123456789012345 |
| CLOUDINARY_API_SECRET | No | Cloudinary API secret (server only) | (secret) |
| VAPID_PUBLIC_KEY | No | Web Push public key (enables browser push notifications) | (generate via web-push, see below) |
| VAPID_PRIVATE_KEY | No | Web Push private key (server only) | (secret) |
| VAPID_SUBJECT | No | Contact for push errors (mailto: or URL) | mailto:support@promedicoz.in |
| VITE_WHATSAPP_NUMBER | No | WhatsApp number for floating button (frontend) | 919997019900 |
| VITE_API_URL | No | Backend API URL for production frontend | https://your-backend.onrender.com/api |

Generate VAPID keys once with:
```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```
Add the same three values to your hosting provider's environment variables (e.g. Render dashboard → Environment) — without them, `/api/push/public-key` returns an empty key and push notifications silently stay disabled (everything else keeps working via polling/email/socket fallbacks).

---

## API Endpoints

### Authentication
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /api/auth/register | Public | Create account |
| POST | /api/auth/login | Public | Log in, get token |
| GET | /api/auth/me | Protected | Get own profile |
| POST | /api/auth/forgot-password | Public | Request reset link via email OR phone |
| PUT | /api/auth/reset-password/:token | Public | Set new password |
| PUT | /api/auth/update-account | Protected | Change email/phone |
| PUT | /api/auth/medical-info | Patient only | Update blood group, allergies, medications, medical history, emergency contact, insurance |
| DELETE | /api/auth/delete-account | Protected | Delete own account |
| GET | /api/auth/verify-email/:token | Public | Verify doctor email via link |
| POST | /api/auth/resend-verification | Protected | Resend verification email |

### Doctors
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/doctors | Public | Browse/search doctors (?specialization=, ?city=, ?name=, ?maxFee=, ?availableToday=, ?page=, ?limit=) |
| GET | /api/doctors/cities | Public | Distinct cities with active doctors (optionally ?specialization=) — powers local SEO city pages |
| GET | /api/doctors/me/stats | Doctor only | Own "Promote Me" stats (consultations/earnings this month, unique + repeat patients, rating, page views, link bookings) — all computed from the doctor's own appointments + reviews |
| GET | /api/doctors/by-slug/:slug | Public | Resolve a doctor by their vanity handle for the branded `/dr/:slug` page (increments a page-view counter) |
| GET | /api/doctors/:id | Public | View doctor profile |
| POST | /api/doctors/:id/link-booking | Public | Best-effort counter: the branded page pings this when a visitor taps "Book" from it (always 200) |
| PUT | /api/doctors/profile | Doctor only | Update own profile. Partial updates allowed (the Dashboard autosaves only changed fields); each sent field is validated (phone/WhatsApp format + clash check, lengths, links) |

### Appointments
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /api/appointments | Patient only | Book appointment (supports family member + repeat; records consent) |
| GET | /api/appointments/my | Protected | View my appointments (supports ?status=, ?search= by other party's name/phone/Patient ID, ?dateFrom=&?dateTo= YYYY-MM-DD inclusive range, ?page=, ?limit=) |
| GET | /api/appointments/incoming-calls | Protected | Poll for an incoming call (ringing) |
| GET | /api/appointments/:id | Protected | View single appointment |
| GET | /api/appointments/:id/video-token | Protected | Get Daily.co room URL + join token (slot-window enforced) |
| POST | /api/appointments/:id/call-log | Protected | Start a call log (doctor connection) |
| PUT | /api/appointments/:id/call-log/:logId/end | Protected | Finalize a call log with duration |
| PUT | /api/appointments/:id/status | Doctor only | Confirm/complete appointment |
| PUT | /api/appointments/:id/call | Protected | Set call active/inactive (ringing signal) |
| PUT | /api/appointments/:id/reschedule | Patient only | Move a pending/confirmed appointment to a new free slot (same doctor); preserves payment, resets to pending, notifies doctor |
| PUT | /api/appointments/:id/cancel | Patient only | Cancel booking |
| PUT | /api/appointments/:id/payment | Doctor only | Mark payment received (not on cancelled; amount capped); pushes the patient |
| PUT | /api/appointments/:id/payment-screenshot | Patient only | Upload/replace payment screenshot (multipart `screenshot`); counts as "I've paid" and notifies the doctor |
| PUT | /api/appointments/:id/notify-payment | Patient only | "I've paid", optional `{ utr }` (12-digit UPI reference); notifies the doctor |
| PUT | /api/appointments/:id/undo-payment-claim | Patient only | "I haven't paid yet" — back to the pay screen (clears screenshot/UTR) |
| POST | /api/appointments/:id/payment-reminder | Patient only | Remind the doctor to confirm payment (2 h after claiming, then at most every 6 h; 429 with `nextReminderAt` otherwise) |

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
| GET | /api/availability/blocked-dates | Doctor only | View own blocked dates / vacation days |
| PUT | /api/availability/blocked-dates | Doctor only | Set blocked dates (replaces the list; drops past dates, de-dupes, sorts) |
| GET | /api/availability/:doctorId/slots?date=YYYY-MM-DD | Public | Get free slots (returns none on a blocked date) |

### Prescriptions
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /api/prescriptions | Doctor only | Create prescription (updates the existing one if this appointment already has one) |
| GET | /api/prescriptions/my | Protected | View my prescriptions (supports ?search= by patient name/phone/Patient ID, ?page=, ?limit=; defaults to everything up to 100 if no params given) |
| GET | /api/prescriptions/appointment/:id | Protected | Get prescription for appointment |
| PUT | /api/prescriptions/:id | Doctor only | Update prescription |

### Medical Reports
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /api/reports | Patient only | Upload test report (with file); optional appointmentId links it to a specific visit (validated server-side — must actually be this patient's own appointment with that doctor) |
| GET | /api/reports/my | Protected | View my reports (supports ?search= by patient name/phone/Patient ID, ?page=, ?limit=; defaults to everything up to 100 if no params given) |
| PUT | /api/reports/:id/review | Doctor only | Review/comment on report |

### Complaints
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /api/complaints | Patient only | File a complaint; optional doctorId/appointmentId to tag which doctor/visit it's about (both validated server-side) |
| GET | /api/complaints/my | Patient only | View my complaints |
| GET | /api/complaints | Admin only | View all complaints (supports ?status=) |
| PUT | /api/complaints/:id | Admin only | Update status/respond — notifies the patient instantly (Socket.io + Web Push) |

### Admin
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/admin/stats | Admin only | Dashboard stats |
| GET | /api/admin/users | Admin only | List all users (supports ?role=, ?search= by name/email/phone/Patient ID) |
| GET | /api/admin/users/:id | Admin only | Full detail for one user (complete record + recent appointments) — powers the click-a-name detail drill-down from the Users and Appointments lists |
| GET | /api/admin/appointments | Admin only | List appointments (?status=, ?paymentStatus=pending\|patient_claimed\|paid, ?search= Patient ID / patient or doctor name / phone across ALL appointments, ?page=, ?limit=) |
| GET | /api/admin/needs-help | Admin only | Patients who may be stuck, grouped (notConfirmed, paymentWaiting, unpaidSoon, slotPassedOpen, paidCancelled, noPhone) — see `utils/needsHelp.js` |
| PUT | /api/admin/appointments/:id/payment | Admin only | **Payment help:** `{ action: 'mark_paid', amount?, note? }` (on the doctor's behalf) or `{ action: 'reset', note? }` (patient sees QR/upload again; note required if it was paid). Records which admin |
| PUT | /api/admin/appointments/:id/refund-checked | Admin only | Paid-then-cancelled: record that the refund was checked (`{ note? }`); removes it from Needs help |
| GET | /api/admin/db-check | Admin only | Read-only: is the double-booking guard (`unique_active_slot`) on? |
| POST | /api/admin/fix-slot-index | Admin only | Build the double-booking guard if missing (refuses and lists real duplicate bookings if any). Also runs on every server start |
| GET | /api/admin/analytics | Admin only | Revenue + call analytics (calls, minutes, per-doctor) |
| POST | /api/admin/migrate-images | Admin only | One-time base64 → Cloudinary migration (safety net) |
| DELETE | /api/admin/users/:id | Admin only | Delete a user permanently (also deletes all their appointments) — no recovery from this app; prefer Deactivate or "Reset for Re-registration" below |
| PUT | /api/admin/users/:id/suspension | Admin only | Deactivate/reactivate a user (keeps records) |
| POST | /api/admin/users/:id/reset-link | Admin only | Generate/relay a password reset link (manual recovery assist for phone-only accounts) |
| GET | /api/admin/duplicate-phones | Admin only | Read-only check for accounts sharing a phone number |
| POST | /api/admin/users/:id/free-contact-info | Admin only | Non-destructive alternative to Delete: frees up an account's phone/email for reuse (renamed out of the way) and deactivates it if still active — for resolving duplicate accounts, or resetting someone for fresh re-registration. All history is kept intact either way |
| POST | /api/admin/backfill-patient-ids | Admin only | One-time: assign a Patient ID to patients who registered before this field existed |
| POST | /api/admin/backfill-doctor-languages | Admin only | One-time: set a default languagesSpoken (Hindi + English, or a custom list in the body) on doctors who registered before the field existed and haven't set any. Idempotent; never overwrites a doctor who already chose their own |
| POST | /api/admin/users/:id/setup-reminder | Admin only | Email an incomplete doctor a reminder of the onboarding steps still pending (the admin panel also offers a manual click-to-WhatsApp reminder for the same steps — that's frontend-only, opening wa.me with a pre-filled message, so it needs no endpoint) |
| PUT | /api/admin/users/:id/verify | Admin only | Set/clear the "Verified by ProMedicoz" trust badge (credential check) |
| POST | /api/admin/users/:id/verify-email | Admin only | Bypass a stuck email verification (email landed in spam): marks the doctor's email verified so they go live for patients |
| PUT | /api/admin/patients/:id | Admin only | **Help patient:** edit a patient's name, mobile (required, duplicate-checked), email and medical info. Only sent fields change; each save is logged on the account (admin, time, field names) |
| POST/PUT/DELETE | /api/admin/patients/:id/family(/:memberId) | Admin only | **Help patient:** add / edit / remove a patient's family members (same rules as the patient's own Family tab) |
| POST | /api/admin/patients/:id/appointments | Admin only | **Help patient:** book on the patient's behalf. Requires `consentConfirmed: true` (patient agreed on call/WhatsApp); same booking rules as the patient path (shared `utils/booking.js`); stored with `consentBy: 'admin'` + `bookedByAdmin`; pushes the patient |
| POST | /api/admin/patients | Admin only | **+ New patient:** create an account for someone who can't register (name + mobile, consent confirmed). Random password; returns a 48-hour set-password link for the patient |

### Announcements
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/announcements | Protected | Active announcements for my role (banner) |
| GET | /api/announcements/all | Admin only | List all announcements |
| POST | /api/announcements | Admin only | Create an announcement |
| PUT | /api/announcements/:id | Admin only | Update / toggle active |
| DELETE | /api/announcements/:id | Admin only | Delete an announcement |

### Push Notifications
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/push/public-key | Public | VAPID public key (needed before subscribing) |
| POST | /api/push/subscribe | Protected | Save a browser push subscription for the logged-in user |
| POST | /api/push/unsubscribe | Protected | Remove a browser push subscription |
| POST | /api/push/test-alarm | Protected | "🔔 Test my alarm": rings the caller's own devices with the call-style notification (once per 30 s) |
| POST | /api/push/snooze | Public (signed token) | The call notification's "In 5 min" button: `{ token }` from the notification; rings that person again in 5 min |

### Blog Views & Likes (public)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/blog-views | Public | Read counts + likes for all articles (as { slug: n } maps) — powers "Most Read"/"Most Loved" |
| GET | /api/blog-views/:slug | Public | Current read count + likes for one article |
| POST | /api/blog-views/:slug | Public | Record one view; returns the new count (frontend throttles to once per browser per ~4h) |
| POST | /api/blog-views/:slug/like | Public | Like/unlike one article — body { liked: true\|false } |

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
4. **Doctor: set availability** — Dashboard → Availability → add time slots (auto-saves)
5. **Patient: browse doctors** — click "Find Doctors"
6. **Patient: book appointment** — click a doctor → Book → pick date (slots appear!) → confirm
7. **Doctor: confirm appointment** — Dashboard → see pending booking → click Confirm
8. **Doctor: upload thesis** — Dashboard → Publications → New Publication → fill and publish
9. **Anyone: view publication** — click Publications in navbar → click a paper → see full content
10. **Test password reset** — Logout → Login → "Forgot password?" → enter email → check SERVER TERMINAL for the link → copy link to browser → set new password

### Automated safety tests (frontend):

```bash
cd client
npm test
```

~105 test groups (~340 checks) covering every medical range and urgent limit in Report Samjhao, the photo reader, the daily medicine chart and its reminders, the doctor's prescription box, the caregiver view, the vaccine schedule, and the due-date/ovulation maths. They run automatically before every build (`prebuild`), so a broken medical rule **stops the Vercel deploy** instead of going live. See `client/tests/README.md` — if a doctor changes a range, update the matching test in the same commit.

Backend tests: `cd server && npm test` — ~90 checks with no database needed (Mongoose calls are stubbed): API smoke, login/register rules, Help patient, the validation/authorization audit (`gaps.test.js`), payments (`payment.test.js`), Needs help + reminders + admin search (`needsHelp.test.js`) and the double-booking guard index (`slotIndex.test.js`). Run them before pushing server changes (Render doesn't run them for you).

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
