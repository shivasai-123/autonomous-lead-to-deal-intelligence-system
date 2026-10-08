import app from './app.js';
import { env } from './config/environment.js';
import { logger } from './utils/logger.js';
import { disconnectPrisma } from './config/prisma.js';

const server = app.listen(env.PORT, () => {
  logger.info(`CRM Backend server running on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info(`Health check available at http://localhost:${env.PORT}/api/health`);
});

// Handle graceful shutdown
const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    logger.info('HTTP server closed');
    await disconnectPrisma();
    process.exit(0);
  });

  // Force shutdown if taking longer than 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', { reason: reason?.message || reason });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', { error: err.message, stack: err.stack });
  process.exit(1);
});
