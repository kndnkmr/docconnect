import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function BottomNav() {
  const { isAuthenticated, isDoctor, isPatient } = useAuth();
  const location = useLocation();

  // Which Dashboard tab (if any) the current URL points to — used to tell
  // the doctor's 4 tab-based links apart, since they all share the same
  // /dashboard path and only differ by ?tab=.
  const currentTab = new URLSearchParams(location.search).get('tab') || 'appointments';

  const isActive = (item) => {
    if (item.tab) return location.pathname === '/dashboard' && currentTab === item.tab;
    return location.pathname === item.path;
  };

  // A logged-in doctor doesn't need the patient-facing Home/Find Doctors/Blog
  // links — their daily work is appointments, profile, availability, and
  // patient reports, so those get the 4 slots instead.
  const navItems = isDoctor
    ? [
        { path: '/dashboard', tab: 'appointments', icon: '📋', label: 'Appointments' },
        { path: '/dashboard?tab=profile', tab: 'profile', icon: '👤', label: 'Profile' },
        { path: '/dashboard?tab=availability', tab: 'availability', icon: '🕐', label: 'Availability' },
        { path: '/dashboard?tab=patientReports', tab: 'patientReports', icon: '📄', label: 'Reports' },
      ]
    // A logged-in patient's daily needs are their own appointments,
    // prescriptions, and reports — not browsing/searching doctors or the
    // blog. Those still live one tap away via "+ Book New Appointment" on
    // the Appointments tab, same as doctors losing their browse links.
    : isPatient
    ? [
        { path: '/dashboard', tab: 'appointments', icon: '📋', label: 'Appointments' },
        { path: '/dashboard?tab=prescriptions', tab: 'prescriptions', icon: '💊', label: 'Prescriptions' },
        { path: '/dashboard?tab=reports', tab: 'reports', icon: '📄', label: 'Reports' },
        { path: '/dashboard?tab=account', tab: 'account', icon: '👤', label: 'Account' },
      ]
    // Fallback for any other authenticated role (currently just admin) —
    // keeps the original browse-oriented layout since admins aren't
    // booking/managing their own appointments.
    : isAuthenticated
    ? [
        { path: '/', icon: '🏠', label: 'Home' },
        { path: '/doctors', icon: '🔍', label: 'Doctors' },
        // Admin's "work" area is the Admin Panel, not the generic dashboard.
        { path: '/admin', icon: '🛠️', label: 'Admin' },
        { path: '/blog', icon: '📝', label: 'Blog' },
      ]
    : [
        { path: '/', icon: '🏠', label: 'Home' },
        { path: '/doctors', icon: '🔍', label: 'Doctors' },
        { path: '/blog', icon: '📝', label: 'Blog' },
        { path: '/login', icon: '👤', label: 'Login' },
      ];

  return (
    // SOLID white bar (not see-through glass): with glass, a blue/green
    // section behind it tinted the bar and the grey labels faded out (and
    // phone dark modes could turn it dark-on-dark). Solid + dark labels stay
    // readable over any page. Guarded by tests/navContrast.test.mjs — keep
    // the background fully opaque and labels ≥ 4.5:1.
    // pb-[safe-area] keeps the tabs clear of the home indicator.
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.08)] md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-stretch h-16">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className="group flex flex-col items-center justify-center flex-1 h-full"
            >
              {/* Active tab gets a soft pill behind the icon, the icon lifts
                  and scales, and the label turns primary — so the current
                  section reads clearly instead of only a faint colour change. */}
              <span
                className={`flex items-center justify-center w-12 h-7 rounded-full text-lg transition-all duration-200 ${
                  active
                    ? 'bg-primary-100 text-primary-700 -translate-y-0.5 scale-105'
                    : 'text-gray-700 group-hover:text-primary-700 group-active:scale-95'
                }`}
              >
                {item.icon}
              </span>
              <span
                // 12px normally; on very narrow phones (<360px) 11px + tighter
                // letters so "Appointments" / "Prescriptions" don't touch.
                className={`text-xs max-[359px]:text-[11px] max-[359px]:tracking-tighter mt-0.5 whitespace-nowrap leading-tight transition-colors ${
                  active ? 'text-primary-700 font-bold' : 'text-gray-700 font-medium'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
