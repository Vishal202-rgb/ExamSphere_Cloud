// ==============================================================================
// ExamSphere – Role-Based Access Control (RBAC) Middleware
// Validates whether the authenticated user holds the required role(s)
// ==============================================================================

import { ApiError } from '../utils/apiError.js';

/**
 * Authorize users based on one or more allowed roles
 * @param {...string} allowedRoles - E.g. 'ADMIN', 'FACULTY', 'STUDENT'
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    const userRole = req.user.role;
    // Treat SUPER_ADMIN and ADMIN interchangeably for administrative access
    const isAllowed =
      allowedRoles.includes(userRole) ||
      ((allowedRoles.includes('ADMIN') || allowedRoles.includes('SUPER_ADMIN')) &&
        (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'));

    if (!isAllowed) {
      return next(
        ApiError.forbidden(
          `Forbidden: Role '${userRole}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
};
