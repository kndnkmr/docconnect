import SEO from '../components/SEO';

function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <SEO title="Privacy Policy" description="Privacy Policy for ProMedicoz - how we collect, use, and protect your personal and health data." path="/privacy" />

      <h1 className="text-3xl font-bold text-gray-800 mb-6">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: August 2026</p>

      <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">1. Information We Collect</h2>
          <p><strong>From Patients:</strong></p>
          <ul className="list-disc ml-6 mt-1 space-y-1">
            <li>Name, email, phone number</li>
            <li>Health information shared during consultations (symptoms, medical history)</li>
            <li>Appointment history and prescriptions</li>
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
            <li><strong>Deletion:</strong> You can delete your account and all associated data from Account Settings</li>
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
            <li><strong>Jitsi Meet:</strong> For video/audio consultations (no recording, end-to-end encryption)</li>
            <li><strong>Resend:</strong> For sending email notifications</li>
            <li><strong>Google Analytics:</strong> For anonymous usage statistics</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">9. Data Retention</h2>
          <p>We retain your data for as long as your account is active. Upon account deletion, all personal data is permanently removed within 30 days. Anonymized analytics data may be retained.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">10. Contact Us</h2>
          <p>For privacy-related queries or to exercise your rights:</p>
          <p className="mt-2">Email: support@promedicoz.in</p>
        </section>
      </div>
    </div>
  );
}

export default PrivacyPolicy;
