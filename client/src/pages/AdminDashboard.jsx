// ============================================
// Admin Dashboard - Manage users and appointments
// ============================================

import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
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

  // Fetch stats on load
  useEffect(() => {
    fetchStats();
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
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
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
      </div>

      {/* === STATS TAB === */}
      {activeTab === 'stats' && stats && (
        <div>
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
                        {user.isSuspended ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            Deactivated
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3">
                        {user.role !== 'admin' && (
                          <div className="flex items-center gap-3">
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
    </div>
  );
}

export default AdminDashboard;
