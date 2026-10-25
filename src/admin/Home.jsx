import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, MapPin, Users, ArrowRight, Plus } from 'lucide-react';
import { useConclaves } from './useConclaves';
import { nextStep, pickCurrentConclave, stageOf, stageLabel, formatConclaveDate } from './conclaveStage';
import StageSteps from './StageSteps';

/**
 * Home: what needs attention. The current conclave (live, else the next one,
 * else the latest) with its stage and next step; the rest underneath.
 */
export default function Home({ base, loggedInAdmin }) {
  const { conclaves, loading, error } = useConclaves();
  const current = pickCurrentConclave(conclaves);
  const others = conclaves.filter((c) => c.id !== current?.id);
  const upcoming = others.filter((c) => !['done', 'cancelled'].includes(stageOf(c)));
  const past = others.filter((c) => ['done', 'cancelled'].includes(stageOf(c)));
  const firstName = (loggedInAdmin?.name || '').split(' ')[0];

  return (
    <div className="max-w-5xl mx-auto w-full space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight">{firstName ? `Hello, ${firstName}` : 'Home'}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {loggedInAdmin?.role === 'superadmin' ? 'All regions' : loggedInAdmin?.region || 'Your region'}
          </p>
        </div>
        <Link
          to={`${base}/conclaves?create=1`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-red text-white text-sm font-bold hover:bg-red-700 shadow-sm"
        >
          <Plus className="w-4 h-4" /> New conclave
        </Link>
      </header>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-semibold">{error}</div>}

      {loading ? (
        <div className="h-48 rounded-2xl bg-white border border-zinc-200 animate-pulse" />
      ) : !current ? (
        <div className="rounded-2xl bg-white border border-zinc-200 p-10 text-center">
          <CalendarRange className="w-8 h-8 text-zinc-300 mx-auto" />
          <h2 className="mt-3 font-bold text-zinc-800">No conclaves yet</h2>
          <p className="text-sm text-zinc-500 mt-1">Create your first conclave to get started.</p>
        </div>
      ) : (
        <CurrentCard c={current} base={base} />
      )}

      {upcoming.length > 0 && <ConclaveList title="Coming up" items={upcoming} base={base} />}
      {past.length > 0 && <ConclaveList title="Past" items={past} base={base} />}
    </div>
  );
}

function CurrentCard({ c, base }) {
  const step = nextStep(c);
  const stage = stageOf(c);
  return (
    <section className="rounded-2xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
      <div className="p-6 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-red">
              {stage === 'live' ? 'Live now' : stage === 'done' ? 'Most recent' : 'Next conclave'}
            </p>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 mt-1 break-words">{c.name}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-zinc-500">
              <span className="inline-flex items-center gap-1.5"><CalendarRange className="w-4 h-4" />{formatConclaveDate(c)}</span>
              {c.venueLocation && <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{c.venueLocation}</span>}
              <span className="inline-flex items-center gap-1.5"><Users className="w-4 h-4" />{c.registrationCount ?? 0} registered</span>
            </div>
          </div>
          <Link to={`${base}/conclaves/${c.id}`} className="text-sm font-bold text-zinc-700 hover:text-brand-red">
            Open conclave →
          </Link>
        </div>
        <StageSteps conclave={c} />
      </div>
      <div className="px-6 sm:px-7 py-4 bg-zinc-50 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-800">{step.text}</p>
        {step.tab && (
          <Link
            to={`${base}/conclaves/${c.id}/${step.tab}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800"
          >
            {step.action} <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </section>
  );
}

function ConclaveList({ title, items, base }) {
  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">{title}</h3>
      <div className="rounded-xl bg-white border border-zinc-200 divide-y divide-zinc-100">
        {items.map((c) => (
          <Link
            key={c.id}
            to={`${base}/conclaves/${c.id}`}
            className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 hover:bg-zinc-50"
          >
            <div className="min-w-0">
              <p className="font-bold text-zinc-900 truncate">{c.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {formatConclaveDate(c)} · {c.registrationCount ?? 0} registered{c.region ? ` · ${c.region}` : ''}
              </p>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{stageLabel(c)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
