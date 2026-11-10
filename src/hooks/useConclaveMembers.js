import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/**
 * Unified conclave registrations & members roster hook.
 * Shared across Workspace, Members tab, and Schedule Generator.
 */
export function useConclaveMembers(conclaveId) {
  return useQuery({
    queryKey: ['members', conclaveId],
    queryFn: async () => {
      if (!conclaveId) return [];
      const res = await api.get(`/admin/conclaves/${conclaveId}/registrations`);
      return Array.isArray(res?.registrations) ? res.registrations : (Array.isArray(res) ? res : []);
    },
    enabled: Boolean(conclaveId),
  });
}

