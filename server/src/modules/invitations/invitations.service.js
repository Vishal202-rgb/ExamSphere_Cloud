// ==============================================================================
// ExamSphere – Invitation Service
// Secure single-use token hashing, expiration, and role-escalation prevention
// ==============================================================================

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';
import { env } from '../../config/env.js';
import { emailService } from '../../utils/email.service.js';

export class InvitationService {
  /**
   * Issue a secure, single-use invitation
   */
  async createInvitation(adminUser, data, ipAddress, userAgent) {
    const isSuperAdmin = adminUser.role === 'SUPER_ADMIN';

    // Role-escalation check: Only Super Admin can invite Super Admin or Department Admin
    if (!isSuperAdmin) {
      if (data.role === 'SUPER_ADMIN' || data.role === 'DEPARTMENT_ADMIN') {
        throw ApiError.forbidden(
          `Only Super Administrators can invite users with role '${data.role}'`
        );
      }

      // Department scoping: Department Admin can only invite to their assigned department
      if (data.departmentId && data.departmentId !== adminUser.departmentId) {
        throw ApiError.forbidden(
          'Forbidden: You can only issue invitations within your assigned department'
        );
      }
      data.departmentId = adminUser.departmentId;
    }

    if ((data.role === 'FACULTY' || data.role === 'STUDENT' || data.role === 'DEPARTMENT_ADMIN') && !data.departmentId) {
      throw ApiError.badRequest(`A department must be assigned when inviting role '${data.role}'`);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          ...(data.rollNumber ? [{ rollNumber: data.rollNumber }] : []),
          ...(data.employeeId ? [{ employeeId: data.employeeId }] : []),
        ],
        deletedAt: null,
      },
    });

    if (existingUser) {
      if (existingUser.email === data.email) {
        throw ApiError.conflict(`An account with email '${data.email}' already exists`);
      }
      if (data.rollNumber && existingUser.rollNumber === data.rollNumber) {
        throw ApiError.conflict(`Roll number '${data.rollNumber}' is already registered`);
      }
      if (data.employeeId && existingUser.employeeId === data.employeeId) {
        throw ApiError.conflict(`Employee ID '${data.employeeId}' is already registered`);
      }
    }

    // Revoke any previous pending invitations for this email
    await prisma.invitation.updateMany({
      where: {
        email: data.email,
        status: 'PENDING',
      },
      data: {
        status: 'REVOKED',
      },
    });

    // Generate 32-byte cryptographic single-use token and store ONLY its SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48-hour expiration window

    const invitation = await prisma.invitation.create({
      data: {
        email: data.email,
        role: data.role,
        departmentId: data.departmentId || null,
        tokenHash,
        invitedById: adminUser.id,
        status: 'PENDING',
        expiresAt,
        metadata: {
          name: data.name,
          employeeId: data.employeeId || null,
          designation: data.designation || null,
          rollNumber: data.rollNumber || null,
          batch: data.batch || null,
          section: data.section || null,
          assignedCourses: data.assignedCourses || [],
          enrolledCourses: data.enrolledCourses || [],
        },
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });

    const inviteUrl = `${env.CLIENT_URL}/accept-invitation?token=${rawToken}`;

    // Dispatch email
    await emailService.sendInvitationEmail({
      to: data.email,
      name: data.name,
      role: data.role,
      inviteUrl,
      expiresAt,
    });

    await prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: 'INVITATION_CREATED',
        resource: 'INVITATION',
        resourceId: invitation.id,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        metadata: {
          email: invitation.email,
          role: invitation.role,
          departmentId: invitation.departmentId,
        },
      },
    }).catch(() => {});

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      department: invitation.department,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      // Provide invite link in non-production environments for automated testing & evaluation
      ...(env.NODE_ENV !== 'production' && { inviteUrl }),
    };
  }

  /**
   * List invitations with role and department scoping
   */
  async listInvitations(adminUser, { role, status, page = 1, limit = 20, search }) {
    const where = {};

    if (adminUser.role !== 'SUPER_ADMIN') {
      where.departmentId = adminUser.departmentId;
    }

    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, invitations] = await Promise.all([
      prisma.invitation.count({ where }),
      prisma.invitation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          department: { select: { id: true, name: true, code: true } },
          invitedBy: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      invitations: invitations.map((inv) => {
        const { tokenHash, ...safe } = inv;
        return safe;
      }),
    };
  }

  /**
   * Revoke an active invitation
   */
  async revokeInvitation(adminUser, invitationId, ipAddress, userAgent) {
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw ApiError.notFound('Invitation not found');
    }

    if (adminUser.role !== 'SUPER_ADMIN' && invitation.departmentId !== adminUser.departmentId) {
      throw ApiError.forbidden('Forbidden: You can only revoke invitations for your assigned department');
    }

    if (invitation.status !== 'PENDING') {
      throw ApiError.badRequest(`Cannot revoke invitation with status '${invitation.status}'`);
    }

    const updated = await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: 'INVITATION_REVOKED',
        resource: 'INVITATION',
        resourceId: invitationId,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        metadata: { email: invitation.email, role: invitation.role },
      },
    }).catch(() => {});

    return updated;
  }

  /**
   * Verify token validity before presenting password creation form
   */
  async verifyInvitationToken(rawToken) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });

    if (!invitation) {
      throw ApiError.badRequest('Invalid or unrecognized invitation link.');
    }

    if (invitation.status === 'ACCEPTED') {
      throw ApiError.badRequest('This invitation has already been accepted. Please log in.');
    }

    if (invitation.status === 'REVOKED') {
      throw ApiError.badRequest('This invitation has been revoked by an administrator.');
    }

    if (new Date() > invitation.expiresAt) {
      if (invitation.status === 'PENDING') {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        });
      }
      throw ApiError.badRequest('This invitation link has expired. Please request a new invitation.');
    }

    return {
      email: invitation.email,
      role: invitation.role,
      name: invitation.metadata?.name || null,
      department: invitation.department,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Accept invitation and set password atomically
   */
  async acceptInvitation({ token, password, ipAddress, userAgent }) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation) {
      throw ApiError.badRequest('Invalid or unrecognized invitation link.');
    }

    if (invitation.status === 'ACCEPTED') {
      throw ApiError.badRequest('This invitation token has already been used and cannot be reused.');
    }

    if (invitation.status === 'REVOKED') {
      throw ApiError.badRequest('This invitation has been revoked by an administrator.');
    }

    if (new Date() > invitation.expiresAt) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw ApiError.badRequest('This invitation has expired.');
    }

    // Check email availability
    const existing = await prisma.user.findUnique({
      where: { email: invitation.email },
    });
    if (existing) {
      throw ApiError.conflict(`An account with email '${invitation.email}' is already registered.`);
    }

    const hashedPassword = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS || 12);
    const meta = invitation.metadata || {};

    // Atomic creation and relationship binding
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          name: meta.name || invitation.email.split('@')[0],
          email: invitation.email,
          password: hashedPassword,
          role: invitation.role,
          departmentId: invitation.departmentId,
          employeeId: meta.employeeId || null,
          designation: meta.designation || null,
          rollNumber: meta.rollNumber || null,
          batch: meta.batch || null,
          section: meta.section || null,
          isActive: true,
          isDemo: false,
          isEmailVerified: true,
        },
      });

      // 2. Assign courses for Faculty
      if (invitation.role === 'FACULTY' && Array.isArray(meta.assignedCourses) && meta.assignedCourses.length > 0) {
        for (const courseId of meta.assignedCourses) {
          await tx.courseFaculty.create({
            data: {
              courseId,
              facultyId: user.id,
              isCoordinator: false,
            },
          }).catch(() => {});
        }
      }

      // 3. Enroll in courses for Student
      if (invitation.role === 'STUDENT' && Array.isArray(meta.enrolledCourses) && meta.enrolledCourses.length > 0) {
        for (const courseId of meta.enrolledCourses) {
          await tx.studentEnrollment.create({
            data: {
              courseId,
              studentId: user.id,
              status: 'ACTIVE',
            },
          }).catch(() => {});
        }
      }

      // 4. Mark invitation as ACCEPTED
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'INVITATION_ACCEPTED',
          resource: 'USER',
          resourceId: user.id,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: {
            email: user.email,
            role: user.role,
            invitationId: invitation.id,
          },
        },
      });

      return user;
    });

    const { password: _, refreshToken, resetPasswordToken, resetPasswordExpiry, ...sanitized } = result;
    return sanitized;
  }
}

export const invitationService = new InvitationService();
