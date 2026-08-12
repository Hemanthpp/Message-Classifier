// utils.js — Shared helpers
export const CATEGORY_LABELS = {
  action_required:       'Action Required',
  meeting_or_event:      'Meeting / Event',
  personal_information:  'Personal Info',
  general_information:   'General Info',
  promotional:           'Promotional',
  sensitive_information: 'Sensitive',
};

export const CATEGORY_BADGE = {
  action_required:       'badge-action',
  meeting_or_event:      'badge-meeting',
  personal_information:  'badge-personal',
  general_information:   'badge-general',
  promotional:           'badge-promo',
  sensitive_information: 'badge-sensitive',
};

export const RISK_BADGE = {
  critical: 'badge-critical',
  high:     'badge-high',
  medium:   'badge-medium',
  low:      'badge-low',
};

export function confidenceClass(conf) {
  if (conf >= 0.88) return 'conf-high';
  if (conf >= 0.75) return 'conf-medium';
  return 'conf-low';
}

export function formatPercent(val) {
  return `${(val * 100).toFixed(1)}%`;
}

export function formatDate(str) {
  if (!str) return '—';
  if (str === 'unresolved') return 'unresolved';
  return str;
}
