import { useState, useEffect } from 'react';
import { familyMemberAPI } from '../../services/api';
import { ConfirmModal } from '../../components/Modal';
import LoadingBlock from '../../components/LoadingBlock';
import toast from 'react-hot-toast';
import { useLang } from '../../context/LangContext';

// Bilingual fixed UI text. Option VALUES sent to the server (spouse, child,
// male, ...) never change — only the labels shown. Names/phones stay as typed.
const FAMILY_TXT = {
  en: {
    needNameRel: 'Please provide name and relationship',
    updated: 'Family member updated',
    added: 'Family member added',
    saveFailed: 'Failed to save family member',
    removed: 'Family member removed',
    removeFailed: 'Failed to remove family member',
    rel: { spouse: 'Spouse', child: 'Child', parent: 'Parent', sibling: 'Sibling', other: 'Other' },
    gender: { male: 'Male', female: 'Female', other: 'Other' },
    heading: 'Family Members',
    subheading: 'Add family members to book appointments on their behalf',
    cancel: 'Cancel',
    addBtn: '+ Add Member',
    editTitle: 'Edit Family Member',
    addTitle: 'Add Family Member',
    nameLabel: 'Name *',
    namePlaceholder: 'Full name',
    relLabel: 'Relationship *',
    select: 'Select...',
    ageLabel: 'Age',
    agePlaceholder: 'Age',
    genderLabel: 'Gender',
    phoneLabel: 'Phone',
    updateBtn: 'Update Member',
    addSubmit: 'Add Member',
    emptyTitle: 'No family members added',
    emptyText: 'Add family members to book appointments on their behalf.',
    yrs: (n) => `${n} yrs`,
    edit: 'Edit',
    remove: 'Remove',
    removeTitle: 'Remove Family Member',
    removeMsg: 'Are you sure you want to remove this family member?',
  },
  hi: {
    needNameRel: 'कृपया नाम और रिश्ता भरें',
    updated: 'परिवार के सदस्य की जानकारी बदल दी गई',
    added: 'परिवार का सदस्य जुड़ गया',
    saveFailed: 'परिवार के सदस्य को सेव नहीं कर पाए',
    removed: 'परिवार का सदस्य हटा दिया गया',
    removeFailed: 'परिवार के सदस्य को हटा नहीं पाए',
    rel: { spouse: 'पति / पत्नी', child: 'बच्चा', parent: 'माता-पिता', sibling: 'भाई / बहन', other: 'अन्य' },
    gender: { male: 'पुरुष', female: 'महिला', other: 'अन्य' },
    heading: 'परिवार के सदस्य',
    subheading: 'परिवार के सदस्य जोड़ें ताकि आप उनके लिए भी अपॉइंटमेंट बुक कर सकें',
    cancel: 'रद्द करें',
    addBtn: '+ सदस्य जोड़ें',
    editTitle: 'परिवार के सदस्य की जानकारी बदलें',
    addTitle: 'परिवार का सदस्य जोड़ें',
    nameLabel: 'नाम *',
    namePlaceholder: 'पूरा नाम',
    relLabel: 'रिश्ता *',
    select: 'चुनें...',
    ageLabel: 'उम्र',
    agePlaceholder: 'उम्र',
    genderLabel: 'लिंग',
    phoneLabel: 'फ़ोन',
    updateBtn: 'जानकारी सेव करें',
    addSubmit: 'सदस्य जोड़ें',
    emptyTitle: 'अभी कोई परिवार सदस्य नहीं जोड़ा',
    emptyText: 'परिवार के सदस्य जोड़ें ताकि आप उनके लिए भी अपॉइंटमेंट बुक कर सकें।',
    yrs: (n) => `${n} साल`,
    edit: 'बदलें',
    remove: 'हटाएँ',
    removeTitle: 'परिवार का सदस्य हटाएँ',
    removeMsg: 'क्या आप सच में इस परिवार सदस्य को हटाना चाहते हैं?',
  },
};

