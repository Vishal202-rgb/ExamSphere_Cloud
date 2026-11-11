// ==============================================================================
// ExamSphere – Client Socket.IO Service
// Authenticated WebSocket connection for real-time exam telemetry & notifications
// ==============================================================================

import { io } from 'socket.io-client';

let socket = null;

// Resolve the Socket.IO server URL:
// 1. Explicit VITE_SOCKET_URL
// 2. Or derived from VITE_API_BASE_URL / VITE_API_URL (by stripping /api/v1 or /api)
// 3. Or localhost in development mode
export const getSocketServerUrl = () => {
  const envSocketUrl = import.meta.env.VITE_SOCKET_URL;
  if (envSocketUrl) {
    return envSocketUrl.endsWith('/') ? envSocketUrl.slice(0, -1) : envSocketUrl;
  }
  const envApiUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (envApiUrl) {
    return envApiUrl.replace(/\/api(\/v\d+)?\/?$/, '');
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:5000';
  }
  return window.location.origin;
};

export const getSocket = () => {
  if (!socket) {
    const serverUrl = getSocketServerUrl();
    const token = localStorage.getItem('examsphere_token');

    socket = io(serverUrl, {
      auth: { token },
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      console.log('⚡ [Socket.IO Client] Connected to ExamSphere gateway:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ [Socket.IO Client] Connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 [Socket.IO Client] Disconnected:', reason);
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
