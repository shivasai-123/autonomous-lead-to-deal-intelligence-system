/**
 * ========================================================
 * Next-Best-Action (NBA) Recommendation Configuration
 * ========================================================
 * Deterministic rule parameters, confidence scores, action types,
 * precedence hierarchy, and lifecycle transition definitions.
 */

export const RECOMMENDATION_TYPES = {
  SCHEDULE_DEMO: 'SCHEDULE_DEMO',
  REVIEW_STALLED_LEAD: 'REVIEW_STALLED_LEAD',
  CONTACT_LEAD: 'CONTACT_LEAD',
  SEND_FOLLOW_UP: 'SEND_FOLLOW_UP',
  OTHER: 'OTHER'
};

export const RECOMMENDATION_STATUSES = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DISMISSED: 'DISMISSED',
  EXECUTED: 'EXECUTED'
};

export const RECOMMENDATION_RULES = {
  SCHEDULE_DEMO: {
    id: 'RULE_SCHEDULE_DEMO',
    type: 'SCHEDULE_DEMO',
    title: 'Schedule Product Demonstration',
    priority: 1,
    defaultConfidence: 0.95,
    description: 'Lead expressed high demonstration intent or reached hot engagement threshold.'
  },
  REVIEW_STALLED_LEAD: {
    id: 'RULE_REVIEW_STALLED',
    type: 'REVIEW_STALLED_LEAD',
    title: 'Review Inactive Stalled Lead',
    priority: 2,
    defaultConfidence: 0.90,
    description: 'Active lead exceeded inactivity threshold (14+ days) without recent engagement.'
  },
  CONTACT_NEW_LEAD: {
    id: 'RULE_CONTACT_NEW_LEAD',
    type: 'CONTACT_LEAD',
    title: 'Initiate Initial Lead Contact',
    priority: 3,
    defaultConfidence: 0.85,
    description: 'New inbound lead with no outbound call, meeting, or response recorded.'
  },
  SEND_FOLLOW_UP: {
    id: 'RULE_FOLLOW_UP',
    type: 'SEND_FOLLOW_UP',
    title: 'Send Timely Follow-Up',
    priority: 4,
    defaultConfidence: 0.80,
    description: 'Contacted or warm lead with recent digital activity awaiting proactive sales touchpoint.'
  },
  CONVERT_TO_DEAL: {
    id: 'RULE_CONVERT_TO_DEAL',
    type: 'OTHER',
    title: 'Convert Lead to Pipeline Deal',
    priority: 5,
    defaultConfidence: 0.82,
    description: 'Qualified lead with high score and completed engagement has no open deal.'
  }
};

export const RULE_PRECEDENCE = [
  'SCHEDULE_DEMO',
  'REVIEW_STALLED_LEAD',
  'CONTACT_NEW_LEAD',
  'SEND_FOLLOW_UP',
  'CONVERT_TO_DEAL'
];

export const FOLLOW_UP_THRESHOLD_DAYS = 3;
export const RECOMMENDATION_TTL_DAYS = 14;

export const ALLOWED_STATUS_TRANSITIONS = {
  PENDING: ['ACCEPTED', 'DISMISSED'],
  ACCEPTED: ['EXECUTED', 'DISMISSED'],
  DISMISSED: ['PENDING'], // Allow reactivating if dismissed by accident
  EXECUTED: []            // Terminal state
};
