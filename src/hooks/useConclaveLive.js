import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BASE_URL, getAuthToken } from '../services/api';
import { broadcastTabMessage } from '../utils/syncBus';

/**
 * Real-time SSE listener hook for live conclave state.
 * Subscribes to backend GET /conclaves/:id/live powered by PostgreSQL LISTEN/NOTIFY.
 * Listens to 'state' events dispatched by the backend live stream.
 * On every round tick, pause, resume, extend, or state update:
 * instantly patches the React Query cache and syncs across all open tabs via BroadcastChannel.
 */
export function useConclaveLive(conclaveId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conclaveId) return;

    let eventSource = null;
    let isCancelled = false;

    async function initSSE() {
      try {
        const token = await getAuthToken();
        if (isCancelled) return;

        const sseUrl = new URL(`${BASE_URL}/conclaves/${conclaveId}/live`);
        if (token) {
          sseUrl.searchParams.set('token', token);
        }

        eventSource = new EventSource(sseUrl.toString());

        const handleStateUpdate = (event) => {
          if (!event?.data) return;
          try {
            const data = JSON.parse(event.data);
            if (!data) return;

            // Instantly patch in-memory conclave cache
            queryClient.setQueryData(['conclave', conclaveId], (prev) => {
              if (!prev) return data;
              return { ...prev, ...data };
            });

            // Invalidate queries so all dependent components refetch immediately
            queryClient.invalidateQueries({ queryKey: ['conclave', conclaveId] });
            queryClient.invalidateQueries({ queryKey: ['referrals', conclaveId] });
            queryClient.invalidateQueries({ queryKey: ['members', conclaveId] });
            queryClient.invalidateQueries({ queryKey: ['conclaves'] });

            // Cross-tab broadcast so other open tabs update immediately
            broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey: ['conclave', conclaveId] });
            broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey: ['referrals', conclaveId] });
            broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey: ['members', conclaveId] });
            broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey: ['conclaves'] });
          } catch (e) {
            console.debug('SSE parse error:', e);
          }
        };

        // Backend live.service.ts sends `event: state\ndata: ...`
        eventSource.addEventListener('state', handleStateUpdate);
        eventSource.addEventListener('message', handleStateUpdate);
        eventSource.onmessage = handleStateUpdate;

        eventSource.onerror = () => {
          // EventSource handles reconnection automatically
        };
      } catch (err) {
        console.debug('Failed to initialize SSE connection:', err);
      }
    }

    initSSE();

    return () => {
      isCancelled = true;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [conclaveId, queryClient]);
}

