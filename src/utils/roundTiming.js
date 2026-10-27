/**
 * Round timing logic dynamically calibrated from backend settings:
 * 1. Talking Time: bioSeconds (default 60s) per person.
 * 2. Referral Window: referralSeconds (default 30s) per person.
 *    Referral sending is ONLY ACTIVE during this phase!
 * 3. Table Transition: Minimum bufferSeconds (default 120s) plus remaining round block time
 *    for members to stand and walk to their next table.
 */

export const ROUND_BLOCK_DURATION_SECS = 15 * 60; // 900 seconds (15 minutes fallback)
export const TOTAL_BLOCK_SECS = ROUND_BLOCK_DURATION_SECS;
export const TALKING_SECS_PER_PERSON = 60;         // 1.0 minute fallback
export const REFERRAL_SECS_PER_PERSON = 30;        // 0.5 minute fallback
export const SECS_PER_PERSON = TALKING_SECS_PER_PERSON;

const DEFAULT_CONFIG = {
  bioSeconds: 60,
  referralSeconds: 30,
  bufferSeconds: 120,
  roundDurationMinutes: 15,
};

let activeTimingConfig = (() => {
  try {
    const savedTiming = typeof window !== 'undefined' ? localStorage.getItem('bni_round_timing_config') : null;
    const savedDefaults = typeof window !== 'undefined' ? localStorage.getItem('bni_conclave_defaults') : null;
    const timingObj = savedTiming ? JSON.parse(savedTiming) : {};
    const defObj = savedDefaults ? JSON.parse(savedDefaults) : {};
    return {
      ...DEFAULT_CONFIG,
      ...timingObj,
      roundDurationMinutes: Number(defObj.roundDurationMinutes) || Number(timingObj.roundDurationMinutes) || DEFAULT_CONFIG.roundDurationMinutes,
      personsPerTable: Number(defObj.personsPerTable) || Number(timingObj.personsPerTable) || 6,
      roundCount: Number(defObj.roundCount) || Number(timingObj.roundCount) || 4,
    };
  } catch {}
  return { ...DEFAULT_CONFIG };
})();

/** Set / sync global timing configuration received from backend API */
export function setTimingConfig(next) {
  if (!next) return;
  activeTimingConfig = {
    ...activeTimingConfig,
    bioSeconds: Number(next.bioSeconds) || activeTimingConfig.bioSeconds,
    referralSeconds: Number(next.referralSeconds) || activeTimingConfig.referralSeconds,
    bufferSeconds: Number(next.bufferSeconds) || activeTimingConfig.bufferSeconds,
    roundDurationMinutes: Number(next.roundDurationMinutes) || activeTimingConfig.roundDurationMinutes,
    personsPerTable: Number(next.personsPerTable) || activeTimingConfig.personsPerTable,
    roundCount: Number(next.roundCount) || activeTimingConfig.roundCount,
  };
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bni_round_timing_config', JSON.stringify(activeTimingConfig));
    }
  } catch {}
}

/** Get currently active global timing configuration */
export function getTimingConfig() {
  return activeTimingConfig;
}

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
 * Dynamically uses speaking time, referral time, and base block duration from backend.
 * NOTE: Move buffer is NOT counted into the round timing itself (speaking + referral).
 *
 * @param {Object} options
 * @param {any} options.startedAt - Start timestamp of current round
 * @param {number} [options.personsPerTable=6] - Seats per table (default 6)
 * @param {Object} [options.roundTiming=null] - { bioSeconds, referralSeconds, bufferSeconds } from backend
 * @param {number} [options.roundDurationMinutes=null] - Base block duration in minutes (from conclave / backend)
 * @param {number} [options.extensionSeconds=0] - Live extended seconds added by admin (from conclave / backend)
 * @param {boolean} [options.isRunning=true] - Whether round is currently active/running
 * @param {boolean} [options.isPaused=false] - Whether round timer is paused
 * @param {any} [options.pausedAt=null] - Timestamp when round was paused
 * @param {number} [options.elapsedMsBeforePause=null] - Accumulated elapsed ms before pause
 * @param {number} [options.now=Date.now()] - Current epoch timestamp
 */
