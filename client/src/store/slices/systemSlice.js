// ==============================================================================
// ExamSphere – Redux System Status Slice
// Stores real-time health checks, server uptime, and connectivity metrics
// ==============================================================================

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  health: {
    status: 'checking',
    checks: {
      database: { status: 'checking' },
      redis: { status: 'checking' },
    },
    uptimeSeconds: 0,
    timestamp: null,
  },
  lastChecked: null,
  error: null,
};

const systemSlice = createSlice({
  name: 'system',
  initialState,
  reducers: {
    setHealthData: (state, action) => {
      state.health = action.payload;
      state.lastChecked = new Date().toISOString();
      state.error = null;
    },
    setHealthError: (state, action) => {
      state.health.status = 'offline';
      state.health.checks.database.status = 'unreachable';
      state.health.checks.redis.status = 'unreachable';
      state.error = action.payload;
      state.lastChecked = new Date().toISOString();
    },
  },
});

export const { setHealthData, setHealthError } = systemSlice.actions;
export default systemSlice.reducer;
