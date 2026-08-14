import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function BottomNav() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navItems = isAuthenticated
    ? [
        { path: '/', icon: '🏠', label: 'Home' },
        { path: '/doctors', icon: '🔍', label: 'Doctors' },
        { path: '/dashboard', icon: '📋', label: 'Bookings' },
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
              isActive(item.path)
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
