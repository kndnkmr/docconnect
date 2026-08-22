import SEO from '../components/SEO';

function MedicalDisclaimer() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <SEO title="Medical Disclaimer" description="Medical Disclaimer for ProMedicoz — the platform connects patients with registered doctors and does not itself provide medical advice." path="/medical-disclaimer" />

      <h1 className="text-3xl font-bold text-gray-800 mb-6">Medical Disclaimer</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: August 2026</p>

      {/* Emergency callout — most important message, kept visually prominent */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
        <p className="text-red-800 text-sm font-medium">
          In a medical emergency, do not use this platform. Call 112 (national emergency number) or 108 (ambulance) immediately, or go to your nearest hospital.
        </p>
      </div>

      <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">1. For Information &amp; Connection Only</h2>
          <p>ProMedicoz is an online platform that connects patients with independent, registered medical practitioners. ProMedicoz itself is not a hospital, clinic, or healthcare provider and does not practise medicine. Nothing on this platform — including doctor profiles, health blog articles, symptom lists, or specialization pages — is itself medical advice, diagnosis, or treatment.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">2. No Substitute for Professional Medical Advice</h2>
          <p>Information available on ProMedicoz is for general awareness and to help you find and reach a doctor. It should never be used as a substitute for the advice of a qualified doctor who has assessed your specific situation. Always seek the guidance of your physician or another qualified health provider with any questions about a medical condition. Never disregard professional medical advice, or delay seeking it, because of something you read on this platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">3. The Doctor Is Responsible for Medical Advice</h2>
          <p>Any diagnosis, advice, prescription, or treatment you receive comes from the individual doctor you consult — not from ProMedicoz. Doctors on the platform are independent practitioners, not employees of ProMedicoz, and are solely responsible for the medical decisions and prescriptions they make. ProMedicoz does not verify, endorse, or take responsibility for the clinical judgment of any doctor.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">4. Limitations of Online Consultation</h2>
          <p>Teleconsultation has inherent limits. A doctor may not be able to reach a complete diagnosis without a physical examination or tests, and may ask you to visit in person. Online consultations follow the Telemedicine Practice Guidelines (2020). Teleconsultation is not appropriate for emergencies — see the notice at the top of this page.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">5. Health Content on This Site</h2>
          <p>Health articles and educational content are provided for general information only. They are not tailored to any individual, may not reflect the most current medical developments, and should not be relied upon to diagnose or treat any condition. Medical content entered by doctors (such as prescriptions and notes) is written by that doctor for that patient and is not reviewed or altered by ProMedicoz.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">6. No Doctor–Patient Relationship With ProMedicoz</h2>
          <p>Using this platform does not create a doctor–patient relationship between you and ProMedicoz. A doctor–patient relationship exists only between you and the individual practitioner you choose to consult.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">7. Questions</h2>
          <p>For any questions about this disclaimer, contact us at:</p>
          <p className="mt-2">Email: support@promedicoz.in</p>
        </section>
      </div>
    </div>
  );
}

export default MedicalDisclaimer;
