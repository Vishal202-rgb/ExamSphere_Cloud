// ==============================================================================
// ExamSphere – User Roles Definition
// Role-Based Access Control (RBAC) Constants
// ==============================================================================

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  DEPARTMENT_ADMIN: 'DEPARTMENT_ADMIN',
  ADMIN: 'ADMIN', // Backward-compatibility alias
  FACULTY: 'FACULTY',
  STUDENT: 'STUDENT',
});

export const ALL_ROLES = Object.values(ROLES);
