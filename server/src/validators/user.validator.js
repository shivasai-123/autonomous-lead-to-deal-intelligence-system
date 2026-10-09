const VALID_ROLES = ['ADMIN', 'SALES_MANAGER', 'SALES_REPRESENTATIVE'];

export function validateUpdateStatusInput(data) {
  const errors = {};

  if (typeof data.isActive !== 'boolean') {
    errors.isActive = 'isActive must be a boolean value (true or false)';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateUpdateRoleInput(data) {
  const errors = {};

  if (!data.roleName || !VALID_ROLES.includes(data.roleName)) {
    errors.roleName = `roleName must be one of: ${VALID_ROLES.join(', ')}`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
