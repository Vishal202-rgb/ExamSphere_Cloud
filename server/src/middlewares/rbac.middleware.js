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

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Forbidden: Role '${req.user.role}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
};
