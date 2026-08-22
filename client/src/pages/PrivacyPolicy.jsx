import SEO from '../components/SEO';

function PrivacyPolicy() {
  return (
    <div>
      <SEO title="Privacy Policy" description="Privacy Policy for ProMedicoz - how we collect, use, and protect your personal and health data." path="/privacy" />

      {/* Gradient header band — consistent with the rest of the app */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-bold">Privacy Policy</h1>
          <p className="text-primary-100 text-sm mt-1">Last updated: August 2026</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl">

      <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">1. Information We Collect</h2>
          <p><strong>From Patients:</strong></p>
          <ul className="list-disc ml-6 mt-1 space-y-1">
            <li>Name, email, phone number</li>
            <li>Health information shared during consultations (symptoms, medical history)</li>
            <li>Optional medical profile information you choose to provide: blood group, known allergies, current medications, medical history, emergency contact, and insurance details — used to give your doctor useful context before/during a visit</li>
            <li>Appointment history, prescriptions, and uploaded test reports</li>
            <li>Payment screenshots (if uploaded)</li>
          </ul>
          <p className="mt-3"><strong>From Doctors:</strong></p>
          <ul className="list-disc ml-6 mt-1 space-y-1">
            <li>Name, email, phone number</li>
            <li>Professional qualifications, medical registration number</li>
            <li>Clinic address, consultation fees</li>
            <li>UPI QR code for payments</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">2. How We Use Your Information</h2>
          <ul className="list-disc ml-6 space-y-1">
            <li>To facilitate appointment booking and consultations</li>
            <li>To display doctor profiles to patients</li>
            <li>To send appointment notifications via email</li>
            <li>To improve our platform and services</li>
            <li>To comply with legal requirements</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">3. Data Sharing</h2>
          <p>We do NOT sell, rent, or trade your personal information. Data is shared only:</p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Between doctor and patient within the context of their appointment</li>
            <li>With service providers (email delivery, hosting) who process data on our behalf</li>
            <li>When required by law or court order</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">4. Data Storage & Security</h2>
          <ul className="list-disc ml-6 space-y-1">
            <li>Data is stored on secure cloud servers (MongoDB Atlas, Render)</li>
            <li>Passwords are hashed using bcrypt (never stored in plain text)</li>
            <li>All communication is encrypted via HTTPS</li>
            <li>Access to database is restricted to authorized personnel only</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">5. Health Data</h2>
          <p>Health information (symptoms, prescriptions, medical reports) is treated with highest confidentiality. This data is:</p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Only accessible to the patient and their consulted doctor</li>
            <li>Never used for advertising or marketing purposes</li>
            <li>Never shared with third parties without explicit consent</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">6. Your Rights</h2>
          <ul className="list-disc ml-6 space-y-1">
            <li><strong>Access:</strong> You can view all your data from your dashboard</li>
            <li><strong>Correction:</strong> You can update your profile information anytime</li>
            <li><strong>Deletion:</strong> You can delete your account from Account Settings — this immediately hides your profile and blocks login. Your personal details (name, email, phone, photo) are permanently anonymized after a 90-day grace period. Appointment, prescription, and medical report records are retained beyond that as required for medical and legal record-keeping, but are no longer linked to identifying personal information</li>
            <li><strong>Portability:</strong> Contact us to receive a copy of your data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">7. Cookies & Analytics</h2>
          <p>We use Google Analytics to understand how users interact with our platform. This collects anonymized data about page views and user behavior. No personally identifiable health information is shared with Google.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">8. Third-Party Services</h2>
          <ul className="list-disc ml-6 space-y-1">
            <li><strong>Daily.co:</strong> For video/audio consultations (private per-appointment rooms, no recording)</li>
            <li><strong>Cloudinary:</strong> For secure storage of uploaded images and files (profile photos, payment screenshots, medical reports)</li>
            <li><strong>Resend:</strong> For sending email notifications</li>
            <li><strong>Google Analytics:</strong> For anonymous usage statistics</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">9. Data Retention</h2>
          <p>We retain your data for as long as your account is active. When you delete your account, it's immediately hidden and blocked from logging in. Your personal identifying details (name, email, phone, photo) are automatically and permanently anonymized after a 90-day grace period — this window exists so a mistakenly deleted account can still be recovered by contacting support before that point. Appointment, prescription, and medical report records are retained beyond the 90 days, as required for medical and legal record-keeping, but are no longer linked to your identifying personal information once anonymized. Anonymized analytics data may be retained indefinitely.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">10. Contact Us</h2>
          <p>For privacy-related queries or to exercise your rights:</p>
          <p className="mt-2">Email: support@promedicoz.in</p>
        </section>
      </div>
      </div>
    </div>
  );
}

export default PrivacyPolicy;
