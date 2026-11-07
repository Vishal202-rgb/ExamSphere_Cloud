// ==============================================================================
// ExamSphere – Redux Exam Session Slice
// Centralized state management for active examination sessions, question navigation,
// answer state, optimistic concurrency versioning, and autosave status
// ==============================================================================

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  attemptId: null,
  examId: null,
  attemptNumber: 1,
  startedAt: null,
  expiresAt: null,
  exam: null,
  questions: [],
  currentIndex: 0,
  // answers map: questionId -> { selectedOptions: [], descriptiveAnswer: '', markedForReview: false, version: 1, isSaved: true, savedAt: null }
  answers: {},
  visitedQuestionIds: [],
  remainingSeconds: 0,
  isTimerExpired: false,
  saveStatus: 'saved', // 'saved' | 'saving' | 'error' | 'offline'
  lastSavedAt: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSubmitted: false,
  submissionResult: null,
  violationCount: 0,
  isDisqualified: false,
  disqualifyReason: null,
  isLoading: false,
  error: null,
};

export const examSessionSlice = createSlice({
  name: 'examSession',
  initialState,
  reducers: {
    initializeSession: (state, action) => {
      const { attempt } = action.payload;
      state.attemptId = attempt.id;
      state.examId = attempt.examId;
      state.attemptNumber = attempt.attemptNumber || 1;
      state.startedAt = attempt.startedAt;
      state.expiresAt = attempt.expiresAt;
      state.remainingSeconds = attempt.remainingSeconds || 0;
      state.isTimerExpired = (attempt.remainingSeconds || 0) <= 0;
      state.exam = attempt.exam || null;
      state.questions = attempt.questions || [];
      state.currentIndex = 0;
      state.isSubmitted = ['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'].includes(attempt.status);
      state.violationCount = attempt.violationCount || 0;
      state.isDisqualified = Boolean(
        attempt.isDisqualified || attempt.status === 'DISQUALIFIED' || attempt.status === 'CANCELLED'
      );
      state.disqualifyReason = attempt.disqualifyReason || null;
      state.submissionResult = state.isSubmitted
        ? {
            status: attempt.status,
            submissionReason: attempt.submissionReason,
            submittedAt: attempt.submittedAt,
          }
        : null;

      // Populate answers dictionary
      const populatedAnswers = {};
      const visited = [];

      for (const q of attempt.questions || []) {
        const existingAns = attempt.answers?.[q.id];
        if (existingAns) {
          const hasSelected = Array.isArray(existingAns.selectedOptions) && existingAns.selectedOptions.length > 0;
          const hasText = existingAns.descriptiveAnswer && existingAns.descriptiveAnswer.trim().length > 0;
          if (hasSelected || hasText || existingAns.markedForReview) {
            visited.push(q.id);
          }
          populatedAnswers[q.id] = {
            selectedOptions: existingAns.selectedOptions || [],
            descriptiveAnswer: existingAns.descriptiveAnswer || '',
            markedForReview: Boolean(existingAns.markedForReview),
            version: existingAns.version || 1,
            isSaved: true,
            savedAt: existingAns.savedTimestamp || null,
          };
        } else {
          populatedAnswers[q.id] = {
            selectedOptions: [],
            descriptiveAnswer: '',
            markedForReview: false,
            version: 1,
            isSaved: true,
            savedAt: null,
          };
        }
      }

      // Mark the first question as visited initially
      if (attempt.questions?.[0] && !visited.includes(attempt.questions[0].id)) {
        visited.push(attempt.questions[0].id);
      }

      state.answers = populatedAnswers;
      state.visitedQuestionIds = visited;
      state.saveStatus = 'saved';
      state.error = null;
      state.isLoading = false;
    },

    setCurrentQuestion: (state, action) => {
      const newIndex = action.payload;
      if (newIndex >= 0 && newIndex < state.questions.length) {
        state.currentIndex = newIndex;
        const currentQ = state.questions[newIndex];
        if (currentQ && !state.visitedQuestionIds.includes(currentQ.id)) {
          state.visitedQuestionIds.push(currentQ.id);
        }
      }
    },

    updateSingleChoiceOption: (state, action) => {
      const { questionId, optionId } = action.payload;
      const current = state.answers[questionId] || {
        selectedOptions: [],
        descriptiveAnswer: '',
        markedForReview: false,
        version: 1,
      };

      state.answers[questionId] = {
        ...current,
        selectedOptions: [optionId],
        version: (current.version || 1) + 1,
        isSaved: false,
      };
      state.saveStatus = 'saving';

      if (!state.visitedQuestionIds.includes(questionId)) {
        state.visitedQuestionIds.push(questionId);
      }
    },

    toggleMultipleChoiceOption: (state, action) => {
      const { questionId, optionId } = action.payload;
      const current = state.answers[questionId] || {
        selectedOptions: [],
        descriptiveAnswer: '',
        markedForReview: false,
        version: 1,
      };

      const existingOptions = current.selectedOptions || [];
      const isSelected = existingOptions.includes(optionId);
      const newOptions = isSelected
        ? existingOptions.filter((id) => id !== optionId)
        : [...existingOptions, optionId];

      state.answers[questionId] = {
        ...current,
        selectedOptions: newOptions,
        version: (current.version || 1) + 1,
        isSaved: false,
      };
      state.saveStatus = 'saving';

      if (!state.visitedQuestionIds.includes(questionId)) {
        state.visitedQuestionIds.push(questionId);
      }
    },

    setDescriptiveAnswer: (state, action) => {
      const { questionId, text } = action.payload;
      const current = state.answers[questionId] || {
        selectedOptions: [],
        descriptiveAnswer: '',
        markedForReview: false,
        version: 1,
      };

      state.answers[questionId] = {
        ...current,
        descriptiveAnswer: text,
        version: (current.version || 1) + 1,
        isSaved: false,
      };
      state.saveStatus = 'saving';

      if (!state.visitedQuestionIds.includes(questionId)) {
        state.visitedQuestionIds.push(questionId);
      }
    },

    toggleMarkForReview: (state, action) => {
      const { questionId } = action.payload;
      const current = state.answers[questionId] || {
        selectedOptions: [],
        descriptiveAnswer: '',
        markedForReview: false,
        version: 1,
      };

      state.answers[questionId] = {
        ...current,
        markedForReview: !current.markedForReview,
        version: (current.version || 1) + 1,
        isSaved: false,
      };
      state.saveStatus = 'saving';

      if (!state.visitedQuestionIds.includes(questionId)) {
        state.visitedQuestionIds.push(questionId);
      }
    },

    clearAnswerResponse: (state, action) => {
      const { questionId } = action.payload;
      const current = state.answers[questionId] || {
        selectedOptions: [],
        descriptiveAnswer: '',
        markedForReview: false,
        version: 1,
      };

      state.answers[questionId] = {
        ...current,
        selectedOptions: [],
        descriptiveAnswer: '',
        version: (current.version || 1) + 1,
        isSaved: false,
      };
      state.saveStatus = 'saving';
    },

    acknowledgeSaveSuccess: (state, action) => {
      const { questionId, version, savedTimestamp } = action.payload;
      if (state.answers[questionId]) {
        state.answers[questionId].version = version;
        state.answers[questionId].isSaved = true;
        state.answers[questionId].savedAt = savedTimestamp;
      }
      state.saveStatus = 'saved';
      state.lastSavedAt = savedTimestamp;
    },

    setSaveStatus: (state, action) => {
      state.saveStatus = action.payload;
    },

    decrementRemainingSeconds: (state) => {
      if (state.remainingSeconds > 0) {
        state.remainingSeconds -= 1;
        if (state.remainingSeconds === 0) {
          state.isTimerExpired = true;
        }
      }
    },

    syncRemainingSeconds: (state, action) => {
      state.remainingSeconds = action.payload;
      state.isTimerExpired = action.payload <= 0;
    },

    setNetworkStatus: (state, action) => {
      state.isOnline = action.payload;
      if (!action.payload) {
        state.saveStatus = 'offline';
      }
    },

    setSubmissionSuccess: (state, action) => {
      state.isSubmitted = true;
      state.submissionResult = action.payload;
    },

    setSessionLoading: (state, action) => {
      state.isLoading = action.payload;
    },

    setSessionError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    setViolationStatus: (state, action) => {
      state.violationCount = action.payload.violationCount ?? state.violationCount;
      if (action.payload.isDisqualified) {
        state.isDisqualified = true;
        state.disqualifyReason = action.payload.disqualifyReason || 'Disqualified for exam security violations';
      }
    },

    disqualifySession: (state, action) => {
      state.isDisqualified = true;
      state.violationCount = action.payload?.violationCount || 2;
      state.disqualifyReason = action.payload?.reason || 'Disqualified for exam security violations';
    },

    resetExamSession: () => initialState,
  },
});

export const {
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
} = examSessionSlice.actions;

export default examSessionSlice.reducer;
