import {
  RECOMMENDATION_TYPES,
  RECOMMENDATION_STATUSES
} from '../config/recommendation.config.js';

export const VALID_RECOMMENDATION_TYPES = Object.values(RECOMMENDATION_TYPES);
export const VALID_RECOMMENDATION_STATUSES = Object.values(RECOMMENDATION_STATUSES);

/**
 * Validate status update payload for recommendations.
 *
 * @param {Object} data - Request body
 * @returns {Object} { isValid, errors }
 */
export function validateUpdateStatusInput(data) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: { body: 'Request body must be a valid JSON object' }
    };
  }

  if (!data.status) {
    errors.status = 'Status field is required';
  } else if (!VALID_RECOMMENDATION_STATUSES.includes(data.status)) {
    errors.status = `Status must be one of: ${VALID_RECOMMENDATION_STATUSES.join(', ')}`;
  }

  if (data.reason !== undefined && data.reason !== null) {
    if (typeof data.reason !== 'string') {
      errors.reason = 'Reason must be a text string';
    } else if (data.reason.length > 500) {
      errors.reason = 'Reason cannot exceed 500 characters';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validate query parameters for listing recommendations.
 *
 * @param {Object} query - Request query
 * @returns {Object} { isValid, errors }
 */
export function validateListRecommendationsQuery(query) {
  const errors = {};

  if (query.status && !VALID_RECOMMENDATION_STATUSES.includes(query.status)) {
    errors.status = `Status filter must be one of: ${VALID_RECOMMENDATION_STATUSES.join(', ')}`;
  }

  if (query.type && !VALID_RECOMMENDATION_TYPES.includes(query.type)) {
    errors.type = `Type filter must be one of: ${VALID_RECOMMENDATION_TYPES.join(', ')}`;
  }

  if (query.page !== undefined) {
    const pageNum = parseInt(query.page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.page = 'Page must be a positive integer';
    }
  }

  if (query.limit !== undefined) {
    const limitNum = parseInt(query.limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.limit = 'Limit must be an integer between 1 and 100';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
