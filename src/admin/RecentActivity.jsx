import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { describe, who } from './Activity';

/** The latest few entries of the activity log, for a dashboard card. */
export default function RecentActivity({ limit = 6, onSeeAll }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api.get(`/admin/activity?limit=${limit}`).then((r) => setItems(r.items || [])).catch(() => setItems([]));
  }, [limit]);
  if (items === null) return <div className="h-32 rounded-lg bg-zinc-50 animate-pulse" />;
  if (items.length === 0) return <p className="text-sm text-zinc-500">Nothing recorded yet.</p>;
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {items.map((r) => (
          <li key={r.id} className="text-sm">
            <p className="text-zinc-900 leading-snug">{describe(r, true)}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {who(r)} · {new Date(r.occurredAt).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </p>
          </li>
        ))}
      </ul>
      {onSeeAll && (
        <button onClick={onSeeAll} className="text-sm font-bold text-brand-red hover:text-red-700 cursor-pointer">
          See all activity →
        </button>
      )}
    </div>
  );
}
