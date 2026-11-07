// ==============================================================================
// ExamSphere – Redux Store Configuration
// ==============================================================================

import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice.js';
import systemReducer from './slices/systemSlice.js';
import examSessionReducer from './slices/examSessionSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    system: systemReducer,
    examSession: examSessionReducer,
  },
  devTools: import.meta.env.DEV,
});

export default store;
