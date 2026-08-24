// ============================================
// Admin Dashboard - Manage users and appointments
// ============================================

import { useState, useEffect } from 'react';
import { adminAPI, announcementAPI, complaintAPI } from '../services/api';
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
  }, [activeTab, userRoleFilter, appointmentStatusFilter, complaintStatusFilter]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg text-gray-600">Loading admin panel...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Manage users, appointments, and monitor platform activity</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'stats' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'users' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Users
        </button>
        <button
          onClick={() => setActiveTab('appointments')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'appointments' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Appointments
        </button>
        <button
          onClick={() => { setActiveTab('analytics'); fetchAnalytics(); }}
          className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'analytics' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Revenue & Analytics
        </button>
        <button
          onClick={() => { setActiveTab('announcements'); fetchAnnouncements(); }}
          className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'announcements' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Announcements
        </button>
        <button
          onClick={() => setActiveTab('complaints')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'complaints' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Complaints
        </button>
      </div>

      {/* === STATS TAB === */}
      {activeTab === 'stats' && stats && (
        <div>
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-md p-6 text-center">
              <div className="text-3xl font-bold text-primary-600">{stats.totalUsers}</div>
              <div className="text-gray-600 mt-1">Total Users</div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.totalDoctors}</div>
              <div className="text-gray-600 mt-1">Doctors</div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 text-center">
              <div className="text-3xl font-bold text-green-600">{stats.totalPatients}</div>
              <div className="text-gray-600 mt-1">Patients</div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 text-center">
              <div className="text-3xl font-bold text-purple-600">{stats.totalAppointments}</div>
              <div className="text-gray-600 mt-1">Appointments</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Appointment Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-yellow-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-700">{stats.pendingAppointments}</div>
                <div className="text-yellow-600 text-sm">Pending</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-700">{stats.confirmedAppointments}</div>
                <div className="text-green-600 text-sm">Confirmed</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-700">{stats.completedAppointments}</div>
                <div className="text-blue-600 text-sm">Completed</div>
              </div>
              <div className="p-4 bg-red-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-700">{stats.cancelledAppointments}</div>
                <div className="text-red-600 text-sm">Cancelled</div>
              </div>
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
                      <td className="px-4 py-3 text-sm text-gray-800 font-medium">{user.name}</td>
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
                          <div className="flex items-center gap-3 flex-wrap">
                            {/* A self-deleted account already can't log in and is hidden from
                                patients/search — verifying, deactivating, or resetting its
                                password no longer does anything useful. Only permanent Delete
                                (to purge before the 90-day retention window) still applies. */}
                            {!user.isDeleted && user.role === 'doctor' && (
                              <button
                                onClick={() => handleToggleVerification(user)}
                                className={`text-sm font-medium ${
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
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {appointments.map((apt) => (
                    <tr key={apt._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <div className="text-gray-800 font-medium">
                          {apt.patient?.name || 'Unknown'}
                          {apt.patient?.patientId && <span className="text-gray-400 font-mono text-xs ml-1">({apt.patient.patientId})</span>}
                        </div>
                        <div className="text-gray-500 text-xs">{apt.patient?.phone || apt.patient?.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="text-gray-800 font-medium">{apt.doctor?.name || 'Unknown'}</div>
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
                                {apt.amountCollected > 0 && <div className="text-xs text-gray-600 mt-1">₹{apt.amountCollected}</div>}
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
              <div className="text-3xl font-bold text-green-600">₹{analytics.revenue.total.toLocaleString()}</div>
              <div className="text-gray-600 mt-1">Total Revenue</div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 text-center">
              <div className="text-3xl font-bold text-primary-600">{analytics.revenue.totalPaidAppointments}</div>
              <div className="text-gray-600 mt-1">Paid Appointments</div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 text-center">
              <div className="text-3xl font-bold text-purple-600">
                ₹{analytics.revenue.totalPaidAppointments > 0 ? Math.round(analytics.revenue.total / analytics.revenue.totalPaidAppointments) : 0}
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
                        <td className="px-4 py-3 text-sm font-semibold text-green-600">₹{doc.revenue.toLocaleString()}</td>
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
                      <p className="font-semibold text-green-600">₹{payment.amountCollected}</p>
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
    </div>
  );
}

export default AdminDashboard;
