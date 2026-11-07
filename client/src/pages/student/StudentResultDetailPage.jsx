import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api.js';
import {
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowLeft,
  Calendar,
  MessageSquare,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

export default function StudentResultDetailPage() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchResult = async () => {
      try {
        setIsLoading(true);
        const res = await api.get(`/student/exams/${examId}/result`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (res?.data) {
          setData(res.data);
        }
      } catch (err) {
        if (controller.signal.aborted || err?.isCanceled || err?.code === 'ERR_CANCELED') return;
        setError(err.message || 'Results for this examination have not been published yet');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchResult();
    return () => {
      controller.abort();
    };
  }, [examId]);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 animate-pulse bg-slate-navy/60 rounded-2xl border border-slate-800">
        Loading performance scorecard...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto p-8 text-center bg-slate-navy/90 rounded-2xl border border-slate-800 shadow-xl space-y-4">
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 w-fit mx-auto">
          <HelpCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-100">Results Pending Publication</h2>
        <p className="text-xs text-slate-400">
          {error || 'Evaluations are still in progress. Check back soon or await official notification.'}
        </p>
        <button
          onClick={() => navigate('/student/results')}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs rounded-xl hover:from-blue-500 hover:to-indigo-500 transition shadow-lg shadow-blue-500/20"
        >
          Return to Scorecards
        </button>
      </div>
    );
  }

  const { result, questions } = data;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Navigation */}
      <div>
        <Link
          to="/student/results"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Results
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-100">{result.examTitle}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Course: {result.courseCode} - {result.courseTitle}
            </p>
          </div>
          {result.publishedAt && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Published: {new Date(result.publishedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Hero Performance Card */}
      <div className="p-6 sm:p-8 rounded-3xl border border-slate-800 bg-slate-navy/90 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Final Examination Score
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-black text-slate-100 font-mono">{result.obtainedMarks}</span>
              <span className="text-xl font-bold text-slate-500">/ {result.totalMarks}</span>
              <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 font-bold text-sm border border-blue-500/30">
                {result.percentage}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {result.rank && (
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/30 text-center min-w-[90px]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                  Cohort Rank
                </span>
                <span className="text-2xl font-black text-amber-300 font-mono">#{result.rank}</span>
              </div>
            )}

            <div
              className={`p-4 rounded-2xl border text-center min-w-[90px] ${
                result.isPassed === true
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : result.isPassed === false
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70">
                Outcome
              </span>
              <span className="text-xl font-black">
                {result.isPassed === true ? 'PASSED' : result.isPassed === false ? 'FAILED' : 'GRADED'}
              </span>
            </div>
          </div>
        </div>

        {/* Breakdown Badges */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/30 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-xs font-bold text-emerald-300 block">
                {result.correctAnswersCount || 0} Correct
              </span>
              <span className="text-[10px] text-slate-400">Right answers</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-rose-500/30 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="text-xs font-bold text-rose-300 block">
                {result.incorrectAnswersCount || 0} Incorrect
              </span>
              <span className="text-[10px] text-slate-400">Wrong answers</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-slate-400 shrink-0" />
            <div>
              <span className="text-xs font-bold text-slate-200 block">
                {result.unansweredCount || 0} Unanswered
              </span>
              <span className="text-[10px] text-slate-400">Skipped items</span>
            </div>
          </div>
        </div>
      </div>

      {/* Question Breakdown List */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-100">Performance by Question</h2>

        {questions.map((q) => (
          <div
            key={q.questionNumber}
            className="p-5 rounded-2xl border border-slate-800/80 bg-slate-navy/90 shadow-md space-y-3"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-blue-400">Q{q.questionNumber}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-semibold">
                  {q.type.replace('_', ' ')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                    q.isCorrect
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : q.studentMarksAwarded < 0
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {q.studentMarksAwarded} / {q.marks} Marks
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed font-medium">{q.questionText}</p>

            {/* Faculty Feedback for Descriptive Answers */}
            {q.facultyFeedback && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-purple-500/30 text-xs space-y-1">
                <span className="font-bold text-purple-300 flex items-center gap-1.5 text-[11px]">
                  <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                  Faculty Feedback:
                </span>
                <p className="text-slate-300 leading-relaxed font-sans">{q.facultyFeedback}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
