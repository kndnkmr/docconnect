import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

function AboutUs() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <SEO title="About Us" description="ProMedicoz connects patients across India with verified doctors for video, phone, and in-person consultations — a free platform built to make quality healthcare easy to reach." path="/about" />

      {/* Hero */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-3xl">🏥</span>
          <span className="text-2xl font-bold text-primary-600">ProMedicoz</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-800">Quality healthcare, within everyone's reach</h1>
        <p className="text-gray-600 mt-3 max-w-2xl mx-auto">
          ProMedicoz connects patients across India with verified doctors — by video, phone, or in person — so getting the right care is as simple as booking in a couple of minutes.
        </p>
      </div>

      <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Why we exist</h2>
          <p>
            For most people in India, seeing the right doctor still means long queues, long journeys, and long waits — often just to find out you needed a different specialist. For families in smaller towns and villages, it can be even harder: the specialist you need may be a city away, and it isn't always clear who to trust.
          </p>
          <p className="mt-3">
            ProMedicoz was built to close that gap. We bring verified doctors online so a patient anywhere can find a qualified professional, understand their experience and fees up front, and book a consultation without leaving home — or choose an in-person visit when that's what's needed.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">What we do</h2>
          <ul className="space-y-2">
            <li className="flex gap-2"><span>✅</span><span><strong>Connect you with verified doctors.</strong> Every doctor's qualification, registration, experience, and consultation fee is shown up front, so you can choose with confidence.</span></li>
            <li className="flex gap-2"><span>💬</span><span><strong>Consult your way.</strong> Video, phone, or in-person — you pick the mode that suits you when you book.</span></li>
            <li className="flex gap-2"><span>🗣️</span><span><strong>Care in your language.</strong> You can find doctors by the languages they speak, so you can explain your problem comfortably.</span></li>
            <li className="flex gap-2"><span>📄</span><span><strong>Everything in one place.</strong> Appointments, prescriptions, and medical reports stay together in your account, ready for your next visit.</span></li>
            <li className="flex gap-2"><span>👨‍👩‍👧</span><span><strong>For your whole family.</strong> Add family members and book on their behalf.</span></li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Free for patients and doctors</h2>
          <p>
            ProMedicoz is free to use. We do not charge patients or doctors, and we take no commission. When you consult a doctor, the fee is paid directly to that doctor (for example, via UPI) — ProMedicoz never collects or holds your money. Our role is simply to connect the right patient with the right doctor.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">A platform, not a clinic</h2>
          <p>
            ProMedicoz is an intermediary platform — we do not practise medicine ourselves. The doctors on ProMedicoz are independent, registered practitioners who are responsible for the medical advice they give. This lets patients choose freely and doctors practise independently, while we focus on making that connection safe, simple, and trustworthy. You can read more in our{' '}
            <Link to="/medical-disclaimer" className="text-primary-600 hover:underline">Medical Disclaimer</Link>,{' '}
            <Link to="/terms" className="text-primary-600 hover:underline">Terms</Link>, and{' '}
            <Link to="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Our commitment</h2>
          <p>
            Health is personal, and trust has to be earned. We keep your health information confidential, never use it for advertising, and show only real, honest information about the doctors on our platform. We're building ProMedicoz steadily and carefully — because when it comes to your health, doing it right matters more than doing it fast.
          </p>
        </section>

        {/* CTAs */}
        <section className="bg-primary-50 rounded-xl p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Get started</h2>
          <p className="text-gray-600 mb-4">Find a doctor in minutes, or join us as a practitioner.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/doctors" className="bg-primary-600 text-white py-2 px-6 rounded-lg hover:bg-primary-700 transition-colors font-medium">Find a Doctor</Link>
            <Link to="/register?role=doctor" className="bg-white text-primary-700 border border-primary-200 py-2 px-6 rounded-lg hover:bg-primary-100 transition-colors font-medium">Join as a Doctor</Link>
          </div>
        </section>

        <section className="text-center">
          <p className="text-gray-500">Questions? Reach us at <a href="mailto:support@promedicoz.in" className="text-primary-600 hover:underline">support@promedicoz.in</a></p>
        </section>
      </div>
    </div>
  );
}

export default AboutUs;
