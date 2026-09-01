import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

function ForDoctors() {
  return (
    <div className="flex-grow flex flex-col">
      <SEO title="For Doctors — How ProMedicoz Works" description="How ProMedicoz works for doctors: keep 100% of your fee (no commission), patients pay you directly via UPI, and consult by video, phone, or in person. Free to join." path="/for-doctors" />

      <div className="container mx-auto px-4 py-8 max-w-3xl">

      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-800">Grow your practice on ProMedicoz</h1>
        <p className="text-gray-600 mt-3 max-w-2xl mx-auto">
          Keep the patients you already have — even when they move cities — reach their families anywhere, and welcome new patients too. Consult online or in person, and keep 100% of your fee. Free to join, no commission.
        </p>
        <Link to="/register?role=doctor" className="inline-block mt-5 bg-primary-600 text-white py-2.5 px-8 rounded-lg hover:bg-primary-700 transition-colors font-medium">
          Join as a Doctor
        </Link>
      </div>

      <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
        {/* Payment — the #1 question doctors ask */}
        <section className="bg-green-50 border border-green-200 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">💰 How you get paid</h2>
          <ul className="space-y-2">
            <li className="flex gap-2"><span>✅</span><span><strong>You keep 100% of your fee.</strong> ProMedicoz charges no commission and takes no cut.</span></li>
            <li className="flex gap-2"><span>✅</span><span><strong>Patients pay you directly.</strong> The payment goes straight to your own UPI ID / QR code — ProMedicoz never collects, holds, or processes any money.</span></li>
            <li className="flex gap-2"><span>✅</span><span><strong>You set your own fee.</strong> Enter your consultation fee in your profile; patients see it before booking.</span></li>
            <li className="flex gap-2"><span>✅</span><span><strong>You confirm the payment.</strong> After a patient pays and taps "I Have Paid" (they can also upload a receipt), you verify it on your side before the consultation.</span></li>
            <li className="flex gap-2"><span>🔒</span><span><strong>Your UPI QR is safe to share.</strong> It can only <em>receive</em> money — it can never be used to withdraw from your account, and it doesn't reveal your bank account number, card, or PIN. It's the same QR you'd show at a shop counter.</span></li>
          </ul>
          <p className="mt-3 text-gray-600">In short: ProMedicoz connects you with patients; the money is always directly between you and the patient.</p>
        </section>

        {/* Keep-your-patients benefit — the most persuasive reason for a
            practising doctor. Framed as retention + reaching their patients'
            families in other cities, not "join a platform". */}
        <section className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">🏠 Your own online clinic — keep the patients you already have</h2>
          <p className="mb-3">
            This isn't just about finding new patients. It's about <strong>not losing the ones you already have</strong>.
            Patients move cities for work, study, or family. Their parents and relatives often live far from you. Today,
            that usually means they stop seeing you and start over with someone new.
          </p>
          <p className="mb-3">
            With your ProMedicoz profile, they don't have to. <strong>A patient of yours in Delhi can have their family in
            Bihar consult you online</strong> — same trusted doctor, no train ticket, no travel for the elderly or unwell.
            You stay their family's doctor, wherever they are.
          </p>
          <ul className="space-y-2 mt-3">
            <li className="flex gap-2"><span>✅</span><span>Keep treating patients who relocate, instead of losing them</span></li>
            <li className="flex gap-2"><span>✅</span><span>Reach your patients' families in other cities — they consult the doctor they already trust</span></li>
            <li className="flex gap-2"><span>✅</span><span>A shareable profile link that works like your personal clinic page, open 24/7</span></li>
          </ul>
          <p className="mt-3 text-gray-600">Once you're set up, share your profile link with your current patients — that alone can bring their whole family to you, online.</p>
        </section>

        {/* How patients reach you */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">How patients find and book you</h2>
          <ol className="list-decimal ml-6 space-y-2">
            <li>Patients search by symptom, specialization, city, or the languages you speak, and see your profile — qualification, experience, fee, and reviews.</li>
            <li>A patient books an available slot from your schedule. You get notified (in-app, and by push/email if enabled).</li>
            <li>You confirm the request. The patient then pays your fee directly via UPI.</li>
            <li>At the appointment time, you consult — by video, phone, or in person, whichever the patient booked.</li>
          </ol>
        </section>

        {/* Consultation flow */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">How a consultation works</h2>
          <p className="mb-3">Each appointment moves through simple steps, and the dashboard guides you at every stage:</p>
          <ol className="list-decimal ml-6 space-y-2">
            <li><strong>Confirm</strong> the appointment request.</li>
            <li><strong>Mark Paid</strong> once you've received the patient's payment on your UPI.</li>
            <li><strong>Join Call</strong> for a video or phone consultation — a private, secure call opens inside ProMedicoz at the slot time (no separate app or login needed). For an in-person visit, you simply see the patient at your clinic.</li>
            <li><strong>Mark Complete</strong> when the consultation is done.</li>
            <li><strong>Write a prescription</strong> — the patient sees it instantly in their account. Prescriptions and notes are written in English.</li>
          </ol>
          <p className="mt-3 text-gray-600">You can also chat with the patient in-app for the appointment, and share medical reports both ways.</p>
        </section>

        {/* Getting started */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Getting started takes a few minutes</h2>
          <ol className="list-decimal ml-6 space-y-2">
            <li><strong>Register</strong> with your name, email, and phone.</li>
            <li><strong>Verify your email</strong> (please check your spam folder — new-domain emails sometimes land there — mark it "Not spam" and click Verify).</li>
            <li><strong>Complete your profile</strong>: specialization, qualification, medical registration number, experience, consultation fee, clinic address, UPI ID / QR code, and the languages you consult in.</li>
            <li><strong>Set your availability</strong> so patients can book slots.</li>
          </ol>
          <p className="mt-3 text-gray-600">Once your profile is complete and verified, you become visible to patients and start receiving bookings.</p>
        </section>

        {/* What you need */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Who can join</h2>
          <p>Registered medical practitioners with a valid medical license (registered with the National Medical Commission or a State Medical Council). You practise independently — ProMedicoz is a platform that connects you with patients, not your employer. See our <Link to="/terms" className="text-primary-600 hover:underline">Terms</Link> and <Link to="/medical-disclaimer" className="text-primary-600 hover:underline">Medical Disclaimer</Link>.</p>
        </section>

        {/* FAQ — leads with the two objections doctors raise most: losing
            existing patients, and why it's free. Written to reassure. */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Doctors' most common questions</h2>
          <div className="space-y-3">
            <details className="bg-white border border-gray-200 rounded-xl p-4 group">
              <summary className="font-medium text-gray-800 cursor-pointer list-none flex justify-between items-center">
                <span>Will I lose my existing patients if I join?</span>
                <span className="text-primary-600 group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              <p className="text-gray-600 mt-3">
                The opposite — it helps you <strong>keep</strong> them. Your existing patients stay yours and keep visiting exactly as before. But when one of them moves to another city, or their family lives far away, they no longer have to leave you for a local doctor: they can consult you online and remain your patient. So a patient of yours in Delhi can have their family in Bihar consult you too — the doctor they already trust — without anyone travelling. On top of that, <strong>new</strong> patients searching online can now discover you, see your qualifications and reviews, and book you. Think of it as a second, always-open front door to your practice — and a way to hold on to patients you'd otherwise lose to distance. You also get a shareable profile link to send your current patients so they (and their families anywhere) can book you easily.
              </p>
            </details>

            <details className="bg-white border border-gray-200 rounded-xl p-4 group">
              <summary className="font-medium text-gray-800 cursor-pointer list-none flex justify-between items-center">
                <span>Why is it free? What's the catch?</span>
                <span className="text-primary-600 group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              <p className="text-gray-600 mt-3">
                There's no catch. ProMedicoz takes <strong>no commission and charges you nothing</strong> — you keep 100% of every consultation fee, paid to you directly by the patient via your own UPI. The big platforms take a cut of your earnings or charge listing fees, which quietly eats into what you make and pushes you to raise your prices. We deliberately don't do that. Keeping the platform free lets you keep your fees affordable, which brings you more patients — and that's the whole point: help good doctors reach more people, not tax them for it.
              </p>
            </details>

            <details className="bg-white border border-gray-200 rounded-xl p-4 group">
              <summary className="font-medium text-gray-800 cursor-pointer list-none flex justify-between items-center">
                <span>How do I get paid?</span>
                <span className="text-primary-600 group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              <p className="text-gray-600 mt-3">
                Directly and fully. The patient pays your fee straight to your UPI ID / QR code — ProMedicoz never touches, holds, or delays the money. You set your own fee, and you confirm the payment on your side before the consultation. There's nothing to withdraw and no settlement wait.
              </p>
            </details>

            <details className="bg-white border border-gray-200 rounded-xl p-4 group">
              <summary className="font-medium text-gray-800 cursor-pointer list-none flex justify-between items-center">
                <span>Is my personal number and data safe?</span>
                <span className="text-primary-600 group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              <p className="text-gray-600 mt-3">
                Yes. You choose what patients see. Your login phone number is not shown publicly — a WhatsApp number only appears on your profile if you deliberately add one as a contact option, and you can leave it out. Patient conversations happen through the in-app chat and calls. See our <Link to="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link> for how data is handled.
              </p>
            </details>

            <details className="bg-white border border-gray-200 rounded-xl p-4 group">
              <summary className="font-medium text-gray-800 cursor-pointer list-none flex justify-between items-center">
                <span>Do I have to be available all the time?</span>
                <span className="text-primary-600 group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              <p className="text-gray-600 mt-3">
                No. You set your own weekly availability — only the days and hours you choose. Patients can only book the slots you've opened, and you confirm each appointment before it's final. It fits around your existing clinic hours, not the other way around.
              </p>
            </details>

            <details className="bg-white border border-gray-200 rounded-xl p-4 group">
              <summary className="font-medium text-gray-800 cursor-pointer list-none flex justify-between items-center">
                <span>Can I leave whenever I want?</span>
                <span className="text-primary-600 group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              <p className="text-gray-600 mt-3">
                Anytime. There's no lock-in, no contract, and no fee. You can deactivate your profile or delete your account whenever you like. Since it costs you nothing and only brings you additional patients, there's really nothing to lose by trying it.
              </p>
            </details>
          </div>
        </section>
      </div>
      </div>

      {/* Full-width closing CTA band — flows straight into the footer instead
          of leaving a floating pale card in white space above the black
          footer. Mirrors the Home page's bottom CTA band for a consistent,
          finished look. */}
      <section className="py-12 bg-primary-700 text-white flex-grow flex flex-col justify-center">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-2">Ready to join?</h2>
          <p className="text-primary-100 mb-6 max-w-xl mx-auto">Free to join, no commission, you keep your full fee.</p>
          <Link to="/register?role=doctor" className="bg-white text-primary-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block">Join as a Doctor</Link>
          <p className="text-primary-100 text-sm mt-5">Questions first? Email <a href="mailto:support@promedicoz.in" className="underline hover:text-white">support@promedicoz.in</a></p>
        </div>
      </section>
    </div>
  );
}

export default ForDoctors;
