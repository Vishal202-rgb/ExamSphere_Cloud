// ==============================================================================
// ExamSphere – Question Navigation Palette Component
// Color-coded overview of answered, visited, marked-for-review, and unvisited items
// ==============================================================================

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Bookmark,
  CircleDashed,
  Layers,
} from 'lucide-react';

export default function QuestionPalette({
  questions = [],
  currentIndex = 0,
  answers = {},
  visitedQuestionIds = [],
  onSelectQuestion,
  onSubmitClick,
  disabled = false,
}) {
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'ANSWERED' | 'UNANSWERED' | 'REVIEW'

  // Calculate statistics
  let answeredCount = 0;
  let markedCount = 0;
  let visitedUnansweredCount = 0;
  let notVisitedCount = 0;

  for (const q of questions) {
    const isVisited = visitedQuestionIds.includes(q.id);
    const ans = answers[q.id];
    const isMarked = Boolean(ans?.markedForReview);
    const hasOptions = Array.isArray(ans?.selectedOptions) && ans.selectedOptions.length > 0;
    const hasText = ans?.descriptiveAnswer && ans.descriptiveAnswer.trim().length > 0;
    const isAnswered = hasOptions || hasText;

    if (isMarked) markedCount++;
    if (isAnswered) {
      answeredCount++;
    } else if (isVisited) {
      visitedUnansweredCount++;
    } else {
      notVisitedCount++;
    }
  }

  const getQuestionState = (q) => {
    const isVisited = visitedQuestionIds.includes(q.id);
    const ans = answers[q.id];
    const isMarked = Boolean(ans?.markedForReview);
    const hasOptions = Array.isArray(ans?.selectedOptions) && ans.selectedOptions.length > 0;
    const hasText = ans?.descriptiveAnswer && ans.descriptiveAnswer.trim().length > 0;
    const isAnswered = hasOptions || hasText;

    if (isMarked) {
      return {
        type: 'REVIEW',
        className:
          'bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-600/30 hover:bg-purple-500',
        label: 'Marked for Review',
      };
    }
    if (isAnswered) {
      return {
        type: 'ANSWERED',
        className:
          'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-sm shadow-emerald-500/20 hover:bg-emerald-400',
        label: 'Answered',
      };
    }
    if (isVisited) {
      return {
        type: 'UNANSWERED',
        className:
          'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30',
        label: 'Unanswered & Visited',
      };
    }
    return {
      type: 'NOT_VISITED',
      className:
        'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white',
      label: 'Not Visited',
    };
  };

  const filteredQuestions = questions.filter((q) => {
    if (filter === 'ALL') return true;
    const state = getQuestionState(q);
    return state.type === filter;
  });

  return (
    <aside
      id="exam-question-palette"
      aria-label="Question Navigation Palette"
      className="glass-panel p-5 rounded-3xl border border-slate-800/80 bg-slate-navy/90 flex flex-col justify-between space-y-5 shadow-xl"
    >
      <div className="space-y-4">
        {/* Sidebar Title */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            Question Palette
          </h3>
          <span className="text-[11px] font-mono text-slate-400 font-bold">
            {answeredCount}/{questions.length} Solved
          </span>
        </div>

        {/* Legend Summary Counters */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setFilter(filter === 'ANSWERED' ? 'ALL' : 'ANSWERED')}
            className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
              filter === 'ANSWERED'
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Answered</span>
            </div>
            <span className="font-mono font-bold text-xs text-emerald-400">{answeredCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilter(filter === 'UNANSWERED' ? 'ALL' : 'UNANSWERED')}
            className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
              filter === 'UNANSWERED'
                ? 'bg-rose-500/20 border-rose-500 text-rose-300 ring-1 ring-rose-500'
                : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Unanswered</span>
            </div>
            <span className="font-mono font-bold text-xs text-rose-400">{visitedUnansweredCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilter(filter === 'REVIEW' ? 'ALL' : 'REVIEW')}
            className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
              filter === 'REVIEW'
                ? 'bg-purple-500/20 border-purple-500 text-purple-300 ring-1 ring-purple-500'
                : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>For Review</span>
            </div>
            <span className="font-mono font-bold text-xs text-purple-400">{markedCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilter(filter === 'NOT_VISITED' ? 'ALL' : 'NOT_VISITED')}
            className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
              filter === 'NOT_VISITED'
                ? 'bg-slate-700 border-slate-500 text-white ring-1 ring-slate-500'
                : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
              <span>Not Visited</span>
            </div>
            <span className="font-mono font-bold text-xs text-slate-300">{notVisitedCount}</span>
          </button>
        </div>

        {filter !== 'ALL' && (
          <div className="flex items-center justify-between text-[11px] text-slate-300 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <span>Filtering: {filter}</span>
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className="font-bold underline hover:text-white"
            >
              Reset
            </button>
          </div>
        )}

        {/* Question Grid Buttons */}
        <div className="pt-2">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
            Jump to Question
          </div>
          <div className="grid grid-cols-5 gap-2 max-h-[320px] overflow-y-auto pr-1">
            {questions.map((q, idx) => {
              const state = getQuestionState(q);
              const isCurrent = idx === currentIndex;
              const isHiddenByFilter = filter !== 'ALL' && state.type !== filter;

              return (
                <button
                  key={q.id}
                  type="button"
                  id={`palette-btn-${idx + 1}`}
                  onClick={() => onSelectQuestion(idx)}
                  disabled={disabled}
                  title={`Question ${idx + 1}: ${state.label}`}
                  className={`h-9 rounded-xl font-mono text-xs font-bold transition-all relative border flex items-center justify-center ${
                    state.className
                  } ${
                    isCurrent
                      ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900 scale-105 z-10'
                      : ''
                  } ${isHiddenByFilter ? 'opacity-20' : ''}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Submit Examination Action */}
      <div className="pt-4 border-t border-slate-800">
        <button
          type="button"
          id="exam-submit-trigger-btn"
          onClick={onSubmitClick}
          disabled={disabled}
          className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Submit Examination</span>
        </button>
      </div>
    </aside>
  );
}
