import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

/**
 * The conclaves this admin can see (their region; all of them for a superadmin).
 * Powered by TanStack React Query for global in-memory deduplication & instant updates.
 */
export function useConclaves() {
  const queryClient = useQueryClient();

  const { data: conclaves = [], isLoading: loading, error } = useQuery({
    queryKey: ['conclaves'],
    queryFn: async () => {
      const list = await api.get('/admin/conclaves');
      return Array.isArray(list) ? list : [];
    },
  });

  const reload = () => queryClient.invalidateQueries({ queryKey: ['conclaves'] });

  return {
    conclaves,
    loading,
    error: error?.message || null,
    reload,
  };
}
