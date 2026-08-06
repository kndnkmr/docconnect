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

const User = require('../models/User');

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
    const { name, relationship, age, gender, phone } = req.body;

    if (!name || !relationship) {
      return res.status(400).json({
        message: 'Please provide name and relationship'
      });
    }

    const validRelationships = ['spouse', 'child', 'parent', 'sibling', 'other'];
    if (!validRelationships.includes(relationship)) {
      return res.status(400).json({
        message: `Invalid relationship. Must be one of: ${validRelationships.join(', ')}`
      });
    }

    const user = await User.findById(req.user._id);

    // Limit to 10 family members per user
    if (user.familyMembers.length >= 10) {
      return res.status(400).json({
        message: 'Maximum 10 family members allowed'
      });
    }

    user.familyMembers.push({
      name: name.trim(),
      relationship,
      age: age || null,
      gender: gender || 'other',
      phone: phone || ''
    });

    await user.save();

    // Return the newly added member (last in array)
    const newMember = user.familyMembers[user.familyMembers.length - 1];

    res.status(201).json({
      message: 'Family member added successfully',
      familyMember: newMember
    });
  } catch (error) {
    console.error('Add family member error:', error.message);
    res.status(500).json({ message: 'Error adding family member' });
  }
};

// ============================================
// UPDATE FAMILY MEMBER
// ============================================
const updateFamilyMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, relationship, age, gender, phone } = req.body;

    const user = await User.findById(req.user._id);

    const member = user.familyMembers.id(id);
    if (!member) {
      return res.status(404).json({ message: 'Family member not found' });
    }

    // Update fields if provided
    if (name) member.name = name.trim();
    if (relationship) {
      const validRelationships = ['spouse', 'child', 'parent', 'sibling', 'other'];
      if (!validRelationships.includes(relationship)) {
        return res.status(400).json({
          message: `Invalid relationship. Must be one of: ${validRelationships.join(', ')}`
        });
      }
      member.relationship = relationship;
    }
    if (age !== undefined) member.age = age;
    if (gender) member.gender = gender;
    if (phone !== undefined) member.phone = phone;

    await user.save();

    res.json({
      message: 'Family member updated successfully',
      familyMember: member
    });
  } catch (error) {
    console.error('Update family member error:', error.message);
    res.status(500).json({ message: 'Error updating family member' });
  }
};

// ============================================
// DELETE FAMILY MEMBER
// ============================================
const deleteFamilyMember = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(req.user._id);

    const member = user.familyMembers.id(id);
    if (!member) {
      return res.status(404).json({ message: 'Family member not found' });
    }

    member.deleteOne();
    await user.save();

    res.json({ message: 'Family member removed successfully' });
  } catch (error) {
    console.error('Delete family member error:', error.message);
    res.status(500).json({ message: 'Error removing family member' });
  }
};

module.exports = {
  getFamilyMembers,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember
};
