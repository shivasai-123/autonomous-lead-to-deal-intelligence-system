export const VALID_ACTIVITY_TYPES = [
  'WEBSITE_VISIT',
  'PRICING_PAGE_VIEW',
  'BROCHURE_DOWNLOAD',
  'EMAIL_OPEN',
  'EMAIL_REPLY',
  'DEMO_REQUEST',
  'CALL',
  'MEETING',
  'FORM_SUBMISSION',
  'OTHER'
];

export function validateCreateActivityInput(data) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: { body: 'Request body must be a valid JSON object' } };
  }

  if (!data.type || !VALID_ACTIVITY_TYPES.includes(data.type)) {
    errors.type = `Activity type must be one of: ${VALID_ACTIVITY_TYPES.join(', ')}`;
  }

  if (data.description !== undefined && data.description !== null) {
    if (typeof data.description !== 'string') {
      errors.description = 'Description must be a text string';
    } else if (data.description.length > 2000) {
      errors.description = 'Description cannot exceed 2000 characters';
    }
  }

  if (data.occurredAt) {
    const parsedDate = new Date(data.occurredAt);
    if (isNaN(parsedDate.getTime())) {
      errors.occurredAt = 'occurredAt must be a valid ISO date timestamp';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
