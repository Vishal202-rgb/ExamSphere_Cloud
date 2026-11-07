// ==============================================================================
// ExamSphere – Client Socket.IO Service
// Authenticated WebSocket connection for real-time exam telemetry & notifications
// ==============================================================================

import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    const serverUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
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
