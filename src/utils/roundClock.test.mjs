// Same cases as the backend's src/domain/__tests__/roundClock.test.ts.
// Run: node --test src/utils/roundClock.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { liveClock, peopleFor, phases, roundStartMs } from './roundClock.js';

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 1, 5, 0, 0);
const row = (over = {}) => ({
  currentRound: 1, currentRoundStartedAt: new Date(T0).toISOString(), roundCount: 4, personsPerTable: 8,
  roundProgressionMode: 'manual', roundExtensionSeconds: 0, moveSeconds: 120, isRoundPaused: false, ...over,
});
const sized = (over = {}) => row({ personsPerTable: 5, roundPeople: [5, 5, 6, 5], roundProgressionMode: 'automatic', ...over });

test('8 per table: 12 min; never above 8', () => {
  assert.equal(phases(row()).talkMs, 12 * MIN);
  assert.equal(phases(row({ personsPerTable: 10 })).talkMs, 12 * MIN);
});

test('each round is timed for its own size', () => {
  assert.equal(phases(sized(), 1).talkMs, 7.5 * MIN);
  assert.equal(phases(sized(), 3).talkMs, 9 * MIN);
  assert.equal(peopleFor(sized(), 3), 6);
});

test('automatic: later rounds start after each earlier round at its own length', () => {
  assert.equal(roundStartMs(sized(), 2), T0 + 9.5 * MIN);
  assert.equal(roundStartMs(sized(), 3), T0 + 19 * MIN);
  assert.equal(roundStartMs(sized(), 4), T0 + 30 * MIN);
  assert.deepEqual([liveClock(sized(), T0 + 24.5 * MIN).round, liveClock(sized(), T0 + 24.5 * MIN).phase], [3, 'bio']);
  assert.equal(liveClock(sized(), T0 + 25.5 * MIN).phase, 'referral');
});

test('falls back to people-per-table', () => {
  assert.equal(phases(row({ personsPerTable: 5 }), 3).talkMs, 7.5 * MIN);
  assert.equal(phases(sized(), 9).talkMs, 7.5 * MIN);
  assert.equal(phases(sized({ roundPeople: [12] }), 1).talkMs, 12 * MIN);
});
