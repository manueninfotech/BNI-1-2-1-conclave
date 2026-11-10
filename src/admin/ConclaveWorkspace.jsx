import React, { useRef, useState, useMemo } from 'react';
import { Link, NavLink, Navigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CalendarRange,
  MapPin,
  Users,
  Home,
  CalendarDays,
  Play,
  MessageSquare,
  Activity as ActivityIcon,
  Coins
} from 'lucide-react';
import { api } from '../services/api';
import { useConclave } from '../hooks/useConclave';
import { useConclaveLive } from '../hooks/useConclaveLive';
import { formatConclaveDate } from './conclaveStage';
import { formatStatus, getStatusBadgeClasses, getStatusDotClasses } from '../utils/statusUtils';
import GenWarningBanner from './GenWarningBanner';
import Dashboard from '../pages/Dashboard';
import Members from '../pages/Members';
import ScheduleGen from '../pages/ScheduleGen';
import RoundRunner from '../pages/RoundRunner';
import Payments from '../pages/Payments';
import Feedback from '../pages/Feedback';
import Activity from './Activity';

export const CONCLAVE_TABS = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'schedule-gen', label: 'Schedule Generation', icon: CalendarDays },
  { id: 'round-runner', label: 'Round Runner', icon: Play },
  // Only for conclaves that charge a fee: totals and failed payment attempts.
  { id: 'payments', label: 'Payments', paidOnly: true, icon: Coins },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'activity', label: 'Activity', icon: ActivityIcon },
];

const isPaid = (c) => Number(c?.registrationFee ?? c?.paymentDetails?.registrationFee) > 0;

/**
 * Everything about one conclave, in one place: who is coming, the tables,
 * the live rounds, payments and feedback. The URL names the conclave and the
 * tab (/admin/conclaves/:id/members), so links and the back button work.
 */
export default function ConclaveWorkspace({ base, loggedInAdmin, searchQuery }) {
  const { id, tab = 'overview' } = useParams();
  const [params] = useSearchParams();

  // Unified conclave server state via TanStack React Query
  const { data: conclave = null, error: conclaveError } = useConclave(id);
  const error = conclaveError?.message || null;

  // Mount real-time SSE listener at workspace level so ALL sub-tabs inherit real-time updates!
  useConclaveLive(id);

  // Schedule generation warnings outlive the generator's re-renders.
  const [genWarning, setGenWarning] = useState(null);
  const timer = useRef(null);
  const showGenWarning = (w) => {
    clearTimeout(timer.current);
    setGenWarning(w);
    timer.current = setTimeout(() => setGenWarning(null), 30000);
  };
  const clearGenWarning = () => {
    clearTimeout(timer.current);
    setGenWarning(null);
  };

  // Captains are members with a role now: old links open the filtered list.
  if (tab === 'captains') return <Navigate to={`${base}/conclaves/${id}/members?role=captain`} replace />;
  if (tab === 'schedule') return <Navigate to={`${base}/conclaves/${id}/schedule-gen`} replace />;
  const isValidTab = CONCLAVE_TABS.some((t) => t.id === tab) || tab === 'payments';
  if (!isValidTab) return <Navigate to={`${base}/conclaves/${id}/schedule-gen`} replace />;
  const tabs = CONCLAVE_TABS.filter((t) => !t.paidOnly || !conclave || isPaid(conclave) || tab === t.id);

  const tabPath = (t) => `${base}/conclaves/${id}${t === 'overview' ? '' : `/${t}`}`;

  const userInitials = useMemo(() => {
    const name = loggedInAdmin?.name || conclave?.coordinator || 'Super Admin';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'SV';
  }, [loggedInAdmin, conclave]);

  return (
    <div className="conclave-workspace flex flex-col gap-1.5 sm:gap-2">
      <div className="flex flex-col gap-2 sm:gap-2.5">
        {error ? (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">{error}</div>
        ) : !conclave ? (
          <div className="h-10 rounded-xl bg-white border border-zinc-200 animate-pulse" />
        ) : (
          /* Sleek compact header matching exact design */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-0.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight leading-none">
                {conclave.name}
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${getStatusBadgeClasses(conclave)}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotClasses(conclave)}`} />
                {formatStatus(conclave)}
              </span>
              <span className="text-zinc-300 hidden sm:inline">·</span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarRange className="w-3.5 h-3.5 text-zinc-400" />
                  {formatConclaveDate(conclave)}
                </span>
                {conclave.venueLocation && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                    {conclave.venueLocation}
                  </span>
                )}
                {conclave.region && (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    {conclave.region}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 pb-1">
          <nav className="flex items-center gap-1.5 overflow-x-auto py-0.5 -mx-1 px-1" aria-label="Conclave sections">
            {tabs.map((t) => {
              const isTabActive = tab === t.id;
              const Icon = t.icon;
              return (
                <NavLink
                  key={t.id}
                  to={tabPath(t.id)}
                  end
                  className={() =>
                    `inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-smooth whitespace-nowrap cursor-pointer ${
                      isTabActive
                        ? 'bg-brand-red text-white shadow-2xs font-extrabold'
                        : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                    }`
                  }
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  <span>{t.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <div id="conclave-tab-controls" className="flex items-center justify-end gap-2 shrink-0 empty:hidden" />
        </div>
      </div>

      {/* Each tab is an existing page, pointed at this conclave. */}
      <div key={`${id}:${tab}`} className="pt-0">
        {tab === 'overview' && <Dashboard selectedConclaveId={id} loggedInAdmin={loggedInAdmin} embedded />}
        {tab === 'members' && (
          <Members
            selectedConclaveId={id}
            loggedInAdmin={loggedInAdmin}
            searchQuery={searchQuery}
            allowedScopes={['conclave']}
            initialRoleFilter={params.get('role') === 'captain' ? 'Captain' : 'All'}
            embedded
          />
        )}
        {tab === 'schedule-gen' && (
          <ScheduleGen
            selectedConclaveId={id}
            showGenWarning={showGenWarning}
            clearGenWarning={clearGenWarning}
            onNavigateToRunner={() => {
              const role = localStorage.getItem('bni_user_role') || 'admin';
              window.location.href = `/${role}/conclaves/${id}/round-runner`;
            }}
            isHubMode={true}
          />
        )}
        {tab === 'round-runner' && (
          <RoundRunner
            selectedConclaveId={id}
            onNavigateToSchedule={() => {
              const role = localStorage.getItem('bni_user_role') || 'admin';
              window.location.href = `/${role}/conclaves/${id}/schedule-gen`;
            }}
            isHubMode={true}
          />
        )}
        {tab === 'payments' && <Payments selectedConclaveId={id} embedded />}
        {tab === 'feedback' && <Feedback selectedConclaveId={id} embedded />}
        {tab === 'activity' && <Activity conclaveId={id} embedded />}
      </div>

      {(tab === 'schedule-gen' || tab === 'round-runner') && (
        <GenWarningBanner genWarning={genWarning} onClose={clearGenWarning} />
      )}
    </div>
  );
}
