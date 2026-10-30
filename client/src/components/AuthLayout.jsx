// ============================================
// AuthLayout - Shared split-panel shell for Login / Register
// ============================================
// A modern two-column auth layout:
//   - Left (desktop only): on-brand gradient panel with the ProMedicoz name
//     and a few honest trust points. Gives the auth pages a warm, confident
//     first impression instead of a bare form floating on grey.
//   - Right: the actual form (passed in as children), unchanged in behaviour.
//
// On mobile the brand panel is hidden and the form centers exactly as before,
// so nothing about the small-screen experience regresses. This component is
// purely presentational — it holds no auth logic.

import { Link } from 'react-router-dom';

// Default trust points (patient-oriented). A page can pass its own via the
// `points` prop (e.g. the doctor-join flow could emphasise different things).
const DEFAULT_POINTS = [
  { icon: '✅', title: 'Verified doctors', desc: 'Every doctor’s credentials are checked before they can consult.' },
  { icon: '🧾', title: 'Fair, honest fees', desc: 'Pay the doctor directly — no hidden platform commission.' },
  { icon: '📱', title: 'Video, phone or in-person', desc: 'Consult the way that suits you, from anywhere in India.' },
  { icon: '🔒', title: 'Private & secure', desc: 'Your health details are used only for your care. ProMedicoz never sells or shares them.' },
];

function AuthLayout({ title, subtitle, children, points = DEFAULT_POINTS, side = 'left' }) {
  const brandPanel = (
    <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 text-white p-10 xl:p-14 flex-col justify-between relative overflow-hidden">
      {/* Soft decorative blobs — subtle depth, pure CSS, no images to load. */}
      <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-2xl" aria-hidden="true" />
      <div className="absolute -bottom-20 -left-10 w-72 h-72 bg-white/5 rounded-full blur-2xl" aria-hidden="true" />

      <div className="relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-xl font-bold tracking-tight">
          <span className="text-2xl">🩺</span> ProMedicoz
        </Link>
        <p className="text-primary-100 mt-2 text-sm">Find the right doctor &amp; book instantly.</p>
      </div>

      <ul className="relative z-10 space-y-5 my-10">
        {points.map((p) => (
          <li key={p.title} className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0 leading-none">{p.icon}</span>
            <div>
              <p className="font-semibold leading-snug">{p.title}</p>
              <p className="text-primary-100 text-sm leading-snug mt-0.5">{p.desc}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="relative z-10 text-primary-200 text-xs">
        Trusted by patients and doctors across India.
      </p>
    </div>
  );

  return (
    <div className="min-h-[85vh] flex">
      {side === 'left' && brandPanel}

      {/* Form column — centers the form; on mobile this is the whole screen. */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">{title}</h1>
            {subtitle && <p className="text-gray-600 mt-2">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>

      {side === 'right' && brandPanel}
    </div>
  );
}

export default AuthLayout;
