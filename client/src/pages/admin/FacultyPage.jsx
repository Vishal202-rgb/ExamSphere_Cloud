import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api.js';
import Modal from '../../components/common/Modal.jsx';
import {
  Users2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  Building2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Power,
} from 'lucide-react';

export default function FacultyPage() {
  const { isAuthenticated, role, token } = useSelector((state) => state.auth);
  const isAdmin = Boolean(isAuthenticated && token && (role === 'ADMIN' || role === 'SUPER_ADMIN'));

  const [faculty, setFaculty] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Create Faculty Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    departmentId: '',
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchDepartments = async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get('/departments', { params: { limit: 100 } });
      setDepartments(res?.data?.data || []);
    } catch {
      // Non-critical
    }
  };

  const fetchFaculty = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/users/faculty', {
        params: {
          search,
          departmentId: selectedDept || undefined,
          page,
          limit: 10,
        },
      });
      if (response && response.data) {
        setFaculty(response.data.data || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
        setTotalCount(response.data.pagination?.total || 0);
      }
    } catch (err) {
      setError(err?.message || 'Failed to fetch faculty directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchDepartments();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchFaculty();
    }
  }, [isAdmin, page, search, selectedDept]);

  if (!isAdmin) {
    return null;
  }

  const handleCreateFaculty = async (e) => {
    e.preventDefault();
    setFormError('');
    setCreating(true);
    try {
      await api.post('/users/faculty', {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password || undefined,
        departmentId: formData.departmentId || undefined,
      });
      setSuccessMsg(`Faculty member '${formData.name}' created successfully`);
      setCreateModalOpen(false);
      setFormData({ name: '', email: '', password: '', departmentId: '' });
      fetchFaculty();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setFormError(err?.message || 'Failed to create faculty account');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (user) => {
    const nextStatus = !user.isActive;
    try {
      await api.patch(`/users/${user.id}/status`, { isActive: nextStatus });
      setSuccessMsg(`Faculty account for '${user.fullName}' ${nextStatus ? 'activated' : 'deactivated'}`);
      fetchFaculty();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err?.message || 'Failed to toggle account status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Users2 className="w-6 h-6 text-purple-400" />
            Faculty Staff Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Provision faculty accounts, department assignments, and course instructors.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              name: '',
              email: '',
              password: 'Faculty@12345',
              departmentId: departments[0]?.id || '',
            });
            setFormError('');
            setCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Faculty Member</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 font-medium shadow-lg shadow-emerald-500/5">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-medium shadow-lg shadow-rose-500/5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-3 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search faculty by name or email..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-400">
          Total Faculty: <strong className="text-white">{totalCount}</strong>
        </div>
      </div>

      {/* Faculty Table */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800 font-semibold">
              <tr>
                <th className="py-3 px-4">Faculty Member</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Courses Instructing</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Account Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                    Loading faculty records...
                  </td>
                </tr>
              ) : faculty.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No faculty found matching your query.
                  </td>
                </tr>
              ) : (
                faculty.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{f.fullName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{f.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-mono">
                        {f.department ? `${f.department.code} - ${f.department.name}` : 'General Faculty'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {f.facultyCourses && f.facultyCourses.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {f.facultyCourses.map((fc) => (
                            <span
                              key={fc.courseId}
                              className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium"
                            >
                              {fc.course?.code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">None assigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-semibold border ${
                          f.isActive
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${f.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        {f.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(f)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition ${
                          f.isActive
                            ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border-slate-700'
                            : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30'
                        }`}
                        title={f.isActive ? 'Deactivate Account' : 'Activate Account'}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{f.isActive ? 'Deactivate' : 'Activate'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 transition text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 transition text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Faculty Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Register Faculty Member"
        subtitle="Provision an instructor account with course authoring privileges"
      >
        {formError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleCreateFaculty} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Dr. Alan Turing"
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. alan.turing@examsphere.io"
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Initial Password</label>
              <input
                type="password"
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Faculty@12345"
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
              <select
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
            >
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Faculty Member
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
