// ==============================================================================
// ExamSphere – Submit Confirmation Modal Component
// Safeguard modal displaying breakdown before irreversible examination submission
// ==============================================================================

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Bookmark,
  HelpCircle,
  Loader2,
  X,
} from 'lucide-react';

export default function SubmitConfirmation({
  isOpen = false,
  onClose,
  onConfirm,
  totalQuestions = 0,
  answeredCount = 0,
  unansweredCount = 0,
  markedForReviewCount = 0,
  isSubmitting = false,
}) {
  if (!isOpen) return null;

  return (
    <div
      id="exam-submit-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl border border-amber-500/40 bg-slate-navy shadow-[0_0_50px_rgba(245,158,11,0.15)] space-y-6">
        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 id="submit-modal-title" className="text-lg font-bold text-slate-100">
                Submit Examination?
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Please review your progress summary before final submission.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Breakdown Cards */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 flex flex-col justify-between">
            <span className="text-emerald-400 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Answered Questions
            </span>
            <div className="text-2xl font-black font-mono text-emerald-300 mt-2">
              {answeredCount} <span className="text-xs text-slate-400 font-sans font-normal">/ {totalQuestions}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-rose-500/30 flex flex-col justify-between">
            <span className="text-rose-400 font-medium flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-rose-400" />
              Unanswered
            </span>
            <div className="text-2xl font-black font-mono text-rose-300 mt-2">
              {unansweredCount}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-purple-500/30 flex flex-col justify-between">
            <span className="text-purple-400 font-medium flex items-center gap-1.5">
              <Bookmark className="w-4 h-4 text-purple-400" />
              Marked for Review
            </span>
            <div className="text-2xl font-black font-mono text-purple-300 mt-2">
              {markedForReviewCount}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <span className="text-slate-400 font-medium">Total Questions</span>
            <div className="text-2xl font-black font-mono text-slate-200 mt-2">
              {totalQuestions}
            </div>
          </div>
        </div>

        {/* Warning Callout */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
          <div className="font-semibold flex items-center gap-1.5 text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Irreversible Action Warning</span>
          </div>
          <p className="text-[11px] text-amber-300/80 leading-relaxed pl-5">
            Once you submit, your session will be locked and queued for evaluation. You will not be able to re-enter or modify answers.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            id="exam-cancel-submit-btn"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
          >
            Return to Examination
          </button>

          <button
            type="button"
            id="exam-confirm-submit-btn"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 transition flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting Session...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Submit</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
