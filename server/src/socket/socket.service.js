// ==============================================================================
// ExamSphere – Socket.IO Service & Presence Tracker
// Centralized event dispatcher and candidate live status tracking
// ==============================================================================

let ioInstance = null;

// Map of examId -> Set of online student user IDs
const examOnlineCandidates = new Map();

export const setIO = (io) => {
  ioInstance = io;
};

export const getIO = () => {
  return ioInstance;
};

/**
 * Emit event to a specific user's private room
 */
export const emitToUser = (userId, event, data) => {
  if (ioInstance && userId) {
    ioInstance.to(`user:${userId}`).emit(event, data);
  }
};

/**
 * Emit event to an examination room (faculty and assigned candidates)
 */
export const emitToExam = (examId, event, data) => {
  if (ioInstance && examId) {
    ioInstance.to(`exam:${examId}`).emit(event, data);
  }
};

/**
 * Emit event exclusively to faculty monitoring an examination
 */
export const emitToExamFaculty = (examId, event, data) => {
  if (ioInstance && examId) {
    ioInstance.to(`exam:${examId}:faculty`).emit(event, data);
  }
};

/**
 * Add candidate to online presence map for an exam
 */
export const recordCandidateOnline = (examId, studentId) => {
  if (!examId || !studentId) return;
  if (!examOnlineCandidates.has(examId)) {
    examOnlineCandidates.set(examId, new Set());
  }
  examOnlineCandidates.get(examId).add(studentId);
};

/**
 * Remove candidate from online presence map for an exam
 */
export const recordCandidateOffline = (examId, studentId) => {
  if (!examId || !studentId) return;
  const set = examOnlineCandidates.get(examId);
  if (set) {
    set.delete(studentId);
    if (set.size === 0) {
      examOnlineCandidates.delete(examId);
    }
  }
};

/**
 * Check if candidate is currently online in exam
 */
export const isCandidateOnline = (examId, studentId) => {
  const set = examOnlineCandidates.get(examId);
  return Boolean(set && set.has(studentId));
};

/**
 * Get all online student IDs for an exam
 */
export const getOnlineCandidateIds = (examId) => {
  const set = examOnlineCandidates.get(examId);
  return set ? Array.from(set) : [];
};
