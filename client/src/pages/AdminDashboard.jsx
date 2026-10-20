// ============================================
// Admin Dashboard - Manage users and appointments
// ============================================

import { useState, useEffect, useRef } from 'react';
import { adminAPI, announcementAPI, complaintAPI, reviewAPI, blogViewAPI } from '../services/api';
import { articleMeta } from './blog/blogMeta';
import toast from 'react-hot-toast';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('');
  const [analytics, setAnalytics] = useState(null);

  // Announcements state
  const [announcements, setAnnouncements] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', audience: 'doctors' });

  // Data integrity: phone numbers shared by more than one account (a
  // formatting bug used to let this happen on re-registration — see
  // authController.js register(). Read-only check, surfaced here so it can
  // be reviewed and resolved manually via the existing Delete/Deactivate
  // actions below).
  const [duplicatePhones, setDuplicatePhones] = useState([]);

  // Complaints state
  const [complaints, setComplaints] = useState([]);
  const [complaintStatusFilter, setComplaintStatusFilter] = useState('');

  // Reviews moderation state
  const [reviews, setReviews] = useState([]);
  const [reviewHiddenFilter, setReviewHiddenFilter] = useState(''); // '' = all, 'true' = hidden, 'false' = visible

  // Blog analytics state. These are OUR OWN aggregate numbers (from the
  // BlogView collection): total reads and ❤️ likes per article. Deliberately
  // anonymous — we never track *who* read what (privacy, and a health site).
  // For visitor-level stats (how many people, from where, device), that's
  // Google Analytics, not this table.
  const [blogStats, setBlogStats] = useState(null);

  // Edit-availability modal (admin sets a doctor's weekly schedule for them).
  // `availDoctor` is the doctor being edited (null = modal closed); the rest
  // is the working draft, loaded from that doctor's current schedule.
  const [availDoctor, setAvailDoctor] = useState(null);
  const [availSchedule, setAvailSchedule] = useState([]); // [{day,startTime,endTime}]
  const [availDuration, setAvailDuration] = useState(30);
  const [availSelectedDays, setAvailSelectedDays] = useState([]);
  const [availStart, setAvailStart] = useState('09:00');
  const [availEnd, setAvailEnd] = useState('17:00');
  const [availSaving, setAvailSaving] = useState(false);
  const AVAIL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // User-detail modal — opened by clicking a row's name. Read-only drill-down
  // of everything we already have for that user (identity, contact, status,
  // and for patients their medical info + family members, for doctors their
  // full professional profile). `detailUser` is the user being viewed (null =
  // closed). No extra fetch needed: the users list already returns full
  // records (minus password), so this just presents what's loaded.
  const [detailUser, setDetailUser] = useState(null);
  // Recent appointments for the user in the detail modal, and a flag while the
  // full record is still being fetched (the modal opens instantly with the
  // partial data we already have, then fills in).
  const [detailAppointments, setDetailAppointments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Open the detail drill-down for a user. `partial` is whatever we already
  // have on hand (a full users-list row, or the lightly-populated apt.patient /
  // apt.doctor from the Appointments tab). We show it immediately, then fetch
  // the COMPLETE record (medical info, family, full profile) + recent
  // appointments so the modal is always rich regardless of where it was opened.
  const openUserDetail = async (partial) => {
    if (!partial || !partial._id) return;
    setDetailUser(partial);
    setDetailAppointments([]);
    setDetailLoading(true);
    try {
      const { data } = await adminAPI.getUser(partial._id);
      if (data?.user) setDetailUser(data.user);
      if (Array.isArray(data?.appointments)) setDetailAppointments(data.appointments);
    } catch {
      // Keep the partial data shown; just note we couldn't enrich it.
      toast.error('Could not load full details — showing what we have.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeUserDetail = () => { setDetailUser(null); setDetailAppointments([]); setDetailLoading(false); };

  // Edit-profile modal (admin edits a doctor's professional profile + how they
  // consult). `profileDoctor` is the doctor being edited (null = closed).
  const [profileDoctor, setProfileDoctor] = useState(null);
  const [profileForm, setProfileForm] = useState({ specialization: '', qualification: '', experience: '', consultationFee: '', bio: '', consultationModes: [] });
  const [profileSaving, setProfileSaving] = useState(false);
  const CONSULT_MODES = [
    { key: 'video', label: '📹 Video' },
    { key: 'phone', label: '📞 Phone' },
    { key: 'in-person', label: '🏥 In-person' },
  ];

  // Per-row "Manage" dropdown: which user's action menu is open (by _id, or
  // null). Collapses the ~10 per-row action buttons into one menu so the users
  // table stays narrow. The menu is rendered with FIXED positioning (anchored
  // to the trigger's on-screen rect) so it is never clipped by the table's
  // overflow-hidden / overflow-x-auto wrappers. Closes on outside-click,
  // Escape, or scroll/resize.
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);
  const openRowMenu = (e, userId) => {
    if (openMenuId === userId) { setOpenMenuId(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    // Align the menu's right edge under the trigger's right edge; width 224px (w-56).
    setMenuPos({ top: r.bottom + 4, left: Math.max(8, r.right - 224) });
    setOpenMenuId(userId);
  };
  useEffect(() => {
    if (!openMenuId) return;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null); };
    const onKey = (e) => { if (e.key === 'Escape') setOpenMenuId(null); };
    const onReflow = () => setOpenMenuId(null); // simplest: close on scroll/resize
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [openMenuId]);

  // Build a slug → {title, specialization, image} lookup once from the
  // lightweight article metadata, so we can show human-readable titles next
  // to the view counts (which are keyed by slug).
  const articleBySlug = Object.fromEntries(
    articleMeta.map((a) => [a.slug, a])
  );

  const fetchBlogStats = async () => {
    try {
      const { data } = await blogViewAPI.getAll(); // { counts: {slug:n}, likes: {slug:n} }
      const counts = data?.counts || {};
      const likes = data?.likes || {};
      // Merge every slug that has either a view or a like into one ranked list.
      const slugs = new Set([...Object.keys(counts), ...Object.keys(likes)]);
      const rows = [...slugs].map((slug) => {
        const meta = articleBySlug[slug];
        return {
          slug,
          title: meta?.title || slug,
          specialization: meta?.specialization || '—',
          image: meta?.image || '📄',
          views: counts[slug] || 0,
          likes: likes[slug] || 0,
        };
      }).sort((a, b) => b.views - a.views || b.likes - a.likes);

      const totalViews = rows.reduce((s, r) => s + r.views, 0);
      const totalLikes = rows.reduce((s, r) => s + r.likes, 0);
      setBlogStats({ rows, totalViews, totalLikes, articlesTracked: rows.length });
    } catch (error) {
      toast.error('Failed to load blog analytics');
    }
  };

  const fetchReviews = async () => {
    try {
      const params = reviewHiddenFilter ? { hidden: reviewHiddenFilter } : {};
      const response = await reviewAPI.getAll(params);
      setReviews(response.data.reviews || []);
    } catch (error) {
      toast.error('Failed to load reviews');
    }
  };

  const handleToggleReviewHidden = async (review) => {
    const willHide = !review.isHidden;
    let reason = '';
    if (willHide) {
      reason = window.prompt('Reason for hiding this review (optional):', '') || '';
    }
    try {
      await reviewAPI.setHidden(review._id, { isHidden: willHide, hiddenReason: reason });
      toast.success(willHide ? 'Review hidden' : 'Review unhidden');
      fetchReviews();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update review');
    }
  };

  // Fetch stats on load
  useEffect(() => {
    fetchStats();
    fetchDuplicatePhones();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await adminAPI.getStats();
      setStats(response.data.stats);
    } catch (error) {
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  // Repair the email index — fixes "email already exists" when a phone-only
  // patient (no email) tries to register, caused by a legacy non-sparse unique
  // index. Idempotent and safe to run anytime.
  const [fixingEmailIndex, setFixingEmailIndex] = useState(false);
  const handleFixEmailIndex = async () => {
    if (!window.confirm('Repair the email index now?\n\nThis fixes patient registrations failing with "email already exists" when no email is entered. Safe to run anytime.')) return;
    setFixingEmailIndex(true);
    try {
      const response = await adminAPI.fixEmailIndex();
      toast.success(response.data.message, { duration: 7000 });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to repair email index');
    } finally {
      setFixingEmailIndex(false);
    }
  };

  const fetchDuplicatePhones = async () => {
    try {
      const response = await adminAPI.getDuplicatePhones();
      setDuplicatePhones(response.data.duplicates || []);
    } catch (error) { /* non-critical — don't block the rest of the panel */ }
  };

  // Non-destructive alternative to permanent Delete, for two cases:
  //   - An already-deleted account blocking someone else's login (duplicate
  //     resolution) — just renames its phone/email out of the way.
  //   - A still-active account you want to reset so it (or someone) can
  //     re-register fresh with the same phone/email — renames the contact
  //     info AND deactivates the old account in the same step.
  // Either way, the record and all its appointment/prescription/report
  // history stay completely intact — this is the RIGHT tool for both,
  // instead of reaching for permanent Delete.
  const handleFreeUpContactInfo = async (acc) => {
    const confirmMsg = acc.isDeleted
      ? `Free up "${acc.name}"'s phone/email so the other account can use it?\n\nThis keeps their record and all appointment history intact — it just renames the contact info out of the way, the same thing that happens automatically when someone re-registers.`
      : `Free up "${acc.name}" for a new signup?\n\nThis deactivates the account (hidden, can't log in) and renames their phone/email out of the way so they (or someone else) can register fresh with the same details. All existing appointment/prescription/report history is kept intact — nothing is deleted.\n\nNote: this does NOT reset a password — use "Send Password Reset" for that.`;
    if (!window.confirm(confirmMsg)) return;
    try {
      const response = await adminAPI.freeUpContactInfo(acc._id);
      toast.success(response.data.message, { duration: 6000 });
      fetchDuplicatePhones();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to free up contact info');
    }
  };

  // Which onboarding steps a doctor still hasn't finished — kept in sync with
  // the backend's getDoctorMissingSteps so the admin sees the same picture the
  // reminder email is based on.
  const getDoctorMissingSteps = (u) => {
    const missing = [];
    if (u.email && !u.isVerified) missing.push('Email');
    if (!u.availability || u.availability.length === 0) missing.push('Availability');
    if (!u.specialization || !u.consultationFee) missing.push('Profile');
    return missing;
  };

  const handleSendReminder = async (u) => {
    if (!window.confirm(`Email "${u.name}" a reminder to finish their setup?`)) return;
    try {
      const response = await adminAPI.sendSetupReminder(u._id);
      toast.success(response.data.message, { duration: 6000 });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send reminder');
    }
  };

  // Manual "click-to-WhatsApp" reminder. This does NOT send anything by itself
  // and uses no paid WhatsApp API — it just opens WhatsApp (web/app) with the
  // doctor's number and a pre-filled, profile-aware message. The admin reviews
  // it and presses send, so it stays personal and free. English only, on
  // purpose (per request — no bilingual text for doctors).
  const handleWhatsAppReminder = (u) => {
    // wa.me needs digits only (no '+' or spaces). Stored phones look like
    // "+919599150825"; strip everything that isn't a digit.
    const digits = (u.phone || '').replace(/\D/g, '');
    if (!digits) {
      toast.error('No phone number on file for this doctor');
      return;
    }

    // Turn the pending onboarding steps into specific, friendly asks so the
    // message names exactly what THIS doctor still needs to do.
    const missing = getDoctorMissingSteps(u);
    const asks = [];
    if (missing.includes('Email')) {
      asks.push('• Verify your email (please also check your Spam/Junk folder — the verification email sometimes lands there; mark it "Not spam", then click Verify)');
    }
    if (missing.includes('Profile')) {
      asks.push('• Complete your profile (specialization and consultation fee) so patients can find and choose you');
    }
    if (missing.includes('Availability')) {
      asks.push('• Add your weekly availability so patients can book appointment slots with you');
    }

    // Doctors' stored names often already include a "Dr"/"Dr." prefix
    // (e.g. "Dr Anurag Agarwal"), so naively taking the first word gave
    // "Hello Dr. Dr". Strip a leading Dr/Dr. first, THEN take the first name,
    // so we get "Hello Dr. Anurag" whether or not the name was prefixed.
    const cleanedName = (u.name || 'Doctor').replace(/^\s*dr\.?\s+/i, '').trim();
    const firstName = (cleanedName || 'Doctor').split(' ')[0];
    const message =
      `Hello Dr. ${firstName}, this is the ProMedicoz team.\n\n` +
      `Your account is almost ready. To start appearing to patients and receiving bookings, please finish these steps:\n\n` +
      `${asks.join('\n')}\n\n` +
      `You can do all of this here: https://www.promedicoz.in/dashboard\n\n` +
      `Once done, your profile goes live for patients. Reply here if you need any help. Thank you!`;

    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Bypass a stuck email verification (e.g. the verification email went to
  // spam). Only do this once you're confident the doctor is genuine, since
  // it's what makes them visible/bookable to patients.
  const handleMarkEmailVerified = async (u) => {
    if (!window.confirm(`Mark "${u.name}"'s email as verified?\n\nUse this only if you've confirmed this is a real doctor. It makes them live and visible to patients (bypassing the email link, useful when that email landed in spam).`)) return;
    try {
      const response = await adminAPI.markEmailVerified(u._id);
      toast.success(response.data.message, { duration: 6000 });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to mark email verified');
    }
  };

  const fetchUsers = async () => {
    try {
      const params = { limit: 50 };
      if (userRoleFilter) params.role = userRoleFilter;
      if (userSearch) params.search = userSearch;
      const response = await adminAPI.getUsers(params);
      setUsers(response.data.users);
    } catch (error) {
      toast.error('Failed to load users');
    }
  };

  const fetchAppointments = async () => {
    try {
      const params = { limit: 50 };
      if (appointmentStatusFilter) params.status = appointmentStatusFilter;
      const response = await adminAPI.getAppointments(params);
      setAppointments(response.data.appointments);
    } catch (error) {
      toast.error('Failed to load appointments');
    }
  };

  // Confirm a pending appointment on the doctor's behalf (doctors sometimes
  // forget). The patient gets the same confirmation email + push a doctor
  // confirm sends. Asks first since it notifies the patient.
  const handleConfirmAppointment = async (apt) => {
    const who = apt.patient?.name || 'the patient';
    const dr = apt.doctor?.name || 'the doctor';
    if (!window.confirm(`Confirm this appointment on behalf of Dr. ${dr}?\n\n${who} will be notified (email + app) that their appointment on ${formatDate(apt.date)} at ${apt.timeSlot} is confirmed.`)) return;
    try {
      const response = await adminAPI.confirmAppointment(apt._id);
      toast.success(response.data.message, { duration: 6000 });
      fetchAppointments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to confirm appointment');
    }
  };

  const fetchComplaints = async () => {
    try {
      const params = { limit: 50 };
      if (complaintStatusFilter) params.status = complaintStatusFilter;
      const response = await complaintAPI.getAll(params);
      setComplaints(response.data.complaints);
    } catch (error) {
      toast.error('Failed to load complaints');
    }
  };

  // Admin's response is what the patient actually sees, so we ask for it
  // with a real prompt rather than a silent status flip - marking something
  // "Resolved" without telling them what was resolved isn't useful to them.
  const handleRespondToComplaint = async (complaint) => {
    const text = window.prompt('Response to send to the patient:', complaint.response || '');
    if (text === null) return; // cancelled
    if (!text.trim()) { toast.error('Response cannot be empty'); return; }
    try {
      await complaintAPI.update(complaint._id, { response: text.trim(), status: 'resolved' });
      toast.success('Response sent to patient');
      fetchComplaints();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send response');
    }
  };

  const handleUpdateComplaintStatus = async (complaint, status) => {
    try {
      await complaintAPI.update(complaint._id, { status });
      toast.success(`Marked as "${status}"`);
      fetchComplaints();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const getComplaintStatusColor = (status) => ({
    open: 'bg-yellow-100 text-yellow-800',
    'in-progress': 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-600'
  }[status] || 'bg-gray-100 text-gray-600');

  const fetchAnalytics = async () => {
    try {
      const response = await adminAPI.getAnalytics();
      setAnalytics(response.data);
    } catch (error) {
      toast.error('Failed to load analytics');
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const response = await announcementAPI.getAll();
      setAnnouncements(response.data.announcements || []);
    } catch (error) {
      toast.error('Failed to load announcements');
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
      toast.error('Please enter a title and message');
      return;
    }
    try {
      await announcementAPI.create(announcementForm);
      toast.success('Announcement posted');
      setAnnouncementForm({ title: '', message: '', audience: 'doctors' });
      fetchAnnouncements();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to post announcement');
    }
  };

  const handleToggleAnnouncement = async (a) => {
    try {
      await announcementAPI.update(a._id, { active: !a.active });
      fetchAnnouncements();
    } catch (error) {
      toast.error('Failed to update announcement');
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await announcementAPI.remove(id);
      toast.success('Announcement deleted');
      fetchAnnouncements();
    } catch (error) {
      toast.error('Failed to delete announcement');
    }
  };

  // Load data when switching tabs
  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'appointments') fetchAppointments();
    if (activeTab === 'complaints') fetchComplaints();
    if (activeTab === 'reviews') fetchReviews();
  }, [activeTab, userRoleFilter, appointmentStatusFilter, complaintStatusFilter, reviewHiddenFilter]);

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`Permanently DELETE "${name}"?\n\nThis also deletes all their appointments and cannot be undone — there is no recovery from this app.\n\nTip: use "Deactivate" to just hide them, or "Free Up for New Signup" if you want them to sign up fresh with the same phone/email. Both keep all their records intact.`)) return;
    try {
      await adminAPI.deleteUser(id);
      toast.success(`User "${name}" deleted`);
      fetchUsers();
      fetchStats();
      fetchDuplicatePhones();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleToggleVerification = async (user) => {
    const verify = !user.isAdminVerified;
    if (verify && !window.confirm(`Mark "${user.name}" as Verified by ProMedicoz?\n\nOnly do this after checking their medical registration number / credentials. This shows a trust badge to patients.`)) return;
    try {
      await adminAPI.setVerification(user._id, verify);
      toast.success(verify ? `"${user.name}" marked as verified` : `Verification removed for "${user.name}"`);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update verification');
    }
  };

  const handleGenerateResetLink = async (user) => {
    if (!window.confirm(`Generate a password reset link for "${user.name}"?\n\nOnly do this after verifying it's really them (e.g. a phone call) — the link lets whoever has it set a new password.`)) return;
    try {
      const response = await adminAPI.generateResetLink(user._id);
      const { resetUrl, emailed, message } = response.data;
      if (emailed) {
        toast.success(message);
      } else {
        // No email on file — the admin needs to relay this link manually (e.g. WhatsApp)
        try {
          await navigator.clipboard.writeText(resetUrl);
          toast.success(`${message} Link copied to clipboard.`, { duration: 6000 });
        } catch (clipboardErr) {
          // Clipboard access can fail (permissions/older browsers) — fall back to showing it directly
          window.prompt('Copy this reset link and send it to the patient manually:', resetUrl);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate reset link');
    }
  };

  const handleToggleSuspension = async (user) => {
    const suspend = !user.isSuspended;
    if (suspend) {
      const reason = window.prompt(`Deactivate "${user.name}"?\n\nThey will be hidden from patients and blocked from logging in, but all their records are kept.\n\nOptional reason (for your records):`, '');
      if (reason === null) return; // Cancelled
      try {
        await adminAPI.setSuspension(user._id, true, reason);
        toast.success(`"${user.name}" deactivated`);
        fetchUsers();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to deactivate user');
      }
    } else {
      if (!window.confirm(`Reactivate "${user.name}"? They will be visible and able to log in again.`)) return;
      try {
        await adminAPI.setSuspension(user._id, false);
        toast.success(`"${user.name}" reactivated`);
        fetchUsers();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to reactivate user');
      }
    }
  };

  // Edit a doctor's phone / WhatsApp on their behalf (support requests).
  // Uses simple prompts to stay consistent with the other admin actions here.
  // Pre-fills current values; an unchanged value is skipped, so you can edit
  // just one. Cancelling either prompt aborts the whole thing.
  const handleEditContact = async (user) => {
    const newPhone = window.prompt(
      `Edit phone number for "${user.name}".\n\nThis is their main contact / login number. Leave as-is to keep it unchanged.`,
      user.phone || ''
    );
    if (newPhone === null) return; // cancelled

    const newWhatsApp = window.prompt(
      `Edit WhatsApp number for "${user.name}" (optional).\n\nThis powers the public "Message on WhatsApp" button on their profile. Clear it to remove that button. Leave as-is to keep it unchanged.`,
      user.whatsappNumber || ''
    );
    if (newWhatsApp === null) return; // cancelled

    // Only send fields that actually changed from what's on record.
    const payload = {};
    if (newPhone.trim() !== (user.phone || '')) payload.phone = newPhone.trim();
    if (newWhatsApp.trim() !== (user.whatsappNumber || '')) payload.whatsappNumber = newWhatsApp.trim();

    if (Object.keys(payload).length === 0) {
      toast('No changes made.', { icon: 'ℹ️' });
      return;
    }

    try {
      const response = await adminAPI.updateDoctorContact(user._id, payload);
      toast.success(response.data.message, { duration: 5000 });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update contact details');
    }
  };

  // Edit a doctor's City / Clinic Address on their behalf (support case — e.g.
  // a doctor who entered their state in the City field, like "Chhattisgarh"
  // instead of "Bhilai"). Pre-fills current values; an unchanged value is
  // skipped so you can edit just one. Cancelling either prompt aborts.
  const handleEditLocation = async (user) => {
    const newCity = window.prompt(
      `Edit City for "${user.name}".\n\nThis is the city shown on their profile and used for city search/landing pages (enter a city, not a state). Leave as-is to keep it unchanged.`,
      user.city || ''
    );
    if (newCity === null) return; // cancelled

    const newAddress = window.prompt(
      `Edit Clinic Address for "${user.name}" (optional).\n\nShown on their profile with a "Get Directions" link. Leave as-is to keep it unchanged.`,
      user.clinicAddress || ''
    );
    if (newAddress === null) return; // cancelled

    const payload = {};
    if (newCity.trim() !== (user.city || '').trim()) {
      if (!newCity.trim()) { toast.error('City cannot be empty.'); return; }
      payload.city = newCity.trim();
    }
    if (newAddress.trim() !== (user.clinicAddress || '').trim()) payload.clinicAddress = newAddress.trim();

    if (Object.keys(payload).length === 0) {
      toast('No changes made.', { icon: 'ℹ️' });
      return;
    }

    try {
      const response = await adminAPI.updateDoctorLocation(user._id, payload);
      toast.success(response.data.message, { duration: 5000 });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update location');
    }
  };

  // ---- Edit a doctor's weekly availability on their behalf ----
  // Opens the modal pre-loaded with the doctor's CURRENT schedule (from the
  // users list data we already have), so the admin edits their real schedule.
  const openAvailabilityModal = (user) => {
    setAvailDoctor(user);
    setAvailSchedule(Array.isArray(user.availability)
      ? user.availability.map((s) => ({ day: s.day, startTime: s.startTime, endTime: s.endTime }))
      : []);
    setAvailDuration([15, 30, 45, 60].includes(user.slotDuration) ? user.slotDuration : 30);
    setAvailSelectedDays([]);
    setAvailStart('09:00');
    setAvailEnd('17:00');
  };

  const closeAvailabilityModal = () => {
    if (availSaving) return;
    setAvailDoctor(null);
  };

  const toggleAvailDay = (day) =>
    setAvailSelectedDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);

  // Add the chosen time block to each selected day (skips exact duplicates),
  // mirroring the doctor-side DoctorAvailability validation.
  const addAvailBlocks = () => {
    if (availSelectedDays.length === 0) { toast.error('Select at least one day'); return; }
    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const startM = toMin(availStart);
    let endM = toMin(availEnd);
    if (endM === 0) endM = 24 * 60; // midnight end-of-day
    if (startM >= endM) { toast.error('Start time must be before end time (use 00:00 as "To" for midnight)'); return; }
    const additions = availSelectedDays
      .map((day) => ({ day, startTime: availStart, endTime: availEnd }))
      .filter((n) => !availSchedule.some((e) => e.day === n.day && e.startTime === n.startTime && e.endTime === n.endTime));
    if (additions.length === 0) { toast.error('Those slots already exist'); return; }
    setAvailSchedule((prev) => [...prev, ...additions]);
    setAvailSelectedDays([]);
  };

  const removeAvailSlot = (index) =>
    setAvailSchedule((prev) => prev.filter((_, i) => i !== index));

  const saveAvailability = async () => {
    if (!availDoctor) return;
    setAvailSaving(true);
    try {
      const response = await adminAPI.updateDoctorAvailability(availDoctor._id, {
        availability: availSchedule,
        slotDuration: availDuration,
      });
      toast.success(response.data.message, { duration: 5000 });
      setAvailDoctor(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update availability');
    } finally {
      setAvailSaving(false);
    }
  };

  // ---- Edit a doctor's professional profile + consultation modes ----
  const openProfileModal = (user) => {
    setProfileDoctor(user);
    setProfileForm({
      specialization: user.specialization || '',
      qualification: user.qualification || '',
      experience: user.experience != null ? String(user.experience) : '',
      consultationFee: user.consultationFee != null ? String(user.consultationFee) : '',
      bio: user.bio || '',
      consultationModes: Array.isArray(user.consultationModes) ? [...user.consultationModes] : [],
    });
  };
  const closeProfileModal = () => { if (!profileSaving) setProfileDoctor(null); };
  const toggleConsultMode = (mode) =>
    setProfileForm((p) => ({
      ...p,
      consultationModes: p.consultationModes.includes(mode)
        ? p.consultationModes.filter((m) => m !== mode)
        : [...p.consultationModes, mode],
    }));

  const saveProfile = async () => {
    if (!profileDoctor) return;
    // Build a payload of only the fields that actually changed from the record,
    // so we never overwrite a field the admin didn't touch.
    const d = profileDoctor;
    const payload = {};
    if (profileForm.specialization.trim() !== (d.specialization || '').trim()) payload.specialization = profileForm.specialization.trim();
    if (profileForm.qualification.trim() !== (d.qualification || '').trim()) payload.qualification = profileForm.qualification.trim();
    if (profileForm.bio.trim() !== (d.bio || '').trim()) payload.bio = profileForm.bio.trim();
    if (profileForm.experience !== '' && Number(profileForm.experience) !== Number(d.experience || 0)) payload.experience = Number(profileForm.experience);
    if (profileForm.consultationFee !== '' && Number(profileForm.consultationFee) !== Number(d.consultationFee || 0)) payload.consultationFee = Number(profileForm.consultationFee);
    const curModes = [...(d.consultationModes || [])].sort().join(',');
    const newModes = [...profileForm.consultationModes].sort().join(',');
    if (curModes !== newModes) payload.consultationModes = profileForm.consultationModes;

    if (Object.keys(payload).length === 0) { toast('No changes made.', { icon: 'ℹ️' }); return; }

    setProfileSaving(true);
    try {
      const response = await adminAPI.updateDoctorProfile(d._id, payload);
      toast.success(response.data.message, { duration: 5000 });
      setProfileDoctor(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSearchUsers = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Sidebar nav items. `onSelect` preserves the original tab buttons' side-
  // effects (some tabs kick off their own fetch when first opened). The tab
  // content blocks below are unchanged — this only replaces the old top tab
  // bar with a console-style sidebar.
  const NAV_ITEMS = [
    { key: 'stats', label: 'Overview', icon: '📊' },
    { key: 'users', label: 'Users', icon: '👥' },
    { key: 'appointments', label: 'Appointments', icon: '📅' },
    { key: 'analytics', label: 'Revenue & Analytics', icon: '💰', onSelect: fetchAnalytics },
    { key: 'announcements', label: 'Announcements', icon: '📣', onSelect: fetchAnnouncements },
    { key: 'complaints', label: 'Complaints', icon: '💬' },
    { key: 'reviews', label: 'Reviews', icon: '⭐' },
    { key: 'blog', label: 'Blog Analytics', icon: '📈', onSelect: fetchBlogStats },
  ];
  const selectTab = (item) => {
    setActiveTab(item.key);
    if (item.onSelect) item.onSelect();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg text-gray-600">Loading admin panel...</div>
      </div>
    );
  }

  return (
    <div className="lg:flex lg:min-h-[calc(100vh-4rem)] bg-gray-50">
      {/* ===== Sidebar nav (console style) ===== On desktop it's a fixed-width
          dark rail; on mobile it collapses to a horizontal scrolling bar at
          the top. Replaces the old top tab bar — same tabs, same side-effects
          (via selectTab). */}
      <aside className="lg:w-60 lg:flex-shrink-0 bg-slate-900 text-white lg:min-h-full">
        <div className="px-5 pt-5 pb-3 hidden lg:block">
          <div className="text-lg font-extrabold flex items-center gap-2">
            <span aria-hidden="true">⚕</span> ProMedicoz
          </div>
          <div className="text-[10px] font-semibold tracking-widest text-slate-400 mt-0.5">ADMIN CONSOLE</div>
        </div>
        <nav className="flex lg:flex-col gap-1 p-3 overflow-x-auto lg:overflow-visible">
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.key;
            // Small attention badges from data we already have.
            const badge = item.key === 'complaints'
              ? complaints.filter((c) => c.status === 'open').length
              : item.key === 'stats'
                ? duplicatePhones.length
                : 0;
            return (
              <button
                key={item.key}
                onClick={() => selectTab(item)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 lg:w-full ${active ? 'bg-primary-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
                {badge > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">{badge}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="p-3 hidden lg:block mt-auto">
          <a href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <span aria-hidden="true">↩</span> Back to site
          </a>
        </div>
      </aside>

      {/* ===== Content column ===== */}
      <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 lg:py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          {(NAV_ITEMS.find((n) => n.key === activeTab) || {}).label || 'Admin Dashboard'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Manage users, appointments, and monitor platform activity</p>
      </div>

      {/* === STATS TAB === */}
      {activeTab === 'stats' && stats && (
        <div>
          {/* Maintenance — on-demand fix for the "email already exists" bug on
              phone-only patient registration (legacy non-sparse email index). */}
          <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-800 text-sm">Registration fix — email index</h3>
              <p className="text-xs text-gray-500 mt-0.5">Run this if patients without an email get "email already exists" when registering. Safe to run anytime.</p>
            </div>
            <button
              onClick={handleFixEmailIndex}
              disabled={fixingEmailIndex}
              className="flex-shrink-0 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
            >
              {fixingEmailIndex ? 'Repairing…' : 'Repair email index'}
            </button>
          </div>

          {/* Data integrity warning — a phone number shared by more than one
              account can cause login to find the WRONG one (e.g. a deleted
              duplicate instead of the real active account). Read-only check;
              resolve each case with the existing Delete/Deactivate actions. */}
          {duplicatePhones.length > 0 && (
            <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-5">
              <h3 className="font-semibold text-red-800 mb-1">⚠️ Duplicate phone numbers found</h3>
              <p className="text-sm text-red-700 mb-4">
                These phone numbers are shared by more than one account. This can cause login to find the wrong one (e.g. an old deleted account instead of the real active one). For a deleted account, prefer <strong>"Free Up Contact Info"</strong> — it keeps their record and appointment history intact (medical/legal record-keeping) and just frees up the phone/email for the other account. Only use <strong>"Delete Permanently"</strong> if you're sure that account never had any real activity worth keeping.
              </p>
              <div className="space-y-4">
                {duplicatePhones.map((group) => (
                  <div key={group.phone} className="bg-white rounded-lg border border-red-100 p-4">
                    <p className="text-sm font-medium text-gray-800 mb-2">{group.phone}</p>
                    <div className="space-y-2">
                      {group.accounts.map((acc) => (
                        <div key={acc._id} className="flex items-center justify-between gap-3 text-sm p-2 bg-gray-50 rounded">
                          <div>
                            <span className="font-medium text-gray-800">{acc.name}</span>{' '}
                            <span className="text-gray-500">({acc.role})</span>{' '}
                            {acc.isDeleted && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">Deleted</span>}
                            {!acc.isDeleted && acc.isSuspended && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Deactivated</span>}
                            {!acc.isDeleted && !acc.isSuspended && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>}
                            <span className="text-gray-400 ml-2">{acc.email || 'no email'} · joined {formatDate(acc.createdAt)}</span>
                          </div>
                          {acc.role !== 'admin' && (
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {acc.isDeleted && (
                                <button
                                  onClick={() => handleFreeUpContactInfo(acc)}
                                  className="text-indigo-600 hover:text-indigo-800 text-xs font-medium whitespace-nowrap"
                                  title="Keeps the record and appointment history — just frees up the phone/email"
                                >
                                  Free Up Contact Info
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteUser(acc._id, acc.name)}
                                className="text-red-500 hover:text-red-700 text-xs font-medium whitespace-nowrap"
                                title="Permanent — also deletes all their appointments"
                              >
                                Delete Permanently
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clickable stat cards — each drills into the matching tab with the
              relevant filter pre-applied, so a number leads to the actual list. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <button
              onClick={() => { setUserRoleFilter(''); setActiveTab('users'); }}
              className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg hover:bg-gray-50 transition-all"
            >
              <div className="text-3xl font-bold text-primary-600">{stats.totalUsers}</div>
              <div className="text-gray-600 mt-1">Total Users</div>
              <div className="text-xs text-primary-500 mt-1">View all →</div>
            </button>
            <button
              onClick={() => { setUserRoleFilter('doctor'); setActiveTab('users'); }}
              className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg hover:bg-gray-50 transition-all"
            >
              <div className="text-3xl font-bold text-blue-600">{stats.totalDoctors}</div>
              <div className="text-gray-600 mt-1">Doctors</div>
              <div className="text-xs text-blue-500 mt-1">View doctors →</div>
            </button>
            <button
              onClick={() => { setUserRoleFilter('patient'); setActiveTab('users'); }}
              className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg hover:bg-gray-50 transition-all"
            >
              <div className="text-3xl font-bold text-green-600">{stats.totalPatients}</div>
              <div className="text-gray-600 mt-1">Patients</div>
              <div className="text-xs text-green-500 mt-1">View patients →</div>
            </button>
            <button
              onClick={() => { setAppointmentStatusFilter(''); setActiveTab('appointments'); }}
              className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg hover:bg-gray-50 transition-all"
            >
              <div className="text-3xl font-bold text-purple-600">{stats.totalAppointments}</div>
              <div className="text-gray-600 mt-1">Appointments</div>
              <div className="text-xs text-purple-500 mt-1">View all →</div>
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Appointment Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => { setAppointmentStatusFilter('pending'); setActiveTab('appointments'); }}
                className="p-4 bg-yellow-50 rounded-lg text-center hover:bg-yellow-100 transition-colors"
              >
                <div className="text-2xl font-bold text-yellow-700">{stats.pendingAppointments}</div>
                <div className="text-yellow-600 text-sm">Pending</div>
              </button>
              <button
                onClick={() => { setAppointmentStatusFilter('confirmed'); setActiveTab('appointments'); }}
                className="p-4 bg-green-50 rounded-lg text-center hover:bg-green-100 transition-colors"
              >
                <div className="text-2xl font-bold text-green-700">{stats.confirmedAppointments}</div>
                <div className="text-green-600 text-sm">Confirmed</div>
              </button>
              <button
                onClick={() => { setAppointmentStatusFilter('completed'); setActiveTab('appointments'); }}
                className="p-4 bg-blue-50 rounded-lg text-center hover:bg-blue-100 transition-colors"
              >
                <div className="text-2xl font-bold text-blue-700">{stats.completedAppointments}</div>
                <div className="text-blue-600 text-sm">Completed</div>
              </button>
              <button
                onClick={() => { setAppointmentStatusFilter('cancelled'); setActiveTab('appointments'); }}
                className="p-4 bg-red-50 rounded-lg text-center hover:bg-red-100 transition-colors"
              >
                <div className="text-2xl font-bold text-red-700">{stats.cancelledAppointments}</div>
                <div className="text-red-600 text-sm">Cancelled</div>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* === USERS TAB === */}
      {activeTab === 'users' && (
        <div>
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex flex-col sm:flex-row gap-3">
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">All Roles</option>
              <option value="doctor">Doctors</option>
              <option value="patient">Patients</option>
              <option value="admin">Admins</option>
            </select>
            <form onSubmit={handleSearchUsers} className="flex gap-2 flex-grow">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name, email, phone, or Patient ID..."
                className="flex-grow px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
              <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                Search
              </button>
            </form>
          </div>

          {/* Users table */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Name</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Patient ID</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Email</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Phone</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Role</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Joined</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        {/* Click the name to open the full detail drill-down. */}
                        <button
                          onClick={() => openUserDetail(user)}
                          className="text-left font-medium text-primary-700 hover:text-primary-900 hover:underline inline-flex items-center gap-1"
                          title="View full details"
                        >
                          {user.name}
                          <span className="text-gray-300 text-xs" aria-hidden="true">›</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">{user.patientId || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.phone || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === 'doctor' ? 'bg-blue-100 text-blue-700' :
                          user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {user.isDeleted ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600" title={user.deletedAt ? `Deleted ${formatDate(user.deletedAt)}` : 'Deleted'}>
                              Deleted
                            </span>
                          ) : user.isSuspended ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              Deactivated
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              Active
                            </span>
                          )}
                          {user.isAdminVerified && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              ✓ Verified
                            </span>
                          )}
                          {/* Doctor onboarding completeness — surfaces WHY a
                              doctor isn't yet visible/bookable to patients. */}
                          {user.role === 'doctor' && !user.isDeleted && (() => {
                            const missing = getDoctorMissingSteps(user);
                            if (missing.length === 0) {
                              return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Setup complete</span>;
                            }
                            return missing.map((m) => (
                              <span key={m} className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700" title={`Doctor still needs to: ${m}`}>
                                Needs {m}
                              </span>
                            ));
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3">
                        {user.role !== 'admin' && (
                          <div className="inline-block text-left">
                            {/* Single "Manage" trigger collapses the ~10 per-row
                                actions into one dropdown, so the table stays
                                narrow instead of a wide run-on row of links. */}
                            <button
                              onClick={(e) => openRowMenu(e, user._id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                              aria-haspopup="true"
                              aria-expanded={openMenuId === user._id}
                            >
                              Manage
                              <span className={`text-xs transition-transform ${openMenuId === user._id ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
                            </button>
                            {openMenuId === user._id && (
                            <div
                              ref={menuRef}
                              onClick={() => setOpenMenuId(null)}
                              style={{ top: menuPos.top, left: menuPos.left }}
                              className="fixed z-50 w-56 max-h-[70vh] overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 flex flex-col text-left [&>button]:w-full [&>button]:text-left [&>button]:px-3 [&>button]:py-2 [&>button]:text-sm [&>button]:font-medium [&>button]:hover:bg-gray-50 [&>button]:transition-colors"
                            >
                            {/* A self-deleted account already can't log in and is hidden from
                                patients/search — verifying, deactivating, or resetting its
                                password no longer does anything useful. Only permanent Delete
                                (to purge before the 90-day retention window) still applies.
                                All actions live in this dropdown; each button's handler is
                                unchanged (clicking any also closes the menu via the panel's
                                onClick) — colours below are kept for meaning. */}
                            {!user.isDeleted && user.role === 'doctor' && (
                              <button
                                onClick={() => handleToggleVerification(user)}
                                className={`${
                                  user.isAdminVerified
                                    ? 'text-gray-500 hover:text-gray-700'
                                    : 'text-blue-600 hover:text-blue-800'
                                }`}
                              >
                                {user.isAdminVerified ? 'Unverify' : '✓ Verify'}
                              </button>
                            )}
                            {/* Admin bypass for a doctor stuck on email
                                verification (email in spam). This is the flag
                                that makes them visible to patients. */}
                            {!user.isDeleted && user.role === 'doctor' && user.email && !user.isVerified && (
                              <button
                                onClick={() => handleMarkEmailVerified(user)}
                                className="text-sm font-medium text-green-600 hover:text-green-800"
                                title="Mark this doctor's email as verified so they go live (use when the verification email landed in spam)"
                              >
                                ✅ Verify Email
                              </button>
                            )}
                            {/* Nudge an incomplete doctor to finish onboarding.
                                Only shown when there's actually something
                                pending AND we have an email to send it to. */}
                            {!user.isDeleted && user.role === 'doctor' && user.email && getDoctorMissingSteps(user).length > 0 && (
                              <button
                                onClick={() => handleSendReminder(user)}
                                className="text-sm font-medium text-amber-600 hover:text-amber-800"
                                title="Email this doctor a reminder of the setup steps they still need to finish"
                              >
                                📧 Remind
                              </button>
                            )}
                            {/* WhatsApp reminder — opens WhatsApp with a
                                profile-aware message pre-filled; admin presses
                                send. Shown when steps are pending AND we have a
                                phone number (works even for doctors with no
                                email, where the email reminder can't help). */}
                            {!user.isDeleted && user.role === 'doctor' && user.phone && getDoctorMissingSteps(user).length > 0 && (
                              <button
                                onClick={() => handleWhatsAppReminder(user)}
                                className="text-sm font-medium text-green-600 hover:text-green-800"
                                title="Open WhatsApp with a reminder of the setup steps pre-filled — you review and send"
                              >
                                📱 WhatsApp
                              </button>
                            )}
                            {!user.isDeleted && (
                              <button
                                onClick={() => handleToggleSuspension(user)}
                                className={`text-sm font-medium ${
                                  user.isSuspended
                                    ? 'text-green-600 hover:text-green-800'
                                    : 'text-orange-500 hover:text-orange-700'
                                }`}
                              >
                                {user.isSuspended ? 'Reactivate' : 'Deactivate'}
                              </button>
                            )}
                            {!user.isDeleted && (
                              <button
                                onClick={() => handleGenerateResetLink(user)}
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                                title={user.email ? 'Password recovery: emails this user a link to set a new password (keeps their account)' : 'Password recovery: no email on file, copies a link for you to send manually (keeps their account)'}
                              >
                                Send Password Reset
                              </button>
                            )}
                            {!user.isDeleted && user.role === 'doctor' && (
                              <button
                                onClick={() => openProfileModal(user)}
                                className="text-sm font-medium text-fuchsia-600 hover:text-fuchsia-800"
                                title="Edit this doctor's professional profile (specialization, qualification, experience, fee, bio) and consultation modes on their behalf"
                              >
                                Edit Profile
                              </button>
                            )}
                            {!user.isDeleted && user.role === 'doctor' && (
                              <button
                                onClick={() => handleEditContact(user)}
                                className="text-sm font-medium text-teal-600 hover:text-teal-800"
                                title="Edit this doctor's phone / WhatsApp number on their behalf (for support requests)"
                              >
                                Edit Contact
                              </button>
                            )}
                            {!user.isDeleted && user.role === 'doctor' && (
                              <button
                                onClick={() => handleEditLocation(user)}
                                className="text-sm font-medium text-sky-600 hover:text-sky-800"
                                title="Edit this doctor's city / clinic address on their behalf (e.g. fix a state entered in the City field)"
                              >
                                Edit Location
                              </button>
                            )}
                            {!user.isDeleted && user.role === 'doctor' && (
                              <button
                                onClick={() => openAvailabilityModal(user)}
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                                title="Set this doctor's weekly schedule on their behalf (for doctors who ask the admin to set it up)"
                              >
                                Edit Availability
                              </button>
                            )}
                            <button
                              onClick={() => handleFreeUpContactInfo(user)}
                              className="text-sm font-medium text-purple-600 hover:text-purple-800"
                              title="Lets this person sign up again from scratch: deactivates the account and frees up their phone/email so it can be reused for a brand-new registration — keeps all their past records"
                            >
                              Free Up for New Signup
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user._id, user.name)}
                              className="text-red-500 hover:text-red-700 text-sm font-medium"
                            >
                              Delete
                            </button>
                            </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {users.length === 0 && (
              <div className="text-center py-8 text-gray-500">No users found</div>
            )}
          </div>
        </div>
      )}

      {/* === APPOINTMENTS TAB === */}
      {activeTab === 'appointments' && (
        <div>
          {/* Filter */}
          <div className="bg-white rounded-xl shadow-md p-4 mb-6">
            <select
              value={appointmentStatusFilter}
              onChange={(e) => setAppointmentStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Appointments table */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Patient</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Doctor</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Time</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Payment</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Reason</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {appointments.map((apt) => (
                    <tr key={apt._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        {/* Click the patient name to open their full detail
                            drill-down (fetches the complete record). */}
                        {apt.patient?._id ? (
                          <button
                            onClick={() => openUserDetail(apt.patient)}
                            className="text-left font-medium text-primary-700 hover:text-primary-900 hover:underline inline-flex items-center gap-1"
                            title="View patient details"
                          >
                            {apt.patient?.name || 'Unknown'}
                            {apt.patient?.patientId && <span className="text-gray-400 font-mono text-xs">({apt.patient.patientId})</span>}
                            <span className="text-gray-300 text-xs" aria-hidden="true">›</span>
                          </button>
                        ) : (
                          <div className="text-gray-800 font-medium">{apt.patient?.name || 'Unknown'}</div>
                        )}
                        <div className="text-gray-500 text-xs">{apt.patient?.phone || apt.patient?.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {/* Click the doctor name to open their full profile. */}
                        {apt.doctor?._id ? (
                          <button
                            onClick={() => openUserDetail(apt.doctor)}
                            className="text-left font-medium text-primary-700 hover:text-primary-900 hover:underline inline-flex items-center gap-1"
                            title="View doctor details"
                          >
                            {apt.doctor?.name || 'Unknown'}
                            <span className="text-gray-300 text-xs" aria-hidden="true">›</span>
                          </button>
                        ) : (
                          <div className="text-gray-800 font-medium">{apt.doctor?.name || 'Unknown'}</div>
                        )}
                        <div className="text-gray-500 text-xs">{apt.doctor?.specialization}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(apt.date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{apt.timeSlot}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(apt.status)}`}>
                          {apt.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          // Payment visibility for admin. paymentStatus:
                          //   'paid'            -> doctor confirmed payment received
                          //   'patient_claimed' -> patient said paid, doctor not yet verified
                          //   else (pending/unset) -> not paid yet
                          // Only meaningful once the appointment is confirmed; a
                          // pending/cancelled appointment has no payment expected.
                          if (apt.status === 'cancelled') return <span className="text-gray-400 text-xs">—</span>;
                          if (apt.paymentStatus === 'paid') {
                            return (
                              <div>
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">✓ Paid</span>
                                {apt.amountCollected > 0 && <div className="text-xs text-gray-600 mt-1">Rs. {apt.amountCollected}</div>}
                                {apt.paidAt && <div className="text-xs text-gray-400">{formatDate(apt.paidAt)}</div>}
                              </div>
                            );
                          }
                          if (apt.paymentStatus === 'patient_claimed') {
                            return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Awaiting verify</span>;
                          }
                          return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Unpaid</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{apt.reason}</td>
                      <td className="px-4 py-3">
                        {apt.status === 'pending' ? (
                          <button
                            onClick={() => handleConfirmAppointment(apt)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors whitespace-nowrap"
                            title="Confirm this appointment on the doctor's behalf — notifies the patient by email + app"
                          >
                            ✓ Confirm
                          </button>
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {appointments.length === 0 && (
              <div className="text-center py-8 text-gray-500">No appointments found</div>
            )}
          </div>
        </div>
      )}

      {/* === ANALYTICS TAB === */}
      {activeTab === 'analytics' && analytics && (
        <div>
          {/* Revenue Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-md p-6 text-center">
              <div className="text-3xl font-bold text-green-600">Rs. {analytics.revenue.total.toLocaleString()}</div>
              <div className="text-gray-600 mt-1">Total Revenue</div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 text-center">
              <div className="text-3xl font-bold text-primary-600">{analytics.revenue.totalPaidAppointments}</div>
              <div className="text-gray-600 mt-1">Paid Appointments</div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 text-center">
              <div className="text-3xl font-bold text-purple-600">
                Rs. {analytics.revenue.totalPaidAppointments > 0 ? Math.round(analytics.revenue.total / analytics.revenue.totalPaidAppointments) : 0}
              </div>
              <div className="text-gray-600 mt-1">Avg Fee per Consultation</div>
            </div>
          </div>

          {/* In-app call stats */}
          {analytics.calls && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow-md p-6 text-center">
                <div className="text-3xl font-bold text-indigo-600">{analytics.calls.totalCalls}</div>
                <div className="text-gray-600 mt-1">In-App Calls</div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-6 text-center">
                <div className="text-3xl font-bold text-teal-600">{analytics.calls.totalCallMinutes}</div>
                <div className="text-gray-600 mt-1">Total Call Minutes</div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-6 text-center">
                <div className="text-3xl font-bold text-cyan-600">
                  {analytics.calls.totalCalls > 0 ? Math.round(analytics.calls.totalCallMinutes / analytics.calls.totalCalls) : 0}
                </div>
                <div className="text-gray-600 mt-1">Avg Minutes / Call</div>
              </div>
            </div>
          )}

          {/* Calls by doctor */}
          {analytics.calls && analytics.calls.byDoctor && analytics.calls.byDoctor.length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Doctor Connections (In-App Calls)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Doctor</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Specialization</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Calls</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Minutes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {analytics.calls.byDoctor.map((doc, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{doc.doctorName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{doc.specialization || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{doc.calls}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-indigo-600">{doc.minutes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Consultation Type Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Consultation Types</h3>
              {analytics.consultationTypes.length === 0 ? (
                <p className="text-gray-500">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {analytics.consultationTypes.map((type, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-gray-700 capitalize">{type._id || 'Unknown'}</span>
                      <span className="font-semibold text-primary-600">{type.count} bookings</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Doctors */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Doctors (by Bookings)</h3>
              {analytics.topDoctors.length === 0 ? (
                <p className="text-gray-500">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {analytics.topDoctors.map((doc, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <div>
                        <span className="text-gray-800 font-medium">{doc.doctorName}</span>
                        <span className="text-gray-500 text-xs ml-2">{doc.specialization}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-primary-600">{doc.totalBookings}</span>
                        <span className="text-gray-400 text-xs ml-1">({doc.completed} completed)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Revenue by Doctor */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Revenue by Doctor</h3>
            {analytics.revenue.byDoctor.length === 0 ? (
              <p className="text-gray-500">No payment data yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Doctor</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Specialization</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Paid Appointments</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {analytics.revenue.byDoctor.map((doc, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{doc.doctorName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{doc.specialization || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{doc.appointments}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-600">Rs. {doc.revenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Payments */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Payments</h3>
            {analytics.recentPayments.length === 0 ? (
              <p className="text-gray-500">No payments yet</p>
            ) : (
              <div className="space-y-3">
                {analytics.recentPayments.map((payment, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{payment.patient?.name} → Dr. {payment.doctor?.name}</p>
                      <p className="text-xs text-gray-500">{payment.consultationType} • {formatDate(payment.date)} • {payment.timeSlot}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">Rs. {payment.amountCollected}</p>
                      <p className="text-xs text-gray-400">{payment.paidAt ? formatDate(payment.paidAt) : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === ANNOUNCEMENTS TAB === */}
      {activeTab === 'announcements' && (
        <div>
          {/* Create form */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Post an Announcement</h3>
            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., Platform update"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={announcementForm.message}
                  onChange={(e) => setAnnouncementForm((p) => ({ ...p, message: e.target.value }))}
                  placeholder="Write your message to show as a banner..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
                <select
                  value={announcementForm.audience}
                  onChange={(e) => setAnnouncementForm((p) => ({ ...p, audience: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="doctors">Doctors only</option>
                  <option value="patients">Patients only</option>
                  <option value="all">Everyone</option>
                </select>
              </div>
              <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                Post Announcement
              </button>
            </form>
          </div>

          {/* Existing announcements */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Announcements</h3>
            {announcements.length === 0 ? (
              <p className="text-gray-500">No announcements yet.</p>
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div key={a._id} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800">{a.title}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {a.active ? 'Active' : 'Hidden'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">{a.audience}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{a.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(a.createdAt)}</p>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleToggleAnnouncement(a)}
                        className={`text-sm font-medium ${a.active ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'}`}
                      >
                        {a.active ? 'Hide' : 'Show'}
                      </button>
                      <button
                        onClick={() => handleDeleteAnnouncement(a._id)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === COMPLAINTS TAB === */}
      {activeTab === 'complaints' && (
        <div>
          <div className="mb-4">
            <select
              value={complaintStatusFilter}
              onChange={(e) => setComplaintStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {complaints.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="text-xl font-medium text-gray-700">No complaints</h3>
              <p className="text-gray-500 mt-2">Patient complaints will appear here as they're filed.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {complaints.map((c) => (
                <div key={c._id} className="bg-white rounded-xl shadow-md p-6">
                  <div className="flex justify-between items-start gap-3 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-gray-800">{c.subject}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {c.patient?.name || 'Unknown patient'}
                        {c.patient?.patientId && <span className="font-mono text-gray-400"> ({c.patient.patientId})</span>}
                        {' • '}{c.patient?.phone || c.patient?.email} • {formatDate(c.createdAt)}
                      </p>
                      {c.doctor && (
                        <p className="text-xs text-gray-400 mt-1">
                          Regarding: Dr. {c.doctor.name} ({c.doctor.specialization})
                          {c.appointment && ` — visit on ${formatDate(c.appointment.date)}, ${c.appointment.timeSlot}`}
                        </p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getComplaintStatusColor(c.status)}`}>
                      {c.status}
                    </span>
                  </div>

                  <p className="text-gray-700 text-sm mt-3">{c.description}</p>

                  {c.response && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-medium text-green-800">Your Response:</p>
                      <p className="text-sm text-green-700 mt-1">{c.response}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-4 flex-wrap">
                    <button
                      onClick={() => handleRespondToComplaint(c)}
                      className="px-3 py-1 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
                    >
                      {c.response ? 'Update Response' : 'Respond'}
                    </button>
                    {c.status !== 'in-progress' && (
                      <button onClick={() => handleUpdateComplaintStatus(c, 'in-progress')} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200">
                        Mark In Progress
                      </button>
                    )}
                    {c.status !== 'closed' && (
                      <button onClick={() => handleUpdateComplaintStatus(c, 'closed')} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
                        Close
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === REVIEWS TAB === */}
      {activeTab === 'reviews' && (
        <div>
          <div className="mb-4">
            <select
              value={reviewHiddenFilter}
              onChange={(e) => setReviewHiddenFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">All reviews</option>
              <option value="false">Visible only</option>
              <option value="true">Hidden only</option>
            </select>
          </div>

          {reviews.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <div className="text-5xl mb-4">⭐</div>
              <h3 className="text-xl font-medium text-gray-700">No reviews</h3>
              <p className="text-gray-500 mt-2">Patient reviews will appear here. Hide any that are fake, abusive, or spam — hidden reviews stay on record but disappear from doctor profiles, the homepage, and rating averages.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r._id} className={`bg-white rounded-xl shadow-md p-6 ${r.isHidden ? 'opacity-70 border border-red-200' : ''}`}>
                  <div className="flex justify-between items-start gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-500">{'⭐'.repeat(r.rating)}</span>
                        <span className="text-sm text-gray-500">({r.rating}/5)</span>
                        {r.isHidden && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">🚫 Hidden</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {r.patient?.name || 'Unknown patient'}
                        {r.patient?.patientId && <span className="font-mono text-gray-400"> ({r.patient.patientId})</span>}
                        {' → Dr. '}{r.doctor?.name || 'Unknown'}{r.doctor?.specialization ? ` (${r.doctor.specialization})` : ''}
                        {' • '}{formatDate(r.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleReviewHidden(r)}
                      className={`px-3 py-1 rounded-lg text-sm whitespace-nowrap ${r.isHidden ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                    >
                      {r.isHidden ? 'Unhide' : 'Hide'}
                    </button>
                  </div>

                  {r.comment && <p className="text-gray-700 text-sm mt-3">"{r.comment}"</p>}

                  {r.doctorReply && r.doctorReply.text && (
                    <div className="mt-3 ml-3 pl-3 border-l-2 border-primary-200">
                      <p className="text-xs font-semibold text-primary-700">💬 Doctor's reply</p>
                      <p className="text-sm text-gray-700 mt-1">{r.doctorReply.text}</p>
                    </div>
                  )}

                  {r.isHidden && r.hiddenReason && (
                    <p className="text-xs text-red-500 mt-2">Hidden reason: {r.hiddenReason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === BLOG ANALYTICS TAB === */}
      {activeTab === 'blog' && (
        <div>
          {/* A short, honest note so it's clear what this does and does not show. */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            These are our own anonymous read & like counts per article. They show <strong>which content performs best</strong>, not who read it — blog readers are anonymous by design. For visitor numbers, traffic sources, and devices, use <strong>Google Analytics</strong>.
          </div>

          {blogStats ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-xl shadow-md p-6 text-center">
                  <div className="text-3xl font-bold text-primary-600">{blogStats.totalViews.toLocaleString()}</div>
                  <div className="text-gray-600 mt-1">Total Reads</div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-6 text-center">
                  <div className="text-3xl font-bold text-rose-600">{blogStats.totalLikes.toLocaleString()}</div>
                  <div className="text-gray-600 mt-1">Total Likes ❤️</div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-6 text-center">
                  <div className="text-3xl font-bold text-purple-600">{blogStats.articlesTracked.toLocaleString()}</div>
                  <div className="text-gray-600 mt-1">Articles With Activity</div>
                </div>
              </div>

              {/* Ranked table */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Articles Ranked by Reads</h3>
                {blogStats.rows.length === 0 ? (
                  <p className="text-gray-500 text-sm">No reads or likes recorded yet. Numbers appear here as people read your articles.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-sm font-medium text-gray-600">#</th>
                          <th className="px-4 py-3 text-sm font-medium text-gray-600">Article</th>
                          <th className="px-4 py-3 text-sm font-medium text-gray-600">Specialization</th>
                          <th className="px-4 py-3 text-sm font-medium text-gray-600 text-right">Reads</th>
                          <th className="px-4 py-3 text-sm font-medium text-gray-600 text-right">Likes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {blogStats.rows.map((row, i) => (
                          <tr key={row.slug} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-500">{i + 1}</td>
                            <td className="px-4 py-3 text-sm text-gray-800">
                              <a
                                href={`/blog/${row.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-primary-600 hover:underline"
                              >
                                <span className="mr-1" aria-hidden="true">{row.image}</span>{row.title}
                              </a>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{row.specialization}</td>
                            <td className="px-4 py-3 text-sm text-gray-800 text-right font-medium">{row.views.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-gray-800 text-right">{row.likes.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-md p-12 text-center text-gray-500">Loading blog analytics…</div>
          )}
        </div>
      )}
      </main>

      {/* ===== User detail modal (read-only drill-down, opened by name click) ===== */}
      {detailUser && (() => {
        const u = detailUser;
        const isPatient = u.role === 'patient';
        const isDoctor = u.role === 'doctor';
        // Small helpers so the modal stays tidy and never renders an empty row.
        const Row = ({ label, value }) => (
          value !== undefined && value !== null && value !== '' ? (
            <div className="flex gap-3 py-1.5 text-sm">
              <span className="w-36 flex-shrink-0 text-gray-500">{label}</span>
              <span className="text-gray-800 break-words min-w-0">{value}</span>
            </div>
          ) : null
        );
        const Section = ({ title, children }) => (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5 flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-primary-500" aria-hidden="true" />
              {title}
            </h4>
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2">{children}</div>
          </div>
        );
        const statusLabel = u.isDeleted ? 'Deleted' : u.isSuspended ? 'Deactivated' : 'Active';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeUserDetail}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-lg font-bold flex-shrink-0">
                    {(u.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-gray-800 truncate">{u.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        isDoctor ? 'bg-blue-100 text-blue-700' : u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                      }`}>{u.role}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.isDeleted ? 'bg-gray-200 text-gray-600' : u.isSuspended ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                      }`}>{statusLabel}</span>
                      {u.isAdminVerified && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">✓ Verified</span>}
                      {detailLoading && <span className="text-xs text-gray-400">loading…</span>}
                    </div>
                  </div>
                </div>
                <button onClick={closeUserDetail} className="text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0" aria-label="Close">✕</button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-5">
                <Section title="Identity & contact">
                  <Row label="Name" value={u.name} />
                  {isPatient && <Row label="Patient ID" value={u.patientId || '—'} />}
                  <Row label="Email" value={u.email || '— (phone-only)'} />
                  <Row label="Phone" value={u.phone || '—'} />
                  {isDoctor && <Row label="WhatsApp" value={u.whatsappNumber || '—'} />}
                  <Row label="Joined" value={formatDate(u.createdAt)} />
                  {u.lastLoginAt && <Row label="Last login" value={formatDate(u.lastLoginAt)} />}
                  {u.isSuspended && u.suspendedReason && <Row label="Deactivated reason" value={u.suspendedReason} />}
                </Section>

                {/* Doctor professional details */}
                {isDoctor && (
                  <Section title="Professional">
                    <Row label="Specialization" value={u.specialization || '—'} />
                    <Row label="Qualification" value={u.qualification || '—'} />
                    <Row label="Reg. number" value={u.medicalRegistrationNo || '—'} />
                    <Row label="Experience" value={u.experience ? `${u.experience} yrs` : '—'} />
                    <Row label="Consultation fee" value={u.consultationFee ? `Rs. ${u.consultationFee}` : '—'} />
                    <Row label="Consultation modes" value={(u.consultationModes || []).join(', ') || '—'} />
                    <Row label="Languages" value={(u.languagesSpoken || []).join(', ') || '—'} />
                    <Row label="City" value={u.city || '—'} />
                    <Row label="Clinic address" value={u.clinicAddress || '—'} />
                    <Row label="Booking page" value={u.slug ? `/dr/${u.slug}` : '— (not set)'} />
                    {u.bio && <Row label="Bio" value={u.bio} />}
                  </Section>
                )}

                {/* Patient medical info — all fields the patient set in Account
                    Settings. Only render the section if they filled anything in. */}
                {isPatient && (u.bloodGroup || u.allergies || u.currentMedications || u.medicalHistory || u.emergencyContactName || u.emergencyContactPhone || u.insuranceProvider || u.insurancePolicyNumber) && (
                  <Section title="Medical information">
                    <Row label="Blood group" value={u.bloodGroup || '—'} />
                    <Row label="Allergies" value={u.allergies || '—'} />
                    <Row label="Current medications" value={u.currentMedications || '—'} />
                    <Row label="Medical history" value={u.medicalHistory || '—'} />
                    <Row label="Emergency contact" value={u.emergencyContactName ? `${u.emergencyContactName}${u.emergencyContactPhone ? ` · ${u.emergencyContactPhone}` : ''}` : '—'} />
                    <Row label="Insurance" value={u.insuranceProvider ? `${u.insuranceProvider}${u.insurancePolicyNumber ? ` · ${u.insurancePolicyNumber}` : ''}` : '—'} />
                  </Section>
                )}

                {/* Patient family members (embedded on the user doc) */}
                {isPatient && Array.isArray(u.familyMembers) && u.familyMembers.length > 0 && (
                  <Section title={`Family members (${u.familyMembers.length})`}>
                    <div className="divide-y divide-gray-100">
                      {u.familyMembers.map((m, i) => (
                        <div key={i} className="py-2 text-sm">
                          <span className="font-medium text-gray-800">{m.name}</span>
                          <span className="text-gray-500">
                            {m.relationship ? ` · ${m.relationship}` : ''}
                            {m.gender ? ` · ${m.gender}` : ''}
                            {m.age != null ? ` · ${m.age} yrs` : ''}
                            {m.phone ? ` · ${m.phone}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Patient with no profile detail filled in — be explicit
                    rather than showing a bare identity block with no context. */}
                {isPatient && !(u.bloodGroup || u.allergies || u.currentMedications || u.medicalHistory || u.emergencyContactName || u.insuranceProvider) && (!u.familyMembers || u.familyMembers.length === 0) && (
                  <p className="text-sm text-gray-400 italic">This patient hasn't added any medical info or family members yet.</p>
                )}

                {/* Recent appointments (fetched with the full record). Shows the
                    person's booking history at a glance — the other party, when,
                    status, and payment. */}
                {detailAppointments.length > 0 && (
                  <Section title={`Recent appointments (${detailAppointments.length})`}>
                    <div className="divide-y divide-gray-100">
                      {detailAppointments.map((a) => (
                        <div key={a._id} className="py-2 text-sm flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="font-medium text-gray-800">
                              {isDoctor ? (a.patient?.name || 'Patient') : `Dr. ${a.doctor?.name || 'Doctor'}`}
                            </span>
                            <div className="text-gray-500 text-xs mt-0.5">
                              {formatDate(a.date)}{a.timeSlot ? ` · ${a.timeSlot}` : ''}{a.consultationType ? ` · ${a.consultationType}` : ''}
                            </div>
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(a.status)}`}>{a.status}</span>
                            {a.paymentStatus === 'paid' && a.amountCollected > 0 && (
                              <span className="text-[11px] text-green-600 mt-1">Rs. {a.amountCollected}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
                {!detailLoading && detailAppointments.length === 0 && (
                  <p className="text-sm text-gray-400 italic">No appointments on record.</p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 sticky bottom-0 bg-white">
                <button onClick={closeUserDetail} className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== Edit Availability modal (admin sets a doctor's schedule) ===== */}
      {availDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeAvailabilityModal}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Edit Availability</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {availDoctor.name}{availDoctor.specialization ? ` · ${availDoctor.specialization}` : ''}
                </p>
              </div>
              <button onClick={closeAvailabilityModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">✕</button>
            </div>

            <div className="p-5 space-y-5">
              {/* Duration */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Appointment duration</label>
                <div className="flex flex-wrap gap-2">
                  {[15, 30, 45, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setAvailDuration(d)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${availDuration === d ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Add time block */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <label className="block text-xs font-semibold text-gray-700 mb-2">Add available time</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {AVAIL_DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleAvailDay(day)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${availSelectedDays.includes(day) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      {day.substring(0, 3)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 mb-3 text-xs">
                  <button type="button" onClick={() => setAvailSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])} className="text-primary-600 hover:underline">Select Mon–Sat</button>
                  <button type="button" onClick={() => setAvailSelectedDays([])} className="text-gray-500 hover:underline">Clear</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">From</label>
                    <input type="time" value={availStart} onChange={(e) => setAvailStart(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">To</label>
                    <input type="time" value={availEnd} onChange={(e) => setAvailEnd(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                  <button type="button" onClick={addAvailBlocks} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                    + Add to {availSelectedDays.length || 0} day(s)
                  </button>
                </div>
              </div>

              {/* Current schedule */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Current schedule</label>
                {availSchedule.length === 0 ? (
                  <p className="text-sm text-gray-400">No sessions yet — add time above.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availSchedule.map((slot, i) => (
                      <div key={`${slot.day}-${slot.startTime}-${slot.endTime}-${i}`} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{slot.day}</p>
                          <p className="text-xs text-gray-500">{slot.startTime} – {slot.endTime}</p>
                        </div>
                        <button onClick={() => removeAvailSlot(i)} className="text-red-500 hover:text-red-700 text-xs font-medium flex-shrink-0">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-5 border-t border-gray-100">
              <p className="text-[11px] text-gray-400 hidden sm:block">Saves the doctor's weekly schedule on their behalf.</p>
              <div className="flex gap-2 ml-auto">
                <button onClick={closeAvailabilityModal} disabled={availSaving} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-60">Cancel</button>
                <button onClick={saveAvailability} disabled={availSaving} className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">
                  {availSaving ? 'Saving…' : 'Save schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Edit Profile modal (admin edits a doctor's profile + modes) ===== */}
      {profileDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeProfileModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Edit Profile</h3>
                <p className="text-xs text-gray-500 mt-0.5">{profileDoctor.name}</p>
              </div>
              <button onClick={closeProfileModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">✕</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Specialization</label>
                <input
                  type="text"
                  value={profileForm.specialization}
                  onChange={(e) => setProfileForm((p) => ({ ...p, specialization: e.target.value }))}
                  placeholder="e.g. Gynaecologist"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Qualification</label>
                  <input
                    type="text"
                    value={profileForm.qualification}
                    onChange={(e) => setProfileForm((p) => ({ ...p, qualification: e.target.value }))}
                    placeholder="e.g. MBBS, MS"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Experience (years)</label>
                  <input
                    type="number" min="0" max="70"
                    value={profileForm.experience}
                    onChange={(e) => setProfileForm((p) => ({ ...p, experience: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Consultation fee (Rs.)</label>
                <input
                  type="number" min="0"
                  value={profileForm.consultationFee}
                  onChange={(e) => setProfileForm((p) => ({ ...p, consultationFee: e.target.value }))}
                  className="w-full max-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Consultation modes</label>
                <p className="text-[11px] text-gray-400 mb-2">Which ways this doctor consults — tap to toggle.</p>
                <div className="flex flex-wrap gap-2">
                  {CONSULT_MODES.map((m) => {
                    const on = profileForm.consultationModes.includes(m.key);
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => toggleConsultMode(m.key)}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${on ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                      >
                        {m.label}{on ? ' ✓' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Bio / About</label>
                <textarea
                  rows={3}
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))}
                  placeholder="Short description shown on the doctor's profile"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={closeProfileModal} disabled={profileSaving} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-60">Cancel</button>
              <button onClick={saveProfile} disabled={profileSaving} className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">
                {profileSaving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
