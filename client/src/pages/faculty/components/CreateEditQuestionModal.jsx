import React, { useState, useEffect } from 'react';
import Modal from '../../../components/common/Modal.jsx';
import {
  Plus,
  Trash2,
  CheckCircle2,
  CheckSquare,
  HelpCircle,
  FileText,
  AlertCircle,
  Save,
  Tag,
  BookOpen,
} from 'lucide-react';

export default function CreateEditQuestionModal({
  isOpen,
  onClose,
  onSuccess,
  courses = [],
  questionToEdit = null,
  api,
  showToast,
}) {
  const isEditing = Boolean(questionToEdit);

  const [courseId, setCourseId] = useState('');
  const [type, setType] = useState('SINGLE_MCQ');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('');
  const [marks, setMarks] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(0);
  const [explanation, setExplanation] = useState('');

  // Options for MCQs
  const [options, setOptions] = useState([
    { optionText: '', isCorrect: true },
    { optionText: '', isCorrect: false },
    { optionText: '', isCorrect: false },
    { optionText: '', isCorrect: false },
  ]);

  // True/False state: which is correct ('TRUE' or 'FALSE')
  const [tfCorrect, setTfCorrect] = useState('TRUE');

  // Descriptive model answer
  const [descriptiveAnswer, setDescriptiveAnswer] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Pre-fill when editing or reset when creating
  useEffect(() => {
    if (questionToEdit) {
      setCourseId(questionToEdit.courseId || '');
      setType(questionToEdit.type || 'SINGLE_MCQ');
      setDifficulty(questionToEdit.difficulty || 'MEDIUM');
      setTitle(questionToEdit.questionText || questionToEdit.title || '');
      setDescription(questionToEdit.description || '');
      setTopic(
        questionToEdit.topic ||
        (Array.isArray(questionToEdit.topicTags) ? questionToEdit.topicTags.join(', ') : '')
      );
      setMarks(questionToEdit.marks ?? 1);
      setNegativeMarks(questionToEdit.negativeMarks ?? 0);
      setExplanation(questionToEdit.explanation || '');

      if (questionToEdit.type === 'TRUE_FALSE') {
        const trueOpt = questionToEdit.options?.find((o) => o.optionText?.toLowerCase() === 'true');
        setTfCorrect(trueOpt?.isCorrect ? 'TRUE' : 'FALSE');
      } else if (questionToEdit.type === 'DESCRIPTIVE') {
        setDescriptiveAnswer(questionToEdit.options?.[0]?.optionText || '');
      } else if (questionToEdit.options?.length > 0) {
        setOptions(
          questionToEdit.options.map((o) => ({
            optionText: o.optionText || '',
            isCorrect: Boolean(o.isCorrect),
          }))
        );
      }
    } else {
      setCourseId(courses[0]?.id || '');
      setType('SINGLE_MCQ');
      setDifficulty('MEDIUM');
      setTitle('');
      setDescription('');
      setTopic('');
      setMarks(1);
      setNegativeMarks(0);
      setExplanation('');
      setOptions([
        { optionText: '', isCorrect: true },
        { optionText: '', isCorrect: false },
        { optionText: '', isCorrect: false },
        { optionText: '', isCorrect: false },
      ]);
      setTfCorrect('TRUE');
      setDescriptiveAnswer('');
    }
    setFormError('');
  }, [questionToEdit, isOpen, courses]);

  // Handle Option text changes
  const handleOptionTextChange = (index, value) => {
    setOptions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], optionText: value };
      return copy;
    });
  };

  // Handle single MCQ radio selection
  const handleSingleSelect = (index) => {
    setOptions((prev) =>
      prev.map((opt, i) => ({
        ...opt,
        isCorrect: i === index,
      }))
    );
  };

  // Handle multiple MCQ checkbox toggle
  const handleMultipleToggle = (index) => {
    setOptions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], isCorrect: !copy[index].isCorrect };
      return copy;
    });
  };

  // Add new option
  const addOption = () => {
    if (options.length >= 8) {
      showToast('Maximum 8 options supported', 'error');
      return;
    }
    setOptions((prev) => [...prev, { optionText: '', isCorrect: false }]);
  };

  // Remove option
  const removeOption = (index) => {
    if (options.length <= 2) {
      showToast('At least 2 options are required for MCQ questions', 'error');
      return;
    }
    setOptions((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      // If none is correct after removal, set first one as correct
      if (type === 'SINGLE_MCQ' && !filtered.some((o) => o.isCorrect)) {
        filtered[0].isCorrect = true;
      }
      return filtered;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim()) {
      setFormError('Question prompt / title is required');
      return;
    }
    if (!courseId) {
      setFormError('Please select a course for this question');
      return;
    }
    if (Number(marks) <= 0) {
      setFormError('Marks must be greater than 0');
      return;
    }

    let payloadOptions = [];

    if (type === 'SINGLE_MCQ') {
      if (options.length < 2) {
        setFormError('Single MCQ requires at least 2 options');
        return;
      }
      const emptyOpt = options.some((o) => !o.optionText.trim());
      if (emptyOpt) {
        setFormError('All option fields must have text');
        return;
      }
      const correctCount = options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        setFormError('Single MCQ must have exactly one correct option selected');
        return;
      }
      payloadOptions = options.map((o) => ({
        optionText: o.optionText.trim(),
        isCorrect: o.isCorrect,
      }));
    } else if (type === 'MULTIPLE_MCQ') {
      if (options.length < 2) {
        setFormError('Multiple MCQ requires at least 2 options');
        return;
      }
      const emptyOpt = options.some((o) => !o.optionText.trim());
      if (emptyOpt) {
        setFormError('All option fields must have text');
        return;
      }
      const correctCount = options.filter((o) => o.isCorrect).length;
      if (correctCount < 1) {
        setFormError('Multiple MCQ must have at least one correct option checked');
        return;
      }
      payloadOptions = options.map((o) => ({
        optionText: o.optionText.trim(),
        isCorrect: o.isCorrect,
      }));
    } else if (type === 'TRUE_FALSE') {
      payloadOptions = [
        { optionText: 'True', isCorrect: tfCorrect === 'TRUE' },
        { optionText: 'False', isCorrect: tfCorrect === 'FALSE' },
      ];
    } else if (type === 'DESCRIPTIVE') {
      if (descriptiveAnswer.trim()) {
        payloadOptions = [
          { optionText: descriptiveAnswer.trim(), isCorrect: true },
        ];
      }
    }

    const payload = {
      courseId,
      type,
      difficulty,
      questionText: title.trim(),
      title: title.trim(),
      description: description.trim() || undefined,
      topicTags: topic.trim() ? topic.split(',').map((t) => t.trim()).filter(Boolean) : [],
      topic: topic.trim() || undefined,
      marks: Number(marks),
      negativeMarks: Number(negativeMarks) || 0,
      explanation: explanation.trim() || undefined,
      options: payloadOptions.map((opt, idx) => ({ ...opt, orderIndex: idx })),
    };

    setSubmitting(true);
    try {
      if (isEditing) {
        await api.put(`/questions/${questionToEdit.id}`, payload);
        showToast('Question updated successfully!', 'success');
      } else {
        await api.post('/questions', payload);
        showToast('Question created successfully in bank!', 'success');
      }
      onSuccess();
      onClose();
    } catch (err) {
      let errorMsg = err?.response?.data?.message || err?.message || 'Failed to save question';
      if (err?.response?.data?.errors?.length > 0) {
        const details = err.response.data.errors.map((e) => `${e.field}: ${e.message}`).join(', ');
        errorMsg = `${errorMsg} (${details})`;
      }
      setFormError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Question' : 'Add Question to Bank'}
      subtitle={
        isEditing
          ? `Editing ${questionToEdit?.type} question`
          : 'Define question metadata, evaluation rules, and options'
      }
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{formError}</span>
          </div>
        )}

        {/* Row 1: Course & Question Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Course Assignment *
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={isEditing}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-60"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">
                  {c.code} – {c.title || c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Question Type *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={isEditing}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-60"
            >
              <option value="SINGLE_MCQ" className="bg-slate-900 text-slate-100">Single MCQ (1 Correct)</option>
              <option value="MULTIPLE_MCQ" className="bg-slate-900 text-slate-100">Multiple MCQ (1 or more correct)</option>
              <option value="TRUE_FALSE" className="bg-slate-900 text-slate-100">True / False</option>
              <option value="DESCRIPTIVE" className="bg-slate-900 text-slate-100">Descriptive / Rubric</option>
            </select>
          </div>
        </div>

        {/* Row 2: Difficulty, Marks, Negative Marks */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Difficulty *
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="EASY" className="bg-slate-900 text-emerald-400">Easy</option>
              <option value="MEDIUM" className="bg-slate-900 text-amber-400">Medium</option>
              <option value="HARD" className="bg-slate-900 text-rose-400">Hard</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Marks (+)*
            </label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              required
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Negative Marks (-)
            </label>
            <input
              type="number"
              min="0"
              step="0.25"
              value={negativeMarks}
              onChange={(e) => setNegativeMarks(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Row 3: Topic Tag */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
            Topic Tag
          </label>
          <div className="relative">
            <Tag className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="e.g. Asymptotic Complexity, Binary Trees, SQL Joins"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Question Title Prompt */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
            Question Prompt / Statement *
          </label>
          <textarea
            rows="3"
            placeholder="Type your question statement here..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
          />
        </div>

        {/* Description / Code Snippet */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
            Additional Context / Code Snippet (Optional)
          </label>
          <textarea
            rows="2"
            placeholder="Provide context, references, or code block..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-blue-500 placeholder:text-slate-500 font-mono"
          />
        </div>

        {/* Dynamic Options Manager Based on Type */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              {type === 'SINGLE_MCQ' && <HelpCircle className="w-3.5 h-3.5 text-blue-400" />}
              {type === 'MULTIPLE_MCQ' && <CheckSquare className="w-3.5 h-3.5 text-purple-400" />}
              {type === 'TRUE_FALSE' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              {type === 'DESCRIPTIVE' && <FileText className="w-3.5 h-3.5 text-cyan-400" />}
              Answer Configuration & Correct Option
            </span>
            {(type === 'SINGLE_MCQ' || type === 'MULTIPLE_MCQ') && (
              <button
                type="button"
                onClick={addOption}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition"
              >
                <Plus className="w-3 h-3" />
                Add Option
              </button>
            )}
          </div>

          {/* SINGLE_MCQ Options */}
          {type === 'SINGLE_MCQ' && (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-400">
                Select the radio button beside the single correct answer:
              </p>
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="single_mcq_correct"
                    checked={opt.isCorrect}
                    onChange={() => handleSingleSelect(idx)}
                    className="w-4 h-4 text-blue-600 bg-slate-950 border-slate-700 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={opt.optionText}
                    onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + idx)} text`}
                    className={`flex-1 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none transition ${
                      opt.isCorrect
                        ? 'border border-blue-500/60 bg-blue-500/10 font-semibold text-white'
                        : 'border border-slate-800 bg-slate-950/70 focus:border-blue-500'
                    }`}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition"
                      title="Remove option"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* MULTIPLE_MCQ Options */}
          {type === 'MULTIPLE_MCQ' && (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-400">
                Check all options that are correct answers (one or more):
              </p>
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={opt.isCorrect}
                    onChange={() => handleMultipleToggle(idx)}
                    className="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-700 focus:ring-purple-500 accent-purple-600 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={opt.optionText}
                    onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + idx)} text`}
                    className={`flex-1 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none transition ${
                      opt.isCorrect
                        ? 'border border-purple-500/60 bg-purple-500/10 font-semibold text-white'
                        : 'border border-slate-800 bg-slate-950/70 focus:border-purple-500'
                    }`}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition"
                      title="Remove option"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TRUE_FALSE Options */}
          {type === 'TRUE_FALSE' && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setTfCorrect('TRUE')}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold transition ${
                  tfCorrect === 'TRUE'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/20'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span>True</span>
                {tfCorrect === 'TRUE' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={() => setTfCorrect('FALSE')}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold transition ${
                  tfCorrect === 'FALSE'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm shadow-rose-500/20'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span>False</span>
                {tfCorrect === 'FALSE' && <CheckCircle2 className="w-4 h-4 text-rose-400" />}
              </button>
            </div>
          )}

          {/* DESCRIPTIVE Guidelines */}
          {type === 'DESCRIPTIVE' && (
            <div className="space-y-2">
              <label className="block text-[11px] text-slate-400">
                Model Answer Key / Evaluation Rubric (Optional)
              </label>
              <textarea
                rows="3"
                value={descriptiveAnswer}
                onChange={(e) => setDescriptiveAnswer(e.target.value)}
                placeholder="Key concepts or keywords expected in student response..."
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500"
              />
            </div>
          )}
        </div>

        {/* Explanation / Faculty Solution Notes */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
            Faculty Solution Explanation (Shown in review)
          </label>
          <textarea
            rows="2"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Detailed rationale explaining why the answer is correct..."
            className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition flex items-center gap-1.5"
          >
            {submitting ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{isEditing ? 'Save Changes' : 'Create Question'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
