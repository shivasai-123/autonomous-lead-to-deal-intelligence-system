export const VALID_DEAL_STATUSES = ['OPEN', 'WON', 'LOST'];

export function validateCreateDealInput(data) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: { body: 'Request body must be a valid JSON object' } };
  }

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (!title) {
    errors.title = 'Deal title is required';
  } else if (title.length < 2 || title.length > 200) {
    errors.title = 'Deal title must be between 2 and 200 characters';
  }

  if (data.value === undefined || data.value === null || data.value === '') {
    errors.value = 'Deal value is required';
  } else {
    const numValue = Number(data.value);
    if (isNaN(numValue) || numValue < 0) {
      errors.value = 'Deal value must be a non-negative number';
    }
  }

  if (data.currency && typeof data.currency !== 'string') {
    errors.currency = 'Currency must be a string (e.g. USD)';
  }

  if (!data.pipelineStageId || typeof data.pipelineStageId !== 'string') {
    errors.pipelineStageId = 'Valid pipelineStageId is required';
  }

  if (data.expectedCloseDate) {
    const parsedDate = new Date(data.expectedCloseDate);
    if (isNaN(parsedDate.getTime())) {
      errors.expectedCloseDate = 'expectedCloseDate must be a valid date';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateUpdateDealInput(data) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: { body: 'Request body must be a valid JSON object' } };
  }

  const allowedFields = [
    'title',
    'value',
    'currency',
    'expectedCloseDate',
    'description',
    'companyId',
    'assignedToId'
  ];

  const hasAllowedField = allowedFields.some((f) => data[f] !== undefined);
  if (!hasAllowedField) {
    errors.body = 'At least one field to update must be provided';
  }

  if (data.title !== undefined) {
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    if (!title) {
      errors.title = 'Deal title cannot be empty';
    } else if (title.length < 2 || title.length > 200) {
      errors.title = 'Deal title must be between 2 and 200 characters';
    }
  }

  if (data.value !== undefined) {
    const numValue = Number(data.value);
    if (isNaN(numValue) || numValue < 0) {
      errors.value = 'Deal value must be a non-negative number';
    }
  }

  if (data.expectedCloseDate !== undefined && data.expectedCloseDate !== null) {
    const parsedDate = new Date(data.expectedCloseDate);
    if (isNaN(parsedDate.getTime())) {
      errors.expectedCloseDate = 'expectedCloseDate must be a valid date';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateDealStageTransitionInput(data) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: { body: 'Request body must be a valid JSON object' } };
  }

  if (!data.stageId || typeof data.stageId !== 'string') {
    errors.stageId = 'Destination stageId is required';
  }

  if (data.transitionNote && typeof data.transitionNote !== 'string') {
    errors.transitionNote = 'transitionNote must be a string';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateConvertLeadInput(data) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: { body: 'Request body must be a valid JSON object' } };
  }

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (!title) {
    errors.title = 'Deal title is required for lead conversion';
  } else if (title.length < 2 || title.length > 200) {
    errors.title = 'Deal title must be between 2 and 200 characters';
  }

  if (data.value === undefined || data.value === null || data.value === '') {
    errors.value = 'Deal value is required';
  } else {
    const numValue = Number(data.value);
    if (isNaN(numValue) || numValue < 0) {
      errors.value = 'Deal value must be a non-negative number';
    }
  }

  if (data.expectedCloseDate) {
    const parsedDate = new Date(data.expectedCloseDate);
    if (isNaN(parsedDate.getTime())) {
      errors.expectedCloseDate = 'expectedCloseDate must be a valid date';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateDealQueryParams(query) {
  const errors = {};
  const params = {
    search: query.search ? String(query.search).trim() : '',
    status: query.status ? String(query.status).trim() : null,
    pipelineStageId: query.pipelineStageId ? String(query.pipelineStageId).trim() : null,
    companyId: query.companyId ? String(query.companyId).trim() : null,
    assignedToId: query.assignedToId ? String(query.assignedToId).trim() : null,
    page: parseInt(query.page, 10) || 1,
    limit: parseInt(query.limit, 10) || 10,
    sortBy: query.sortBy ? String(query.sortBy).trim() : 'createdAt',
    sortOrder: query.sortOrder && query.sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc'
  };

  if (params.page < 1) params.page = 1;
  if (params.limit < 1) params.limit = 10;
  if (params.limit > 100) params.limit = 100;

  if (params.status && !VALID_DEAL_STATUSES.includes(params.status)) {
    errors.status = `Invalid status filter. Allowed: ${VALID_DEAL_STATUSES.join(', ')}`;
  }

  const allowedSortFields = ['createdAt', 'updatedAt', 'title', 'value', 'expectedCloseDate', 'status'];
  if (!allowedSortFields.includes(params.sortBy)) {
    params.sortBy = 'createdAt';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    params
  };
}
