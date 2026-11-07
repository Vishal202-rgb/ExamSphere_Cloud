import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Save,
  Award,
  MessageSquare,
  FileText,
} from 'lucide-react';

export default function AttemptEvaluationPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [attemptData, setAttemptData] = useState(null);
  const [evaluations, setEvaluations] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchAttempt = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/faculty/attempts/${attemptId}`);
      if (res?.data) {
        setAttemptData(res.data);

        // Pre-populate evaluations map with existing grades and feedback
        const initialEvals = {};
        for (const q of res.data.questions || []) {
          if (q.type === 'DESCRIPTIVE' || q.studentAnswer) {
            initialEvals[q.id] = {
              marksAwarded: q.studentAnswer?.marksAwarded ?? 0,
              facultyFeedback: q.studentAnswer?.facultyFeedback || '',
            };
          }
        }
        setEvaluations(initialEvals);
      }
    } catch (err) {
      console.error('Failed to load attempt details:', err);
    } finally {
      setIsLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    fetchAttempt();
  }, [fetchAttempt]);

  const handleGradeChange = (questionId, marksAwarded, maxMarks) => {
    const clampedMarks = Math.max(0, Math.min(maxMarks, parseFloat(marksAwarded) || 0));
    setEvaluations((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        marksAwarded: clampedMarks,
      },
    }));
  };

  const handleFeedbackChange = (questionId, text) => {
    setEvaluations((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        facultyFeedback: text,
      },
    }));
  };

  const handleSaveGrades = async () => {
    try {
      setIsSaving(true);
      const payload = Object.entries(evaluations).map(([questionId, evalItem]) => ({
        questionId,
        marksAwarded: evalItem.marksAwarded,
        facultyFeedback: evalItem.facultyFeedback,
      }));

      await api.put(`/faculty/attempts/${attemptId}/evaluate`, { evaluations: payload });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      fetchAttempt();
    } catch (err) {
      alert(err.message || 'Failed to save evaluations');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!window.confirm('Are you sure you want to finalize this attempt evaluation?')) return;
    try {
      setIsSaving(true);
      await api.post(`/faculty/attempts/${attemptId}/finalize`);
      alert('Attempt evaluation finalized successfully!');
      fetchAttempt();
    } catch (err) {
      alert(err.message || 'Failed to finalize evaluation');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 animate-pulse bg-slate-navy/90 rounded-2xl border border-slate-800">
        Loading candidate attempt specifications...
      </div>
    );
  }

  if (!attemptData) {
    return (
      <div className="p-12 text-center text-slate-400 bg-slate-navy/90 rounded-2xl border border-slate-800 space-y-3">
        <AlertCircle className="w-10 h-10 mx-auto text-rose-400" />
        <h2 className="text-base font-bold text-white">Attempt Not Found</h2>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition"
        >
          Return to Submissions
        </button>
      </div>
    );
  }

  const { attempt, exam, questions } = attemptData;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(`/faculty/exams/${exam?.id}/submissions`)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Exam Submissions
          </button>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <span>Evaluation: {attempt.student?.name}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              Roll: {attempt.student?.rollNumber || 'N/A'}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {exam.title} • Batch: {attempt.student?.batch || '—'} • Sec: {attempt.student?.section || '—'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveGrades}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-2"
          >
            <Save className="w-4 h-4 text-emerald-400" />
            {isSaving ? 'Saving...' : 'Save Draft Marks'}
          </button>

          <button
            onClick={handleFinalize}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Finalize Evaluation
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
          Grades and feedback saved successfully!
        </div>
      )}

      {/* Summary Scorecard Banner */}
      <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-400 shadow-md shadow-amber-500/10">
            <Award className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Attempt Marks Obtained
            </span>
            <div className="text-3xl font-black text-white flex items-baseline gap-2">
              <span>{attempt.result?.obtainedMarks ?? 0}</span>
              <span className="text-base text-slate-500 font-semibold">/ {exam.totalMarks}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
                {attempt.result?.percentage ?? 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="text-right">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
            <span className="font-semibold text-emerald-400">{attempt.evaluationStatus}</span>
          </div>
          <div className="h-8 w-px bg-slate-800"></div>
          <div className="text-right">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Passing</span>
            <span className="font-semibold text-slate-200">{exam.passingMarks || 40} Marks</span>
          </div>
        </div>
      </div>

      {/* Questions Grading Cards */}
      <div className="space-y-4">
        {questions.map((q) => {
          const evalItem = evaluations[q.id] || { marksAwarded: 0, facultyFeedback: '' };

          return (
            <div
              key={q.id}
              className="p-5 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl shadow-lg space-y-4"
            >
              {/* Question Header */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-bold text-blue-400 font-mono">
                    Q{q.questionNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold">
                    {q.type.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Max Marks: {q.marks}</span>
                </div>

                <div className="flex items-center gap-2">
                  {q.type !== 'DESCRIPTIVE' && (
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        q.studentAnswer?.isCorrect
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : q.studentAnswer?.marksAwarded < 0
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
                      }`}
                    >
                      {q.studentAnswer?.isCorrect
                        ? 'CORRECT (+ ' + q.studentAnswer.marksAwarded + ')'
                        : q.studentAnswer?.marksAwarded < 0
                        ? 'PENALTY (' + q.studentAnswer.marksAwarded + ')'
                        : 'UNANSWERED'}
                    </span>
                  )}
                </div>
              </div>

              {/* Question Prompt */}
              <p className="text-sm text-slate-100 font-medium leading-relaxed">{q.questionText}</p>

              {/* MCQ & True/False Options Rendering */}
              {q.options && q.options.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Option Choices:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt) => {
                      const isStudentSelected =
                        q.studentAnswer?.selectedOptions &&
                        q.studentAnswer.selectedOptions.includes(opt.id);

                      let borderStyle = 'border-slate-800 bg-slate-900/60 text-slate-300';
                      if (opt.isCorrect) {
                        borderStyle = 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-semibold shadow-sm shadow-emerald-500/10';
                      } else if (isStudentSelected && !opt.isCorrect) {
                        borderStyle = 'border-rose-500/40 bg-rose-500/10 text-rose-300 line-through';
                      }

                      return (
                        <div
                          key={opt.id}
                          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${borderStyle}`}
                        >
                          <span>{opt.optionText}</span>
                          <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                            {opt.isCorrect && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                                Correct Answer
                              </span>
                            )}
                            {isStudentSelected && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                                Student Pick
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Descriptive Answer Evaluation Block */}
              {q.type === 'DESCRIPTIVE' && (
                <div className="space-y-4 pt-2">
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      Candidate's Written Response:
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                      {q.studentAnswer?.descriptiveAnswer || (
                        <span className="text-slate-500 italic">No response submitted by candidate.</span>
                      )}
                    </p>
                  </div>

                  {/* Manual Grading Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                        <span>Awarded Marks</span>
                        <span className="text-[10px] text-slate-500">Max: {q.marks}</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={q.marks}
                        step="0.5"
                        value={evalItem.marksAwarded}
                        onChange={(e) => handleGradeChange(q.id, e.target.value, q.marks)}
                        className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                        <span>Faculty Feedback</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Add constructive notes or rubric feedback for the student..."
                        value={evalItem.facultyFeedback}
                        onChange={(e) => handleFeedbackChange(q.id, e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Faculty Question Explanation */}
              {q.explanation && (
                <div className="text-[11px] text-purple-300 bg-purple-500/10 p-2.5 rounded-xl border border-purple-500/20 flex items-start gap-2">
                  <HelpCircle className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-purple-200">Solution Rubric:</strong> {q.explanation}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
