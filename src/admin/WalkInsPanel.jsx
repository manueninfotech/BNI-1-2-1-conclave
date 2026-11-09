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
    <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-card-title font-bold text-zinc-900 flex items-center gap-1.5">
          <UserPlus className="w-4 h-4 text-brand-red" /> Walk-ins
          {pending.length > 0 && (
            <span className="ml-1 text-[11px] font-bold bg-brand-red text-white rounded-full px-2 py-0.5">{pending.length} waiting</span>
          )}
        </h3>
        <span className="text-caption text-zinc-500">{approved.length} seated</span>
      </div>

      {pending.length === 0 ? (
        <p className="text-caption text-zinc-500">
          No one is waiting. Late arrivals tap "Join as walk-in" in the app; collect their payment, then approve here.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {pending.map((w) => (
            <div key={w.uid} className="py-2.5 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 truncate">
                    {w.name}
                    {isBni(w) && <span className="ml-1.5 text-[10px] font-bold text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded">BNI</span>}
                  </p>
                  <p className="text-caption text-zinc-500 truncate">
                    {[w.category, w.company, w.chapter, w.phone].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {busy === w.uid ? (
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => reject(w)}
                      className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:text-zinc-900 cursor-pointer"
                      aria-label={`Decline ${w.name}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => approve(w)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-sm font-semibold cursor-pointer"
                    >
                      <Check className="w-4 h-4" /> Paid, seat them
                    </button>
                  </>
                )}
              </div>

              {captainFor === w.uid && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
                  <p className="text-sm text-amber-900 flex items-center gap-1.5">
                    <Crown className="w-4 h-4" /> Every table is full, so a new table opens. Who captains it?
                  </p>
                  <div className="flex gap-2">
                    <select
                      aria-label="Captain for the new table"
                      className="flex-1 border border-amber-200 rounded-lg px-2 py-1.5 text-sm bg-white"
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
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-sm font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      Open table
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
