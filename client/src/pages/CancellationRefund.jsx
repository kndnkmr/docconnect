import SEO from '../components/SEO';

function CancellationRefund() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <SEO title="Cancellation & Refund Policy" description="Cancellation and refund policy for ProMedicoz. Payments are made directly to the doctor via UPI; ProMedicoz does not collect or hold any money." path="/cancellation-refund" />

      <h1 className="text-3xl font-bold text-gray-800 mb-6">Cancellation &amp; Refund Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: August 2026</p>

      {/* Most important fact up front — the platform handles no money */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <p className="text-blue-800 text-sm font-medium">
          ProMedicoz does not collect, hold, or process any payments. Consultation fees are paid directly by the patient to the doctor (for example, via UPI). ProMedicoz is a free platform and takes no money or commission from patients or doctors.
        </p>
      </div>

      <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">1. Cancelling an Appointment</h2>
          <p>You can cancel an appointment from your dashboard before the scheduled consultation time. To cancel, open the appointment and choose "Cancel", optionally adding a reason. Once cancelled, that time slot becomes available for other patients to book.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">2. How Payments Work</h2>
          <p>Because ProMedicoz never handles money, there is nothing for the platform to refund. Each doctor sets their own consultation fee and receives it directly from the patient. Any payment you make goes straight to the doctor, not to ProMedicoz.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">3. Refunds</h2>
          <ul className="list-disc ml-6 space-y-1">
            <li>Any refund is handled directly between the patient and the doctor, because the payment was made directly to the doctor.</li>
            <li>Each doctor sets their own refund terms (for example, for a cancellation made well in advance, or a consultation the doctor could not attend).</li>
            <li>ProMedicoz does not process refunds and is not a party to any payment or refund between a patient and a doctor.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">4. If a Doctor Cannot Attend</h2>
          <p>If a doctor is unable to attend a confirmed consultation, they may reschedule with you or arrange a refund of any amount you paid them directly, per their own terms. If you have trouble reaching a doctor about a payment made to them, you can contact us and we will try to help facilitate communication — though the payment itself was between you and the doctor.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">5. Payment Disputes</h2>
          <p>Since payments are made directly from patient to doctor, any payment dispute should be resolved directly between the two parties. ProMedicoz is an intermediary platform and does not hold funds, so it cannot reverse a payment. We can, however, be contacted to assist with communication.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">6. Contact</h2>
          <p>For any questions about cancellations or a payment made to a doctor:</p>
          <p className="mt-2">Email: support@promedicoz.in</p>
          <p>Response time: within 48 hours on working days</p>
        </section>
      </div>
    </div>
  );
}

export default CancellationRefund;
