import {
  SUPPORTED_TONES,
  SUPPORTED_OBJECTIVES,
  SUPPORTED_MEETING_TYPES,
  AI_CONFIG
} from '../config/ai.config.js';

/**
 * Validate input for follow-up draft generation.
 * @param {Object} data - Request body
 * @returns {Object} { isValid, errors }
 */
export function validateFollowUpDraftInput(data) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: { body: 'Request body must be a valid JSON object' }
    };
  }

  const validTones = Object.keys(SUPPORTED_TONES);
  if (!data.tone) {
    errors.tone = `Tone is required. Supported values: [${validTones.join(', ')}]`;
  } else if (!validTones.includes(data.tone)) {
    errors.tone = `Invalid tone "${data.tone}". Supported values: [${validTones.join(', ')}]`;
  }

  const validObjectives = Object.keys(SUPPORTED_OBJECTIVES);
  if (!data.objective) {
    errors.objective = `Objective is required. Supported values: [${validObjectives.join(', ')}]`;
  } else if (!validObjectives.includes(data.objective)) {
    errors.objective = `Invalid objective "${data.objective}". Supported values: [${validObjectives.join(', ')}]`;
  }

  if (data.additionalContext !== undefined && data.additionalContext !== null) {
    if (typeof data.additionalContext !== 'string') {
      errors.additionalContext = 'Additional context must be a text string';
    } else if (data.additionalContext.length > AI_CONFIG.LIMITS.MAX_ADDITIONAL_CONTEXT_LENGTH) {
      errors.additionalContext = `Additional context cannot exceed ${AI_CONFIG.LIMITS.MAX_ADDITIONAL_CONTEXT_LENGTH} characters`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validate input for meeting preparation generation.
 * @param {Object} data - Request body
 * @returns {Object} { isValid, errors }
 */
export function validateMeetingPrepInput(data) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: { body: 'Request body must be a valid JSON object' }
    };
  }

  const validMeetingTypes = Object.keys(SUPPORTED_MEETING_TYPES);
  if (data.meetingType && !validMeetingTypes.includes(data.meetingType)) {
    errors.meetingType = `Invalid meetingType "${data.meetingType}". Supported values: [${validMeetingTypes.join(', ')}]`;
  }

  if (data.notes !== undefined && data.notes !== null) {
    if (typeof data.notes !== 'string') {
      errors.notes = 'Notes must be a text string';
    } else if (data.notes.length > AI_CONFIG.LIMITS.MAX_NOTES_LENGTH) {
      errors.notes = `Notes cannot exceed ${AI_CONFIG.LIMITS.MAX_NOTES_LENGTH} characters`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
