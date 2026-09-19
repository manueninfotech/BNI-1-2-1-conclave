import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Shield, X, Award, Clock, Footprints } from 'lucide-react';

import ReferModal from '../../components/ReferModal';
import MemberProfileModal from '../../components/MemberProfileModal';
import { calculateRoundTiming, formatTime, ROUND_BLOCK_DURATION_SECS } from '../../utils/roundTiming';
import { formatTimeRangeNice, formatUpcomingRoundRange } from '../../utils/timeFormat';

export default function CaptainTable({ loggedInCaptain, searchQuery, conclaveSyncData: propConclaveSyncData }) {
  const [syncData, setSyncData] = useState(() => {
    if (propConclaveSyncData) return propConclaveSyncData;
    const cached = localStorage.getItem('bni_conclave_sync_data_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
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

  const [selectedRound, setSelectedRound] = useState(() => conclaveSyncData?.conclaveStatus?.currentRound || 1);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [referTarget, setReferTarget] = useState(null);
  const [selectedProfileMember, setSelectedProfileMember] = useState(null);
  const [toast, setToast] = useState(null);

  const roundObj = conclaveSyncData?.mySchedule?.find(s => s.number === selectedRound);
  const currentMembersList = roundObj ? (roundObj.participants || []) : [];

  const personsPerTable = useMemo(() => {
    if (currentMembersList.length > 0) return currentMembersList.length;
    if (conclaveSyncData?.tableOccupants && Array.isArray(conclaveSyncData.tableOccupants) && conclaveSyncData.tableOccupants.length > 0) {
      return conclaveSyncData.tableOccupants.length;
    }
    return conclaveSyncData?.personsPerTable ||
      conclaveSyncData?.conclaveStatus?.personsPerTable ||
      6;
  }, [currentMembersList, conclaveSyncData]);

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
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [conclaveSyncData, personsPerTable]);

  const filteredMembers = currentMembersList.filter(member => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      member.name.toLowerCase().includes(q) ||
      member.company.toLowerCase().includes(q) ||
      member.category.toLowerCase().includes(q)
    );
  });

  const getRoundStatus = (roundNum) => {
    const activeRoundNum = conclaveSyncData?.conclaveStatus?.currentRound || 1;
    if (roundNum < activeRoundNum) return { text: 'Completed', bg: 'bg-emerald-50 border-emerald-100 text-emerald-700' };
    if (roundNum === activeRoundNum) return { text: 'Running', bg: 'bg-red-50 border-red-100 text-brand-red animate-pulse' };
    return { text: 'Upcoming', bg: 'bg-zinc-50 border-zinc-200 text-zinc-555' };
  };

  const currentStatus = getRoundStatus(selectedRound);
  const isCurrentRound = selectedRound === (conclaveSyncData?.conclaveStatus?.currentRound || 1);
  const isTalkingActive = isCurrentRound && Boolean(timingState?.isTalking);
  const isReferralOpen = isCurrentRound && Boolean(timingState?.isReferralOpen);

  return (
    <div className="space-y-6 animate-fade-in font-sans">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <h1 className="text-[20px] font-black text-zinc-955 leading-tight">My Table</h1>
          <p className="text-[11.5px] text-zinc-500 font-semibold mt-0.5">
            View your assigned table and participants for each networking round.
          </p>
        </div>

        <div className="flex gap-2">
          <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border shadow-2xs ${currentStatus.bg}`}>
            {currentStatus.text} (Round {selectedRound})
          </span>
          <span className="bg-zinc-800 text-white px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase shadow-2xs">
            Table {conclaveSyncData?.tableNumber || 'N/A'}
          </span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Table', val: conclaveSyncData?.tableNumber || 'N/A', accent: false },
          { label: 'Captain', val: loggedInCaptain.name.split(' ')[0], accent: false },
          { label: 'Selected Round', val: `Round ${selectedRound}`, accent: true },
          { label: 'Status', val: currentStatus.text, accent: false, isStatus: true },
          { label: 'Participants', val: `${filteredMembers.length} Active`, accent: false },
          { label: 'Table Density', val: `${new Set(filteredMembers.map(m => m.category)).size} Categories`, accent: false }
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
            <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mb-1">{kpi.label}</p>
            {kpi.isStatus ? (
              <div className={`flex items-center gap-1.5 text-[14px] font-black ${selectedRound === (conclaveSyncData?.conclaveStatus?.currentRound || 1) ? 'text-brand-red' : selectedRound < (conclaveSyncData?.conclaveStatus?.currentRound || 1) ? 'text-emerald-600' : 'text-zinc-550'}`}>
                {selectedRound === (conclaveSyncData?.conclaveStatus?.currentRound || 1) && <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse"></span>}
                {kpi.val}
              </div>
            ) : (
              <p className={`font-black text-[14px] leading-tight ${kpi.accent ? 'text-brand-red' : 'text-zinc-800'}`}>
                {kpi.val}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Round Selector Tabs */}
      <div className="bg-zinc-150/80 p-1.5 rounded-xl border border-zinc-200 flex w-full overflow-x-auto gap-2">
        {(conclaveSyncData?.mySchedule || []).map((r) => {
          const isCompleted = r.status === 'Completed';
          const isActive = r.status === 'Active';
          const isSelected = r.number === selectedRound;

          return (
            <button
              key={r.number}
              onClick={() => setSelectedRound(r.number)}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-smooth cursor-pointer ${isSelected
                  ? 'bg-brand-red text-white shadow-md shadow-brand-red/10'
                  : 'text-zinc-555 hover:bg-zinc-200 hover:text-zinc-850 bg-white/50 border border-zinc-200/40'
                }`}
            >
              {isCompleted && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              )}
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse"></span>
              )}
              <span>Round {r.number}</span>
            </button>
          );
        })}
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left Column (Occupancy & Cards) */}
        <div className="lg:col-span-9 space-y-6">
          {/* Table Capacity Card */}
          <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs flex flex-col justify-between">
            {(() => {
              const tableNum = conclaveSyncData?.tableNumber || 'N/A';
              const maxSeats = conclaveSyncData?.personsPerTable || 6;
              const pct = Math.min(100, Math.round((filteredMembers.length / maxSeats) * 100));

              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-black text-zinc-900 text-body-sm">Table {tableNum} Seating Statistics</h3>
                      <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">Statistical breakdown of the currently selected round.</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-brand-red leading-none">
                        {pct}%
                      </span>
                      <p className="text-[10px] text-zinc-400 font-semibold leading-none mt-1">{filteredMembers.length} of {maxSeats} Seats</p>
                    </div>
                  </div>

                  <div className="w-full bg-zinc-50 rounded-full h-2.5 mb-3 overflow-hidden border border-zinc-150">
                    <div
                      className="bg-brand-red h-full rounded-full transition-all duration-700 ease-out shadow-inner"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
                    <span>Optimal Seating: {maxSeats} Members Max</span>
                    <span>Diversity Index: High</span>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Participant Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMembers.length === 0 ? (
              <div className="col-span-full bg-white p-12 text-center border border-zinc-200 rounded-xl">
                <p className="text-[12px] text-zinc-450 font-bold">No members found matching your search query.</p>
              </div>
            ) : (
              filteredMembers.map((member) => {
                const initials = member.name.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() || 'M';
                const bgClass = member.isCaptain 
                  ? 'bg-red-50/90 border-red-100/90 text-brand-red' 
                  : 'bg-zinc-100/90 border-zinc-200/80 text-zinc-700';
                const bniTag = 'BNI';
                return (
                  <div
                    key={member.uid || member.name}
                    onClick={() => setSelectedProfileMember(member)}
                    className="bg-white p-5 rounded-2xl border border-zinc-200/90 hover:border-brand-red/35 shadow-2xs hover:shadow-md flex flex-col justify-between gap-4 transition-all duration-200 cursor-pointer group"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-full bg-red-50 border border-red-100/80 font-black text-xs text-brand-red flex items-center justify-center shrink-0 shadow-2xs select-none">
                        {initials}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex justify-between items-center gap-1.5">
                          <h4 className="text-body-sm font-extrabold text-zinc-950 leading-snug select-text">{member.name}</h4>
                        </div>
                        <div>
                          <span className={`inline-flex items-center text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-md border tracking-wider leading-tight whitespace-normal break-words ${bgClass}`}>
                            {member.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-650 font-bold leading-snug select-text truncate">{member.company}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 flex justify-between items-center text-[10px]">
                      <span className="text-zinc-500 font-extrabold uppercase text-[9px] tracking-wider truncate">{member.chapter || 'BNI Chapter'}</span>
                      <span className="text-brand-red bg-red-50 border border-red-100 px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider">
                        {bniTag}
                      </span>
                    </div>

                    {/* Refer button */}
                    {isReferralOpen ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReferTarget({
                            id: member.uid || member.id || member._originalUid,
                            uid: member.uid || member.id || member._originalUid,
                            name: member.name,
                            company: member.company,
                            category: member.category
                          });
                        }}
                        className="w-full py-2 bg-brand-red hover:bg-red-750 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-brand-red/15 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        Send Referral
                      </button>
                    ) : timingState?.isTalking ? (
                      <button
                        disabled
                        title="Referrals will open during the dedicated Referral Window (after speaking concludes)"
                        className="w-full py-2 border border-zinc-200 text-zinc-400 bg-zinc-100 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-not-allowed"
                      >
                        Referrals Open in {formatTime(timingState?.phaseRemaining)}
                      </button>
                    ) : (
                      <button
                        disabled
                        title="Referrals are closed for this round"
                        className="w-full py-2 border border-zinc-200 text-zinc-400 bg-zinc-100 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-not-allowed"
                      >
                        Referrals Closed
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (Instructions, Timing & Guidelines) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Table Round Moderator & Pace Card */}
          <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
              <h3 className="font-black text-zinc-955 text-body-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-red shrink-0" />
                <span>Round Moderator Pace</span>
              </h3>
              {timingState.phase === 'active' ? (
                <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                  Talking Time
                </span>
              ) : timingState.phase === 'transition' ? (
                <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                  Move to Next Table
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-500 border border-zinc-200">
                  Ready
                </span>
              )}
            </div>

            <div className="bg-zinc-50/70 p-4 rounded-xl border border-zinc-150 text-center">
              <div className="text-[9px] font-black uppercase tracking-widest mb-0.5 text-zinc-450">
                {timingState.phase === 'active'
                  ? 'Talking Time Left'
                  : timingState.phase === 'referral'
                  ? 'Referral Window Left'
                  : timingState.phase === 'transition'
                  ? 'Move to Next Table'
                  : 'Round Session'}
              </div>
              <div className={`text-4xl font-black font-mono tracking-tight ${
                timingState.phase === 'active'
                  ? 'text-emerald-600'
                  : timingState.phase === 'referral'
                  ? 'text-blue-600'
                  : timingState.phase === 'transition'
                  ? 'text-amber-600'
                  : 'text-zinc-800'
              }`}>
                {formatTime(
                  timingState.phase === 'active' || timingState.phase === 'referral' || timingState.phase === 'transition'
                    ? timingState.phaseRemaining
                    : timingState.totalRemaining
                )}
              </div>
              <div className="mt-2.5 pt-2 border-t border-zinc-200/70 flex items-center justify-between text-[10px] px-1">
                <span className="text-zinc-400 font-bold uppercase tracking-wider">Total Round Time</span>
                <span className="font-mono font-black text-zinc-700">{formatTime(timingState.totalRemaining)}</span>
              </div>
            </div>

            {/* Current Speaker Box */}
            {timingState.phase === 'active' && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-lg">
                <div className="flex items-center justify-between text-[9.5px] font-extrabold text-emerald-800">
                  <span>Current Speaker Turn</span>
                  <span>Speaker {timingState.speakerNumber} of {timingState.personsPerTable}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-lg font-black text-emerald-700">{formatTime(timingState.speakerTimeLeft)}</span>
                  <span className="text-[9px] text-emerald-600 font-semibold">60s turn (1 min)</span>
                </div>
                <div className="w-full bg-emerald-200/60 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${(timingState.speakerTimeLeft / timingState.speakerTotalSecs) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Referral Window Box */}
            {timingState.phase === 'referral' && (
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg text-center space-y-1 animate-pulse">
                <div className="flex items-center justify-center gap-1.5 text-blue-900 font-black text-[10.5px]">
                  <span>Referral Exchange Window Open</span>
                </div>
                <p className="text-[10px] text-blue-800 font-semibold leading-tight">
                  Members are actively submitting referrals (30s per member).
                </p>
                <span className="font-mono font-black text-blue-900 text-sm block">
                  {formatTime(timingState.phaseRemaining)} left
                </span>
              </div>
            )}

            {timingState.phase === 'transition' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center space-y-1 animate-pulse">
                <div className="flex items-center justify-center gap-1.5 text-amber-800 font-black text-[10.5px]">
                  <Footprints className="w-3.5 h-3.5" />
                  <span>Discussions &amp; Referrals Ended</span>
                </div>
                <p className="text-[9.5px] text-amber-700 font-semibold leading-tight">
                  Direct attendees to collect their notes and proceed to their assigned Table for Round {selectedRound + 1}.
                </p>
              </div>
            )}

            <div className="text-[9.5px] text-zinc-400 font-bold text-center border-t border-zinc-100 pt-2">
              Formula: {timingState.personsPerTable} seats ({Math.round(timingState.activeSecs / 60)}m talking + {(timingState.referralSecs / 60).toFixed(1)}m referrals + {Math.round(timingState.transitionSecs / 60)}m move)
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs space-y-3.5">
            <h3 className="font-black text-zinc-955 text-body-sm border-b border-zinc-100 pb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-red shrink-0" />
              <span>Captain Directives</span>
            </h3>
            <p className="text-[11px] text-zinc-450 font-semibold leading-relaxed">
              As a Table Captain, you are responsible for monitoring the attendance, timing, and referral exchanges during this round.
            </p>
            <p className="text-[11px] text-zinc-450 font-semibold leading-relaxed">
              If an assigned member fails to check in, flag it immediately to the Conclave Support Desk using the Admin Chat box.
            </p>
          </div>

          {/* Timeline Panel */}
          <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs space-y-5">
            <h3 className="font-black text-zinc-955 text-body-sm border-b border-zinc-100 pb-2">Round Timeline</h3>
            <div className="relative pl-6 flex flex-col gap-5 before:content-[''] before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-zinc-150">
              {(() => {
                const activeRoundNum = conclaveSyncData?.conclaveStatus?.currentRound || 1;
                const isCurrent = selectedRound === activeRoundNum;
                const isPast = selectedRound < activeRoundNum;

                const timelineSteps = [
                  { label: 'Round Started', time: isPast || isCurrent ? 'Session Live' : 'Scheduled', done: isPast, active: isCurrent },
                  { label: 'Current Discussion', time: isCurrent ? 'In progress' : (isPast ? 'Completed' : 'Pending'), done: isPast, active: isCurrent },
                  { label: 'Round Ending', time: isPast ? 'Concluded' : 'Target: End of Session', done: isPast, active: false },
                  { label: 'Next Round', time: selectedRound < (conclaveSyncData?.mySchedule?.length || 6) ? `Round ${selectedRound + 1}` : 'Final Round', done: false, active: false }
                ];

                return timelineSteps.map((step, sIdx) => (
                  <div key={sIdx} className="relative">
                    {step.active ? (
                      <div className="absolute -left-[23.5px] top-1 w-3 h-3 rounded-full bg-brand-red border-2 border-white ring-4 ring-red-100 animate-pulse z-10"></div>
                    ) : (
                      <div className={`absolute -left-[22px] top-1.5 w-2 h-2 rounded-full border border-white z-10 ${step.done ? 'bg-emerald-500' : 'bg-zinc-200'
                        }`}></div>
                    )}
                    <p className={`text-[11.5px] font-bold leading-none ${step.active ? 'text-brand-red font-black' : 'text-zinc-800'}`}>{step.label}</p>
                    <p className="text-[9.5px] text-zinc-400 font-semibold mt-1">{step.time}</p>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Next Round Preview Footer */}
      {(() => {
        const nextRoundNum = selectedRound + 1;
        const nextRoundObj = conclaveSyncData?.mySchedule?.find(s => s.number === nextRoundNum);
        if (!nextRoundObj) return null;
        const nextMembers = nextRoundObj.participants || [];

        return (
          <>
            <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-red-50 p-2.5 rounded-lg border border-red-100 text-brand-red shrink-0 shadow-sm shadow-brand-red/5">
                  <ArrowRight className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[9px] text-zinc-400 font-extrabold uppercase tracking-widest leading-none">Coming Up Next</p>
                  <h4 className="font-extrabold text-zinc-900 text-body-sm leading-tight mt-1.5">Round {nextRoundNum} Migration</h4>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <p className="text-[10px] text-zinc-400 font-semibold leading-none">Expected Members</p>
                  <p className="font-black text-zinc-800 text-[12px] mt-1.5">{nextMembers.length} members</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-zinc-400 font-semibold leading-none">Scheduled Time</p>
                  <p className="font-black text-zinc-800 text-[12px] mt-1.5">{formatUpcomingRoundRange(nextRoundObj.time, 'Next Session')}</p>
                </div>
                <button
                  onClick={() => setShowPreviewModal(true)}
                  className="bg-zinc-900 border border-zinc-800 text-white hover:bg-zinc-850 px-4.5 py-2.5 rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-smooth shadow-sm cursor-pointer"
                >
                  Preview Table List
                </button>
              </div>
            </div>

            {showPreviewModal && createPortal(
              <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in font-sans">
                <div className="bg-white rounded-xl border border-zinc-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="px-5 py-4 border-b border-zinc-150 flex items-center justify-between bg-zinc-50">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-brand-red" />
                      <h3 className="font-black text-zinc-955 text-body-md">Round {nextRoundNum} Table Seating Preview</h3>
                    </div>
                    <button
                      onClick={() => setShowPreviewModal(false)}
                      className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-200/50 transition-smooth cursor-pointer"
                    >
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  <div className="p-5 overflow-y-auto space-y-4">
                    <div className="flex justify-between items-center bg-red-50/50 border border-red-100 p-3 rounded-lg text-[11.5px] font-semibold text-brand-red">
                      <span>Table Number: Table {nextRoundObj.tableNumber || conclaveSyncData?.tableNumber}</span>
                      <span>Expected Occupancy: {nextMembers.length} Seats</span>
                    </div>

                    <div className="space-y-2.5">
                      <span className="text-[9.5px] font-black text-zinc-450 uppercase tracking-wider block">Incoming Members Grid</span>
                      <div className="space-y-2">
                        {nextMembers.map((member, idx) => (
                          <div key={member.uid || member.id || idx} className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-[11.5px]">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-white border border-zinc-200 flex items-center justify-center font-bold text-zinc-500 text-xs shrink-0">
                                {(member.name || 'M').split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-black text-zinc-850 block leading-tight">{member.name}</span>
                                <span className="text-[9.5px] text-zinc-400 font-semibold">{member.company}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 bg-red-50 border border-red-100 text-brand-red text-[8px] font-black rounded uppercase">
                                {member.category}
                              </span>
                            </div>
                          </div>
                        ))}
                        {nextMembers.length === 0 && (
                          <p className="text-zinc-400 text-xs text-center py-4">No member details available for next round.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-t border-zinc-150 flex justify-end bg-zinc-50">
                    <button
                      onClick={() => setShowPreviewModal(false)}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-white rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-smooth cursor-pointer"
                    >
                      Close Preview
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </>
        );
      })()}

      {selectedProfileMember && (
        <MemberProfileModal
          member={selectedProfileMember}
          onClose={() => setSelectedProfileMember(null)}
          isReferralDisabled={!isReferralOpen}
          referralDisabledReason="Referrals are only active during the dedicated Referral Window (after speaking concludes)."
          onSendReferral={isReferralOpen ? (m) => setReferTarget({
            id: m.uid || m.id,
            name: m.name,
            company: m.company,
            category: m.category
          }) : undefined}
        />
      )}

      {referTarget && (
        <ReferModal
          recipient={referTarget}
          loggedInUser={loggedInCaptain}
          activeConclaveId={conclaveSyncData?.conclaveStatus?.id || conclaveSyncData?.conclaveId}
          isReferralOpen={isReferralOpen}
          disabledReason="Referrals are only active during the dedicated Referral Window (after speaking concludes)."
          onClose={() => setReferTarget(null)}
          onSuccess={(msg) => {
            setToast(msg);
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[70] bg-zinc-900 text-white text-[11px] font-bold py-2.5 px-4 rounded-lg shadow-xl flex items-center gap-2 border border-zinc-800 animate-slide-up">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          <div>
            <p className="font-bold text-white">Success!</p>
            <p className="text-zinc-400 mt-0.5">{toast}</p>
          </div>
        </div>
      )}

    </div>
  );
}
