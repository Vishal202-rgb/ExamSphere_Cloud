import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { logout } from '../../store/slices/authSlice.js';
import api from '../../services/api.js';
import {
  GraduationCap,
  LogOut,
  User,
  TrendingUp,
} from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell.jsx';

export default function Navbar({ title, roleBadge }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      delete api.defaults.headers.common.Authorization;
      dispatch(logout());
      navigate('/login', { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#0F172A]/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Brand / Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 font-bold text-lg text-white">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/20">
            <GraduationCap className="w-5 h-5" />
          </div>
          <span className="hidden sm:inline tracking-tight font-extrabold text-white">
            ExamSphere
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800 mx-2 hidden sm:block"></div>

        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
          {roleBadge && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">
              {roleBadge}
            </span>
          )}
        </div>
      </div>

      {/* Middle: Student Portal Quick Nav */}
      {user?.role === 'STUDENT' && (
        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
          <Link
            to="/student"
            className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
          >
            My Exams
          </Link>
          <Link
            to="/student/results"
            className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
          >
            Published Results
          </Link>
          <Link
            to="/student/analytics"
            className="px-3 py-1.5 rounded-lg text-blue-400 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition flex items-center gap-1.5"
          >
            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
            <span>My Analytics</span>
          </Link>
        </div>
      )}

      {/* Right: User Profile & Actions */}
      <div className="flex items-center gap-3">
        {/* Real-time Notification Bell */}
        <NotificationBell />

        <div className="hidden md:flex flex-col text-right">
          <span className="text-xs font-semibold text-white">{user?.fullName || user?.name || 'User'}</span>
          <span className="text-[11px] text-slate-400">{user?.email}</span>
        </div>

        <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/80 text-slate-200">
          <User className="w-4 h-4" />
        </div>

        <div className="h-4 w-px bg-slate-800 mx-1"></div>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 transition"
          title="Sign out of session"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
