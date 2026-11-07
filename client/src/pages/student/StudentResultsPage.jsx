import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api.js';
import {
  Award,
  CheckCircle2,
  XCircle,
  FileText,
  ChevronRight,
  TrendingUp,
  BookOpen,
  Calendar,
} from 'lucide-react';

export default function StudentResultsPage() {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();

    const fetchResults = async () => {
      try {
        setIsLoading(true);
        const res = await api.get('/student/results', { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (res?.data) {
          setResults(res.data || []);
        }
      } catch (err) {
        if (controller.signal.aborted || err?.isCanceled || err?.code === 'ERR_CANCELED') return;
        console.error('Failed to load published results:', err);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchResults();
    return () => {
      controller.abort();
    };
  }, []);

  const totalExams = results.length;
  const passCount = results.filter((r) => r.isPassed === true).length;
  const avgPercentage =
    totalExams > 0
      ? Math.round(results.reduce((acc, r) => acc + (r.percentage || 0), 0) / totalExams)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border border-slate-800 bg-slate-navy/90 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-100">Academic Scorecards</h1>
            <p className="text-xs text-slate-400">
              Official evaluated marks, competition ranks, and faculty feedback
            </p>
          </div>
        </div>

        <Link
          to="/student"
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition self-start sm:self-center shadow-lg shadow-blue-500/20"
        >
          View Assigned Exams
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-blue-500/30 bg-slate-navy/80 shadow-md space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            Evaluated Examinations
          </span>
          <p className="text-3xl font-black text-slate-100">{totalExams}</p>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-500/30 bg-slate-navy/80 shadow-md space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Passed Assessments
          </span>
          <p className="text-3xl font-black text-emerald-400">
            {passCount}{' '}
            <span className="text-xs text-slate-400 font-normal">
              ({totalExams > 0 ? Math.round((passCount / totalExams) * 100) : 0}%)
            </span>
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-purple-500/30 bg-slate-navy/80 shadow-md space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            Average Cumulative Score
          </span>
          <p className="text-3xl font-black text-purple-400">{avgPercentage}%</p>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 bg-slate-navy/60 rounded-2xl border border-slate-800 animate-pulse">
            Loading published scorecards...
          </div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-slate-navy/60 rounded-2xl border border-slate-800 space-y-3 shadow-md">
            <Award className="w-12 h-12 mx-auto text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-200">No Published Results Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Results are published once faculty completes evaluations. You will be notified
              immediately when a result becomes available.
            </p>
          </div>
        ) : (
          results.map((res) => (
            <div
              key={res.resultId}
              onClick={() => navigate(`/student/exams/${res.examId}/result`)}
              className="p-5 rounded-2xl border border-slate-800/80 bg-slate-navy/90 hover:border-slate-700 hover:bg-slate-800/60 shadow-lg transition flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-bold font-mono">
                    {res.courseCode}
                  </span>
                  <span className="text-xs text-slate-400">{res.courseTitle}</span>
                </div>
                <h3 className="text-base font-bold text-slate-100 group-hover:text-blue-400 transition truncate">
                  {res.examTitle}
                </h3>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Published:{' '}
                    {res.publishedAt
                      ? new Date(res.publishedAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Recently'}
                  </span>
                </div>
              </div>

              {/* Score and Rank Metrics */}
              <div className="flex items-center gap-5 self-end md:self-center">
                {res.rank && (
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Rank
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono font-black text-sm">
                      #{res.rank}
                    </span>
                  </div>
                )}

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Marks
                  </span>
                  <div className="text-lg font-black text-slate-100">
                    {res.obtainedMarks}{' '}
                    <span className="text-xs text-slate-400 font-normal">/ {res.totalMarks}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Standing
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      res.isPassed === true
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : res.isPassed === false
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                    }`}
                  >
                    {res.isPassed === true ? 'PASSED' : res.isPassed === false ? 'FAILED' : 'GRADED'}
                  </span>
                </div>

                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-slate-200 transition group-hover:translate-x-1" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
