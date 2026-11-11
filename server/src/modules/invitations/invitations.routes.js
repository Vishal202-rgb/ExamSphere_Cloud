// ==============================================================================
// ExamSphere – Invitation Routes
// ==============================================================================

import { Router } from 'express';
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  verifyInvitationToken,
  acceptInvitation,
} from './invitations.controller.js';
import {
  createInvitationSchema,
  acceptInvitationSchema,
  verifyInvitationTokenSchema,
} from './invitations.validation.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import { authLimiter } from '../../middlewares/rateLimiter.middleware.js';

const router = Router();

// Public invitation verification & acceptance routes
router.get('/verify', validateRequest(verifyInvitationTokenSchema), verifyInvitationToken);
router.post('/accept', authLimiter, validateRequest(acceptInvitationSchema), acceptInvitation);

// Protected routes (Department Admin and Super Admin only)
router.use(authenticateUser);
router.use(authorizeRoles('SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'ADMIN'));

router.post('/', validateRequest(createInvitationSchema), createInvitation);
router.get('/', listInvitations);
router.patch('/:id/revoke', revokeInvitation);

export default router;
