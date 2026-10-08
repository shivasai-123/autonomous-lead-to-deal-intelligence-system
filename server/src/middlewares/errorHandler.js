import { logger } from '../utils/logger.js';
import { sendError } from '../utils/apiResponse.js';
import { env } from '../config/environment.js';

export function errorHandler(err, req, res, _next) {
  logger.error(`Unhandled error during ${req.method} ${req.originalUrl}:`, {
    message: err.message,
    stack: env.isDevelopment ? err.stack : undefined
  });

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  const errors = env.isDevelopment
    ? { stack: err.stack, details: err.details || null }
    : undefined;

  return sendError(res, message, errors, statusCode);
}
