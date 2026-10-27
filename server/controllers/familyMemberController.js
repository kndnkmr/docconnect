// ============================================
// Family Member Controller - Manage family members
// ============================================
// Patients can add family members to their account and
// book appointments on their behalf.
//
// ENDPOINTS:
//   GET    /api/family-members       → list my family members
//   POST   /api/family-members       → add a family member
//   PUT    /api/family-members/:id   → update a family member
//   DELETE /api/family-members/:id   → remove a family member
//
// The rules (required fields, relationship list, max 10) live in
// utils/familyMembers.js, shared with the admin "Help patient" tool.

const User = require('../models/User');
const { addMember, updateMember, removeMember, FamilyError } = require('../utils/familyMembers');

const fail = (res, error, fallback, label) => {
  if (error instanceof FamilyError) return res.status(error.status).json({ message: error.message });
  console.error(`${label} error:`, error.message);
  return res.status(500).json({ message: fallback });
};

// ============================================
// GET FAMILY MEMBERS - List all for logged-in patient
// ============================================
const getFamilyMembers = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('familyMembers');

    res.json({
      familyMembers: user.familyMembers || []
    });
  } catch (error) {
    console.error('Get family members error:', error.message);
    res.status(500).json({ message: 'Error fetching family members' });
  }
};

// ============================================
// ADD FAMILY MEMBER
// ============================================
const addFamilyMember = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const newMember = addMember(user, req.body);
    await user.save();

    res.status(201).json({
      message: 'Family member added successfully',
      familyMember: newMember
    });
  } catch (error) {
    fail(res, error, 'Error adding family member', 'Add family member');
  }
};

// ============================================
// UPDATE FAMILY MEMBER
// ============================================
const updateFamilyMember = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const member = updateMember(user, req.params.id, req.body);
    await user.save();

    res.json({
      message: 'Family member updated successfully',
      familyMember: member
    });
  } catch (error) {
    fail(res, error, 'Error updating family member', 'Update family member');
  }
};

// ============================================
// DELETE FAMILY MEMBER
// ============================================
const deleteFamilyMember = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    removeMember(user, req.params.id);
    await user.save();

    res.json({ message: 'Family member removed successfully' });
  } catch (error) {
    fail(res, error, 'Error removing family member', 'Delete family member');
  }
};

module.exports = {
  getFamilyMembers,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember
};
