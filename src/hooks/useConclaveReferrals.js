import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/**
 * Unified live referrals hook for conclave sessions.
 * Shared across RoundRunner, Dashboard, and Overview.
 *
 * SSE-First Architecture:
 * - When SSE status is 'connected': polling is disabled (false), updates arrive in real-time.
 * - When SSE status is 'disconnected' or 'reconnecting': fallback polling runs every 30 seconds.
 * - When SSE reconnects: fallback polling stops automatically.
 */
export function useConclaveReferrals(conclaveId, options = {}) {
  const { data: sseStatus = 'disconnected' } = useQuery({
    queryKey: ['sse-status', conclaveId],
    queryFn: () => 'disconnected',
    staleTime: Infinity,
  });

  const isLiveConnected = sseStatus === 'connected';

  return useQuery({
    ...options,
    queryKey: ['referrals', conclaveId],
    queryFn: async () => {
      if (!conclaveId) return [];
      const res = await api.get(`/admin/conclaves/${conclaveId}/referrals`);
      return Array.isArray(res) ? res : (res?.referrals || []);
    },
    staleTime: isLiveConnected ? Infinity : 15000,
    refetchInterval: options.refetchInterval !== undefined
      ? options.refetchInterval
      : (isLiveConnected ? false : 30000),
    refetchOnWindowFocus: false,
    enabled: Boolean(conclaveId),
  });
}
