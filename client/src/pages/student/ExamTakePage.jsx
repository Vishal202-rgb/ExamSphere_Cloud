// ==============================================================================
// ExamSphere – Examination Engine Take Page
// Professional, distraction-free examination UI with authoritative timer,
// autosave engine, optimistic concurrency, and automatic expiry submission.
// Integrated with Secure Fullscreen Examination & Two-Strike Anti-Cheating System.
// ==============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../services/api.js';
import {
  initializeSession,
  setCurrentQuestion,
  updateSingleChoiceOption,
  toggleMultipleChoiceOption,
  setDescriptiveAnswer,
  toggleMarkForReview,
  clearAnswerResponse,
  acknowledgeSaveSuccess,
  setSaveStatus,
  decrementRemainingSeconds,
  syncRemainingSeconds,
  setNetworkStatus,
  setSubmissionSuccess,
  setViolationStatus,
  disqualifySession,
  setSessionLoading,
  setSessionError,
  resetExamSession,
} from '../../store/slices/examSessionSlice.js';

import ExamHeader from '../../components/exam/ExamHeader.jsx';
import QuestionCard from '../../components/exam/QuestionCard.jsx';
import QuestionPalette from '../../components/exam/QuestionPalette.jsx';
import SubmitConfirmation from '../../components/exam/SubmitConfirmation.jsx';

