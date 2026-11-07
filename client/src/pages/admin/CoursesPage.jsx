import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api.js';
import Modal from '../../components/common/Modal.jsx';
import {
  BookOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  UserPlus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Building2,
  Award,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export default function CoursesPage() {
  const { isAuthenticated, role, token } = useSelector((state) => state.auth);
  const isAdmin = Boolean(isAuthenticated && token && (role === 'ADMIN' || role === 'SUPER_ADMIN'));

  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Course Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [activeCourse, setActiveCourse] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    credits: 3,
    departmentId: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Assign Faculty Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [courseToAssign, setCourseToAssign] = useState(null);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [isCoordinator, setIsCoordinator] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAuxData = async () => {
    if (!isAdmin) return;
    try {
      const [deptRes, facRes] = await Promise.all([
        api.get('/departments', { params: { limit: 100 } }),
        api.get('/users/faculty', { params: { limit: 100 } }),
      ]);
      setDepartments(deptRes?.data?.data || []);
      setFacultyList(facRes?.data?.data || []);
    } catch {
      // Non-critical auxiliary lookup failure
    }
  };

  const fetchCourses = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/courses', {
        params: {
          search,
          departmentId: selectedDept || undefined,
          page,
          limit: 10,
        },
      });
      if (response && response.data) {
        setCourses(response.data.data || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
        setTotalCount(response.data.pagination?.total || 0);
      }
    } catch (err) {
      setError(err?.message || 'Failed to fetch courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAuxData();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchCourses();
    }
  }, [isAdmin, page, search, selectedDept]);

  if (!isAdmin) {
    return null;
  }

  const handleOpenCreate = () => {
    setModalMode('create');
    setActiveCourse(null);
    setFormData({
      code: '',
      title: '',
      credits: 3,
      departmentId: departments[0]?.id || '',
      description: '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (course) => {
    setModalMode('edit');
    setActiveCourse(course);
    setFormData({
      code: course.code,
      title: course.title,
      credits: course.credits,
      departmentId: course.departmentId,
      description: course.description || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmitCourse = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        await api.post('/courses', {
          code: formData.code.trim().toUpperCase(),
          title: formData.title.trim(),
          credits: Number(formData.credits),
          departmentId: formData.departmentId,
          description: formData.description.trim() || undefined,
        });
        setSuccessMsg(`Course '${formData.code.toUpperCase()}' registered successfully`);
      } else {
        await api.put(`/courses/${activeCourse.id}`, {
          code: formData.code.trim().toUpperCase(),
          title: formData.title.trim(),
          credits: Number(formData.credits),
          departmentId: formData.departmentId,
          description: formData.description.trim() || undefined,
        });
        setSuccessMsg(`Course '${formData.code.toUpperCase()}' updated successfully`);
      }
      setModalOpen(false);
      fetchCourses();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setFormError(err?.message || 'Failed to save course');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAssign = (course) => {
    setCourseToAssign(course);
    setSelectedFacultyId(facultyList[0]?.id || '');
    setIsCoordinator(true);
    setAssignError('');
    setAssignModalOpen(true);
  };

  const handleAssignFaculty = async (e) => {
    e.preventDefault();
    if (!selectedFacultyId) {
      setAssignError('Please select a faculty instructor');
      return;
    }
    setAssigning(true);
    setAssignError('');
    try {
      await api.post(`/courses/${courseToAssign.id}/faculty`, {
        facultyId: selectedFacultyId,
        isCoordinator,
      });
      setSuccessMsg(`Faculty member successfully assigned to course '${courseToAssign.code}'`);
      setAssignModalOpen(false);
      fetchCourses();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setAssignError(err?.message || 'Failed to assign faculty member');
    } finally {
      setAssigning(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/courses/${courseToDelete.id}`);
      setSuccessMsg(`Course '${courseToDelete.code}' deleted successfully`);
      setDeleteModalOpen(false);
      fetchCourses();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err?.message || 'Failed to delete course');
    } finally {
      setDeleting(false);
      setCourseToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-blue-400" />
            Course Curriculum Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Register courses, configure academic credits, and designate faculty instructors.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Course</span>
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
              placeholder="Search by code or title (e.g. CS301)..."
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
          Total Courses: <strong className="text-white">{totalCount}</strong>
        </div>
      </div>

      {/* Courses Table */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800 font-semibold">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Course Title</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Credits</th>
                <th className="py-3 px-4">Faculty Assigned</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                    Loading course catalogue...
                  </td>
                </tr>
              ) : courses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No courses found matching your criteria.
                  </td>
                </tr>
              ) : (
                courses.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                      {c.code}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {c.title}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-mono">
                        {c.department?.code || '—'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-purple-300">
                      {c.credits} Credits
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {c.courseFaculties && c.courseFaculties.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.courseFaculties.map((cf) => (
                            <span
                              key={cf.facultyId}
                              className={`text-[10px] px-2 py-0.5 rounded border ${
                                cf.isCoordinator
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 font-semibold'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {cf.faculty?.fullName} {cf.isCoordinator && '(Lead)'}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">None assigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenAssign(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition"
                        title="Assign Faculty"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 transition"
                        title="Edit Course"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setCourseToDelete(c);
                          setDeleteModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="Delete Course"
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

      {/* Course Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === 'create' ? 'Create New Course' : 'Edit Course'}
        subtitle="Course code must be unique (e.g. CS301, EE201)"
      >
        {formError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmitCourse} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Code</label>
              <input
                type="text"
                required
                maxLength={12}
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="CS301"
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Course Title</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Database Management Systems"
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
              <select
                required
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
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Credits (1-10)</label>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={formData.credits}
                onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
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
              placeholder="Course overview, prerequisite topics, and learning outcomes..."
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
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {modalMode === 'create' ? 'Create Course' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Faculty Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={`Assign Faculty: ${courseToAssign?.code}`}
        subtitle={`Select instructor to teach ${courseToAssign?.title}`}
      >
        {assignError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{assignError}</span>
          </div>
        )}

        <form onSubmit={handleAssignFaculty} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Faculty Member</label>
            <select
              required
              value={selectedFacultyId}
              onChange={(e) => setSelectedFacultyId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Select Faculty Member</option>
              {facultyList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.fullName} ({f.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="coordinatorCheckbox"
              checked={isCoordinator}
              onChange={(e) => setIsCoordinator(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="coordinatorCheckbox" className="text-xs text-slate-300 select-none">
              Designate as Primary Course Coordinator (Can author and schedule exams)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setAssignModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={assigning}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
            >
              {assigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Assign Instructor
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Course Deletion"
        subtitle="This action will permanently delete this course record."
      >
        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          Are you sure you want to delete <strong className="text-white">{courseToDelete?.code} – {courseToDelete?.title}</strong>? All associated question bank entries and examinations must be unlinked or deleted first.
        </p>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setDeleteModalOpen(false)}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDeleteCourse}
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
