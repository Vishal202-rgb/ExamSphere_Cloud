// ==============================================================================
// ExamSphere – HTTP Server & Socket.IO Bootstrap
// ==============================================================================

import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/db.js';
import { redis } from './config/redis.js';

const server = http.createServer(app);

// Initialize Socket.IO with CORS settings
export const io = new SocketIOServer(server, {
  cors: {
    origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log(`🔌 [Socket.IO] Client connected: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    console.log(`🔌 [Socket.IO] Client disconnected: ${socket.id} (${reason})`);
  });
});

// Start HTTP Server
const PORT = env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`
  ==============================================================
  🚀 ExamSphere API Server Started Successfully!
  --------------------------------------------------------------
  🌐 Environment: ${env.NODE_ENV}
  📡 Listening on: http://localhost:${PORT}
  🩺 Health Check: http://localhost:${PORT}/api/v1/health
  ==============================================================
  `);
});

// Graceful Shutdown Handler
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('🔒 HTTP server closed');

    try {
      await prisma.$disconnect();
      console.log('🔒 Prisma disconnected from PostgreSQL');

      if (redis.status === 'ready' || redis.status === 'connect') {
        await redis.quit();
        console.log('🔒 Redis client closed');
      }

      console.log('👋 ExamSphere shutdown complete. Goodbye!');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during graceful shutdown:', err);
      process.exit(1);
    }
  });

  // Force close after 10s if hanging
  setTimeout(() => {
    console.error('⚠️ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception thrown:', err);
  process.exit(1);
});

export default server;
