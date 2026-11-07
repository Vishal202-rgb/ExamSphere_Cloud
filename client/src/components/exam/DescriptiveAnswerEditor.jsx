// ==============================================================================
// ExamSphere – Descriptive Answer Editor Component
// Rich textarea input with word/character count for open-ended descriptive questions
// ==============================================================================

import React from 'react';
import { FileText } from 'lucide-react';

export default function DescriptiveAnswerEditor({
  value = '',
  onChange,
  disabled = false,
  maxLength = 10000,
}) {
  const charCount = value ? value.length : 0;
  const wordCount = value ? value.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="mt-4 space-y-2" id="exam-descriptive-editor">
      <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
        <span className="flex items-center gap-1.5 font-medium text-slate-300">
          <FileText className="w-3.5 h-3.5 text-blue-400" />
          Type your detailed response below:
        </span>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span>{wordCount} words</span>
          <span>•</span>
          <span className={charCount > maxLength * 0.9 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
            {charCount}/{maxLength} chars
          </span>
        </div>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Enter your descriptive explanation, derivation, or analysis here..."
        maxLength={maxLength}
        rows={10}
        aria-label="Descriptive answer input"
        className="w-full p-4 rounded-2xl bg-slate-950/80 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm leading-relaxed resize-y transition font-sans disabled:opacity-60"
      />
    </div>
  );
}
