// ============================================
// Dashboard Page - User's Personal Dashboard
// ============================================
// Shows different content based on the user's role.
// Sub-components are split into separate files for maintainability.

import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { appointmentAPI, doctorAPI, authAPI, prescriptionAPI, reviewAPI, messageAPI, availabilityAPI } from '../services/api';
import { getUploadUrl } from '../services/api';
import { getSocket } from '../services/socket';
import { enablePushNotifications, getPushPermission, isPushSupported } from '../services/push';
import { ConfirmModal, PromptModal } from '../components/Modal';
import ChatBox from '../components/ChatBox';
import VideoCall from '../components/VideoCall';
import AnnouncementBanner from '../components/AnnouncementBanner';
import toast from 'react-hot-toast';

// Extracted sub-components
import DoctorAvailability from './dashboard/DoctorAvailability';
import DoctorPatientReports from './dashboard/DoctorPatientReports';
import PatientFamilyMembers from './dashboard/PatientFamilyMembers';
import PatientPrescriptions from './dashboard/PatientPrescriptions';
import PatientReports from './dashboard/PatientReports';
import PatientComplaints from './dashboard/PatientComplaints';
import AccountSettings from './dashboard/AccountSettings';

// Every tab key the dashboard supports. Used to validate a deep-link
// (?tab=familyMembers) so other pages can send patients straight to the
// right place instead of a generic "go check your dashboard" message.
const VALID_TAB_KEYS = ['appointments', 'profile', 'availability', 'patientReports', 'familyMembers', 'prescriptions', 'reports', 'complaints', 'account'];

