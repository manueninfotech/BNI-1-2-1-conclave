import React, { useState, useEffect, useMemo } from 'react';
import { Star, MessageSquare, RefreshCw, TrendingUp, Clock, Handshake } from 'lucide-react';
import { api } from '../services/api';

/**
 * Post-conclave feedback, read by admins. Members submit a rating, how the
 * timing felt, how many referrals they passed, and an optional comment from the
 * app's summary screen (backend: GET /admin/conclaves/:id/feedback). This view
 * resolves each submission's uid to the member's name via the conclave roster.
 */
export default function Feedback({ selectedConclaveId }) {
  const [data, setData] = useState(null);
  const [nameByUid, setNameByUid] = useState({});
  const [conclaveName, setConclaveName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!selectedConclaveId) return;
    setLoading(true);
    setError(null);
    try {
      const [fb, full] = await Promise.all([
        api.get(`/admin/conclaves/${selectedConclaveId}/feedback`),
        api.get(`/admin/conclaves/${selectedConclaveId}`).catch(() => null),
      ]);
      setData(fb);
      if (full) {
        setConclaveName(full.name || '');
        const map = {};
        (full.participants || []).forEach((p) => {
          const uid = p._originalUid || p.uid || p.id;
          if (uid != null) map[String(uid)] = p.name || null;
        });
        setNameByUid(map);
      }
    } catch (err) {
      console.error('Failed to load feedback:', err);
      setError(err.message || 'Could not load feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [selectedConclaveId]);

  const items = data?.items || [];

  const timingDist = useMemo(() => {
    const d = { short: 0, right: 0, long: 0 };
    items.forEach((i) => { if (i.timing && d[i.timing] != null) d[i.timing]++; });
    return d;
  }, [items]);

  const avgReferrals = useMemo(() => {
    const vals = items.map((i) => i.referrals).filter((n) => typeof n === 'number');
    if (!vals.length) return null;
    return +(vals.reduce((s, n) => s + n, 0) / vals.length).toFixed(1);
  }, [items]);

  const totalReferrals = useMemo(
    () => items.reduce((s, i) => s + (typeof i.referrals === 'number' ? i.referrals : 0), 0),
    [items]
  );

  if (!selectedConclaveId) {
    return (
      <div className="p-8 text-center text-zinc-400 font-semibold">
        Select a conclave to see its feedback.
      </div>
    );
  }

  const Stars = ({ n }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`w-3.5 h-3.5 ${s <= (n || 0) ? 'text-amber-400 fill-amber-400' : 'text-zinc-300'}`} />
      ))}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-[1100px] mx-auto w-full flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="border-b border-zinc-100 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-dashboard-title text-zinc-950 font-extrabold tracking-tight">Feedback</h2>
          <p className="text-body-text text-zinc-500 mt-2">
            What members said about <span className="font-bold text-brand-red">{conclaveName || 'this conclave'}</span>.
          </p>
        </div>
        <button
          onClick={load}
          type="button"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-white border border-zinc-250 hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded-xl transition-smooth shadow-2xs cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 text-zinc-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-bold">{error}</div>
      )}

      {!error && !loading && items.length === 0 && (
        <div className="p-10 text-center bg-white border border-zinc-200/80 rounded-xl">
          <MessageSquare className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <h4 className="text-body-md font-extrabold text-zinc-700">No feedback yet</h4>
          <p className="text-[12px] text-zinc-400 mt-1">Members submit feedback from the app's summary screen after the conclave.</p>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white border border-zinc-200/80 p-4 rounded-xl shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Responses</p>
              <h4 className="text-headline-md font-extrabold text-zinc-900 mt-1">{data.count}</h4>
            </div>
            <div className="bg-white border border-zinc-200/80 p-4 rounded-xl shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Avg rating</p>
              <div className="flex items-center gap-2 mt-1">
                <h4 className="text-headline-md font-extrabold text-zinc-900">{data.avgRating ?? '—'}</h4>
                {data.avgRating != null && <Stars n={Math.round(data.avgRating)} />}
              </div>
            </div>
            <div className="bg-white border border-zinc-200/80 p-4 rounded-xl shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1 flex items-center gap-1"><Handshake className="w-3 h-3" /> Referrals</p>
              <h4 className="text-headline-md font-extrabold text-zinc-900 mt-1">{totalReferrals}</h4>
              <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">{avgReferrals != null ? `${avgReferrals} avg/member` : '—'}</p>
            </div>
            <div className="bg-white border border-zinc-200/80 p-4 rounded-xl shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Timing</p>
              <div className="flex flex-col gap-0.5 mt-1 text-[11px] font-bold">
                <span className="text-amber-700">{timingDist.short} too short</span>
                <span className="text-emerald-700">{timingDist.right} just right</span>
                <span className="text-red-700">{timingDist.long} too long</span>
              </div>
            </div>
          </div>

          {/* Comments / per-member list */}
          <div className="bg-white border border-zinc-200/80 rounded-xl shadow-sm divide-y divide-zinc-100">
            {items.map((it) => {
              const name = nameByUid[String(it.uid)] || 'Member';
              return (
                <div key={it.uid} className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 flex items-center justify-center font-black text-[10px] shrink-0">
                        {name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'M'}
                      </div>
                      <span className="font-extrabold text-zinc-900 text-[13px]">{name}</span>
                      <Stars n={it.rating} />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold">
                      {it.timing && (
                        <span className={`px-2 py-0.5 rounded border ${it.timing === 'right' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : it.timing === 'short' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                          {it.timing === 'right' ? 'Timing just right' : it.timing === 'short' ? 'Too short' : 'Too long'}
                        </span>
                      )}
                      {typeof it.referrals === 'number' && (
                        <span className="px-2 py-0.5 rounded border bg-zinc-50 border-zinc-200 text-zinc-600 inline-flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> {it.referrals} referral{it.referrals === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>
                  {it.comment && (
                    <p className="text-[12.5px] text-zinc-700 leading-relaxed pl-9.5">“{it.comment}”</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
