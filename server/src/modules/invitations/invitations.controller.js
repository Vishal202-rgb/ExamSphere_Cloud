// ==============================================================================
// ExamSphere – Invitation Controller
// ==============================================================================

import { invitationService } from './invitations.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const createInvitation = asyncHandler(async (req, res) => {
  const result = await invitationService.createInvitation(
    req.user,
    req.body,
    req.ip,
    req.headers['user-agent']
  );
  return res.status(201).json(ApiResponse.created(result, 'Invitation dispatched successfully'));
});

export const listInvitations = asyncHandler(async (req, res) => {
  const { role, status, page, limit, search } = req.query;
  const result = await invitationService.listInvitations(req.user, {
    role,
    status,
    search,
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 20,
  });
  return res.status(200).json(ApiResponse.success(result, 'Invitations retrieved'));
});

export const revokeInvitation = asyncHandler(async (req, res) => {
  const result = await invitationService.revokeInvitation(
    req.user,
    req.params.id,
    req.ip,
    req.headers['user-agent']
  );
  return res.status(200).json(ApiResponse.success(result, 'Invitation revoked successfully'));
});

export const verifyInvitationToken = asyncHandler(async (req, res) => {
  const { token } = req.query;
  const result = await invitationService.verifyInvitationToken(token);
  return res.status(200).json(ApiResponse.success(result, 'Invitation token is valid'));
});

export const acceptInvitation = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const user = await invitationService.acceptInvitation({
    token,
    password,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json(ApiResponse.success(user, 'Account activated successfully. You may now log in.'));
});
