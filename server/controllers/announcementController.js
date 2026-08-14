// ============================================
// Announcement Controller
// ============================================
// Admins manage announcements; any logged-in user fetches the ones relevant
// to their role to show as a dashboard banner.

const Announcement = require('../models/Announcement');

// ============================================
// GET MY ANNOUNCEMENTS - active ones for the current user's role
// ============================================
// Endpoint: GET /api/announcements   (any logged-in user)
const getMyAnnouncements = async (req, res) => {
  try {
    // Match announcements for everyone, plus the ones targeted at this role.
    const audienceValues = ['all'];
    if (req.user.role === 'doctor') audienceValues.push('doctors');
    if (req.user.role === 'patient') audienceValues.push('patients');

    const announcements = await Announcement.find({
      active: true,
      audience: { $in: audienceValues }
    })
      .sort({ createdAt: -1 })
      .select('title message createdAt');

    res.json({ announcements });
  } catch (error) {
    console.error('Get announcements error:', error.message);
    res.status(500).json({ message: 'Error fetching announcements' });
  }
};

// ============================================
// ADMIN: List ALL announcements (active + inactive)
// ============================================
// Endpoint: GET /api/announcements/all
const getAllAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    res.json({ announcements });
  } catch (error) {
    console.error('Get all announcements error:', error.message);
    res.status(500).json({ message: 'Error fetching announcements' });
  }
};

// ============================================
// ADMIN: Create an announcement
// ============================================
// Endpoint: POST /api/announcements   Body: { title, message, audience }
const createAnnouncement = async (req, res) => {
  try {
    const { title, message, audience } = req.body;
    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const announcement = await Announcement.create({
      title: title.trim(),
      message: message.trim(),
      audience: ['doctors', 'patients', 'all'].includes(audience) ? audience : 'all',
      createdBy: req.user._id
    });

    res.status(201).json({ message: 'Announcement created', announcement });
  } catch (error) {
    console.error('Create announcement error:', error.message);
    res.status(500).json({ message: 'Error creating announcement' });
  }
};

// ============================================
// ADMIN: Toggle active / update an announcement
// ============================================
// Endpoint: PUT /api/announcements/:id   Body: { active?, title?, message?, audience? }
const updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    const { active, title, message, audience } = req.body;
    if (typeof active === 'boolean') announcement.active = active;
    if (title != null) announcement.title = title.trim();
    if (message != null) announcement.message = message.trim();
    if (audience && ['doctors', 'patients', 'all'].includes(audience)) announcement.audience = audience;

    await announcement.save();
    res.json({ message: 'Announcement updated', announcement });
  } catch (error) {
    console.error('Update announcement error:', error.message);
    res.status(500).json({ message: 'Error updating announcement' });
  }
};

// ============================================
// ADMIN: Delete an announcement
// ============================================
// Endpoint: DELETE /api/announcements/:id
const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    res.json({ message: 'Announcement deleted' });
  } catch (error) {
    console.error('Delete announcement error:', error.message);
    res.status(500).json({ message: 'Error deleting announcement' });
  }
};

module.exports = {
  getMyAnnouncements,
  getAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
};
