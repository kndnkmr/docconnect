// ============================================
// Admin Dashboard - Manage users and appointments
// ============================================

import { useState, useEffect } from 'react';
import { adminAPI, announcementAPI } from '../services/api';
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

  // Non-destructive fix for a stale deleted account blocking someone else's
  // login: rename its phone/email out of the way, keep everything else
  // (appointments, prescriptions, reports) intact. This is the RIGHT way to
  // resolve a duplicate — permanent Delete cascade-deletes appointment
  // history too, which matters for medical/legal record-keeping.
  const handleFreeUpContactInfo = async (acc) => {
    if (!window.confirm(`Free up "${acc.name}"'s phone/email so the other account can use it?\n\nThis keeps their record and all appointment history intact — it just renames the contact info out of the way, the same thing that happens automatically when someone re-registers.`)) return;
    try {
      const response = await adminAPI.freeUpContactInfo(acc._id);
      toast.success(response.data.message);
      fetchDuplicatePhones();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to free up contact info');
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
  }, [activeTab, userRoleFilter, appointmentStatusFilter]);

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`Permanently DELETE "${name}"?\n\nThis also deletes all their appointments and cannot be undone.\n\nTip: use "Deactivate" instead if you only want to hide them while keeping records.`)) return;
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
                placeholder="Search by name or email..."
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
                                title={user.email ? 'Emails a reset link to this user' : 'No email on file — copies a link for you to send manually'}
                              >
                                Reset Link
                              </button>
                            )}
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
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {appointments.map((apt) => (
                    <tr key={apt._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <div className="text-gray-800 font-medium">{apt.patient?.name || 'Unknown'}</div>
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
    </div>
  );
}

export default AdminDashboard;
