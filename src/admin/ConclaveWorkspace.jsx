import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarRange, MapPin, Users } from 'lucide-react';
import { api } from '../services/api';
import { formatConclaveDate } from './conclaveStage';
import { formatStatus, getStatusBadgeClasses } from '../utils/statusUtils';
import GenWarningBanner from './GenWarningBanner';
import Dashboard from '../pages/Dashboard';
import Members from '../pages/Members';
import ScheduleHub from '../pages/ScheduleHub';
import Payments from '../pages/Payments';
import Feedback from '../pages/Feedback';
import Activity from './Activity';

export const CONCLAVE_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'schedule', label: 'Tables & rounds' },
  // Only for conclaves that charge a fee: totals and failed payment attempts.
  { id: 'payments', label: 'Payments', paidOnly: true },
  { id: 'feedback', label: 'Feedback' },
  { id: 'activity', label: 'Activity' },
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
  const [conclave, setConclave] = useState(null);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    let alive = true;
    setError(null);
    const load = () =>
      api
        .get(`/admin/conclaves/${id}`)
        .then((c) => alive && setConclave(c))
        .catch((e) => alive && setError(e?.message || 'Could not load this conclave.'));
    load();
    // Keep the stage and next step current while a conclave runs.
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);

  // Captains are members with a role now: old links open the filtered list.
  if (tab === 'captains') return <Navigate to={`${base}/conclaves/${id}/members?role=captain`} replace />;
  if (!CONCLAVE_TABS.some((t) => t.id === tab)) return <Navigate to={`${base}/conclaves/${id}`} replace />;
  const tabs = CONCLAVE_TABS.filter((t) => !t.paidOnly || !conclave || isPaid(conclave) || tab === t.id);

  const tabPath = (t) => `${base}/conclaves/${id}${t === 'overview' ? '' : `/${t}`}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:gap-3.5">
        <Link to={`${base}/conclaves`} className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors self-start">
          <ArrowLeft className="w-3.5 h-3.5" /> All conclaves
        </Link>

        {error ? (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">{error}</div>
        ) : !conclave ? (
          <div className="h-10 rounded-xl bg-white border border-zinc-200 animate-pulse" />
        ) : (
          /* Sleek compact header */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-0.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight leading-none">
                {conclave.name}
              </h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${getStatusBadgeClasses(conclave.status)}`}>
                {formatStatus(conclave.status)}
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

        <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200 -mx-1 px-1 pt-1.5 sm:pt-2" aria-label="Conclave sections">
          {tabs.map((t) => (
            <NavLink
              key={t.id}
              to={tabPath(t.id)}
              end
              className={() =>
                `px-3.5 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition-smooth ${
                  tab === t.id ? 'border-brand-red text-brand-red' : 'border-transparent text-zinc-500 hover:text-zinc-900'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Each tab is an existing page, pointed at this conclave. */}
      <div key={`${id}:${tab}`} className="pt-0.5">
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
        {tab === 'schedule' && (
          <ScheduleHub selectedConclaveId={id} showGenWarning={showGenWarning} clearGenWarning={clearGenWarning} searchQuery={searchQuery} initialStage="auto" />
        )}
        {tab === 'payments' && <Payments selectedConclaveId={id} embedded />}
        {tab === 'feedback' && <Feedback selectedConclaveId={id} embedded />}
        {tab === 'activity' && <Activity conclaveId={id} embedded />}
      </div>

      {tab === 'schedule' && <GenWarningBanner genWarning={genWarning} onClose={clearGenWarning} />}
    </div>
  );
}
