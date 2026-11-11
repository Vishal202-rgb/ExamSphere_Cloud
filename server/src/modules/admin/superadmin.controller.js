// ==============================================================================
// ExamSphere – Super Admin Management Controller
// ==============================================================================

import { superAdminService } from './superadmin.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const listSuperAdmins = asyncHandler(async (req, res) => {
  const superAdmins = await superAdminService.listSuperAdmins();
  return res.status(200).json(ApiResponse.success(superAdmins, 'Super Admin accounts retrieved'));
});

export const promoteToSuperAdmin = asyncHandler(async (req, res) => {
  const { userId, verificationPassword } = req.body;
  const user = await superAdminService.promoteToSuperAdmin(req.user.id, {
    userId,
    verificationPassword,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json(ApiResponse.success(user, 'User successfully promoted to Super Admin'));
});

export const demoteSuperAdmin = asyncHandler(async (req, res) => {
  const { userId, targetRole, departmentId, verificationPassword } = req.body;
  const user = await superAdminService.demoteSuperAdmin(req.user.id, {
    userId,
    targetRole,
    departmentId,
    verificationPassword,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json(ApiResponse.success(user, `Super Admin successfully demoted to ${targetRole}`));
});

export const toggleSuperAdminStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive, verificationPassword } = req.body;
  const user = await superAdminService.toggleSuperAdminStatus(req.user.id, id, {
    isActive,
    verificationPassword,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res
    .status(200)
    .json(
      ApiResponse.success(
        user,
        `Super Admin account ${isActive ? 'reactivated' : 'suspended'} successfully`
      )
    );
});

export const verifyAction = asyncHandler(async (req, res) => {
  const { verificationPassword } = req.body;
  await superAdminService.verifyAction(req.user.id, verificationPassword);
  return res.status(200).json(ApiResponse.success({ verified: true }, 'Step-up verification successful'));
});
