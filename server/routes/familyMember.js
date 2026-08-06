// ============================================
// Family Member Routes
// ============================================
// All routes require authentication and patient role.
//
// ENDPOINTS:
//   GET    /api/family-members       → list my family members
//   POST   /api/family-members       → add a family member
//   PUT    /api/family-members/:id   → update a family member
//   DELETE /api/family-members/:id   → remove a family member

const express = require('express');
const router = express.Router();

const {
  getFamilyMembers,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember
} = require('../controllers/familyMemberController');

const { protect, authorize } = require('../middleware/auth');

// All routes require login + patient role
router.use(protect);
router.use(authorize('patient'));

router.get('/', getFamilyMembers);
router.post('/', addFamilyMember);
router.put('/:id', updateFamilyMember);
router.delete('/:id', deleteFamilyMember);

module.exports = router;
