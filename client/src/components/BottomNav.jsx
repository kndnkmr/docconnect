import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function BottomNav() {
  const { isAuthenticated, isDoctor } = useAuth();
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
    : isAuthenticated
    ? [
        { path: '/', icon: '🏠', label: 'Home' },
        { path: '/doctors', icon: '🔍', label: 'Doctors' },
        { path: '/dashboard', icon: '📋', label: 'Appointments' },
        { path: '/blog', icon: '📝', label: 'Blog' },
      ]
    : [
        { path: '/', icon: '🏠', label: 'Home' },
        { path: '/doctors', icon: '🔍', label: 'Doctors' },
        { path: '/blog', icon: '📝', label: 'Blog' },
        { path: '/login', icon: '👤', label: 'Login' },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden">
      <div className="flex justify-around items-center h-14">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center flex-1 h-full ${
              isActive(item)
                ? 'text-primary-600'
                : 'text-gray-500'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-[11px] mt-0.5 font-medium whitespace-nowrap leading-tight">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default BottomNav;
