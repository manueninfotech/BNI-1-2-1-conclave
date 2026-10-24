/**
 * Formats conclave and system statuses for human-readable display.
 * e.g., 'registrationOpen' -> 'Registration Open'
 *       'registrationClosed' -> 'Registration Closed'
 *       'registrationNotOpen' -> 'Registration Not Open'
 *       'running' -> 'Running'
 */
export function formatStatus(val) {
  if (!val) return '';
  const s = String(val).trim();
  const lower = s.toLowerCase().replace(/[\s_-]/g, '');
  if (lower === 'registrationopen') return 'Registration Open';
  if (lower === 'registrationclosed') return 'Registration Closed';
  if (lower === 'registrationnotopen') return 'Registration Not Open';
  if (lower === 'running' || lower === 'active') return 'Running';
  if (lower === 'completed') return 'Completed';
  if (lower === 'cancelled') return 'Cancelled';
  if (lower === 'draft') return 'Draft';
  if (lower === 'upcoming') return 'Upcoming';
  // Insert space before camelCase capitals if any unknown status is encountered
  return s.replace(/([a-z])([A-Z])/g, '$1 $2');
}
