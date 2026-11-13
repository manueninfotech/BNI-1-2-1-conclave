import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/**
 * Shared conclave attendance hook.
 * Caches member check-ins and verified attendance records.
 */
export function useConclaveAttendance(conclaveId, options = {}) {
  return useQuery({
    ...options,
    queryKey: ['attendance', conclaveId],
    queryFn: async () => {
      if (!conclaveId) return [];
      const res = await api.get(`/admin/conclaves/${conclaveId}/attendance`);
      return Array.isArray(res) ? res : [];
    },
    enabled: Boolean(conclaveId),
    staleTime: 15000,
    refetchInterval: options.refetchInterval ?? 15000,
  });
}

