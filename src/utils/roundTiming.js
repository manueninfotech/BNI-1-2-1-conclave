/**
 * Round timing logic with 3 explicit phases per 15-minute block (900 seconds):
 * 1. Talking Time: 1.0 minute (60 seconds) per person (e.g., 5 persons = 5 min / 300s).
 * 2. Referral Window: 0.5 minutes (30 seconds) per person (e.g., 5 persons = 2.5 min / 150s).
 *    Referral sending is ONLY ACTIVE during this phase!
 * 3. Table Transition: Remaining time of the 15-minute block for members to walk to their next table
 *    (e.g., 5 persons = 7.5 min / 450s).
 */

export const ROUND_BLOCK_DURATION_SECS = 15 * 60; // 900 seconds (15 minutes)
export const TOTAL_BLOCK_SECS = ROUND_BLOCK_DURATION_SECS;
export const TALKING_SECS_PER_PERSON = 60;         // 1.0 minute (60 seconds)
export const REFERRAL_SECS_PER_PERSON = 30;        // 0.5 minute (30 seconds)
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
  const talkingSecs = Math.min(ROUND_BLOCK_DURATION_SECS, p * TALKING_SECS_PER_PERSON);
  const referralSecs = Math.min(ROUND_BLOCK_DURATION_SECS - talkingSecs, p * REFERRAL_SECS_PER_PERSON);
  const activeSecs = talkingSecs; // Alias for backward compatibility
  const transitionSecs = Math.max(0, ROUND_BLOCK_DURATION_SECS - (talkingSecs + referralSecs));

  const startMs = parseStartTime(startedAt);

  // If not started, paused, or invalid start time
  if (isNaN(startMs) || !isRunning) {
    return {
      phase: 'not_started',
      phaseLabel: 'Ready to Start',
      isTalking: false,
      isReferral: false,
      isReferralOpen: false,
      isTransition: false,
      isEnded: false,
      elapsedSecs: 0,
      totalRemaining: ROUND_BLOCK_DURATION_SECS,
      totalTimeLeft: ROUND_BLOCK_DURATION_SECS,
      phaseRemaining: talkingSecs,
      phaseTimeLeft: talkingSecs,
      totalBlockSecs: ROUND_BLOCK_DURATION_SECS,
      activeSecs: talkingSecs,
      talkingSecs,
      referralSecs,
      transitionSecs,
      personsPerTable: p,
      speakerIndex: 0,
      speakerNumber: 1,
      speakerTimeLeft: TALKING_SECS_PER_PERSON,
      speakerTotalSecs: TALKING_SECS_PER_PERSON,
      progressPercent: 0,
      phaseProgressPercent: 0,
    };
  }

  const elapsedSecs = Math.max(0, Math.floor((now - startMs) / 1000));
  const totalRemaining = Math.max(0, ROUND_BLOCK_DURATION_SECS - elapsedSecs);
  const progressPercent = Math.min(100, Math.round((elapsedSecs / ROUND_BLOCK_DURATION_SECS) * 100));

  if (elapsedSecs < talkingSecs) {
    // Phase 1: Talking Time (1 minute per person)
    const phaseRemaining = talkingSecs - elapsedSecs;
    const phaseProgressPercent = Math.min(100, Math.round((elapsedSecs / talkingSecs) * 100));

    // Calculate which speaker is up
    const speakerIndex = Math.min(p - 1, Math.floor(elapsedSecs / TALKING_SECS_PER_PERSON));
    const speakerElapsed = elapsedSecs % TALKING_SECS_PER_PERSON;
    const speakerTimeLeft = TALKING_SECS_PER_PERSON - speakerElapsed;

    return {
      phase: 'active', // keep 'active' for components that check phase === 'active'
      subPhase: 'talking',
      phaseLabel: 'Talking Time',
      isTalking: true,
      isReferral: false,
      isReferralOpen: false,
      isTransition: false,
      isEnded: false,
      elapsedSecs,
      totalRemaining,
      totalTimeLeft: totalRemaining,
      phaseRemaining,
      phaseTimeLeft: phaseRemaining,
      totalBlockSecs: ROUND_BLOCK_DURATION_SECS,
      activeSecs: talkingSecs,
      talkingSecs,
      referralSecs,
      transitionSecs,
      personsPerTable: p,
      speakerIndex,
      speakerNumber: speakerIndex + 1,
      speakerTimeLeft,
      speakerTotalSecs: TALKING_SECS_PER_PERSON,
      progressPercent,
      phaseProgressPercent,
    };
  } else if (elapsedSecs < (talkingSecs + referralSecs)) {
    // Phase 2: Referral Exchange Window (30 seconds per person)
    const referralElapsed = elapsedSecs - talkingSecs;
    const phaseRemaining = (talkingSecs + referralSecs) - elapsedSecs;
    const phaseProgressPercent = referralSecs > 0
      ? Math.min(100, Math.round((referralElapsed / referralSecs) * 100))
      : 100;

    return {
      phase: 'referral',
      subPhase: 'referral',
      phaseLabel: 'Referral Window Open',
      isTalking: false,
      isReferral: true,
      isReferralOpen: true, // ONLY ACTIVE HERE!
      isTransition: false,
      isEnded: false,
      elapsedSecs,
      totalRemaining,
      totalTimeLeft: totalRemaining,
      phaseRemaining,
      phaseTimeLeft: phaseRemaining,
      totalBlockSecs: ROUND_BLOCK_DURATION_SECS,
      activeSecs: talkingSecs,
      talkingSecs,
      referralSecs,
      transitionSecs,
      personsPerTable: p,
      speakerIndex: p,
      speakerNumber: p,
      speakerTimeLeft: 0,
      speakerTotalSecs: TALKING_SECS_PER_PERSON,
      progressPercent,
      phaseProgressPercent,
    };
  } else if (elapsedSecs < ROUND_BLOCK_DURATION_SECS) {
    // Phase 3: Transition Time (Move to next table)
    const transitionElapsed = elapsedSecs - (talkingSecs + referralSecs);
    const phaseRemaining = ROUND_BLOCK_DURATION_SECS - elapsedSecs;
    const phaseProgressPercent = transitionSecs > 0
      ? Math.min(100, Math.round((transitionElapsed / transitionSecs) * 100))
      : 100;

    return {
      phase: 'transition',
      subPhase: 'transition',
      phaseLabel: 'Move to Next Table',
      isTalking: false,
      isReferral: false,
      isReferralOpen: false, // CLOSED HERE!
      isTransition: true,
      isEnded: false,
      elapsedSecs,
      totalRemaining,
      totalTimeLeft: totalRemaining,
      phaseRemaining,
      phaseTimeLeft: phaseRemaining,
      totalBlockSecs: ROUND_BLOCK_DURATION_SECS,
      activeSecs: talkingSecs,
      talkingSecs,
      referralSecs,
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
    // Phase 4: Ended
    return {
      phase: 'ended',
      subPhase: 'ended',
      phaseLabel: 'Round Ended',
      isTalking: false,
      isReferral: false,
      isReferralOpen: false,
      isTransition: false,
      isEnded: true,
      elapsedSecs,
      totalRemaining: 0,
      totalTimeLeft: 0,
      phaseRemaining: 0,
      phaseTimeLeft: 0,
      totalBlockSecs: ROUND_BLOCK_DURATION_SECS,
      activeSecs: talkingSecs,
      talkingSecs,
      referralSecs,
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
