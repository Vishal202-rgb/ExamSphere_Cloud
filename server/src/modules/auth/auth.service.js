// ==============================================================================
// ExamSphere – Authentication Service
// Implements business logic for JWT issuance, token rotation, and credential verification
// ==============================================================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authRepository } from './auth.repository.js';
import { ApiError } from '../../utils/apiError.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/db.js';

export class AuthService {
  /**
   * Issue access token (short-lived, 15m or configured)
   */
  generateAccessToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN || '1h' }
    );
  }

  /**
   * Issue refresh token (long-lived, 7d or 30d)
   */
  generateRefreshToken(user) {
    return jwt.sign(
      { id: user.id },
      env.REFRESH_TOKEN_SECRET,
      { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
    );
  }

  /**
   * Strip sensitive fields from user object
   */
  sanitizeUser(user) {
    const { password, refreshToken, resetPasswordToken, resetPasswordExpiry, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Authenticate credentials and return token pair
   */
  async login({ email, password, ipAddress, userAgent }) {
    const user = await authRepository.findByEmail(email);

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Your account has been deactivated. Please contact an administrator.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Save refresh token for rotation
    await authRepository.updateRefreshToken(user.id, refreshToken);

    // Record audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        resource: 'AUTH',
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        metadata: { role: user.role, email: user.email },
      },
    }).catch(() => {});

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Rotate refresh token and issue new access token
   */
  async refreshAccessToken(oldRefreshToken) {
    if (!oldRefreshToken) {
      throw ApiError.unauthorized('Refresh token is required');
    }

    let decoded;
    try {
      decoded = jwt.verify(oldRefreshToken, env.REFRESH_TOKEN_SECRET);
    } catch (err) {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const user = await authRepository.findById(decoded.id);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not found or account deactivated');
    }

    // Verify token matches active token in database (prevents replay/reuse attacks)
    if (user.refreshToken !== oldRefreshToken) {
      // Possible token theft! Invalidate stored token
      await authRepository.clearRefreshToken(user.id);
      throw ApiError.unauthorized('Invalid refresh token. Session invalidated for security.');
    }

    // Generate new token pair (Refresh Token Rotation)
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user);

    await authRepository.updateRefreshToken(user.id, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Terminate user session
   */
  async logout(userId) {
    if (userId) {
      await authRepository.clearRefreshToken(userId);
    }
    return { success: true };
  }

  /**
   * Generate secure password reset token
   */
  async forgotPassword(email) {
    const user = await authRepository.findByEmail(email);
    if (!user) {
      // Return ambiguous message to prevent email enumeration
      return { message: 'If an account exists with this email, a reset token has been generated.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await authRepository.setResetPasswordToken(user.id, resetToken, expiry);

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        resource: 'AUTH',
      },
    }).catch(() => {});

    return {
      message: 'If an account exists with this email, a reset token has been generated.',
      ...(env.NODE_ENV !== 'production' && { resetToken }),
    };
  }

  /**
   * Reset password with valid token
   */
  async resetPassword(token, newPassword) {
    const user = await authRepository.findByResetToken(token);
    if (!user) {
      throw ApiError.badRequest('Password reset token is invalid or has expired.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS || 12);
    await authRepository.updatePassword(user.id, hashedPassword);

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET_COMPLETED',
        resource: 'AUTH',
      },
    }).catch(() => {});

    return { message: 'Password has been successfully updated. You may now log in.' };
  }

  /**
   * Get current authenticated user profile
   */
  async getProfile(userId) {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    return this.sanitizeUser(user);
  }
}

export const authService = new AuthService();
