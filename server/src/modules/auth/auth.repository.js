// ==============================================================================
// ExamSphere – Authentication Data Repository
// Encapsulates Prisma operations for User accounts and authentication tokens
// ==============================================================================

import { prisma } from '../../config/db.js';

export class AuthRepository {
  /**
   * Find a user by email with department details
   */
  async findByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  /**
   * Find a user by primary key ID
   */
  async findById(id) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  /**
   * Update the user's active refresh token
   */
  async updateRefreshToken(userId, refreshToken) {
    return prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });
  }

  /**
   * Store password reset token and expiration timestamp
   */
  async setResetPasswordToken(userId, token, expiry) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        resetPasswordToken: token,
        resetPasswordExpiry: expiry,
      },
    });
  }

  /**
   * Find user by valid unexpired reset password token
   */
  async findByResetToken(token) {
    return prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiry: {
          gt: new Date(),
        },
      },
    });
  }

  /**
   * Update password hash, clear reset tokens and refresh token
   */
  async updatePassword(userId, hashedPassword) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
        refreshToken: null, // Force re-login on all devices
      },
    });
  }

  /**
   * Invalidate refresh token on logout
   */
  async clearRefreshToken(userId) {
    return prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }
}

export const authRepository = new AuthRepository();
