// ==============================================================================
// ExamSphere – Authentication Controller
// Orchestrates HTTP request/response handling and cookie lifecycle
// ==============================================================================

import jwt from 'jsonwebtoken';
import { authService } from './auth.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { env } from '../../config/env.js';

// Cookie configuration
const getCookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: maxAgeMs,
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const ipAddress = req.ip || req.headers['x-forwarded-for'];
  const userAgent = req.headers['user-agent'];

  const { user, accessToken, refreshToken } = await authService.login({
    email,
    password,
    ipAddress,
    userAgent,
  });

  // Set secure cookies
  res.cookie('refreshToken', refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000)); // 7 days
  res.cookie('accessToken', accessToken, getCookieOptions(60 * 60 * 1000)); // 1 hour

  return res.status(200).json(
    ApiResponse.success(
      {
        user,
        accessToken,
        refreshToken,
      },
      'Login successful'
    )
  );
});

export const refreshToken = asyncHandler(async (req, res) => {
  const token = req.body?.refreshToken || req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json(ApiResponse.error('Refresh token is required', 401));
  }

  const result = await authService.refreshAccessToken(token);

  // Set updated rotated cookies
  res.cookie('refreshToken', result.refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));
  res.cookie('accessToken', result.accessToken, getCookieOptions(60 * 60 * 1000));

  return res.status(200).json(
    ApiResponse.success(
      {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
      'Token refreshed successfully'
    )
  );
});

export const logout = asyncHandler(async (req, res) => {
  let userId = req.user?.id;
  const token = req.body?.refreshToken || req.cookies?.refreshToken;

  if (!userId && token) {
    try {
      const decoded = jwt.verify(token, env.REFRESH_TOKEN_SECRET);
      userId = decoded.id;
    } catch {
      try {
        const decoded = jwt.decode(token);
        userId = decoded?.id;
      } catch (_) {}
    }
  }

  if (userId) {
    await authService.logout(userId).catch(() => {});
  }

  // Clear cookies
  const clearCookieOpts = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
  };
  res.clearCookie('accessToken', clearCookieOpts);
  res.clearCookie('refreshToken', clearCookieOpts);

  return res.status(200).json(ApiResponse.success(null, 'Logged out successfully'));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await authService.forgotPassword(email);
  return res.status(200).json(ApiResponse.success(result, result.message));
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  const result = await authService.resetPassword(token, newPassword);
  return res.status(200).json(ApiResponse.success(result, result.message));
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.id);
  return res.status(200).json(ApiResponse.success(user, 'User profile retrieved'));
});
