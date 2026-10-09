const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const VALID_LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'UNQUALIFIED',
  'CONVERTED',
  'LOST'
];

export const VALID_LEAD_PRIORITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
];

export function validateCreateLeadInput(data) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: { body: 'Request body must be a valid JSON object' } };
  }

  const firstName = typeof data.firstName === 'string' ? data.firstName.trim() : '';
  if (!firstName) {
    errors.firstName = 'First name is required';
  } else if (firstName.length > 100) {
    errors.firstName = 'First name cannot exceed 100 characters';
  }

  const lastName = typeof data.lastName === 'string' ? data.lastName.trim() : '';
  if (!lastName) {
    errors.lastName = 'Last name is required';
  } else if (lastName.length > 100) {
    errors.lastName = 'Last name cannot exceed 100 characters';
  }

  const email = typeof data.email === 'string' ? data.email.trim() : '';
  if (!email) {
    errors.email = 'Email address is required';
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = 'Please provide a valid email address';
  }

  if (data.status && !VALID_LEAD_STATUSES.includes(data.status)) {
    errors.status = `Status must be one of: ${VALID_LEAD_STATUSES.join(', ')}`;
  }

  if (data.priority && !VALID_LEAD_PRIORITIES.includes(data.priority)) {
    errors.priority = `Priority must be one of: ${VALID_LEAD_PRIORITIES.join(', ')}`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateUpdateLeadInput(data) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: { body: 'Request body must be a valid JSON object' } };
  }

  const allowedFields = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'jobTitle',
    'source',
    'status',
    'priority',
    'companyId',
    'assignedToId'
  ];

  const hasAllowedField = allowedFields.some((field) => data[field] !== undefined);
  if (!hasAllowedField) {
    errors.body = 'At least one field to update must be provided';
  }

  if (data.firstName !== undefined) {
    const fn = typeof data.firstName === 'string' ? data.firstName.trim() : '';
    if (!fn) errors.firstName = 'First name cannot be empty';
  }

  if (data.lastName !== undefined) {
    const ln = typeof data.lastName === 'string' ? data.lastName.trim() : '';
    if (!ln) errors.lastName = 'Last name cannot be empty';
  }

  if (data.email !== undefined) {
    const em = typeof data.email === 'string' ? data.email.trim() : '';
    if (!em || !EMAIL_REGEX.test(em)) {
      errors.email = 'Please provide a valid email address';
    }
  }

  if (data.status !== undefined && !VALID_LEAD_STATUSES.includes(data.status)) {
    errors.status = `Status must be one of: ${VALID_LEAD_STATUSES.join(', ')}`;
  }

  if (data.priority !== undefined && !VALID_LEAD_PRIORITIES.includes(data.priority)) {
    errors.priority = `Priority must be one of: ${VALID_LEAD_PRIORITIES.join(', ')}`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateLeadQueryParams(query) {
  const errors = {};
  const params = {
    search: query.search ? String(query.search).trim() : '',
    status: query.status ? String(query.status).trim() : null,
    priority: query.priority ? String(query.priority).trim() : null,
    companyId: query.companyId ? String(query.companyId).trim() : null,
    assignedToId: query.assignedToId ? String(query.assignedToId).trim() : null,
    isArchived: query.isArchived === 'true',
    classification: query.classification ? String(query.classification).trim().toUpperCase() : null,
    isStalled: query.isStalled !== undefined && query.isStalled !== '' ? String(query.isStalled).toLowerCase() === 'true' : null,
    page: parseInt(query.page, 10) || 1,
    limit: parseInt(query.limit, 10) || 10,
    sortBy: query.sortBy ? String(query.sortBy).trim() : 'createdAt',
    sortOrder: query.sortOrder && query.sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc'
  };

  if (params.page < 1) params.page = 1;
  if (params.limit < 1) params.limit = 10;
  if (params.limit > 100) params.limit = 100;

  if (params.status && !VALID_LEAD_STATUSES.includes(params.status)) {
    errors.status = `Invalid status filter. Allowed: ${VALID_LEAD_STATUSES.join(', ')}`;
  }

  if (params.priority && !VALID_LEAD_PRIORITIES.includes(params.priority)) {
    errors.priority = `Invalid priority filter. Allowed: ${VALID_LEAD_PRIORITIES.join(', ')}`;
  }

  if (params.classification && !['HOT', 'WARM', 'COLD'].includes(params.classification)) {
    errors.classification = 'Invalid classification filter. Allowed: HOT, WARM, COLD';
  }

  const allowedSortFields = ['createdAt', 'updatedAt', 'score', 'lastName', 'priority', 'status'];
  if (!allowedSortFields.includes(params.sortBy)) {
    params.sortBy = 'createdAt';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    params
  };
}
