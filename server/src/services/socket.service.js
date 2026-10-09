import { Server } from 'socket.io';
import { verifyToken } from '../utils/token.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/environment.js';

let ioInstance = null;

export class SocketService {
  /**
   * Initialize Socket.IO server on an existing HTTP server instance.
   * @param {import('http').Server} httpServer
   * @returns {Server}
   */
  static init(httpServer) {
    if (ioInstance) {
      return ioInstance;
    }

    ioInstance = new Server(httpServer, {
      cors: {
        origin: env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 20000,
      pingInterval: 25000
    });

    // JWT Authentication Middleware for Socket connections
    ioInstance.use((socket, next) => {
      try {
        const rawToken =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

        if (!rawToken) {
          return next(new Error('Authentication error: Missing token'));
        }

        const decoded = verifyToken(rawToken);
        if (!decoded || !decoded.id) {
          return next(new Error('Authentication error: Invalid or expired token'));
        }

        // Attach verified user claims to socket
        socket.user = decoded;
        next();
      } catch (err) {
        logger.warn(`Socket authentication failed: ${err.message}`);
        next(new Error(`Authentication error: ${err.message}`));
      }
    });

    ioInstance.on('connection', (socket) => {
      const userId = socket.user?.id;
      logger.info(`[Socket] User ${socket.user?.email} (${userId}) connected (Socket ID: ${socket.id})`);

      // Server-controlled private user room
      socket.join(`user:${userId}`);

      socket.on('disconnect', (reason) => {
        logger.info(`[Socket] User ${userId} disconnected: ${reason}`);
      });
    });

    logger.info('Real-time Socket.IO service initialized successfully');
    return ioInstance;
  }

  /**
   * Get the active Socket.IO server instance.
   * @returns {Server|null}
   */
  static getIO() {
    return ioInstance;
  }

  /**
   * Emit a real-time event strictly to an authenticated user's private room.
   * Never broadcasts private alerts to other connected users.
   *
   * @param {string} userId - Recipient user UUID
   * @param {string} event - Event name (e.g. 'notification:new')
   * @param {Object} data - Payload
   * @returns {boolean} Whether event was dispatched
   */
  static emitToUser(userId, event, data) {
    if (!ioInstance) {
      return false;
    }
    ioInstance.to(`user:${userId}`).emit(event, data);
    return true;
  }

  /**
   * Close and clean up Socket.IO instance (useful for test suites and shutdown).
   */
  static close() {
    if (ioInstance) {
      ioInstance.close();
      ioInstance = null;
    }
  }
}

export default SocketService;
