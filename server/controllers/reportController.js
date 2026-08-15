// ============================================
// Report Controller - Patient uploads, doctor views
// ============================================

const MedicalReport = require('../models/MedicalReport');
const { uploadFile } = require('../utils/uploadFile');
const { sendPushToUser } = require('../utils/push');

// Notify the other party the instant a report is uploaded/reviewed/replaced,
// so it "auto appears" for them instead of needing a manual refresh.
// targetUserId = whoever should be notified (the party who DIDN'T just act).
const notifyReportUpdate = (req, report, targetUserId, notification) => {
  try {
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${targetUserId}`).emit('report-updated', {
        reportId: report._id.toString()
      });
    }
    sendPushToUser(targetUserId, notification);
  } catch (error) {
    console.error('notifyReportUpdate error:', error.message);
  }
};

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

    // Store the report file (Cloudinary URL, or base64 fallback)
    const fileUrl = await uploadFile(req.file.buffer, req.file.mimetype, 'promedicoz/reports');

    const report = await MedicalReport.create({
      patient: req.user._id,
      doctor: doctorId,
      appointment: appointmentId || null,
      prescription: prescriptionId || null,
      title,
      description: description || '',
      filePath: fileUrl
    });

    notifyReportUpdate(req, report, doctorId, {
      title: 'New report from a patient',
      body: `${req.user.name} shared a test report with you.`,
      url: '/dashboard?tab=patientReports',
      tag: `report-${report._id}`
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

    notifyReportUpdate(req, report, report.patient.toString(), {
      title: 'Your doctor reviewed your report',
      body: `Dr. ${req.user.name} added a comment on your report.`,
      url: '/dashboard?tab=reports',
      tag: `report-${report._id}`
    });

    res.json({
      message: 'Report reviewed successfully',
      report
    });

  } catch (error) {
    console.error('Review report error:', error.message);
    res.status(500).json({ message: 'Error reviewing report' });
  }
};

// ============================================
// UPDATE REPORT - Patient re-uploads/replaces file
// ============================================
// Endpoint: PUT /api/reports/:id
// Body (form-data): { title, description } + optional new file

const updateReport = async (req, res) => {
  try {
    const report = await MedicalReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Only the patient who uploaded can update
    if (report.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only update your own reports' });
    }

    // Update fields if provided
    if (req.body.title) report.title = req.body.title;
    if (req.body.description !== undefined) report.description = req.body.description;

    // Replace file if new one uploaded
    if (req.file) {
      report.filePath = await uploadFile(req.file.buffer, req.file.mimetype, 'promedicoz/reports');
      // Reset review status since file changed
      report.isReviewed = false;
      report.doctorComment = '';
    }

    await report.save();

    if (req.file) {
      // Only notify the doctor if the file actually changed (isReviewed was
      // reset above) — a plain title/description edit doesn't need a fresh look.
      notifyReportUpdate(req, report, report.doctor.toString(), {
        title: 'Report updated',
        body: `${req.user.name} replaced a report file — it needs another look.`,
        url: '/dashboard?tab=patientReports',
        tag: `report-${report._id}`
      });
    }

    res.json({
      message: 'Report updated successfully',
      report
    });

  } catch (error) {
    console.error('Update report error:', error.message);
    res.status(500).json({ message: 'Error updating report' });
  }
};

module.exports = { uploadReport, getMyReports, reviewReport, updateReport };
