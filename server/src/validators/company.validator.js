const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;

export function validateCreateCompanyInput(data) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: { body: 'Request body must be a valid JSON object' } };
  }

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) {
    errors.name = 'Company name is required';
  } else if (name.length < 2 || name.length > 150) {
    errors.name = 'Company name must be between 2 and 150 characters';
  }

  if (data.email) {
    const email = String(data.email).trim();
    if (!EMAIL_REGEX.test(email)) {
      errors.email = 'Provided company email is invalid';
    }
  }

  if (data.website) {
    const website = String(data.website).trim();
    if (website && !URL_REGEX.test(website)) {
      errors.website = 'Provided website URL format is invalid';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateUpdateCompanyInput(data) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: { body: 'Request body must be a valid JSON object' } };
  }

  const allowedFields = ['name', 'industry', 'website', 'phone', 'email', 'address', 'city', 'country'];
  const hasAllowedField = allowedFields.some((field) => data[field] !== undefined);

  if (!hasAllowedField) {
    errors.body = 'At least one field to update must be provided';
  }

  if (data.name !== undefined) {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) {
      errors.name = 'Company name cannot be empty';
    } else if (name.length < 2 || name.length > 150) {
      errors.name = 'Company name must be between 2 and 150 characters';
    }
  }

  if (data.email !== undefined && data.email !== null && data.email !== '') {
    const email = String(data.email).trim();
    if (!EMAIL_REGEX.test(email)) {
      errors.email = 'Provided company email is invalid';
    }
  }

  if (data.website !== undefined && data.website !== null && data.website !== '') {
    const website = String(data.website).trim();
    if (!URL_REGEX.test(website)) {
      errors.website = 'Provided website URL format is invalid';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
