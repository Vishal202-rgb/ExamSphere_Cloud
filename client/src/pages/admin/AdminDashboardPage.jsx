import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import axios from 'axios';
import api from '../../services/api.js';
import {
  GraduationCap,
  Users2,
  BookOpen,
  FileCheck2,
  PlayCircle,
  Building2,
  Activity,
  ArrowUpRight,
  RefreshCw,
  Clock,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export default function AdminDashboardPage() {
  const { isAuthenticated, role, token } = useSelector((state) => state.auth);
  const isAdmin = Boolean(isAuthenticated && token && (role === 'ADMIN' || role === 'SUPER_ADMIN'));

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch admin dashboard analytics
  const fetchStats = useCallback(
    async (signal = null) => {
      if (!isAdmin) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/stats', {
          ...(signal ? { signal } : {}),
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (response && (response.data || response)) {
          setStats(response.data || response);
        }
      } catch (err) {
        if (
          signal?.aborted ||
          axios.isCancel(err) ||
          err?.isCanceled ||
          err?.code === 'ERR_CANCELED' ||
          err?.name === 'CanceledError' ||
          err?.message === 'canceled'
        ) {
          return; // Clean React StrictMode / unmount cancel
        }
        setError(err?.message || 'Failed to fetch dashboard metrics');
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [isAdmin, token]
  );

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    fetchStats(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchStats, isAdmin]);

  const handleManualRefresh = async () => {
    if (!isAdmin || refreshing) return;
    setRefreshing(true);
    setError('');
    try {
      const response = await api.get('/admin/stats', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response && (response.data || response)) {
        setStats(response.data || response);
      }
    } catch (err) {
      setError(err?.message || 'Failed to refresh dashboard metrics');
    } finally {
      setRefreshing(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-slate-navy/90 border border-slate-800 rounded-xl text-slate-400 text-xs">
        Checking administrative authorization...
      </div>
    );
  }

  const CHART_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899'];

  const kpis = [
    {
      title: 'Total Students',
      value: stats?.kpis?.totalStudents ?? 0,
      icon: GraduationCap,
      badge: 'Enrolled & Active',
      link: '/admin/students',
      color: 'blue',
      iconClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      borderHover: 'hover:border-blue-500/40 hover:shadow-blue-500/10',
    },
    {
      title: 'Total Faculty',
      value: stats?.kpis?.totalFaculty ?? 0,
      icon: Users2,
      badge: 'Academic Staff',
      link: '/admin/faculty',
      color: 'purple',
      iconClass: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      borderHover: 'hover:border-purple-500/40 hover:shadow-purple-500/10',
    },
    {
      title: 'Total Courses',
      value: stats?.kpis?.totalCourses ?? 0,
      icon: BookOpen,
      badge: 'Active Curricula',
      link: '/admin/courses',
      color: 'emerald',
      iconClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      borderHover: 'hover:border-emerald-500/40 hover:shadow-emerald-500/10',
    },
    {
      title: 'Active Examinations',
      value: stats?.kpis?.activeExams ?? 0,
      icon: PlayCircle,
      badge: 'Ongoing Sessions',
      link: '/admin',
      color: 'cyan',
      iconClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      borderHover: 'hover:border-cyan-500/40 hover:shadow-cyan-500/10',
    },
    {
      title: 'Total Examinations',
      value: stats?.kpis?.totalExams ?? 0,
      icon: FileCheck2,
      badge: 'All Cycles',
      link: '/admin',
      color: 'amber',
      iconClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      borderHover: 'hover:border-amber-500/40 hover:shadow-amber-500/10',
    },
    {
      title: 'Departments',
      value: stats?.kpis?.totalDepartments ?? 0,
      icon: Building2,
      badge: 'Academic Depts',
      link: '/admin/departments',
      color: 'rose',
      iconClass: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      borderHover: 'hover:border-rose-500/40 hover:shadow-rose-500/10',
    },
  ];

  const formatActivityTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString();
  };

  const departmentData = (stats?.departmentEnrollments || []).map((d) => ({
    ...d,
    studentCount: d.studentsCount ?? d.studentCount ?? 0,
  }));

  const examStatusData = stats?.examStatusBreakdown || stats?.examStatuses || [];

  return (
    <div className="space-y-6">
      {/* Top Header / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-1.5">
            <Sparkles className="w-3 h-3 text-blue-400" />
            Live Platform Telemetry
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Administrative Operations Center
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time assessment platform telemetry, student distribution, and system audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 text-xs font-semibold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync Stats</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between shadow-lg shadow-rose-500/5">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchStats()}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg text-[11px] font-semibold transition text-rose-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={idx}
              to={kpi.link}
              className={`p-4 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl hover:bg-slate-900/90 transition group flex flex-col justify-between shadow-lg ${kpi.borderHover}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-xl border ${kpi.iconClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition" />
              </div>
              <div>
                <div className="text-2xl font-black tracking-tight text-white">
                  {loading ? (
                    <span className="inline-block w-8 h-6 bg-slate-800 rounded animate-pulse"></span>
                  ) : (
                    kpi.value
                  )}
                </div>
                <div className="text-xs font-medium text-slate-200 mt-0.5">{kpi.title}</div>
                <div className="text-[10px] text-slate-400 mt-1 truncate">{kpi.badge}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Analytics Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Enrollment Bar Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl flex flex-col shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                Department Student Enrollment
              </h2>
              <p className="text-[11px] text-slate-400">Total enrolled students per academic department</p>
            </div>
            <span className="text-[10px] font-mono text-blue-400 font-semibold">Live DB Metrics</span>
          </div>

          <div className="h-64 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Loading analytics...
              </div>
            ) : departmentData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="code" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                      color: '#F8FAFC',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                    }}
                  />
                  <Bar dataKey="studentCount" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Students" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No departmental enrollment data available yet.
              </div>
            )}
          </div>
        </div>

        {/* Examination Status Breakdown Pie */}
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl flex flex-col shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                Examination Cycle Status
              </h2>
              <p className="text-[11px] text-slate-400">Scheduled vs Ongoing vs Completed</p>
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {loading ? (
              <span className="text-xs text-slate-400">Loading charts...</span>
            ) : examStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={examStatusData}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {examStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '11px',
                      color: '#F8FAFC',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', color: '#94A3B8' }}
                    layout="horizontal"
                    verticalAlign="bottom"
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-xs text-slate-400">No exams registered.</span>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activities Audit Feed */}
      <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl shadow-xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Recent System Activities & Audit Logs
            </h2>
            <p className="text-[11px] text-slate-400">Chronological administrative and security action trails</p>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-semibold">Audit Trail</span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading audit history...</div>
        ) : stats?.recentActivities && stats.recentActivities.length > 0 ? (
          <div className="divide-y divide-slate-800">
            {stats.recentActivities.map((log) => (
              <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50"></div>
                  <div>
                    <span className="font-semibold text-slate-100">{log.action}</span>
                    <span className="text-slate-700 mx-1.5">•</span>
                    <span className="text-blue-400 font-mono text-[11px]">{log.resource}</span>
                    {log.user && (
                      <span className="text-slate-400 text-[11px] ml-2">
                        by <strong className="text-slate-200">{log.user.name || log.user.fullName}</strong> ({log.user.role})
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {formatActivityTime(log.timestamp || log.createdAt)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            No system audit logs found.
          </div>
        )}
      </div>
    </div>
  );
}
