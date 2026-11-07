import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api.js';
import {
  FileCheck2,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Download,
  Share2,
  Activity,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

export default function ExamSubmissionsPage() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [stats, setStats] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [evalFilter, setEvalFilter] = useState('');

  const fetchSubmissions = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (evalFilter) params.append('evaluationStatus', evalFilter);

      const res = await api.get(`/faculty/exams/${examId}/submissions?${params.toString()}`);
      if (res?.data) {
        setExam(res.data.exam);
        setStats(res.data.stats);
        setSubmissions(res.data.submissions || []);
      }
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [examId, statusFilter, evalFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSubmissions();
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get(`/faculty/exams/${examId}/results/export`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `results-${examId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('CSV export failed:', err);
    }
  };

  const handlePublishResults = async () => {
    if (!window.confirm('Are you sure you want to finalize competition rankings and publish results? All assigned students will be notified.')) {
      return;
    }

    try {
      setIsPublishing(true);
      const res = await api.post(`/faculty/exams/${examId}/publish-results`);
      if (res?.data) {
        setPublishMessage(`Successfully ranked & published ${res.data.publishedCount} results!`);
        fetchSubmissions();
      }
    } catch (err) {
      alert(err.message || 'Failed to publish results');
    } finally {
      setIsPublishing(false);
    }
  };

  const getEvaluationBadge = (status) => {
    switch (status) {
      case 'EVALUATED':
        return (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            EVALUATED
          </span>
        );
      case 'MANUAL_EVALUATION_PENDING':
        return (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            REVIEW PENDING
          </span>
        );
      case 'AUTO_EVALUATED':
        return (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
            AUTO EVALUATED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            PENDING
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <button
            onClick={() => navigate('/faculty/exams')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Examinations
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>{exam?.title || 'Examination Submissions'}</span>
            <span className="text-xs px-2.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 font-semibold font-mono">
              {exam?.course?.code}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Student submissions, manual descriptive grading, and score publication
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to={`/faculty/exams/${examId}/monitoring`}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-2"
          >
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            Live Monitoring
          </Link>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-slate-400" />
            Export CSV
          </button>

          <button
            onClick={handlePublishResults}
            disabled={isPublishing}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/30 transition flex items-center gap-2 disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            {isPublishing ? 'Publishing...' : 'Publish Results'}
          </button>
        </div>
      </div>

      {publishMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between">
          <span>{publishMessage}</span>
          <button onClick={() => setPublishMessage(null)} className="text-emerald-400 hover:text-emerald-300">✕</button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-blue-500/30 bg-slate-navy/90 space-y-1 shadow-md">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            Total Submissions
          </span>
          <p className="text-2xl font-bold text-white">{stats?.totalSubmissions || 0}</p>
        </div>

        <div className="p-4 rounded-xl border border-emerald-500/30 bg-slate-navy/90 space-y-1 shadow-md">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            Fully Evaluated
          </span>
          <p className="text-2xl font-bold text-emerald-400">{stats?.evaluated || 0}</p>
        </div>

        <div className="p-4 rounded-xl border border-amber-500/30 bg-slate-navy/90 space-y-1 shadow-md">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            Pending Manual Review
          </span>
          <p className="text-2xl font-bold text-amber-400">{stats?.pendingManual || 0}</p>
        </div>

        <div className="p-4 rounded-xl border border-purple-500/30 bg-slate-navy/90 space-y-1 shadow-md">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            Currently In Progress
          </span>
          <p className="text-2xl font-bold text-purple-400">{stats?.inProgress || 0}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-navy/90 flex flex-col md:flex-row gap-3 items-center justify-between shadow-lg">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by student name, roll..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={evalFilter}
            onChange={(e) => setEvalFilter(e.target.value)}
            className="bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
          >
            <option value="" className="bg-slate-900 text-slate-100">All Evaluation Statuses</option>
            <option value="EVALUATED" className="bg-slate-900 text-emerald-400">Evaluated</option>
            <option value="MANUAL_EVALUATION_PENDING" className="bg-slate-900 text-amber-400">Manual Review Pending</option>
            <option value="AUTO_EVALUATED" className="bg-slate-900 text-blue-400">Auto Evaluated</option>
            <option value="PENDING" className="bg-slate-900 text-slate-400">Pending</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
          >
            <option value="" className="bg-slate-900 text-slate-100">All Attempt Statuses</option>
            <option value="SUBMITTED" className="bg-slate-900 text-emerald-400">Submitted</option>
            <option value="AUTO_SUBMITTED" className="bg-slate-900 text-cyan-400">Auto Submitted (Timeout)</option>
            <option value="EVALUATED" className="bg-slate-900 text-purple-400">Evaluated</option>
            <option value="IN_PROGRESS" className="bg-slate-900 text-amber-400">In Progress</option>
          </select>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-navy/90 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">Batch / Section</th>
                <th className="py-3 px-4">Submission Reason</th>
                <th className="py-3 px-4">Evaluation Status</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-500 animate-pulse">
                    Loading student submissions...
                  </td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-500">
                    No submissions found matching filter criteria.
                  </td>
                </tr>
              ) : (
                submissions.map((sub) => (
                  <tr key={sub.attemptId} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{sub.student?.name}</div>
                      <div className="text-[11px] text-slate-400">{sub.student?.email}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {sub.student?.rollNumber || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {sub.student?.batch || '—'} ({sub.student?.section || '—'})
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] text-slate-300 font-medium">
                        {sub.submissionReason || (sub.status === 'IN_PROGRESS' ? 'Active' : 'MANUAL')}
                      </span>
                    </td>
                    <td className="py-3 px-4">{getEvaluationBadge(sub.evaluationStatus)}</td>
                    <td className="py-3 px-4">
                      {sub.obtainedMarks !== null ? (
                        <div className="font-bold text-white">
                          {sub.obtainedMarks} / {sub.totalMarks}{' '}
                          <span className="text-[11px] text-slate-400 font-normal">
                            ({sub.percentage}%)
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {sub.rank ? (
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold font-mono border border-blue-500/30">
                          #{sub.rank}
                        </span>
                      ) : (
                        <span className="text-slate-500">Unpublished</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/faculty/attempts/${sub.attemptId}/evaluate`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition"
                      >
                        <span>Evaluate</span>
                        <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