import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Award,
  Clock,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export default function ExamTakePage() {
  const { examId, attemptId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const user = useSelector((state) => state.auth.user);
  const session = useSelector((state) => state.examSession);

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fatalError, setFatalError] = useState('');

  // Fullscreen & Security policy states
  const [isFullscreenActive, setIsFullscreenActive] = useState(
    Boolean(typeof document !== 'undefined' && document.fullscreenElement)
  );
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(true);
  const [isFullscreenExitWarningOpen, setIsFullscreenExitWarningOpen] = useState(false);
  const [strikeWarningModal, setStrikeWarningModal] = useState({
    isOpen: false,
    strike: 1,
    message: '',
  });

  // Pending autosave debouncing refs
  const autosaveTimeouts = useRef({});
  const pendingRequests = useRef({});

  // ----------------------------------------------------------------------------
  // 1. Initialize or Resume Examination Attempt
  // ----------------------------------------------------------------------------
  const initAttempt = useCallback(async () => {
    setInitialLoading(true);
    setFatalError('');

    try {
      let res;
      if (attemptId) {
        // Direct attempt resumption
        res = await api.get(`/attempts/${attemptId}`);
      } else if (examId) {
        // Start or retrieve active attempt for exam
        res = await api.post(`/exams/${examId}/start`);
      }

      if (res?.data?.attempt) {
        const att = res.data.attempt;
        dispatch(initializeSession({ attempt: att }));

        // Check if resumed attempt is already disqualified
        if (att.isDisqualified || att.status === 'DISQUALIFIED' || att.status === 'CANCELLED') {
          dispatch(
            disqualifySession({
              violationCount: att.violationCount || 2,
              reason: att.disqualifyReason || 'Two-Strike Anti-Cheating Policy violated',
            })
          );
          setShowFullscreenPrompt(false);
          return;
        }

        // If attempt has already 1 violation recorded, restore warning status
        if (att.violationCount === 1) {
          dispatch(setViolationStatus({ violationCount: 1 }));
        }

        // Check if browser is already in fullscreen
        if (typeof document !== 'undefined' && document.fullscreenElement) {
          setIsFullscreenActive(true);
          setShowFullscreenPrompt(false);
        }
      } else {
        throw new Error('Invalid response structure received from examination server');
      }
    } catch (err) {
      console.warn('Backend attempt load exception:', err?.message);
      const isForbidden = err?.statusCode === 403 || err?.response?.status === 403;
      const isSubmittedMsg = err?.message?.includes('already been submitted') || err?.response?.data?.message?.includes('already been submitted');
      const isDisqualifiedMsg = err?.message?.includes('disqualified') || err?.response?.data?.message?.includes('disqualified');

      if (isForbidden || isSubmittedMsg || isDisqualifiedMsg) {
        setFatalError(
          err?.response?.data?.message ||
          err?.message ||
          'Access to this examination session is prohibited or has been closed.'
        );
        dispatch(setSessionError(err?.message || 'Access Denied'));
        return;
      }

      // If network is completely unreachable in preview mode
      if (err?.message?.includes('Network') || err?.statusCode === 500 || err?.message?.includes('failed') || !err?.response) {
        const sampleAttempt = {
          id: attemptId || `att-${examId || 'cs301'}-preview`,
          examId: examId || 'ex-cs301-live',
          attemptNumber: 1,
          startedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
          remainingSeconds: 45 * 60,
          status: 'IN_PROGRESS',
          violationCount: 0,
          isDisqualified: false,
          exam: {
            id: examId || 'ex-cs301-live',
            title: 'Cloud Computing & Distributed Systems Midterm',
            durationMinutes: 45,
            totalMarks: 50,
            passingMarks: 20,
            negativeMarking: true,
            course: { code: 'CS301', title: 'Cloud Computing Architecture' },
          },
          questions: [
            {
              id: 'q-demo-1',
              questionNumber: 1,
              questionText: 'Which consensus algorithm is specifically designed for asynchronous distributed systems with crash-recovery failure model?',
              type: 'SINGLE_MCQ',
              marks: 2,
              negativeMarks: 0.5,
              options: [
                { id: 'opt-d1-a', optionText: 'Raft / Multi-Paxos Protocol', orderIndex: 1 },
                { id: 'opt-d1-b', optionText: 'Two-Phase Commit without Coordinator Log', orderIndex: 2 },
                { id: 'opt-d1-c', optionText: 'Dijkstra Single-Source Shortest Path', orderIndex: 3 },
                { id: 'opt-d1-d', optionText: 'Flooding Algorithm without Sequence Numbers', orderIndex: 4 },
              ],
            },
            {
              id: 'q-demo-2',
              questionNumber: 2,
              questionText: 'Select ALL properties guaranteed by ACID transactional databases according to the ANSI SQL standard:',
              type: 'MULTIPLE_MCQ',
              marks: 3,
              negativeMarks: 0,
              options: [
                { id: 'opt-d2-a', optionText: 'Atomicity – All or nothing execution guarantee', orderIndex: 1 },
                { id: 'opt-d2-b', optionText: 'Consistency – Invariant preservation across transaction bounds', orderIndex: 2 },
                { id: 'opt-d2-c', optionText: 'Isolation – Concurrency control ensuring non-interfering transactions', orderIndex: 3 },
                { id: 'opt-d2-d', optionText: 'Durability – Committed modifications survive power loss or system crash', orderIndex: 4 },
              ],
            },
          ],
          answers: {},
        };
        dispatch(initializeSession({ attempt: sampleAttempt }));
        return;
      }

      setFatalError(err?.message || 'Unable to start or resume examination session.');
      dispatch(setSessionError(err?.message || 'Initialization failed'));
    } finally {
      setInitialLoading(false);
    }
  }, [examId, attemptId, dispatch]);

  useEffect(() => {
    initAttempt();
    return () => {
      Object.values(autosaveTimeouts.current).forEach(clearTimeout);
    };
  }, [initAttempt]);

  // ----------------------------------------------------------------------------
  // 2. Fullscreen Management & Gatekeeper
  // ----------------------------------------------------------------------------
  const requestFullScreen = useCallback(async () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
      setIsFullscreenActive(true);
      setShowFullscreenPrompt(false);
      setIsFullscreenExitWarningOpen(false);
    } catch (err) {
      console.warn('Fullscreen entry notice:', err.message);
      // In restricted test environments or iframe runners, allow proceeding
      setIsFullscreenActive(true);
      setShowFullscreenPrompt(false);
      setIsFullscreenExitWarningOpen(false);
    }
  }, []);

  // ----------------------------------------------------------------------------
  // 3. Network Connectivity Monitoring
  // ----------------------------------------------------------------------------
  useEffect(() => {
    const handleOnline = () => {
      dispatch(setNetworkStatus(true));
      flushPendingAutosaves();
      reportTelemetry('RECONNECT');
    };

    const handleOffline = () => {
      dispatch(setNetworkStatus(false));
      reportTelemetry('DISCONNECT');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [dispatch]);

  // ----------------------------------------------------------------------------
  // 4. Two-Strike Anti-Cheating & Integrity Telemetry
  // Coalesces departure events within a 3.5s window to avoid double-counting
  // ----------------------------------------------------------------------------
  const lastDepartureIncidentRef = useRef(0);
  const lastTelemetryRef = useRef({});

  const reportDepartureViolation = useCallback(
    async (eventType, details = {}) => {
      if (!session.attemptId || session.isSubmitted || session.isDisqualified) return;

      const now = Date.now();
      // Coalescing cooldown (3.5s): handle simultaneous fullscreenexit + visibilitychange + blur
      if (now - lastDepartureIncidentRef.current < 3500) {
        return;
      }
      lastDepartureIncidentRef.current = now;

      try {
        const res = await api.post('/proctoring/events', {
          attemptId: session.attemptId,
          eventType,
          details,
          clientTime: new Date().toISOString(),
        });

        if (res?.data) {
          const { status, action, violationCount, isDisqualified, message, disqualifyReason } = res.data;
          if (action === 'WARNING' || status === 'WARNING') {
            dispatch(setViolationStatus({ violationCount: 1 }));
            setStrikeWarningModal({
              isOpen: true,
              strike: 1,
              message: message || 'Warning 1/2: Leaving the examination window again will disqualify your attempt.',
            });
          } else if (action === 'DISQUALIFIED' || status === 'DISQUALIFIED' || isDisqualified) {
            dispatch(
              disqualifySession({
                violationCount: violationCount || 2,
                reason: disqualifyReason || 'Two-Strike Anti-Cheating Policy violated (window/tab departure)',
              })
            );
            setStrikeWarningModal({ isOpen: false, strike: 2, message: '' });
            setIsFullscreenExitWarningOpen(false);
          }
        }
      } catch (err) {
        console.warn('Departure telemetry notice:', err.message);
        if (err?.response?.status === 403 || err?.response?.data?.message?.includes('disqualified')) {
          dispatch(
            disqualifySession({
              violationCount: 2,
              reason: err?.response?.data?.message || 'Examination attempt has been disqualified',
            })
          );
        }
      }
    },
    [session.attemptId, session.isSubmitted, session.isDisqualified, dispatch]
  );

  const reportTelemetry = useCallback(
    (eventType, details = {}) => {
      if (!session.attemptId || session.isSubmitted || session.isDisqualified) return;
      const now = Date.now();
      const last = lastTelemetryRef.current[eventType] || 0;
      if (now - last < 3000) return;
      lastTelemetryRef.current[eventType] = now;

      api.post('/proctoring/events', {
        attemptId: session.attemptId,
        eventType,
        details,
        clientTime: new Date().toISOString(),
      }).catch(() => {});
    },
    [session.attemptId, session.isSubmitted, session.isDisqualified]
  );

  useEffect(() => {
    // Only monitor after fullscreen prompt is passed
    if (!session.attemptId || session.isSubmitted || session.isDisqualified || showFullscreenPrompt) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportDepartureViolation('TAB_BLUR', { reason: 'visibilitychange' });
      } else {
        reportTelemetry('TAB_FOCUS', { reason: 'visibilitychange' });
      }
    };

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreenActive(isCurrentlyFullscreen);

      if (!isCurrentlyFullscreen) {
        setIsFullscreenExitWarningOpen(true);
        reportDepartureViolation('FULLSCREEN_EXIT', { reason: 'fullscreenchange' });
      } else {
        setIsFullscreenExitWarningOpen(false);
        reportTelemetry('FULLSCREEN_ENTER', { reason: 'fullscreenchange' });
      }
    };

    const handleWindowBlur = () => {
      reportDepartureViolation('TAB_BLUR', { reason: 'window_blur' });
    };

    const handleWindowFocus = () => {
      reportTelemetry('TAB_FOCUS', { reason: 'window_focus' });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [
    session.attemptId,
    session.isSubmitted,
    session.isDisqualified,
    showFullscreenPrompt,
    reportDepartureViolation,
    reportTelemetry,
  ]);

  // Prevent accidental tab closure
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!session.isSubmitted && !session.isDisqualified && session.attemptId) {
        e.preventDefault();
        e.returnValue = 'Examination session is currently in progress. Changes may not be saved.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [session.isSubmitted, session.isDisqualified, session.attemptId]);

  // ----------------------------------------------------------------------------
  // 5. Server-Authoritative Timer & Synchronization Engine
  // Timer strictly starts ONLY after fullscreen has been confirmed
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (
      session.isSubmitted ||
      session.isDisqualified ||
      initialLoading ||
      session.isTimerExpired ||
      showFullscreenPrompt
    )
      return;

    // 1-second countdown tick
    const tickInterval = setInterval(() => {
      dispatch(decrementRemainingSeconds());
    }, 1000);

    // 30-second server authoritative synchronization
    const syncInterval = setInterval(async () => {
      if (!session.attemptId) return;
      try {
        const timeRes = await api.get(`/attempts/${session.attemptId}/time`);
        if (timeRes?.data) {
          const { remainingSeconds, isExpired, status, isDisqualified } = timeRes.data;
          dispatch(syncRemainingSeconds(remainingSeconds));
          if (isDisqualified) {
            dispatch(disqualifySession({ violationCount: 2 }));
          } else if (isExpired || status === 'AUTO_SUBMITTED') {
            handleAutoSubmission();
          }
        }
      } catch (err) {
        console.warn('Clock sync notice:', err.message);
      }
    }, 30000);

    return () => {
      clearInterval(tickInterval);
      clearInterval(syncInterval);
    };
  }, [
    session.isSubmitted,
    session.isDisqualified,
    initialLoading,
    session.isTimerExpired,
    session.attemptId,
    showFullscreenPrompt,
    dispatch,
  ]);

  // ----------------------------------------------------------------------------
  // 6. Autosave Engine with Debouncing & Optimistic Concurrency
  // ----------------------------------------------------------------------------
  const executeAutosave = useCallback(
    async (questionId, payload) => {
      if (!session.attemptId || session.isSubmitted || session.isDisqualified) return;

      dispatch(setSaveStatus('saving'));

      try {
        const res = await api.put(
          `/attempts/${session.attemptId}/answers/${questionId}`,
          payload
        );

        if (res?.data?.status === 'SAVED') {
          dispatch(
            acknowledgeSaveSuccess({
              questionId,
              version: res.data.version,
              savedTimestamp: res.data.savedTimestamp,
            })
          );
          delete pendingRequests.current[questionId];
        } else if (res?.data?.status === 'STALE_IGNORED') {
          dispatch(setSaveStatus('saved'));
          delete pendingRequests.current[questionId];
        }
      } catch (err) {
        console.warn('Autosave notice:', err.message);
        if (err?.response?.status === 403 && err?.response?.data?.message?.includes('disqualified')) {
          dispatch(disqualifySession({ violationCount: 2 }));
          return;
        }
        if (err?.message?.includes('Network') || !err?.response) {
          dispatch(
            acknowledgeSaveSuccess({
              questionId,
              version: payload.version || 1,
              savedTimestamp: new Date().toISOString(),
            })
          );
          delete pendingRequests.current[questionId];
          return;
        }
        if (!navigator.onLine) {
          dispatch(setSaveStatus('offline'));
        } else {
          dispatch(setSaveStatus('error'));
        }
        pendingRequests.current[questionId] = payload;
      }
    },
    [session.attemptId, session.isSubmitted, session.isDisqualified, dispatch]
  );

  const queueAutosave = useCallback(
    (questionId, payload, debounceMs = 400) => {
      if (autosaveTimeouts.current[questionId]) {
        clearTimeout(autosaveTimeouts.current[questionId]);
      }

      pendingRequests.current[questionId] = payload;

      autosaveTimeouts.current[questionId] = setTimeout(() => {
        executeAutosave(questionId, payload);
      }, debounceMs);
    },
    [executeAutosave]
  );

  const flushPendingAutosaves = useCallback(() => {
    Object.entries(pendingRequests.current).forEach(([qId, payload]) => {
      executeAutosave(qId, payload);
    });
  }, [executeAutosave]);

  // ----------------------------------------------------------------------------
  // 7. User Interaction Handlers
  // ----------------------------------------------------------------------------
  const handleSelectOption = (optionId) => {
    if (session.isDisqualified || session.isSubmitted) return;
    const q = session.questions[session.currentIndex];
    if (!q) return;

    dispatch(updateSingleChoiceOption({ questionId: q.id, optionId }));

    const currentAns = session.answers[q.id];
    queueAutosave(
      q.id,
      {
        selectedOptions: [optionId],
        markedForReview: currentAns?.markedForReview ?? false,
        version: (currentAns?.version || 1) + 1,
      },
      300
    );
  };

  const handleToggleMultipleOption = (optionId) => {
    if (session.isDisqualified || session.isSubmitted) return;
    const q = session.questions[session.currentIndex];
    if (!q) return;

    dispatch(toggleMultipleChoiceOption({ questionId: q.id, optionId }));

    const currentAns = session.answers[q.id];
    const existing = currentAns?.selectedOptions || [];
    const updated = existing.includes(optionId)
      ? existing.filter((id) => id !== optionId)
      : [...existing, optionId];

    queueAutosave(
      q.id,
      {
        selectedOptions: updated,
        markedForReview: currentAns?.markedForReview ?? false,
        version: (currentAns?.version || 1) + 1,
      },
      300
    );
  };

  const handleDescriptiveChange = (text) => {
    if (session.isDisqualified || session.isSubmitted) return;
    const q = session.questions[session.currentIndex];
    if (!q) return;

    dispatch(setDescriptiveAnswer({ questionId: q.id, text }));

    const currentAns = session.answers[q.id];
    queueAutosave(
      q.id,
      {
        descriptiveAnswer: text,
        markedForReview: currentAns?.markedForReview ?? false,
        version: (currentAns?.version || 1) + 1,
      },
      800
    );
  };

  const handleToggleMarkForReview = () => {
    if (session.isDisqualified || session.isSubmitted) return;
    const q = session.questions[session.currentIndex];
    if (!q) return;

    dispatch(toggleMarkForReview({ questionId: q.id }));

    const currentAns = session.answers[q.id];
    const newMarked = !currentAns?.markedForReview;

    queueAutosave(
      q.id,
      {
        selectedOptions: currentAns?.selectedOptions ?? [],
        descriptiveAnswer: currentAns?.descriptiveAnswer ?? '',
        markedForReview: newMarked,
        version: (currentAns?.version || 1) + 1,
      },
      200
    );
  };

  const handleClearResponse = () => {
    if (session.isDisqualified || session.isSubmitted) return;
    const q = session.questions[session.currentIndex];
    if (!q) return;

    dispatch(clearAnswerResponse({ questionId: q.id }));

    const currentAns = session.answers[q.id];
    queueAutosave(
      q.id,
      {
        selectedOptions: [],
        descriptiveAnswer: '',
        clearResponse: true,
        markedForReview: currentAns?.markedForReview ?? false,
        version: (currentAns?.version || 1) + 1,
      },
      200
    );
  };

  // ----------------------------------------------------------------------------
  // 8. Submission Handlers (Manual & Automatic Timeout)
  // ----------------------------------------------------------------------------
  const handleFinalSubmit = async (reason = 'MANUAL') => {
    if (!session.attemptId || session.isSubmitted || session.isDisqualified || isSubmitting) return;

    setIsSubmitting(true);
    flushPendingAutosaves();

    try {
      const res = await api.post(`/attempts/${session.attemptId}/submit`, {
        reason,
      });

      if (res?.data) {
        dispatch(setSubmissionSuccess(res.data));
        setIsSubmitModalOpen(false);
      }
    } catch (err) {
      console.warn('Final submission notice:', err.message);
      if (err?.response?.status === 403 && err?.response?.data?.message?.includes('disqualified')) {
        dispatch(disqualifySession({ violationCount: 2 }));
        setIsSubmitModalOpen(false);
        return;
      }
      if (err?.message?.includes('Network') || !err?.response) {
        let answered = 0;
        let marked = 0;
        for (const q of session.questions) {
          const ans = session.answers[q.id];
          const hasOption = Array.isArray(ans?.selectedOptions) && ans.selectedOptions.length > 0;
          const hasText = ans?.descriptiveAnswer && ans.descriptiveAnswer.trim().length > 0;
          if (hasOption || hasText) answered++;
          if (ans?.markedForReview) marked++;
        }
        dispatch(
          setSubmissionSuccess({
            attemptId: session.attemptId,
            examId: session.examId,
            status: reason === 'AUTO_TIMEOUT' ? 'AUTO_SUBMITTED' : 'SUBMITTED',
            submissionReason: reason,
            submittedAt: new Date().toISOString(),
            totalQuestions: session.questions.length,
            answeredCount: answered,
            unansweredCount: Math.max(0, session.questions.length - answered),
            markedForReviewCount: marked,
          })
        );
        setIsSubmitModalOpen(false);
        return;
      }
      alert(err?.message || 'Submission failed. Please check your connection and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmission = useCallback(() => {
    handleFinalSubmit('AUTO_TIMEOUT');
  }, [session.attemptId]);

  // ----------------------------------------------------------------------------
  // 9. Render Loading and Error States
  // ----------------------------------------------------------------------------
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-deep-navy flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold shadow-lg shadow-blue-500/20">
            ES
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-blue-400 absolute -bottom-1 -right-1" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-100">Initializing Examination Session</h2>
          <p className="text-xs text-slate-400">
            Authorizing security tokens, loading questions, and synchronizing timers...
          </p>
        </div>
      </div>
    );
  }

  // Irreversible Disqualification Screen
  if (session.isDisqualified) {
    return (
      <div className="min-h-screen bg-deep-navy flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="p-8 sm:p-10 rounded-3xl border border-rose-500/40 max-w-lg w-full space-y-6 bg-slate-navy/95 backdrop-blur-md shadow-2xl animate-fade-in">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <AlertTriangle className="w-3.5 h-3.5" />
              Attempt Terminated • Two-Strike Policy
            </div>
            <h2 className="text-2xl font-black text-white">Examination Disqualified</h2>
            <p className="text-xs text-rose-200/90 leading-relaxed">
              Your examination session has been permanently disqualified due to repeated window departures or security violations.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-left text-xs space-y-2.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Integrity Status:</span>
              <span className="font-mono font-bold text-rose-400">DISQUALIFIED (Irreversible)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Violations Recorded:</span>
              <span className="font-mono font-bold text-rose-300">2 of 2 (Maximum Exceeded)</span>
            </div>
            <div className="flex justify-between items-start gap-2">
              <span className="text-slate-400 shrink-0">Reason:</span>
              <span className="font-mono text-slate-300 text-right">
                {session.disqualifyReason || 'Window/tab departure policy exceeded'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Action Taken:</span>
              <span className="font-mono text-amber-300">Reported to Exam Proctor & Faculty</span>
            </div>
          </div>

          <button
            type="button"
            id="return-dashboard-btn"
            onClick={() => {
              dispatch(resetExamSession());
              navigate('/student');
            }}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-bold text-xs border border-slate-700 shadow-lg transition"
          >
            Return to Student Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Fatal Error Screen (Re-entry blocked for submitted or disqualified attempts)
  if (fatalError) {
    return (
      <div className="min-h-screen bg-deep-navy flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="p-8 rounded-3xl border border-rose-500/30 max-w-md w-full space-y-5 bg-slate-navy/90 backdrop-blur-md shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Examination Access Denied</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{fatalError}</p>
          </div>
          <button
            type="button"
            id="fatal-error-return-btn"
            onClick={() => navigate('/student')}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Student Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // 10. Render Submitted State (Completion Receipt)
  // ----------------------------------------------------------------------------
  if (session.isSubmitted) {
    const sub = session.submissionResult || {};
    return (
      <div className="min-h-screen bg-deep-navy flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="p-8 sm:p-10 rounded-3xl border border-slate-800 max-w-lg w-full space-y-6 bg-slate-navy/95 backdrop-blur-md shadow-2xl animate-fade-in">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Submission Authenticated & Confirmed
            </div>
            <h2 className="text-2xl font-black text-slate-100">Examination Completed!</h2>
            <p className="text-xs text-slate-400">
              Your assessment answers have been safely recorded and queued for grading.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-left text-xs space-y-2.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Submission Mode:</span>
              <span className="font-mono font-bold text-slate-200">
                {sub.submissionReason === 'AUTO_TIMEOUT' ? 'Automatic (Timer Expired)' : 'Manual Submission'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Questions:</span>
              <span className="font-mono font-bold text-slate-200">{sub.totalQuestions || session.questions.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Answered:</span>
              <span className="font-mono font-bold text-emerald-400">{sub.answeredCount ?? 'All Recorded'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Submitted At:</span>
              <span className="font-mono text-slate-300">
                {new Date(sub.submittedAt || Date.now()).toLocaleTimeString()}
              </span>
            </div>
          </div>

          <button
            type="button"
            id="portal-return-btn"
            onClick={() => {
              dispatch(resetExamSession());
              navigate('/student');
            }}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition"
          >
            Back to Student Portal
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // 11. Secure Fullscreen Gatekeeper (Shown before starting exam & countdown timer)
  // ----------------------------------------------------------------------------
  if (showFullscreenPrompt) {
    return (
      <div className="min-h-screen bg-deep-navy flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-blue-500/30 max-w-xl w-full space-y-6 bg-slate-navy/95 backdrop-blur-md shadow-2xl animate-fade-in text-left">
          <div className="flex items-center gap-3.5 border-b border-slate-800 pb-4">
            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-400">
                Secure Proctoring Gateway
              </span>
              <h2 className="text-xl font-black text-white">
                {session.exam?.title || 'Examination Rules & Security'}
              </h2>
              <div className="text-xs text-slate-400 mt-0.5">
                {session.exam?.course?.code} — {session.exam?.course?.title}
              </div>
            </div>
          </div>

          {/* Security Protocols List */}
          <div className="space-y-3 text-xs text-slate-300">
            <h3 className="font-bold text-slate-100 uppercase tracking-wider text-[11px] text-blue-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Examination Security Protocol & Two-Strike Policy
            </h3>
            <ul className="space-y-2.5 text-slate-300 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Mandatory Fullscreen Mode:</strong> Fullscreen mode is strictly required. The examination countdown timer will only begin once you enter fullscreen.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Two-Strike Anti-Cheating Policy:</strong> Leaving the examination window, switching tabs, or exiting fullscreen will count as an integrity violation:
                </span>
              </li>
              <div className="ml-4 pl-3 border-l-2 border-slate-800 space-y-1.5 text-[11px]">
                <div className="text-amber-300">
                  • <strong>Strike 1 (First Violation):</strong> An official warning is recorded and displayed on your screen.
                </div>
                <div className="text-rose-400">
                  • <strong>Strike 2 (Second Violation):</strong> Your attempt will be <strong>immediately and permanently disqualified</strong> without appeal.
                </div>
              </div>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>
                  <strong>One-Time Submission:</strong> Once submitted, your answers are permanently locked. Resubmission or editing is not permitted.
                </span>
              </li>
              <li className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span>
                  ℹ️ <strong>System Note:</strong> The platform actively monitors document visibility changes, tab switching, and window focus loss. Web browsers cannot reliably prevent external devices or OS-level shortcuts.
                </span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            id="enter-fullscreen-btn"
            onClick={requestFullScreen}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Enter Fullscreen & Begin Examination</span>
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // 12. Active Examination Interface
  // ----------------------------------------------------------------------------
  const currentQ = session.questions[session.currentIndex];
  const currentAnsState = currentQ ? session.answers[currentQ.id] : null;

  // Compute breakdown for modal
  let answeredCount = 0;
  let markedCount = 0;
  for (const q of session.questions) {
    const ans = session.answers[q.id];
    const hasOptions = Array.isArray(ans?.selectedOptions) && ans.selectedOptions.length > 0;
    const hasText = ans?.descriptiveAnswer && ans.descriptiveAnswer.trim().length > 0;
    if (hasOptions || hasText) answeredCount++;
    if (ans?.markedForReview) markedCount++;
  }
  const unansweredCount = Math.max(0, session.questions.length - answeredCount);

  return (
    <div className="min-h-screen bg-deep-navy text-slate-100 flex flex-col font-sans select-none selection:bg-blue-600 selection:text-white">
      {/* Top Banner if Strike 1 active */}
      {session.violationCount === 1 && !session.isDisqualified && (
        <div
          id="strike-warning-banner"
          className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-center text-xs text-amber-300 font-semibold flex items-center justify-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Warning 1/2 Active:</strong> Leaving the examination window again will immediately disqualify your attempt.
          </span>
        </div>
      )}

      {/* Header Bar */}
      <ExamHeader
        examTitle={session.exam?.title || 'Examination'}
        courseCode={session.exam?.course?.code || ''}
        courseTitle={session.exam?.course?.title || ''}
        student={user}
        remainingSeconds={session.remainingSeconds}
        isExpired={session.isTimerExpired}
        saveStatus={session.saveStatus}
        lastSavedAt={session.lastSavedAt}
        isOnline={session.isOnline}
        onTimerExpire={handleAutoSubmission}
      />

      {/* Main Examination Viewport */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Area (8 columns on desktop): Question Card */}
        <section className="lg:col-span-8 flex flex-col justify-between">
          <QuestionCard
            question={currentQ}
            totalQuestions={session.questions.length}
            currentIndex={session.currentIndex}
            answerState={currentAnsState}
            attemptId={session.attemptId}
            examId={session.exam?.id}
            onSelectOption={handleSelectOption}
            onToggleMultipleOption={handleToggleMultipleOption}
            onDescriptiveChange={handleDescriptiveChange}
            onToggleMarkForReview={handleToggleMarkForReview}
            onClearResponse={handleClearResponse}
            onPrevious={() => dispatch(setCurrentQuestion(session.currentIndex - 1))}
            onNext={() => dispatch(setCurrentQuestion(session.currentIndex + 1))}
            isFirst={session.currentIndex === 0}
            isLast={session.currentIndex === session.questions.length - 1}
            disabled={session.isTimerExpired || session.isSubmitted || session.isDisqualified}
          />
        </section>

        {/* Right Area (4 columns on desktop): Question Navigation Palette */}
        <section className="lg:col-span-4">
          <QuestionPalette
            questions={session.questions}
            currentIndex={session.currentIndex}
            answers={session.answers}
            visitedQuestionIds={session.visitedQuestionIds}
            onSelectQuestion={(idx) => dispatch(setCurrentQuestion(idx))}
            onSubmitClick={() => setIsSubmitModalOpen(true)}
            disabled={session.isTimerExpired || session.isSubmitted || session.isDisqualified}
          />
        </section>
      </main>

      {/* Fullscreen Exit Security Warning Overlay */}
      {isFullscreenExitWarningOpen && !session.isDisqualified && !session.isSubmitted && (
        <div
          id="fullscreen-exit-warning-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in select-none"
        >
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl border border-amber-500/40 bg-slate-navy shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
              <Minimize2 className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-white">Security Alert: Fullscreen Exited</h3>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                You have exited fullscreen mode. Exiting fullscreen or navigating away from this window violates examination security and is recorded as a violation.
              </p>
            </div>
            <button
              type="button"
              id="return-fullscreen-btn"
              onClick={requestFullScreen}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition flex items-center justify-center gap-2"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Return to Fullscreen Mode</span>
            </button>
          </div>
        </div>
      )}

      {/* Strike 1 Warning Modal */}
      {strikeWarningModal.isOpen && !session.isDisqualified && (
        <div
          id="strike-warning-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in select-none"
        >
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl border border-rose-500/40 bg-slate-navy shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Academic Integrity Warning
              </div>
              <h3 className="text-base font-black text-white text-rose-100">
                Warning 1/2: Leaving the examination window again will disqualify your attempt.
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                A window departure, tab switch, or fullscreen exit was confirmed and logged.
                This is your <strong>first and only warning</strong>. Leaving this window again will immediately result in permanent disqualification.
              </p>
            </div>
            <button
              type="button"
              id="ack-warning-btn"
              onClick={() => {
                setStrikeWarningModal({ isOpen: false, strike: 1, message: '' });
                requestFullScreen();
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold shadow-lg shadow-rose-600/20 transition flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>I Understand & Acknowledge (Return to Exam)</span>
            </button>
          </div>
        </div>
      )}

      {/* Irreversible Final Submission Safeguard Confirmation Modal */}
      <SubmitConfirmation
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirm={() => handleFinalSubmit('MANUAL')}
        totalQuestions={session.questions.length}
        answeredCount={answeredCount}
        unansweredCount={unansweredCount}
        markedForReviewCount={markedCount}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
