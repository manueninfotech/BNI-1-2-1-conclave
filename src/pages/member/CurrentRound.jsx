import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  TrendingUp,
  Award,
  Check,
  FileText,
  Footprints,
  Clock,
  Users
} from 'lucide-react';

import ReferModal from '../../components/ReferModal';
import MemberProfileModal from '../../components/MemberProfileModal';
import { downloadOrViewAgendaDocument, parseAgendaTextToSteps, extractTextFromPdfDataUrl } from '../../utils/documentUtils';
import { calculateRoundTiming, formatTime, ROUND_BLOCK_DURATION_SECS } from '../../utils/roundTiming';

export default function MemberCurrentRound({ loggedInMember, onTabChange, conclaveSyncData: propConclaveSyncData, searchQuery }) {
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

  const [referTarget, setReferTarget] = useState(null);
  const [selectedProfileMember, setSelectedProfileMember] = useState(null);
  const [toast, setToast] = useState(null);

  const filteredOccupants = useMemo(() => {
    const list = conclaveSyncData?.tableOccupants || [];
    if (!searchQuery || !searchQuery.trim()) return list;
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/);
    return list.filter(m => {
      const text = `${m.name || ''} ${m.company || ''} ${m.category || ''} ${m.chapter || ''}`.toLowerCase();
      return tokens.every(token => text.includes(token));
    });
  }, [conclaveSyncData?.tableOccupants, searchQuery]);
  
  const initialTime = ROUND_BLOCK_DURATION_SECS; // 900 seconds (15:00)
  const [timeLeft, setTimeLeft] = useState(initialTime);

  const personsPerTable = useMemo(() => {
    return conclaveSyncData?.personsPerTable ||
      conclaveSyncData?.conclaveStatus?.personsPerTable ||
      conclaveSyncData?.tableOccupants?.length ||
      6;
  }, [conclaveSyncData]);

  const [timingState, setTimingState] = useState(() => calculateRoundTiming({
    startedAt: conclaveSyncData?.conclaveStatus?.currentRoundStartedAt,
    personsPerTable,
    isRunning: ['running', 'active'].includes((conclaveSyncData?.conclaveStatus?.status || '').toLowerCase())
  }));

  const [referrals, setReferrals] = useState(() => {
    const stored = localStorage.getItem('bni_referrals');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem('bni_referrals');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setReferrals(prev => (JSON.stringify(prev) !== JSON.stringify(parsed) ? parsed : prev));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const getMemberReferralCount = (name, uid) => {
    const targetName = (name || '').toLowerCase();
    const targetUid = uid || (conclaveSyncData?.tableOccupants || []).find(o => o.name?.toLowerCase() === targetName)?.uid;

    const allRefs = [
      ...referrals,
      ...(conclaveSyncData?.newReferralsReceived || []).map(r => ({
        fromUserId: r.fromUserId,
        fromMemberId: r.fromUserId,
        fromName: r.giverName,
        toUserId: conclaveSyncData?.userUid,
        toMemberId: conclaveSyncData?.userUid
      }))
    ];

    const given = allRefs.filter(r => 
      (targetUid && (r.fromMemberId === targetUid || r.fromUserId === targetUid)) ||
      (targetName && r.fromName && r.fromName.toLowerCase() === targetName) ||
      (targetName && r.giverName && r.giverName.toLowerCase() === targetName)
    ).length;

    const received = allRefs.filter(r => 
      (targetUid && (r.toMemberId === targetUid || r.toUserId === targetUid)) ||
      (targetName && r.toName && r.toName.toLowerCase() === targetName)
    ).length;

    return { given, received };
  };

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

  const radius = 88;
  const circumference = radius * 2 * Math.PI;
  const progressPercent = (timeLeft / initialTime) * 100;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  const activeConclaveId = conclaveSyncData?.conclaveId || conclaveSyncData?.id || conclaveSyncData?.conclaveStatus?.id;
  const uploadedAgendaDoc = useMemo(() => {
    if (conclaveSyncData?.agendaDocument) return conclaveSyncData.agendaDocument;
    if (conclaveSyncData?.conclave?.agendaDocument) return conclaveSyncData.conclave.agendaDocument;
    if (activeConclaveId) {
      const cached = localStorage.getItem(`bni_agenda_doc_${activeConclaveId}`);
      if (cached) {
        try { return JSON.parse(cached); } catch (e) {}
      }
    }
    const genericCache = localStorage.getItem('bni_conclave_agenda_doc');
    if (genericCache) {
      try { return JSON.parse(genericCache); } catch (e) {}
    }
    return null;
  }, [conclaveSyncData, activeConclaveId]);

  const getAgendaSteps = (seconds) => {
    // 1. Check for raw uploaded agenda text or extract directly from PDF dataUrl
    let rawAgendaText = uploadedAgendaDoc?.rawText || uploadedAgendaDoc?.agendaText;
    if (!rawAgendaText && uploadedAgendaDoc?.dataUrl) {
      rawAgendaText = extractTextFromPdfDataUrl(uploadedAgendaDoc.dataUrl);
    }

    if (!rawAgendaText) {
      rawAgendaText = conclaveSyncData?.agendaText ||
        conclaveSyncData?.conclave?.agendaText ||
        (activeConclaveId ? localStorage.getItem(`bni_agenda_text_${activeConclaveId}`) : null);
    }

    if (!rawAgendaText && !uploadedAgendaDoc) {
      rawAgendaText = localStorage.getItem('bni_conclave_agenda_text');
    }

    if (rawAgendaText) {
      const parsed = parseAgendaTextToSteps(rawAgendaText);
      if (parsed.length > 0) {
        return parsed.map((s, idx) => ({
          ...s,
          isCurrent: idx === 0 ? seconds > 450 : idx === 1 ? (seconds <= 450 && seconds > 150) : seconds <= 150
        }));
      }
    }

    // 2. Check for custom steps array
    const customSteps = conclaveSyncData?.agendaSteps || conclaveSyncData?.conclave?.agendaSteps || uploadedAgendaDoc?.steps;
    if (Array.isArray(customSteps) && customSteps.length > 0) {
      return customSteps.map((s, idx) => ({
        time: s.time || s.duration || `Step ${idx + 1}`,
        title: s.title || s.name || `Agenda Item ${idx + 1}`,
        desc: s.desc || s.description || s.summary || '',
        isCurrent: s.isCurrent ?? (idx === 0 ? seconds > 450 : idx === 1 ? (seconds <= 450 && seconds > 150) : seconds <= 150)
      }));
    }

    // Return empty array if no explicit text/steps are uploaded by admin
    return [];
  };

  const agendaSteps = getAgendaSteps(timeLeft || 0);

  const conclaveStatusStr = (conclaveSyncData?.conclaveStatus?.status || '').toLowerCase();
  const isConclaveCompleted = conclaveStatusStr === 'completed' || conclaveStatusStr === 'finished' || conclaveStatusStr === 'ended';

  if (isConclaveCompleted || !conclaveSyncData || !conclaveSyncData?.tableOccupants || conclaveSyncData?.tableOccupants.length === 0) {
    return (
      <div className="space-y-8 animate-fade-in font-sans pb-16">
        <div>
          <h1 className="text-[20px] font-black text-zinc-955 leading-tight">Live Conclave Session</h1>
          <p className="text-[11.5px] text-zinc-500 font-semibold mt-0.5">Real-time table assignment &amp; 1-on-1 networking round overview.</p>
        </div>

        <div className="bg-white p-8 md:p-12 rounded-xl border border-zinc-200 text-center shadow-2xs space-y-4">
          <TrendingUp className="w-12 h-12 text-zinc-300 mx-auto" />
          <div>
            <h3 className="text-lg font-black text-zinc-800">No Active Conclave Round Running</h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1 leading-relaxed">
              There is currently no live networking round active for your account. When a conclave is running and you are registered, your current round table assignment and 1-on-1 table members will appear here!
            </p>
          </div>
          <button
            onClick={() => onTabChange && onTabChange('registrations')}
            className="px-6 py-2.5 bg-brand-red hover:bg-red-700 text-white font-extrabold text-xs rounded-lg transition-smooth shadow-sm inline-flex items-center gap-2 cursor-pointer"
          >
            Explore &amp; Register Conclaves
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in font-sans pb-16">

      {/* Live Round Hero Section */}
      <section>
        <div className="bg-white border border-zinc-200 rounded-xl shadow-2xs overflow-hidden flex flex-col lg:flex-row">

          {/* Hero Left Content Area */}
          <div className="p-6 md:p-8 lg:w-2/3 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 bg-red-50 border border-red-100 text-brand-red font-black text-[9.5px] rounded-full flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-red"></span>
                  LIVE NOW
                </span>
                <span className="text-zinc-450 font-extrabold text-[9px] uppercase tracking-widest">
                  Networking Conclave 2026
                </span>
              </div>
              <h1 className="text-[20px] font-black text-zinc-955 leading-tight">
                Round {conclaveSyncData?.conclaveStatus?.currentRound || 0} of {conclaveSyncData?.mySchedule?.length || 6}
              </h1>

              {/* Stepper Progress Bar */}
              <div className="flex items-center w-full max-w-xl pt-2">
                {(conclaveSyncData?.mySchedule || []).map((r, idx) => {
                  const isCompleted = r.status === 'Completed';
                  const isActive = r.status === 'Active';
                  return (
                    <React.Fragment key={r.number}>
                      {idx > 0 && (
                        <div className={`h-0.5 flex-1 mb-4 ${isCompleted ? 'bg-emerald-500' : isActive ? 'bg-brand-red' : 'bg-zinc-200'}`}></div>
                      )}
                      <div className={`flex flex-col items-center flex-1 ${!isCompleted && !isActive ? 'opacity-45' : ''}`}>
                        {isCompleted ? (
                          <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10.5px] shadow-sm select-none">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : isActive ? (
                          <div className="w-9 h-9 rounded-full bg-brand-red text-white flex items-center justify-center font-black text-[12px] shadow-md ring-4 ring-brand-red/10 select-none">
                            {r.number}
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full border border-zinc-300 bg-zinc-50 text-zinc-450 flex items-center justify-center font-bold text-[11px] select-none">
                            {r.number}
                          </div>
                        )}
                        <span className={`text-[9.5px] mt-1 uppercase tracking-wide ${isActive ? 'font-black text-brand-red' : 'font-extrabold text-zinc-400'}`}>
                          {isActive ? 'Active' : `R${r.number}`}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Session Stats grid footer */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-4">
              <div>
                <p className="text-[9.5px] font-black text-zinc-400 uppercase tracking-widest">Assigned Table</p>
                <p className="font-black text-zinc-900 text-body-lg mt-0.5">Table {conclaveSyncData?.tableNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[9.5px] font-black text-zinc-400 uppercase tracking-widest">Session Captain</p>
                <p className="font-black text-zinc-900 text-body-lg mt-0.5">{conclaveSyncData?.captainName || 'Unknown'}</p>
              </div>
              <div className="col-span-2 md:col-span-1">
                <p className="text-[9.5px] font-black text-zinc-400 uppercase tracking-widest">Location</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-4.5 h-4.5 text-brand-red shrink-0" />
                  <p className="font-black text-zinc-900 text-body-lg truncate">{conclaveSyncData?.conclaveStatus?.venue || 'TBD Venue'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Countdown Timer Area */}
          <div className="p-8 lg:w-1/3 bg-zinc-50 flex flex-col items-center justify-center text-center select-none">
            {/* Phase Pill Header */}
            <div className="mb-3">
              {timingState.phase === 'active' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Talking Time
                </span>
              ) : timingState.phase === 'transition' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs animate-pulse">
                  <Footprints className="w-3.5 h-3.5 text-amber-600" />
                  Move to Next Table
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-500 border border-zinc-200">
                  15-Min Round
                </span>
              )}
            </div>

            <div className="relative mb-5">
              <svg className="w-48 h-48">
                <circle
                  className="text-zinc-200"
                  cx="96"
                  cy="96"
                  fill="transparent"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                ></circle>
                <circle
                  className={`progress-ring__circle transition-all duration-700 ${
                    timingState.phase === 'active'
                      ? 'text-emerald-500'
                      : timingState.phase === 'transition'
                      ? 'text-amber-500'
                      : 'text-brand-red'
                  }`}
                  cx="96"
                  cy="96"
                  fill="transparent"
                  r={radius}
                  stroke="currentColor"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  strokeWidth="8"
                ></circle>
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-zinc-950 tracking-tighter leading-none">
                  {formatTime(timeLeft)}
                </span>
                <span className="text-[9.5px] text-zinc-450 font-black uppercase tracking-widest mt-1">
                  {timingState.phase === 'active'
                    ? `${formatTime(timingState.phaseRemaining)} talking left`
                    : timingState.phase === 'transition'
                    ? `${formatTime(timingState.phaseRemaining)} move left`
                    : 'Minutes left'}
                </span>
              </div>
            </div>

            <div className="w-full max-w-[210px]">
              <div className="flex justify-between text-[9px] font-black text-zinc-450 mb-1.5">
                <span>ROUND PROGRESS</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden border border-zinc-200/40">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    timingState.phase === 'active'
                      ? 'bg-emerald-500'
                      : timingState.phase === 'transition'
                      ? 'bg-amber-500'
                      : 'bg-brand-red'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>

              {/* Dynamic Turn & Transition Subtitle */}
              {timingState.phase === 'active' && (
                <div className="mt-3 flex items-center justify-center gap-1 text-[9.5px] font-black text-emerald-800 bg-white border border-emerald-150 px-2.5 py-1 rounded-md shadow-2xs">
                  <span>Speaker {timingState.speakerNumber} of {timingState.personsPerTable}</span>
                  <span className="text-emerald-300">•</span>
                  <span className="font-bold">{formatTime(timingState.speakerTimeLeft)} in 90s slot</span>
                </div>
              )}

              {timingState.phase === 'transition' && (
                <div className="mt-3 flex items-center justify-center gap-1.5 text-[9.5px] font-black text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md shadow-2xs animate-pulse">
                  <Footprints className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Talking time over · Please move tables</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* Bento Grid Layout (Strategy Circle & Agenda) */}
      <div className="grid grid-cols-12 gap-6 items-start">

        {/* Left Column: Group List & Agenda (Takes 8 cols) */}
        <div className="col-span-12 lg:col-span-8 space-y-6">

          {/* Strategy Circle Members */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-2xs p-6 space-y-4">
            <div className="flex justify-between items-end border-b border-zinc-100 pb-3">
              <div>
                <h2 className="text-body-md font-black text-zinc-900 leading-tight">Your Networking Group</h2>
                <p className="text-[11px] text-zinc-450 font-semibold mt-0.5">Table {conclaveSyncData?.tableNumber || 'N/A'} Strategy Circle</p>
              </div>
              <span className="px-2 py-0.5 bg-zinc-50 border border-zinc-250/60 text-zinc-550 text-[10px] font-black rounded uppercase tracking-wider">
                {conclaveSyncData?.tableOccupants?.length || 0} Members
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredOccupants.map((member) => {
                const initials = member.name.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() || 'M';
                return (
                  <div
                    key={member.uid}
                    onClick={() => setSelectedProfileMember(member)}
                    className="p-4 border border-zinc-200/90 hover:border-brand-red/35 rounded-2xl transition-all duration-200 group bg-white flex flex-col justify-between gap-3 shadow-2xs hover:shadow-md cursor-pointer"
                  >
                    {/* Card Details */}
                    <div className="space-y-2.5">
                      {/* Top Header: Avatar + Name + Company */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100/80 text-brand-red font-black text-xs flex items-center justify-center shrink-0 shadow-2xs select-none">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[13px] font-extrabold text-zinc-950 leading-snug select-text truncate">
                            {member.name}
                          </h3>
                          <p className="text-[11px] text-zinc-500 font-semibold leading-tight select-text truncate mt-0.5">
                            {member.company || 'Business Member'}
                          </p>
                        </div>
                      </div>

                      {/* Category Badge Pill */}
                      <div>
                        <span className="inline-flex items-center text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-md border border-zinc-200/80 bg-zinc-100/90 text-zinc-700 tracking-wider leading-tight whitespace-normal break-words">
                          {member.category}
                        </span>
                      </div>

                      {/* Chapter Label */}
                      {member.chapter && (
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider truncate">
                          {member.chapter}
                        </p>
                      )}

                      {/* Metrics Line */}
                      <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-bold text-zinc-400">
                        <span>Sent: <span className="text-zinc-800 font-extrabold">{getMemberReferralCount(member.name, member.uid).given}</span></span>
                        <span className="text-zinc-300">•</span>
                        <span>Recv: <span className="text-zinc-800 font-extrabold">{getMemberReferralCount(member.name, member.uid).received}</span></span>
                      </div>
                    </div>

                    {/* Refer button */}
                    {member.uid !== (loggedInMember?.uid || loggedInMember?.id) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReferTarget({
                            id: member.uid,
                            name: member.name,
                            company: member.company,
                            category: member.category
                          });
                        }}
                        className="w-full py-1.5 border border-zinc-200 group-hover:border-brand-red text-zinc-700 group-hover:text-white bg-zinc-50 group-hover:bg-brand-red rounded-xl text-[9.5px] font-black uppercase tracking-wider transition-all shadow-2xs cursor-pointer"
                      >
                        Send Referral
                      </button>
                    )}
                  </div>
                );
              })}
              {(!conclaveSyncData?.tableOccupants || conclaveSyncData.tableOccupants.length === 0) && (
                <p className="col-span-3 p-8 text-center text-zinc-400 text-caption font-semibold">No members seated at your table in this round.</p>
              )}
            </div>
          </div>

          {/* What to do in the round: Agenda (rendered ONLY if admin uploaded document or dynamic steps exist) */}
          {(uploadedAgendaDoc || agendaSteps.length > 0) && (
            <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xs p-6 space-y-4">
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${agendaSteps.length > 0 ? 'border-b border-zinc-100 pb-4' : ''}`}>
                <div>
                  <h2 className="text-body-md font-black text-zinc-900 leading-tight">Conclave Agenda &amp; Document</h2>
                  <p className="text-[11px] text-zinc-500 font-semibold mt-0.5">
                    {uploadedAgendaDoc
                      ? `Official Admin Published Document (${uploadedAgendaDoc.name})`
                      : 'Official Conclave Program Schedule'}
                  </p>
                </div>

                {uploadedAgendaDoc && (
                  <button
                    onClick={() => downloadOrViewAgendaDocument(uploadedAgendaDoc)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-brand-red text-brand-red hover:text-white border border-red-200/80 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-2xs shrink-0"
                    title="View or Download Admin Published Agenda"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View Admin Agenda PDF
                  </button>
                )}
              </div>

              {agendaSteps.length > 0 && (
                <div className="relative border-l border-zinc-200 pl-4 ml-2.5 space-y-6 pt-1">
                  {agendaSteps.map((step, idx) => (
                    <div key={idx} className="relative group">
                      {/* Bullet timeline circle */}
                      <span className={`absolute -left-6.5 top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${step.completed
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : idx === 0
                            ? 'bg-brand-red border-brand-red text-white'
                            : 'bg-white border-zinc-300'
                        }`}>
                        {step.completed ? (
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        ) : (
                          <span className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-white animate-pulse' : 'bg-transparent'}`}></span>
                        )}
                      </span>

                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none ${step.completed
                              ? 'bg-emerald-50 text-emerald-700'
                              : idx === 0
                                ? 'bg-red-50 text-brand-red animate-pulse'
                                : 'bg-zinc-100 text-zinc-450'
                            }`}>
                            {step.time}
                          </span>
                          <h4 className="text-[12.5px] font-black text-zinc-800 leading-tight">
                            {step.title}
                          </h4>
                        </div>
                        {step.desc && (
                          <p className="text-[11.5px] text-zinc-500 font-semibold leading-relaxed pt-1.5">
                            {step.desc}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}



        </div>        {/* Right Column: Captain detail & Next Round preview (Takes 4 cols) */}
        <aside className="col-span-12 lg:col-span-4 space-y-6">

          {/* Captain Detail Card */}
          {(() => {
            const captainName = conclaveSyncData?.captainName || 'Table Captain';
            const captainObj = conclaveSyncData?.tableOccupants?.find(o => o.isCaptain);
            const captainInitials = captainName.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() || 'TC';
            const captainCategory = captainObj?.category || 'Table Captain';

            return (
              <div className="bg-white border border-zinc-200 rounded-xl shadow-2xs overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-center font-bold text-sm text-zinc-600 shrink-0 shadow-inner select-none">
                      {captainInitials}
                    </div>
                    <span className="px-2 py-0.5 bg-brand-red text-white text-[8px] font-black rounded uppercase tracking-wider">
                      CAPTAIN
                    </span>
                  </div>
                  <h2 className="text-body-md font-black text-zinc-900 leading-tight">{captainName}</h2>
                  <p className="text-[11.5px] text-brand-red font-black uppercase mt-1">{captainCategory}</p>
                  <p className="text-[11px] text-zinc-450 italic font-semibold mt-3.5 leading-relaxed">
                    "Anchoring Table {conclaveSyncData?.tableNumber || 'N/A'} for Round {conclaveSyncData?.conclaveStatus?.currentRound || 1}."
                  </p>
                  <div className="flex items-center gap-4 text-zinc-450 font-extrabold text-[9px] uppercase tracking-wider pt-5 mt-4 border-t border-zinc-100">
                    <div className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-zinc-455" />
                      <span>Table Anchor</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-zinc-455" />
                      <span>Verified</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Next Round Preview Card */}
          {(() => {
            const currentR = conclaveSyncData?.conclaveStatus?.currentRound || 1;
            const nextRoundObj = conclaveSyncData?.mySchedule?.find(s => s.number === currentR + 1);

            if (!nextRoundObj) {
              return (
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-2xs text-center">
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">SESSION STATUS</span>
                  <p className="text-xs font-bold text-zinc-700">Final Round In Progress</p>
                </div>
              );
            }

            const nextCapName = nextRoundObj.captain || 'Upcoming Captain';
            const nextCapInitials = nextCapName.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() || 'TC';

            return (
              <div className="bg-white border border-zinc-200 rounded-xl shadow-2xs overflow-hidden">
                <div className="p-4 bg-zinc-50 border-b border-zinc-200/80 flex justify-between items-center">
                  <span className="text-[9px] font-black text-zinc-450 uppercase tracking-widest">UP NEXT</span>
                  <span className="text-[9.5px] font-bold text-zinc-450 tracking-tight">{nextRoundObj.time}</span>
                </div>

                <div className="p-5">
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="w-10 h-10 bg-red-50/50 rounded-full flex items-center justify-center text-brand-red border border-red-100 font-black text-body-sm shrink-0">
                      {nextRoundObj.tableNumber}
                    </div>
                    <div>
                      <h3 className="text-[12.5px] font-black text-zinc-900 leading-snug">Round {nextRoundObj.number} Seating: {nextRoundObj.table}</h3>
                      <p className="text-[10px] text-zinc-450 font-semibold mt-0.5">{nextRoundObj.participants?.length || 0} co-attendees</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-200/60 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center font-bold text-[10px] text-zinc-500 shrink-0 shadow-inner select-none">
                      {nextCapInitials}
                    </div>
                    <div>
                      <p className="text-[8px] text-zinc-400 font-extrabold uppercase tracking-widest">Upcoming Captain</p>
                      <p className="text-[12px] font-black text-zinc-900 mt-0.5 leading-none">{nextCapName}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Business Diversity Summary tags */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3.5 shadow-2xs">
            <h3 className="text-[9.5px] font-black text-zinc-450 uppercase tracking-widest block">
              Table Business Diversity
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {Array.from(new Set((conclaveSyncData?.tableOccupants || []).map(o => o.category).filter(Boolean))).map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 bg-white border border-zinc-200/80 rounded-full text-[10.5px] text-zinc-650 font-bold flex items-center gap-1.5 shadow-2xs hover:border-brand-red/35 transition-smooth"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-red"></span>
                  {tag}
                </span>
              ))}
              {(!conclaveSyncData?.tableOccupants || conclaveSyncData.tableOccupants.length === 0) && (
                <span className="text-[11px] text-zinc-400 font-semibold">No category data</span>
              )}
            </div>
          </div>

        </aside>
      </div>

      {selectedProfileMember && (
        <MemberProfileModal
          member={selectedProfileMember}
          onClose={() => setSelectedProfileMember(null)}
          onSendReferral={(m) => setReferTarget({
            id: m.uid || m.id,
            name: m.name,
            company: m.company,
            category: m.category
          })}
        />
      )}

      {referTarget && (
        <ReferModal
          recipient={referTarget}
          loggedInUser={loggedInMember || { name: memberName }}
          activeConclaveId={conclaveSyncData?.conclaveStatus?.id || conclaveSyncData?.conclaveId || conclaveSyncData?.id}
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
