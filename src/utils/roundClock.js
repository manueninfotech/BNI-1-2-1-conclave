/**
 * The round clock — a line-for-line mirror of the backend's
 * src/domain/roundClock.ts, so the round runner shows exactly the round and
 * phase the server (and every phone) is on. Keep the two in step.
 *
 *  - A round: 1-min bio per person, then one referral slot of 30 s per
 *    person (8 per table → 8 + 4 = 12 min). Max 8 per table.
 *  - Extension (+1/+2/+5 min) is added after the referral slot.
 *  - Manual: the admin starts each round; a finished round waits.
 *    Automatic: after the round (+ extension), a move break (1/2/5 min),
 *    then the next round starts by itself.
 *  - Paused: the clock is frozen.
 */

export const BIO_MS_PER_PERSON = 60_000;
export const REFERRAL_MS_PER_PERSON = 30_000;
export const MAX_PERSONS_PER_TABLE = 8;
export const MOVE_SECONDS_OPTIONS = [60, 120, 300];
export const EXTEND_SECONDS_OPTIONS = [60, 120, 300];
export const DEFAULT_MOVE_SECONDS = 120;

const toMs = (v) => {
  if (!v) return NaN;
  if (typeof v === 'object' && typeof v._seconds === 'number') return v._seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? NaN : t;
};
const people = (c) => Math.min(MAX_PERSONS_PER_TABLE, Math.max(1, Number(c?.personsPerTable) || 1));
const isAutomatic = (c) => c?.roundProgressionMode === 'automatic';
const moveMs = (c) => Math.max(0, Number(c?.moveSeconds ?? DEFAULT_MOVE_SECONDS)) * 1000;
const extMs = (c) => Math.max(0, Number(c?.roundExtensionSeconds) || 0) * 1000;

export function phases(c) {
  const p = people(c);
  return { bioMs: p * BIO_MS_PER_PERSON, referralMs: p * REFERRAL_MS_PER_PERSON, talkMs: p * (BIO_MS_PER_PERSON + REFERRAL_MS_PER_PERSON) };
}

export function clockNow(c, now = Date.now()) {
  const anchor = toMs(c?.currentRoundStartedAt);
  if (c?.isRoundPaused && !Number.isNaN(anchor)) return anchor + Math.max(0, Number(c.roundElapsedMsBeforePause) || 0);
  return now;
}

export function roundStartMs(c, k) {
  const cur = Number(c?.currentRound) || 0;
  const anchor = toMs(c?.currentRoundStartedAt);
  if (Number.isNaN(anchor) || cur < 1 || k < cur) return null;
  if (k === cur) return anchor;
  if (!isAutomatic(c)) return null;
  const { talkMs } = phases(c);
  return anchor + (talkMs + extMs(c) + moveMs(c)) + (k - cur - 1) * (talkMs + moveMs(c));
}

/**
 * Where the conclave is: { round, phase, roundStartMs, phaseEndsMs, extensionMs }.
 * phase: not_started | bio | referral | extension | move | waiting | done
 */
export function liveClock(c, now = Date.now()) {
  const cur = Number(c?.currentRound) || 0;
  const total = Number(c?.roundCount) || 0;
  if (cur < 1 || Number.isNaN(toMs(c?.currentRoundStartedAt))) {
    return { round: 0, phase: 'not_started', roundStartMs: null, phaseEndsMs: null, extensionMs: 0 };
  }
  const t = clockNow(c, now);
  const { bioMs, talkMs } = phases(c);
  let k = cur;
  if (isAutomatic(c)) {
    while (k < total) {
      const next = roundStartMs(c, k + 1);
      if (next === null || t < next) break;
      k++;
    }
  }
  const start = roundStartMs(c, k);
  const ext = k === cur ? extMs(c) : 0;
  const into = t - start;
  const base = { round: k, roundStartMs: start, extensionMs: ext };
  if (into < bioMs) return { ...base, phase: 'bio', phaseEndsMs: start + bioMs };
  if (into < talkMs) return { ...base, phase: 'referral', phaseEndsMs: start + talkMs };
  if (into < talkMs + ext) return { ...base, phase: 'extension', phaseEndsMs: start + talkMs + ext };
  if (k >= total) return { ...base, phase: 'done', phaseEndsMs: null };
  if (isAutomatic(c)) return { ...base, phase: 'move', phaseEndsMs: start + talkMs + ext + moveMs(c) };
  return { ...base, phase: 'waiting', phaseEndsMs: null };
}
