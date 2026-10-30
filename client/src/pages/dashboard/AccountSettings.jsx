import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { authAPI } from '../../services/api';
import { ConfirmModal } from '../../components/Modal';
import { enablePushNotifications, getPushPermission, isPushSupported } from '../../services/push';
import toast from 'react-hot-toast';

// Bilingual fixed UI text. This screen is shared with doctors/admins, who
// always see English — Hindi is only for patients with the app set to Hindi.
// Typed values (email, phone, medical info) and server messages stay as-is.
const SETTINGS_TXT = {
  en: {
    pushOn: 'Notifications enabled!',
    pushBlockedToast: 'Notifications are blocked for this site — allow them from your browser\'s site settings, then try again.',
    pushFailed: 'Could not enable notifications. Please try again.',
    accountUpdated: 'Account updated successfully!',
    accountFailed: 'Failed to update account',
    medicalUpdated: 'Medical information updated!',
    medicalFailed: 'Failed to update medical information',
    deleted: 'Account deleted. Goodbye!',
    deleteMaybe: 'Delete may not have completed. Please try again.',
    deleteFailed: 'Failed to delete account.',
    heading: 'Account Settings',
    patientId: 'Your Patient ID',
    patientIdHint: 'Share this with your doctor to help them find your records quickly.',
    contactTitle: 'Update Contact Information',
    email: 'Email Address',
    phone: 'Phone Number',
    saving: 'Saving...',
    updateAccount: 'Update Account',
    medicalTitle: 'Medical Information',
    medicalHint: "Optional, but sharing this once means your doctor sees it automatically on every appointment — you won't need to repeat it each visit.",
    bloodGroup: 'Blood Group',
    notSpecified: 'Not specified',
    allergies: 'Allergies',
    allergiesPh: 'e.g., Penicillin, Peanuts',
    medications: 'Current Medications',
    medicationsPh: 'e.g., Metformin 500mg daily',
    history: 'Medical History',
    historyPh: 'e.g., Type 2 diabetes, hypertension',
    emergencyName: 'Emergency Contact Name',
    emergencyNamePh: 'e.g., Spouse, parent, sibling',
    emergencyPhone: 'Emergency Contact Phone',
    insurance: 'Insurance Provider (optional)',
    insurancePh: 'e.g., Star Health, HDFC Ergo',
    policy: 'Policy Number (optional)',
    saveMedical: 'Save Medical Information',
    notifTitle: 'Notifications',
    notifHint: "Get instant alerts for appointment updates, messages, and calls — even when this tab isn't open.",
    notifOn: '✓ Notifications are enabled on this device.',
    enabling: 'Enabling…',
    enableNotif: 'Enable Notifications',
    notifBlocked: "Notifications are blocked for this site. This is a browser security setting we can't override from here — websites are never allowed to re-ask once you've said no, to stop sites from spamming permission popups. Allow it from your browser's site settings (tap the lock/info icon next to the address bar → Notifications → Allow), then click below.",
    checking: 'Checking…',
    tryAgain: "I've Allowed It — Try Again",
    notifUnsupported: 'Your browser doesn\'t support notifications right now. On iPhone, this usually means the site needs to be added to your Home Screen first — open this site in Safari, tap Share → "Add to Home Screen," then open it from there and try again.',
    dangerTitle: 'Danger Zone',
    dangerHint: 'Permanently delete your account and all associated data. This action cannot be undone.',
    deleteMine: 'Delete My Account',
    deleteTitle: 'Delete Account',
    deleteMsg: 'All your data (appointments, profile, reports) will be permanently deleted. This cannot be undone.',
    deleteConfirm: 'Delete Account',
    cancel: 'Cancel',
  },
  hi: {
    pushOn: 'नोटिफिकेशन चालू हो गए!',
    pushBlockedToast: 'इस साइट के नोटिफिकेशन बंद हैं — ब्राउज़र की साइट सेटिंग में जाकर इन्हें चालू करें, फिर दोबारा कोशिश करें।',
    pushFailed: 'नोटिफिकेशन चालू नहीं हो पाए। कृपया दोबारा कोशिश करें।',
    accountUpdated: 'खाते की जानकारी सेव हो गई!',
    accountFailed: 'खाते की जानकारी सेव नहीं हो पाई',
    medicalUpdated: 'सेहत की जानकारी सेव हो गई!',
    medicalFailed: 'सेहत की जानकारी सेव नहीं हो पाई',
    deleted: 'खाता हटा दिया गया। धन्यवाद!',
    deleteMaybe: 'खाता शायद पूरी तरह नहीं हटा। कृपया दोबारा कोशिश करें।',
    deleteFailed: 'खाता नहीं हटा पाए।',
    heading: 'खाते की सेटिंग',
    patientId: 'आपका मरीज़ ID',
    patientIdHint: 'यह ID अपने डॉक्टर को बताएं, इससे वे आपका रिकॉर्ड जल्दी ढूंढ पाएँगे।',
    contactTitle: 'संपर्क की जानकारी बदलें',
    email: 'ईमेल',
    phone: 'फ़ोन नंबर',
    saving: 'सेव हो रहा है...',
    updateAccount: 'जानकारी सेव करें',
    medicalTitle: 'सेहत की जानकारी',
    medicalHint: 'भरना ज़रूरी नहीं, पर एक बार भर देने से हर अपॉइंटमेंट पर डॉक्टर को यह अपने आप दिख जाएगी — हर बार बताना नहीं पड़ेगा।',
    bloodGroup: 'ब्लड ग्रुप',
    notSpecified: 'नहीं बताया',
    allergies: 'एलर्जी',
    allergiesPh: 'जैसे: पेनिसिलिन, मूंगफली',
    medications: 'अभी चल रही दवाएं',
    medicationsPh: 'जैसे: Metformin 500mg रोज़',
    history: 'पुरानी बीमारियाँ',
    historyPh: 'जैसे: शुगर (डायबिटीज़), बीपी',
    emergencyName: 'इमरजेंसी में किसे बुलाएँ (नाम)',
    emergencyNamePh: 'जैसे: पति/पत्नी, माता-पिता, भाई/बहन',
    emergencyPhone: 'इमरजेंसी संपर्क का फ़ोन',
    insurance: 'बीमा कंपनी (ज़रूरी नहीं)',
    insurancePh: 'जैसे: Star Health, HDFC Ergo',
    policy: 'पॉलिसी नंबर (ज़रूरी नहीं)',
    saveMedical: 'सेहत की जानकारी सेव करें',
    notifTitle: 'नोटिफिकेशन',
    notifHint: 'अपॉइंटमेंट, मैसेज और कॉल की खबर तुरंत पाएं — यह पेज खुला न हो तब भी।',
    notifOn: '✓ इस फ़ोन/डिवाइस पर नोटिफिकेशन चालू हैं।',
    enabling: 'चालू हो रहे हैं…',
    enableNotif: 'नोटिफिकेशन चालू करें',
    notifBlocked: 'इस साइट के नोटिफिकेशन बंद हैं। यह ब्राउज़र की सुरक्षा सेटिंग है जिसे हम यहाँ से नहीं बदल सकते — एक बार मना करने के बाद वेबसाइट दोबारा नहीं पूछ सकती, ताकि साइटें बार-बार परेशान न करें। ब्राउज़र की साइट सेटिंग में जाकर चालू करें (एड्रेस बार के पास ताले/i वाले निशान पर दबाएं → Notifications → Allow), फिर नीचे दबाएं।',
    checking: 'जाँच हो रही है…',
    tryAgain: 'मैंने चालू कर दिया — दोबारा कोशिश करें',
    notifUnsupported: 'आपका ब्राउज़र अभी नोटिफिकेशन नहीं दिखा सकता। iPhone पर पहले इस साइट को होम स्क्रीन पर जोड़ना पड़ता है — Safari में यह साइट खोलें, Share → "Add to Home Screen" दबाएं, फिर वहीं से खोलकर दोबारा कोशिश करें।',
    dangerTitle: 'खाता हटाना',
    dangerHint: 'आपका खाता और उससे जुड़ी सारी जानकारी हमेशा के लिए मिट जाएगी। यह वापस नहीं हो सकता।',
    deleteMine: 'मेरा खाता हटाएँ',
    deleteTitle: 'खाता हटाएँ',
    deleteMsg: 'आपकी सारी जानकारी (अपॉइंटमेंट, प्रोफ़ाइल, रिपोर्ट) हमेशा के लिए मिट जाएगी। यह वापस नहीं हो सकता।',
    deleteConfirm: 'खाता हटाएँ',
    cancel: 'रद्द करें',
  },
};

