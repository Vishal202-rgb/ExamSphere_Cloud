import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  HelpCircle,
  FileCheck2,
  PlusCircle,
  ChevronRight,
  ShieldCheck,
  BarChart3,
  Code2,
} from 'lucide-react';

export default function FacultySidebar() {
  const navItems = [
    {
      to: '/faculty',
      end: true,
      label: 'Dashboard Overview',
      icon: LayoutDashboard,
      description: 'Assigned courses & student roster',
    },
    {
      to: '/faculty/analytics',
      label: 'Analytics & Reports',
      icon: BarChart3,
      description: 'Question accuracy & score trends',
    },
    {
      to: '/faculty/questions',
      label: 'Question Bank',
      icon: HelpCircle,
      description: 'MCQ, True/False, Descriptive repo',
    },
    {
      to: '/faculty/questions/coding/create',
      label: 'Create Coding Problem',
      icon: Code2,
      description: 'Isolated sandbox assessments',
    },
    {
      to: '/faculty/exams',
      end: true,
      label: 'Examinations',
      icon: FileCheck2,
      description: 'Drafts, live tests & status',
    },
    {
      to: '/faculty/exams/create',
      label: 'Create Exam Wizard',
      icon: PlusCircle,
      description: 'Step-by-step exam scheduler',
    },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-slate-800/80 bg-[#0F172A] p-4 flex flex-col justify-between hidden md:flex">
      <div className="space-y-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3">
            Academic Operations
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

      {/* Security & Access Badge */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] space-y-1">
        <div className="flex items-center justify-between text-slate-200 font-medium">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Role-Based Access
          </span>
          <ShieldCheck className="w-4 h-4 text-blue-400" />
        </div>
        <p className="text-[10px] text-slate-500">
          Faculty Level 2 • Course Scoped
        </p>
      </div>
    </aside>
  );
}
