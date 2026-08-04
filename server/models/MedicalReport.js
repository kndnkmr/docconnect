// ============================================
// Medical Report Model - Patient uploads test reports
// ============================================
// After doctor recommends tests, patient gets them done
// and uploads the reports here for the doctor to review.

const mongoose = require('mongoose');

const medicalReportSchema = new mongoose.Schema({

  // Who uploaded it
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Patient is required']
  },

  // Which doctor should see it
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Doctor is required']
  },

  // Related appointment (optional)
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  },

  // Related prescription (optional)
  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
    default: null
  },

  // Report title/name
  title: {
    type: String,
    required: [true, 'Report title is required'],
    trim: true
    // e.g., "Blood Test Report", "MRI Scan Results"
  },

  // Description/notes from patient
  description: {
    type: String,
    default: ''
  },

  // Uploaded file path
  filePath: {
    type: String,
    required: [true, 'File is required']
    // Path to uploaded PDF/image: "/uploads/report-abc123.pdf"
  },

  // Doctor's review/comment (after viewing)
  doctorComment: {
    type: String,
    default: ''
  },

  // Has the doctor viewed it?
  isReviewed: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true
});

// Indexes
medicalReportSchema.index({ patient: 1, createdAt: -1 });
medicalReportSchema.index({ doctor: 1, isReviewed: 1 });

const MedicalReport = mongoose.model('MedicalReport', medicalReportSchema);

module.exports = MedicalReport;
