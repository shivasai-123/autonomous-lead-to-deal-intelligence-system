const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegisterInput(data) {
  const errors = {};

  if (!data.firstName || typeof data.firstName !== 'string' || data.firstName.trim().length === 0) {
    errors.firstName = 'First name is required';
  } else if (data.firstName.trim().length > 50) {
    errors.firstName = 'First name must not exceed 50 characters';
  }

  if (!data.lastName || typeof data.lastName !== 'string' || data.lastName.trim().length === 0) {
    errors.lastName = 'Last name is required';
  } else if (data.lastName.trim().length > 50) {
    errors.lastName = 'Last name must not exceed 50 characters';
  }

  if (!data.email || typeof data.email !== 'string' || !EMAIL_REGEX.test(data.email.trim())) {
    errors.email = 'A valid email address is required';
  }

  if (!data.password || typeof data.password !== 'string') {
    errors.password = 'Password is required';
  } else if (data.password.length < 8) {
    errors.password = 'Password must be at least 8 characters long';
  } else if (data.password.length > 128) {
    errors.password = 'Password must not exceed 128 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateLoginInput(data) {
  const errors = {};

  if (!data.email || typeof data.email !== 'string' || !EMAIL_REGEX.test(data.email.trim())) {
    errors.email = 'A valid email address is required';
  }

  if (!data.password || typeof data.password !== 'string' || data.password.length === 0) {
    errors.password = 'Password is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
