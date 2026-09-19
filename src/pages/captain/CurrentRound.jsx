import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  Users,
  Award,
  Info,
  Check,
  Play,
  X,
  ArrowRight
} from 'lucide-react';
import { formatTimeNice, formatUpcomingRoundStartTime, formatUpcomingRoundRange } from '../../utils/timeFormat';
import { calculateRoundTiming, formatTime, ROUND_BLOCK_DURATION_SECS } from '../../utils/roundTiming';
import MemberProfileModal from '../../components/MemberProfileModal';

export default function CurrentRound({ loggedInCaptain, conclaveSyncData: propConclaveSyncData }) {
  const [syncData, setSyncData] = useState(() => {
    if (propConclaveSyncData) return propConclaveSyncData;
    const cached = localStorage.getItem('bni_conclave_sync_data_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
    }
    return null;
  });

  useEffect(() => {
    if (propConclaveSyncData) {
      setSyncData(propConclaveSyncData);
      localStorage.setItem('bni_conclave_sync_data_cache', JSON.stringify(propConclaveSyncData));
    }
  }, [propConclaveSyncData]);

  const conclaveSyncData = syncData || propConclaveSyncData;

  const initialTime = ROUND_BLOCK_DURATION_SECS; // 900 seconds (15:00)
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProfileMember, setSelectedProfileMember] = useState(null);

  const personsPerTable = useMemo(() => {
    if (conclaveSyncData?.tableOccupants && Array.isArray(conclaveSyncData.tableOccupants) && conclaveSyncData.tableOccupants.length > 0) {
      return conclaveSyncData.tableOccupants.length;
    }
    return conclaveSyncData?.personsPerTable ||
      conclaveSyncData?.conclaveStatus?.personsPerTable ||
      6;
  }, [conclaveSyncData]);

  const [timingState, setTimingState] = useState(() => calculateRoundTiming({
    startedAt: conclaveSyncData?.conclaveStatus?.currentRoundStartedAt,
    personsPerTable,
    isRunning: ['running', 'active'].includes((conclaveSyncData?.conclaveStatus?.status || '').toLowerCase())
  }));

  useEffect(() => {
    const startedAt = conclaveSyncData?.conclaveStatus?.currentRoundStartedAt;
    const status = (conclaveSyncData?.conclaveStatus?.status || '').toLowerCase();
    const isRunning = status === 'running' || status === 'active';

    const updateTimer = () => {
      const timing = calculateRoundTiming({
        startedAt,
        personsPerTable,
        isRunning,
      });
      setTimingState(timing);
      setTimeLeft(timing.totalRemaining);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [conclaveSyncData, personsPerTable]);

  const participants = conclaveSyncData?.tableOccupants || [];
  const categories = [...new Set(participants.map(p => p.category))];
  const conclaveStatus = (conclaveSyncData?.conclaveStatus?.status || '').toLowerCase();
  const isCompleted = conclaveStatus === 'completed';

  if (isCompleted) {
    return (
      <div className="space-y-6 animate-fade-in font-sans">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
          <div className="space-y-1">
            <h1 className="text-[20px] font-black text-zinc-955 leading-tight">Conclave Completed</h1>
            <p className="text-[11.5px] text-zinc-500 font-semibold mt-0.5">This 1-on-1 Conclave session has concluded successfully.</p>
          </div>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-800 font-black text-[10px] uppercase tracking-wider rounded-full border border-emerald-150 flex items-center gap-1.5 shadow-2xs">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            Conclave Concluded
          </span>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center space-y-4 shadow-2xs">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
            <Award className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-zinc-900">All Networking Rounds Complete</h2>
            <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1 leading-relaxed">
              Thank you, <strong className="text-zinc-800">{loggedInCaptain?.name || 'Captain'}</strong>! All scheduled 1-on-1 networking rounds for Table #{conclaveSyncData?.tableNumber || 'N/A'} have been completed.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto pt-4">
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Total Rounds</p>
              <p className="text-lg font-black text-zinc-850 mt-0.5">{conclaveSyncData?.conclaveStatus?.totalRounds || 4} Completed</p>
            </div>
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Table Occupancy</p>
              <p className="text-lg font-black text-zinc-850 mt-0.5">{participants.length} Members</p>
            </div>
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Categories</p>
              <p className="text-lg font-black text-zinc-850 mt-0.5">{categories.length} Represented</p>
            </div>
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Status</p>
              <p className="text-lg font-black text-emerald-600 mt-0.5">Archived</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const conclaveStatusStr = (conclaveSyncData?.conclaveStatus?.status || '').toLowerCase();
  const isConclaveCompleted = conclaveStatusStr === 'completed' || conclaveStatusStr === 'finished' || conclaveStatusStr === 'ended';

  if (isConclaveCompleted) {
    return (
      <div className="space-y-8 animate-fade-in font-sans pb-20">
        <div className="bg-white p-8 md:p-12 pb-12 md:pb-16 rounded-xl border border-zinc-200 text-center shadow-2xs space-y-6 mb-10">
          <Award className="w-14 h-14 text-emerald-500 mx-auto" />
          <div className="space-y-2">
            <h2 className="text-xl font-black text-zinc-900">Conclave Session Completed</h2>
            <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
              The previous conclave session has officially concluded. Live captain round tracking is active only during running conclaves.
            </p>
          </div>
          <div className="pt-2 pb-4">
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-2.5 bg-brand-red hover:bg-red-700 text-white font-extrabold text-xs rounded-lg transition-smooth shadow-sm inline-flex items-center gap-2 cursor-pointer"
            >
              Go to Member Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans">

      {/* Live Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div className="space-y-1">
          <h1 className="text-[20px] font-black text-zinc-955 leading-tight">{isConclaveCompleted ? 'Conclave Completed' : 'Current Round'}</h1>
          <p className="text-[11.5px] text-zinc-500 font-semibold mt-0.5">
            {isConclaveCompleted ? 'This conclave session has officially concluded.' : 'View all information related to the active networking round.'}
          </p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-zinc-100 text-zinc-650 font-black text-[10px] uppercase tracking-wider rounded-full border border-zinc-200 shadow-2xs">
            {isConclaveCompleted ? 'All Rounds Finished' : `Round ${conclaveSyncData?.conclaveStatus?.currentRound || 0}`}
          </span>
          {isConclaveCompleted ? (
            <span className="px-3 py-1 bg-zinc-100 text-zinc-700 font-black text-[10px] uppercase tracking-wider rounded-full border border-zinc-200 flex items-center gap-1.5 shadow-2xs">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Completed
            </span>
          ) : (
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 font-black text-[10px] uppercase tracking-wider rounded-full border border-emerald-150 flex items-center gap-1.5 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Running
            </span>
          )}
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-5 items-start">

        {/* Hero Countdown Ring */}
        <div className="col-span-12 lg:col-span-8 bg-white border border-zinc-200 rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden h-auto md:h-[320px] shadow-2xs">
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#af101a_1px,transparent_1px)] [background-size:16px_16px]"></div>

          <div className="absolute top-4 left-4">
            <span className="text-[11px] font-extrabold text-zinc-550 uppercase tracking-wider flex items-center gap-1.5">
              {isConclaveCompleted ? (
                <><CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> CONCLAVE COMPLETED</>
              ) : (
                <><span className="w-2 h-2 bg-brand-red rounded-full animate-pulse"></span> LIVE ROUND {conclaveSyncData?.conclaveStatus?.currentRound || 0}</>
              )}
            </span>
          </div>

          {/* Left side: Countdown Ring */}
          <div className="flex flex-col items-center shrink-0 pt-6 md:pt-4">
            {/* Phase pill above the circle */}
            <div className="mb-2">
              {timingState.phase === 'active' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Talking Time
                </span>
              ) : timingState.phase === 'transition' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                  Move to Next Table
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-500 border border-zinc-200">
                  Ready
                </span>
              )}
            </div>

            {(() => {
              const phaseTotalSecs = timingState.phase === 'transition'
                ? (timingState.transitionSecs || 1)
                : (timingState.activeSecs || 1);
              const phaseRemainingSecs = (timingState.phase === 'active' || timingState.phase === 'transition')
                ? (timingState.phaseRemaining || 0)
                : timeLeft;
              const phasePercent = Math.max(0, Math.min(100, (phaseRemainingSecs / phaseTotalSecs) * 100));
              const strokeDashoffset = 502.6 * (1 - phasePercent / 100);

              return (
                <div className="relative w-44 h-44 flex items-center justify-center">
                  {/* Countdown circular track */}
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle
                      className="text-zinc-100"
                      cx="88"
                      cy="88"
                      fill="transparent"
                      r="80"
                      stroke="currentColor"
                      strokeWidth="7"
                    />
                    <circle
                      className={`transition-all duration-1000 ${timingState.phase === 'active'
                          ? 'text-emerald-500'
                          : timingState.phase === 'transition'
                            ? 'text-amber-500'
                            : 'text-brand-red'
                        }`}
                      cx="88"
                      cy="88"
                      fill="transparent"
                      r="80"
                      stroke="currentColor"
                      strokeDasharray={502.6}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      strokeWidth="7"
                    />
                  </svg>

                  <div className="text-center z-10 flex flex-col items-center">
                    <span className={`text-4xl font-black tracking-tighter leading-none ${timingState.phase === 'active'
                        ? 'text-emerald-600'
                        : timingState.phase === 'transition'
                          ? 'text-amber-600'
                          : 'text-zinc-955'
                      }`}>
                      {formatTime(
                        timingState.phase === 'active' || timingState.phase === 'transition'
                          ? timingState.phaseRemaining
                          : timeLeft
                      )}
                    </span>
                    <p className="text-[8.5px] text-zinc-450 font-black uppercase tracking-widest mt-1.5">
                      {timingState.phase === 'active'
                        ? 'Talking Time Left'
                        : timingState.phase === 'transition'
                          ? 'Move Table Left'
                          : 'Minutes Left'}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Total time small display */}
            <div className="mt-3 bg-zinc-50 border border-zinc-200 rounded-lg py-1 px-3 text-center shadow-2xs flex items-center justify-between gap-3 min-w-[170px]">
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Total Round Time</span>
              <span className="text-[11.5px] font-mono font-black text-zinc-800">{formatTime(timeLeft)}</span>
            </div>
          </div>

          {/* Right side: Discussion Progress */}
          <div className="flex-1 space-y-4 pt-4 md:pt-0 z-10 w-full">
            <div>
              <h3 className="text-body-md font-black text-zinc-955">Round Discussion Focus</h3>
              <p className="text-[11.5px] leading-relaxed font-semibold text-zinc-500 mt-1">
                Collaborative matchmaking topic: <strong className="text-zinc-800">Identify joint venture opportunities & primary connection needs</strong>.
              </p>
            </div>

            <div className="border-t border-zinc-100 pt-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-black text-zinc-450 uppercase tracking-wider block">Live Speaker Queue</span>
                {timingState?.isTalking && (
                  <span className="text-[9.5px] font-bold text-brand-red flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {formatTime(timingState?.speakerTimeLeft || 60)} turn remaining
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {participants.length > 0 ? (() => {
                  if (timingState?.isReferral) {
                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-150 rounded-lg text-[11px] font-bold text-emerald-900">
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                            <span>All speaker presentations completed</span>
                          </div>
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 rounded px-1.5 py-0.5 uppercase tracking-wider leading-none">Completed</span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-150 rounded-lg text-[11px] font-semibold text-blue-900 animate-pulse">
                          <span>Referral Exchange Window: {formatTime(timingState.phaseRemaining)} left</span>
                          <span className="text-[9px] font-black text-blue-700 bg-blue-100 border border-blue-200 rounded px-1.5 py-0.5 uppercase tracking-wider leading-none">30s / Member</span>
                        </div>
                      </div>
                    );
                  }

                  if (timingState?.isTransition) {
                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-150 rounded-lg text-[11px] font-bold text-emerald-900">
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                            <span>All speaker presentations completed</span>
                          </div>
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 rounded px-1.5 py-0.5 uppercase tracking-wider leading-none">Completed</span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-blue-50/70 border border-blue-150 rounded-lg text-[11px] font-semibold text-blue-900">
                          <span>Transition time: move to assigned next table</span>
                          <span className="text-[9px] font-black text-blue-700 bg-blue-100 border border-blue-200 rounded px-1.5 py-0.5 uppercase tracking-wider leading-none">Moving Table</span>
                        </div>
                      </div>
                    );
                  }

                  const activeIdx = Math.min(
                    Math.max(0, timingState?.speakerIndex ?? 0),
                    participants.length - 1
                  );
                  const currentSpeaker = participants[activeIdx];
                  const upNext = participants.filter((_, idx) => idx > activeIdx);

                  return (
                    <>
                      {currentSpeaker && (
                        <div className="flex items-center justify-between p-2 bg-red-50/50 border border-red-100 rounded-lg text-[11px] font-bold animate-pulse">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-brand-red shrink-0"></span>
                            <span className="text-zinc-955 font-black truncate">
                              {currentSpeaker.name} ({currentSpeaker.category || 'Member'})
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] font-black text-brand-red bg-red-50 border border-red-100 rounded px-1.5 py-0.5 uppercase tracking-wider leading-none">
                              Speaking ({activeIdx + 1}/{participants.length})
                            </span>
                          </div>
                        </div>
                      )}

                      {upNext.length > 0 ? (
                        <div className="flex items-center justify-between p-2 bg-zinc-50 border border-zinc-150 rounded-lg text-[11px] font-bold text-zinc-500">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 shrink-0"></span>
                            <span className="truncate">{upNext.map(p => p.name).join(', ')}</span>
                          </div>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase leading-none shrink-0">Up Next</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2 bg-zinc-50 border border-zinc-150 rounded-lg text-[11px] font-bold text-zinc-400">
                          <span>Last speaker of current round</span>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase leading-none">Final Turn</span>
                        </div>
                      )}
                    </>
                  );
                })() : (
                  <p className="text-[11px] text-zinc-400 font-semibold p-2">No table occupants assigned for this round.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Round Overview Card */}
        <div className="col-span-12 lg:col-span-4 bg-white border border-zinc-200 rounded-xl p-5 flex flex-col justify-between shadow-2xs h-[320px]">
          <div className="space-y-3.5">
            <h3 className="text-body-sm font-black text-zinc-900">Round Overview</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-zinc-100">
                <span className="text-zinc-450 font-semibold">Progress</span>
                <span className="font-extrabold text-zinc-800">
                  {conclaveSyncData?.conclaveStatus?.currentRound || 0} of {conclaveSyncData?.mySchedule?.length || 6} Rounds
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-zinc-100">
                <span className="text-zinc-450 font-semibold">Assigned Table</span>
                <span className="font-extrabold text-zinc-800">Table {conclaveSyncData?.tableNumber || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-zinc-100">
                <span className="text-zinc-450 font-semibold">Round Status</span>
                <span className="px-2 py-0.5 bg-red-50 border border-red-100 text-brand-red text-[9px] font-black rounded uppercase">Running</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-zinc-450 font-semibold">Captain</span>
                <span className="font-extrabold text-zinc-800">{loggedInCaptain.name}</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50/75 border border-blue-100 rounded-lg text-blue-800 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[10px] font-semibold leading-relaxed">
              Please ensure all members are logged in before the timer hits 00:00.
            </p>
          </div>
        </div>

        {/* Current Table Summary */}
        <div className="col-span-12 bg-white border border-zinc-200 rounded-xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-brand-red rounded-lg flex items-center justify-center text-white font-black text-sm shadow-md shadow-brand-red/10">
              T{conclaveSyncData?.tableNumber || 'N/A'}
            </div>
            <div>
              <h2 className="font-black text-zinc-900 text-body-sm">Table #{conclaveSyncData?.tableNumber || 'N/A'} Networking Cluster</h2>
              <p className="text-xs text-zinc-450 font-semibold mt-0.5">
                Table Captain: <span className="text-zinc-800 font-extrabold">{loggedInCaptain.name}</span> • {participants.length} Occupancy
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <span key={cat} className="px-2.5 py-1 bg-zinc-50 border border-zinc-200/60 rounded-full text-[9.5px] font-black text-zinc-500 uppercase tracking-wide">
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Current Participants Grid */}
        <div className="col-span-12 lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5 items-start">
          {participants.map((p) => {
            const initials = p.name.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() || 'M';
            return (
              <div
                key={p.uid || p.name}
                onClick={() => setSelectedProfileMember(p)}
                className="group relative bg-white p-5 rounded-2xl border border-zinc-200/90 hover:border-brand-red/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3.5 cursor-pointer"
              >
                {/* Top row: Avatar + Name & Company + Captain badge */}
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-linear-to-br from-red-50 to-red-100/70 border border-red-200/70 text-brand-red font-black text-xs flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform select-none">
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <h4 className="text-body-sm font-black text-zinc-900 group-hover:text-brand-red transition-colors truncate">
                        {p.name}
                      </h4>
                      {p.isCaptain && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-red-50 text-brand-red border border-red-200/80">
                          Captain
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 font-semibold truncate mt-0.5">
                      {p.company || 'Business Member'}
                    </p>
                  </div>
                </div>

                {/* Middle row: Category pill + Chapter */}
                <div className="space-y-1.5">
                  <div>
                    <span className="inline-flex items-center text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-md border border-zinc-200/80 bg-zinc-50 text-zinc-700 tracking-wider leading-tight">
                      {p.category || 'BNI Member'}
                    </span>
                  </div>

                  {p.chapter && (
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider truncate">
                      {p.chapter}
                    </p>
                  )}
                </div>

                {/* Bottom row: Details / Profile link */}
                <div className="pt-2.5 border-t border-zinc-100 flex items-center justify-between text-xs">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    {p.isCaptain ? 'Table Anchor' : 'Active Seating'}
                  </span>

                  <span className="text-[9.5px] font-black uppercase tracking-wider text-zinc-400 group-hover:text-brand-red transition-colors flex items-center gap-1">
                    View Profile <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            );
          })}
          {participants.length === 0 && (
            <p className="col-span-full p-8 text-center text-zinc-400 text-caption font-semibold">No participants registered at this table.</p>
          )}
        </div>

        {/* Sidebar Column */}
        <div className="col-span-12 lg:col-span-3 space-y-5">

          {/* Next Round Preview */}
          <div className="bg-zinc-900 border border-zinc-800 text-white rounded-xl p-5 shadow-md flex flex-col justify-between h-[215px]">
            <div>
              {(() => {
                const currentRoundNum = conclaveSyncData?.conclaveStatus?.currentRound || 1;
                const nextRoundObj = conclaveSyncData?.mySchedule?.find(s => s.number === currentRoundNum + 1);
                if (nextRoundObj) {
                  return (
                    <>
                      <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Up Next: Round {nextRoundObj.number}</p>
                      <h3 className="text-lg font-black text-white mt-1 leading-tight">{nextRoundObj.table} Cluster</h3>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2 text-zinc-300 text-xs">
                          <Users className="w-3.5 h-3.5 text-brand-red" />
                          <span>{nextRoundObj.participants?.length || 0} Expected Members</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-300 text-xs">
                          <Clock className="w-3.5 h-3.5 text-brand-red animate-pulse" />
                          <span>Starts at {formatUpcomingRoundStartTime(nextRoundObj.time)}</span>
                        </div>
                      </div>
                    </>
                  );
                } else {
                  return (
                    <p className="text-zinc-400 text-caption font-semibold">No upcoming rounds scheduled.</p>
                  );
                }
              })()}
            </div>

            <button
              onClick={() => setShowDetailsModal(true)}
              className="w-full mt-4 py-2 bg-white/10 hover:bg-white/20 hover:text-white transition-smooth border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-wider text-zinc-200 cursor-pointer"
            >
              View Round Details
            </button>
          </div>
        </div>

        {/* Live Progress Timeline */}
        <div className="col-span-12 bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-zinc-955 text-body-sm">Conclave Timeline</h3>
            <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
              Round {conclaveSyncData?.conclaveStatus?.currentRound || 1} of {conclaveSyncData?.mySchedule?.length || 6}
            </span>
          </div>

          <div className="relative py-4 px-3">
            {(() => {
              const currentRoundNum = conclaveSyncData?.conclaveStatus?.currentRound || 1;
              const totalRounds = conclaveSyncData?.mySchedule?.length || conclaveSyncData?.conclaveStatus?.totalRounds || 6;
              const timelinePercent = totalRounds > 1
                ? Math.min(100, Math.max(0, Math.round(((currentRoundNum - 1) / (totalRounds - 1)) * 100)))
                : 0;

              return (
                <>
                  {/* Horizontal Track Background Line */}
                  <div className="absolute top-[32px] left-6 right-6 h-0.5 bg-zinc-100 rounded-full z-0"></div>

                  {/* Horizontal Active Track Progress Line */}
                  <div
                    className="absolute top-[32px] left-6 h-0.5 bg-brand-red rounded-full z-0 transition-all duration-500"
                    style={{ width: `calc(${timelinePercent}% * 0.92)` }}
                  ></div>

                  {/* Steps Container */}
                  <div className="relative flex justify-between items-start z-10">
                    {Array.from({ length: totalRounds }, (_, i) => i + 1).map((rNum) => {
                      const isPast = rNum < currentRoundNum;
                      const isCurrent = rNum === currentRoundNum;

                      return (
                        <div key={rNum} className="flex flex-col items-center text-center">
                          {isPast ? (
                            <div className="relative w-8 h-8 rounded-full bg-brand-red text-white flex items-center justify-center z-10 shadow-xs border-2 border-white">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          ) : isCurrent ? (
                            <div className="relative w-9 h-9 -mt-0.5 flex items-center justify-center">
                              <div className="absolute -inset-1 rounded-full bg-red-100/60 animate-pulse z-0"></div>
                              <div className="relative w-9 h-9 rounded-full bg-brand-red text-white flex items-center justify-center z-10 shadow-md shadow-brand-red/25 border-2 border-white">
                                <Play className="w-4 h-4 fill-current ml-0.5 animate-pulse" />
                              </div>
                            </div>
                          ) : (
                            <div className="relative w-8 h-8 rounded-full bg-white border border-zinc-200 text-zinc-350 flex items-center justify-center z-10 text-[10.5px] font-extrabold shadow-xs select-none">
                              {rNum}
                            </div>
                          )}
                          <span
                            className={`text-[9.5px] uppercase tracking-wider mt-2.5 ${isCurrent
                                ? 'font-black text-brand-red'
                                : isPast
                                  ? 'font-extrabold text-zinc-800'
                                  : 'font-bold text-zinc-400'
                              }`}
                          >
                            Round {rNum}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Slide-Up / Overlay Modal for View Round Details */}
      {showDetailsModal && createPortal(
        (() => {
          const currentRoundNum = conclaveSyncData?.conclaveStatus?.currentRound || 1;
          const targetRound = conclaveSyncData?.mySchedule?.find(s => s.number === currentRoundNum + 1) ||
            conclaveSyncData?.mySchedule?.find(s => s.number === currentRoundNum) ||
            null;

          const targetParticipants = targetRound?.participants || [];

          return (
            <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in font-sans">
              <div className="bg-white rounded-xl border border-zinc-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-5 py-4 border-b border-zinc-150 flex items-center justify-between bg-zinc-50">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-brand-red" />
                    <h3 className="font-black text-zinc-955 text-body-md">
                      {targetRound ? `Round ${targetRound.number} Seating & Schedule` : 'Round Details'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-200/50 transition-smooth cursor-pointer"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                <div className="p-5 overflow-y-auto space-y-4">
                  {/* Round Meta info */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                      <span className="text-[9px] font-extrabold uppercase text-zinc-400 block tracking-wider">Assigned Table</span>
                      <span className="text-body-sm font-black text-zinc-900 mt-0.5 block">{targetRound?.table || 'Table TBD'}</span>
                    </div>
                    <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                      <span className="text-[9px] font-extrabold uppercase text-zinc-400 block tracking-wider">Scheduled Time</span>
                      <span className="text-body-sm font-black text-zinc-900 mt-0.5 block">
                        {formatUpcomingRoundStartTime(targetRound?.time) || 'Upcoming'}
                      </span>
                    </div>
                  </div>

                  {/* Expected Participants */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-zinc-450 uppercase tracking-wider block">
                      Expected Table Members ({targetParticipants.length})
                    </span>
                    {targetParticipants.length > 0 ? (
                      <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-lg overflow-hidden bg-white max-h-48 overflow-y-auto">
                        {targetParticipants.map((p, idx) => (
                          <div key={p.id || p.uid || idx} className="p-2.5 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-zinc-900">{p.name}</p>
                              <p className="text-[11px] text-zinc-500 font-medium">{p.category || p.company || 'BNI Member'}</p>
                            </div>
                            {p.isCaptain && (
                              <span className="px-2 py-0.5 bg-red-50 text-brand-red border border-red-100 rounded text-[9px] font-black uppercase tracking-wider">
                                Table Captain
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 font-semibold p-3 bg-zinc-50 rounded-lg border border-zinc-200 text-center">
                        No member roster generated yet for this round.
                      </p>
                    )}
                  </div>

                  {/* Format details */}
                  <div className="space-y-2.5 pt-1">
                    <span className="text-[9.5px] font-black text-zinc-450 uppercase tracking-wider block">Format & Timings</span>
                    <div className="space-y-2 text-[11.5px] font-semibold text-zinc-650">
                      <div className="flex justify-between items-center py-1.5 border-b border-zinc-100">
                        <span>Total Round Duration</span>
                        <span className="font-extrabold text-zinc-800">15 Minutes</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-zinc-100">
                        <span>Pitch Window</span>
                        <span className="font-extrabold text-zinc-800 font-mono">1.5 Mins (90s) / Speaker</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-zinc-100">
                        <span>Table Transition</span>
                        <span className="font-extrabold text-zinc-800">Remaining window to rotate</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-zinc-150 flex justify-end bg-zinc-50">
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-white rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-smooth cursor-pointer"
                  >
                    Close Details
                  </button>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* Member Profile Modal */}
      {selectedProfileMember && (
        <MemberProfileModal
          member={selectedProfileMember}
          onClose={() => setSelectedProfileMember(null)}
        />
      )}

    </div>
  );
}
