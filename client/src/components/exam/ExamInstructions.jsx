// ==============================================================================
// ExamSphere – Examination Instructions Modal Component
// Pre-flight briefing on rules, scoring, palette legend, and integrity pledge
// ==============================================================================

import React, { useState } from 'react';
import {
  FileText,
  Clock,
  Award,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  X,
  Play,
  RotateCw,
} from 'lucide-react';

export default function ExamInstructions({
  isOpen = false,
  onClose,
  exam = null,
  onStartExam,
  isStarting = false,
  isResume = false,
}) {
  const [pledgeChecked, setPledgeChecked] = useState(false);

  if (!isOpen || !exam) return null;

  return (
    <div
      id="exam-instructions-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="instructions-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
    >
      <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                Examination Briefing Protocol
              </span>
              <h2 id="instructions-modal-title" className="text-xl font-extrabold text-white">
                {exam.title}
              </h2>
              <div className="text-xs text-slate-400 mt-0.5">
                {exam.course?.code} — {exam.course?.title}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isStarting}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Examination Parameters Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              Duration
            </span>
            <div className="text-base font-black text-white font-mono mt-1">
              {exam.durationMinutes} mins
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              Total Marks
            </span>
            <div className="text-base font-black text-white font-mono mt-1">
              {exam.totalMarks} pts
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              Questions
            </span>
            <div className="text-base font-black text-white font-mono mt-1">
              {exam.totalQuestions || exam._count?.examQuestions || 'Full Bank'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Neg. Marking
            </span>
            <div className="text-base font-black text-white font-mono mt-1">
              {exam.negativeMarking ? 'Active' : 'None'}
            </div>
          </div>
        </div>

        {/* General Regulations & Rules */}
        <div className="space-y-3 text-xs text-slate-300">
          <h3 className="font-bold text-slate-100 uppercase tracking-wider text-[11px] text-blue-400">
            Important Instructions & Rules
          </h3>
          <ul className="space-y-2 text-slate-300 leading-relaxed list-disc list-inside">
            <li>
              <strong>Server-Authoritative Clock:</strong> The countdown timer is measured on server UTC time. Refreshing your browser or changing device time will not reset or prolong the allotted duration.
            </li>
            <li>
              <strong>Real-Time Autosave:</strong> Your chosen answers and descriptive text are debounced and persisted to PostgreSQL automatically. Always look for the green "Saved" status indicator in the top bar.
            </li>
            <li>
              <strong>Resilience & Recovery:</strong> In the event of an accidental window closure or internet disruption, you may re-enter and resume your examination session at any time before your expiration window lapses.
            </li>
            <li>
              <strong>Color Palette Legend:</strong>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-1 font-mono text-[11px]">
                <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Green: Solved</span>
                </div>
                <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Red: Visited</span>
                </div>
                <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span>Purple: Review</span>
                </div>
                <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700/60">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                  <span>Grey: Unvisited</span>
                </div>
              </div>
            </li>
            <li>
              <strong>Automatic Submission:</strong> If the timer expires before you click manual submission, your session will be locked and automatically submitted on the server.
            </li>
          </ul>
        </div>

        {/* Academic Integrity Pledge */}
        <label
          htmlFor="integrity-pledge-checkbox"
          className="flex items-start gap-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 cursor-pointer select-none hover:border-slate-700 transition"
        >
          <input
            id="integrity-pledge-checkbox"
            type="checkbox"
            checked={pledgeChecked}
            onChange={(e) => setPledgeChecked(e.target.checked)}
            className="mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
          />
          <span className="text-xs text-slate-300 leading-normal">
            I certify that I am the registered candidate and will adhere strictly to academic integrity standards. I will not utilize unauthorized materials or collaborate with others during this assessment.
          </span>
        </label>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isStarting}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            id="exam-launch-start-btn"
            onClick={onStartExam}
            disabled={!pledgeChecked || isStarting}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-emerald-950/50 transition flex items-center gap-2"
          >
            {isStarting ? (
              <span>Initializing Session...</span>
            ) : isResume ? (
              <>
                <RotateCw className="w-4 h-4" />
                <span>Resume Examination</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Start Examination Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
