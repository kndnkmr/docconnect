import SEO from '../components/SEO';

function TermsAndConditions() {
  return (
    <div>
      <SEO title="Terms & Conditions" description="Terms and Conditions for using ProMedicoz doctor consultation platform." path="/terms" />

      {/* Gradient header band — consistent with the rest of the app */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-bold">Terms &amp; Conditions</h1>
          <p className="text-primary-100 text-sm mt-1">Last updated: August 2026</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl">

      <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">1. About ProMedicoz</h2>
          <p>ProMedicoz ("Platform") is an online healthcare marketplace that connects patients with registered medical practitioners for consultations. ProMedicoz is an intermediary platform and does NOT provide medical services directly.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">2. Platform Role & Disclaimer</h2>
          <p>ProMedicoz acts solely as an intermediary under Section 79 of the Information Technology Act, 2000. We facilitate connections between patients and doctors but:</p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>We do NOT provide medical advice, diagnosis, or treatment</li>
            <li>We do NOT guarantee the accuracy of information provided by doctors</li>
            <li>We are NOT responsible for the quality of medical services provided by doctors</li>
            <li>Doctors are independent practitioners and NOT employees of ProMedicoz</li>
            <li>We do NOT endorse any specific doctor, treatment, or medication</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">3. Teleconsultation Limitations</h2>
          <p>Online consultations have limitations. Users acknowledge that:</p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Teleconsultation is NOT suitable for medical emergencies — call 112 for emergencies</li>
            <li>Doctors may not be able to fully diagnose without physical examination</li>
            <li>The doctor may recommend an in-person visit when necessary</li>
            <li>Technical issues may interrupt consultations — the doctor will attempt to reconnect</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">4. Doctor Responsibilities</h2>
          <p>Doctors on ProMedicoz represent that they:</p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Hold a valid medical license registered with the National Medical Commission (NMC) or State Medical Council</li>
            <li>Provide accurate information about their qualifications and experience</li>
            <li>Follow the Telemedicine Practice Guidelines (2020) issued by the Board of Governors of MCI</li>
            <li>Maintain patient confidentiality</li>
            <li>Are solely responsible for the medical advice and prescriptions they provide</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">5. Patient Responsibilities</h2>
          <ul className="list-disc ml-6 space-y-1">
            <li>Provide accurate health information to the doctor</li>
            <li>Disclose all relevant medical history, allergies, and current medications</li>
            <li>Not use the platform for emergency medical situations</li>
            <li>Make payments as agreed for consultations</li>
            <li>Treat doctors and staff with respect</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">6. Payments & Platform Fees</h2>
          <p>Consultation fees are set by individual doctors. Payments are made directly from patient to doctor via UPI. ProMedicoz does NOT handle, process, or store any payment transactions. Payment disputes should be resolved directly between patient and doctor.</p>
          <p className="mt-2">ProMedicoz is currently free for doctors and takes no commission on consultations. ProMedicoz reserves the right to introduce a platform fee or subscription in the future to support the operation and maintenance of the platform. Any such charges will be communicated to affected users clearly and with reasonable advance notice before they take effect.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">7. Cancellation, Rescheduling & Refunds</h2>
          <ul className="list-disc ml-6 space-y-1">
            <li>Patients can cancel an appointment before the scheduled time</li>
            <li>Patients can also reschedule a pending or confirmed appointment to another available time with the same doctor; the doctor then re-confirms the new time</li>
            <li>Doctors set their own availability and may mark certain dates as unavailable (e.g. leave/vacation); slots on those dates cannot be booked</li>
            <li>Refund policies are determined by individual doctors</li>
            <li>ProMedicoz is not responsible for refund disputes between doctors and patients</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">8. Reviews & Ratings</h2>
          <ul className="list-disc ml-6 space-y-1">
            <li>Only a patient who has had a completed appointment with a doctor can rate and review that doctor, and only once per appointment</li>
            <li>Reviews reflect the personal opinion of the patient, not the views of ProMedicoz</li>
            <li>The reviewed doctor may post a public reply to a review of their own profile</li>
            <li>ProMedicoz may hide or remove a review that is fake, abusive, defamatory, spam, or otherwise violates these terms</li>
            <li>You must not post false, misleading, or offensive content in a review or reply</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">9. Notifications</h2>
          <p>With your consent, we send appointment-related notifications (such as confirmations, reschedules, reminders before an appointment, messages, and calls) by email and, if you enable it in your browser, as push notifications. You can turn off browser notifications at any time from your browser settings, and email remains available as a fallback. Notifications are a convenience feature — you remain responsible for keeping track of your appointments.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">10. Account Termination</h2>
          <p>ProMedicoz reserves the right to suspend or terminate accounts that violate these terms, provide false information, engage in abusive behavior, or misuse the platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">11. Limitation of Liability</h2>
          <p>ProMedicoz shall not be liable for any direct, indirect, incidental, or consequential damages arising from the use of this platform, including but not limited to medical outcomes, payment disputes, or service interruptions.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">12. Governing Law</h2>
          <p>These terms shall be governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in India.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">13. Grievance Officer</h2>
          <p>For any complaints or concerns regarding the platform, contact:</p>
          <p className="mt-2">Email: support@promedicoz.in</p>
          <p>Response time: Within 48 hours on working days</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">14. Changes to Terms</h2>
          <p>ProMedicoz reserves the right to modify these terms at any time. Users will be notified of significant changes. Continued use of the platform after changes constitutes acceptance.</p>
        </section>
      </div>
      </div>
    </div>
  );
}

export default TermsAndConditions;
