import React from 'react';
import Modal from '../../../components/common/Modal.jsx';
import {
  FileCheck2,
  Clock,
  Award,
  Users2,
  HelpCircle,
  Calendar,
  Settings,
  Shuffle,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

export default function ExamDetailsModal({
  isOpen,
  onClose,
  exam,
}) {
  if (!exam) return null;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'SCHEDULED':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30 font-semibold';
      case 'LIVE':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold shadow-sm shadow-emerald-500/20';
      case 'COMPLETED':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'CANCELLED':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30 line-through';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Examination Specification & Inspection"
      subtitle={`Detailed overview for ${exam.title}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Header Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(exam.status)}`}>
                {exam.status}
              </span>
              <span className="text-xs text-blue-400 font-mono">
                {exam.courses && exam.courses.length > 0
                  ? exam.courses.map((c) => c.course?.code || c.code).join(', ')
                  : `${exam.course?.code} – ${exam.course?.name || exam.course?.title}`}
              </span>
            </div>
            <h3 className="text-base font-bold text-white">{exam.title}</h3>
            {exam.description && (
              <p className="text-xs text-slate-400">{exam.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-center px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-700/80">
              <span className="text-[10px] text-slate-400 block">Total Marks</span>
              <span className="text-sm font-black text-white">{exam.totalMarks}</span>
            </div>
            <div className="text-center px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-700/80">
              <span className="text-[10px] text-slate-400 block">Duration</span>
              <span className="text-sm font-black text-white">{exam.durationMinutes}m</span>
            </div>
          </div>
        </div>

        {/* Schedule & Timing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Window Start (Local)</span>
              <span className="font-semibold text-slate-200">
                {exam.startTime ? new Date(exam.startTime).toLocaleString() : 'Immediate'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Window End (Local)</span>
              <span className="font-semibold text-slate-200">
                {exam.endTime ? new Date(exam.endTime).toLocaleString() : 'No Deadline'}
              </span>
            </div>
          </div>
        </div>

        {/* Settings Breakdown */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-blue-400" />
            Security & Examination Parameters
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Shuffle Questions</span>
              <span className={`text-[10px] font-bold ${exam.shuffleQuestions ? 'text-emerald-400' : 'text-slate-500'}`}>
                {exam.shuffleQuestions ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Shuffle Options</span>
              <span className={`text-[10px] font-bold ${exam.shuffleOptions ? 'text-emerald-400' : 'text-slate-500'}`}>
                {exam.shuffleOptions ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Negative Marking</span>
              <span className={`text-[10px] font-bold ${exam.negativeMarking ? 'text-rose-400' : 'text-slate-500'}`}>
                {exam.negativeMarking ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Auto Submit</span>
              <span className={`text-[10px] font-bold ${exam.autoSubmit ? 'text-emerald-400' : 'text-slate-500'}`}>
                {exam.autoSubmit ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Allow Late Entry</span>
              <span className={`text-[10px] font-bold ${exam.allowLateEntry ? 'text-emerald-400' : 'text-slate-500'}`}>
                {exam.allowLateEntry ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Max Attempts</span>
              <span className="text-[10px] font-bold text-white">
                {exam.maximumAttempts || 1} Attempt
              </span>
            </div>
          </div>
        </div>

        {/* Assigned Questions Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
              Attached Questions ({exam.questions?.length || 0})
            </h4>
            <span className="text-[11px] text-blue-400 font-semibold">
              Calculated Total: {exam.totalMarks} Marks
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {exam.questions?.map((eq, idx) => (
              <div
                key={eq.id}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-bold flex items-center justify-center shrink-0">
                    Q{idx + 1}
                  </span>
                  <div className="truncate">
                    <p className="font-semibold text-slate-200 truncate">{eq.question?.title}</p>
                    <span className="text-[10px] text-slate-400">
                      {eq.question?.type} • {eq.question?.difficulty}
                    </span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/30 text-[11px] font-bold shrink-0">
                  +{eq.marks} Marks
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Assigned Students Summary */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Users2 className="w-3.5 h-3.5 text-blue-400" />
            Assigned Student Candidates ({exam.assignments?.length || 0})
          </h4>

          <div className="max-h-40 overflow-y-auto divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/60 text-xs">
            {exam.assignments?.length === 0 ? (
              <div className="p-3 text-center text-slate-500 text-xs">
                No students currently assigned to this examination.
              </div>
            ) : (
              exam.assignments?.map((a) => (
                <div key={a.id} className="p-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-200">{a.student?.fullName}</span>
                    <span className="text-slate-400 text-[11px] ml-2 font-mono">
                      {a.student?.rollNumber || a.student?.email}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Batch {a.student?.batch || '2025'} • Sec {a.student?.section || 'A'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition"
          >
            Close Overview
          </button>
        </div>
      </div>
    </Modal>
  );
}
