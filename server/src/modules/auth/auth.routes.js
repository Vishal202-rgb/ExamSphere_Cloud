// ==============================================================================
// ExamSphere – Authentication Route Definitions
// ==============================================================================

import { Router } from 'express';
import {
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
  bootstrap,
} from './auth.controller.js';
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  bootstrapSchema,
} from './auth.validation.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import { authenticateUser, optionalAuthenticateUser } from '../../middlewares/auth.middleware.js';
import { authLimiter, passwordResetLimiter } from '../../middlewares/rateLimiter.middleware.js';

const router = Router();

router.post('/login', authLimiter, validateRequest(loginSchema), login);
router.post('/refresh', validateRequest(refreshTokenSchema), refreshToken);
router.post('/logout', optionalAuthenticateUser, logout);
router.post('/forgot-password', passwordResetLimiter, validateRequest(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', passwordResetLimiter, validateRequest(resetPasswordSchema), resetPassword);
router.post('/bootstrap', authLimiter, validateRequest(bootstrapSchema), bootstrap);
router.get('/me', authenticateUser, getMe);

export default router;