function AccountSettings() {
  const { user, logout } = useAuth();
  const { lang } = useLang();
  // Doctors and admins share this screen and always see English.
  const hi = lang === 'hi' && user?.role !== 'doctor' && user?.role !== 'admin';
  const t = hi ? SETTINGS_TXT.hi : SETTINGS_TXT.en;
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
    emergencyContactPhone: user?.emergencyContactPhone || '',
    insuranceProvider: user?.insuranceProvider || '',
    insurancePolicyNumber: user?.insurancePolicyNumber || ''
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
      toast.success(t.pushOn);
    } else if (newStatus === 'denied') {
      toast.error(t.pushBlockedToast);
    } else {
      toast.error(t.pushFailed);
    }
  };

  const handleUpdateAccount = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await authAPI.updateAccount({ email, phone });
      toast.success(t.accountUpdated);
    } catch (error) {
      toast.error(error.response?.data?.message || t.accountFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateMedicalInfo = async (e) => {
    e.preventDefault();
    setIsSavingMedical(true);
    try {
      await authAPI.updateMedicalInfo(medicalInfo);
      toast.success(t.medicalUpdated);
    } catch (error) {
      toast.error(error.response?.data?.message || t.medicalFailed);
    } finally {
      setIsSavingMedical(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const response = await authAPI.deleteAccount();
      if (response.status === 200) {
        toast.success(t.deleted);
        logout();
        window.location.href = '/';
      } else {
        toast.error(t.deleteMaybe);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t.deleteFailed);
    }
    setDeleteModal(false);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">{t.heading}</h2>

      {/* Patient ID — a short, memorable identifier (separate from the
          internal account id) your doctor can look you up by, e.g. over a
          phone call, without needing your exact registered name/number. */}
      {user?.role === 'patient' && user?.patientId && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-primary-700 font-medium">{t.patientId}</p>
            <p className="text-lg font-bold text-primary-800 tracking-wide">{user.patientId}</p>
          </div>
          <p className="text-xs text-gray-500 max-w-[45%] text-right">{t.patientIdHint}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="font-medium text-gray-800 mb-4">{t.contactTitle}</h3>
        <form onSubmit={handleUpdateAccount} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.email}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.phone}</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <button type="submit" disabled={isSaving} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50">
            {isSaving ? t.saving : t.updateAccount}
          </button>
        </form>
      </div>

      {user?.role === 'patient' && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="font-medium text-gray-800 mb-1">{t.medicalTitle}</h3>
          <p className="text-gray-500 text-sm mb-4">{t.medicalHint}</p>
          <form onSubmit={handleUpdateMedicalInfo} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.bloodGroup}</label>
              <select
                value={medicalInfo.bloodGroup}
                onChange={(e) => setMedicalInfo((prev) => ({ ...prev, bloodGroup: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="">{t.notSpecified}</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.allergies}</label>
              <textarea
                value={medicalInfo.allergies}
                onChange={(e) => setMedicalInfo((prev) => ({ ...prev, allergies: e.target.value }))}
                placeholder={t.allergiesPh}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.medications}</label>
              <textarea
                value={medicalInfo.currentMedications}
                onChange={(e) => setMedicalInfo((prev) => ({ ...prev, currentMedications: e.target.value }))}
                placeholder={t.medicationsPh}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.history}</label>
              <textarea
                value={medicalInfo.medicalHistory}
                onChange={(e) => setMedicalInfo((prev) => ({ ...prev, medicalHistory: e.target.value }))}
                placeholder={t.historyPh}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.emergencyName}</label>
                <input
                  type="text"
                  value={medicalInfo.emergencyContactName}
                  onChange={(e) => setMedicalInfo((prev) => ({ ...prev, emergencyContactName: e.target.value }))}
                  placeholder={t.emergencyNamePh}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.emergencyPhone}</label>
                <input
                  type="tel"
                  value={medicalInfo.emergencyContactPhone}
                  onChange={(e) => setMedicalInfo((prev) => ({ ...prev, emergencyContactPhone: e.target.value }))}
                  placeholder="+91 9876543210"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.insurance}</label>
                <input
                  type="text"
                  value={medicalInfo.insuranceProvider}
                  onChange={(e) => setMedicalInfo((prev) => ({ ...prev, insuranceProvider: e.target.value }))}
                  placeholder={t.insurancePh}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.policy}</label>
                <input
                  type="text"
                  value={medicalInfo.insurancePolicyNumber}
                  onChange={(e) => setMedicalInfo((prev) => ({ ...prev, insurancePolicyNumber: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <button type="submit" disabled={isSavingMedical} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50">
              {isSavingMedical ? t.saving : t.saveMedical}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="font-medium text-gray-800 mb-2">{t.notifTitle}</h3>
        <p className="text-gray-600 text-sm mb-4">{t.notifHint}</p>

        {pushStatus === 'granted' && (
          <p className="text-sm text-green-700 font-medium">{t.notifOn}</p>
        )}

        {pushStatus === 'default' && (
          <button
            onClick={handleEnableNotifications}
            disabled={enablingPush}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {enablingPush ? t.enabling : t.enableNotif}
          </button>
        )}

        {pushStatus === 'denied' && (
          <div>
            <p className="text-sm text-orange-700 mb-3">
              {t.notifBlocked}
            </p>
            <button
              onClick={handleEnableNotifications}
              disabled={enablingPush}
              className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {enablingPush ? t.checking : t.tryAgain}
            </button>
          </div>
        )}

        {pushStatus === 'unsupported' && (
          <p className="text-sm text-gray-500">
            {t.notifUnsupported}
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 border border-red-200">
        <h3 className="font-medium text-red-700 mb-2">{t.dangerTitle}</h3>
        <p className="text-gray-600 text-sm mb-4">{t.dangerHint}</p>
        <button onClick={() => setDeleteModal(true)} className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors">
          {t.deleteMine}
        </button>
      </div>

      <ConfirmModal
        open={deleteModal}
        title={t.deleteTitle}
        message={t.deleteMsg}
        confirmText={t.deleteConfirm}
        cancelText={t.cancel}
        variant="danger"
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteModal(false)}
      />
    </div>
  );
}

export default AccountSettings;
