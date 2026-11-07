// ==============================================================================
// ExamSphere – Student Performance Analytics Portal (Phase 12)
// Student's private performance metrics, score progressions, and answer distributions.
// Strictly queries published examination results only.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api.js';
import {
  TrendingUp,
  Award,
  BookOpen,
  FileCheck2,
  PieChart as PieIcon,
  Download,
  Loader2,
  AlertCircle,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
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

export default function StudentAnalyticsPage() {
  const { isAuthenticated, role, token } = useSelector((state) => state.auth);
  const isStudent = Boolean(isAuthenticated && token && role === 'STUDENT');

  const [analytics, setAnalytics] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isStudent) return;
    const controller = new AbortController();

    const fetchStudentAnalytics = async () => {
      setLoading(true);
      setError('');
      try {
        const [overviewRes, trendRes] = await Promise.all([
          api.get('/analytics/student/overview', { signal: controller.signal }),
          api.get('/analytics/student/performance-trend', { signal: controller.signal }),
        ]);

        if (controller.signal.aborted) return;
        if (overviewRes?.data) setAnalytics(overviewRes.data);
        if (trendRes?.data) setTrends(trendRes.data);
      } catch (err) {
        if (controller.signal.aborted || err?.isCanceled || err?.code === 'ERR_CANCELED') return;
        setError(err.message || 'Failed to load personal performance analytics');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchStudentAnalytics();
    return () => {
      controller.abort();
    };
  }, [isStudent]);

  if (!isStudent) {
    return null;
  }

  const handleExportTranscript = async () => {
    setExporting(true);
    try {
      const res = await api.get('/analytics/reports/student-performance', {
        responseType: 'blob',
      });
      const blob = new Blob([res], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'my_academic_transcript.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const overview = analytics?.overview || {};
  const answerDistribution = analytics?.answerDistribution || [];
  const subjectPerformance = analytics?.subjectPerformance || [];
  const recentResults = analytics?.recentResults || [];

  const CHART_COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6'];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2.5">
            <TrendingUp className="w-6 h-6 text-blue-400" />
            <span>My Performance Analytics</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track your personal progress, subject-wise scores, and score trends across published exams.
          </p>
        </div>

        <button
          onClick={handleExportTranscript}
          disabled={exporting || loading}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-2 transition shadow-lg shadow-blue-500/20 disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          ) : (
            <Download className="w-4 h-4 text-white" />
          )}
          <span>Export My Transcript (CSV)</span>
        </button>
      </div>

      {loading ? (
        <div className="p-16 rounded-3xl border border-slate-800 bg-slate-navy/80 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-300">Aggregating published exam records...</p>
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-center text-rose-300">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-400 mb-2" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      ) : (
        <>
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-blue-500/30 bg-slate-navy/90 shadow-lg space-y-1">
              <span className="text-slate-400 text-xs">Exams Attempted</span>
              <div className="text-2xl font-black text-slate-100">{overview.examsAttempted || 0}</div>
              <div className="text-[10px] text-blue-400">
                {overview.examsCompleted || 0} completed & submitted
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-purple-500/30 bg-slate-navy/90 shadow-lg space-y-1">
              <span className="text-slate-400 text-xs">Average Percentage</span>
              <div className="text-2xl font-black text-purple-400 font-mono">
                {overview.averagePercentage || 0}%
              </div>
              <div className="text-[10px] text-slate-400">Across published results</div>
            </div>

            <div className="p-4 rounded-2xl border border-emerald-500/30 bg-slate-navy/90 shadow-lg space-y-1">
              <span className="text-slate-400 text-xs">Highest Score</span>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {overview.highestScore || 0}%
              </div>
              <div className="text-[10px] text-slate-400">Personal best</div>
            </div>

            <div className="p-4 rounded-2xl border border-amber-500/30 bg-slate-navy/90 shadow-lg space-y-1">
              <span className="text-slate-400 text-xs">Passed vs Failed</span>
              <div className="text-lg font-bold text-slate-100 font-mono pt-1">
                <span className="text-emerald-400">{overview.passedExamsCount || 0} Passed</span> /{' '}
                <span className="text-rose-400">{overview.failedExamsCount || 0} Failed</span>
              </div>
              <div className="text-[10px] text-slate-400">Published exams</div>
            </div>
          </div>

          {/* Charts Row: Performance Trend & Answer Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Trend Over Time (7 cols) */}
            <div className="lg:col-span-7 p-5 rounded-3xl border border-slate-800 bg-slate-navy/90 shadow-xl space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span>Personal Score Progression Over Time</span>
                </h3>
                <p className="text-[11px] text-slate-400">Chronological percentage progression</p>
              </div>

              <div className="h-64 w-full">
                {trends && trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis dataKey="date" stroke="#64748B" fontSize={10} />
                      <YAxis stroke="#64748B" fontSize={10} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          color: '#F8FAFC',
                          fontSize: '11px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="percentage"
                        stroke="#3B82F6"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#3B82F6' }}
                        name="Score %"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                    No published results to display progression
                  </div>
                )}
              </div>
            </div>

            {/* Answer Distribution (5 cols) */}
            <div className="lg:col-span-5 p-5 rounded-3xl border border-slate-800 bg-slate-navy/90 shadow-xl space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-purple-400" />
                  <span>Answer Accuracy Distribution</span>
                </h3>
                <p className="text-[11px] text-slate-400">Total answers across all published exams</p>
              </div>

              <div className="h-64 w-full">
                {answerDistribution && answerDistribution.some((a) => a.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={answerDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {answerDistribution.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          color: '#F8FAFC',
                          fontSize: '11px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(val) => <span className="text-xs text-slate-300">{val}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                    No answer data recorded
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Subject-Wise Performance Bar Chart */}
          <div className="p-5 rounded-3xl border border-slate-800 bg-slate-navy/90 shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                <span>Subject / Course-Wise Performance</span>
              </h3>
              <p className="text-[11px] text-slate-400">Average score achieved in each course</p>
            </div>

            <div className="h-64 w-full">
              {subjectPerformance && subjectPerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="courseCode" stroke="#64748B" fontSize={10} />
                    <YAxis stroke="#64748B" fontSize={10} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#F8FAFC',
                        fontSize: '11px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                      }}
                    />
                    <Bar dataKey="averagePercentage" fill="#06B6D4" radius={[6, 6, 0, 0]} name="Avg Score %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  No course scores recorded yet
                </div>
              )}
            </div>
          </div>

          {/* Recent Published Exam Results Table */}
          {recentResults && recentResults.length > 0 && (
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-navy/90 shadow-xl space-y-3">
              <h3 className="text-sm font-bold text-slate-100">Recent Published Exam Scores</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                      <th className="py-2.5 px-3">Examination</th>
                      <th className="py-2.5 px-3">Course</th>
                      <th className="py-2.5 px-3">Score</th>
                      <th className="py-2.5 px-3">Percentage</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {recentResults.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-100">
                          {r.examTitle}
                        </td>
                        <td className="py-2.5 px-3 text-blue-400">{r.courseCode}</td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {r.obtainedMarks} / {r.totalMarks}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-100">{r.percentage}%</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                              r.isPassed
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {r.isPassed ? 'Passed' : 'Failed'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-amber-300 font-bold">
                          {r.rank ? `#${r.rank}` : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
