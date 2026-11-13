import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/**
 * Shared conclave statistics hook.
 * Caches round stats, counts (members, captains, referrals) and deduplicates
 * across RoundRunner and Dashboard.
 *
 * SSE-First Architecture:
 * - When SSE status is 'connected': polling is disabled (false), updates arrive in real-time.
 * - When SSE status is 'disconnected' or 'reconnecting': fallback polling runs every 30 seconds.
 * - When SSE reconnects: fallback polling stops automatically.
 */
export function useConclaveStats(conclaveId, options = {}) {
  const { data: sseStatus = 'disconnected' } = useQuery({
    queryKey: ['sse-status', conclaveId],
    queryFn: () => 'disconnected',
    staleTime: Infinity,
  });

  const isLiveConnected = sseStatus === 'connected';

  return useQuery({
    ...options,
    queryKey: ['stats', conclaveId],
    queryFn: async () => {
      if (!conclaveId) return null;
      return await api.get(`/admin/conclaves/${conclaveId}/stats`);
    },
    enabled: Boolean(conclaveId),
    staleTime: isLiveConnected ? Infinity : 15000,
    refetchInterval: options.refetchInterval !== undefined
      ? options.refetchInterval
      : (isLiveConnected ? false : 30000),
    refetchOnWindowFocus: false,
  });
}