function Dashboard() {
  const { user, isDoctor, isPatient } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  // Open directly on the requested tab if a valid ?tab= is present in the URL
  // (e.g. Link to="/dashboard?tab=familyMembers"), otherwise default as before.
  const [activeTab, setActiveTab] = useState(() => {
    const requested = searchParams.get('tab');
    return VALID_TAB_KEYS.includes(requested) ? requested : 'appointments';
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const tabSectionRef = useRef(null); // scroll target for the tab nav + its content

  // Switch tabs AND bring that section into view — needed because buttons that
  // jump to a tab (checklist actions, "View Requests →", guidance links) live
  // above the tab content, so just changing state alone doesn't scroll the
  // page there. Deferred one frame so the newly-active tab has rendered
  // before we measure where to scroll.
  const goToTab = (tabKey) => {
    setActiveTab(tabKey);
    requestAnimationFrame(() => {
      tabSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // Modal state
  const [cancelModal, setCancelModal] = useState({ open: false, id: null });
  const [rateModal, setRateModal] = useState({ open: false, id: null });
  const [prescriptionModal, setPrescriptionModal] = useState({ open: false, id: null });
  const [chatAppointmentId, setChatAppointmentId] = useState(null);
  const [receiptImage, setReceiptImage] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState({});
  const [videoCallAppointmentId, setVideoCallAppointmentId] = useState(null);

  // Incoming call ("ringing") state
  const [incomingCall, setIncomingCall] = useState(null); // { appointmentId, consultationType, fromName }
  const audioCtxRef = useRef(null);
  const ringIntervalRef = useRef(null);
  const inCallRef = useRef(false); // guards against ringing while already in a call

  // Push notification nudge — lets patients/doctors get instant updates
  // (appointment confirmed, new message, incoming call) even when the app
  // isn't open. Works regardless of whether they have an email on file.
  const [showPushNudge, setShowPushNudge] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    const permission = getPushPermission();
    if (permission === 'granted') {
      // Already granted (maybe from another page/session) — silently make
      // sure this device's subscription is saved on the backend too.
      enablePushNotifications();
    } else if (permission === 'default' && !localStorage.getItem('pushNudgeDismissed')) {
      setShowPushNudge(true);
    }
  }, []);

  const handleEnablePush = async () => {
    const ok = await enablePushNotifications();
    setShowPushNudge(false);
    if (ok) {
      toast.success('Notifications enabled! You\'ll get instant updates.');
    } else {
      toast.error('Could not enable notifications. You can allow them from your browser\'s site settings.');
    }
  };

  const dismissPushNudge = () => {
    localStorage.setItem('pushNudgeDismissed', '1');
    setShowPushNudge(false);
  };

  // Doctor onboarding checklist — celebrate the moment it goes from "some
  // steps pending" to "fully done" during THIS session, instead of the
  // checklist card just silently vanishing. Guards against firing on a
  // normal page load for a doctor who was already fully set up before.
  const [showOnboardingComplete, setShowOnboardingComplete] = useState(false);
  const wasOnboardingIncompleteRef = useRef(false);

  // Doctor profile state
  const [profileData, setProfileData] = useState({
    specialization: '', experience: '', qualification: '', medicalRegistrationNo: '',
    clinicAddress: '', consultationFee: '', bio: '',
    phone: '', whatsappNumber: '', upiId: '', upiQrCode: '', profilePhoto: '',
    city: '', googleMapsLink: '', consultationModes: ['in-person']
  });
  const photoInputRef = useRef(null); // hidden file input for one-click photo upload

  // Doctor onboarding checklist — whether they've set at least one weekly
  // availability session yet (null = not checked yet, avoids a flash of
  // "not done" before the fetch below completes).
  const [hasAvailability, setHasAvailability] = useState(null);
  // Whether fetchProfile() has resolved at least once since this Dashboard
  // instance mounted. Dashboard remounts fresh every time you navigate back
  // to it (e.g. Home -> Appointments), which resets profileData to its empty
  // defaults for a moment — without this flag, the checklist would briefly
  // flash as "incomplete" on every single visit, even for a fully set-up
  // doctor, until the real data loads back in.
  const [profileLoaded, setProfileLoaded] = useState(false);

  const fetchAvailabilityStatus = async () => {
    try {
      const response = await availabilityAPI.getMine();
      setHasAvailability((response.data.availability || []).length > 0);
    } catch (error) { setHasAvailability(false); }
  };

  // Upload a doctor profile photo (used by both the nudge banner and the Edit Profile form)
  const uploadProfilePhoto = async (file) => {
    if (!file) return;
    const data = new FormData();
    data.append('profilePhoto', file);
    data.append('fieldName', 'profilePhoto');
    try {
      const response = await doctorAPI.updateProfile(data);
      setProfileData(prev => ({ ...prev, profilePhoto: response.data.doctor.profilePhoto }));
      toast.success('Profile photo uploaded!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload photo');
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchUnreadCounts();
    if (isDoctor) { fetchProfile(); fetchAvailabilityStatus(); }
    // Refresh unread counts every 30 seconds
    const interval = setInterval(fetchUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, [page]);

  // Re-render every 30s so the time-based "Join Call" window opens/closes on time
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setClockTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await authAPI.getMe();
      const d = response.data.user;
      setProfileData({
        specialization: d.specialization || '', experience: d.experience || '',
        qualification: d.qualification || '', medicalRegistrationNo: d.medicalRegistrationNo || '',
        clinicAddress: d.clinicAddress || '',
        consultationFee: d.consultationFee || '', bio: d.bio || '',
        phone: d.phone || '', whatsappNumber: d.whatsappNumber || '', upiId: d.upiId || '',
        upiQrCode: d.upiQrCode || '', profilePhoto: d.profilePhoto || '',
        city: d.city || '', googleMapsLink: d.googleMapsLink || '',
        consultationModes: d.consultationModes || ['in-person']
      });
    } catch (error) { console.error('Fetch profile error:', error); }
    finally { setProfileLoaded(true); }
  };

  const fetchAppointments = async () => {
    try {
      const response = await appointmentAPI.getMine({ limit: 10, page });
      setAppointments(response.data.appointments);
      setPagination(response.data.pagination);
    } catch (error) { console.error('Fetch appointments error:', error); }
    finally { setLoading(false); }
  };

  const fetchUnreadCounts = async () => {
    try {
      const response = await messageAPI.getUnreadCount();
      setUnreadMessages(response.data);
    } catch (error) { /* silent */ }
  };

  // ---- Ringtone (generated with Web Audio API — no asset needed) ----
  const startRing = () => {
    try {
      if (ringIntervalRef.current) return; // already ringing
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      const beep = () => {
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      };
      beep();
      ringIntervalRef.current = setInterval(beep, 1300);
      if (navigator.vibrate) navigator.vibrate([500, 300, 500, 300, 500]);
    } catch (e) { /* audio not available — visual banner still shows */ }
  };

  const stopRing = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    if (navigator.vibrate) navigator.vibrate(0);
  };

  // ---- Poll for incoming calls every 5 seconds ----
  useEffect(() => {
    const checkIncomingCalls = async () => {
      // Don't ring if the user is already in a call
      if (inCallRef.current) return;
      try {
        const res = await appointmentAPI.getIncomingCalls();
        const call = res.data.incomingCalls?.[0];
        if (call) {
          setIncomingCall((prev) => {
            // Only (re)start ring when a new call appears
            if (!prev || prev.appointmentId !== call.appointmentId) {
              startRing();
              return call;
            }
            return prev;
          });
        } else {
          // No active incoming call — clear banner and stop ring
          setIncomingCall((prev) => {
            if (prev) stopRing();
            return null;
          });
        }
      } catch (e) { /* silent */ }
    };

    checkIncomingCalls();
    // Fallback poll — normally the 'incoming-call' socket event below fires
    // instantly, so this interval is just a safety net if the socket drops.
    const interval = setInterval(checkIncomingCalls, 20000);
    return () => {
      clearInterval(interval);
      stopRing();
    };
  }, []);

  // ---- Realtime: instant call ringing + unread badge updates ----
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return; // not logged in / no token — polling above still covers it

    const handleIncomingCall = (call) => {
      if (inCallRef.current) return; // already in a call — ignore
      setIncomingCall((prev) => {
        if (!prev || prev.appointmentId !== call.appointmentId) {
          startRing();
          return call;
        }
        return prev;
      });
    };

    const handleCallEnded = (payload) => {
      setIncomingCall((prev) => {
        if (prev && prev.appointmentId === payload.appointmentId) {
          stopRing();
          return null;
        }
        return prev;
      });
    };

    const handleMessageNotification = () => {
      fetchUnreadCounts();
    };

    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-ended', handleCallEnded);
    socket.on('message-notification', handleMessageNotification);

    return () => {
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-ended', handleCallEnded);
      socket.off('message-notification', handleMessageNotification);
    };
  }, []);

  // ---- Start a call: open the call immediately, signal the other party in background ----
  const startCall = (apt) => {
    inCallRef.current = true;
    // Open the call window right away (don't wait on the network — backend may be cold-starting)
    setVideoCallAppointmentId(apt._id + '|' + apt.consultationType);
    // Fire-and-forget: ring the other participant (failure must not block the call)
    appointmentAPI.setCall(apt._id, true).catch(() => {});
  };

  // ---- Accept an incoming call ----
  const acceptIncomingCall = () => {
    if (!incomingCall) return;
    stopRing();
    inCallRef.current = true;
    setVideoCallAppointmentId(incomingCall.appointmentId + '|' + incomingCall.consultationType);
    setIncomingCall(null);
  };

  // ---- Decline / dismiss an incoming call ----
  const declineIncomingCall = async () => {
    const call = incomingCall;
    stopRing();
    setIncomingCall(null);
    if (call) {
      try { await appointmentAPI.setCall(call.appointmentId, false); } catch (e) { /* silent */ }
    }
  };

  // ---- Close the call: clear the active flag so ringing stops on both sides ----
  const handleCloseCall = async () => {
    const idPart = videoCallAppointmentId ? videoCallAppointmentId.split('|')[0] : null;
    setVideoCallAppointmentId(null);
    inCallRef.current = false;
    if (idPart) {
      try { await appointmentAPI.setCall(idPart, false); } catch (e) { /* silent */ }
    }
  };

  // ---- Doctor: Update appointment status ----
  const handleStatusUpdate = async (appointmentId, newStatus, meetingLink) => {
    try {
      let data = { status: newStatus };
      if (meetingLink) data.meetingLink = meetingLink;
      await appointmentAPI.updateStatus(appointmentId, data);
      toast.success(`Appointment ${newStatus}`);
      fetchAppointments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    }
  };

  // ---- Patient: Cancel appointment ----
  const handleCancel = async () => {
    try {
      await appointmentAPI.cancel(cancelModal.id, { cancellationReason: 'Cancelled by patient from dashboard' });
      toast.success('Appointment cancelled');
      setCancelModal({ open: false, id: null });
      fetchAppointments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel');
    }
  };

  // ---- Patient: Rate doctor ----
  const handleRateDoctor = async (values) => {
    const rating = parseInt(values.rating);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      toast.error('Please enter a rating between 1 and 5');
      return;
    }
    try {
      await reviewAPI.create({ appointmentId: rateModal.id, rating, comment: values.comment || '' });
      toast.success('Thank you for your review!');
      setRateModal({ open: false, id: null });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit review');
    }
  };

  // ---- Doctor: Write Prescription ----
  const handleWritePrescription = async (values) => {
    const medicines = values.medicines ? values.medicines.split(',').map(m => {
      const parts = m.trim().split(' - ');
      return { name: parts[0] || m.trim(), dosage: '', frequency: parts[1] || '', duration: parts[2] || '', instructions: parts[3] || '' };
    }) : [];
    const testsRecommended = values.tests ? values.tests.split(',').map(t => t.trim()).filter(t => t) : [];
    try {
      await prescriptionAPI.create({
        appointmentId: prescriptionModal.id, diagnosis: values.diagnosis,
        medicines, testsRecommended, notes: values.notes || '',
        followUpDays: values.followUpDays ? parseInt(values.followUpDays) : 0
      });
      toast.success('Prescription created!');
      setPrescriptionModal({ open: false, id: null });
      fetchAppointments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create prescription');
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();

    // Validate all fields are filled
    const requiredFields = [
      { key: 'specialization', label: 'Specialization' },
      { key: 'qualification', label: 'Qualification' },
      { key: 'medicalRegistrationNo', label: 'Medical Registration No.' },
      { key: 'experience', label: 'Years of Experience' },
      { key: 'consultationFee', label: 'Consultation Fee' },
      { key: 'clinicAddress', label: 'Clinic Address' },
      { key: 'phone', label: 'Phone Number' },
    ];
    const missing = requiredFields.filter(f => !profileData[f.key]);
    if (missing.length > 0) {
      toast.error(`Please fill: ${missing.map(f => f.label).join(', ')}`);
      return;
    }

    try {
      await doctorAPI.updateProfile(profileData);

      // Guide the doctor straight to whatever's still pending instead of
      // leaving them to rediscover it themselves. The onboarding checklist
      // stays visible on every tab, so nothing is lost even if we jump away
      // from here — availability is the one thing that needs a real tab
      // switch (UPI QR code is already on this same page, right above Save).
      if (hasAvailability === false) {
        toast.success('Profile updated! Now let\'s set your availability →', { duration: 4000 });
        goToTab('availability');
      } else if (!profileData.upiQrCode) {
        toast.success('Profile updated! Don\'t forget your UPI QR code above so patients can pay you.', { duration: 5000 });
      } else {
        toast.success('Profile updated!');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    }
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

  // True only if the appointment date is TODAY (compared in IST, matching booking logic).
  const isAppointmentToday = (dateString) => {
    if (!dateString) return false;
    const fmt = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
    return fmt(new Date(dateString)) === fmt(new Date());
  };

  // Current time in IST as minutes since midnight (works regardless of the
  // user's device timezone — the server may be anywhere).
  const getISTNowMinutes = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date());
    let h = 0, m = 0;
    for (const p of parts) {
      if (p.type === 'hour') h = parseInt(p.value, 10);
      if (p.type === 'minute') m = parseInt(p.value, 10);
    }
    if (h === 24) h = 0; // midnight edge case
    return h * 60 + m;
  };

  // Parse a slot time like "10:00 AM" into minutes since midnight.
  const parseSlotTime = (str) => {
    if (!str) return null;
    const m = str.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = m[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  };

  // The call can only be joined during the booked time slot (with a small grace
  // window), so patients can't call the doctor at any random time of the day.
  // Grace: 5 minutes before the slot starts, 20 minutes after it ends.
  const CALL_GRACE_BEFORE = 5;
  const CALL_GRACE_AFTER = 20;
  const isWithinCallWindow = (apt) => {
    if (!isAppointmentToday(apt.date)) return false;
    const parts = (apt.timeSlot || '').split('-').map((s) => s.trim());
    const start = parseSlotTime(parts[0]);
    let end = parseSlotTime(parts[1]);
    // If we can't parse the slot, fall back to allowing it on the day (safe default).
    if (start == null || end == null) return true;
    if (end <= start) end += 24 * 60; // slot ends at/after midnight (e.g., 11:30 PM - 12:00 AM)
    const now = getISTNowMinutes();
    return now >= (start - CALL_GRACE_BEFORE) && now <= (end + CALL_GRACE_AFTER);
  };
  const getStatusColor = (status) => ({ pending: 'bg-yellow-100 text-yellow-800', confirmed: 'bg-green-100 text-green-800', completed: 'bg-blue-100 text-blue-800', cancelled: 'bg-red-100 text-red-800' }[status] || 'bg-gray-100 text-gray-800');

  // ---- Doctor onboarding checklist ----
  // Verifying email and adding a photo already have their own banners below.
  // This covers the part that had NO guidance at all: what to actually fill
  // in before a doctor's profile is genuinely ready to take bookings.
  const profileFieldsComplete = !!(
    profileData.specialization && profileData.qualification && profileData.medicalRegistrationNo &&
    profileData.experience && profileData.consultationFee && profileData.clinicAddress &&
    profileData.city && profileData.phone
  );
  const onboardingSteps = isDoctor ? [
    {
      key: 'profile', done: profileFieldsComplete,
      label: 'Fill in your professional details',
      hint: 'Specialization, qualification, registration number, experience, fee, clinic address, and phone',
      actionLabel: 'Edit Profile', action: () => goToTab('profile')
    },
    {
      key: 'availability', done: !!hasAvailability,
      label: 'Set your weekly availability',
      hint: 'So patients can actually see and book an open time slot with you',
      actionLabel: 'Set Availability', action: () => goToTab('availability')
    },
    {
      key: 'payment', done: !!profileData.upiQrCode,
      label: 'Add your UPI QR code',
      hint: 'So patients can pay you directly when they book',
      actionLabel: 'Add QR Code', action: () => goToTab('profile')
    }
  ] : [];
  const pendingOnboardingSteps = onboardingSteps.filter((s) => !s.done);

  const doctorDataReady = profileLoaded && hasAvailability !== null;

  useEffect(() => {
    if (!isDoctor || !doctorDataReady) return; // wait until real data has loaded at least once
    if (pendingOnboardingSteps.length > 0) {
      wasOnboardingIncompleteRef.current = true;
    } else if (wasOnboardingIncompleteRef.current) {
      // Just finished the last step during this session — celebrate once.
      setShowOnboardingComplete(true);
      wasOnboardingIncompleteRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOnboardingSteps.length, doctorDataReady, isDoctor]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Admin announcements (fee notices, policy updates, etc.) */}
      <AnnouncementBanner />

      {/* Push notification nudge — works for everyone, including patients
          who registered with phone only (no email on file) */}
      {showPushNudge && (
        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <p className="font-semibold text-indigo-800">Turn on notifications</p>
              <p className="text-sm text-indigo-700">Get instant updates on appointments, messages, and calls — even when the app isn't open.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleEnablePush}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 whitespace-nowrap"
            >
              Enable
            </button>
            <button
              onClick={dismissPushNudge}
              className="text-indigo-400 hover:text-indigo-600 text-xl px-1"
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Email Verification Banner for unverified doctors */}
      {isDoctor && user && !user.isVerified && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📧</span>
            <div>
              <p className="font-semibold text-orange-800">Verify your email to go live</p>
              <p className="text-sm text-orange-700">Your profile won't appear in patient search until you verify your email.</p>
            </div>
          </div>
          <button
            onClick={async () => { try { await authAPI.resendVerification(); toast.success('Verification email sent! Check your inbox.'); } catch(e) { toast.error(e.response?.data?.message || 'Failed to send'); } }}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 whitespace-nowrap"
          >
            Resend Email
          </button>
        </div>
      )}

      {/* Gentle nudge: add a profile photo (builds patient trust).
          Hidden on the Edit Profile tab, where the photo field is already shown. */}
      {isDoctor && activeTab !== 'profile' && !(user?.profilePhoto || profileData.profilePhoto) && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📸</span>
            <div>
              <p className="font-semibold text-blue-800">Add a photo to build patient trust</p>
              <p className="text-sm text-blue-700">Doctors with a clear photo get chosen more often. It only takes a moment.</p>
            </div>
          </div>
          <button
            onClick={() => photoInputRef.current?.click()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 whitespace-nowrap"
          >
            Add Photo
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => uploadProfilePhoto(e.target.files[0])}
          />
        </div>
      )}

      {/* Doctor onboarding checklist — the concrete "what do I do next"
          guidance that was missing after email verification + photo. Hides
          itself automatically once every step is done. */}
      {isDoctor && doctorDataReady && pendingOnboardingSteps.length > 0 && (
        <div className="mb-6 bg-white border-2 border-primary-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-800 text-lg">🚀 Finish setting up your profile</h3>
            <span className="text-sm text-gray-500 whitespace-nowrap">{onboardingSteps.length - pendingOnboardingSteps.length} of {onboardingSteps.length} done</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4 overflow-hidden">
            <div
              className="bg-primary-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${((onboardingSteps.length - pendingOnboardingSteps.length) / onboardingSteps.length) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mb-4">Complete these so patients can actually find and book you.</p>
          <div className="space-y-2">
            {onboardingSteps.map((step, idx) => (
              <div key={step.key} className={`flex items-center justify-between gap-3 p-3 rounded-lg transition-colors ${step.done ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3 min-w-0">
                  {/* Crisp vector circle (not a plain colored <span> + text glyph) —
                      matches the VerifiedBadge convention used elsewhere on the site.
                      Shows the step number until complete, then a checkmark. */}
                  {step.done ? (
                    <svg width="28" height="28" viewBox="0 0 24 24" className="flex-shrink-0" role="img" aria-label="Completed">
                      <circle cx="12" cy="12" r="12" fill="#22c55e" />
                      <path d="M7 12.5L10.3 16L17 9" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  ) : (
                    <span className="flex-shrink-0 w-7 h-7 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center text-xs font-bold text-gray-500">
                      {idx + 1}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${step.done ? 'text-green-800 line-through' : 'text-gray-800'}`}>{step.label}</p>
                    {!step.done && <p className="text-xs text-gray-500">{step.hint}</p>}
                  </div>
                </div>
                {!step.done && (
                  <button
                    onClick={step.action}
                    className="flex-shrink-0 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 whitespace-nowrap"
                  >
                    {step.actionLabel}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Onboarding complete — replaces the checklist once every step is
          done, instead of it just quietly disappearing with no feedback. */}
      {isDoctor && showOnboardingComplete && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-semibold text-green-800">Welcome aboard, Dr. {user?.name}!</p>
              <p className="text-sm text-green-700">Your profile is complete — patients can now find and book you.</p>
            </div>
          </div>
          <button
            onClick={() => setShowOnboardingComplete(false)}
            className="text-green-400 hover:text-green-600 text-xl px-1 flex-shrink-0"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      {/* Notification Banner — shown on every tab, so the CTA must actually
          switch to Appointments rather than assume it's already showing */}
      {isDoctor && appointments.filter(a => a.status === 'pending').length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <p className="font-semibold text-yellow-800">You have {appointments.filter(a => a.status === 'pending').length} new appointment request{appointments.filter(a => a.status === 'pending').length > 1 ? 's' : ''}!</p>
              <p className="text-sm text-yellow-700">Please confirm or reject them.</p>
            </div>
          </div>
          {activeTab !== 'appointments' && (
            <button
              onClick={() => goToTab('appointments')}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 whitespace-nowrap"
            >
              View Requests →
            </button>
          )}
        </div>
      )}

      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Welcome, {isDoctor ? 'Dr. ' : ''}{user?.name}!</h1>
        <p className="text-gray-600 mt-1">{isDoctor ? 'Manage your practice and appointments' : 'View your appointments and find doctors'}</p>
      </div>

      {/* Tab Navigation */}
      <div ref={tabSectionRef} className="flex border-b mb-6 overflow-x-auto">
        {[
          { key: 'appointments', label: 'My Appointments', show: true },
          { key: 'profile', label: 'Edit Profile', show: isDoctor },
          { key: 'availability', label: 'Availability', show: isDoctor },
          { key: 'patientReports', label: 'Patient Reports', show: isDoctor },
          { key: 'familyMembers', label: 'Family Members', show: isPatient },
          { key: 'prescriptions', label: 'Prescriptions', show: isPatient },
          { key: 'reports', label: 'My Reports', show: isPatient },
          { key: 'complaints', label: 'Complaints', show: isPatient },
          { key: 'account', label: 'Account Settings', show: true },
        ].filter(t => t.show).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* === APPOINTMENTS TAB === */}
      {activeTab === 'appointments' && (
        <div>
          {isPatient && (
            <div className="mb-6">
              <Link to="/doctors" className="inline-block bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors">+ Book New Appointment</Link>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-600">Loading appointments...</div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-md">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="text-xl font-medium text-gray-700">No appointments yet</h3>
              {isPatient ? (
                <>
                  <p className="text-gray-500 mt-2">Click "+ Book New Appointment" above to search by specialization or symptom and find the right doctor.</p>
                  <button
                    onClick={() => goToTab('familyMembers')}
                    className="text-primary-600 text-sm font-medium hover:underline mt-3 inline-block"
                  >
                    👨‍👩‍👧 Booking for a family member instead? Add them here →
                  </button>
                </>
              ) : (
                <p className="text-gray-500 mt-2">Your upcoming appointments will appear here.</p>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {[...appointments].sort((a, b) => {
                  const order = { pending: 0, confirmed: 1, completed: 2, cancelled: 3 };
                  return (order[a.status] ?? 4) - (order[b.status] ?? 4);
                }).map((apt) => (
                  <div key={apt._id} className="bg-white rounded-xl shadow-md p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-800">{isPatient ? `Dr. ${apt.doctor?.name || 'Unknown'}` : apt.patient?.name || 'Unknown Patient'}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(apt.status)}`}>{apt.status}</span>
                      </div>
                      <p className="text-gray-600 text-sm">{formatDate(apt.date)} • {apt.timeSlot}</p>
                      {isDoctor && apt.patient?.phone && <p className="text-gray-600 text-sm mt-1">Patient Phone: <a href={`tel:${apt.patient.phone}`} className="text-primary-600 hover:underline">{apt.patient.phone}</a></p>}
                      <p className="text-gray-500 text-sm mt-1">Reason: {apt.reason}</p>
                      {apt.bookedFor === 'family' && apt.familyMemberName && <p className="text-purple-600 text-sm mt-1 font-medium">Booked for: {apt.familyMemberName} (family member)</p>}
                      {apt.notes && <p className="text-gray-500 text-sm mt-1 italic">Notes: {apt.notes}</p>}
                      {apt.meetingLink && <a href={apt.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors">Join Meeting Link</a>}
                      {isPatient && apt.status === 'confirmed' && (!apt.paymentStatus || apt.paymentStatus === 'pending') && (
                        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <p className="text-sm font-medium text-orange-800 mb-2">Pay ₹{apt.doctor?.consultationFee || 'as discussed'}</p>
                          {apt.doctor?.upiQrCode ? (
                            <div className="text-center">
                              <img src={getUploadUrl(apt.doctor.upiQrCode)} alt="UPI QR Code" className="mx-auto max-w-[180px] rounded-lg border border-orange-200 mb-2" />
                              <a href={getUploadUrl(apt.doctor.upiQrCode)} download="payment-qr.png" className="inline-block text-xs text-primary-600 hover:underline mb-3">Download QR Code</a>
                              <p className="text-xs text-orange-600 mb-2">Scan or download QR → Pay → Click below</p>
                            </div>
                          ) : (
                            <p className="text-sm text-orange-700">Contact doctor for payment details.</p>
                          )}
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={async () => {
                                try {
                                  await appointmentAPI.notifyPayment(apt._id);
                                  toast.success('Doctor has been notified of your payment!');
                                  fetchAppointments();
                                } catch (err) { toast.error('Failed to notify'); }
                              }}
                              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
                            >
                              ✓ I Have Paid
                            </button>
                            <label className="flex-1 text-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 cursor-pointer border border-gray-200">
                              📎 Upload Proof
                              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                const data = new FormData();
                                data.append('screenshot', file);
                                try {
                                  await appointmentAPI.uploadScreenshot(apt._id, data);
                                  toast.success('Payment proof uploaded!');
                                  fetchAppointments();
                                } catch (err) { toast.error('Failed to upload'); }
                              }} />
                            </label>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">Doctor will verify and confirm your payment.</p>
                        </div>
                      )}
                      {apt.paymentStatus === 'paid' && <span className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">✓ Payment Confirmed</span>}
                      {apt.paymentStatus === 'patient_claimed' && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                          {isPatient && (
                            <>
                              {!apt.paymentScreenshot && (
                                <p className="text-xs font-medium text-yellow-800">No receipt uploaded. Waiting for doctor's confirmation on payment.</p>
                              )}
                              {apt.paymentScreenshot && (
                                <p className="text-xs font-medium text-yellow-800">⏳ Receipt uploaded. Waiting for doctor's confirmation on payment.</p>
                              )}
                            </>
                          )}
                          {isDoctor && (
                            <>
                              <span className="text-xs font-medium text-yellow-800">⏳ Patient says paid</span>
                              <p className="text-xs text-yellow-700 mt-1">
                                {apt.paymentScreenshot
                                  ? 'Receipt uploaded — click "View Receipt" to verify.'
                                  : 'No receipt uploaded. Please check your UPI app to verify payment.'}
                              </p>
                            </>
                          )}
                        </div>
                      )}

                      {/* Next step guidance */}
                      <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                        <p className="text-xs text-blue-700 font-medium">
                          {isPatient && apt.status === 'pending' && '⏳ Waiting for doctor to confirm your appointment.'}
                          {isPatient && apt.status === 'confirmed' && (!apt.paymentStatus || apt.paymentStatus === 'pending') && '💳 Next: Scan QR code and pay, then click "I Have Paid".'}
                          {isPatient && apt.status === 'confirmed' && apt.paymentStatus === 'paid' && apt.consultationType !== 'in-person' && `✅ Payment confirmed! Click "${apt.consultationType === 'video' ? '📹 Join Video Call' : '📞 Join Audio Call'}" at your appointment time.`}
                          {isPatient && apt.status === 'confirmed' && apt.paymentStatus === 'paid' && apt.consultationType === 'in-person' && '✅ Payment confirmed! Visit the clinic at your appointment time.'}
                        </p>
                        {isPatient && apt.status === 'confirmed' && apt.paymentStatus === 'paid' && apt.consultationType === 'in-person' && (
                          <a href={apt.doctor?.googleMapsLink || `https://maps.google.com?q=${encodeURIComponent(apt.doctor?.clinicAddress || apt.doctor?.city || '')}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-xs text-primary-600 hover:underline font-medium">📍 Get Directions</a>
                        )}
                        <p className="text-xs text-blue-700 font-medium">
                          {isPatient && apt.status === 'completed' && (
                            <>
                              ✅ Consultation done.{' '}
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); goToTab('prescriptions'); }}
                                className="underline hover:text-blue-900"
                              >
                                View your prescription →
                              </button>
                            </>
                          )}
                          {isPatient && apt.status === 'cancelled' && '❌ This appointment was cancelled.'}
                          {isDoctor && apt.status === 'pending' && '🔔 New request! Confirm or reject this appointment.'}
                          {isDoctor && apt.status === 'confirmed' && (!apt.paymentStatus || apt.paymentStatus === 'pending') && '⏳ Waiting for patient to make payment.'}
                          {isDoctor && apt.status === 'confirmed' && apt.paymentStatus === 'patient_claimed' && '💳 Patient says paid. Verify in your UPI app and click "Mark Paid".'}
                          {isDoctor && apt.status === 'confirmed' && apt.paymentStatus === 'paid' && apt.consultationType !== 'in-person' && `✅ Ready! Click "${apt.consultationType === 'video' ? '📹 Join Video Call' : '📞 Join Audio Call'}" at appointment time. After consultation, click "Mark Complete".`}
                          {isDoctor && apt.status === 'confirmed' && apt.paymentStatus === 'paid' && apt.consultationType === 'in-person' && '✅ Payment received. After consultation, click "Mark Complete".'}
                          {isDoctor && apt.status === 'completed' && '✅ Completed. Write a prescription for the patient.'}
                          {isDoctor && apt.status === 'cancelled' && '❌ This appointment was cancelled.'}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-shrink-0 flex-wrap">
                      {/* Doctor actions — sequential: Confirm → Mark Paid → Join Call + Mark Complete → Prescription */}
                      {isDoctor && apt.status === 'pending' && (
                        <>
                          <button onClick={() => handleStatusUpdate(apt._id, 'confirmed')} className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">Confirm</button>
                          <button onClick={() => handleStatusUpdate(apt._id, 'cancelled')} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">Reject</button>
                        </>
                      )}
                      {isDoctor && apt.status === 'confirmed' && apt.paymentStatus !== 'paid' && (
                        <button onClick={async () => { await appointmentAPI.markPayment(apt._id); toast.success('Payment marked as received'); fetchAppointments(); }} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600">Mark Paid</button>
                      )}
                      {isDoctor && apt.status === 'confirmed' && apt.paymentStatus === 'paid' && (
                        <>
                          {apt.consultationType !== 'in-person' && isWithinCallWindow(apt) && (
                            <button onClick={() => startCall(apt)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                              {apt.consultationType === 'video' ? '📹 Join Video Call' : '📞 Join Audio Call'}
                            </button>
                          )}
                          {apt.consultationType !== 'in-person' && isAppointmentToday(apt.date) && !isWithinCallWindow(apt) && (
                            <span className="px-3 py-2 text-xs text-gray-500 bg-gray-100 rounded-lg">Call opens at slot time ({apt.timeSlot})</span>
                          )}
                          <button onClick={() => handleStatusUpdate(apt._id, 'completed')} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">Mark Complete</button>
                        </>
                      )}
                      {isDoctor && apt.status === 'completed' && <button onClick={() => setPrescriptionModal({ open: true, id: apt._id })} className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600">Write Prescription</button>}
                      {isPatient && ['pending', 'confirmed'].includes(apt.status) && <button onClick={() => setCancelModal({ open: true, id: apt._id })} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">Cancel</button>}
                      {isPatient && apt.status === 'completed' && (
                        <>
                          {apt.followUpDeadline && new Date(apt.followUpDeadline) > new Date() && (
                            <button onClick={() => navigate(`/book-appointment/${apt.doctor?._id}`, { state: { repeatBooking: true, isFollowUp: true, originalAppointmentId: apt._id, reason: 'Follow-up: ' + apt.reason, consultationType: apt.consultationType, bookedFor: apt.bookedFor || 'self', familyMemberName: apt.familyMemberName || '' } })} className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">Free Follow-up</button>
                          )}
                          <button onClick={() => navigate(`/book-appointment/${apt.doctor?._id}`, { state: { repeatBooking: true, originalAppointmentId: apt._id, reason: apt.reason, consultationType: apt.consultationType, bookedFor: apt.bookedFor || 'self', familyMemberName: apt.familyMemberName || '' } })} className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600">Book Again</button>
                          <button onClick={() => setRateModal({ open: true, id: apt._id })} className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600">⭐ Rate</button>
                        </>
                      )}
                      {/* Chat and Video — for confirmed/completed appointments */}
                      {['confirmed', 'completed'].includes(apt.status) && (
                        <>
                          {isPatient && apt.consultationType !== 'in-person' && apt.status === 'confirmed' && apt.paymentStatus === 'paid' && isWithinCallWindow(apt) && (
                            <button onClick={() => startCall(apt)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                              {apt.consultationType === 'video' ? '📹 Join Video Call' : '📞 Join Audio Call'}
                            </button>
                          )}
                          {isPatient && apt.consultationType !== 'in-person' && apt.status === 'confirmed' && apt.paymentStatus === 'paid' && isAppointmentToday(apt.date) && !isWithinCallWindow(apt) && (
                            <span className="px-3 py-2 text-xs text-gray-500 bg-gray-100 rounded-lg">Call opens at your slot time ({apt.timeSlot})</span>
                          )}
                          <button onClick={() => { setChatAppointmentId(apt._id); fetchUnreadCounts(); }} className="relative px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600">
                            💬 Chat
                            {unreadMessages.unreadCount > 0 && (
                              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{unreadMessages.unreadCount}</span>
                            )}
                          </button>
                        </>
                      )}
                      {apt.paymentScreenshot && (
                        <button
                          onClick={() => setReceiptImage(getUploadUrl(apt.paymentScreenshot))}
                          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                        >
                          View Receipt
                        </button>
                      )}
                      {/* Block patient — doctor only */}
                      {isDoctor && apt.patient && (
                        <button onClick={async () => { try { await (await import('../services/api')).messageAPI.blockPatient(apt.patient._id || apt.patient); toast.success('Patient blocked'); } catch(e) { toast.error('Failed to block'); } }} className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50">Block</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-8">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-200">Previous</button>
                  <span className="text-sm text-gray-600">Page {page} of {pagination.totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-200">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* === EDIT PROFILE TAB (Doctor only) === */}
      {activeTab === 'profile' && isDoctor && (
        <div className="bg-white rounded-xl shadow-md p-8 max-w-2xl">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Update Your Profile</h2>
          <form onSubmit={handleProfileSave} className="space-y-4">
            {[
              { key: 'specialization', label: 'Specialization *', placeholder: 'e.g., Cardiologist, Dentist' },
              { key: 'qualification', label: 'Qualification *', placeholder: 'e.g., MBBS, MD - Cardiology' },
              { key: 'medicalRegistrationNo', label: 'Medical Registration No. *', placeholder: 'NMC or State Medical Council number' },
              { key: 'experience', label: 'Years of Experience *', placeholder: 'e.g., 10', type: 'number' },
              { key: 'consultationFee', label: 'Consultation Fee (₹) *', placeholder: 'e.g., 500', type: 'number' },
              { key: 'clinicAddress', label: 'Clinic Address *', placeholder: 'e.g., 123 Health Street' },
              { key: 'city', label: 'City *', placeholder: 'e.g., Delhi, Mumbai, Rishikesh' },
              { key: 'googleMapsLink', label: 'Google Maps Link (optional)', placeholder: 'Paste your clinic Google Maps URL' },
              { key: 'phone', label: 'Phone Number *', placeholder: '+91 9876543210', type: 'tel' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                <input
                  type={field.type || 'text'}
                  value={profileData[field.key]}
                  onChange={(e) => setProfileData(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Consultation Modes *</label>
              <div className="flex flex-wrap gap-3">
                {['in-person', 'video', 'phone'].map(mode => (
                  <label key={mode} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profileData.consultationModes?.includes(mode)}
                      onChange={(e) => {
                        const modes = profileData.consultationModes || [];
                        if (e.target.checked) {
                          setProfileData(prev => ({ ...prev, consultationModes: [...modes, mode] }));
                        } else {
                          setProfileData(prev => ({ ...prev, consultationModes: modes.filter(m => m !== mode) }));
                        }
                      }}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <span className="text-sm text-gray-700">{mode === 'in-person' ? '🏥 In-Person' : mode === 'video' ? '📹 Video Call' : '📞 Phone Call'}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">Select all consultation types you offer</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio / About</label>
              <textarea value={profileData.bio} onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))} placeholder="Tell patients about yourself..." rows={4} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profile Photo (recommended)</label>
              <p className="text-xs text-gray-500 mb-2">A clear, professional photo of your face builds patient trust and is shown on your profile and in search results.</p>
              {profileData.profilePhoto && (
                <img src={getUploadUrl(profileData.profilePhoto)} alt="Current profile" className="w-24 h-24 object-cover rounded-full border mb-2" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => uploadProfilePhoto(e.target.files[0])}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UPI QR Code (for receiving payments) *</label>
              <p className="text-xs text-gray-500 mb-2">Upload a screenshot of your GPay/PhonePe/Paytm QR code. Patients will scan this to pay you.</p>
              {profileData.upiQrCode && (
                <img src={getUploadUrl(profileData.upiQrCode)} alt="Current QR" className="w-32 h-32 object-contain border rounded-lg mb-2" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const data = new FormData();
                  data.append('profilePhoto', file);
                  data.append('fieldName', 'upiQrCode');
                  try {
                    const response = await doctorAPI.updateProfile(data);
                    setProfileData(prev => ({ ...prev, upiQrCode: response.data.doctor.upiQrCode }));
                    toast.success('QR code uploaded!');
                  } catch (err) { toast.error(err.response?.data?.message || 'Failed to upload QR code'); }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <button type="submit" className="bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors">Save Profile</button>
          </form>
        </div>
      )}

      {/* Sub-component tabs */}
      {activeTab === 'availability' && isDoctor && <DoctorAvailability onScheduleChange={setHasAvailability} />}
      {activeTab === 'patientReports' && isDoctor && <DoctorPatientReports />}
      {activeTab === 'familyMembers' && isPatient && <PatientFamilyMembers />}
      {activeTab === 'prescriptions' && isPatient && <PatientPrescriptions onNavigateTab={setActiveTab} />}
      {activeTab === 'reports' && isPatient && <PatientReports />}
      {activeTab === 'complaints' && isPatient && <PatientComplaints />}
      {activeTab === 'account' && <AccountSettings />}

      {/* === MODALS === */}
      <ConfirmModal
        open={cancelModal.open}
        title="Cancel Appointment"
        message="Are you sure you want to cancel this appointment?"
        confirmText="Cancel Appointment"
        variant="danger"
        onConfirm={handleCancel}
        onCancel={() => setCancelModal({ open: false, id: null })}
      />

      <PromptModal
        open={rateModal.open}
        title="Rate Your Doctor"
        description="How was your experience?"
        fields={[
          { name: 'rating', label: 'Rating (1-5 stars)', type: 'number', min: 1, max: 5, required: true, placeholder: '5' },
          { name: 'comment', label: 'Review (optional)', type: 'textarea', placeholder: 'Write a short review...' }
        ]}
        submitText="Submit Review"
        onSubmit={handleRateDoctor}
        onCancel={() => setRateModal({ open: false, id: null })}
      />

      <PromptModal
        open={prescriptionModal.open}
        title="Write Prescription"
        description="Enter the prescription details for this patient."
        fields={[
          { name: 'diagnosis', label: 'Diagnosis', type: 'text', required: true, placeholder: 'e.g., Upper respiratory infection' },
          { name: 'medicines', label: 'Medicines (comma separated)', type: 'textarea', placeholder: 'Paracetamol 500mg - Twice daily - 5 days, Vitamin D - Once daily - 30 days' },
          { name: 'tests', label: 'Recommended Tests (comma separated)', type: 'text', placeholder: 'Complete Blood Count, Thyroid Profile' },
          { name: 'notes', label: 'Additional Notes', type: 'textarea', placeholder: 'Rest, drink fluids...' },
          { name: 'followUpDays', label: 'Free Follow-up Period (days)', type: 'select', placeholder: 'Select...', options: [
            { value: '0', label: 'No follow-up needed' },
            { value: '7', label: '7 days' },
            { value: '15', label: '15 days' },
            { value: '30', label: '30 days' },
          ]}
        ]}
        submitText="Create Prescription"
        onSubmit={handleWritePrescription}
        onCancel={() => setPrescriptionModal({ open: false, id: null })}
      />

      {/* Chat Modal */}
      {chatAppointmentId && (
        <ChatBox appointmentId={chatAppointmentId} onClose={() => setChatAppointmentId(null)} />
      )}

      {/* Receipt Image Modal */}
      {receiptImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setReceiptImage(null)}>
          <div className="absolute inset-0 bg-black/80" />
          <div className="relative max-w-lg w-full">
            <img src={receiptImage} alt="Payment Receipt" className="w-full rounded-lg" onError={() => { setReceiptImage(null); toast.error('Receipt unavailable'); }} />
            <button onClick={() => setReceiptImage(null)} className="absolute top-2 right-2 bg-white rounded-full w-8 h-8 flex items-center justify-center text-gray-800 font-bold">&times;</button>
          </div>
        </div>
      )}

      {/* Incoming call banner (ringing) */}
      {incomingCall && !videoCallAppointmentId && (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="text-5xl mb-3 animate-bounce">{incomingCall.consultationType === 'video' ? '📹' : '📞'}</div>
            <h3 className="text-xl font-bold text-gray-800 mb-1">Incoming {incomingCall.consultationType === 'video' ? 'Video' : 'Audio'} Call</h3>
            <p className="text-gray-600 mb-6">{incomingCall.fromName} is calling you…</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={declineIncomingCall}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600"
              >
                Decline
              </button>
              <button
                onClick={acceptIncomingCall}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Call */}
      {videoCallAppointmentId && (
        <VideoCall
          appointmentId={videoCallAppointmentId}
          userName={user?.name}
          onClose={handleCloseCall}
        />
      )}
    </div>
  );
}

export default Dashboard;
