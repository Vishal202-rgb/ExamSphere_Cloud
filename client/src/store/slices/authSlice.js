// ==============================================================================
// ExamSphere – Redux Auth Slice
// Manages authentication state, user identity, and verified RBAC role from JWT payload
// ==============================================================================

import { createSlice } from '@reduxjs/toolkit';
import { decodeToken, isTokenExpired } from '../../lib/utils.js';

const getInitialAuth = () => {
  try {
    const token = localStorage.getItem('examsphere_token') || null;
    const rawUser = localStorage.getItem('examsphere_user');
    const parsedUser = rawUser ? JSON.parse(rawUser) : null;

    if (!token) {
      return { user: null, token: null, role: null, isAuthenticated: false };
    }

    const decoded = decodeToken(token);
    if (!decoded || isTokenExpired(decoded)) {
      // Clear expired credentials on initial application boot
      localStorage.removeItem('examsphere_token');
      localStorage.removeItem('examsphere_refresh_token');
      localStorage.removeItem('examsphere_user');
      return { user: null, token: null, role: null, isAuthenticated: false };
    }

    // Role MUST come from the verified JWT token payload
    const verifiedRole = decoded.role || parsedUser?.role || null;
    const user = parsedUser
      ? { ...parsedUser, role: verifiedRole }
      : { id: decoded.id, email: decoded.email, role: verifiedRole, fullName: decoded.name };

    return {
      user,
      token,
      role: verifiedRole,
      isAuthenticated: Boolean(token && verifiedRole),
    };
  } catch {
    return { user: null, token: null, role: null, isAuthenticated: false };
  }
};

const initialAuth = getInitialAuth();

const initialState = {
  user: initialAuth.user,
  token: initialAuth.token,
  role: initialAuth.role, // 'ADMIN' | 'SUPER_ADMIN' | 'FACULTY' | 'STUDENT'
  isAuthenticated: initialAuth.isAuthenticated,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, token, refreshToken } = action.payload;
      const decoded = decodeToken(token);
      const verifiedRole = decoded?.role || user?.role || null;

      state.user = user ? { ...user, role: verifiedRole } : null;
      state.token = token || null;
      state.role = verifiedRole;
      state.isAuthenticated = Boolean(token && verifiedRole && !isTokenExpired(decoded));
      state.error = null;

      if (token) {
        localStorage.setItem('examsphere_token', token);
      }
      if (refreshToken) {
        localStorage.setItem('examsphere_refresh_token', refreshToken);
      }
      if (user) {
        localStorage.setItem('examsphere_user', JSON.stringify({ ...user, role: verifiedRole }));
      }
    },
    updateUserProfile: (state, action) => {
      state.user = { ...state.user, ...action.payload };
      state.role = state.user?.role || state.role;
      localStorage.setItem('examsphere_user', JSON.stringify(state.user));
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.role = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem('examsphere_token');
      localStorage.removeItem('examsphere_refresh_token');
      localStorage.removeItem('examsphere_user');
    },
    setAuthLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setAuthError: (state, action) => {
      state.error = action.payload;
    },
  },
});

export const { setCredentials, updateUserProfile, logout, setAuthLoading, setAuthError } = authSlice.actions;
export default authSlice.reducer;

