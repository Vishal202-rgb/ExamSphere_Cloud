// ==============================================================================
// ExamSphere – Redux Store Configuration
// ==============================================================================

import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice.js';
import systemReducer from './slices/systemSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    system: systemReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});

export default store;
