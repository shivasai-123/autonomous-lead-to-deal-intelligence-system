export function validateReorderStagesInput(data) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: { body: 'Request body must be a valid JSON object' } };
  }

  const stageOrders = data.stageOrders;

  if (!Array.isArray(stageOrders) || stageOrders.length === 0) {
    errors.stageOrders = 'stageOrders must be a non-empty array of { id, order } objects';
    return { isValid: false, errors };
  }

  const seenOrders = new Set();
  const seenIds = new Set();

  for (let i = 0; i < stageOrders.length; i++) {
    const item = stageOrders[i];
    if (!item.id || typeof item.id !== 'string') {
      errors[`stageOrders[${i}].id`] = 'Valid stage id is required';
    } else if (seenIds.has(item.id)) {
      errors[`stageOrders[${i}].id`] = `Duplicate stage id: ${item.id}`;
    } else {
      seenIds.add(item.id);
    }

    const orderNum = parseInt(item.order, 10);
    if (isNaN(orderNum) || orderNum < 1) {
      errors[`stageOrders[${i}].order`] = 'Order must be a positive integer';
    } else if (seenOrders.has(orderNum)) {
      errors[`stageOrders[${i}].order`] = `Duplicate order value: ${orderNum}`;
    } else {
      seenOrders.add(orderNum);
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
