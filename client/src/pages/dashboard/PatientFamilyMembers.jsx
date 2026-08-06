import { useState, useEffect } from 'react';
import { familyMemberAPI } from '../../services/api';
import { ConfirmModal } from '../../components/Modal';
import toast from 'react-hot-toast';

function PatientFamilyMembers() {
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
      toast.error('Please provide name and relationship');
      return;
    }
    const payload = { ...formData, age: formData.age ? Number(formData.age) : null };
    try {
      if (editingId) {
        await familyMemberAPI.update(editingId, payload);
        toast.success('Family member updated');
      } else {
        await familyMemberAPI.add(payload);
        toast.success('Family member added');
      }
      resetForm();
      fetchMembers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save family member');
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
      toast.success('Family member removed');
      setDeleteModal({ open: false, id: null });
      fetchMembers();
    } catch (error) {
      toast.error('Failed to remove family member');
    }
  };

  const getRelationshipLabel = (rel) => {
    const labels = { spouse: 'Spouse', child: 'Child', parent: 'Parent', sibling: 'Sibling', other: 'Other' };
    return labels[rel] || rel;
  };

  if (loading) return <div className="text-center py-8 text-gray-600">Loading...</div>;

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Family Members</h2>
          <p className="text-sm text-gray-500 mt-1">Add family members to book appointments on their behalf</p>
        </div>
        <button
          onClick={() => { showForm ? resetForm() : setShowForm(true); }}
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Member'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="font-medium text-gray-800 mb-4">{editingId ? 'Edit Family Member' : 'Add Family Member'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="Full name" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Relationship *</label>
                <select value={formData.relationship} onChange={(e) => setFormData(prev => ({ ...prev, relationship: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" required>
                  <option value="">Select...</option>
                  <option value="spouse">Spouse</option>
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Sibling</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                <input type="number" value={formData.age} onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))} placeholder="Age" min="0" max="120" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select value={formData.gender} onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} placeholder="+91 9876543210" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
              </div>
            </div>
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
              {editingId ? 'Update Member' : 'Add Member'}
            </button>
          </form>
        </div>
      )}

      {members.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <div className="text-5xl mb-4">👨‍👩‍👧‍👦</div>
          <h3 className="text-xl font-medium text-gray-700">No family members added</h3>
          <p className="text-gray-500 mt-2">Add family members to book appointments on their behalf.</p>
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
                    {member.age ? ` • ${member.age} yrs` : ''}
                    {member.phone ? ` • ${member.phone}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(member)} className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">Edit</button>
                <button onClick={() => setDeleteModal({ open: true, id: member._id })} className="px-3 py-1 text-sm border border-red-200 rounded-lg hover:bg-red-50 text-red-600">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={deleteModal.open}
        title="Remove Family Member"
        message="Are you sure you want to remove this family member?"
        confirmText="Remove"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal({ open: false, id: null })}
      />
    </div>
  );
}

export default PatientFamilyMembers;
