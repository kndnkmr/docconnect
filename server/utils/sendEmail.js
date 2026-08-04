// ============================================
// Email Utility - Send emails using Resend
// ============================================
// Resend = a simple email API (free: 100 emails/day)
// We use it to notify doctors when appointments are booked.
//
// Setup: Sign up at https://resend.com → get API key → add to .env

const { Resend } = require('resend');

// Initialize Resend with API key from environment variable
const resend = new Resend(process.env.RESEND_API_KEY);

// Sender email — Resend free tier only allows sending from onboarding@resend.dev
// OR from a verified domain. We'll use their default for now.
const FROM_EMAIL = process.env.FROM_EMAIL || 'DocConnect <onboarding@resend.dev>';

// ============================================
// Send email function
// ============================================
const sendEmail = async ({ to, subject, html }) => {
  try {
    // Skip if no API key configured (app still works, just no emails)
    if (!process.env.RESEND_API_KEY) {
      console.log('Email skipped (RESEND_API_KEY not set):', { to, subject });
      return { success: false, reason: 'No API key' };
    }

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html
    });

    console.log('Email sent:', { to, subject, id: result.data?.id });
    return { success: true, id: result.data?.id };

  } catch (error) {
    console.error('Email send error:', error.message);
    // Don't throw — email failure shouldn't break the booking
    return { success: false, error: error.message };
  }
};

// ============================================
// Email templates
// ============================================

const sendAppointmentNotification = async (doctor, patient, appointment) => {
  const subject = `New Appointment Request — DocConnect`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">🏥 DocConnect</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #1f2937; margin-top: 0;">New Appointment Request</h2>
        <p style="color: #4b5563;">Hi Dr. ${doctor.name},</p>
        <p style="color: #4b5563;">A new appointment has been booked with you:</p>
        
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #374151;"><strong>Patient:</strong> ${patient.name}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Phone:</strong> ${patient.phone || 'Not provided'}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Date:</strong> ${new Date(appointment.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Time:</strong> ${appointment.timeSlot}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Type:</strong> ${appointment.consultationType}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Reason:</strong> ${appointment.reason}</p>
        </div>

        <p style="color: #4b5563;">Please log in to your dashboard to <strong>confirm</strong> or <strong>reject</strong> this appointment.</p>
        
        <a href="https://docconnect-mocha.vercel.app/login" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 12px;">
          Go to Dashboard
        </a>

        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          This is an automated notification from DocConnect. Do not reply to this email.
        </p>
      </div>
    </div>
  `;

  // Only send if doctor has an email
  if (doctor.email) {
    return await sendEmail({ to: doctor.email, subject, html });
  } else {
    console.log('Doctor has no email, notification skipped:', doctor.name);
    return { success: false, reason: 'No doctor email' };
  }
};

const sendAppointmentConfirmation = async (patient, doctor, appointment) => {
  const subject = `Appointment Confirmed — Dr. ${doctor.name}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #16a34a; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">✓ Appointment Confirmed</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="color: #4b5563;">Hi ${patient.name},</p>
        <p style="color: #4b5563;">Great news! Your appointment has been confirmed:</p>
        
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #374151;"><strong>Doctor:</strong> Dr. ${doctor.name} (${doctor.specialization || 'General'})</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Date:</strong> ${new Date(appointment.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Time:</strong> ${appointment.timeSlot}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Type:</strong> ${appointment.consultationType}</p>
          ${appointment.meetingLink ? `<p style="margin: 4px 0; color: #374151;"><strong>Meeting Link:</strong> <a href="${appointment.meetingLink}">${appointment.meetingLink}</a></p>` : ''}
          ${doctor.consultationFee ? `<p style="margin: 4px 0; color: #374151;"><strong>Fee:</strong> ₹${doctor.consultationFee}</p>` : ''}
        </div>

        <p style="color: #4b5563;">Please log in to your dashboard to make the payment and view details.</p>
        
        <a href="https://docconnect-mocha.vercel.app/login" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 12px;">
          Go to Dashboard
        </a>

        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          This is an automated notification from DocConnect.
        </p>
      </div>
    </div>
  `;

  if (patient.email) {
    return await sendEmail({ to: patient.email, subject, html });
  } else {
    console.log('Patient has no email, confirmation skipped:', patient.name);
    return { success: false, reason: 'No patient email' };
  }
};

module.exports = { sendEmail, sendAppointmentNotification, sendAppointmentConfirmation };
