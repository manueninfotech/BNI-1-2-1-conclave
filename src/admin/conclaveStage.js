import { liveClock } from '../utils/roundClock';

/**
 * Where a conclave is in its life, and what the admin should do next.
 *
 * One conclave moves through four stages:
 *   Registration → Tables → Live → Done
 * The admin panel shows this on the Home page and at the top of every
 * conclave, so the next step is always one click away.
 */

export const STAGES = [
  { id: 'registration', label: 'Registration' },
  { id: 'tables', label: 'Tables' },
  { id: 'live', label: 'Live' },
  { id: 'done', label: 'Done' },
];

const norm = (s) => String(s || '').toLowerCase().replace(/[\s_-]/g, '');

export function stageOf(c) {
  const s = norm(c?.status);
  if (s === 'cancelled') return 'cancelled';
  if (s === 'completed' || s === 'ended' || s === 'finished') return 'done';
  if (s === 'running' || s === 'active') return 'live';
  if (c?.schedule || c?.isScheduleLocked || s === 'registrationclosed' || s === 'locked') return 'tables';
  return 'registration';
}

/**
 * The single most useful next action. `tab` is the conclave tab that holds it.
 */
export function nextStep(c) {
  const s = norm(c?.status);
  const stage = stageOf(c);
  const count = c?.registrationCount;
  switch (stage) {
    case 'cancelled':
      return { text: 'This conclave was cancelled.', tab: null };
    case 'done':
      return { text: 'Finished. See how it went: referrals and feedback.', action: 'View results', tab: 'overview' };
    case 'live': {
      // The round clock, not the stored number: automatic mode moves on by itself.
      const k = liveClock(c);
      const r = k.round || c?.currentRound || '';
      const text = c?.isRoundPaused
        ? `Round ${r} is paused.`
        : k.phase === 'bio' ? `Round ${r}: bios.`
        : k.phase === 'referral' ? `Round ${r}: referral slot open.`
        : k.phase === 'extension' ? `Round ${r}: extra time for one-to-ones.`
        : k.phase === 'move' ? `Moving to tables — round ${r + 1} starts by itself.`
        : k.phase === 'waiting' ? `Round ${r} is over. Start round ${r + 1} when ready.`
        : k.phase === 'done' ? 'All rounds are over. Mark the conclave completed (or it completes by itself).'
        : `Round ${r} is live now.`;
      return { text, action: 'Open round runner', tab: 'schedule' };
    }
    case 'tables':
      if (c?.isScheduleLocked) return { text: 'Tables are locked. Start round 1 on the day.', action: 'Go to rounds', tab: 'schedule' };
      if (c?.schedule) return { text: 'Tables are generated. Review them, then lock.', action: 'Review tables', tab: 'schedule' };
      return { text: 'Registration is closed. Generate the tables.', action: 'Generate tables', tab: 'schedule' };
    default:
      if (s === 'registrationopen' || c?.isRegistrationOpen) {
        return {
          text: count != null ? `Registration is open: ${count} registered so far.` : 'Registration is open.',
          action: 'See registrations',
          tab: 'members',
        };
      }
      return { text: 'Registration is not open yet. Open it from the Conclaves list when ready.', action: 'See members', tab: 'members' };
  }
}

export function stageLabel(c) {
  const st = stageOf(c);
  if (st === 'cancelled') return 'Cancelled';
  return STAGES.find((x) => x.id === st)?.label || '';
}

export function formatConclaveDate(c) {
  const raw = c?.startDate || c?.date;
  const d = raw ? new Date(raw) : null;
  if (!d || isNaN(d.getTime())) return c?.dateRange || 'Date not set';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** The conclave an admin most likely means: live → next upcoming → most recent. */
export function pickCurrentConclave(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const live = list.find((c) => stageOf(c) === 'live');
  if (live) return live;
  const t = (c) => new Date(c.startDate || c.date).getTime() || 0;
  const now = Date.now() - 12 * 3600 * 1000;
  const upcoming = list
    .filter((c) => !['done', 'cancelled'].includes(stageOf(c)) && (t(c) === 0 || t(c) >= now))
    .sort((a, b) => t(a) - t(b));
  if (upcoming.length) return upcoming[0];
  return [...list].sort((a, b) => t(b) - t(a))[0];
}
