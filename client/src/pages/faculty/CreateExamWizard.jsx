import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import { useToast } from '../../components/common/Toast.jsx';
import {
  FileCheck2,
  BookOpen,
  HelpCircle,
  Users2,
  Settings,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Clock,
  Calendar,
  Award,
  AlertCircle,
  Save,
  Send,
  CheckCircle2,
  Shuffle,
  ShieldAlert,
  Search,
} from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Basic Info', icon: FileCheck2 },
  { id: 2, label: 'Select Course', icon: BookOpen },
  { id: 3, label: 'Add Questions', icon: HelpCircle },
  { id: 4, label: 'Assign Students', icon: Users2 },
  { id: 5, label: 'Exam Settings', icon: Settings },
  { id: 6, label: 'Preview & Publish', icon: Sparkles },
];

export default function CreateExamWizard() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError] = useState('');

  // Course & Data Sources
  const [facultyCourses, setFacultyCourses] = useState([]);
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [enrolledStudents, setEnrolledStudents] = useState([]);

  // Wizard Form State:
  // Step 1: Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');

  // Step 2: Course Selection (supports multiple courses)
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);

  // Step 3: Selected Questions (ordered list of question objects)
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [questionSearch, setQuestionSearch] = useState('');

  // Step 4: Students Assignment
  const [assignmentMode, setAssignmentMode] = useState('ALL'); // 'ALL' | 'BATCH' | 'MANUAL'
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [studentSearch, setStudentSearch] = useState('');

  // Step 5: Exam Settings
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [negativeMarking, setNegativeMarking] = useState(true);
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [allowLateEntry, setAllowLateEntry] = useState(false);
  const [maximumAttempts, setMaximumAttempts] = useState(1);

  // Initialize Courses & Default Dates
  useEffect(() => {
    const initData = async () => {
      try {
        const coursesRes = await api.get('/faculty/courses');
        const coursesList = coursesRes?.data?.data || coursesRes?.data || [];
        setFacultyCourses(coursesList);
        if (coursesList.length > 0) {
          setSelectedCourseIds([coursesList[0].id]);
        }

        // Set default start time 1 hour from now, end time 24 hours from now
        const now = new Date();
        const start = new Date(now.getTime() + 60 * 60 * 1000);
        const end = new Date(now.getTime() + 25 * 60 * 60 * 1000);

        // Format to YYYY-MM-DDTHH:mm for datetime-local input
        const formatLocal = (d) => {
          const pad = (n) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        setStartTime(formatLocal(start));
        setEndTime(formatLocal(end));
      } catch (err) {
        setStepError('Failed to load courses. Please refresh.');
      } finally {
        setLoadingInitial(false);
      }
    };
    initData();
  }, []);

  // When selectedCourseIds change, fetch questions and enrolled students across all selected courses
  useEffect(() => {
    if (selectedCourseIds.length === 0) {
      setAvailableQuestions([]);
      setEnrolledStudents([]);
      setSelectedQuestions([]);
      return;
    }

    const fetchCourseData = async () => {
      try {
        // Fetch questions from bank across all selected courses
        const qRes = await api.get('/questions', {
          params: { courseIds: selectedCourseIds.join(','), limit: 300 },
        });
        const qList = Array.isArray(qRes?.data?.data)
          ? qRes.data.data
          : Array.isArray(qRes?.data)
          ? qRes.data
          : qRes?.data?.questions || [];
        setAvailableQuestions(qList);

        // Fetch eligible students across all selected courses
        const sRes = await api.get('/faculty/students', {
          params: { courseIds: selectedCourseIds.join(',') },
        });
        const sList = Array.isArray(sRes?.data?.data)
          ? sRes.data.data
          : Array.isArray(sRes?.data)
          ? sRes.data
          : [];
        setEnrolledStudents(sList);

        // Default all enrolled students selected
        setSelectedStudentIds(new Set(sList.map((s) => s.id)));
      } catch {
        // non-blocking
      }
    };

    fetchCourseData();

    // Clean up any selected questions whose course is no longer selected
    setSelectedQuestions((prev) =>
      prev.filter((q) => !q.courseId || selectedCourseIds.includes(q.courseId))
    );
  }, [selectedCourseIds.slice().sort().join(',')]);

  // Toggle course selection
  const handleToggleCourse = (courseId) => {
    setSelectedCourseIds((prev) => {
      if (prev.includes(courseId)) {
        return prev.filter((id) => id !== courseId);
      } else {
        return [...prev, courseId];
      }
    });
  };

  // Helper getters
  const selectedCourses = facultyCourses.filter((c) => selectedCourseIds.includes(c.id));
  const selectedCourseId = selectedCourseIds[0] || '';
  const selectedCourse = selectedCourses[0] || null;

  // Derived calculations
  const totalCalculatedMarks = selectedQuestions.reduce(
    (acc, q) => acc + (Number(q.marks) || 0),
    0
  );

  // Filtered available questions for picker
  const filteredAvailableQuestions = availableQuestions.filter((q) => {
    const isAlreadySelected = selectedQuestions.some((sq) => sq.id === q.id);
    if (isAlreadySelected) return false;
    if (!questionSearch.trim()) return true;
    return (
      (q.title || q.questionText || '').toLowerCase().includes(questionSearch.toLowerCase()) ||
      (q.topic || (Array.isArray(q.topicTags) ? q.topicTags.join(' ') : ''))
        .toLowerCase()
        .includes(questionSearch.toLowerCase())
    );
  });

  // Question selection handlers
  const handleAddQuestion = (question) => {
    setSelectedQuestions((prev) => [...prev, question]);
  };

  const handleRemoveQuestion = (id) => {
    setSelectedQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleMoveQuestion = (index, direction) => {
    setSelectedQuestions((prev) => {
      const copy = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Student selection handlers
  const handleToggleStudent = (id) => {
    setSelectedStudentIds((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) {
        copy.delete(id);
      } else {
        copy.add(id);
      }
      return copy;
    });
  };

  const handleSelectAllStudents = () => {
    setSelectedStudentIds(new Set(enrolledStudents.map((s) => s.id)));
  };

  const handleDeselectAllStudents = () => {
    setSelectedStudentIds(new Set());
  };

  // Step Validation
  const validateStep = (step) => {
    setStepError('');
    if (step === 1) {
      if (!title.trim()) {
        setStepError('Please enter an Examination Title.');
        return false;
      }
    }
    if (step === 2) {
      if (!selectedCourseIds || selectedCourseIds.length === 0) {
        setStepError('Please select at least one course for this examination.');
        return false;
      }
    }
    if (step === 3) {
      if (selectedQuestions.length === 0) {
        setStepError('You must add at least one question to the examination.');
        return false;
      }
    }
    if (step === 4) {
      if (selectedStudentIds.size === 0) {
        setStepError('Please assign at least one student or batch to this exam.');
        return false;
      }
    }
    if (step === 5) {
      if (Number(durationMinutes) <= 0) {
        setStepError('Exam duration must be greater than 0 minutes.');
        return false;
      }
      if (startTime && endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        if (start >= end) {
          setStepError('Exam Start Time must be before End Time.');
          return false;
        }
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    }
  };

  const prevStep = () => {
    setStepError('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Submit Exam (Draft or Publish)
  const handleSubmitExam = async (shouldPublish = false) => {
    setStepError('');
    setSubmitting(true);

    try {
      // 1. Create Exam
      const examPayload = {
        courseId: selectedCourseIds[0],
        courseIds: selectedCourseIds,
        title: title.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
        durationMinutes: Number(durationMinutes),
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        shuffleQuestions,
        shuffleOptions,
        negativeMarking,
        autoSubmit,
        allowLateEntry,
        maximumAttempts: Number(maximumAttempts) || 1,
      };

      const createRes = await api.post('/exams', examPayload);
      const createdExam = createRes?.data?.data || createRes?.data;
      const examId = createdExam?.id;

      if (!examId) throw new Error('Exam creation did not return a valid exam ID');

      // 2. Attach Questions (in order)
      const questionIds = selectedQuestions.map((q) => q.id);
      await api.post(`/exams/${examId}/questions`, {
        questionIds,
        questions: selectedQuestions.map((q, idx) => ({
          questionId: q.id,
          orderIndex: idx,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
        })),
      });

      // 3. Assign Students
      const studentIds = Array.from(selectedStudentIds);
      await api.post(`/exams/${examId}/assign`, {
        studentIds,
        batch: selectedBatch || undefined,
        section: selectedSection || undefined,
      });

      // 4. Optionally Publish
      if (shouldPublish) {
        await api.patch(`/exams/${examId}/publish`);
        showToast('Examination created and published successfully!', 'success');
      } else {
        showToast('Examination saved as draft successfully!', 'success');
      }

      navigate('/faculty/exams');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to complete exam creation.';
      setStepError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="p-16 text-center text-slate-400">
        <Sparkles className="w-8 h-8 animate-spin mx-auto text-blue-400 mb-3" />
        <p className="text-xs">Initializing examination creation wizard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-navy/90 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sparkles className="w-3 h-3 text-blue-400" />
              Interactive Multi-Step Exam Builder
            </div>
            <h1 className="text-2xl font-black text-white">Create & Schedule Examination</h1>
            <p className="text-xs text-slate-400">
              Follow the 6 steps below to configure your exam, pick questions, assign candidate rosters, and publish.
            </p>
          </div>

          <button
            onClick={() => navigate('/faculty/exams')}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition self-start sm:self-auto shadow-sm"
          >
            Exit to Exams
          </button>
        </div>
      </div>

      {/* Stepper Navigation Ribbon */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-navy/90 shadow-xl overflow-x-auto">
        <div className="flex items-center justify-between min-w-[620px]">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isCompleted = currentStep > s.id;
            const isCurrent = currentStep === s.id;

            return (
              <React.Fragment key={s.id}>
                <div
                  onClick={() => {
                    if (s.id < currentStep) setCurrentStep(s.id);
                  }}
                  className={`flex items-center gap-2.5 cursor-pointer transition ${
                    isCurrent
                      ? 'text-white font-bold'
                      : isCompleted
                      ? 'text-emerald-400 font-semibold'
                      : 'text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold border transition ${
                      isCurrent
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-500 text-white shadow-md shadow-blue-600/30'
                        : isCompleted
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400">
                      Step {s.id}
                    </span>
                    <span className="text-xs">{s.label}</span>
                  </div>
                </div>

                {idx < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-3 rounded-full transition ${
                      currentStep > s.id ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-slate-800'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Error alert if step validation fails */}
      {stepError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{stepError}</span>
        </div>
      )}

      {/* Step Content Container */}
      <div className="p-6 sm:p-8 rounded-2xl border border-slate-800 bg-slate-navy/90 shadow-xl">
        {/* STEP 1: Basic Information */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-blue-400" />
                Step 1: Examination Overview & Title
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Provide the official exam title, syllabus context, and instructions for candidate test takers.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Examination Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. CS201 Midterm Examination – Data Structures & Algorithms"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Course Description / Scope (Optional)
                </label>
                <textarea
                  rows="3"
                  placeholder="Provide syllabus topics covered in this examination..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Candidate Examination Instructions (Optional)
                </label>
                <textarea
                  rows="3"
                  placeholder="Guidelines for students: e.g. Rough work permitted on paper, calculators disallowed, tab switches monitored..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Select Course */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-400" />
                  Step 2: Select Authorized Course(s)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Select one or multiple authorized courses for this examination (e.g., CS301, IT204, or both).
                </p>
              </div>

              {/* Multi-Course Summary Pill */}
              <div className="p-2.5 px-3.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-right">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Selection Summary
                </span>
                <span className="text-xs font-bold text-blue-400">
                  {selectedCourseIds.length === 0
                    ? 'No Courses Selected'
                    : `${selectedCourseIds.length} Selected (${selectedCourses.map((c) => c.code).join(', ')})`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {facultyCourses.map((c) => {
                const isSelected = selectedCourseIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => handleToggleCourse(c.id)}
                    className={`p-5 rounded-2xl border cursor-pointer transition flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-500/10 border-blue-500/60 text-white shadow-md shadow-blue-500/10'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300">
                          {c.code}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            Selected
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-white">{c.name || c.title}</h4>
                      <p className="text-[11px] text-slate-400">{c.department?.name || 'Department'}</p>
                      <span className="text-[10px] text-slate-500 block">
                        Credits: {c.credits || 3} • Term 2026
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleCourse(c.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 rounded text-blue-600 bg-slate-950 border-slate-700 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: Add Questions */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-blue-400" />
                  Step 3: Assemble Examination Questions
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Questions retrieved from bank for {selectedCourses.map((c) => c.code).join(' & ') || 'selected courses'}. Attach, reorder, or remove questions as needed.
                </p>
              </div>

              {/* Total Marks Live Calculator Pill */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-right">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Computed Total
                </span>
                <span className="text-lg font-black text-white">
                  {selectedQuestions.length} Questions • <span className="text-blue-400">{totalCalculatedMarks} Marks</span>
                </span>
              </div>
            </div>

            {/* Split layout: Selected Questions (left) vs Bank Questions (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Attached Exam Questions */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-200 flex items-center justify-between">
                  <span>Attached to Exam ({selectedQuestions.length})</span>
                  <span className="text-[11px] text-blue-400 font-semibold">
                    Reorder with Arrows
                  </span>
                </h3>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {selectedQuestions.length === 0 ? (
                    <div className="p-8 rounded-xl border border-dashed border-slate-800 bg-slate-900/40 text-center text-slate-500 text-xs">
                      No questions attached yet. Pick from the catalogue on the right.
                    </div>
                  ) : (
                    selectedQuestions.map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 text-xs shadow-sm hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                            {idx + 1}
                          </span>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                                {q.courseCode || q.course?.code || 'Course'}
                              </span>
                              <p className="font-semibold text-slate-200 truncate">{q.title || q.questionText}</p>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {q.type} • {q.difficulty} • +{q.marks}M
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveQuestion(idx, -1)}
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-20 transition"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === selectedQuestions.length - 1}
                            onClick={() => handleMoveQuestion(idx, 1)}
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-20 transition"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(q.id)}
                            className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                            title="Remove Question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right: Available Question Bank */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200">
                    Question Bank Available ({filteredAvailableQuestions.length})
                  </h3>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search available questions..."
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {filteredAvailableQuestions.length === 0 ? (
                    <div className="p-8 rounded-xl border border-dashed border-slate-800 bg-slate-900/40 text-center text-slate-500 text-xs">
                      {availableQuestions.length === 0
                        ? 'No questions found in Question Bank for selected course(s).'
                        : 'All available questions have been added or none match search.'}
                    </div>
                  ) : (
                    filteredAvailableQuestions.map((q) => (
                      <div
                        key={q.id}
                        className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 text-xs shadow-sm transition"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                              {q.courseCode || q.course?.code || 'Course'}
                            </span>
                            <p className="font-semibold text-slate-200 truncate">{q.title || q.questionText}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-emerald-400">
                              +{q.marks} Marks
                            </span>
                            <span className="text-[10px] text-slate-500">•</span>
                            <span className="text-[10px] text-slate-400">{q.difficulty}</span>
                            <span className="text-[10px] text-slate-500">•</span>
                            <span className="text-[10px] text-slate-400">{q.type}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddQuestion(q)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[11px] font-bold shadow-sm shadow-blue-600/30 transition shrink-0"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Assign Students */}
        {currentStep === 4 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Users2 className="w-5 h-5 text-blue-400" />
                  Step 4: Assign Student Candidates
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Assign candidates by entire course roster, batch, section, or individual selection.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllStudents}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 transition"
                >
                  Select All ({enrolledStudents.length})
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllStudents}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-400 hover:bg-slate-700 transition"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Batch & Section filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Filter by Batch
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2025"
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Filter by Section
                </label>
                <input
                  type="text"
                  placeholder="e.g. A, B"
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Search Student Name / Roll
                </label>
                <input
                  type="text"
                  placeholder="Search student..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Students roster table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80 max-h-72 overflow-y-auto">
              <div className="divide-y divide-slate-800">
                {enrolledStudents
                  .filter((s) => {
                    if (selectedBatch && s.batch !== selectedBatch) return false;
                    if (selectedSection && s.section !== selectedSection) return false;
                    if (studentSearch.trim()) {
                      const matchName = s.fullName?.toLowerCase().includes(studentSearch.toLowerCase());
                      const matchRoll = s.rollNumber?.toLowerCase().includes(studentSearch.toLowerCase());
                      if (!matchName && !matchRoll) return false;
                    }
                    return true;
                  })
                  .map((student) => {
                    const isSelected = selectedStudentIds.has(student.id);

                    return (
                      <div
                        key={student.id}
                        onClick={() => handleToggleStudent(student.id)}
                        className={`p-3 flex items-center justify-between text-xs cursor-pointer transition ${
                          isSelected ? 'bg-blue-500/15' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent div onClick
                            className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-200">{student.fullName || student.name}</span>
                              {student.courses && student.courses.length > 0 && (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                  {student.courses.join(', ')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span className="text-blue-400 font-mono">
                                {student.rollNumber || student.email}
                              </span>
                              {student.department && (
                                <>
                                  <span>•</span>
                                  <span>{student.department}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <span className="text-[11px] text-slate-400">
                          Batch: {student.batch || '2025'} • Sec: {student.section || 'A'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>{selectedStudentIds.size} student candidates selected for examination</span>
            </div>
          </div>
        )}

        {/* STEP 5: Exam Configuration */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                Step 5: Examination Timing & Security Parameters
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure exam duration, window availability in local time, and proctoring parameters.
              </p>
            </div>

            {/* Timing Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  Duration (Minutes) *
                </label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  required
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  Window Start Time
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  Window End Time
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Examination Security & Anti-Cheat Toggles */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Security & Anti-Cheat Switches
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Shuffle Questions */}
                <label className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 cursor-pointer flex items-center justify-between transition">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-200 block">Shuffle Questions</span>
                    <span className="text-[11px] text-slate-400">
                      Randomize question sequence per candidate
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                  />
                </label>

                {/* Shuffle Options */}
                <label className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 cursor-pointer flex items-center justify-between transition">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-200 block">Shuffle MCQ Options</span>
                    <span className="text-[11px] text-slate-400">
                      Permute answer choices A, B, C, D uniquely
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={shuffleOptions}
                    onChange={(e) => setShuffleOptions(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                  />
                </label>

                {/* Negative Marking */}
                <label className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 cursor-pointer flex items-center justify-between transition">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-200 block">Negative Marking</span>
                    <span className="text-[11px] text-slate-400">
                      Deduct configured marks on incorrect response
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={negativeMarking}
                    onChange={(e) => setNegativeMarking(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 bg-slate-950 border-slate-700 focus:ring-rose-500 accent-rose-600 cursor-pointer"
                  />
                </label>

                {/* Auto Submit */}
                <label className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 cursor-pointer flex items-center justify-between transition">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-200 block">Automatic Submission</span>
                    <span className="text-[11px] text-slate-400">
                      Auto-lock and submit answers when time expires
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSubmit}
                    onChange={(e) => setAutoSubmit(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 bg-slate-950 border-slate-700 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                  />
                </label>

                {/* Allow Late Entry */}
                <label className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 cursor-pointer flex items-center justify-between transition">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-200 block">Allow Late Entry</span>
                    <span className="text-[11px] text-slate-400">
                      Permit candidates to start after window start
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowLateEntry}
                    onChange={(e) => setAllowLateEntry(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                  />
                </label>

                {/* Max attempts */}
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-200 block">Maximum Attempts</span>
                    <span className="text-[11px] text-slate-400">Allowed test takes per candidate</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={maximumAttempts}
                    onChange={(e) => setMaximumAttempts(e.target.value)}
                    className="w-16 bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: Preview and Publish */}
        {currentStep === 6 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Step 6: Examination Review & Launch
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Verify all configurations before creating and publishing this examination.
              </p>
            </div>

            {/* Comprehensive Review Card */}
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {selectedCourses.map((c) => (
                        <span
                          key={c.id}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold"
                        >
                          {c.code}
                        </span>
                      ))}
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1">{title}</h3>
                    <p className="text-xs text-slate-400">
                      {selectedCourses.map((c) => `${c.code} – ${c.name || c.title}`).join(' • ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        Total Marks
                      </span>
                      <span className="text-lg font-black text-purple-400">
                        {totalCalculatedMarks}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        Duration
                      </span>
                      <span className="text-lg font-black text-cyan-400">
                        {durationMinutes}m
                      </span>
                    </div>
                  </div>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Questions</span>
                    <span className="font-bold text-white">{selectedQuestions.length} Attached</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Candidates</span>
                    <span className="font-bold text-white">{selectedStudentIds.size} Assigned</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Start Window</span>
                    <span className="font-bold text-white truncate block">
                      {startTime ? new Date(startTime).toLocaleString() : 'Immediate'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">End Window</span>
                    <span className="font-bold text-white truncate block">
                      {endTime ? new Date(endTime).toLocaleString() : 'No Limit'}
                    </span>
                  </div>
                </div>

                {/* Parameters checklist */}
                <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 text-xs flex flex-wrap gap-x-6 gap-y-2">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Shuffle Questions: {shuffleQuestions ? 'Yes' : 'No'}
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Shuffle Options: {shuffleOptions ? 'Yes' : 'No'}
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Negative Marking: {negativeMarking ? 'Yes' : 'No'}
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Auto Submit: {autoSubmit ? 'Yes' : 'No'}
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Max Attempts: {maximumAttempts}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-800">
          <button
            type="button"
            disabled={currentStep === 1 || submitting}
            onClick={prevStep}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-slate-300 border border-slate-700 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-3">
            {currentStep < 6 ? (
              <button
                type="button"
                onClick={nextStep}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white shadow-md shadow-blue-600/30 transition"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmitExam(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save as Draft</span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmitExam(true)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white shadow-md shadow-emerald-600/30 transition"
                >
                  {submitting ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Publish Examination</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
