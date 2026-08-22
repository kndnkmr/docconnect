import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

function HowItWorks() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <SEO title="How It Works — For Patients" description="How ProMedicoz works for patients: find a verified doctor, book a slot, pay the doctor directly via UPI after confirmation, and consult by video, phone, or in person." path="/how-it-works" />

      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-800">How ProMedicoz works</h1>
        <p className="text-gray-600 mt-3 max-w-2xl mx-auto">
          Find the right doctor and consult by video, phone, or in person — in a few simple steps. Signing up and browsing is free.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-5">
          <Link to="/doctors" className="bg-primary-600 text-white py-2.5 px-8 rounded-lg hover:bg-primary-700 transition-colors font-medium">Find a Doctor</Link>
          <Link to="/register" className="bg-white text-primary-700 border border-primary-200 py-2.5 px-8 rounded-lg hover:bg-primary-100 transition-colors font-medium">Create Account</Link>
        </div>
      </div>

      <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
        {/* Steps */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Booking in 4 steps</h2>
          <ol className="list-decimal ml-6 space-y-2">
            <li><strong>Find a doctor.</strong> Search by symptom, specialization, city, or the language you're comfortable in. Each profile shows the doctor's qualification, experience, fee, and patient reviews.</li>
            <li><strong>Book a slot.</strong> Pick a date, an available time, and how you'd like to consult — video, phone, or in person.</li>
            <li><strong>Doctor confirms.</strong> The doctor confirms your request, usually within a few hours. You're notified in the app (and by push/email if you enable it).</li>
            <li><strong>Pay &amp; consult.</strong> After confirmation, pay the doctor's fee and join your consultation at the booked time.</li>
          </ol>
        </section>

        {/* Payment */}
        <section className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">💳 How payment works</h2>
          <ul className="space-y-2">
            <li className="flex gap-2"><span>•</span><span>Signing up and browsing doctors is <strong>free</strong>.</span></li>
            <li className="flex gap-2"><span>•</span><span>You pay only <strong>after the doctor confirms</strong> your appointment.</span></li>
            <li className="flex gap-2"><span>•</span><span>You pay the <strong>doctor directly via UPI</strong> — scan their QR code or use their UPI ID, then tap <strong>"I Have Paid"</strong> (you can also upload a payment receipt).</span></li>
            <li className="flex gap-2"><span>•</span><span>The doctor confirms they received it, and you're set for the consultation. <strong>ProMedicoz never collects or holds your money</strong> and takes no commission.</span></li>
          </ul>
        </section>

        {/* Joining */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Joining your consultation</h2>
          <ul className="list-disc ml-6 space-y-2">
            <li><strong>Video or phone:</strong> at your appointment time, a secure call opens right inside ProMedicoz — no separate app or extra login. You'll get a ringing alert when it's time, and the "Join" button appears on the day of your appointment.</li>
            <li><strong>In person:</strong> visit the doctor's clinic at your booked time (the profile shows the address and a "Get Directions" link).</li>
            <li>After the consultation, your <strong>prescription appears in your account</strong> automatically, and you can upload test reports for the doctor to review.</li>
          </ul>
        </section>

        {/* Extras */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Good to know</h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>You can register with just your <strong>phone number</strong> — email is optional.</li>
            <li>You can <strong>book for family members</strong> from your account.</li>
            <li>You can <strong>cancel</strong> from your dashboard before the appointment; there are no cancellation charges from ProMedicoz.</li>
            <li>In a <strong>medical emergency</strong>, don't use the platform — call 112 or 108, or go to your nearest hospital.</li>
          </ul>
        </section>

        {/* CTA */}
        <section className="bg-primary-50 rounded-xl p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Ready to consult a doctor?</h2>
          <div className="flex flex-wrap justify-center gap-3 mt-3">
            <Link to="/doctors" className="bg-primary-600 text-white py-2.5 px-8 rounded-lg hover:bg-primary-700 transition-colors font-medium">Find a Doctor</Link>
            <Link to="/register" className="bg-white text-primary-700 border border-primary-200 py-2.5 px-8 rounded-lg hover:bg-primary-100 transition-colors font-medium">Create Account</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default HowItWorks;
