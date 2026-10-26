import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarRange, MapPin, Users } from 'lucide-react';
import { api } from '../services/api';
import { nextStep, formatConclaveDate } from './conclaveStage';
import StageSteps from './StageSteps';
import GenWarningBanner from './GenWarningBanner';
import Dashboard from '../pages/Dashboard';
import Members from '../pages/Members';
import Captains from '../pages/Captains';
import ScheduleHub from '../pages/ScheduleHub';
import Payments from '../pages/Payments';
import Feedback from '../pages/Feedback';

export const CONCLAVE_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'captains', label: 'Captains' },
  { id: 'schedule', label: 'Tables & rounds' },
  { id: 'payments', label: 'Payments' },
  { id: 'feedback', label: 'Feedback' },
];

/**
 * Everything about one conclave, in one place: who is coming, the tables,
 * the live rounds, payments and feedback. The URL names the conclave and the
 * tab (/admin/conclaves/:id/members), so links and the back button work.
 */
export default function ConclaveWorkspace({ base, loggedInAdmin, searchQuery }) {
  const { id, tab = 'overview' } = useParams();
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

  if (!CONCLAVE_TABS.some((t) => t.id === tab)) return <Navigate to={`${base}/conclaves/${id}`} replace />;

  const step = conclave ? nextStep(conclave) : null;
  const tabPath = (t) => `${base}/conclaves/${id}${t === 'overview' ? '' : `/${t}`}`;

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <Link to={`${base}/conclaves`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="w-4 h-4" /> All conclaves
        </Link>

        {error ? (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-semibold">{error}</div>
        ) : !conclave ? (
          <div className="h-24 rounded-xl bg-white border border-zinc-200 animate-pulse" />
        ) : (
          <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm">
            <div className="p-5 sm:p-6 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight break-words">{conclave.name}</h1>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-zinc-500">
                  <span className="inline-flex items-center gap-1.5"><CalendarRange className="w-4 h-4" />{formatConclaveDate(conclave)}</span>
                  {conclave.venueLocation && <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{conclave.venueLocation}</span>}
                  {conclave.region && <span className="inline-flex items-center gap-1.5"><Users className="w-4 h-4" />{conclave.region}</span>}
                </div>
              </div>
              <StageSteps conclave={conclave} />
            </div>
            {step && (
              <div className="px-5 sm:px-6 py-3 bg-zinc-50 border-t border-zinc-100 rounded-b-2xl flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-zinc-800">{step.text}</p>
                {step.tab && step.tab !== tab && (
                  <Link to={tabPath(step.tab)} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-red hover:text-red-700">
                    {step.action} <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200 -mx-1 px-1" aria-label="Conclave sections">
          {CONCLAVE_TABS.map((t) => (
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
      <div key={`${id}:${tab}`}>
        {tab === 'overview' && <Dashboard selectedConclaveId={id} loggedInAdmin={loggedInAdmin} embedded />}
        {tab === 'members' && <Members selectedConclaveId={id} loggedInAdmin={loggedInAdmin} searchQuery={searchQuery} allowedScopes={["conclave"]} />}
        {tab === 'captains' && <Captains selectedConclaveId={id} loggedInAdmin={loggedInAdmin} searchQuery={searchQuery} allowedScopes={["conclave"]} />}
        {tab === 'schedule' && (
          <ScheduleHub selectedConclaveId={id} showGenWarning={showGenWarning} clearGenWarning={clearGenWarning} searchQuery={searchQuery} initialStage="auto" />
        )}
        {tab === 'payments' && <Payments selectedConclaveId={id} />}
        {tab === 'feedback' && <Feedback selectedConclaveId={id} />}
      </div>

      {tab === 'schedule' && <GenWarningBanner genWarning={genWarning} onClose={clearGenWarning} />}
    </div>
  );
}
