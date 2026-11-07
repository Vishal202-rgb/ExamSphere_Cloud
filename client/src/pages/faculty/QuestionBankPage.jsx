import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api.js';
import { useToast } from '../../components/common/Toast.jsx';
import CreateEditQuestionModal from './components/CreateEditQuestionModal.jsx';
import QuestionPreviewModal from './components/QuestionPreviewModal.jsx';
import BulkImportModal from './components/BulkImportModal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import {
  HelpCircle,
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  BookOpen,
  Award,
  Tag,
  CheckSquare,
  CheckCircle2,
  FileText,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export default function QuestionBankPage() {
  const { showToast } = useToast();

  const [questions, setQuestions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ totalCount: 0, totalPages: 1, currentPage: 1 });

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState(null);
  const [editQuestion, setEditQuestion] = useState(null);
  const [deleteConfirmQuestion, setDeleteConfirmQuestion] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch faculty courses for selector
  const fetchCourses = async () => {
    try {
      const res = await api.get('/faculty/courses');
      const courseList = res?.data || [];
      setCourses(courseList);
    } catch {
      // Non-blocking error
    }
  };

  // Fetch questions
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit,
      };
      if (search.trim()) params.search = search.trim();
      if (selectedCourse) params.courseId = selectedCourse;
      if (selectedType) params.type = selectedType;
      if (selectedDifficulty) params.difficulty = selectedDifficulty;

      const res = await api.get('/questions', { params });
      const questionList = Array.isArray(res?.data)
        ? res.data
        : (res?.data?.questions || res?.data?.data || []);
      setQuestions(questionList);
      setPagination(res?.pagination || res?.data?.pagination || { totalCount: questionList.length, totalPages: 1, currentPage: 1 });
    } catch (err) {
      setError(err?.message || 'Failed to retrieve questions.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, selectedCourse, selectedType, selectedDifficulty]);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedCourse('');
    setSelectedType('');
    setSelectedDifficulty('');
    setPage(1);
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCourse) params.append('courseId', selectedCourse);
      if (selectedType) params.append('type', selectedType);
      if (selectedDifficulty) params.append('difficulty', selectedDifficulty);

      const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'}/questions/export?${params.toString()}`;

      // Open in window or fetch blob
      const token = localStorage.getItem('examsphere_token');
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to export questions');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `question_bank_export_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      showToast('Exported questions to CSV successfully!', 'success');
    } catch (err) {
      showToast(err?.message || 'Failed to export questions', 'error');
    }
  };

  const handleDeleteQuestion = async () => {
    if (!deleteConfirmQuestion) return;
    setDeleting(true);
    try {
      await api.delete(`/questions/${deleteConfirmQuestion.id}`);
      showToast('Question deleted / archived successfully!', 'success');
      setDeleteConfirmQuestion(null);
      fetchQuestions();
    } catch (err) {
      showToast(err?.message || 'Failed to delete question', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const getDifficultyBadge = (difficulty) => {
    switch (difficulty) {
      case 'EASY':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-semibold';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-semibold';
      case 'HARD':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-semibold';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'SINGLE_MCQ':
        return { label: 'Single MCQ', icon: HelpCircle, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' };
      case 'MULTIPLE_MCQ':
        return { label: 'Multi MCQ', icon: CheckSquare, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
      case 'TRUE_FALSE':
        return { label: 'True / False', icon: CheckCircle2, color: 'text-teal-400 bg-teal-500/10 border-teal-500/30' };
      case 'DESCRIPTIVE':
        return { label: 'Descriptive', icon: FileText, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
      default:
        return { label: type, icon: HelpCircle, color: 'text-slate-400 bg-slate-800 border-slate-700' };
    }
  };

  // Metrics calculation
  const totalCount = pagination.totalCount || 0;
  const singleMcqCount = questions.filter((q) => q.type === 'SINGLE_MCQ').length;
  const multiMcqCount = questions.filter((q) => q.type === 'MULTIPLE_MCQ').length;
  const tfCount = questions.filter((q) => q.type === 'TRUE_FALSE').length;
  const descriptiveCount = questions.filter((q) => q.type === 'DESCRIPTIVE').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-slate-100 flex items-center gap-2.5">
            <HelpCircle className="w-6 h-6 text-purple-400" />
            <span>Faculty Question Bank</span>
          </h1>
          <p className="text-xs text-slate-400">
            Curate single MCQ, multiple-correct MCQ, True/False and descriptive rubric questions with granular marks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition"
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span>Bulk Import (CSV)</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              setEditQuestion(null);
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Question</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl glass-panel border border-purple-500/30 bg-slate-navy/80 shadow-md">
          <span className="text-[11px] font-medium text-slate-400 block">Total Questions</span>
          <span className="text-xl font-bold text-purple-400 mt-1 block">{totalCount}</span>
        </div>
        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/30 bg-slate-navy/80 shadow-md">
          <span className="text-[11px] font-medium text-slate-400 block">Single MCQ</span>
          <span className="text-xl font-bold text-cyan-400 mt-1 block">{singleMcqCount}</span>
        </div>
        <div className="p-4 rounded-2xl glass-panel border border-blue-500/30 bg-slate-navy/80 shadow-md">
          <span className="text-[11px] font-medium text-slate-400 block">Multi MCQ</span>
          <span className="text-xl font-bold text-blue-400 mt-1 block">{multiMcqCount}</span>
        </div>
        <div className="p-4 rounded-2xl glass-panel border border-teal-500/30 bg-slate-navy/80 shadow-md">
          <span className="text-[11px] font-medium text-slate-400 block">True / False</span>
          <span className="text-xl font-bold text-teal-400 mt-1 block">{tfCount}</span>
        </div>
        <div className="p-4 rounded-2xl glass-panel border border-sky-500/30 bg-slate-navy/80 col-span-2 sm:col-span-1 shadow-md">
          <span className="text-[11px] font-medium text-slate-400 block">Descriptive</span>
          <span className="text-xl font-bold text-sky-400 mt-1 block">{descriptiveCount}</span>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="p-3.5 rounded-2xl glass-panel border border-slate-800 bg-slate-navy/90 space-y-3 shadow-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by title, prompt or topic..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
            />
          </div>

          {/* Course filter */}
          <div>
            <select
              value={selectedCourse}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Assigned Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} – {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Question Types</option>
              <option value="SINGLE_MCQ">Single MCQ</option>
              <option value="MULTIPLE_MCQ">Multiple MCQ</option>
              <option value="TRUE_FALSE">True / False</option>
              <option value="DESCRIPTIVE">Descriptive</option>
            </select>
          </div>

          {/* Difficulty filter */}
          <div>
            <select
              value={selectedDifficulty}
              onChange={(e) => {
                setSelectedDifficulty(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Difficulties</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 text-xs">
          <span className="text-slate-400">
            Showing {questions.length} of {totalCount} total question{totalCount !== 1 ? 's' : ''}
          </span>
          {(search || selectedCourse || selectedType || selectedDifficulty) && (
            <button
              onClick={handleResetFilters}
              className="text-blue-400 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Question Table / List */}
      <div className="glass-panel border border-slate-800 rounded-2xl overflow-hidden bg-slate-navy/90 shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400" />
            <p className="text-xs">Loading question bank catalogue...</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <HelpCircle className="w-10 h-10 mx-auto text-slate-600" />
            <h4 className="text-sm font-bold text-slate-200">No Questions Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {search || selectedCourse || selectedType || selectedDifficulty
                ? 'Try adjusting your search criteria or resetting active filters.'
                : 'Start populating your question repository by adding a single MCQ or uploading a CSV template.'}
            </p>
            <div className="pt-2">
              <button
                onClick={() => {
                  setEditQuestion(null);
                  setIsCreateOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Question</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {questions.map((q) => {
              const typeInfo = getTypeBadge(q.type);
              const TypeIcon = typeInfo.icon;

              return (
                <div
                  key={q.id}
                  className="p-4 sm:p-5 hover:bg-slate-800/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border ${typeInfo.color}`}
                      >
                        <TypeIcon className="w-3 h-3" />
                        {typeInfo.label}
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${getDifficultyBadge(
                          q.difficulty
                        )}`}
                      >
                        {q.difficulty}
                      </span>

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Award className="w-3 h-3 text-emerald-400" />
                        +{q.marks} Marks
                        {Number(q.negativeMarks) > 0 && (
                          <span className="text-rose-400 ml-0.5">(-{q.negativeMarks})</span>
                        )}
                      </span>

                      {q.course && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                          <BookOpen className="w-3 h-3 text-blue-400" />
                          {q.course.code}
                        </span>
                      )}

                      {(q.topic || (Array.isArray(q.topicTags) && q.topicTags[0])) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          <Tag className="w-2.5 h-2.5 text-slate-400" />
                          {q.topic || q.topicTags[0]}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold text-slate-100 leading-snug">
                      {q.questionText || q.title}
                    </h3>

                    {q.options && q.options.length > 0 && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>{q.options.length} Options configured</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-medium">
                          {q.options.filter((o) => o.isCorrect).length} Correct Answer
                          {q.options.filter((o) => o.isCorrect).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => setPreviewQuestion(q)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 transition"
                      title="Inspect & Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setEditQuestion(q);
                        setIsCreateOpen(true);
                      }}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 transition"
                      title="Edit Question"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDeleteConfirmQuestion(q)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-400 hover:text-rose-300 transition"
                      title="Archive Question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-900/80">
            <span>
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 disabled:opacity-40 hover:bg-slate-700 text-slate-200 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 disabled:opacity-40 hover:bg-slate-700 text-slate-200 transition"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateEditQuestionModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setEditQuestion(null);
        }}
        onSuccess={fetchQuestions}
        courses={courses}
        questionToEdit={editQuestion}
        api={api}
        showToast={showToast}
      />

      <QuestionPreviewModal
        isOpen={Boolean(previewQuestion)}
        onClose={() => setPreviewQuestion(null)}
        question={previewQuestion}
      />

      <BulkImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={fetchQuestions}
        courses={courses}
        api={api}
        showToast={showToast}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteConfirmQuestion)}
        onClose={() => setDeleteConfirmQuestion(null)}
        onConfirm={handleDeleteQuestion}
        title="Archive Question"
        message={`Are you sure you want to delete/archive "${deleteConfirmQuestion?.title}"? It will no longer appear for exam additions.`}
        confirmText="Archive Question"
        isDestructive={true}
        isLoading={deleting}
      />
    </div>
  );
}
