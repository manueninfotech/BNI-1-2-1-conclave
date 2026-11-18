import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  History,
  RefreshCw,
  ChevronDown,
  Search,
  Filter,
  CheckCircle2,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserPlus,
  PlayCircle,
  PauseCircle,
  Calendar,
  MessageSquare,
  Layers,
  Settings,
  X,
  Smartphone,
  Globe,
  AlertTriangle,
  Zap,
  Handshake,
} from 'lucide-react';
import { api } from '../services/api';

/**
 * Modern Executive Activity & Audit Log.
 * Real-time audit trail of all conclave transitions, member actions,
 * referrals, and system changes with timeline visualization and search filters.
 */
export default function Activity({ conclaveId, embedded = false }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');

  const load = useCallback(
    async (from) => {
      setLoading(true);
      try {
        const q = new URLSearchParams({ limit: '60' });
        if (conclaveId) q.set('conclaveId', conclaveId);
        if (from) q.set('cursor', from);
        const res = await api.get(`/admin/activity?${q}`);
        setItems((prev) => (from ? [...prev, ...(res.items || [])] : res.items || []));
        setCursor(res.nextCursor || null);
        setError(null);
      } catch (e) {
        setError(e?.message || 'Could not load activity log.');
      } finally {
        setLoading(false);
      }
    },
    [conclaveId],
  );

  useEffect(() => {
    load(null);
  }, [load]);

  // Activity classification
  const getCategory = (r) => {
    const act = r.action || '';
    if (act.startsWith('conclave.') || act.startsWith('round.') || act.startsWith('schedule.')) return 'rounds';
    if (act.startsWith('referral.') || act.startsWith('one_to_one.')) return 'referrals';
    if (act.startsWith('registration.') || act.startsWith('attendance.')) return 'registrations';
    if (act.startsWith('feedback.')) return 'feedback';
    if (act.startsWith('user.') || act.startsWith('admin.') || act.startsWith('region.')) return 'members';
    return 'system';
  };

  // Metrics summary
  const stats = useMemo(() => {
    const total = items.length;
    let roundsCount = 0;
    let referralsCount = 0;
    let registrationsCount = 0;
    let feedbackCount = 0;
    let memberActions = 0;

    items.forEach((r) => {
      const cat = getCategory(r);
      if (cat === 'rounds') roundsCount++;
      else if (cat === 'referrals') referralsCount++;
      else if (cat === 'registrations') registrationsCount++;
      else if (cat === 'feedback') feedbackCount++;

      if (r.actor?.role === 'member' || r.actor?.role === 'captain') memberActions++;
    });

    return { total, roundsCount, referralsCount, registrationsCount, feedbackCount, memberActions };
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((r) => {
      // Source filter
      if (selectedSource !== 'all' && r.source !== selectedSource) return false;

      // Category filter
      if (activeCategory !== 'all') {
        const cat = getCategory(r);
        if (cat !== activeCategory) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const descriptionText = describe(r, !conclaveId).toLowerCase();
        const actorName = (r.actor?.name || '').toLowerCase();
        const subjectName = (r.subject?.name || '').toLowerCase();
        const conclaveName = (r.conclave?.name || '').toLowerCase();
        const actionName = (r.action || '').toLowerCase();
        if (
          !descriptionText.includes(q) &&
          !actorName.includes(q) &&
          !subjectName.includes(q) &&
          !conclaveName.includes(q) &&
          !actionName.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [items, selectedSource, activeCategory, searchQuery, conclaveId]);

  const groups = useMemo(() => groupByDay(filteredItems), [filteredItems]);

  return (
    <div className={`space-y-3.5 sm:space-y-4 max-w-[1600px] mx-auto w-full font-sans select-none pb-8 ${embedded ? 'pt-0' : 'p-3 sm:p-5'}`}>
      {/* 1. Header Toolbar */}
      <div>
        <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Activity & Audit Trail</h1>
        <p className="text-xs text-zinc-500 mt-0.5 font-medium">
          Real-time audit log of member actions, session round transitions, and system events.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-brand-red shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Executive KPI Metric Strip (Flat - NO CARDS) */}
      <div className="bg-white border border-zinc-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 grid grid-cols-2 md:grid-cols-5 shadow-xs">
        <div className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5">
          <div className="flex flex-col justify-between">
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">Total Actions</span>
            <div className="my-1 text-2xl sm:text-3xl font-black text-zinc-950 tabular-nums">{stats.total}</div>
            <span className="text-[10px] font-bold text-zinc-500">Recorded in log</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0">
            <History className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5">
          <div className="flex flex-col justify-between">
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">Rounds & Sessions</span>
            <div className="my-1 text-2xl sm:text-3xl font-black text-zinc-950 tabular-nums">{stats.roundsCount}</div>
            <span className="text-[10px] font-bold text-[#00875A]">Stage transitions</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#00875A] flex items-center justify-center shrink-0">
            <PlayCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5">
          <div className="flex flex-col justify-between">
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">Referrals Logged</span>
            <div className="my-1 text-2xl sm:text-3xl font-black text-zinc-950 tabular-nums">{stats.referralsCount}</div>
            <span className="text-[10px] font-bold text-brand-red">Exchanged by members</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-brand-red flex items-center justify-center shrink-0">
            <Handshake className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5">
          <div className="flex flex-col justify-between">
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">Registrations</span>
            <div className="my-1 text-2xl sm:text-3xl font-black text-zinc-950 tabular-nums">{stats.registrationsCount}</div>
            <span className="text-[10px] font-bold text-sky-700">Check-ins & signups</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5 col-span-2 md:col-span-1">
          <div className="flex flex-col justify-between">
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">Member Actions</span>
            <div className="my-1 text-2xl sm:text-3xl font-black text-zinc-950 tabular-nums">{stats.memberActions}</div>
            <span className="text-[10px] font-bold text-purple-700">App interactions</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Search and Category Filter Toolbar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-2.5 sm:p-3 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Segmented Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeCategory === 'all'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('rounds')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeCategory === 'rounds'
                ? 'bg-[#00875A] text-white shadow-2xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
          >
            Rounds ({stats.roundsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('referrals')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeCategory === 'referrals'
                ? 'bg-brand-red text-white shadow-2xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
          >
            Referrals ({stats.referralsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('registrations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeCategory === 'registrations'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
          >
            Registrations ({stats.registrationsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('feedback')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeCategory === 'feedback'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
          >
            Feedback ({stats.feedbackCount})
          </button>
        </div>

        {/* Search & Source Filter */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search activity or member..."
              className="w-full pl-8 pr-7 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="relative">
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="h-8 pl-2.5 pr-7 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-brand-red cursor-pointer appearance-none"
            >
              <option value="all">All Sources</option>
              <option value="mobile_app">Mobile App</option>
              <option value="admin_panel">Admin Panel</option>
              <option value="webhook">Payment Gateway</option>
              <option value="system">Automatic System</option>
            </select>
            <Filter className="w-3 h-3 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 4. Timeline Audit Log (High-Density Ledger - NO CARDS) */}
      {!loading && filteredItems.length === 0 && (
        <div className="p-12 text-center bg-zinc-50 border border-dashed border-zinc-300 rounded-xl max-w-lg mx-auto my-8 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-white border border-zinc-200 text-zinc-400 flex items-center justify-center mb-3 shadow-xs">
            <History className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-zinc-900">
            {searchQuery || activeCategory !== 'all' || selectedSource !== 'all'
              ? 'No Matching Activity'
              : 'Nothing Recorded Yet'}
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mt-1 leading-relaxed">
            {searchQuery || activeCategory !== 'all' || selectedSource !== 'all'
              ? 'Try adjusting your search terms or clearing filter selections.'
              : 'Audit events and session transitions will stream here automatically as actions occur.'}
          </p>
          {(searchQuery || activeCategory !== 'all' || selectedSource !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
                setSelectedSource('all');
              }}
              className="mt-4 text-xs font-bold text-brand-red hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          )}
        </div>
      )}

      {groups.map(([day, rows]) => (
        <section key={day} className="space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <span className="w-2 h-2 rounded-full bg-zinc-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-600">{day}</h2>
            <span className="text-[11px] font-semibold text-zinc-400">({rows.length} actions)</span>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-150 overflow-hidden shadow-xs">
            {rows.map((r) => {
              const pauseInfo = getPauseWindowInfo(r, items);
              let displayedChanges = r.changes ? Object.entries(r.changes).filter(([k, v]) => !HIDDEN_FIELDS.has(k) && hasMeaningfulChange(v)) : [];

              if (pauseInfo && (r.action === 'round.pause' || r.action === 'round.resume')) {
                // Filter out raw roundPausedAt so we replace it with ordered Pause Start, Pause End, and Total Duration
                displayedChanges = displayedChanges.filter(([k]) => k !== 'roundPausedAt');

                const pauseRows = [];
                if (pauseInfo.pausedAt) {
                  pauseRows.push(['pauseStartTime', { from: null, to: formatDateTime(pauseInfo.pausedAt) }]);
                }
                if (pauseInfo.resumedAt) {
                  pauseRows.push(['pauseEndTime', { from: null, to: formatDateTime(pauseInfo.resumedAt) }]);
                } else {
                  pauseRows.push(['pauseEndTime', { from: null, to: 'Currently Paused' }]);
                }
                if (pauseInfo.durationMs !== null) {
                  pauseRows.push(['pauseDuration', { from: null, to: formatDuration(pauseInfo.durationMs) }]);
                } else {
                  pauseRows.push(['pauseDuration', { from: null, to: 'Ongoing' }]);
                }

                const isPausedIdx = displayedChanges.findIndex(([k]) => k === 'isRoundPaused');
                if (isPausedIdx !== -1) {
                  displayedChanges.splice(isPausedIdx + 1, 0, ...pauseRows);
                } else {
                  displayedChanges.unshift(...pauseRows);
                }
              }

              const expandable = displayedChanges.length > 0 || r.ip || Boolean(pauseInfo);
              const isOpen = open === r.id;
              const iconMeta = getActionIcon(r.action);
              const IconComponent = iconMeta.icon;

              return (
                <div key={r.id} className="hover:bg-zinc-50/70 transition-colors">
                  <div
                    onClick={() => expandable && setOpen(isOpen ? null : r.id)}
                    className={`p-3.5 sm:px-4 sm:py-3 flex items-start gap-3 text-left ${expandable ? 'cursor-pointer' : 'cursor-default'
                      }`}
                  >
                    {/* Category Icon Badge */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${iconMeta.bg} ${iconMeta.color} ${iconMeta.border}`}
                    >
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>

                    {/* Action Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-xs font-bold text-zinc-950 leading-snug">
                          {describe(r, !conclaveId, pauseInfo)}
                        </span>
                        {r.conclave?.name && !conclaveId && (
                          <span className="text-[10px] bg-zinc-100 text-zinc-700 font-semibold px-1.5 py-0.2 rounded">
                            {r.conclave.name}
                          </span>
                        )}
                      </div>

                      {/* Micro Metadata Line */}
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-zinc-500 font-medium">
                        <span className="text-zinc-700 font-semibold">{who(r)}</span>

                        {r.actor?.role && (
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 font-bold">
                            {r.actor.role}
                          </span>
                        )}

                        {r.source && SOURCE[r.source] && r.kind !== 'system' && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                            {r.source === 'mobile_app' ? (
                              <Smartphone className="w-2.5 h-2.5" />
                            ) : (
                              <Globe className="w-2.5 h-2.5" />
                            )}
                            <span>{SOURCE[r.source]}</span>
                          </span>
                        )}

                        {r.outcome === 'failure' && (
                          <span className="text-[10px] font-bold text-brand-red bg-red-50 border border-red-200 px-1.5 py-0.2 rounded">
                            Failed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Timestamp & Expand Caret */}
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      <span className="text-[11px] font-bold text-zinc-400 tabular-nums">
                        {time(r.occurredAt)}
                      </span>
                      {expandable && (
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Expandable Field Diffs & Audit Metadata */}
                  {isOpen && (
                    <div className="px-4 pb-3 pt-2 border-t border-zinc-100 bg-zinc-50/60 ml-10 mr-4 rounded-b-lg mb-2 space-y-1.5">
                      <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">
                        Change Details:
                      </span>
                      {displayedChanges.map(([field, v]) => (
                        <div key={field} className="text-xs text-zinc-700 flex items-baseline gap-2">
                          <span className="font-bold text-zinc-900">{label(field)}:</span>
                          <span className="bg-red-50 text-brand-red px-1 rounded line-through text-[11px]">
                            {show(v?.from, field)}
                          </span>
                          <span className="text-zinc-400">→</span>
                          {v?.to === 'Currently Paused' || v?.to === 'Ongoing' ? (
                            <span className="bg-amber-100 text-amber-900 px-1 rounded font-bold text-[11px]">
                              {v.to}
                            </span>
                          ) : (
                            <span className="bg-emerald-50 text-[#00875A] px-1 rounded font-bold text-[11px]">
                              {show(v?.to, field)}
                            </span>
                          )}
                        </div>
                      ))}
                      {r.ip && (
                        <p className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-200/50">
                          Origin: {r.ip} {r.userAgent ? `· ${r.userAgent.slice(0, 90)}` : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* 5. Load More Older Activity */}
      {cursor && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => load(cursor)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer shadow-xs disabled:opacity-50"
          >
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{loading ? 'Loading older entries…' : 'Load More Older Activity'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// --- Action Icons & Styling ----------------------------------------------------

function getActionIcon(action = '') {
  if (action.startsWith('round.pause')) {
    return { icon: PauseCircle, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
  }
  if (action.startsWith('round.') || action === 'conclave.start') {
    return { icon: PlayCircle, color: 'text-[#00875A]', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  }
  if (action.startsWith('conclave.create') || action.startsWith('conclave.complete')) {
    return { icon: Layers, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  }
  if (action.startsWith('referral.')) {
    return { icon: TrendingUp, color: 'text-brand-red', bg: 'bg-red-50', border: 'border-red-200' };
  }
  if (action.startsWith('one_to_one.')) {
    return { icon: Calendar, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' };
  }
  if (action.startsWith('registration.create') || action.startsWith('attendance.')) {
    return { icon: CheckCircle2, color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' };
  }
  if (action.startsWith('registration.admin_add') || action.startsWith('registration.set_role')) {
    return { icon: UserPlus, color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' };
  }
  if (action.startsWith('registration.withdraw') || action.startsWith('registration.admin_remove')) {
    return { icon: UserMinus, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' };
  }
  if (action.startsWith('feedback.')) {
    return { icon: MessageSquare, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
  }
  if (action.startsWith('user.') || action.startsWith('admin.')) {
    return { icon: UserCheck, color: 'text-zinc-800', bg: 'bg-zinc-100', border: 'border-zinc-200' };
  }
  if (action.startsWith('settings.') || action.startsWith('region.')) {
    return { icon: Settings, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' };
  }
  return { icon: Zap, color: 'text-zinc-600', bg: 'bg-zinc-100', border: 'border-zinc-200' };
}

// --- Wording & Helpers (Exported for Home.jsx & RecentActivity.jsx) -------------

const SOURCE = {
  mobile_app: 'Mobile App',
  admin_panel: 'Admin Panel',
  webhook: 'Payment Gateway',
  system: 'Automatic',
  script: 'Maintenance Script',
};
const HIDDEN_FIELDS = new Set([
  'updatedAt',
  'createdAt',
  'legacy',
  'schedule',
  'participants',
  'snapshot',
  'scheduleSummary',
  'warnings',
  'dateRange', // legacy string field, superseded by startDate and endDate
  'creator', // legacy field, superseded by coordinator
  'theme', // legacy unused field
]);

function hasMeaningfulChange(v) {
  const fromVal = show(v?.from);
  const toVal = show(v?.to);
  if (fromVal === '—' && toVal === '—') return false;
  if (fromVal === toVal) return false;
  return true;
}

export function who(r) {
  if (r.kind === 'system' || r.actor?.role === 'system') return 'Automatic';
  return r.actor?.name || (r.actor?.role ? r.actor.role : 'Someone');
}

function formatDuration(ms) {
  if (ms === null || ms === undefined || ms === '' || isNaN(Number(ms))) return '—';
  const totalSecs = Math.max(0, Math.round(Number(ms) / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

function formatDateTime(d) {
  if (!d) return '—';
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return String(d);
  return dateObj.toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function getPauseWindowInfo(r, allItems = []) {
  if (!r || (r.action !== 'round.pause' && r.action !== 'round.resume')) return null;

  const conclaveId = r.conclaveId || r.entityId;

  if (r.action === 'round.pause') {
    const pausedAtRaw = r.changes?.roundPausedAt?.to || r.after?.roundPausedAt || r.occurredAt;
    const pausedAt = pausedAtRaw ? new Date(pausedAtRaw) : new Date(r.occurredAt);
    const pTime = pausedAt.getTime();

    // Find the matching resume event for this conclave that occurred after this pause
    const resumeEvent = (allItems || [])
      .filter(it =>
        it.action === 'round.resume' &&
        (it.conclaveId === conclaveId || it.entityId === conclaveId) &&
        new Date(it.occurredAt).getTime() >= pTime - 1000
      )
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())[0];

    const resumedAt = resumeEvent ? new Date(resumeEvent.occurredAt) : null;
    const durationMs = resumedAt ? Math.max(0, resumedAt.getTime() - pTime) : null;

    return {
      isPaused: true,
      pausedAt,
      resumedAt,
      isStillPaused: !resumedAt,
      durationMs,
      elapsedMsBefore: r.changes?.roundElapsedMsBeforePause?.to ?? r.after?.roundElapsedMsBeforePause ?? null,
      resumeActor: resumeEvent?.actor?.name || null
    };
  }

  if (r.action === 'round.resume') {
    const resumedAt = new Date(r.occurredAt);
    const rTime = resumedAt.getTime();

    const pausedAtRaw = r.changes?.roundPausedAt?.from || r.before?.roundPausedAt || r.metadata?.pausedAt;
    let pausedAt = pausedAtRaw ? new Date(pausedAtRaw) : null;

    if (!pausedAt) {
      // Find the pause event immediately preceding this resume
      const pauseEvent = (allItems || [])
        .filter(it =>
          it.action === 'round.pause' &&
          (it.conclaveId === conclaveId || it.entityId === conclaveId) &&
          new Date(it.occurredAt).getTime() <= rTime + 1000
        )
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0];
      if (pauseEvent) {
        const raw = pauseEvent.changes?.roundPausedAt?.to || pauseEvent.occurredAt;
        if (raw) pausedAt = new Date(raw);
      }
    }

    const durationMs = pausedAt ? Math.max(0, rTime - pausedAt.getTime()) : null;

    return {
      isPaused: false,
      pausedAt,
      resumedAt,
      isStillPaused: false,
      durationMs,
      elapsedMsBefore: r.changes?.roundElapsedMsBeforePause?.from ?? r.before?.roundElapsedMsBeforePause ?? null
    };
  }

  return null;
}

export function describe(r, withConclave, pauseInfo = null) {
  const self = r.subject?.uid && r.subject.uid === r.actor?.uid;
  const person =
    r.subject?.name || (['member', 'captain'].includes(r.actor?.role) ? r.actor?.name : null) || 'a member';
  const conclave = r.conclave?.name;
  const inC = withConclave && conclave ? ` in ${conclave}` : '';
  const onC = withConclave && conclave ? ` for ${conclave}` : '';
  const toC = withConclave && conclave ? ` to ${conclave}` : '';
  const fromC = withConclave && conclave ? ` from ${conclave}` : '';
  const c = conclave ? conclave : 'a conclave';
  const ch = r.changes || {};

  switch (r.action) {
    case 'conclave.create':
      return `Created ${c}`;
    case 'conclave.update':
      return `Edited ${c}${fieldsList(ch)}`;
    case 'conclave.delete':
      return `Deleted ${c}`;
    case 'conclave.cancel':
      return `Cancelled ${c}`;
    case 'conclave.complete':
      return `Marked ${c} as finished`;
    case 'conclave.auto_complete':
      return `${c} finished automatically`;
    case 'conclave.status_autofix':
      return `Corrected status of ${c}`;
    case 'conclave.lock_schedule':
      return `Locked table seating${onC}`;
    case 'conclave.start':
      return `Started round ${r.metadata?.roundNumber ?? ch.currentRound?.to ?? ''}${inC}`.replace('  ', ' ');
    case 'conclave.set_member_permission':
      return ch.allowAdminAddMembers?.to ? `Allowed admins to add members${toC}` : `Stopped admins adding members${toC}`;
    case 'round.pause': {
      if (pauseInfo) {
        if (pauseInfo.resumedAt) {
          const pStr = time(pauseInfo.pausedAt);
          const rStr = time(pauseInfo.resumedAt);
          const dur = pauseInfo.durationMs !== null ? ` (${formatDuration(pauseInfo.durationMs)})` : '';
          return `Paused the round${inC} · Paused from ${pStr} to ${rStr}${dur}`;
        }
        if (pauseInfo.isStillPaused) {
          return `Paused the round${inC} · Paused at ${time(pauseInfo.pausedAt)} (Currently Paused)`;
        }
      }
      return `Paused the round${inC}`;
    }
    case 'round.resume': {
      if (pauseInfo && pauseInfo.pausedAt) {
        const pStr = time(pauseInfo.pausedAt);
        const rStr = time(pauseInfo.resumedAt);
        const dur = pauseInfo.durationMs !== null ? ` (${formatDuration(pauseInfo.durationMs)})` : '';
        return `Resumed the round${inC} · Was paused from ${pStr} to ${rStr}${dur}`;
      }
      return `Resumed the round${inC}`;
    }
    case 'schedule.generate':
      return `Generated table seating${onC}`;
    case 'registration.create':
      return `${person} registered${onC}`;
    case 'registration.withdraw':
      return `${person} withdrew${fromC}`;
    case 'registration.admin_add':
      return `Added ${person}${toC}`;
    case 'registration.admin_update':
      return `Edited registration for ${person}${inC}${fieldsList(ch)}`;
    case 'registration.admin_remove':
      return `Removed ${person}${fromC}`;
    case 'registration.set_role':
      return `Made ${person} ${ch.role?.to === 'captain' ? 'a table captain' : 'a member'}${inC}`;
    case 'attendance.sync':
      return `${person} checked in${inC}`;
    case 'referral.create':
      return `${person} passed a referral${inC}`;
    case 'referral.outcome':
    case 'referral.status':
      return `Updated referral status${inC}`;
    case 'one_to_one.create':
      return `${person} booked a 1-to-1 meeting`;
    case 'feedback.create':
      return `${person} submitted post-conclave feedback${onC}`;
    case 'feedback.update':
      return `${person} updated their feedback${onC}`;
    case 'user.update':
      return self ? `${person} updated their profile${fieldsList(ch)}` : `Updated profile of ${person}${fieldsList(ch)}`;
    case 'user.photo_set':
      return `${person} changed profile photo`;
    case 'user.photo_remove':
      return `${person} removed profile photo`;
    case 'user.set_role':
      return `Changed role of ${person}`;
    case 'user.reset_link':
      return `Created password reset link for ${person}`;
    case 'user.delete_self':
      return `${person} deleted their account`;
    case 'admin.create':
      return `Added admin ${person}`;
    case 'admin.update':
    case 'admin.update_self':
      return `Updated admin ${person}`;
    case 'admin.delete':
      return `Removed admin ${person}`;
    case 'admin.reset_password':
      return `Reset password of admin ${person}`;
    case 'region.create':
      return 'Added a region';
    case 'region.update':
      return 'Edited a region';
    case 'region.delete':
      return 'Removed a region';
    case 'settings.update':
      return `Updated system settings${r.entityId ? ` (${label(r.entityId)})` : ''}`;
    default:
      if (r.action?.startsWith('http.')) return `${r.action.slice(5)} request`;
      return label(r.action || 'Change');
  }
}

function fieldsList(changes) {
  const keys = Object.entries(changes || {})
    .filter(([k, v]) => !HIDDEN_FIELDS.has(k) && hasMeaningfulChange(v))
    .map(([k]) => k);
  if (!keys.length) return '';
  const names = keys.slice(0, 3).map(label).join(', ');
  return `: ${names}${keys.length > 3 ? ` and ${keys.length - 3} more` : ''}`;
}

function label(key) {
  if (key === 'roundElapsedMsBeforePause') return 'Round Elapsed Time Before Pause';
  if (key === 'isRoundPaused') return 'Is Round Paused';
  if (key === 'roundPausedAt' || key === 'pauseStartTime') return 'Pause Start Time';
  if (key === 'pauseEndTime') return 'Pause End Time';
  if (key === 'pauseDuration') return 'Total Pause Duration';
  return String(key)
    .replace(/[._]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

function show(v, field = '') {
  if (v === null || v === undefined || v === '') return '—';
  if (field === 'roundElapsedMsBeforePause' && !isNaN(Number(v))) {
    return `${formatDuration(v)} (${Number(v).toLocaleString()} ms)`;
  }
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (Array.isArray(v)) {
    if (v.length === 0) return '—';
    return v.join(', ').slice(0, 120);
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v).filter(([_, val]) => val !== '' && val !== 0 && val !== null && val !== undefined);
    if (entries.length === 0) return '—';
    return JSON.stringify(v).slice(0, 120);
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    }
  }
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

function time(iso) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function groupByDay(items) {
  const out = new Map();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  for (const r of items) {
    const d = new Date(r.occurredAt);
    const k =
      d.toDateString() === today
        ? 'Today'
        : d.toDateString() === yesterday
          ? 'Yesterday'
          : d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(r);
  }
  return [...out.entries()];
}
