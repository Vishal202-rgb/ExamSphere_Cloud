import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api.js';
import Modal from '../../components/common/Modal.jsx';
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  Users2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function DepartmentsPage() {
  const { isAuthenticated, role, token } = useSelector((state) => state.auth);
  const isAdmin = Boolean(isAuthenticated && token && (role === 'ADMIN' || role === 'SUPER_ADMIN'));

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [activeDept, setActiveDept] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', description: '' });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDepartments = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/departments', {
        params: { search, page, limit: 10 },
      });
      if (response && response.data) {
        setDepartments(response.data.data || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
        setTotalCount(response.data.pagination?.total || 0);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchDepartments();
    }
  }, [isAdmin, page, search]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-slate-navy/90 border border-slate-800 rounded-xl text-slate-400 text-xs">
        Checking administrative authorization...
      </div>
    );
  }

  const handleOpenCreate = () => {
    setModalMode('create');
    setActiveDept(null);
    setFormData({ name: '', code: '', description: '' });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (dept) => {
    setModalMode('edit');
    setActiveDept(dept);
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);
    try {
      if (modalMode === 'create') {
        await api.post('/departments', {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          description: formData.description.trim() || undefined,
        });
        setSuccessMsg(`Department '${formData.code.toUpperCase()}' created successfully`);
      } else {
        await api.put(`/departments/${activeDept.id}`, {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          description: formData.description.trim() || undefined,
        });
        setSuccessMsg(`Department '${formData.code.toUpperCase()}' updated successfully`);
      }
      setModalOpen(false);
      fetchDepartments();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setFormError(err?.message || 'Failed to save department');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deptToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/departments/${deptToDelete.id}`);
      setSuccessMsg(`Department '${deptToDelete.name}' deleted successfully`);
      setDeleteConfirmOpen(false);
      fetchDepartments();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err?.message || 'Failed to delete department');
    } finally {
      setDeleting(false);
      setDeptToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-blue-400" />
            Department Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Organize academic branches, department codes, and affiliated programs.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Department</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/5">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 shadow-lg shadow-rose-500/5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-3 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl flex items-center justify-between gap-4 shadow-lg">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or code (e.g. CSE)..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-slate-400">
          Total Departments: <strong className="text-white">{totalCount}</strong>
        </div>
      </div>

      {/* Departments Table */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800 font-semibold">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Department Name</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Affiliated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                    Loading department records...
                  </td>
                </tr>
              ) : departments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No departments found matching your criteria.
                  </td>
                </tr>
              ) : (
                departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                      {dept.code}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {dept.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">
                      {dept.description || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 text-[11px] text-purple-300" title="Courses">
                          <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                          {dept._count?.courses ?? 0}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300" title="Users">
                          <Users2 className="w-3.5 h-3.5 text-emerald-400" />
                          {dept._count?.users ?? 0}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEdit(dept)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition"
                        title="Edit Department"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setDeptToDelete(dept);
                          setDeleteConfirmOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="Delete Department"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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

      {/* Create / Edit Department Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === 'create' ? 'Create New Department' : 'Edit Department'}
        subtitle="Department codes must be unique and uppercase (e.g. CSE, EEE, MECH)"
      >
        {formError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmitForm} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Code</label>
              <input
                type="text"
                required
                maxLength={8}
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="CSE"
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Department Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Computer Science & Engineering"
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Description (Optional)</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Academic disciplines, research specializations, or remarks..."
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
            >
              {formSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {modalMode === 'create' ? 'Create Department' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Confirm Department Deletion"
        subtitle="This action will permanently delete the department."
      >
        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          Are you sure you want to delete <strong className="text-white">{deptToDelete?.name} ({deptToDelete?.code})</strong>? If courses or students are currently linked to this department, deletion will be blocked by database foreign key constraints.
        </p>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(false)}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-rose-500/20 transition disabled:opacity-50"
          >
            {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirm Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
