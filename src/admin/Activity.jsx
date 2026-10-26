import React, { useCallback, useEffect, useState } from 'react';
import { History, RefreshCw, ChevronDown } from 'lucide-react';
import { api } from '../services/api';

/**
 * Who changed what, newest first. Reads the backend's audit trail through
 * /admin/activity (region-scoped for admins; everything for superadmins).
 * With `conclaveId`, shows one conclave's activity.
 */
export default function Activity({ conclaveId, embedded = false }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(
    async (from) => {
      setLoading(true);
      try {
        const q = new URLSearchParams({ limit: '50' });
        if (conclaveId) q.set('conclaveId', conclaveId);
        if (from) q.set('cursor', from);
        const res = await api.get(`/admin/activity?${q}`);
        setItems((prev) => (from ? [...prev, ...(res.items || [])] : res.items || []));
        setCursor(res.nextCursor || null);
        setError(null);
      } catch (e) {
        setError(e?.message || 'Could not load activity.');
      } finally {
        setLoading(false);
      }
    },
    [conclaveId],
  );

  useEffect(() => { load(null); }, [load]);

  const groups = groupByDay(items);

  return (
    <div className={`space-y-5 ${embedded ? '' : 'max-w-4xl mx-auto w-full'}`}>
      {!embedded && (
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Activity</h1>
            <p className="text-sm text-zinc-500 mt-1">Every change made in the app and this panel: who, what and when.</p>
          </div>
        </header>
      )}
      <div className="flex justify-end">
        <button
          onClick={() => load(null)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-semibold">{error}</div>}

      {!loading && items.length === 0 && !error && (
        <div className="rounded-xl bg-white border border-zinc-200 p-10 text-center">
          <History className="w-7 h-7 text-zinc-300 mx-auto" />
          <p className="mt-2 font-bold text-zinc-800">Nothing recorded yet</p>
          <p className="text-sm text-zinc-500">Changes will appear here as people use the app and this panel.</p>
        </div>
      )}

      {groups.map(([day, rows]) => (
        <section key={day}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">{day}</h2>
          <ul className="rounded-xl bg-white border border-zinc-200 divide-y divide-zinc-100">
            {rows.map((r) => {
              const changes = r.changes ? Object.entries(r.changes).filter(([k]) => !HIDDEN_FIELDS.has(k)) : [];
              const expandable = changes.length > 0 || r.ip;
              const isOpen = open === r.id;
              return (
                <li key={r.id} className="px-4 sm:px-5 py-3">
                  <button
                    type="button"
                    onClick={() => expandable && setOpen(isOpen ? null : r.id)}
                    className={`w-full flex items-start gap-3 text-left ${expandable ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="text-xs font-semibold text-zinc-400 w-12 shrink-0 pt-0.5">{time(r.occurredAt)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="text-sm text-zinc-900">{describe(r, !conclaveId)}</span>
                      <span className="block text-xs text-zinc-500 mt-0.5">
                        {who(r)}
                        {r.source && SOURCE[r.source] && r.kind !== 'system' ? ` · ${SOURCE[r.source]}` : ''}
                        {r.outcome === 'failure' ? ' · failed' : ''}
                      </span>
                    </span>
                    {expandable && <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                  </button>
                  {isOpen && (
                    <div className="mt-2 pl-15 space-y-1">
                      {changes.map(([field, v]) => (
                        <p key={field} className="text-xs text-zinc-600 break-words">
                          <span className="font-semibold text-zinc-800">{label(field)}:</span> {show(v?.from)} → {show(v?.to)}
                        </p>
                      ))}
                      {r.ip && <p className="text-xs text-zinc-400">From {r.ip}{r.userAgent ? ` · ${r.userAgent.slice(0, 80)}` : ''}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {cursor && (
        <div className="text-center">
          <button
            onClick={() => load(cursor)}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Show older'}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Wording ------------------------------------------------------------------

const SOURCE = { mobile_app: 'mobile app', admin_panel: 'admin panel', webhook: 'payment provider', system: 'automatic', script: 'maintenance script' };
const HIDDEN_FIELDS = new Set(['updatedAt', 'createdAt', 'legacy', 'schedule', 'participants', 'snapshot', 'scheduleSummary', 'warnings']);

export function who(r) {
  if (r.kind === 'system' || r.actor?.role === 'system') return 'Automatic';
  return r.actor?.name || (r.actor?.role ? r.actor.role : 'Someone');
}

export function describe(r, withConclave) {
  // The member the change is about; for a member's own action, that's them.
  const self = r.subject?.uid && r.subject.uid === r.actor?.uid;
  const person = r.subject?.name || (['member', 'captain'].includes(r.actor?.role) ? r.actor?.name : null) || 'a member';
  const conclave = r.conclave?.name;
  const inC = withConclave && conclave ? ` in ${conclave}` : '';
  const onC = withConclave && conclave ? ` for ${conclave}` : '';
  const toC = withConclave && conclave ? ` to ${conclave}` : '';
  const fromC = withConclave && conclave ? ` from ${conclave}` : '';
  const c = conclave ? conclave : 'a conclave';
  const ch = r.changes || {};
  switch (r.action) {
    case 'conclave.create': return `Created ${c}`;
    case 'conclave.update': return `Edited ${c}${fieldsList(ch)}`;
    case 'conclave.delete': return `Deleted ${c}`;
    case 'conclave.cancel': return `Cancelled ${c}`;
    case 'conclave.complete': return `Marked ${c} as finished`;
    case 'conclave.auto_complete': return `${c} finished automatically`;
    case 'conclave.status_autofix': return `Corrected the status of ${c}`;
    case 'conclave.lock_schedule': return `Locked the tables${onC}`;
    case 'conclave.start': return `Started round ${r.metadata?.roundNumber ?? ch.currentRound?.to ?? ''}${inC}`.replace('  ', ' ');
    case 'conclave.set_member_permission':
      return ch.allowAdminAddMembers?.to ? `Allowed admins to add members${toC}` : `Stopped admins adding members${toC}`;
    case 'round.pause': return `Paused the round${inC}`;
    case 'round.resume': return `Resumed the round${inC}`;
    case 'schedule.generate': return `Generated the tables${onC}`;
    case 'registration.create': return `${person} registered${onC}`;
    case 'registration.withdraw': return `${person} withdrew${fromC}`;
    case 'registration.admin_add': return `Added ${person}${toC}`;
    case 'registration.admin_update': return `Edited ${person}'s registration${inC}${fieldsList(ch)}`;
    case 'registration.admin_remove': return `Removed ${person}${fromC}`;
    case 'registration.set_role': return `Made ${person} ${ch.role?.to === 'captain' ? 'a captain' : 'a member'}${inC}`;
    case 'attendance.sync': return `${person} checked in${inC}`;
    case 'referral.create': return `${person} gave a referral${inC}`;
    case 'referral.outcome': case 'referral.status': return `Updated a referral${inC}`;
    case 'one_to_one.create': return `${person} logged a one-to-one`;
    case 'user.update': return self ? `${person} updated their profile${fieldsList(ch)}` : `Updated ${person}'s profile${fieldsList(ch)}`;
    case 'user.photo_set': return `${person} changed their photo`;
    case 'user.photo_remove': return `${person} removed their photo`;
    case 'user.set_role': return `Changed ${person}'s role`;
    case 'user.reset_link': return `Created a password reset link for ${person}`;
    case 'user.delete_self': return `${person} deleted their account`;
    case 'admin.create': return `Added admin ${person}`;
    case 'admin.update': case 'admin.update_self': return `Updated admin ${person}`;
    case 'admin.delete': return `Removed admin ${person}`;
    case 'admin.reset_password': return `Reset the password of admin ${person}`;
    case 'region.create': return 'Added a region';
    case 'region.update': return 'Edited a region';
    case 'region.delete': return 'Removed a region';
    case 'settings.update': return `Changed settings${r.entityId ? ` (${label(r.entityId)})` : ''}`;
    default:
      if (r.action?.startsWith('http.')) return `${r.action.slice(5)} request`;
      return label(r.action || 'Change');
  }
}

function fieldsList(changes) {
  const keys = Object.keys(changes || {}).filter((k) => !HIDDEN_FIELDS.has(k));
  if (!keys.length) return '';
  const names = keys.slice(0, 3).map(label).join(', ');
  return `: ${names}${keys.length > 3 ? ` and ${keys.length - 3} more` : ''}`;
}

function label(key) {
  return String(key)
    .replace(/[._]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

function show(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 120);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
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
    const k = d.toDateString() === today ? 'Today' : d.toDateString() === yesterday ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(r);
  }
  return [...out.entries()];
}