function PatientFamilyMembers() {
  const { lang } = useLang();
  const t = FAMILY_TXT[lang] || FAMILY_TXT.en;
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
  const [formData, setFormData] = useState({
    name: '', relationship: '', age: '', gender: 'other', phone: ''
  });

  useEffect(() => { fetchMembers(); }, []);

  const fetchMembers = async () => {
    try {
      const response = await familyMemberAPI.getAll();
      setMembers(response.data.familyMembers);
    } catch (error) {
      console.error('Fetch family members error:', error);
    } finally { setLoading(false); }
  };

  const resetForm = () => {
    setFormData({ name: '', relationship: '', age: '', gender: 'other', phone: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.relationship) {
      toast.error(t.needNameRel);
      return;
    }
    const payload = { ...formData, age: formData.age ? Number(formData.age) : null };
    try {
      if (editingId) {
        await familyMemberAPI.update(editingId, payload);
        toast.success(t.updated);
      } else {
        await familyMemberAPI.add(payload);
        toast.success(t.added);
      }
      resetForm();
      fetchMembers();
    } catch (error) {
      toast.error(error.response?.data?.message || t.saveFailed);
    }
  };

  const handleEdit = (member) => {
    setFormData({
      name: member.name, relationship: member.relationship,
      age: member.age || '', gender: member.gender || 'other', phone: member.phone || ''
    });
    setEditingId(member._id);
    setShowForm(true);
  };

  const handleDelete = async () => {
    try {
      await familyMemberAPI.remove(deleteModal.id);
      toast.success(t.removed);
      setDeleteModal({ open: false, id: null });
      fetchMembers();
    } catch (error) {
      toast.error(t.removeFailed);
    }
  };

  const getRelationshipLabel = (rel) => {
    const labels = t.rel;
    return labels[rel] || rel;
  };

  if (loading) return <LoadingBlock />;

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">{t.heading}</h2>
          <p className="text-sm text-gray-500 mt-1">{t.subheading}</p>
        </div>
        <button
          onClick={() => { showForm ? resetForm() : setShowForm(true); }}
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          {showForm ? t.cancel : t.addBtn}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="font-medium text-gray-800 mb-4">{editingId ? t.editTitle : t.addTitle}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.nameLabel}</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder={t.namePlaceholder} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.relLabel}</label>
                <select value={formData.relationship} onChange={(e) => setFormData(prev => ({ ...prev, relationship: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" required>
                  <option value="">{t.select}</option>
                  <option value="spouse">{t.rel.spouse}</option>
                  <option value="child">{t.rel.child}</option>
                  <option value="parent">{t.rel.parent}</option>
                  <option value="sibling">{t.rel.sibling}</option>
                  <option value="other">{t.rel.other}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.ageLabel}</label>
                <input type="number" value={formData.age} onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))} placeholder={t.agePlaceholder} min="0" max="120" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.genderLabel}</label>
                <select value={formData.gender} onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                  <option value="male">{t.gender.male}</option>
                  <option value="female">{t.gender.female}</option>
                  <option value="other">{t.gender.other}</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.phoneLabel}</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} placeholder="+91 9876543210" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
              </div>
            </div>
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
              {editingId ? t.updateBtn : t.addSubmit}
            </button>
          </form>
        </div>
      )}

      {members.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <div className="text-5xl mb-4">👨‍👩‍👧‍👦</div>
          <h3 className="text-xl font-medium text-gray-700">{t.emptyTitle}</h3>
          <p className="text-gray-500 mt-2">{t.emptyText}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member._id} className="bg-white rounded-xl shadow-md p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-xl">
                  {member.gender === 'male' ? '👨' : member.gender === 'female' ? '👩' : '🧑'}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{member.name}</h3>
                  <p className="text-sm text-gray-500">
                    {getRelationshipLabel(member.relationship)}
                    {member.age ? ` • ${t.yrs(member.age)}` : ''}
                    {member.phone ? ` • ${member.phone}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(member)} className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">{t.edit}</button>
                <button onClick={() => setDeleteModal({ open: true, id: member._id })} className="px-3 py-1 text-sm border border-red-200 rounded-lg hover:bg-red-50 text-red-600">{t.remove}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={deleteModal.open}
        title={t.removeTitle}
        message={t.removeMsg}
        confirmText={t.remove}
        cancelText={t.cancel}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal({ open: false, id: null })}
      />
    </div>
  );
}

export default PatientFamilyMembers;
