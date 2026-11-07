// ==============================================================================
// ExamSphere – Faculty Analytics & Question Diagnostics Dashboard (Phase 12)
// Visualizes exam participation, question accuracy, skipped questions, and difficulty indices.
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api.js';
import {
  BarChart3,
  BookOpen,
  Users,
  Award,
  AlertTriangle,
  HelpCircle,
  FileCheck2,
  Download,
  Filter,
  Loader2,
  AlertCircle,
  TrendingUp,
  Percent,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  PieChart as PieIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export default function FacultyAnalyticsPage() {
  const { isAuthenticated, role, token } = useSelector((state) => state.auth);
  const isFaculty = Boolean(isAuthenticated && token && role === 'FACULTY');

  const [overviewData, setOverviewData] = useState(null);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examAnalytics, setExamAnalytics] = useState(null);

  const [examsList, setExamsList] = useState([]);
  const [coursesList, setCoursesList] = useState([]);

  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingExam, setLoadingExam] = useState(false);
  const [error, setError] = useState('');
  const [exportingReport, setExportingReport] = useState(false);

  // Filters
  const [selectedCourse, setSelectedCourse] = useState('');
  const [batchFilter, setBatchFilter] = useState('');

  // 1. Fetch faculty courses & authorized exams
  useEffect(() => {
    if (!isFaculty) return;
    const fetchOptions = async () => {
      try {
        const [examsRes, coursesRes] = await Promise.all([
          api.get('/faculty/exams').catch(() => ({ data: [] })),
          api.get('/faculty/courses').catch(() => ({ data: [] })),
        ]);
        if (examsRes?.data) setExamsList(examsRes.data);
        if (coursesRes?.data) setCoursesList(coursesRes.data);
      } catch {
        // Suppress
      }
    };
    fetchOptions();
  }, [isFaculty]);

  // 2. Fetch Faculty Overview
  const fetchOverview = useCallback(async () => {
    if (!isFaculty) return;
    setLoadingOverview(true);
    setError('');
    try {
      const params = {};
      if (selectedCourse) params.courseId = selectedCourse;
      if (batchFilter) params.batch = batchFilter;

      const res = await api.get('/analytics/faculty/overview', { params });
      if (res?.data) {
        setOverviewData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load faculty analytics overview');
    } finally {
      setLoadingOverview(false);
    }
  }, [selectedCourse, batchFilter, isFaculty]);

  useEffect(() => {
    if (isFaculty) {
      fetchOverview();
    }
  }, [fetchOverview, isFaculty]);

  // 3. Fetch Exam-specific deep dive when selected
  useEffect(() => {
    if (!isFaculty || !selectedExamId) {
      setExamAnalytics(null);
      return;
    }

    const fetchExamDetails = async () => {
      setLoadingExam(true);
      try {
        const res = await api.get(`/analytics/faculty/exams/${selectedExamId}`);
        if (res?.data) {
          setExamAnalytics(res.data);
        }
      } catch (err) {
        alert(`Failed to load detailed exam analytics: ${err.message}`);
      } finally {
        setLoadingExam(false);
      }
    };

    fetchExamDetails();
  }, [isFaculty, selectedExamId]);

  if (!isFaculty) {
    return null;
  }

  // Export Question Analysis CSV
  const handleExportQuestionAnalysis = async () => {
    if (!selectedExamId) return;
    setExportingReport(true);
    try {
      const res = await api.get(`/analytics/reports/question-analysis/${selectedExamId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `question_analysis_${selectedExamId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExportingReport(false);
    }
  };

  // Export Faculty Exam Summary CSV
  const handleExportExamSummary = async () => {
    if (!selectedExamId) return;
    setExportingReport(true);
    try {
      const res = await api.get(`/analytics/reports/faculty-exam-summary/${selectedExamId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `faculty_exam_summary_${selectedExamId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExportingReport(false);
    }
  };

  const overview = overviewData?.overview || {};
  const charts = overviewData?.charts || {};

  return (
    <div className="space-y-6">
      {/* Page Title & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            <span>Academic Performance & Question Analytics</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Authorized course metrics, question difficulty ratings, and candidate response accuracy.
          </p>
        </div>

        {/* Exam Deep-dive Selector */}
        <div className="flex items-center gap-3">
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-100 focus:outline-none focus:border-blue-500"
          >
            <option value="">-- Select Exam for Deep Dive --</option>
            {examsList.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.course?.code}: {exam.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Global Overview Section */}
      {loadingOverview ? (
        <div className="p-12 rounded-2xl border border-slate-800 bg-slate-navy/90 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-sm font-medium">Aggregating faculty course analytics...</p>
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl border border-slate-800 bg-slate-navy/90 text-center text-rose-400">
          <p className="text-sm">{error}</p>
        </div>
      ) : (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="p-4 rounded-xl border border-blue-500/30 bg-slate-navy/90 backdrop-blur-xl shadow-lg shadow-blue-500/5 space-y-1">
              <span className="text-slate-400 text-xs font-medium">Exams Created</span>
              <div className="text-2xl font-bold text-white">{overview.totalExamsCreated || 0}</div>
              <div className="text-[10px] text-blue-400 font-semibold">Assigned courses</div>
            </div>

            <div className="p-4 rounded-xl border border-emerald-500/30 bg-slate-navy/90 backdrop-blur-xl shadow-lg shadow-emerald-500/5 space-y-1">
              <span className="text-slate-400 text-xs font-medium">Assigned Students</span>
              <div className="text-2xl font-bold text-white">{overview.totalAssignedStudents || 0}</div>
              <div className="text-[10px] text-emerald-400 font-semibold">
                Participation: {overview.examParticipation || 0}%
              </div>
            </div>

            <div className="p-4 rounded-xl border border-purple-500/30 bg-slate-navy/90 backdrop-blur-xl shadow-lg shadow-purple-500/5 space-y-1">
              <span className="text-slate-400 text-xs font-medium">Average Score</span>
              <div className="text-2xl font-bold text-white font-mono">
                {overview.averageScore || 0}%
              </div>
              <div className="text-[10px] text-purple-400 font-semibold">Published scores</div>
            </div>

            <div className="p-4 rounded-xl border border-cyan-500/30 bg-slate-navy/90 backdrop-blur-xl shadow-lg shadow-cyan-500/5 space-y-1">
              <span className="text-slate-400 text-xs font-medium">Score Range</span>
              <div className="text-lg font-bold text-white font-mono pt-1">
                {overview.lowestScore || 0}% - {overview.highestScore || 0}%
              </div>
              <div className="text-[10px] text-cyan-400 font-semibold">Min to Max</div>
            </div>

            <div className="p-4 rounded-xl border border-amber-500/30 bg-slate-navy/90 backdrop-blur-xl shadow-lg shadow-amber-500/5 space-y-1">
              <span className="text-slate-400 text-xs font-medium">Passed vs Failed</span>
              <div className="text-lg font-bold text-white font-mono pt-1">
                <span className="text-emerald-400">{overview.passFailRatio?.passed || 0}P</span> /{' '}
                <span className="text-rose-400">{overview.passFailRatio?.failed || 0}F</span>
              </div>
              <div className="text-[10px] text-amber-400 font-semibold">Outcome counts</div>
            </div>

            <div className="p-4 rounded-xl border border-rose-500/30 bg-slate-navy/90 backdrop-blur-xl shadow-lg shadow-rose-500/5 space-y-1">
              <span className="text-slate-400 text-xs font-medium">Pending Descriptive</span>
              <div className="text-2xl font-bold text-rose-400 font-mono">
                {overview.pendingDescriptiveCount || 0}
              </div>
              <div className="text-[10px] text-rose-400/80 font-semibold">Awaiting grading</div>
            </div>
          </div>
        </>
      )}

      {/* Exam-Specific Deep Dive Section */}
      {selectedExamId && (
        <div className="pt-4 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                Exam-Specific Analysis
              </span>
              <h2 className="text-lg font-bold text-white">
                {examAnalytics?.examDetails?.title || 'Selected Examination'}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportQuestionAnalysis}
                disabled={exportingReport || loadingExam}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Question Analysis CSV</span>
              </button>

              <button
                onClick={handleExportExamSummary}
                disabled={exportingReport || loadingExam}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-md shadow-blue-500/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exam Report CSV</span>
              </button>
            </div>
          </div>

          {loadingExam ? (
            <div className="p-12 rounded-2xl border border-slate-800 bg-slate-navy/90 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
              <p className="text-xs">Computing question accuracy and difficulty indices...</p>
            </div>
          ) : !examAnalytics ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No detailed analytics available for this examination.
            </div>
          ) : (
            <>
              {/* Difficult & Skipped Questions Callouts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Difficult Questions */}
                <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Most Difficult Questions (Lowest Accuracy)</span>
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {examAnalytics.difficultQuestions && examAnalytics.difficultQuestions.length > 0 ? (
                      examAnalytics.difficultQuestions.map((q) => (
                        <div
                          key={q.questionId}
                          className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5 truncate">
                            <div className="font-semibold text-slate-200 truncate">
                              Q{q.orderIndex + 1}: {q.questionText}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Type: {q.type} | Difficulty: {q.difficulty}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-amber-400 text-sm">
                              {q.accuracyRate}%
                            </span>
                            <span className="block text-[10px] text-slate-500">accuracy</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-slate-500 text-xs">
                        No difficult questions identified
                      </div>
                    )}
                  </div>
                </div>

                {/* Frequently Skipped Questions */}
                <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-purple-400" />
                      <span>Frequently Skipped Questions</span>
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {examAnalytics.frequentlySkippedQuestions &&
                    examAnalytics.frequentlySkippedQuestions.length > 0 ? (
                      examAnalytics.frequentlySkippedQuestions.map((q) => (
                        <div
                          key={q.questionId}
                          className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5 truncate">
                            <div className="font-semibold text-slate-200 truncate">
                              Q{q.orderIndex + 1}: {q.questionText}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Configured: {q.configuredMarks} marks
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-rose-400 text-sm">
                              {q.skippedCount}
                            </span>
                            <span className="block text-[10px] text-slate-500">skipped</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-slate-500 text-xs">
                        No skipped questions recorded
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Complete Question Accuracy Table */}
              <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl space-y-4 shadow-lg">
                <div>
                  <h3 className="text-sm font-bold text-white">Full Question-Wise Accuracy Breakdown</h3>
                  <p className="text-[11px] text-slate-400">
                    Aggregated candidate accuracy percentages and average marks awarded per question.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold bg-slate-950/40">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Question Text</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Difficulty</th>
                        <th className="py-2.5 px-3">Attempts</th>
                        <th className="py-2.5 px-3">Correct</th>
                        <th className="py-2.5 px-3">Accuracy</th>
                        <th className="py-2.5 px-3 text-right">Avg Marks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {examAnalytics.questionAccuracy?.map((q) => {
                        const isHard = q.difficulty === 'HARD';
                        const isMedium = q.difficulty === 'MEDIUM';
                        const diffBadge = isHard
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : isMedium
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

                        return (
                          <tr key={q.questionId} className="hover:bg-slate-800/40 transition">
                            <td className="py-2.5 px-3 text-slate-400 font-bold">{q.orderIndex + 1}</td>
                            <td className="py-2.5 px-3 font-sans font-medium text-slate-200 max-w-xs truncate">
                              {q.questionText}
                            </td>
                            <td className="py-2.5 px-3 text-purple-300 font-sans">{q.type}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold font-sans border ${diffBadge}`}>
                                {q.difficulty}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-200">{q.totalAttempts}</td>
                            <td className="py-2.5 px-3 text-emerald-400 font-semibold">{q.correctCount}</td>
                            <td className="py-2.5 px-3">
                              <span className={`font-bold ${q.accuracyRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {q.accuracyRate}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-blue-400 font-bold">
                              {q.avgMarksAwarded} / {q.configuredMarks}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
