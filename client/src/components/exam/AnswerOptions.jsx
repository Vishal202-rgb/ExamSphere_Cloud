// ==============================================================================
// ExamSphere – Answer Options Component
// Renders Single-Choice, Multiple-Choice, and True/False interactive options
// ==============================================================================

import React from 'react';
import { Check, Circle } from 'lucide-react';

export default function AnswerOptions({
  questionType = 'SINGLE_MCQ',
  options = [],
  selectedOptionIds = [],
  onSelectOption,
  onToggleMultipleOption,
  disabled = false,
}) {
  const isMultiple = questionType === 'MULTIPLE_MCQ';
  const isTrueFalse = questionType === 'TRUE_FALSE';

  if (!options || options.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-500 text-center">
        No options specified for this question.
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4" id="exam-answer-options" role="group" aria-label="Question options">
      {options.map((option, index) => {
        const isSelected = selectedOptionIds.includes(option.id);
        const optionLabel = String.fromCharCode(65 + index); // A, B, C, D

        const handleClick = () => {
          if (disabled) return;
          if (isMultiple) {
            onToggleMultipleOption(option.id);
          } else {
            onSelectOption(option.id);
          }
        };

        return (
          <button
            key={option.id}
            type="button"
            onClick={handleClick}
            disabled={disabled}
            aria-pressed={isSelected}
            className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-start gap-4 ${
              isSelected
                ? 'border-2 border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-md shadow-emerald-500/10'
                : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700 text-slate-300'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {/* Option Index Badge or Checkbox */}
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                isSelected
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {isSelected ? (
                <Check className="w-4 h-4 stroke-[3]" />
              ) : (
                optionLabel
              )}
            </div>

            {/* Option Content Text */}
            <div className="flex-1 text-sm pt-0.5 leading-relaxed select-none">
              {option.optionText}
            </div>

            {/* Radio / Checkbox Indicator on right */}
            <div className="shrink-0 pt-1 text-xs">
              {isMultiple ? (
                <div
                  className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                    isSelected ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-700'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-slate-950 stroke-[3]" />}
                </div>
              ) : (
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    isSelected ? 'border-emerald-500' : 'border-slate-700'
                  }`}
                >
                  {isSelected && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
