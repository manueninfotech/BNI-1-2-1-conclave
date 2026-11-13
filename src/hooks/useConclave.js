import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

/**
 * Deep merge helper for plain JSON objects.
 * Preserves full data (like schedule and participants) while merging partial live updates.
 */
function deepMerge(target, source) {
  if (!target || typeof target !== 'object' || !source || typeof source !== 'object') return source;
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sVal = source[key];
    const tVal = target[key];
    if (sVal !== null && typeof sVal === 'object' && tVal !== null && typeof tVal === 'object' && !Array.isArray(sVal)) {
      result[key] = deepMerge(tVal, sVal);
    } else {
      result[key] = sVal;
    }
  }
  return result;
}

/**
 * Helper to validate whether a cached conclave object contains complete data.
 * The Round Runner and administrative tabs strictly require:
 * 1. Full schedule with rounds (`cached.schedule.rounds` array)
 * 2. Full participant roster (`cached.participants` array)
 *
 * Compact SSE metadata frames only contain live clock, round numbers, and status.
 * If either schedule.rounds or participants is missing, the cache is incomplete (stale),
 * ensuring the full GET /admin/conclaves/:id query runs.
 */
export function isConclaveCacheComplete(cached) {
  if (!cached || typeof cached !== 'object') return false;
  const hasScheduleRounds = Boolean(cached.schedule && Array.isArray(cached.schedule.rounds));
  const hasParticipants = Boolean(Array.isArray(cached.participants));
  return hasScheduleRounds && hasParticipants;
}

/**
 * Unified conclave hook: fetches full details, round clock, status, and seating.
 * Deduplicates in-memory cache across Workspace, Overview, Schedule, and RoundRunner.
 *
 * SSE-First Architecture:
 * - When SSE status is 'connected': polling is disabled (false), updates arrive in real-time.
 * - When SSE status is 'disconnected' or 'reconnecting': fallback polling runs every 15 seconds.
 * - When SSE reconnects: fallback polling stops automatically.
 *
 * Cache Safeguard:
 * - A conclave query is only considered fresh when full schedule AND participant data are present.
 * - If only compact SSE metadata is in cache (or if schedule exists but participants are missing),
 *   staleTime returns 0 to guarantee the full conclave API query executes without being blocked.
 * - When SSE is disconnected, fresh REST API data is authoritative and cannot be overridden by stale cache.
 * - When SSE is connected, live clock metadata is preserved without reverting server round or pause transitions.
 */
export function useConclave(conclaveId, options = {}) {
  const queryClient = useQueryClient();
  const { data: sseStatus = 'disconnected' } = useQuery({
    queryKey: ['sse-status', conclaveId],
    queryFn: () => 'disconnected',
    staleTime: Infinity,
  });

  const isLiveConnected = sseStatus === 'connected';

  // Fallback polling cadence: defaults to 15,000 ms (15s).
  // Polling only runs when SSE is disconnected, reconnecting, or connecting.
  // When SSE is connected, polling is ALWAYS false to prevent redundant network traffic.
  const fallbackMs = options.fallbackInterval ?? options.refetchInterval ?? 15000;
  const computedRefetchInterval = isLiveConnected ? false : fallbackMs;

  return useQuery({
    ...options,
    queryKey: ['conclave', conclaveId],
    queryFn: async () => {
      if (!conclaveId) return null;
      const fullData = await api.get(`/admin/conclaves/${conclaveId}`);

      // When SSE is disconnected or reconnecting, fresh REST API data is authoritative
      if (!isLiveConnected) {
        return fullData;
      }

      // When SSE is connected, preserve in-flight live clock updates if present
      const currentCache = queryClient.getQueryData(['conclave', conclaveId]);
      if (currentCache) {
        const cacheRound = Number(currentCache.currentRound);
        const serverRound = Number(fullData.currentRound);

        // If an SSE event advanced to a higher round while the REST call was in flight, merge it
        const cacheIsNewer = Number.isFinite(cacheRound) && Number.isFinite(serverRound) && cacheRound > serverRound;

        if (cacheIsNewer) {
          return deepMerge(fullData, {
            currentRound: currentCache.currentRound,
            currentRoundStartedAt: currentCache.currentRoundStartedAt ?? fullData.currentRoundStartedAt,
            isRoundPaused: currentCache.isRoundPaused ?? fullData.isRoundPaused,
            roundPausedAt: currentCache.roundPausedAt ?? fullData.roundPausedAt,
            roundElapsedMsBeforePause: currentCache.roundElapsedMsBeforePause ?? fullData.roundElapsedMsBeforePause,
            ...(currentCache.status ? { status: currentCache.status } : {}),
            ...(currentCache.clock ? { clock: currentCache.clock } : {}),
          });
        }

        // If server round is equal or newer, preserve only live clock object if fullData lacks it
        if (currentCache.clock && !fullData.clock) {
          return {
            ...fullData,
            clock: currentCache.clock,
          };
        }
      }

      return fullData;
    },
    enabled: Boolean(conclaveId),
    staleTime: (query) => {
      const cached = query.state.data;
      // If cache is missing full schedule (with rounds) or participants, it is STALE (0) so the full query must run
      if (!isConclaveCacheComplete(cached)) return 0;
      return isLiveConnected ? Infinity : fallbackMs;
    },
    refetchInterval: computedRefetchInterval,
    refetchOnWindowFocus: !isLiveConnected,
  });
}
