// ============================================
// Family member rules — shared by the patient's own Family tab and the
// admin "Help patient" tool. Each helper works on a loaded User document and
// throws FamilyError(status, message) for a user-facing problem. The caller
// saves the document.
// ============================================

const VALID_RELATIONSHIPS = ['spouse', 'child', 'parent', 'sibling', 'other'];
const VALID_GENDERS = ['male', 'female', 'other'];
const MAX_MEMBERS = 10;

class FamilyError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const checkRelationship = (relationship) => {
  if (!VALID_RELATIONSHIPS.includes(relationship)) {
    throw new FamilyError(400, `Invalid relationship. Must be one of: ${VALID_RELATIONSHIPS.join(', ')}`);
  }
};

function addMember(user, { name, relationship, age, gender, phone } = {}) {
  if (!name || !String(name).trim() || !relationship) {
    throw new FamilyError(400, 'Please provide name and relationship');
  }
  checkRelationship(relationship);
  if (user.familyMembers.length >= MAX_MEMBERS) {
    throw new FamilyError(400, `Maximum ${MAX_MEMBERS} family members allowed`);
  }
  user.familyMembers.push({
    name: String(name).trim(),
    relationship,
    age: age || null,
    gender: VALID_GENDERS.includes(gender) ? gender : 'other',
    phone: phone || ''
  });
  return user.familyMembers[user.familyMembers.length - 1];
}

function updateMember(user, id, { name, relationship, age, gender, phone } = {}) {
  const member = user.familyMembers.id(id);
  if (!member) throw new FamilyError(404, 'Family member not found');
  if (name) member.name = String(name).trim();
  if (relationship) {
    checkRelationship(relationship);
    member.relationship = relationship;
  }
  if (age !== undefined) member.age = age;
  if (gender) member.gender = gender;
  if (phone !== undefined) member.phone = phone;
  return member;
}

function removeMember(user, id) {
  const member = user.familyMembers.id(id);
  if (!member) throw new FamilyError(404, 'Family member not found');
  member.deleteOne();
}

module.exports = { addMember, updateMember, removeMember, FamilyError, VALID_RELATIONSHIPS };
