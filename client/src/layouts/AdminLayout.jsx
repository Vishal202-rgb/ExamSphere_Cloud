import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import Navbar from '../components/common/Navbar.jsx';
import Sidebar from '../components/common/Sidebar.jsx';
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  Users2,
  GraduationCap,
  BarChart3,
} from 'lucide-react';

export default function AdminLayout() {
  const mobileNav = [
    { to: '/admin', end: true, label: 'Overview', icon: LayoutDashboard },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/admin/departments', label: 'Depts', icon: Building2 },
    { to: '/admin/courses', label: 'Courses', icon: BookOpen },
    { to: '/admin/faculty', label: 'Faculty', icon: Users2 },
    { to: '/admin/students', label: 'Students', icon: GraduationCap },
  ];

  return (
    <div className="min-h-screen bg-deep-navy text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar title="Admin Operations Console" roleBadge="Super Admin" />

      {/* Main Body Shell */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-transparent">
          <div className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0F172A]/95 backdrop-blur-md border-t border-slate-800 flex justify-around p-2">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 p-2 rounded-lg text-[10px] font-medium transition ${
                  isActive
                    ? 'text-blue-400 bg-blue-500/10 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
