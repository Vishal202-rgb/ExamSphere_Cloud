// ==============================================================================
// ExamSphere – Admin Institution & Department Analytics Dashboard (Phase 12)
// Enterprise-grade analytics portal with Recharts visualization and CSV report generation
// ==============================================================================

import React, { useState, useEffect, useCallback, Component } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api.js';
import {
  Users,
  GraduationCap,
  BookOpen,
  FileCheck2,
  Award,
  TrendingUp,
  Percent,
  CheckCircle2,
  Calendar,
  Filter,
  Download,
  RotateCcw,
  Loader2,
  AlertCircle,
  BarChart3,
  PieChart as PieIcon,
  Activity,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

/**
 * Robust Error Boundary to guarantee Admin Analytics never renders a completely blank page
 */
class AnalyticsErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Admin Analytics] Runtime render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-12 rounded-2xl border border-rose-500/30 bg-slate-navy/90 backdrop-blur-xl text-center space-y-4 shadow-xl">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <h2 className="text-base font-bold text-white">Analytics Visualization Encountered an Error</h2>
          <p className="text-xs text-rose-300 max-w-md mx-auto">
            {this.state.error?.message || 'An unexpected rendering error occurred while visualizing metrics.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onRetry) this.props.onRetry();
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition"
          >
            Retry Analytics View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AdminAnalyticsDashboardContent() {
  const { isAuthenticated, role, token } = useSelector((state) => state.auth);
  const isAdmin = Boolean(isAuthenticated && token && (role === 'ADMIN' || role === 'SUPER_ADMIN'));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  // Filter options lists
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Active filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    departmentId: '',
    courseId: '',
    batch: '',
    section: '',
  });

  // Load departments and courses for filter dropdowns safely
  useEffect(() => {
    if (!isAdmin) return;
    let isMounted = true;

    const loadOptions = async () => {
      try {
        const [deptRes, courseRes] = await Promise.all([
          api.get('/departments', { params: { limit: 100 } }).catch(() => null),
          api.get('/courses', { params: { limit: 100 } }).catch(() => null),
        ]);

        if (!isMounted) return;

        // Safely extract departments array from various response envelope structures
        const deptList =
          deptRes?.data?.departments ||
          deptRes?.data?.data ||
          (Array.isArray(deptRes?.data) ? deptRes.data : null) ||
          deptRes?.departments ||
          [];
        setDepartments(Array.isArray(deptList) ? deptList : []);

        // Safely extract courses array from various response envelope structures
        const courseList =
          courseRes?.data?.courses ||
          courseRes?.data?.data ||
          (Array.isArray(courseRes?.data) ? courseRes.data : null) ||
          courseRes?.courses ||
          [];
        setCourses(Array.isArray(courseList) ? courseList : []);
      } catch {
        // Suppress transient options load
      }
    };

    loadOptions();

    return () => {
      isMounted = false;
    };
  }, [isAdmin]);

  const fetchAnalytics = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const params = {};
      Object.keys(filters).forEach((key) => {
        if (filters[key]) params[key] = filters[key];
      });

      const res = await api.get('/analytics/admin/overview', { params });
      // Safely extract analytics overview & charts payload from response
      const payload = res?.data?.overview ? res.data : (res?.data || res);
      if (payload && typeof payload === 'object') {
        setData(payload);
      } else {
        setData(null);
      }
    } catch (err) {
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load system analytics';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }, [filters, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchAnalytics();
    }
  }, [fetchAnalytics, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 space-y-3">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        <p className="text-xs text-slate-400 font-mono tracking-wider uppercase animate-pulse">
          Verifying administrative authorization...
        </p>
      </div>
    );
  }

  const handleFilterChange = (key, val) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
  };

  const handleResetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      departmentId: '',
      courseId: '',
      batch: '',
      section: '',
    });
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = filters.departmentId ? { departmentId: filters.departmentId } : {};
      const res = await api.get('/analytics/reports/department-summary', {
        params,
        responseType: 'blob',
      });

      const blob = res instanceof Blob ? res : new Blob([res], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'examsphere_department_summary.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err?.message || 'Unable to generate CSV'}`);
    } finally {
      setExporting(false);
    }
  };

  const overview = data?.overview || {};
  const charts = data?.charts || {};

  return (
    <div className="space-y-6">
      {/* Top Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            <span>Institution & Department Analytics</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated institutional statistics, examination throughput, and academic performance distribution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={exporting || loading}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center gap-2 transition disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-blue-400" />
            )}
            <span>Export Summary (CSV)</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="p-3.5 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
          <Filter className="w-3.5 h-3.5 text-blue-400" />
          <span>Filters:</span>
        </div>

        {/* Department Filter */}
        <select
          value={filters.departmentId}
          onChange={(e) => handleFilterChange('departmentId', e.target.value)}
          className="bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Departments</option>
          {(Array.isArray(departments) ? departments : []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} - {d.name}
            </option>
          ))}
        </select>

        {/* Course Filter */}
        <select
          value={filters.courseId}
          onChange={(e) => handleFilterChange('courseId', e.target.value)}
          className="bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Courses</option>
          {(Array.isArray(courses) ? courses : []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} - {c.title}
            </option>
          ))}
        </select>

        {/* Batch Input */}
        <input
          type="text"
          placeholder="Batch (e.g. 2023-2027)"
          value={filters.batch}
          onChange={(e) => handleFilterChange('batch', e.target.value)}
          className="bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500 w-36 placeholder-slate-500"
        />

        {/* Section Input */}
        <input
          type="text"
          placeholder="Section (e.g. A)"
          value={filters.section}
          onChange={(e) => handleFilterChange('section', e.target.value)}
          className="bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500 w-24 placeholder-slate-500"
        />

        {/* Start Date */}
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => handleFilterChange('startDate', e.target.value)}
          className="bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500"
        />

        {/* End Date */}
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => handleFilterChange('endDate', e.target.value)}
          className="bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500"
        />

        {/* Reset */}
        <button
          onClick={handleResetFilters}
          className="ml-auto text-slate-400 hover:text-white flex items-center gap-1 transition px-2 py-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Loading, Error & Empty States */}
      {loading ? (
        <div className="p-16 rounded-2xl border border-slate-800 bg-slate-navy/90 text-center text-slate-400 flex flex-col items-center justify-center space-y-3 shadow-xl backdrop-blur-xl">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-sm font-medium">Aggregating analytical metrics...</p>
        </div>
      ) : error ? (
        <div className="p-12 rounded-2xl border border-slate-800 bg-slate-navy/90 text-center text-rose-400 space-y-3 shadow-xl backdrop-blur-xl">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition"
          >
            Retry Loading
          </button>
        </div>
      ) : !data || Object.keys(data).length === 0 ? (
        <div className="p-16 rounded-2xl border border-slate-800 bg-slate-navy/90 text-center text-slate-400 flex flex-col items-center justify-center space-y-3 shadow-xl backdrop-blur-xl">
          <BarChart3 className="w-10 h-10 text-slate-500" />
          <h3 className="text-sm font-semibold text-white">No Analytics Data Available</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            No analytical records match the current filter criteria.
          </p>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          {/* Top Primary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* Total Students */}
            <div className="p-4 rounded-2xl border border-blue-500/30 bg-slate-navy/90 backdrop-blur-xl shadow-lg shadow-blue-500/5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Active Students</span>
                <GraduationCap className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">{overview.totalStudents ?? 0}</div>
              <div className="text-[10px] text-blue-400 font-medium">Eligible candidates</div>
            </div>

            {/* Total Faculty */}
            <div className="p-4 rounded-2xl border border-purple-500/30 bg-slate-navy/90 backdrop-blur-xl shadow-lg shadow-purple-500/5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Faculty</span>
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">{overview.totalFaculty ?? 0}</div>
              <div className="text-[10px] text-purple-400 font-medium">Active instructors</div>
            </div>

            {/* Total Exams */}
            <div className="p-4 rounded-2xl border border-emerald-500/30 bg-slate-navy/90 backdrop-blur-xl shadow-lg shadow-emerald-500/5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Exams</span>
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white">{overview.totalExams ?? 0}</div>
              <div className="text-[10px] text-emerald-400 font-medium">
                {overview.activeExams ?? 0} Live / {overview.completedExams ?? 0} Done
              </div>
            </div>

            {/* Overall Avg Score */}
            <div className="p-4 rounded-2xl border border-cyan-500/30 bg-slate-navy/90 backdrop-blur-xl shadow-lg shadow-cyan-500/5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Overall Avg Score</span>
                <TrendingUp className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {overview.overallAverageScore ?? 0}%
              </div>
              <div className="text-[10px] text-cyan-400 font-medium">Published results</div>
            </div>

            {/* Overall Pass Percentage */}
            <div className="p-4 rounded-2xl border border-amber-500/30 bg-slate-navy/90 backdrop-blur-xl shadow-lg shadow-amber-500/5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Pass Rate</span>
                <Percent className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {overview.overallPassPercentage ?? 0}%
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                Participation: {overview.studentParticipationRate ?? 0}%
              </div>
            </div>
          </div>

          {/* Charts Row 1: Participation & Average Marks Over Time (Line / Area) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Participation Over Time (7 cols) */}
            <div className="lg:col-span-7 p-5 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl shadow-xl space-y-4 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    <span>Exam Participation Over Time</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Total attempts recorded per day</p>
                </div>
              </div>

              <div className="h-64 w-full min-w-0">
                {Array.isArray(charts?.examParticipationOverTime) && charts.examParticipationOverTime.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200}>
                    <AreaChart data={charts.examParticipationOverTime}>
                      <defs>
                        <linearGradient id="attemptsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis dataKey="date" stroke="#64748B" fontSize={10} />
                      <YAxis stroke="#64748B" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderColor: '#334155',
                          color: '#F8FAFC',
                          borderRadius: '8px',
                          fontSize: '11px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="attempts"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        fill="url(#attemptsGrad)"
                        name="Attempts"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No timeline attempt data for the selected period
                  </div>
                )}
              </div>
            </div>

            {/* Pass vs Fail Distribution (5 cols) */}
            <div className="lg:col-span-5 p-5 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl shadow-xl space-y-4 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <PieIcon className="w-4 h-4 text-emerald-400" />
                    <span>Pass vs Fail Ratio</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Outcome ratio of all published scores</p>
                </div>
              </div>

              <div className="h-64 w-full min-w-0">
                {Array.isArray(charts?.passFailDistribution) && charts.passFailDistribution.some((p) => Number(p?.value) > 0) ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200}>
                    <PieChart>
                      <Pie
                        data={charts.passFailDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {charts.passFailDistribution.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry?.name === 'Passed' ? '#10B981' : '#EF4444'}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderColor: '#334155',
                          color: '#F8FAFC',
                          borderRadius: '8px',
                          fontSize: '11px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(val) => <span className="text-xs text-slate-300">{val}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No published results to compute pass/fail ratio
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Charts Row 2: Course-Wise Performance & Student Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Course Performance Bar Chart (6 cols) */}
            <div className="lg:col-span-6 p-5 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl shadow-xl space-y-4 min-w-0">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  <span>Course-Wise Average Score (%)</span>
                </h3>
                <p className="text-[11px] text-slate-400">Average percentage achieved per course</p>
              </div>

              <div className="h-64 w-full min-w-0">
                {Array.isArray(charts?.courseWisePerformance) && charts.courseWisePerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200}>
                    <BarChart data={charts.courseWisePerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis dataKey="courseCode" stroke="#64748B" fontSize={10} />
                      <YAxis stroke="#64748B" fontSize={10} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderColor: '#334155',
                          color: '#F8FAFC',
                          borderRadius: '8px',
                          fontSize: '11px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                        }}
                      />
                      <Bar dataKey="averagePercentage" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Avg %" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No course evaluation data available
                  </div>
                )}
              </div>
            </div>

            {/* Score Brackets Distribution (6 cols) */}
            <div className="lg:col-span-6 p-5 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl shadow-xl space-y-4 min-w-0">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-cyan-400" />
                  <span>Score Brackets Distribution</span>
                </h3>
                <p className="text-[11px] text-slate-400">Candidate score distribution frequencies</p>
              </div>

              <div className="h-64 w-full min-w-0">
                {Array.isArray(charts?.studentPerformanceDistribution) &&
                charts.studentPerformanceDistribution.some((d) => Number(d?.count) > 0) ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200}>
                    <BarChart data={charts.studentPerformanceDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis dataKey="bracket" stroke="#64748B" fontSize={10} />
                      <YAxis stroke="#64748B" fontSize={10} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderColor: '#334155',
                          color: '#F8FAFC',
                          borderRadius: '8px',
                          fontSize: '11px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                        }}
                      />
                      <Bar dataKey="count" fill="#06B6D4" radius={[4, 4, 0, 0]} name="Students" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No score bracket data available
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminAnalyticsDashboard() {
  return (
    <AnalyticsErrorBoundary>
      <AdminAnalyticsDashboardContent />
    </AnalyticsErrorBoundary>
  );
}
