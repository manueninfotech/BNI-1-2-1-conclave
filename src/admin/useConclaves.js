import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

const CACHE_KEY = 'bni_admin_conclaves_cache';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const list = raw ? JSON.parse(raw) : null;
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

/**
 * The conclaves this admin can see (their region; all of them for a
 * superadmin). Shows the last copy at once, then refreshes.
 */
export function useConclaves() {
  const [conclaves, setConclaves] = useState(() => readCache() || []);
  const [loading, setLoading] = useState(() => !readCache());
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const list = await api.get('/admin/conclaves');
      if (Array.isArray(list)) {
        setConclaves(list);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(list.map(({ schedule, participants, snapshot, ...rest }) => ({ ...rest, schedule: schedule ? true : null })))); } catch { /* full storage is fine */ }
      }
      setError(null);
    } catch (e) {
      setError(e?.message || 'Could not load conclaves.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { conclaves, loading, error, reload };
}