export function calculateRoundTiming({
  startedAt,
  personsPerTable = 6,
  roundTiming = null,
  roundDurationMinutes = null,
  extensionSeconds = 0,
  isRunning = true,
  isPaused = false,
  pausedAt = null,
  elapsedMsBeforePause = null,
  now = Date.now(),
} = {}) {
  // Use passed backend config -> cached config -> fallback defaults
  const activeTiming = roundTiming || activeTimingConfig;
  const bioSecs = Number(activeTiming.bioSeconds) || DEFAULT_CONFIG.bioSeconds;
  const refSecs = Number(activeTiming.referralSeconds) || DEFAULT_CONFIG.referralSeconds;
  const bufSecs = Number(activeTiming.bufferSeconds) || DEFAULT_CONFIG.bufferSeconds;
  const baseMinutes = Number(roundDurationMinutes) || activeTiming.roundDurationMinutes || null;
  const extSecs = Math.max(0, Number(extensionSeconds) || 0);

  const p = Math.max(1, Number(personsPerTable) || activeTiming.personsPerTable || 6);

  // Active round timing: speaking time + referral window
  const activeCadenceSecs = (p * bioSecs) + (p * refSecs);

  // If baseMinutes is provided (from conclave settings / backend), respect it; otherwise use activeCadenceSecs
  // Do NOT count move buffer into the round timing formula!
  const baseBlockSecs = (baseMinutes && baseMinutes > 0)
    ? baseMinutes * 60
    : activeCadenceSecs;
  const totalBlockSecs = baseBlockSecs + extSecs;

  const effectiveBioSecs = bioSecs;
  const effectiveRefSecs = refSecs;
  const talkingSecs = p * effectiveBioSecs;
  const referralSecs = p * effectiveRefSecs;
  // Any extra time in the round block beyond talking+referral serves as transition/table rotation
  const transitionSecs = Math.max(0, totalBlockSecs - (talkingSecs + referralSecs));

  const startMs = parseStartTime(startedAt);

  // If not started or invalid start time
  if (isNaN(startMs) || !isRunning) {
    return {
      phase: 'not_started',
      phaseLabel: 'Ready to Start',
      isPaused: false,
      isTalking: false,
      isReferral: false,
      isReferralOpen: false,
      isTransition: false,
      isEnded: false,
      elapsedSecs: 0,
      totalRemaining: totalBlockSecs,
      totalTimeLeft: totalBlockSecs,
      phaseRemaining: talkingSecs,
      phaseTimeLeft: talkingSecs,
      totalBlockSecs,
      activeSecs: talkingSecs,
      talkingSecs,
      referralSecs,
      transitionSecs,
      personsPerTable: p,
      bioSecs: effectiveBioSecs,
      refSecs: effectiveRefSecs,
      bufSecs,
      speakerIndex: 0,
      speakerNumber: 1,
      speakerTimeLeft: effectiveBioSecs,
      speakerTotalSecs: effectiveBioSecs,
      progressPercent: 0,
      phaseProgressPercent: 0,
    };
  }

  const effectiveNow = isPaused
    ? (elapsedMsBeforePause != null && !isNaN(Number(elapsedMsBeforePause))
        ? startMs + Number(elapsedMsBeforePause)
        : (pausedAt && !isNaN(parseStartTime(pausedAt)) ? parseStartTime(pausedAt) : now))
    : now;

  const elapsedSecs = Math.max(0, Math.floor((effectiveNow - startMs) / 1000));
  const totalRemaining = Math.max(0, totalBlockSecs - elapsedSecs);
  const progressPercent = Math.min(100, Math.round((elapsedSecs / totalBlockSecs) * 100));

  if (elapsedSecs < talkingSecs) {
    // Phase 1: Talking Time (bioSecs per person)
    const phaseRemaining = talkingSecs - elapsedSecs;
    const phaseProgressPercent = Math.min(100, Math.round((elapsedSecs / talkingSecs) * 100));

    // Calculate which speaker is up
    const speakerIndex = Math.min(p - 1, Math.floor(elapsedSecs / effectiveBioSecs));
    const speakerElapsed = elapsedSecs % effectiveBioSecs;
    const speakerTimeLeft = effectiveBioSecs - speakerElapsed;

    return {
      phase: isPaused ? 'paused' : 'active',
      subPhase: 'talking',
      phaseLabel: isPaused ? 'Round Paused' : 'Talking Time',
      isPaused: Boolean(isPaused),
      isTalking: !isPaused,
      isReferral: false,
      isReferralOpen: false,
      isTransition: false,
      isEnded: false,
      elapsedSecs,
      totalRemaining,
      totalTimeLeft: totalRemaining,
      phaseRemaining,
      phaseTimeLeft: phaseRemaining,
      totalBlockSecs,
      activeSecs: talkingSecs,
      talkingSecs,
      referralSecs,
      transitionSecs,
      personsPerTable: p,
      bioSecs: effectiveBioSecs,
      refSecs: effectiveRefSecs,
      bufSecs,
      speakerIndex,
      speakerNumber: speakerIndex + 1,
      speakerTimeLeft,
      speakerTotalSecs: effectiveBioSecs,
      progressPercent,
      phaseProgressPercent,
    };
  } else if (elapsedSecs < (talkingSecs + referralSecs)) {
    // Phase 2: Referral Exchange Window (refSecs per person)
    const referralElapsed = elapsedSecs - talkingSecs;
    const phaseRemaining = (talkingSecs + referralSecs) - elapsedSecs;
    const phaseProgressPercent = referralSecs > 0
      ? Math.min(100, Math.round((referralElapsed / referralSecs) * 100))
      : 100;

    return {
      phase: isPaused ? 'paused' : 'referral',
      subPhase: 'referral',
      phaseLabel: isPaused ? 'Round Paused' : 'Referral Window Open',
      isPaused: Boolean(isPaused),
      isTalking: false,
      isReferral: !isPaused,
      isReferralOpen: !isPaused, // ONLY ACTIVE WHEN NOT PAUSED!
      isTransition: false,
      isEnded: false,
      elapsedSecs,
      totalRemaining,
      totalTimeLeft: totalRemaining,
      phaseRemaining,
      phaseTimeLeft: phaseRemaining,
      totalBlockSecs,
      activeSecs: talkingSecs,
      talkingSecs,
      referralSecs,
      transitionSecs,
      personsPerTable: p,
      bioSecs: effectiveBioSecs,
      refSecs: effectiveRefSecs,
      bufSecs,
      speakerIndex: p,
      speakerNumber: p,
      speakerTimeLeft: 0,
      speakerTotalSecs: effectiveBioSecs,
      progressPercent,
      phaseProgressPercent,
    };
  } else if (elapsedSecs < totalBlockSecs) {
    // Phase 3: Transition Time (Move to next table)
    const transitionElapsed = elapsedSecs - (talkingSecs + referralSecs);
    const phaseRemaining = totalBlockSecs - elapsedSecs;
    const phaseProgressPercent = transitionSecs > 0
      ? Math.min(100, Math.round((transitionElapsed / transitionSecs) * 100))
      : 100;

    return {
      phase: isPaused ? 'paused' : 'transition',
      subPhase: 'transition',
      phaseLabel: isPaused ? 'Round Paused' : 'Move to Next Table',
      isPaused: Boolean(isPaused),
      isTalking: false,
      isReferral: false,
      isReferralOpen: false,
      isTransition: !isPaused,
      isEnded: false,
      elapsedSecs,
      totalRemaining,
      totalTimeLeft: totalRemaining,
      phaseRemaining,
      phaseTimeLeft: phaseRemaining,
      totalBlockSecs,
      activeSecs: talkingSecs,
      talkingSecs,
      referralSecs,
      transitionSecs,
      personsPerTable: p,
      bioSecs,
      refSecs,
      bufSecs,
      speakerIndex: p,
      speakerNumber: p,
      speakerTimeLeft: 0,
      speakerTotalSecs: bioSecs,
      progressPercent,
      phaseProgressPercent,
    };
  } else {
    // Phase 4: Ended
    return {
      phase: isPaused ? 'paused' : 'ended',
      subPhase: isPaused ? 'paused' : 'ended',
      phaseLabel: isPaused ? 'Round Paused' : 'Round Ended',
      isPaused: Boolean(isPaused),
      isTalking: false,
      isReferral: false,
      isReferralOpen: false,
      isTransition: false,
      isEnded: !isPaused,
      elapsedSecs,
      totalRemaining: 0,
      totalTimeLeft: 0,
      phaseRemaining: 0,
      phaseTimeLeft: 0,
      totalBlockSecs,
      activeSecs: talkingSecs,
      talkingSecs,
      referralSecs,
      transitionSecs,
      personsPerTable: p,
      bioSecs,
      refSecs,
      bufSecs,
      speakerIndex: p,
      speakerNumber: p,
      speakerTimeLeft: 0,
      speakerTotalSecs: bioSecs,
      progressPercent: 100,
      phaseProgressPercent: 100,
    };
  }
}
