// ==============================================================================
// ExamSphere – Super Admin Management Service
// Security-critical operations with step-up verification and last-admin guards
// ==============================================================================

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';

export class SuperAdminService {
  /**
   * Helper: verify Super Admin step-up password
   */
  async verifySuperAdminPassword(adminId, password) {
    if (!password) {
      throw ApiError.badRequest('Verification password is required');
    }

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, password: true, role: true, isActive: true },
    });

    if (!admin || admin.role !== 'SUPER_ADMIN' || !admin.isActive) {
      throw ApiError.forbidden('Unauthorized: Only active Super Admins can perform this action');
    }

    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      throw ApiError.unauthorized('Password verification failed. Action rejected.');
    }

    return true;
  }

  /**
   * List all Super Admins
   */
  async listSuperAdmins() {
    return prisma.user.findMany({
      where: {
        role: 'SUPER_ADMIN',
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isDemo: true,
        isEmailVerified: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Promote an existing user to Super Admin
   */
  async promoteToSuperAdmin(currentAdminId, { userId, verificationPassword, ipAddress, userAgent }) {
    await this.verifySuperAdminPassword(currentAdminId, verificationPassword);

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isActive: true, deletedAt: true },
    });

    if (!targetUser || targetUser.deletedAt) {
      throw ApiError.notFound('Target user not found');
    }

    if (targetUser.role === 'SUPER_ADMIN') {
      throw ApiError.badRequest(`User '${targetUser.email}' is already a Super Admin`);
    }

    if (!targetUser.isActive) {
      throw ApiError.badRequest(`Cannot promote deactivated user '${targetUser.email}'. Activate the account first.`);
    }

    const previousRole = targetUser.role;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: 'SUPER_ADMIN' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isDemo: true,
        isEmailVerified: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: currentAdminId,
        action: 'SUPER_ADMIN_PROMOTED',
        resource: 'USER',
        resourceId: userId,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        metadata: {
          targetEmail: targetUser.email,
          previousRole,
          promotedBy: currentAdminId,
        },
      },
    }).catch(() => {});

    return updatedUser;
  }

  /**
   * Demote a Super Admin with last-active-admin guard
   */
  async demoteSuperAdmin(currentAdminId, { userId, targetRole, departmentId, verificationPassword, ipAddress, userAgent }) {
    await this.verifySuperAdminPassword(currentAdminId, verificationPassword);

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isActive: true, deletedAt: true, departmentId: true },
    });

    if (!targetUser || targetUser.deletedAt) {
      throw ApiError.notFound('Target user not found');
    }

    if (targetUser.role !== 'SUPER_ADMIN') {
      throw ApiError.badRequest(`User '${targetUser.email}' is not a Super Admin`);
    }

    // Last Active Super Admin Protection Guard
    const activeSuperAdminCount = await prisma.user.count({
      where: {
        role: 'SUPER_ADMIN',
        isActive: true,
        deletedAt: null,
      },
    });

    if (targetUser.isActive && activeSuperAdminCount <= 1) {
      throw ApiError.forbidden(
        'Action rejected: Cannot demote the last active Super Admin. The platform requires at least one active Super Admin to ensure governance.'
      );
    }

    if (targetRole === 'DEPARTMENT_ADMIN' && departmentId) {
      const deptExists = await prisma.department.findUnique({
        where: { id: departmentId },
      });
      if (!deptExists) {
        throw ApiError.badRequest('Assigned department does not exist');
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: targetRole,
        departmentId: departmentId !== undefined ? departmentId : targetUser.departmentId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        isActive: true,
        isDemo: true,
        isEmailVerified: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: currentAdminId,
        action: 'SUPER_ADMIN_DEMOTED',
        resource: 'USER',
        resourceId: userId,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        metadata: {
          targetEmail: targetUser.email,
          previousRole: 'SUPER_ADMIN',
          newRole: targetRole,
          demotedBy: currentAdminId,
        },
      },
    }).catch(() => {});

    return updatedUser;
  }

  /**
   * Suspend or reactivate Super Admin account with last-active-admin guard
   */
  async toggleSuperAdminStatus(currentAdminId, targetId, { isActive, verificationPassword, ipAddress, userAgent }) {
    await this.verifySuperAdminPassword(currentAdminId, verificationPassword);

    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, email: true, role: true, isActive: true, deletedAt: true },
    });

    if (!targetUser || targetUser.deletedAt) {
      throw ApiError.notFound('Target user not found');
    }

    if (targetUser.role !== 'SUPER_ADMIN') {
      throw ApiError.badRequest('Target user is not a Super Admin');
    }

    // Last Active Super Admin Protection Guard
    if (!isActive && targetUser.isActive) {
      const activeSuperAdminCount = await prisma.user.count({
        where: {
          role: 'SUPER_ADMIN',
          isActive: true,
          deletedAt: null,
        },
      });

      if (activeSuperAdminCount <= 1) {
        throw ApiError.forbidden(
          'Action rejected: Cannot suspend the last active Super Admin account. At least one active Super Admin must remain to maintain platform access.'
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetId },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isDemo: true,
        isEmailVerified: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: currentAdminId,
        action: isActive ? 'SUPER_ADMIN_REACTIVATED' : 'SUPER_ADMIN_SUSPENDED',
        resource: 'USER',
        resourceId: targetId,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        metadata: {
          targetEmail: targetUser.email,
          performedBy: currentAdminId,
        },
      },
    }).catch(() => {});

    return updatedUser;
  }

  /**
   * Sensitive Action Step-up Verification
   */
  async verifyAction(adminId, verificationPassword) {
    return this.verifySuperAdminPassword(adminId, verificationPassword);
  }
}

export const superAdminService = new SuperAdminService();
