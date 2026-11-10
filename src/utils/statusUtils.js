/**
 * Conclave Lifecycle Display Statuses:
 * - Registration Open
 * - Registration Close
 * - Running
 * - Completed
 * - Cancelled
 */

export function getConclaveDisplayStatus(conclaveOrStatus) {
  if (!conclaveOrStatus) return 'Registration Close';

  // If passed a full conclave object
  if (typeof conclaveOrStatus === 'object') {
    const c = conclaveOrStatus;
    const raw = String(c.status || '').toLowerCase().replace(/[\s_-]/g, '');

    if (raw === 'cancelled' || raw === 'canceled') return 'Cancelled';
    if (raw === 'completed' || raw === 'done' || raw === 'concluded' || raw === 'ended' || raw === 'finished') return 'Completed';
    if (raw === 'running' || raw === 'active' || raw === 'livenow') return 'Running';

    // If schedule is locked or registration is explicitly closed
    if (
      c.isScheduleLocked ||
      raw === 'locked' ||
      raw === 'registrationclosed' ||
      raw === 'registrationclose' ||
      c.registrationOverride === 'closed'
    ) {
      return 'Registration Close';
    }

    // If registration is explicitly open
    if (
      c.registrationOverride === 'open' ||
      c.isRegistrationOpen === true ||
      raw === 'registrationopen'
    ) {
      return 'Registration Open';
    }

    if (c.isRegistrationOpen === false) {
      return 'Registration Close';
    }

    // Auto registration end date check
    if (c.regEndDate) {
      const now = new Date();
      const endD = new Date(c.regEndDate);
      if (!isNaN(endD.getTime()) && now > endD) {
        return 'Registration Close';
      }
    }

    // Default fallbacks based on raw status
    if (raw === 'registrationnotopen' || raw === 'draft') return 'Registration Close';
    return 'Registration Open';
  }

  // If passed a string status
  const s = String(conclaveOrStatus).trim();
  const lower = s.toLowerCase().replace(/[\s_-]/g, '');
  if (lower === 'registrationopen') return 'Registration Open';
  if (
    lower === 'registrationclosed' ||
    lower === 'registrationclose' ||
    lower === 'registrationnotopen' ||
    lower === 'locked' ||
    lower === 'draft'
  ) {
    return 'Registration Close';
  }
  if (lower === 'running' || lower === 'active' || lower === 'live' || lower === 'livenow') return 'Running';
  if (lower === 'completed' || lower === 'concluded' || lower === 'done' || lower === 'ended') return 'Completed';
  if (lower === 'cancelled' || lower === 'canceled') return 'Cancelled';
  if (lower === 'upcoming') return 'Registration Open';
  return 'Registration Close';
}

/**
 * Formats conclave or status into one of the 5 canonical display names:
 * 'Registration Open' | 'Registration Close' | 'Running' | 'Completed' | 'Cancelled'
 */
export function formatStatus(val) {
  return getConclaveDisplayStatus(val);
}

export function getStatusBadgeClasses(val) {
  const status = getConclaveDisplayStatus(val);
  switch (status) {
    case 'Running':
      return 'bg-red-50 text-brand-red border border-red-200';
    case 'Registration Open':
      return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    case 'Registration Close':
      return 'bg-amber-50 text-amber-900 border border-amber-200';
    case 'Completed':
      return 'bg-zinc-100 text-zinc-700 border border-zinc-200';
    case 'Cancelled':
      return 'bg-rose-50 text-rose-700 border border-rose-200';
    default:
      return 'bg-zinc-50 text-zinc-600 border border-zinc-200';
  }
}

export function getStatusDotClasses(val) {
  const status = getConclaveDisplayStatus(val);
  switch (status) {
    case 'Running':
      return 'bg-brand-red animate-pulse';
    case 'Registration Open':
      return 'bg-emerald-500';
    case 'Registration Close':
      return 'bg-amber-500';
    case 'Completed':
      return 'bg-zinc-500';
    case 'Cancelled':
      return 'bg-rose-500';
    default:
      return 'bg-zinc-400';
  }
}

