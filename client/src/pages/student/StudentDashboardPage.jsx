// ==============================================================================
// ExamSphere – Student Examination Dashboard (Phase 8 Portal)
// Comprehensive dashboard featuring Live, Available, Upcoming, and Completed exams,
// attempt history, syllabus details, instruction modal, and session launchers
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import api from '../../services/api.js';
import ExamInstructions from '../../components/exam/ExamInstructions.jsx';
import {
  GraduationCap,
  Calendar,
  Clock,
  Sparkles,
  Award,
  ShieldCheck,
  AlertCircle,
  Loader2,
  RefreshCw,
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  History,
  FileText,
  Flame,
} from 'lucide-react';

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const { isAuthenticated, role, token } = useSelector((state) => state.auth);
  const isStudent = Boolean(isAuthenticated && token && role === 'STUDENT');

  const [profile, setProfile] = useState(null);
  const [, setCourses] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active filter tab: 'ALL' | 'LIVE' | 'AVAILABLE' | 'UPCOMING' | 'COMPLETED'
  const [activeTab, setActiveTab] = useState('ALL');

  // Selected exam for instructions modal
  const [selectedExamForModal, setSelectedExamForModal] = useState(null);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  const fetchStudentPortalData = useCallback(
    async (signal = null) => {
      if (!isStudent) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const [profileRes, coursesRes, examsRes] = await Promise.all([
          api.get('/student/profile', signal ? { signal } : {}),
          api.get('/student/courses', signal ? { signal } : {}),
          api.get('/student/exams', signal ? { signal } : {}),
        ]);

        if (profileRes?.data) setProfile(profileRes.data);
        if (coursesRes?.data) setCourses(coursesRes.data);
        setExams(examsRes?.data || []);
      } catch (err) {
        if (
          signal?.aborted ||
          axios.isCancel(err) ||
          err?.isCanceled ||
          err?.code === 'ERR_CANCELED' ||
          err?.name === 'CanceledError' ||
          err?.message === 'canceled'
        ) {
          return;
        }
        console.error('Failed to load student portal:', err);
        setError(err?.message || 'Failed to synchronize examination portal data');
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [isStudent]
  );

  useEffect(() => {
    if (!isStudent) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    fetchStudentPortalData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchStudentPortalData, isStudent]);

  if (!isStudent) {
    return (
      <div className="p-8 text-center bg-[#0F172A] border border-slate-800 rounded-2xl text-slate-400 text-xs">
        Checking student authorization...
      </div>
    );
  }

  // Filter exams based on tab
  const liveExams = exams.filter((e) => e.isLive && (e.attemptsRemaining > 0 || e.canResume));
  const availableExams = exams.filter((e) => e.canStart && !e.isPastDeadline);
  const upcomingExams = exams.filter((e) => e.isUpcoming);
  const completedExams = exams.filter((e) => e.isPastDeadline || (e.attemptsCount > 0 && !e.canResume));

  const getFilteredExams = () => {
    switch (activeTab) {
      case 'LIVE':
        return liveExams;
      case 'AVAILABLE':
        return availableExams;
      case 'UPCOMING':
        return upcomingExams;
      case 'COMPLETED':
        return completedExams;
      case 'ALL':
      default:
        return exams;
    }
  };

  const filteredExams = getFilteredExams();

  const handleOpenInstructions = (exam) => {
    setSelectedExamForModal(exam);
    setIsInstructionsOpen(true);
  };

  const handleLaunchExam = (exam) => {
    setIsInstructionsOpen(false);
    if (exam.activeAttempt) {
      navigate(`/student/attempts/${exam.activeAttempt.id}`);
    } else {
      navigate(`/student/exams/${exam.id}/take`);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Student Identity Card */}
      <div className="p-6 sm:p-8 rounded-2xl border border-slate-800 bg-[#0F172A] shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                Verified Student Portal
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                {profile?.name || 'Student Candidate'}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                <span className="font-mono font-bold text-slate-200">
                  Roll No: {profile?.rollNumber || 'CS2023001'}
                </span>
                <span>•</span>
                <span>Batch {profile?.batch || '2023-2027'}</span>
                <span>•</span>
                <span>Section {profile?.section || 'A'}</span>
                <span>•</span>
                <span>{profile?.email}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Department
              </span>
              <div className="text-xs font-semibold text-white">
                {profile?.department?.name || 'Computer Science & Engineering'}
              </div>
            </div>
            <Link
              to="/student/results"
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition flex items-center gap-2 shadow-sm"
            >
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Scorecards & Results</span>
            </Link>

            <button
              type="button"
              id="student-refresh-btn"
              onClick={() => fetchStudentPortalData()}
              disabled={loading}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/40 shadow-md shadow-blue-500/20 transition disabled:opacity-50"
              title="Refresh Assessment Schedule"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchStudentPortalData()}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg text-[11px] font-semibold text-rose-200 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metrics Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-slate-800 bg-[#0F172A] hover:border-emerald-500/40 flex items-center gap-4 shadow-xl transition">
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Flame className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Live Assessments
            </span>
            <div className="text-2xl font-black font-mono text-emerald-400 mt-0.5">
              {liveExams.length}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-800 bg-[#0F172A] hover:border-teal-500/40 flex items-center gap-4 shadow-xl transition">
          <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
            <Sparkles className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Available to Take
            </span>
            <div className="text-2xl font-black font-mono text-white mt-0.5">
              {availableExams.length}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-800 bg-[#0F172A] hover:border-blue-500/40 flex items-center gap-4 shadow-xl transition">
          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Calendar className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Upcoming Scheduled
            </span>
            <div className="text-2xl font-black font-mono text-white mt-0.5">
              {upcomingExams.length}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-800 bg-[#0F172A] hover:border-purple-500/40 flex items-center gap-4 shadow-xl transition">
          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <History className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Completed & History
            </span>
            <div className="text-2xl font-black font-mono text-white mt-0.5">
              {completedExams.length}
            </div>
          </div>
        </div>
      </div>

      {/* Main Examination Roster Section */}
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#0F172A] border border-slate-800 text-xs">
            <button
              type="button"
              id="tab-all-exams"
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-2 rounded-xl font-semibold transition ${
                activeTab === 'ALL'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              All Assigned ({exams.length})
            </button>

            <button
              type="button"
              id="tab-live-exams"
              onClick={() => setActiveTab('LIVE')}
              className={`px-3.5 py-2 rounded-xl font-semibold transition flex items-center gap-2 ${
                activeTab === 'LIVE'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${activeTab === 'LIVE' ? 'bg-slate-950' : 'bg-emerald-400'} animate-pulse`} />
              Live ({liveExams.length})
            </button>

            <button
              type="button"
              id="tab-available-exams"
              onClick={() => setActiveTab('AVAILABLE')}
              className={`px-3.5 py-2 rounded-xl font-semibold transition ${
                activeTab === 'AVAILABLE'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Available ({availableExams.length})
            </button>

            <button
              type="button"
              id="tab-upcoming-exams"
              onClick={() => setActiveTab('UPCOMING')}
              className={`px-3.5 py-2 rounded-xl font-semibold transition ${
                activeTab === 'UPCOMING'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Upcoming ({upcomingExams.length})
            </button>

            <button
              type="button"
              id="tab-completed-exams"
              onClick={() => setActiveTab('COMPLETED')}
              className={`px-3.5 py-2 rounded-xl font-semibold transition ${
                activeTab === 'COMPLETED'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              History ({completedExams.length})
            </button>
          </div>

          <span className="text-xs text-slate-400 hidden sm:inline">
            Showing {filteredExams.length} Assigned Assessment{filteredExams.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Exams Grid */}
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400 bg-[#0F172A] rounded-2xl border border-slate-800">
            <Loader2 className="w-7 h-7 animate-spin mx-auto mb-3 text-blue-400" />
            Loading assigned examination roster...
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="py-20 text-center bg-[#0F172A] rounded-2xl border border-slate-800 space-y-3">
            <Calendar className="w-10 h-10 mx-auto text-slate-500" />
            <h3 className="text-base font-bold text-white">No Examinations in this category</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are no examinations matching this filter. Switch to "All Assigned" to view all enrolled course assessments.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredExams.map((exam) => {
              const isResume = Boolean(exam.canResume);
              const isExpandedHistory = expandedHistoryId === exam.id;

              return (
                <div
                  key={exam.id}
                  className="p-6 rounded-2xl border border-slate-800 bg-[#0F172A] hover:border-slate-700 transition flex flex-col justify-between space-y-5 shadow-xl"
                >
                  {/* Top: Course, Status & Title */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-blue-600 text-white shadow-sm">
                        {exam.courseCode || exam.course?.code || (exam.courses?.map((c) => c.code).join(', '))}
                      </span>

                      {/* Status Badges */}
                      {exam.isLive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                          Live Assessment
                        </span>
                      ) : exam.isUpcoming ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                          <Calendar className="w-3.5 h-3.5" />
                          Upcoming
                        </span>
                      ) : exam.isPastDeadline ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Closed Window
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/10 text-teal-300 border border-teal-500/30">
                          Available
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white tracking-tight">{exam.title}</h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {exam.description || `${exam.course?.title} – Standardized examination session.`}
                      </p>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800/80 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Duration
                        </span>
                        <span className="font-mono font-bold text-white">
                          {exam.durationMinutes} mins
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Total Marks
                        </span>
                        <span className="font-mono font-bold text-white">
                          {exam.totalMarks} pts
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Attempts
                        </span>
                        <span className="font-mono font-bold text-white">
                          {exam.attemptsCount} / {exam.maxAttempts || 1}
                        </span>
                      </div>
                    </div>

                    {/* Window Dates */}
                    <div className="space-y-1 text-xs text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>Window Opens:</span>
                        <span className="font-mono text-slate-300">{formatDateTime(exam.startTime)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Window Closes:</span>
                        <span className="font-mono text-slate-300">{formatDateTime(exam.endTime)}</span>
                      </div>
                    </div>

                    {/* In-Progress Notification Banner */}
                    {isResume && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>Active session in-progress. You can resume without losing answered state.</span>
                      </div>
                    )}

                    {/* Attempt History Accordion */}
                    {exam.attempts?.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setExpandedHistoryId(isExpandedHistory ? null : exam.id)}
                          className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>{isExpandedHistory ? 'Hide Past Attempt Records' : `View Attempt History (${exam.attempts.length})`}</span>
                        </button>

                        {isExpandedHistory && (
                          <div className="mt-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                            {exam.attempts.map((att) => (
                              <div
                                key={att.id}
                                className="flex items-center justify-between py-1.5 border-b border-slate-800/80 last:border-0"
                              >
                                <div>
                                  <div className="font-bold text-white">
                                    Attempt #{att.attemptNumber} — {att.status}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {att.submittedAt
                                      ? `Submitted ${formatDateTime(att.submittedAt)} (${att.submissionReason || 'MANUAL'})`
                                      : `Started ${formatDateTime(att.startedAt)}`}
                                  </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300">
                                  {att.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 border-t border-slate-800 flex items-center gap-3">
                    <button
                      type="button"
                      id={`exam-instructions-btn-${exam.id}`}
                      onClick={() => handleOpenInstructions(exam)}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition flex items-center gap-1.5"
                    >
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span>Instructions</span>
                    </button>

                    {isResume ? (
                      <button
                        type="button"
                        id={`exam-resume-btn-${exam.id}`}
                        onClick={() => handleLaunchExam(exam)}
                        className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2"
                      >
                        <RotateCw className="w-4 h-4" />
                        <span>Resume Examination</span>
                      </button>
                    ) : exam.canStart ? (
                      <button
                        type="button"
                        id={`exam-start-btn-${exam.id}`}
                        onClick={() => handleOpenInstructions(exam)}
                        className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Start Examination</span>
                      </button>
                    ) : exam.isUpcoming ? (
                      <button
                        type="button"
                        disabled
                        className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800/50 border border-slate-800 text-slate-500 cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <Clock className="w-4 h-4" />
                        <span>Window Not Open Yet</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800/50 border border-slate-800 text-slate-500 cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Attempts Closed</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Examination Instructions & Briefing Modal */}
      <ExamInstructions
        isOpen={isInstructionsOpen}
        onClose={() => setIsInstructionsOpen(false)}
        exam={selectedExamForModal}
        onStartExam={() => handleLaunchExam(selectedExamForModal)}
        isResume={Boolean(selectedExamForModal?.canResume)}
      />
    </div>
  );
}
