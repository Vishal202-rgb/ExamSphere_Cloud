// ==============================================================================
// ExamSphere – Examination Interface Header Component
// Header bar featuring title, student info, timer, save state, and network status
// ==============================================================================

import React from 'react';
import CountdownTimer from './CountdownTimer.jsx';
import SaveIndicator from './SaveIndicator.jsx';
import NetworkStatus from './NetworkStatus.jsx';
import { User, ShieldCheck } from 'lucide-react';

export default function ExamHeader({
  examTitle = 'Examination',
  courseCode = '',
  courseTitle = '',
  student = null,
  remainingSeconds = 0,
  isExpired = false,
  saveStatus = 'saved',
  lastSavedAt = null,
  isOnline = true,
  onTimerExpire,
}) {
  return (
    <header
      id="exam-header"
      className="sticky top-0 z-40 bg-dark-navy/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3 shadow-lg"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Exam Details & Course */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-slate-950 shadow-md shadow-emerald-500/20">
            ES
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-100 tracking-tight line-clamp-1">
                {examTitle}
              </h1>
              {courseCode && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  {courseCode}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>{courseTitle}</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Proctored Session
              </span>
            </div>
          </div>
        </div>

        {/* Center / Right: Student Info, Status Indicators & Timer */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 justify-between md:justify-end">
          {/* Status indicators */}
          <div className="flex items-center gap-2 bg-slate-900/80 px-2.5 py-1 rounded-xl border border-slate-800">
            <NetworkStatus isOnline={isOnline} />
            <div className="w-px h-4 bg-slate-800" />
            <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
          </div>

          {/* Student Profile Info */}
          {student && (
            <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs shadow-md">
              <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
                {student.name ? student.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="text-left">
                <div className="text-slate-200 font-semibold leading-tight line-clamp-1">
                  {student.name}
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  {student.rollNumber || student.email}
                </div>
              </div>
            </div>
          )}

          {/* Authoritative Countdown Timer */}
          <CountdownTimer
            remainingSeconds={remainingSeconds}
            isExpired={isExpired}
            onExpire={onTimerExpire}
          />
        </div>
      </div>
    </header>
  );
}
