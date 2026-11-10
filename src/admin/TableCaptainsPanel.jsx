import React, { useMemo, useState } from 'react';
import { Crown, Loader2, ChevronDown } from 'lucide-react';
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
    for (const p of conclave?.participants || []) {
      m.set(p.id, p);
      if (p.uid) m.set(p.uid, p);
      if (p._originalUid) m.set(p._originalUid, p);
    }
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

  const standInCount = useMemo(() => {
    return tables.filter(t => Boolean(t.standInUid)).length;
  }, [tables]);

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
    <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-3xs space-y-3 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60 shadow-3xs">
            <Crown className="w-4 h-4 fill-amber-500 text-amber-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-zinc-950 leading-tight">
                Table Captains
              </h3>
              {standInCount > 0 && (
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {standInCount} Stand-in{standInCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 font-medium truncate mt-0.5">
              Pick a stand-in if captain is absent
            </p>
          </div>
        </div>

        {/* Round selector */}
        <div className="relative shrink-0">
          <select
            aria-label="Round"
            className="appearance-none bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-xs font-bold text-zinc-800 rounded-lg pl-2.5 pr-6 py-1.5 outline-none focus:border-brand-red cursor-pointer shadow-3xs"
            value={shownRound}
            onChange={(e) => setRound(Number(e.target.value))}
          >
            {Array.from({ length: Math.max(0, totalRounds - firstEditable + 1) }, (_, i) => firstEditable + i).map((r) => (
              <option key={r} value={r}>Round {r}</option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Tables list (Scrollable when there are multiple tables) */}
      <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
        {tables.map((t) => {
          const hasStandIn = Boolean(t.standInUid);
          const activeStandIn = hasStandIn
            ? t.options.find(p => (p._originalUid || p.uid || String(p.id)) === t.standInUid) || byId.get(t.standInUid)
            : null;

          return (
            <div
              key={t.tableNumber}
              className={`p-3 rounded-xl border transition-smooth space-y-2 ${
                hasStandIn
                  ? 'bg-amber-50/40 border-amber-250 shadow-3xs'
                  : 'bg-zinc-50/70 hover:bg-white border-zinc-200/80'
              }`}
            >
              {/* Row 1: Table Badge + Names with full width + Status Badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-black shrink-0 ${
                      hasStandIn
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-zinc-200/80 text-zinc-800'
                    }`}
                  >
                    Table {t.tableNumber}
                  </span>

                  <div className="text-xs truncate">
                    {hasStandIn ? (
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="line-through text-zinc-400 font-medium truncate">
                          {t.anchor?.name || 'Captain'}
                        </span>
                        <span className="text-zinc-400 font-normal">→</span>
                        <span className="text-amber-950 font-black truncate">
                          {activeStandIn?.name || 'Stand-in'}
                        </span>
                      </span>
                    ) : (
                      <span className="font-bold text-zinc-900 truncate">
                        {t.anchor?.name || 'No Captain Assigned'}
                      </span>
                    )}
                  </div>
                </div>

                {hasStandIn ? (
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full shrink-0">
                    Stand-in
                  </span>
                ) : (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-200/70 px-2 py-0.5 rounded-full shrink-0">
                    Captain
                  </span>
                )}
              </div>

              {/* Row 2: Full-width select dropdown */}
              <div className="relative">
                <select
                  aria-label={`Captain for table ${t.tableNumber}`}
                  disabled={saving !== null}
                  value={t.standInUid}
                  onChange={(e) => save(t.tableNumber, e.target.value)}
                  className={`w-full appearance-none rounded-lg pl-3 pr-8 py-2 text-xs font-semibold outline-none transition cursor-pointer shadow-3xs truncate ${
                    hasStandIn
                      ? 'bg-white border border-amber-400 text-amber-950 font-bold focus:border-amber-500 ring-1 ring-amber-300/40'
                      : 'bg-white border border-zinc-200 text-zinc-700 hover:border-zinc-300 focus:border-brand-red'
                  }`}
                >
                  <option value="">
                    {t.anchor ? `${t.anchor.name} (Original Captain)` : 'Select Captain'}
                  </option>
                  {t.options
                    .filter((p) => p.id !== t.anchor?.id)
                    .map((p) => {
                      const val = p._originalUid || p.uid || String(p.id);
                      const isBni = String(p.membership || '').toUpperCase() === 'BNI';
                      return (
                        <option key={val} value={val}>
                          {p.name} {isBni ? '• BNI' : ''} ({p.businessCategory || p.category || 'Member'})
                        </option>
                      );
                    })}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                {saving === t.tableNumber && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400 absolute right-7 top-1/2 -translate-y-1/2" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
