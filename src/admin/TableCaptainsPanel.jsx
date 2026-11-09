import React, { useMemo, useState } from 'react';
import { Crown, Loader2 } from 'lucide-react';
import { api } from '../services/api';

/**
 * Captain per table for one round, with a stand-in when the table's captain is
 * late or away. The stand-in gets the scan button on their phone for that round
 * only; the real captain takes the table back from the next round.
 *
 * Hidden for conclaves that run without captains.
 */
export default function TableCaptainsPanel({ conclave, activeRound, onChanged, showToast }) {
  const totalRounds = conclave?.roundCount || conclave?.schedule?.rounds?.length || 0;
  const firstEditable = Math.max(1, activeRound || 1);
  const [round, setRound] = useState(firstEditable);
  const [saving, setSaving] = useState(null);
  const shownRound = Math.min(Math.max(round, firstEditable), Math.max(firstEditable, totalRounds));

  const byId = useMemo(() => {
    const m = new Map();
    for (const p of conclave?.participants || []) m.set(p.id, p);
    return m;
  }, [conclave?.participants]);

  const tables = useMemo(() => {
    const r = conclave?.schedule?.rounds?.find((x) => x.roundNumber === shownRound);
    const standIns = conclave?.standInCaptains?.[String(shownRound)] || {};
    return (r?.tables || []).map((t) => {
      const seated = [t.captainId, ...(t.memberIds || [])]
        .filter((id) => id !== null && id !== undefined)
        .map((id) => byId.get(id))
        .filter(Boolean);
      // BNI members first: organisers prefer a BNI member as stand-in.
      const options = [...seated].sort((a, b) => {
        const ab = String(a.membership || '').toUpperCase() === 'BNI' ? 0 : 1;
        const bb = String(b.membership || '').toUpperCase() === 'BNI' ? 0 : 1;
        return ab - bb || String(a.name).localeCompare(String(b.name));
      });
      return {
        tableNumber: t.tableNumber,
        anchor: byId.get(t.captainId) || null,
        standInUid: standIns[String(t.tableNumber)] || '',
        options,
      };
    });
  }, [conclave?.schedule, conclave?.standInCaptains, shownRound, byId]);

  if (!conclave?.schedule || conclave?.captainMode === 'none') return null;

  const save = async (tableNumber, uid) => {
    setSaving(tableNumber);
    try {
      await api.post(`/admin/conclaves/${conclave.id}/stand-in-captain`, {
        roundNumber: shownRound,
        tableNumber,
        uid: uid || null,
      });
      showToast?.(
        uid ? 'Stand-in captain set' : 'Captain restored',
        uid ? `Table ${tableNumber} has a stand-in for round ${shownRound}.` : `Table ${tableNumber} is back with its captain.`,
      );
      onChanged?.();
    } catch (err) {
      showToast?.('Could not change the captain', err.message || 'Please try again.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-card-title font-bold text-zinc-900 flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-amber-500" /> Table captains
          </h3>
          <p className="text-caption text-zinc-500">
            Captain late or away? Pick someone at that table to captain this round.
          </p>
        </div>
        <select
          aria-label="Round"
          className="border border-zinc-200 rounded-lg px-2 py-1.5 text-sm font-semibold"
          value={shownRound}
          onChange={(e) => setRound(Number(e.target.value))}
        >
          {Array.from({ length: Math.max(0, totalRounds - firstEditable + 1) }, (_, i) => firstEditable + i).map((r) => (
            <option key={r} value={r}>Round {r}</option>
          ))}
        </select>
      </div>

      <div className="divide-y divide-zinc-100">
        {tables.map((t) => (
          <div key={t.tableNumber} className="flex items-center gap-3 py-2">
            <span className="w-10 text-sm font-black text-zinc-900 tabular-nums">T{t.tableNumber}</span>
            <span className="flex-1 min-w-0 text-sm text-zinc-600 truncate">
              {t.standInUid ? (
                <>
                  <span className="line-through text-zinc-400">{t.anchor?.name || 'Captain'}</span>
                  <span className="ml-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Stand-in</span>
                </>
              ) : (
                t.anchor?.name || 'No captain'
              )}
            </span>
            <div className="flex items-center gap-2">
              {saving === t.tableNumber && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}
              <select
                aria-label={`Captain for table ${t.tableNumber}`}
                className="border border-zinc-200 rounded-lg px-2 py-1 text-sm max-w-[200px]"
                disabled={saving !== null}
                value={t.standInUid}
                onChange={(e) => save(t.tableNumber, e.target.value)}
              >
                <option value="">{t.anchor ? `${t.anchor.name} (captain)` : 'No captain'}</option>
                {t.options
                  .filter((p) => p.id !== t.anchor?.id)
                  .map((p) => (
                    <option key={p._originalUid} value={p._originalUid}>
                      {p.name}{String(p.membership || '').toUpperCase() === 'BNI' ? ' · BNI' : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
