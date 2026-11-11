// ==============================================================================
// ExamSphere – Role-Based Access Control (RBAC) Middleware
// Validates whether the authenticated user holds the required role(s)
// ==============================================================================

import { ApiError } from '../utils/apiError.js';

/**
 * Authorize users based on one or more allowed roles
 * @param {...string} allowedRoles - E.g. 'SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'ADMIN', 'FACULTY', 'STUDENT'
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    const userRole = req.user.role;

    // Direct role match
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    // SUPER_ADMIN has platform-wide access to administrative resources,
    // but candidate-specific exam attempts remain isolated to STUDENT
    if (userRole === 'SUPER_ADMIN' && !allowedRoles.every((r) => r === 'STUDENT')) {
      return next();
    }

    // Backward compatibility for ADMIN:
    // If endpoint checks 'ADMIN', accept 'DEPARTMENT_ADMIN', 'ADMIN', or 'SUPER_ADMIN'
    if (
      allowedRoles.includes('ADMIN') &&
      (userRole === 'DEPARTMENT_ADMIN' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN')
    ) {
      return next();
    }

    // Allow legacy ADMIN to access SUPER_ADMIN administrative routes until transition
    if (
      allowedRoles.includes('SUPER_ADMIN') &&
      userRole === 'ADMIN' &&
      !allowedRoles.every((r) => r === 'STUDENT')
    ) {
      return next();
    }

    // If endpoint checks 'DEPARTMENT_ADMIN', accept 'SUPER_ADMIN' and legacy 'ADMIN'
    if (
      allowedRoles.includes('DEPARTMENT_ADMIN') &&
      (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN')
    ) {
      return next();
    }

    return next(
      ApiError.forbidden(
        `Forbidden: Role '${userRole}' is not authorized to access this resource`
      )
    );
  };
};
