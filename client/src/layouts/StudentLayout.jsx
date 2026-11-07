import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/common/Navbar.jsx';

export default function StudentLayout() {
  return (
    <div className="min-h-screen bg-deep-navy text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <Navbar title="Student Examination Portal" roleBadge="Student" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-transparent">
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
