// ==============================================================================
// ExamSphere – Authentication Middleware
// Verifies JWT access token, checks account active status, and populates req.user
// ==============================================================================

import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiError.js';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';

export const authenticateUser = async (req, res, next) => {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return next(ApiError.unauthorized('Authentication token is missing. Please log in.'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        rollNumber: true,
        employeeId: true,
        designation: true,
        isDemo: true,
        isEmailVerified: true,
        mfaEnabled: true,
        batch: true,
        section: true,
        avatarUrl: true,
        isActive: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      return next(ApiError.unauthorized('User account no longer exists.'));
    }

    if (!user.isActive) {
      return next(ApiError.forbidden('Your account has been deactivated. Please contact administrator.'));
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Access token has expired. Please refresh token.'));
    }
    return next(new ApiError(401, 'Invalid authentication token.'));
  }
};

// Optional authentication middleware for logout and non-blocking endpoints
export const optionalAuthenticateUser = async (req, res, next) => {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        rollNumber: true,
        employeeId: true,
        designation: true,
        isDemo: true,
        isEmailVerified: true,
        mfaEnabled: true,
        batch: true,
        section: true,
        avatarUrl: true,
        isActive: true,
        deletedAt: true,
      },
    });

    if (user && user.isActive && !user.deletedAt) {
      req.user = user;
    }
  } catch (error) {
    // If expired or invalid, still decode payload if possible to assist with logout token revocation
    try {
      const decoded = jwt.decode(token);
      if (decoded?.id) {
        req.user = { id: decoded.id };
      }
    } catch (_) {}
  }

  next();
};

// Backward-compatible alias
export const authenticateJwt = authenticateUser;
