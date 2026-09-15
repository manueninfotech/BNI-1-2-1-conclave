/**
 * Round timing logic mirroring the Flutter domain model (RoundTiming).
 *
 * Spec:
 * - A round occupies a fixed 15-minute block (900 seconds).
 * - The active (talking) portion is 1.5 minutes (90 seconds) per person at the table.
 * - Whatever is left of the block is the transition window for members to walk to their next table.
 *   Examples:
 *     P = 8 -> 12 min active (720s) + 3 min transition (180s)
 *     P = 6 ->  9 min active (540s) + 6 min transition (360s)
 *     P = 5 ->  7.5 min active (450s) + 7.5 min transition (450s)
 */

export const ROUND_BLOCK_DURATION_SECS = 15 * 60; // 900 seconds (15 minutes)
export const TOTAL_BLOCK_SECS = ROUND_BLOCK_DURATION_SECS;
export const TALKING_SECS_PER_PERSON = 90;         // 1.5 minutes (90 seconds)
export const SECS_PER_PERSON = TALKING_SECS_PER_PERSON;

/**
 * Parses various timestamp formats (Firestore _seconds / seconds, toDate, Date object, ISO string).
 */
export function parseStartTime(rawStart) {
  if (!rawStart) return NaN;
  if (typeof rawStart === 'object') {
    if (typeof rawStart._seconds === 'number') return rawStart._seconds * 1000;
    if (typeof rawStart.seconds === 'number') return rawStart.seconds * 1000;
    if (typeof rawStart.toDate === 'function') return rawStart.toDate().getTime();
  }
  const parsed = new Date(rawStart).getTime();
  return isNaN(parsed) ? NaN : parsed;
}

/**
 * Formats seconds into MM:SS string with tabular layout.
 */
export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Calculates complete round timing, phase, speaker progression, and remaining intervals.
 *
 * @param {Object} options
 * @param {any} options.startedAt - Start timestamp of current round
 * @param {number} [options.personsPerTable=6] - Seats per table (default 6)
 * @param {boolean} [options.isRunning=true] - Whether round is currently active/running
 * @param {number} [options.now=Date.now()] - Current epoch timestamp
 */
export function calculateRoundTiming({
  startedAt,
  personsPerTable = 6,
  isRunning = true,
  now = Date.now(),
} = {}) {
  const p = Math.max(1, Number(personsPerTable) || 6);
  const activeSecs = Math.min(ROUND_BLOCK_DURATION_SECS, p * TALKING_SECS_PER_PERSON);
  const transitionSecs = Math.max(0, ROUND_BLOCK_DURATION_SECS - activeSecs);

  const startMs = parseStartTime(startedAt);

  // If not started, paused, or invalid start time
  if (isNaN(startMs) || !isRunning) {
    return {
      phase: 'not_started',
      phaseLabel: 'Ready to Start',
      isTalking: false,
      isTransition: false,
      isEnded: false,
      elapsedSecs: 0,
      totalRemaining: ROUND_BLOCK_DURATION_SECS,
      totalTimeLeft: ROUND_BLOCK_DURATION_SECS,
      phaseRemaining: activeSecs,
      phaseTimeLeft: activeSecs,
      totalBlockSecs: ROUND_BLOCK_DURATION_SECS,
      activeSecs,
      transitionSecs,
      personsPerTable: p,
      speakerIndex: 0,
      speakerTimeLeft: TALKING_SECS_PER_PERSON,
      speakerTotalSecs: TALKING_SECS_PER_PERSON,
      progressPercent: 0,
      phaseProgressPercent: 0,
    };
  }

  const elapsedSecs = Math.max(0, Math.floor((now - startMs) / 1000));
  const totalRemaining = Math.max(0, ROUND_BLOCK_DURATION_SECS - elapsedSecs);
  const progressPercent = Math.min(100, Math.round((elapsedSecs / ROUND_BLOCK_DURATION_SECS) * 100));

  if (elapsedSecs < activeSecs) {
    // Phase 1: Talking Time
    const phaseRemaining = activeSecs - elapsedSecs;
    const phaseProgressPercent = Math.min(100, Math.round((elapsedSecs / activeSecs) * 100));

    // Calculate which speaker is up
    const speakerIndex = Math.min(p - 1, Math.floor(elapsedSecs / TALKING_SECS_PER_PERSON));
    const speakerElapsed = elapsedSecs % TALKING_SECS_PER_PERSON;
    const speakerTimeLeft = TALKING_SECS_PER_PERSON - speakerElapsed;

    return {
      phase: 'active',
      phaseLabel: 'Talking Time',
      isTalking: true,
      isTransition: false,
      isEnded: false,
      elapsedSecs,
      totalRemaining,
      totalTimeLeft: totalRemaining,
      phaseRemaining,
      phaseTimeLeft: phaseRemaining,
      totalBlockSecs: ROUND_BLOCK_DURATION_SECS,
      activeSecs,
      transitionSecs,
      personsPerTable: p,
      speakerIndex,
      speakerNumber: speakerIndex + 1,
      speakerTimeLeft,
      speakerTotalSecs: TALKING_SECS_PER_PERSON,
      progressPercent,
      phaseProgressPercent,
    };
  } else if (elapsedSecs < ROUND_BLOCK_DURATION_SECS) {
    // Phase 2: Transition Time (Move to next table)
    const transitionElapsed = elapsedSecs - activeSecs;
    const phaseRemaining = ROUND_BLOCK_DURATION_SECS - elapsedSecs;
    const phaseProgressPercent = transitionSecs > 0
      ? Math.min(100, Math.round((transitionElapsed / transitionSecs) * 100))
      : 100;

    return {
      phase: 'transition',
      phaseLabel: 'Move to Next Table',
      isTalking: false,
      isTransition: true,
      isEnded: false,
      elapsedSecs,
      totalRemaining,
      totalTimeLeft: totalRemaining,
      phaseRemaining,
      phaseTimeLeft: phaseRemaining,
      totalBlockSecs: ROUND_BLOCK_DURATION_SECS,
      activeSecs,
      transitionSecs,
      personsPerTable: p,
      speakerIndex: p,
      speakerNumber: p,
      speakerTimeLeft: 0,
      speakerTotalSecs: TALKING_SECS_PER_PERSON,
      progressPercent,
      phaseProgressPercent,
    };
  } else {
    // Phase 3: Ended
    return {
      phase: 'ended',
      phaseLabel: 'Round Ended',
      isTalking: false,
      isTransition: false,
      isEnded: true,
      elapsedSecs,
      totalRemaining: 0,
      totalTimeLeft: 0,
      phaseRemaining: 0,
      phaseTimeLeft: 0,
      totalBlockSecs: ROUND_BLOCK_DURATION_SECS,
      activeSecs,
      transitionSecs,
      personsPerTable: p,
      speakerIndex: p,
      speakerNumber: p,
      speakerTimeLeft: 0,
      speakerTotalSecs: TALKING_SECS_PER_PERSON,
      progressPercent: 100,
      phaseProgressPercent: 100,
    };
  }
}
