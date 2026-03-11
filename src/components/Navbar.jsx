import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationCenter from './NotificationCenter';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <nav className="bg-indigo-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold tracking-tight">
            Attendance Tracker
          </Link>

          {user && (
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="hover:bg-indigo-500 px-3 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </Link>
              <Link
                to="/subjects"
                className="hover:bg-indigo-500 px-3 py-2 rounded-md text-sm font-medium"
              >
                Subjects
              </Link>
              <Link
                to="/attendance"
                className="hover:bg-indigo-500 px-3 py-2 rounded-md text-sm font-medium"
              >
                Mark
              </Link>
              <Link
                to="/history"
                className="hover:bg-indigo-500 px-3 py-2 rounded-md text-sm font-medium"
              >
                History
              </Link>
              <Link
                to="/calculator"
                className="hover:bg-indigo-500 px-3 py-2 rounded-md text-sm font-medium"
              >
                Calculator
              </Link>
              <Link
                to="/analytics"
                className="hover:bg-indigo-500 px-3 py-2 rounded-md text-sm font-medium"
              >
                Analytics
              </Link>

              {/* Notification bell */}
              <NotificationCenter />

              <span className="text-indigo-200 text-sm hidden sm:inline">
                {user.email}
              </span>
              <Link
                to="/profile"
                className="hover:bg-indigo-500 px-3 py-2 rounded-md text-sm font-medium"
              >
                Profile
              </Link>
              <Link
                to="/settings"
                className="hover:bg-indigo-500 px-3 py-2 rounded-md text-sm font-medium"
              >
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="bg-indigo-500 hover:bg-indigo-400 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
