/**
 * ========================================================
 * Lead Scoring & Intelligence Configuration
 * ========================================================
 * Centralized, deterministic scoring weights, contribution caps,
 * classification thresholds, and stalled inactivity limits.
 */

export const ACTIVITY_WEIGHTS = {
  DEMO_REQUEST: 25,
  PRICING_PAGE_VIEW: 10,
  EMAIL_REPLY: 10,
  MEETING: 10,
  BROCHURE_DOWNLOAD: 8,
  FORM_SUBMISSION: 8,
  CALL: 5,
  WEBSITE_VISIT: 2,
  EMAIL_OPEN: 1,
  OTHER: 0
};

export const ACTIVITY_CAPS = {
  DEMO_REQUEST: { maxPoints: 50, maxEvents: 2, label: 'Demo Request' },
  PRICING_PAGE_VIEW: { maxPoints: 30, maxEvents: 3, label: 'Pricing Page View' },
  EMAIL_REPLY: { maxPoints: 30, maxEvents: 3, label: 'Email Reply' },
  MEETING: { maxPoints: 20, maxEvents: 2, label: 'Meeting' },
  BROCHURE_DOWNLOAD: { maxPoints: 16, maxEvents: 2, label: 'Brochure Download' },
  FORM_SUBMISSION: { maxPoints: 16, maxEvents: 2, label: 'Form Submission' },
  CALL: { maxPoints: 15, maxEvents: 3, label: 'Phone Call' },
  WEBSITE_VISIT: { maxPoints: 10, maxEvents: 5, label: 'Website Visit' },
  EMAIL_OPEN: { maxPoints: 5, maxEvents: 5, label: 'Email Open' },
  OTHER: { maxPoints: 0, maxEvents: 0, label: 'Other Activity' }
};

export const CLASSIFICATION_THRESHOLDS = {
  HOT: { min: 70, max: 100, label: 'HOT' },
  WARM: { min: 40, max: 69, label: 'WARM' },
  COLD: { min: 0, max: 39, label: 'COLD' }
};

export const PRIORITY_THRESHOLDS = {
  URGENT: { min: 85, max: 100 },
  HIGH: { min: 70, max: 84 },
  MEDIUM: { min: 40, max: 69 },
  LOW: { min: 0, max: 39 }
};

export const STALLED_THRESHOLD_DAYS = 14;

export const SCORE_BOUNDS = {
  MIN: 0,
  MAX: 100
};

/**
 * Classify a score into HOT, WARM, or COLD.
 * @param {number} score
 * @returns {'HOT' | 'WARM' | 'COLD'}
 */
export function classifyScore(score) {
  const bounded = Math.min(SCORE_BOUNDS.MAX, Math.max(SCORE_BOUNDS.MIN, Number(score) || 0));
  if (bounded >= CLASSIFICATION_THRESHOLDS.HOT.min) return 'HOT';
  if (bounded >= CLASSIFICATION_THRESHOLDS.WARM.min) return 'WARM';
  return 'COLD';
}

/**
 * Map a numeric score to the LeadPriority enum (URGENT, HIGH, MEDIUM, LOW).
 * @param {number} score
 * @returns {'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'}
 */
export function scoreToPriority(score) {
  const bounded = Math.min(SCORE_BOUNDS.MAX, Math.max(SCORE_BOUNDS.MIN, Number(score) || 0));
  if (bounded >= PRIORITY_THRESHOLDS.URGENT.min) return 'URGENT';
  if (bounded >= PRIORITY_THRESHOLDS.HIGH.min) return 'HIGH';
  if (bounded >= PRIORITY_THRESHOLDS.MEDIUM.min) return 'MEDIUM';
  return 'LOW';
}
