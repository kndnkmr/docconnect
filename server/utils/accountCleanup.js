// ============================================
// Account Cleanup - enforce the 90-day deletion promise
// ============================================
// When a user deletes their own account (authController.deleteAccount), we
// soft-delete it: isDeleted=true, and tell them "Data will be retained for
// 90 days as per our privacy policy." Nothing previously enforced that -
// this job is what actually makes it true.
//
// IMPORTANT — this does NOT delete the account's appointments, prescriptions,
// or medical reports. Those stay intact: a doctor's consultation history and
// prescriptions for a patient are medical/legal records that should outlive
// an account deletion request, and other patients/doctors may still
// legitimately need to see that an appointment happened. What gets purged is
// the PERSONAL IDENTITY data on the User document itself (name, email,
// phone, photo, address, etc.) — replaced with generic placeholders.
// Anywhere those old records are displayed (e.g. a doctor's past
// appointment list), they'll show "Deleted User" instead of real details.
//
// Runs once on server startup and then every 24 hours (see server.js).
// Safe to run repeatedly - the `name: { $ne: 'Deleted User' }` filter means
// already-anonymized accounts are skipped on later runs.

const User = require('../models/User');

const RETENTION_DAYS = 90;

const purgeExpiredDeletedAccounts = async () => {
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const expired = await User.find({
      isDeleted: true,
      deletedAt: { $ne: null, $lte: cutoff },
      name: { $ne: 'Deleted User' } // skip accounts already anonymized
    });

    if (expired.length === 0) return;

    for (const user of expired) {
      user.name = 'Deleted User';
      // Email has a unique index — use a per-account placeholder instead of
      // clearing it, so multiple anonymized accounts don't collide with each
      // other (and so it carries zero real PII, unlike the "deleted_<time>_"
      // rename that register() does when someone re-signs-up with the same
      // email — that rename still contains the original address).
      user.email = `deleted-${user._id}@deleted.invalid`;
      user.phone = '';
      user.whatsappNumber = '';
      user.upiId = '';
      user.upiQrCode = '';
      user.profilePhoto = '';
      user.clinicAddress = '';
      user.googleMapsLink = '';
      user.bio = '';
      user.medicalRegistrationNo = '';
      user.qualification = '';
      user.familyMembers = [];
      user.blockedPatients = [];
      user.pushSubscriptions = [];
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      user.verificationToken = undefined;
      user.verificationTokenExpire = undefined;
      await user.save({ validateBeforeSave: false });
    }

    console.log(`[account-cleanup] Anonymized ${expired.length} account(s) past the ${RETENTION_DAYS}-day retention window.`);
  } catch (error) {
    console.error('[account-cleanup] Error purging expired deleted accounts:', error.message);
  }
};

module.exports = { purgeExpiredDeletedAccounts, RETENTION_DAYS };
