import React from 'react';
import Modal from '../../../components/common/Modal.jsx';
import {
  HelpCircle,
  CheckSquare,
  CheckCircle2,
  FileText,
  Tag,
  BookOpen,
  Award,
  Sparkles,
  User,
  Calendar,
} from 'lucide-react';

export default function QuestionPreviewModal({
  isOpen,
  onClose,
  question,
}) {
  if (!question) return null;

  const getDifficultyBadge = (difficulty) => {
    switch (difficulty) {
      case 'EASY':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'HARD':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'SINGLE_MCQ':
        return { label: 'Single Choice MCQ', icon: HelpCircle };
      case 'MULTIPLE_MCQ':
        return { label: 'Multiple Choice MCQ', icon: CheckSquare };
      case 'TRUE_FALSE':
        return { label: 'True / False', icon: CheckCircle2 };
      case 'DESCRIPTIVE':
        return { label: 'Descriptive Rubric', icon: FileText };
      default:
        return { label: type, icon: HelpCircle };
    }
  };

  const typeInfo = getTypeBadge(question.type);
  const TypeIcon = typeInfo.icon;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Question Inspection & Preview"
      subtitle="Previewing question structure and answer key for faculty evaluation"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Top Metadata Badges */}
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-800">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-blue-500/30 bg-blue-500/15 text-blue-400">
            <TypeIcon className="w-3.5 h-3.5" />
            {typeInfo.label}
          </span>

          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${getDifficultyBadge(question.difficulty)}`}>
            {question.difficulty}
          </span>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <Award className="w-3.5 h-3.5 text-purple-400" />
            +{question.marks} Marks
            {Number(question.negativeMarks) > 0 && (
              <span className="text-rose-400 ml-1">(-{question.negativeMarks})</span>
            )}
          </span>

          {question.course && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              {question.course.code}
            </span>
          )}

          {(question.topic || (Array.isArray(question.topicTags) && question.topicTags[0])) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700">
              <Tag className="w-3 h-3 text-slate-400" />
              {question.topic || (Array.isArray(question.topicTags) ? question.topicTags.join(', ') : '')}
            </span>
          )}
        </div>

        {/* Question Statement */}
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-100 leading-relaxed">
            {question.questionText || question.title}
          </h4>

          {question.description && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap">
              {question.description}
            </div>
          )}
        </div>

        {/* Options / Answer Preview */}
        <div className="space-y-2.5">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Answer Options & Key</span>
            <span className="text-[10px] text-blue-400 font-semibold">Faculty Verified</span>
          </div>

          {question.type === 'DESCRIPTIVE' ? (
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 block">
                Model Evaluation Rubric:
              </span>
              <p className="italic text-slate-300">
                {question.options?.[0]?.optionText || 'No rubric text specified.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {question.options?.map((opt, idx) => {
                const isCorrect = Boolean(opt.isCorrect);
                const letter = String.fromCharCode(65 + idx);

                return (
                  <div
                    key={opt.id || idx}
                    className={`flex items-center justify-between p-3 rounded-xl border transition ${
                      isCorrect
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/10'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold border ${
                          isCorrect
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="text-xs font-medium">{opt.optionText}</span>
                    </div>

                    {isCorrect && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        Correct
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Explanation / Faculty Solution Notes */}
        {question.explanation && (
          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/25 text-xs text-purple-200 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-purple-300">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Faculty Explanation & Rationale:
            </span>
            <p className="leading-relaxed text-slate-300">{question.explanation}</p>
          </div>
        )}

        {/* Question Footer info */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span>Authored by {question.creator?.fullName || 'Faculty'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{new Date(question.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition"
          >
            Close Preview
          </button>
        </div>
      </div>
    </Modal>
  );
}
