// ==============================================================================
// ExamSphere – HTTP Server & Socket.IO Bootstrap
// ==============================================================================

import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/db.js';
import { redis } from './config/redis.js';
import { startExpiredAttemptsWorker, stopExpiredAttemptsWorker } from './workers/expiredAttemptsWorker.js';
import { closeEvaluationQueue } from './queues/evaluation.queue.js';

const server = http.createServer(app);

import { setupSocketIO } from './socket/index.js';

// Initialize Socket.IO with CORS settings
export const io = new SocketIOServer(server, {
  cors: {
    origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  },
});

// Setup modular Socket.IO authentication and event routing
setupSocketIO(io);

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

  // Start background monitoring worker for expiring in-progress attempts
  startExpiredAttemptsWorker(15000);
});

// Graceful Shutdown Handler
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  stopExpiredAttemptsWorker();
  await closeEvaluationQueue();

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
