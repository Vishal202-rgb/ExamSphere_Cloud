import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api.js';
import Modal from '../../components/common/Modal.jsx';
import {
  GraduationCap,
  Plus,
  Upload,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Power,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileSpreadsheet,
} from 'lucide-react';

export default function StudentsPage() {
  const { isAuthenticated, role, token } = useSelector((state) => state.auth);
  const isAdmin = Boolean(isAuthenticated && token && (role === 'ADMIN' || role === 'SUPER_ADMIN'));

  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Create Student Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    rollNumber: '',
    batch: '2023-2027',
    section: 'A',
    departmentId: '',
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  // Bulk Import Modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importDeptId, setImportDeptId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

  const fetchDepartments = async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get('/departments', { params: { limit: 100 } });
      setDepartments(res?.data?.data || []);
    } catch {
      // Non-critical
    }
  };

  const fetchStudents = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/users/students', {
        params: {
          search,
          departmentId: selectedDept || undefined,
          batch: selectedBatch || undefined,
          section: selectedSection || undefined,
          page,
          limit: 10,
        },
      });
      if (response && response.data) {
        setStudents(response.data.data || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
        setTotalCount(response.data.pagination?.total || 0);
      }
    } catch (err) {
      setError(err?.message || 'Failed to fetch student roster');
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
      fetchStudents();
    }
  }, [isAdmin, page, search, selectedDept, selectedBatch, selectedSection]);

  if (!isAdmin) {
    return null;
  }

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    setFormError('');
    setCreating(true);
    try {
      await api.post('/users/students', {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password || undefined,
        rollNumber: formData.rollNumber.trim().toUpperCase(),
        batch: formData.batch.trim(),
        section: formData.section.trim().toUpperCase(),
        departmentId: formData.departmentId || undefined,
      });
      setSuccessMsg(`Student '${formData.name}' registered successfully`);
      setCreateModalOpen(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        rollNumber: '',
        batch: '2023-2027',
        section: 'A',
        departmentId: '',
      });
      fetchStudents();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setFormError(err?.message || 'Failed to register student');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (student) => {
    const nextStatus = !student.isActive;
    try {
      await api.patch(`/users/${student.id}/status`, { isActive: nextStatus });
      setSuccessMsg(`Student account '${student.fullName}' ${nextStatus ? 'activated' : 'deactivated'}`);
      fetchStudents();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err?.message || 'Failed to update student status');
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await api.get('/users/students/export', {
        params: {
          departmentId: selectedDept || undefined,
          batch: selectedBatch || undefined,
          section: selectedSection || undefined,
        },
        responseType: 'blob',
      });

      const blob = new Blob([response], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `examsphere_students_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setSuccessMsg('Student records exported successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError('Failed to export students CSV');
    }
  };

  const handleBulkImportSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setImportError('Please select a valid CSV file');
      return;
    }
    setImporting(true);
    setImportError('');
    setImportResult(null);

    const formDataUpload = new FormData();
    formDataUpload.append('file', selectedFile);
    if (importDeptId) {
      formDataUpload.append('departmentId', importDeptId);
    }

    try {
      const response = await api.post('/users/students/bulk-import', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response && response.data) {
        setImportResult(response.data);
        setSuccessMsg(`Bulk import completed: ${response.data.importedCount} students registered`);
        fetchStudents();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      setImportError(err?.message || 'Bulk import failed. Please inspect CSV formatting.');
      if (err?.errors) {
        setImportResult({ errors: err.errors, importedCount: 0 });
      }
    } finally {
      setImporting(false);
    }
  };

  const downloadSampleCSV = () => {
    const sample = `name,email,rollNumber,batch,section
Dennis Ritchie,dennis.ritchie@examsphere.io,CS2023010,2023-2027,A
Ken Thompson,ken.thompson@examsphere.io,CS2023011,2023-2027,A
Linus Torvalds,linus.torvalds@examsphere.io,CS2023012,2023-2027,B`;
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_student_roster.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <GraduationCap className="w-6 h-6 text-blue-400" />
            Student Cohort Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Enforce roll numbers, batch & section assignments, and atomic bulk CSV enrollment.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition"
            title="Export filtered records as CSV"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              setSelectedFile(null);
              setImportResult(null);
              setImportError('');
              setImportDeptId(departments[0]?.id || '');
              setImportModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition"
            title="Import student roster from CSV"
          >
            <Upload className="w-4 h-4 text-purple-400" />
            <span>Bulk Import</span>
          </button>

          <button
            onClick={() => {
              setFormData({
                name: '',
                email: '',
                password: 'Student@12345',
                rollNumber: '',
                batch: '2023-2027',
                section: 'A',
                departmentId: departments[0]?.id || '',
              });
              setFormError('');
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
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
      <div className="p-3 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, roll, or email..."
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
                {d.code}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={selectedBatch}
            onChange={(e) => {
              setSelectedBatch(e.target.value);
              setPage(1);
            }}
            placeholder="Batch (e.g. 2023-2027)"
            className="w-36 px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />

          <select
            value={selectedSection}
            onChange={(e) => {
              setSelectedSection(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition"
          >
            <option value="">All Sections</option>
            <option value="A">Section A</option>
            <option value="B">Section B</option>
            <option value="C">Section C</option>
          </select>
        </div>

        <div className="text-xs text-slate-400">
          Enrolled Students: <strong className="text-white">{totalCount}</strong>
        </div>
      </div>

      {/* Students Table */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800 font-semibold">
              <tr>
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Batch / Section</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Account Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                    Loading student roster...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                      {s.rollNumber || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{s.fullName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{s.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-mono">
                        {s.department?.code || '—'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      <span>{s.batch || '—'}</span>
                      <span className="mx-1 text-slate-600">•</span>
                      <span>Sec {s.section || '—'}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-semibold border ${
                          s.isActive
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${s.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(s)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition ${
                          s.isActive
                            ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border-slate-700'
                            : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30'
                        }`}
                        title={s.isActive ? 'Deactivate Account' : 'Activate Account'}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{s.isActive ? 'Deactivate' : 'Activate'}</span>
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

      {/* Create Student Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Register Student Account"
        subtitle="Provision unique roll number, batch cohort, and department assignment"
      >
        {formError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleCreateStudent} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. John Doe"
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Roll Number</label>
              <input
                type="text"
                required
                value={formData.rollNumber}
                onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value.toUpperCase() })}
                placeholder="e.g. CS2023001"
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. john.doe@examsphere.io"
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Batch</label>
              <input
                type="text"
                required
                value={formData.batch}
                onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                placeholder="2023-2027"
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Section</label>
              <input
                type="text"
                required
                maxLength={4}
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value.toUpperCase() })}
                placeholder="A"
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
              <select
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code}
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
              Register Student
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk CSV Import Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Bulk Student Enrollment via CSV"
        subtitle="Atomic transaction import with duplicate checking"
        maxWidth="max-w-xl"
      >
        {importError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{importError}</span>
          </div>
        )}

        {importResult && (
          <div className="mb-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between text-white font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Import Status Report
              </span>
              <span className="text-blue-400">Imported: {importResult.importedCount}</span>
            </div>
            {importResult.errors && importResult.errors.length > 0 && (
              <div className="mt-2 space-y-1 text-slate-300 text-[11px] max-h-32 overflow-y-auto">
                <span className="font-semibold text-rose-400">Errors flagged during verification:</span>
                {importResult.errors.map((err, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></span>
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleBulkImportSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Assign to Department</label>
            <select
              value={importDeptId}
              onChange={(e) => setImportDeptId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">None (Use department in CSV or leave blank)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* File Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">CSV File Upload</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-950/60"
            >
              <FileSpreadsheet className="w-8 h-8 mx-auto text-blue-400 mb-2" />
              <p className="text-xs font-semibold text-white">
                {selectedFile ? selectedFile.name : 'Click to select CSV roster file'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'CSV format up to 5 MB'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>Required headers: <code className="text-blue-400 font-mono">name, email, rollNumber, batch, section</code></span>
            <button
              type="button"
              onClick={downloadSampleCSV}
              className="text-blue-400 hover:underline font-medium"
            >
              Download Sample CSV
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setImportModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={importing || !selectedFile}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
            >
              {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Execute Transaction Import
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
