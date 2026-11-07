import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../../services/api.js';
import {
  BookOpen,
  GraduationCap,
  Users2,
  FileCheck2,
  Sparkles,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  HelpCircle,
  Plus,
  ArrowRight,
} from 'lucide-react';

export default function FacultyDashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, role, token } = useSelector((state) => state.auth);
  const isFaculty = Boolean(isAuthenticated && token && role === 'FACULTY');

  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const fetchFacultyData = useCallback(
    async (signal = null) => {
      if (!isFaculty) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const [coursesRes, studentsRes] = await Promise.all([
          api.get('/faculty/courses', signal ? { signal } : {}),
          api.get('/faculty/students', signal ? { signal } : {}),
        ]);
        setCourses(coursesRes?.data || []);
        setStudents(studentsRes?.data || []);
      } catch (err) {
        if (
          signal?.aborted ||
          axios.isCancel(err) ||
          err?.isCanceled ||
          err?.code === 'ERR_CANCELED' ||
          err?.name === 'CanceledError' ||
          err?.message === 'canceled'
        ) {
          return;
        }
        setError(err?.message || 'Failed to retrieve faculty dashboard data');
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [isFaculty]
  );

  useEffect(() => {
    if (!isFaculty) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    fetchFacultyData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchFacultyData, isFaculty]);

  if (!isFaculty) {
    return (
      <div className="p-8 text-center bg-slate-navy/90 border border-slate-800 rounded-xl text-slate-400 text-xs">
        Checking faculty authorization...
      </div>
    );
  }

  const filteredStudents = students.filter((s) => {
    const name = s.fullName || s.name || '';
    const roll = s.rollNumber || '';
    const email = s.email || '';
    const q = studentSearch.toLowerCase();
    return !studentSearch || name.toLowerCase().includes(q) || roll.toLowerCase().includes(q) || email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Faculty Hero Banner */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-navy/90 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <Sparkles className="w-3 h-3 text-blue-400" />
              Faculty Portal Active
            </div>
            <h1 className="text-2xl font-black text-slate-100 tracking-tight">
              Welcome back, {user?.name || user?.fullName || 'Professor'}
            </h1>
            <p className="text-xs text-slate-400">
              Department of {user?.department?.name || 'Computer Science & Engineering'} • Authorized Course Coordinator
            </p>
          </div>

          <button
            onClick={() => fetchFacultyData()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-500/30 shadow-lg shadow-blue-500/20 text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Courses</span>
          </button>
        </div>
      </div>

      {/* Quick Operations Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => navigate('/faculty/questions')}
          className="p-5 rounded-2xl border border-purple-500/30 bg-slate-navy/80 hover:bg-slate-800/80 cursor-pointer transition group flex items-start justify-between shadow-lg"
        >
          <div className="space-y-1.5">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 w-fit">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 group-hover:text-purple-300 transition">
              Question Bank Repository
            </h3>
            <p className="text-[11px] text-slate-400">
              Manage single/multi MCQs, True/False, and rubrics with CSV import/export.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-1 transition mt-2 shrink-0" />
        </div>

        <div
          onClick={() => navigate('/faculty/exams')}
          className="p-5 rounded-2xl border border-blue-500/30 bg-slate-navy/80 hover:bg-slate-800/80 cursor-pointer transition group flex items-start justify-between shadow-lg"
        >
          <div className="space-y-1.5">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 w-fit">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 group-hover:text-blue-300 transition">
              Examinations Console
            </h3>
            <p className="text-[11px] text-slate-400">
              Inspect draft, scheduled, live, and completed examination statuses.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition mt-2 shrink-0" />
        </div>

        <div
          onClick={() => navigate('/faculty/exams/create')}
          className="p-5 rounded-2xl border border-emerald-500/30 bg-slate-navy/80 hover:bg-slate-800/80 cursor-pointer transition group flex items-start justify-between shadow-lg"
        >
          <div className="space-y-1.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 w-fit">
              <Plus className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 group-hover:text-emerald-300 transition">
              Launch Exam Wizard
            </h3>
            <p className="text-[11px] text-slate-400">
              Interactive 6-step wizard to create, configure, and publish examinations.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition mt-2 shrink-0" />
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchFacultyData()}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[11px] font-semibold transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Assigned Courses Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            Assigned Course Curricula
          </h2>
          <span className="text-xs text-slate-400">
            {courses.length} Assigned Course{courses.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 bg-slate-navy/60 rounded-2xl border border-slate-800">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
            Loading assigned courses...
          </div>
        ) : courses.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 bg-slate-navy/60 rounded-2xl border border-slate-800">
            No courses assigned to your faculty profile yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <div
                key={course.id}
                className="p-5 rounded-2xl border border-slate-800/80 bg-slate-navy/90 hover:border-slate-700 hover:bg-slate-800/60 transition flex flex-col justify-between space-y-4 shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                      {course.code}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {course.credits} Credits
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-100 text-base">{course.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {course.description || 'Comprehensive curriculum with theory and assessments.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
                    {course._count?.studentEnrollments ?? 0} Students
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileCheck2 className="w-3.5 h-3.5 text-purple-400" />
                    {course._count?.exams ?? 0} Exams
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enrolled Students Roster */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Users2 className="w-5 h-5 text-emerald-400" />
            Enrolled Student Cohort Roster
          </h2>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search enrolled students..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-navy/90 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800 font-semibold">
                <tr>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Batch</th>
                  <th className="py-3 px-4">Section</th>
                  <th className="py-3 px-4 text-right">Academic Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                      Loading student roster...
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No enrolled students found in your assigned courses.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-blue-400">
                        {s.rollNumber || '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-100">
                        {s.fullName || s.name}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {s.email}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {s.batch || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        Sec {s.section || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                          Enrolled
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
