import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import { useToast } from '../../components/common/Toast.jsx';
import ExamDetailsModal from './components/ExamDetailsModal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import {
  FileCheck2,
  Plus,
  Search,
  Filter,
  Eye,
  Send,
  XCircle,
  Trash2,
  RefreshCw,
  Clock,
  Calendar,
  Award,
  BookOpen,
  Users2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Activity,
} from 'lucide-react';

export default function ExamsListPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [exams, setExams] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ totalCount: 0, totalPages: 1, currentPage: 1 });

  // Modals state
  const [inspectExam, setInspectExam] = useState(null);
  const [publishTargetExam, setPublishTargetExam] = useState(null);
  const [cancelTargetExam, setCancelTargetExam] = useState(null);
  const [deleteTargetExam, setDeleteTargetExam] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [metrics, setMetrics] = useState(null);

  const fetchCourses = async () => {
    try {
      const res = await api.get('/faculty/courses');
      setCourses(res?.data || []);
    } catch {
      // Non-blocking
    }
  };

  const fetchExams = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit };
      if (search.trim()) params.search = search.trim();
      if (selectedCourse) params.courseId = selectedCourse;
      if (selectedStatus) params.status = selectedStatus;

      const res = await api.get('/exams', { params });
      const examsList = Array.isArray(res?.data)
        ? res.data
        : (Array.isArray(res?.data?.exams)
          ? res.data.exams
          : (Array.isArray(res?.exams) ? res.exams : []));
      setExams(examsList);

      const pag = res?.pagination || res?.data?.pagination || {
        total: examsList.length,
        totalCount: examsList.length,
        totalPages: 1,
        page: 1,
      };
      setPagination({
        totalCount: pag.total ?? pag.totalCount ?? examsList.length,
        totalPages: pag.totalPages || 1,
        currentPage: pag.page ?? pag.currentPage ?? 1,
      });

      if (res?.metrics || res?.data?.metrics) {
        setMetrics(res?.metrics || res?.data?.metrics);
      }
    } catch (err) {
      setError(err?.message || 'Failed to retrieve examinations.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, selectedCourse, selectedStatus]);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // Publish handler
  const handlePublishExam = async () => {
    if (!publishTargetExam) return;
    setActionLoading(true);
    try {
      await api.patch(`/exams/${publishTargetExam.id}/publish`);
      showToast('Examination published successfully!', 'success');
      setPublishTargetExam(null);
      fetchExams();
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || 'Failed to publish examination', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel handler
  const handleCancelExam = async () => {
    if (!cancelTargetExam) return;
    setActionLoading(true);
    try {
      await api.patch(`/exams/${cancelTargetExam.id}/cancel`);
      showToast('Examination cancelled.', 'info');
      setCancelTargetExam(null);
      fetchExams();
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || 'Failed to cancel examination', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete handler
  const handleDeleteExam = async () => {
    if (!deleteTargetExam) return;
    setActionLoading(true);
    try {
      await api.delete(`/exams/${deleteTargetExam.id}`);
      showToast('Examination draft deleted.', 'success');
      setDeleteTargetExam(null);
      fetchExams();
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || 'Failed to delete examination', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'SCHEDULED':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30 font-semibold';
      case 'LIVE':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold shadow-sm shadow-emerald-500/20';
      case 'COMPLETED':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'CANCELLED':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30 line-through';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  // Metrics calculation
  const totalCount = metrics?.total ?? pagination.totalCount ?? exams.length;
  const draftCount = metrics?.DRAFT ?? exams.filter((e) => e.status === 'DRAFT').length;
  const scheduledCount = metrics?.SCHEDULED ?? exams.filter((e) => e.status === 'SCHEDULED').length;
  const liveCount = metrics?.LIVE ?? exams.filter((e) => e.status === 'LIVE').length;
  const completedCount = metrics?.COMPLETED ?? exams.filter((e) => e.status === 'COMPLETED').length;
  const cancelledCount = metrics?.CANCELLED ?? exams.filter((e) => e.status === 'CANCELLED').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <span>Faculty Examination Console</span>
          </h1>
          <p className="text-xs text-slate-400">
            Manage examination schedules, question associations, student assignments, and live status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchExams}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => navigate('/faculty/exams/create')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-md shadow-blue-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Examination</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl border border-blue-500/30 bg-slate-navy/90 shadow-sm">
          <span className="text-[11px] font-medium text-slate-400 block">Total Exams</span>
          <span className="text-xl font-bold text-white mt-1 block">{totalCount}</span>
        </div>
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-navy/90 shadow-sm">
          <span className="text-[11px] font-medium text-slate-400 block">Drafts</span>
          <span className="text-xl font-bold text-slate-200 mt-1 block">{draftCount}</span>
        </div>
        <div className="p-4 rounded-xl border border-cyan-500/30 bg-slate-navy/90 shadow-sm">
          <span className="text-[11px] font-medium text-cyan-400 block">Scheduled</span>
          <span className="text-xl font-bold text-cyan-300 mt-1 block">{scheduledCount}</span>
        </div>
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-slate-navy/90 shadow-sm">
          <span className="text-[11px] font-medium text-emerald-400 block">Live Now</span>
          <span className="text-xl font-bold text-emerald-300 mt-1 block flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
            {liveCount}
          </span>
        </div>
        <div className="p-4 rounded-xl border border-purple-500/30 bg-slate-navy/90 shadow-sm">
          <span className="text-[11px] font-medium text-purple-400 block">Completed</span>
          <span className="text-xl font-bold text-purple-300 mt-1 block">{completedCount}</span>
        </div>
        <div className="p-4 rounded-xl border border-rose-500/30 bg-slate-navy/90 shadow-sm">
          <span className="text-[11px] font-medium text-rose-400 block">Cancelled</span>
          <span className="text-xl font-bold text-rose-300 mt-1 block">{cancelledCount}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-navy/90 space-y-3 shadow-lg">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by exam title..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
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
              className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="" className="bg-slate-900 text-slate-100">All Assigned Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">
                  {c.code} – {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="" className="bg-slate-900 text-slate-100">All Statuses</option>
              <option value="DRAFT" className="bg-slate-900 text-slate-300">Draft</option>
              <option value="SCHEDULED" className="bg-slate-900 text-blue-400">Scheduled</option>
              <option value="LIVE" className="bg-slate-900 text-emerald-400">Live</option>
              <option value="COMPLETED" className="bg-slate-900 text-purple-400">Completed</option>
              <option value="CANCELLED" className="bg-slate-900 text-rose-400">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
          <span>
            Showing {exams.length} of {totalCount} examination{totalCount !== 1 ? 's' : ''}
          </span>
          {(search || selectedCourse || selectedStatus) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedCourse('');
                setSelectedStatus('');
                setPage(1);
              }}
              className="text-blue-400 hover:text-blue-300 font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Examinations Table / Cards */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-navy/90 shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400" />
            <p className="text-xs">Loading examinations roster...</p>
          </div>
        ) : exams.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileCheck2 className="w-10 h-10 mx-auto text-slate-600" />
            <h4 className="text-sm font-bold text-slate-200">No Examinations Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {search || selectedCourse || selectedStatus
                ? 'Try resetting your search or filter selections.'
                : 'No examinations created yet. Use the examination creation wizard to schedule your first exam.'}
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('/faculty/exams/create')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-md shadow-blue-600/30 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Launch Exam Wizard</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="p-5 hover:bg-slate-800/40 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Left Information */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(
                        exam.status
                      )}`}
                    >
                      {exam.status === 'LIVE' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                      {exam.status}
                    </span>

                    {exam.courses && exam.courses.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        <BookOpen className="w-3 h-3 text-blue-400" />
                        {exam.courses.map((c) => c.course?.code || c.code).join(', ')}
                      </span>
                    ) : exam.course ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        <BookOpen className="w-3 h-3 text-blue-400" />
                        {exam.course.code} – {exam.course.name || exam.course.title}
                      </span>
                    ) : null}

                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                      <Award className="w-3 h-3 text-purple-400" />
                      {exam.totalMarks} Total Marks
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      {exam.durationMinutes} Mins
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                      <HelpCircle className="w-3 h-3 text-indigo-400" />
                      {exam.questions?.length || 0} Questions
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <Users2 className="w-3 h-3 text-emerald-400" />
                      {exam.assignments?.length || 0} Candidates
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white">{exam.title}</h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Start: {exam.startTime ? new Date(exam.startTime).toLocaleString() : 'Immediate'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      End: {exam.endTime ? new Date(exam.endTime).toLocaleString() : 'Open'}
                    </span>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 self-start lg:self-center">
                  <button
                    onClick={() => setInspectExam(exam)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition"
                    title="View Full Specification"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </button>

                  {/* Submissions & Results Link */}
                  {exam.status !== 'DRAFT' && (
                    <button
                      onClick={() => navigate(`/faculty/exams/${exam.id}/submissions`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 text-xs font-semibold text-purple-300 transition"
                      title="View student submissions and grades"
                    >
                      <FileCheck2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>Submissions</span>
                    </button>
                  )}

                  {/* Live Monitoring Link */}
                  {(exam.status === 'LIVE' || exam.status === 'SCHEDULED') && (
                    <button
                      onClick={() => navigate(`/faculty/exams/${exam.id}/monitoring`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-slate-950 shadow-md shadow-emerald-600/30 transition"
                      title="Live exam presence & telemetries"
                    >
                      <Activity className="w-3.5 h-3.5 text-slate-950" />
                      <span>Live Monitor</span>
                    </button>
                  )}

                  {/* Publish action for DRAFT exams */}
                  {exam.status === 'DRAFT' && (
                    <button
                      onClick={() => setPublishTargetExam(exam)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-md shadow-blue-600/30 transition"
                      title="Publish examination to students"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Publish</span>
                    </button>
                  )}

                  {/* Cancel action for active or scheduled exams */}
                  {(exam.status === 'DRAFT' || exam.status === 'SCHEDULED' || exam.status === 'LIVE') && (
                    <button
                      onClick={() => setCancelTargetExam(exam)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-400 hover:text-rose-400 transition"
                      title="Cancel examination"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}

                  {/* Delete action for DRAFT exams */}
                  {exam.status === 'DRAFT' && (
                    <button
                      onClick={() => setDeleteTargetExam(exam)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 border border-slate-700 text-slate-400 hover:text-rose-400 transition"
                      title="Delete draft examination"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-900/60">
            <span>
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 disabled:opacity-40 hover:bg-slate-700 text-slate-200 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 disabled:opacity-40 hover:bg-slate-700 text-slate-200 transition"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals & Confirm Dialogs */}
      <ExamDetailsModal
        isOpen={Boolean(inspectExam)}
        onClose={() => setInspectExam(null)}
        exam={inspectExam}
      />

      <ConfirmDialog
        isOpen={Boolean(publishTargetExam)}
        onClose={() => setPublishTargetExam(null)}
        onConfirm={handlePublishExam}
        title="Publish Examination"
        message={`Are you sure you want to publish "${publishTargetExam?.title}"? Once published, assigned candidates will be able to see the examination schedule.`}
        confirmText="Publish Exam"
        isLoading={actionLoading}
      />

      <ConfirmDialog
        isOpen={Boolean(cancelTargetExam)}
        onClose={() => setCancelTargetExam(null)}
        onConfirm={handleCancelExam}
        title="Cancel Examination"
        message={`Are you sure you want to cancel "${cancelTargetExam?.title}"? Its status will change to CANCELLED.`}
        confirmText="Cancel Exam"
        isDestructive={true}
        isLoading={actionLoading}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTargetExam)}
        onClose={() => setDeleteTargetExam(null)}
        onConfirm={handleDeleteExam}
        title="Delete Examination Draft"
        message={`Are you sure you want to delete draft "${deleteTargetExam?.title}"? This cannot be undone.`}
        confirmText="Delete Draft"
        isDestructive={true}
        isLoading={actionLoading}
      />
    </div>
  );
}
