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

export function getStatusBadgeClasses(val) {
  const lower = String(val || '').toLowerCase().replace(/[\s_-]/g, '');
  if (lower === 'running' || lower === 'active') {
    return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
  }
  if (lower === 'registrationopen') {
    return 'bg-amber-50 text-amber-800 border border-amber-200';
  }
  if (lower === 'upcoming') {
    return 'bg-red-50 text-brand-red border border-red-200';
  }
  if (lower === 'registrationclosed' || lower === 'registrationnotopen' || lower === 'locked') {
    return 'bg-amber-50/80 text-amber-900 border border-amber-200';
  }
  if (lower === 'completed') {
    return 'bg-zinc-100 text-zinc-650 border border-zinc-200';
  }
  if (lower === 'cancelled') {
    return 'bg-red-50 text-brand-red border border-red-200';
  }
  if (lower === 'draft') {
    return 'bg-zinc-50 text-zinc-500 border border-zinc-200';
  }
  return 'bg-zinc-50 text-zinc-600 border border-zinc-200';
}

