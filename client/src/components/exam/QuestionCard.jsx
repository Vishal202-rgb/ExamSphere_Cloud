// ==============================================================================
// ExamSphere – Question Card Component
// Main examination viewport rendering current question, options, and actions
// ==============================================================================

import React from 'react';
import AnswerOptions from './AnswerOptions.jsx';
import DescriptiveAnswerEditor from './DescriptiveAnswerEditor.jsx';
import CodeEditorPanel from '../coding/CodeEditorPanel.jsx';
import {
  Bookmark,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Award,
} from 'lucide-react';

export default function QuestionCard({
  question,
  totalQuestions = 1,
  currentIndex = 0,
  answerState = { selectedOptions: [], descriptiveAnswer: '', markedForReview: false },
  attemptId,
  examId,
  onSelectOption,
  onToggleMultipleOption,
  onDescriptiveChange,
  onToggleMarkForReview,
  onClearResponse,
  onPrevious,
  onNext,
  isFirst = false,
  isLast = false,
  disabled = false,
}) {
  if (!question) {
    return (
      <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center text-slate-500">
        <HelpCircle className="w-10 h-10 mx-auto mb-3 text-slate-600 animate-pulse" />
        <p className="text-sm">No question loaded for this position.</p>
      </div>
    );
  }

  const isMarked = Boolean(answerState?.markedForReview);
  const selectedOptions = answerState?.selectedOptions || [];
  const descriptiveText = answerState?.descriptiveAnswer || '';

  const formatQuestionType = (type) => {
    switch (type) {
      case 'SINGLE_MCQ':
        return 'Single-Correct MCQ';
      case 'MULTIPLE_MCQ':
        return 'Multiple-Correct MCQ (Select all that apply)';
      case 'TRUE_FALSE':
        return 'True / False';
      case 'DESCRIPTIVE':
        return 'Descriptive / Subjective';
      case 'CODING':
        return 'Coding Assessment / Problem';
      default:
        return 'Question';
    }
  };

  return (
    <div className="glass-panel rounded-3xl border border-slate-800/80 bg-slate-navy/90 p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-xl">
      {/* Question Header: Number, Type, and Marks */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-xl bg-slate-800/80 text-blue-400 border border-slate-700/80 font-mono font-bold text-xs">
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              {formatQuestionType(question.type)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              +{question.marks || 1} mark{question.marks !== 1 ? 's' : ''}
            </span>
            {question.negativeMarks > 0 && (
              <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-mono">
                -{question.negativeMarks} neg
              </span>
            )}
          </div>
        </div>

        {/* Question Text */}
        <div className="pt-6">
          <h2 className="text-base sm:text-lg font-semibold text-slate-100 leading-relaxed select-text">
            {question.questionText}
          </h2>
        </div>

        {/* Question Options or Descriptive / Coding Area */}
        <div className="pt-2">
          {question.type === 'CODING' ? (
            <CodeEditorPanel
              question={question}
              attemptId={attemptId}
              examId={examId}
              initialCode={descriptiveText}
              onCodeChange={onDescriptiveChange}
              disabled={disabled}
            />
          ) : question.type === 'DESCRIPTIVE' ? (
            <DescriptiveAnswerEditor
              value={descriptiveText}
              onChange={onDescriptiveChange}
              disabled={disabled}
            />
          ) : (
            <AnswerOptions
              questionType={question.type}
              options={question.options || []}
              selectedOptionIds={selectedOptions}
              onSelectOption={onSelectOption}
              onToggleMultipleOption={onToggleMultipleOption}
              disabled={disabled}
            />
          )}
        </div>
      </div>

      {/* Control Buttons: Previous, Next, Mark for Review, Clear */}
      <div className="pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
        {/* Left Side: Mark for Review & Clear Response */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            id="exam-mark-for-review-btn"
            onClick={onToggleMarkForReview}
            disabled={disabled}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              isMarked
                ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isMarked ? 'fill-current' : ''}`} />
            <span>{isMarked ? 'Marked for Review' : 'Mark for Review'}</span>
          </button>

          <button
            type="button"
            id="exam-clear-response-btn"
            onClick={onClearResponse}
            disabled={disabled}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 transition flex items-center gap-1.5"
            title="Clear answered options or descriptive text for this question"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Response</span>
          </button>
        </div>

        {/* Right Side: Previous and Next Navigation */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            id="exam-previous-question-btn"
            onClick={onPrevious}
            disabled={isFirst || disabled}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-300 transition flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <button
            type="button"
            id="exam-next-question-btn"
            onClick={onNext}
            disabled={isLast || disabled}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white shadow-lg shadow-blue-500/20 transition flex items-center gap-1.5"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
