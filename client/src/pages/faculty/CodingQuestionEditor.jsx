// ==============================================================================
// ExamSphere – Faculty Coding Question Authoring Editor (Phase 13)
// Configures coding problems, programming languages, sample & hidden test cases.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api.js';
import {
  Code2,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';

const SUPPORTED_LANGUAGES = [
  { id: 'javascript', label: 'JavaScript (Node.js)' },
  { id: 'python', label: 'Python 3' },
  { id: 'cpp', label: 'C++ (GCC)' },
  { id: 'java', label: 'Java (OpenJDK)' },
  { id: 'c', label: 'C (GCC)' },
];

export default function CodingQuestionEditor() {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(questionId);

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    courseId: '',
    questionText: '',
    difficulty: 'MEDIUM',
    marks: 10,
    negativeMarks: 0,
    topicTags: '',
    explanation: '',
    inputFormat: '',
    outputFormat: '',
    constraints: '',
    timeLimitSec: 2.0,
    memoryLimitMb: 256,
    evaluationPolicy: 'ALL_TEST_CASES', // 'ALL_TEST_CASES' | 'PERCENTAGE'
    allowedLanguages: ['javascript', 'python'],
    testCases: [
      {
        input: '2 3',
        expectedOutput: '5',
        isSample: true,
        explanation: '2 + 3 = 5',
        weight: 1.0,
      },
      {
        input: '100 200',
        expectedOutput: '300',
        isSample: false,
        explanation: '',
        weight: 1.0,
      },
    ],
  });

  // Load courses
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await api.get('/faculty/courses');
        if (res?.data) {
          setCourses(res.data);
          if (res.data.length > 0) {
            setFormData((prev) => (prev.courseId ? prev : { ...prev, courseId: res.data[0].id }));
          }
        }
      } catch {
        // Suppress
      }
    };
    fetchCourses();
  }, []);

  // Load existing question if editing
  useEffect(() => {
    if (!questionId) return;

    const fetchQuestion = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/coding/questions/${questionId}`);
        if (res?.data) {
          const q = res.data;
          const d = q.codingDetail || {};
          setFormData({
            courseId: q.courseId,
            questionText: q.questionText,
            difficulty: q.difficulty,
            marks: q.marks,
            negativeMarks: q.negativeMarks || 0,
            topicTags: (q.topicTags || []).join(', '),
            explanation: q.explanation || '',
            inputFormat: d.inputFormat || '',
            outputFormat: d.outputFormat || '',
            constraints: d.constraints || '',
            timeLimitSec: d.timeLimitSec || 2.0,
            memoryLimitMb: d.memoryLimitMb || 256,
            evaluationPolicy: d.evaluationPolicy || 'ALL_TEST_CASES',
            allowedLanguages: d.allowedLanguages || ['javascript', 'python'],
            testCases: (d.testCases || []).map((tc) => ({
              id: tc.id,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isSample: tc.isSample,
              explanation: tc.explanation || '',
              weight: tc.weight || 1.0,
            })),
          });
        }
      } catch (err) {
        setError(err.message || 'Failed to load question details');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestion();
  }, [questionId]);

  const handleLanguageToggle = (langId) => {
    setFormData((prev) => {
      const exists = prev.allowedLanguages.includes(langId);
      const updated = exists
        ? prev.allowedLanguages.filter((l) => l !== langId)
        : [...prev.allowedLanguages, langId];
      // Ensure at least one language is allowed
      return { ...prev, allowedLanguages: updated.length > 0 ? updated : prev.allowedLanguages };
    });
  };

  const handleAddTestCase = (isSample = false) => {
    setFormData((prev) => ({
      ...prev,
      testCases: [
        ...prev.testCases,
        {
          input: '',
          expectedOutput: '',
          isSample,
          explanation: '',
          weight: 1.0,
        },
      ],
    }));
  };

  const handleRemoveTestCase = (index) => {
    setFormData((prev) => ({
      ...prev,
      testCases: prev.testCases.filter((_, idx) => idx !== index),
    }));
  };

  const handleTestCaseChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.testCases];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, testCases: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.questionText.trim()) {
      setError('Problem statement cannot be empty');
      return;
    }

    if (formData.testCases.length === 0) {
      setError('Please configure at least one test case');
      return;
    }

    for (let i = 0; i < formData.testCases.length; i++) {
      if (!formData.testCases[i].expectedOutput.trim()) {
        setError(`Test case #${i + 1} must have an expected output string`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        questionText: formData.questionText.trim(),
        courseId: formData.courseId,
        difficulty: formData.difficulty,
        marks: parseFloat(formData.marks) || 10,
        negativeMarks: parseFloat(formData.negativeMarks) || 0,
        topicTags: formData.topicTags
          ? formData.topicTags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        explanation: formData.explanation.trim() || undefined,
        inputFormat: formData.inputFormat.trim() || undefined,
        outputFormat: formData.outputFormat.trim() || undefined,
        constraints: formData.constraints.trim() || undefined,
        timeLimitSec: parseFloat(formData.timeLimitSec) || 2.0,
        memoryLimitMb: parseInt(formData.memoryLimitMb, 10) || 256,
        evaluationPolicy: formData.evaluationPolicy,
        allowedLanguages: formData.allowedLanguages,
        testCases: formData.testCases.map((tc, idx) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isSample: Boolean(tc.isSample),
          explanation: tc.explanation || undefined,
          weight: parseFloat(tc.weight) || 1.0,
          orderIndex: idx,
        })),
      };

      if (isEditing) {
        await api.put(`/coding/questions/${questionId}`, payload);
        setSuccess('Coding question updated successfully!');
      } else {
        await api.post('/coding/questions', payload);
        setSuccess('Coding question created successfully!');
        setTimeout(() => navigate('/faculty/questions'), 1500);
      }
    } catch (err) {
      setError(err.message || 'Failed to save coding question');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <button
            onClick={() => navigate('/faculty/questions')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Question Bank</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <Code2 className="w-6 h-6 text-blue-400" />
            <span>{isEditing ? 'Edit Coding Problem' : 'Author Coding Problem'}</span>
          </h1>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving || loading}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/20 transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{isEditing ? 'Update Question' : 'Save Question'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* Basic Configuration Card */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-navy/90 backdrop-blur-xl shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Basic Problem Metadata</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">Target Course *</label>
              <select
                value={formData.courseId}
                onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-blue-500 transition"
                required
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">Difficulty</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-blue-500 transition"
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">Total Marks</label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={formData.marks}
                onChange={(e) => setFormData({ ...formData, marks: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono focus:outline-none focus:border-blue-500 transition"
                required
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">Evaluation Policy</label>
              <select
                value={formData.evaluationPolicy}
                onChange={(e) => setFormData({ ...formData, evaluationPolicy: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-blue-500 transition"
              >
                <option value="ALL_TEST_CASES">All-or-Nothing (100% or 0)</option>
                <option value="PERCENTAGE">Proportional (Per passed case)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1.5">Problem Statement / Prompt *</label>
            <textarea
              rows={4}
              value={formData.questionText}
              onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
              placeholder="Describe the problem, input requirements, expected solution logic..."
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-blue-500 leading-relaxed font-sans placeholder:text-slate-500 transition"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">Input Format (Optional)</label>
              <textarea
                rows={2}
                value={formData.inputFormat}
                onChange={(e) => setFormData({ ...formData, inputFormat: e.target.value })}
                placeholder="e.g. First line contains N, second contains array..."
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-blue-500 resize-none placeholder:text-slate-500 transition"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">Output Format (Optional)</label>
              <textarea
                rows={2}
                value={formData.outputFormat}
                onChange={(e) => setFormData({ ...formData, outputFormat: e.target.value })}
                placeholder="e.g. Print single integer answer..."
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-blue-500 resize-none placeholder:text-slate-500 transition"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">Constraints (Optional)</label>
              <textarea
                rows={2}
                value={formData.constraints}
                onChange={(e) => setFormData({ ...formData, constraints: e.target.value })}
                placeholder="e.g. 1 <= N <= 10^5, -1000 <= A[i] <= 1000"
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-blue-500 resize-none placeholder:text-slate-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Execution & Language Settings */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-navy/90 backdrop-blur-xl shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            <span>Execution Sandbox & Languages</span>
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-400">Supported Languages:</span>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const active = formData.allowedLanguages.includes(lang.id);
              return (
                <button
                  type="button"
                  key={lang.id}
                  onClick={() => handleLanguageToggle(lang.id)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                    active
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">Time Limit (Seconds)</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="10.0"
                value={formData.timeLimitSec}
                onChange={(e) => setFormData({ ...formData, timeLimitSec: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">Memory Limit (MB)</label>
              <input
                type="number"
                min="64"
                max="512"
                value={formData.memoryLimitMb}
                onChange={(e) => setFormData({ ...formData, memoryLimitMb: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Test Cases Builder */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-navy/90 backdrop-blur-xl shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Test Cases Configuration</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Configure sample cases (visible to student) and confidential hidden test cases for grading.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAddTestCase(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold text-xs flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Sample Case</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddTestCase(false)}
                className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 font-semibold text-xs flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Hidden Case</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {formData.testCases.map((tc, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-white">Test Case #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleTestCaseChange(idx, 'isSample', !tc.isSample)}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition ${
                        tc.isSample
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                      }`}
                    >
                      {tc.isSample ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      <span>{tc.isSample ? 'Sample (Visible)' : 'Hidden (Confidential)'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveTestCase(idx)}
                    className="text-slate-400 hover:text-red-400 transition p-1"
                    title="Remove Test Case"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                  <div>
                    <label className="text-slate-400 font-sans block mb-1">Standard Input (STDIN)</label>
                    <textarea
                      rows={2}
                      value={tc.input}
                      onChange={(e) => handleTestCaseChange(idx, 'input', e.target.value)}
                      placeholder="Input data string..."
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-blue-500 resize-none placeholder:text-slate-500 transition"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-sans block mb-1">Expected Output (STDOUT) *</label>
                    <textarea
                      rows={2}
                      value={tc.expectedOutput}
                      onChange={(e) => handleTestCaseChange(idx, 'expectedOutput', e.target.value)}
                      placeholder="Exact expected output..."
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-blue-500 resize-none placeholder:text-slate-500 transition"
                      required
                    />
                  </div>
                </div>

                {tc.isSample && (
                  <div>
                    <label className="text-slate-400 font-sans block mb-1">Explanation (Optional)</label>
                    <input
                      type="text"
                      value={tc.explanation}
                      onChange={(e) => handleTestCaseChange(idx, 'explanation', e.target.value)}
                      placeholder="Why this sample produces this output..."
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-2 text-slate-100 font-sans focus:outline-none focus:border-blue-500 placeholder:text-slate-500 transition"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
