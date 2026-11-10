import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/**
 * Unified conclave hook: fetches full details, round clock, status, and seating.
 * Deduplicates in-memory cache across Workspace, Overview, Schedule, and RoundRunner.
 */
export function useConclave(conclaveId) {
  return useQuery({
    queryKey: ['conclave', conclaveId],
    queryFn: async () => {
      if (!conclaveId) return null;
      return await api.get(`/admin/conclaves/${conclaveId}`);
    },
    enabled: Boolean(conclaveId),
  });
}

