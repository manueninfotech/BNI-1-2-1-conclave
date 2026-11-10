import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Crown, Loader2, UserPlus, X } from 'lucide-react';
import { api } from '../services/api';

const isBni = (p) => String(p?.membership || '').toUpperCase() === 'BNI';

/**
 * People asking to join a running conclave at the venue. The region admin
 * collects their payment outside the app, then approves; the system seats them
 * from the next round. When every table is full a new table opens and, in a
 * captain conclave, this asks who captains it.
 */
export default function WalkInsPanel({ conclave, showToast }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(null);
  const [captainFor, setCaptainFor] = useState(null); // uid awaiting a captain pick
  const [captainUid, setCaptainUid] = useState('');
  const id = conclave?.id;
  const running = String(conclave?.status || '').toLowerCase() === 'running';

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.get(`/admin/conclaves/${id}/walk-ins`);
      if (Array.isArray(data)) setRows(data);
    } catch {
      /* keep the last list */
    }
  }, [id]);

  useEffect(() => {
    load();
    if (!running) return undefined;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load, running]);

  // Who may captain a new table: the walk-in, or anyone not already captaining.
  const captainOptions = useMemo(() => {
    const anchors = new Set((conclave?.schedule?.rounds?.[0]?.tables || []).map((t) => t.captainId));
    const pool = (conclave?.participants || []).filter((p) => !anchors.has(p.id));
    return [...pool].sort((a, b) => (isBni(b) - isBni(a)) || String(a.name).localeCompare(String(b.name)));
  }, [conclave?.participants, conclave?.schedule]);

  const pending = rows.filter((r) => r.status === 'pending');
  const approved = rows.filter((r) => r.status === 'approved');

  if (!running && rows.length === 0) return null;

  const approve = async (w, captain) => {
    setBusy(w.uid);
    try {
      const res = await api.post(`/admin/conclaves/${id}/walk-ins/${w.uid}/approve`, captain ? { captainUid: captain } : {});
      setCaptainFor(null);
      setCaptainUid('');
      showToast?.(
        'Walk-in seated',
        `${w.name} joins from round ${res.joinsFromRound}${res.tableNumber ? ` at Table ${res.tableNumber}` : ''}.` +
          (res.tablesAdded?.length ? ` Table ${res.tablesAdded.join(', ')} opens, please set it up.` : ''),
      );
      load();
    } catch (err) {
      if (err.data?.needsCaptain) {
        setCaptainFor(w.uid);
        setCaptainUid(isBni(w) ? w.uid : '');
      } else {
        showToast?.('Could not seat this walk-in', err.message || 'Please try again.');
      }
    } finally {
      setBusy(null);
    }
  };

  const reject = async (w) => {
    setBusy(w.uid);
    try {
      await api.post(`/admin/conclaves/${id}/walk-ins/${w.uid}/reject`, {});
      showToast?.('Walk-in declined', `${w.name} has been told.`);
      load();
    } catch (err) {
      showToast?.('Could not decline', err.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-3xs space-y-3 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-red-50 text-brand-red flex items-center justify-center shrink-0 border border-rose-200/60 shadow-3xs">
            <UserPlus className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-zinc-950 leading-tight">
                Walk-ins
              </h3>
              {pending.length > 0 && (
                <span className="text-[10px] font-black uppercase tracking-wider bg-brand-red text-white rounded-full px-2 py-0.5 whitespace-nowrap">
                  {pending.length} Waiting
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 font-medium truncate mt-0.5">
              Venue arrivals waiting to be seated
            </p>
          </div>
        </div>

        <div className="shrink-0">
          <span className="text-xs font-bold text-zinc-600 bg-zinc-100 border border-zinc-200/70 px-2.5 py-1 rounded-lg whitespace-nowrap shadow-3xs">
            {approved.length} Seated
          </span>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="py-5 px-3 bg-zinc-50/70 rounded-xl border border-dashed border-zinc-200 text-center space-y-0.5">
          <p className="text-xs font-semibold text-zinc-500">
            No walk-in requests waiting
          </p>
          <p className="text-[11px] text-zinc-400">
            Members can tap "Join as walk-in" in the mobile app
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
          {pending.map((w) => (
            <div
              key={w.uid}
              className="p-3 rounded-xl border border-zinc-200/80 bg-zinc-50/60 hover:bg-white transition-smooth space-y-2.5 shadow-3xs"
            >
              <div className="flex items-center justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-zinc-950 truncate">
                      {w.name}
                    </span>
                    {isBni(w) && (
                      <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 rounded">
                        BNI
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                    {[w.category, w.company, w.chapter, w.phone].filter(Boolean).join(' · ')}
                  </p>
                </div>

                {busy === w.uid ? (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 px-3 py-1.5">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-red" />
                    <span className="text-[11px] font-semibold">Processing...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => reject(w)}
                      className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 transition-smooth cursor-pointer"
                      aria-label={`Decline ${w.name}`}
                      title="Decline walk-in"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => approve(w)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black transition-smooth shadow-3xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Seat</span>
                    </button>
                  </div>
                )}
              </div>

              {captainFor === w.uid && (
                <div className="rounded-xl bg-amber-50/90 border border-amber-200 p-3 space-y-2">
                  <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-600 fill-amber-500 shrink-0" />
                    Every table is full. Pick a captain for new table:
                  </p>
                  <div className="flex gap-2">
                    <select
                      aria-label="Captain for the new table"
                      className="flex-1 border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white text-zinc-800 outline-none focus:border-amber-500 shadow-3xs"
                      value={captainUid}
                      onChange={(e) => setCaptainUid(e.target.value)}
                    >
                      <option value="">Pick a captain</option>
                      <option value={w.uid}>{w.name} (this walk-in){isBni(w) ? ' · BNI' : ''}</option>
                      {captainOptions.map((p) => (
                        <option key={p._originalUid} value={p._originalUid}>
                          {p.name}{isBni(p) ? ' · BNI' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!captainUid}
                      onClick={() => approve(w, captainUid)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-950 text-white text-xs font-black disabled:opacity-40 hover:bg-zinc-800 transition-smooth cursor-pointer shrink-0"
                    >
                      Open Table
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
