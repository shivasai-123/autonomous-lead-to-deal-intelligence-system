/**
 * Standardized API response format helpers
 */

export function sendSuccess(res, message, data = null, statusCode = 200) {
  const response = {
    success: true,
    message
  };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
}

export function sendError(res, message = 'Internal Server Error', errors = null, statusCode = 500) {
  const response = {
    success: false,
    message
  };

  if (errors !== null && errors !== undefined) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
}
