import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/**
 * Unified live referrals hook for conclave sessions.
 * Polling fallback of 3s ensures zero stale referrals even if SSE drops.
 */
export function useConclaveReferrals(conclaveId) {
  return useQuery({
    queryKey: ['referrals', conclaveId],
    queryFn: async () => {
      if (!conclaveId) return [];
      const res = await api.get(`/admin/conclaves/${conclaveId}/referrals`);
      return Array.isArray(res) ? res : (res?.referrals || []);
    },
    refetchInterval: 3000,
    enabled: Boolean(conclaveId),
  });
}

