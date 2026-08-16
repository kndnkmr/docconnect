import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import { ConfirmModal } from '../../components/Modal';
import { enablePushNotifications, getPushPermission, isPushSupported } from '../../services/push';
import toast from 'react-hot-toast';

function AccountSettings() {
  const { user, logout } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  // Medical info — set once, reused for every appointment the patient
  // books. Shown to the doctor on the appointment card so they don't have
  // to ask every time.
  const [medicalInfo, setMedicalInfo] = useState({
    bloodGroup: user?.bloodGroup || '',
    allergies: user?.allergies || '',
    currentMedications: user?.currentMedications || '',
    medicalHistory: user?.medicalHistory || '',
    emergencyContactName: user?.emergencyContactName || '',
    emergencyContactPhone: user?.emergencyContactPhone || ''
  });
  const [isSavingMedical, setIsSavingMedical] = useState(false);

  // Notifications — a PERMANENT control, unlike the Dashboard's one-time
  // dismissible nudge. If someone dismissed that banner once (or denied the
  // browser prompt), it never shows again — this is the only way back.
  const [pushStatus, setPushStatus] = useState(() => (isPushSupported() ? getPushPermission() : 'unsupported'));
  const [enablingPush, setEnablingPush] = useState(false);

  const handleEnableNotifications = async () => {
    setEnablingPush(true);
    const ok = await enablePushNotifications();
    const newStatus = isPushSupported() ? getPushPermission() : 'unsupported';
    setPushStatus(newStatus);
    setEnablingPush(false);
    if (ok) {
      toast.success('Notifications enabled!');
    } else if (newStatus === 'denied') {
      toast.error('Notifications are blocked for this site — allow them from your browser\'s site settings, then try again.');
    } else {
      toast.error('Could not enable notifications. Please try again.');
    }
  };

  const handleUpdateAccount = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await authAPI.updateAccount({ email, phone });
      toast.success('Account updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update account');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateMedicalInfo = async (e) => {
    e.preventDefault();
    setIsSavingMedical(true);
    try {
      await authAPI.updateMedicalInfo(medicalInfo);
      toast.success('Medical information updated!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update medical information');
    } finally {
      setIsSavingMedical(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const response = await authAPI.deleteAccount();
      if (response.status === 200) {
        toast.success('Account deleted. Goodbye!');
        logout();
        window.location.href = '/';
      } else {
        toast.error('Delete may not have completed. Please try again.');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete account.');
    }
    setDeleteModal(false);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Account Settings</h2>

      {/* Patient ID — a short, memorable identifier (separate from the
          internal account id) your doctor can look you up by, e.g. over a
          phone call, without needing your exact registered name/number. */}
      {user?.role === 'patient' && user?.patientId && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-primary-700 font-medium">Your Patient ID</p>
            <p className="text-lg font-bold text-primary-800 tracking-wide">{user.patientId}</p>
          </div>
          <p className="text-xs text-gray-500 max-w-[45%] text-right">Share this with your doctor to help them find your records quickly.</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="font-medium text-gray-800 mb-4">Update Contact Information</h3>
        <form onSubmit={handleUpdateAccount} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <button type="submit" disabled={isSaving} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Update Account'}
          </button>
        </form>
      </div>

      {user?.role === 'patient' && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="font-medium text-gray-800 mb-1">Medical Information</h3>
          <p className="text-gray-500 text-sm mb-4">Optional, but sharing this once means your doctor sees it automatically on every appointment — you won't need to repeat it each visit.</p>
          <form onSubmit={handleUpdateMedicalInfo} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
              <select
                value={medicalInfo.bloodGroup}
                onChange={(e) => setMedicalInfo((prev) => ({ ...prev, bloodGroup: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="">Not specified</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
              <textarea
                value={medicalInfo.allergies}
                onChange={(e) => setMedicalInfo((prev) => ({ ...prev, allergies: e.target.value }))}
                placeholder="e.g., Penicillin, Peanuts"
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Medications</label>
              <textarea
                value={medicalInfo.currentMedications}
                onChange={(e) => setMedicalInfo((prev) => ({ ...prev, currentMedications: e.target.value }))}
                placeholder="e.g., Metformin 500mg daily"
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medical History</label>
              <textarea
                value={medicalInfo.medicalHistory}
                onChange={(e) => setMedicalInfo((prev) => ({ ...prev, medicalHistory: e.target.value }))}
                placeholder="e.g., Type 2 diabetes, hypertension"
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
                <input
                  type="text"
                  value={medicalInfo.emergencyContactName}
                  onChange={(e) => setMedicalInfo((prev) => ({ ...prev, emergencyContactName: e.target.value }))}
                  placeholder="e.g., Spouse, parent, sibling"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Phone</label>
                <input
                  type="tel"
                  value={medicalInfo.emergencyContactPhone}
                  onChange={(e) => setMedicalInfo((prev) => ({ ...prev, emergencyContactPhone: e.target.value }))}
                  placeholder="+91 9876543210"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <button type="submit" disabled={isSavingMedical} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50">
              {isSavingMedical ? 'Saving...' : 'Save Medical Information'}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="font-medium text-gray-800 mb-2">Notifications</h3>
        <p className="text-gray-600 text-sm mb-4">Get instant alerts for appointment updates, messages, and calls — even when this tab isn't open.</p>

        {pushStatus === 'granted' && (
          <p className="text-sm text-green-700 font-medium">✓ Notifications are enabled on this device.</p>
        )}

        {pushStatus === 'default' && (
          <button
            onClick={handleEnableNotifications}
            disabled={enablingPush}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {enablingPush ? 'Enabling…' : 'Enable Notifications'}
          </button>
        )}

        {pushStatus === 'denied' && (
          <div>
            <p className="text-sm text-orange-700 mb-3">
              Notifications are blocked for this site. This is a browser security setting we can't override from here — websites are never allowed to re-ask once you've said no, to stop sites from spamming permission popups. Allow it from your browser's site settings (tap the lock/info icon next to the address bar → Notifications → Allow), then click below.
            </p>
            <button
              onClick={handleEnableNotifications}
              disabled={enablingPush}
              className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {enablingPush ? 'Checking…' : "I've Allowed It — Try Again"}
            </button>
          </div>
        )}

        {pushStatus === 'unsupported' && (
          <p className="text-sm text-gray-500">
            Your browser doesn't support notifications right now. On iPhone, this usually means the site needs to be added to your Home Screen first — open this site in Safari, tap Share → "Add to Home Screen," then open it from there and try again.
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 border border-red-200">
        <h3 className="font-medium text-red-700 mb-2">Danger Zone</h3>
        <p className="text-gray-600 text-sm mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
        <button onClick={() => setDeleteModal(true)} className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors">
          Delete My Account
        </button>
      </div>

      <ConfirmModal
        open={deleteModal}
        title="Delete Account"
        message="All your data (appointments, profile, reports) will be permanently deleted. This cannot be undone."
        confirmText="Delete Account"
        variant="danger"
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteModal(false)}
      />
    </div>
  );
}

export default AccountSettings;
