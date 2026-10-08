import { sendError } from '../utils/apiResponse.js';

export function notFoundHandler(req, res) {
  return sendError(res, `Resource not found: ${req.method} ${req.originalUrl}`, null, 404);
}
