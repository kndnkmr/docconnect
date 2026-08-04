// ============================================
// Report Controller - Patient uploads, doctor views
// ============================================

const MedicalReport = require('../models/MedicalReport');

// ============================================
// UPLOAD REPORT - Patient uploads test report
// ============================================
// Endpoint: POST /api/reports
// Body (form-data): { title, description, doctorId, appointmentId, prescriptionId } + file

const uploadReport = async (req, res) => {
  try {
    const { title, description, doctorId, appointmentId, prescriptionId } = req.body;

    if (!title || !doctorId) {
      return res.status(400).json({
        message: 'Title and doctor are required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: 'Please upload a file (PDF or image)'
      });
    }

    const report = await MedicalReport.create({
      patient: req.user._id,
      doctor: doctorId,
      appointment: appointmentId || null,
      prescription: prescriptionId || null,
      title,
      description: description || '',
      filePath: `/uploads/${req.file.filename}`
    });

    res.status(201).json({
      message: 'Report uploaded successfully. Your doctor can now view it.',
      report
    });

  } catch (error) {
    console.error('Upload report error:', error.message);
    res.status(500).json({ message: 'Error uploading report' });
  }
};

// ============================================
// GET MY REPORTS - Patient views their uploaded reports
// ============================================
// Endpoint: GET /api/reports/my

const getMyReports = async (req, res) => {
  try {
    const filter = {};

    if (req.user.role === 'patient') {
      filter.patient = req.user._id;
    } else if (req.user.role === 'doctor') {
      filter.doctor = req.user._id;
    }

    const reports = await MedicalReport.find(filter)
      .populate('patient', 'name email phone')
      .populate('doctor', 'name specialization')
      .sort({ createdAt: -1 });

    res.json({ reports });

  } catch (error) {
    console.error('Get my reports error:', error.message);
    res.status(500).json({ message: 'Error fetching reports' });
  }
};

// ============================================
// DOCTOR REVIEWS REPORT - Doctor adds comment
// ============================================
// Endpoint: PUT /api/reports/:id/review
// Body: { doctorComment }

const reviewReport = async (req, res) => {
  try {
    const { doctorComment } = req.body;

    const report = await MedicalReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    if (report.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only review reports shared with you' });
    }

    report.isReviewed = true;
    report.doctorComment = doctorComment || 'Reviewed';

    await report.save();

    res.json({
      message: 'Report reviewed successfully',
      report
    });

  } catch (error) {
    console.error('Review report error:', error.message);
    res.status(500).json({ message: 'Error reviewing report' });
  }
};

module.exports = { uploadReport, getMyReports, reviewReport };
