import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  Users2,
  GraduationCap,
  ChevronRight,
  BarChart3,
} from 'lucide-react';

export default function Sidebar() {
  const navItems = [
    {
      to: '/admin',
      end: true,
      label: 'Dashboard Overview',
      icon: LayoutDashboard,
      description: 'KPIs & live platform analytics',
    },
    {
      to: '/admin/analytics',
      label: 'Analytics & Reports',
      icon: BarChart3,
      description: 'Department KPIs & CSV exports',
    },
    {
      to: '/admin/departments',
      label: 'Departments',
      icon: Building2,
      description: 'Academic departments & programs',
    },
    {
      to: '/admin/courses',
      label: 'Courses',
      icon: BookOpen,
      description: 'Syllabus, credits & faculty',
    },
    {
      to: '/admin/faculty',
      label: 'Faculty Management',
      icon: Users2,
      description: 'Instructors & course assignments',
    },
    {
      to: '/admin/students',
      label: 'Student Management',
      icon: GraduationCap,
      description: 'Rosters, CSV import & batches',
    },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-slate-800/80 bg-[#0F172A] p-4 flex flex-col justify-between hidden md:flex">
      <div className="space-y-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3">
            Administration
          </span>
          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600/15 to-purple-600/15 text-white font-semibold border border-blue-500/30 shadow-sm shadow-blue-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`w-4 h-4 transition ${
                            isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition opacity-0 group-hover:opacity-100 ${
                          isActive ? 'opacity-100 text-blue-400' : 'text-slate-500'
                        }`}
                      />
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* System Status Pill */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] space-y-1">
        <div className="flex items-center justify-between text-slate-200 font-medium">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Cloud Engine
          </span>
          <span className="text-[10px] font-mono text-emerald-400 font-semibold">ONLINE</span>
        </div>
        <p className="text-[10px] text-slate-500">PostgreSQL 18 • Redis 7 • BullMQ</p>
      </div>
    </aside>
  );
}
