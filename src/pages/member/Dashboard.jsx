import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Users,
  Layers,
  Info,
  Calendar,
  CheckCircle,
  ArrowRight,
  Activity,
  Building2
} from 'lucide-react';

import ReferModal from '../../components/ReferModal';
import MemberProfileModal from '../../components/MemberProfileModal';

import { api } from '../../services/api';
import { calculateRoundTiming, formatTime, ROUND_BLOCK_DURATION_SECS } from '../../utils/roundTiming';
import { formatUpcomingRoundStartTime } from '../../utils/timeFormat';

const formatTimeNice = (val, fallback = '') => {
  if (!val) return fallback;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const mins = match[2];
      let meridian = match[3] ? match[3].toUpperCase() : null;
      if (!meridian) {
        meridian = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
      }
      return `${String(hours).padStart(2, '0')}:${mins} ${meridian}`;
    }
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  return String(val);
};

export default function MemberDashboard({ loggedInMember, onTabChange, conclaveSyncData: propConclaveSyncData, searchQuery, memberConclaves: propMemberConclaves }) {
  const [conclavesList, setConclavesList] = useState(() => propMemberConclaves || []);

  useEffect(() => {
    async function loadConclaves() {
      try {
        const list = await api.get('/conclaves');
        if (Array.isArray(list)) {
          setConclavesList(list);
        }
      } catch (err) {}
    }
    loadConclaves();
  }, []);

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
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  // Derive check-in status from conclaveSyncData tableOccupants
  useEffect(() => {
    if (conclaveSyncData?.tableOccupants && Array.isArray(conclaveSyncData.tableOccupants)) {
      const myUid = loggedInMember?.id || loggedInMember?.uid || loggedInMember?._originalUid;
      const myEmail = (loggedInMember?.email || '').toLowerCase();
      const me = conclaveSyncData.tableOccupants.find(o => 
        (myUid && (o.uid === myUid || o.id === myUid)) ||
        (myEmail && (o.uid === myEmail || (o.email && o.email.toLowerCase() === myEmail)))
      );
      if (me && me.isPresent) {
        setIsCheckedIn(true);
      }
    }
  }, [conclaveSyncData?.tableOccupants, loggedInMember]);

  const handleSelfCheckIn = async () => {
    const activeConclaveId = conclaveSyncData?.conclaveStatus?.id || conclaveSyncData?.conclaveId;
    const myUid = loggedInMember?.id || loggedInMember?.uid || loggedInMember?._originalUid;
    const currentRound = conclaveSyncData?.conclaveStatus?.currentRound || 1;

    if (!activeConclaveId || !myUid) return;

    try {
      await api.post(`/conclaves/${activeConclaveId}/sync`, {
        attendance: [{
          id: `att_r${currentRound}_${myUid}`,
          userId: myUid,
          roundNumber: currentRound,
          tableNumber: conclaveSyncData?.tableNumber || 1,
          isPresent: true,
          markedBy: myUid,
          timestamp: new Date().toISOString()
        }]
      });
      setIsCheckedIn(true);
      setToast({ title: 'Attendance Confirmed', desc: `Presence recorded in database for Round ${currentRound}.` });
      setTimeout(() => setToast(null), 3000);
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.warn("Self check-in failed:", err.message);
    }
  };

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

  const memberName = loggedInMember?.name || 'Member';
  const memberChapter = loggedInMember?.chapter || 'N/A';
  const memberCompany = loggedInMember?.company || 'N/A';
  const memberCategory = loggedInMember?.category || 'N/A';

  const conclaveStatusStr = (conclaveSyncData?.conclaveStatus?.status || '').toLowerCase();
  const isConclaveCompleted = conclaveStatusStr === 'completed' || conclaveStatusStr === 'finished';
  const hasActiveConclave = !isConclaveCompleted && Boolean(
    conclaveSyncData?.conclaveStatus?.id ||
    conclaveSyncData?.tableNumber ||
    (conclaveSyncData?.conclaveStatus?.currentRound && conclaveSyncData.conclaveStatus.currentRound > 0) ||
    ['running', 'active'].includes(conclaveStatusStr)
  );

  const [isSyncLoading, setIsSyncLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSyncLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!conclaveSyncData && isSyncLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-zinc-500">Loading your conclave schedule...</p>
        </div>
      </div>
    );
  }



  if (isConclaveCompleted || !conclaveSyncData) {
    const listToFilter = conclavesList.length > 0 ? conclavesList : (propMemberConclaves || []);
    const upcomingConclaves = listToFilter.filter(c => {
      const s = (c.status || '').toLowerCase();
      return s !== 'completed' && s !== 'finished' && s !== 'ended' && s !== 'running' && s !== 'active';
    });

    const myUid = loggedInMember?.uid || loggedInMember?.id;
    const myName = (loggedInMember?.name || '').toLowerCase();
    const allRefs = [
      ...referrals,
      ...(conclaveSyncData?.newReferralsReceived || []).map(r => ({
        fromUserId: r.fromUserId,
        fromMemberId: r.fromUserId,
        toUserId: myUid,
        toMemberId: myUid
      }))
    ];
    const sentCount = allRefs.filter(r => r.fromMemberId === myUid || r.fromUserId === myUid || (r.fromName && r.fromName.toLowerCase() === myName)).length;
    const recvCount = allRefs.filter(r => r.toMemberId === myUid || r.toUserId === myUid || (r.toName && r.toName.toLowerCase() === myName)).length;

    return (
      <div className="space-y-8 animate-fade-in font-sans pb-16">
        {/* Top Hero Banner */}
        <div className="bg-white p-6 md:p-8 pb-8 md:pb-10 rounded-xl shadow-2xs border border-zinc-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#af101a_1px,transparent_1px)] [background-size:16px_16px]"></div>
          <div className="space-y-4 my-auto relative z-10">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${isConclaveCompleted ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
              <CheckCircle className={`w-4 h-4 shrink-0 ${isConclaveCompleted ? 'text-emerald-600' : 'text-amber-600'}`} />
              <span className="text-[11px] font-bold">
                {isConclaveCompleted ? 'Conclave Completed — Ready for Next Event' : 'Not Registered for Active Conclave'}
              </span>
            </div>
            <div>
              <h1 className="text-[22px] font-black text-zinc-955 leading-tight">Welcome {memberName}</h1>
              <p className="text-[12px] text-zinc-500 font-semibold mt-0.5">{memberCompany} • {memberChapter}</p>
              <p className="text-body-sm text-zinc-600 mt-2 max-w-2xl leading-relaxed">
                {isConclaveCompleted
                  ? `The previous conclave (${conclaveSyncData?.conclaveStatus?.title || 'Conclave Session'}) has officially ended. Browse upcoming conclaves below to register for your next event!`
                  : 'You are currently not registered for the running conclave session. Browse available conclaves below and register to participate!'}
              </p>
            </div>
            <div className="pt-4 pb-2 flex flex-wrap gap-3">
              <button
                onClick={() => onTabChange && onTabChange('registrations')}
                className="px-5 py-2.5 bg-brand-red hover:bg-red-700 text-white font-bold text-button rounded-lg transition-smooth shadow-md cursor-pointer inline-flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Browse All Conclaves
              </button>
              <button
                onClick={() => onTabChange && onTabChange('history')}
                className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-button rounded-lg transition-smooth cursor-pointer inline-flex items-center gap-2"
              >
                View Conclave History
              </button>
            </div>
          </div>
        </div>

        {/* Quick KPI Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-brand-red shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">My Registered Events</span>
              <span className="text-xl font-black text-zinc-900 leading-tight mt-0.5 block">{listToFilter.filter(c => c.isRegistered).length} Events</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">Referrals Exchanged</span>
              <span className="text-xl font-black text-zinc-900 leading-tight mt-0.5 block">{sentCount + recvCount} Total</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">Chapter</span>
              <span className="text-sm font-black text-zinc-900 leading-tight mt-0.5 block truncate max-w-[140px]">{memberChapter}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">Niche / Category</span>
              <span className="text-xs font-black text-brand-red leading-tight mt-0.5 block truncate max-w-[140px]">{memberCategory}</span>
            </div>
          </div>
        </div>

        {/* Upcoming Conclaves Section */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-zinc-900 tracking-tight">Upcoming Conclaves</h2>
              <p className="text-xs text-zinc-500 font-medium">Register for upcoming BNI networking conclaves.</p>
            </div>
            <button
              onClick={() => onTabChange && onTabChange('registrations')}
              className="text-xs font-bold text-brand-red hover:underline flex items-center gap-1 cursor-pointer"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {upcomingConclaves.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-zinc-200 text-center">
              <Building2 className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm font-extrabold text-zinc-700">No upcoming conclaves scheduled at the moment</p>
              <p className="text-xs text-zinc-500 mt-1">Please check back soon for upcoming regional BNI conclave announcements.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {upcomingConclaves.map(c => (
                <div key={c.id} className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                        REGISTRATION OPEN
                      </span>
                      <span className="text-[10px] text-zinc-400 font-semibold">{c.region || 'BNI Region'}</span>
                    </div>
                    <h3 className="text-base font-black text-zinc-900 leading-snug">{c.title || c.name || 'BNI Conclave'}</h3>
                    {c.dateRange && (
                      <p className="text-xs text-zinc-500 font-medium flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        {c.dateRange}
                      </p>
                    )}
                    {(c.startTime || c.endTime) && (
                      <p className="text-xs text-zinc-500 font-medium flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-brand-red shrink-0" />
                        <span>{formatTimeNice(c.startTime)}{c.startTime && c.endTime ? ' – ' : ''}{formatTimeNice(c.endTime)}</span>
                      </p>
                    )}
                    {c.venue && (
                      <p className="text-xs text-zinc-500 font-medium flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        {c.venue}
                      </p>
                    )}
                  </div>

                  {c.isRegistered ? (
                    <div className="w-full py-2.5 px-4 rounded-lg font-bold text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center gap-1.5 shadow-2xs">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      Registered
                    </div>
                  ) : (
                    <button
                      onClick={() => onTabChange && onTabChange('registrations')}
                      className="w-full py-2.5 px-4 rounded-lg font-bold text-xs bg-brand-red hover:bg-red-700 text-white shadow-sm transition-smooth flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Register Now
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in font-sans pb-16">

      {/* Hero Section */}
      <div className="grid grid-cols-12 gap-6">

        {/* Left: Welcome & Status Card */}
        <div className="col-span-12 lg:col-span-8 bg-white p-6 md:p-8 rounded-xl shadow-2xs border border-zinc-200 relative overflow-hidden flex flex-col justify-between min-h-[300px]">
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#af101a_1px,transparent_1px)] [background-size:16px_16px]"></div>
          <div className="absolute top-4 right-4">
                {isConclaveCompleted ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-100 text-zinc-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-zinc-200 shadow-2xs">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    CONCLAVE COMPLETED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-full border border-emerald-150 shadow-2xs">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    LIVE ROUND {conclaveSyncData?.conclaveStatus?.currentRound || 0}
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {/* Conclave name banner — shows which conclave data is being loaded from backend */}
                {conclaveSyncData?.conclaveStatus?.title && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                    <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider">
                      {conclaveSyncData.conclaveStatus.title}
                    </span>
                    {conclaveSyncData.conclaveStatus.venue && (
                      <>
                        <span className="text-blue-300">•</span>
                        <span className="text-[10px] font-semibold text-blue-500">
                          {conclaveSyncData.conclaveStatus.venue}
                        </span>
                      </>
                    )}
                    {(conclaveSyncData.conclaveStatus.startTime || conclaveSyncData.conclaveStatus.endTime) && (
                      <>
                        <span className="text-blue-300">•</span>
                        <span className="text-[10px] font-bold text-blue-700 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                          <span>
                            {formatTimeNice(conclaveSyncData.conclaveStatus.startTime)}
                            {conclaveSyncData.conclaveStatus.startTime && conclaveSyncData.conclaveStatus.endTime ? ' – ' : ''}
                            {formatTimeNice(conclaveSyncData.conclaveStatus.endTime)}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                )}
                <div>
                  <h1 className="text-[20px] font-black text-zinc-955 leading-tight">Welcome {memberName}</h1>
                  <p className="text-[11.5px] text-zinc-500 font-semibold mt-0.5">{memberCompany} • {memberChapter}</p>
                </div>

                <div className="flex flex-wrap gap-6 items-center pt-2">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest">Active Session</span>
                    <span className="text-lg font-black text-zinc-900 mt-0.5">
                      {isConclaveCompleted ? 'All Rounds Finished' : `Round ${conclaveSyncData?.conclaveStatus?.currentRound || 0} of ${conclaveSyncData?.mySchedule?.length || 6}`}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-zinc-200"></div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest">Assigned Table</span>
                    <span className="text-lg font-black text-zinc-900 mt-0.5">Table {conclaveSyncData?.tableNumber || 'N/A'}</span>
                  </div>
                  <div className="w-px h-8 bg-zinc-200"></div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest">Niche / Category</span>
                    <span className="px-2 py-0.5 bg-red-50 border border-red-100 text-brand-red text-[9px] font-black rounded uppercase mt-1">
                      {memberCategory}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-zinc-200"></div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest">Referral Exchange</span>
                    {(() => {
                      const myUid = loggedInMember?.uid || loggedInMember?.id;
                      const myName = (loggedInMember?.name || '').toLowerCase();
                      const allRefs = [
                        ...referrals,
                        ...(conclaveSyncData?.newReferralsReceived || []).map(r => ({
                          fromUserId: r.fromUserId,
                          fromMemberId: r.fromUserId,
                          toUserId: myUid,
                          toMemberId: myUid
                        }))
                      ];

                      const sentCount = allRefs.filter(r =>
                        r.fromMemberId === myUid || r.fromUserId === myUid || (r.fromName && r.fromName.toLowerCase() === myName)
                      ).length;

                      const recvCount = allRefs.filter(r =>
                        r.toMemberId === myUid || r.toUserId === myUid || (r.toName && r.toName.toLowerCase() === myName)
                      ).length;

                      return (
                        <span className="text-body-sm font-extrabold text-zinc-850 mt-1 select-none flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9.5px] font-bold">
                            {sentCount} Sent
                          </span>
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[9.5px] font-bold">
                            {recvCount} Recv
                          </span>
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between items-end mb-2">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest">
                          {isConclaveCompleted
                            ? 'Conclave Status'
                            : timingState.phase === 'active'
                            ? 'Talking Time'
                            : timingState.phase === 'transition'
                            ? 'Move to Next Table'
                            : 'Time Remaining'}
                        </span>
                        {!isConclaveCompleted && (
                          timingState.phase === 'active' ? (
                            <span className="px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                              Talking Phase
                            </span>
                          ) : timingState.phase === 'transition' ? (
                            <span className="px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                              Move to Table
                            </span>
                          ) : null
                        )}
                      </div>
                      <span className={`text-2xl font-black mt-0.5 tracking-tighter leading-none ${
                        isConclaveCompleted
                          ? 'text-emerald-600'
                          : timingState.phase === 'active'
                          ? 'text-emerald-600'
                          : timingState.phase === 'transition'
                          ? 'text-amber-600'
                          : 'text-brand-red'
                      }`}>
                        {isConclaveCompleted
                          ? 'Completed'
                          : formatTime(
                              timingState.phase === 'active' || timingState.phase === 'transition'
                                ? timingState.phaseRemaining
                                : timeLeft
                            )}
                      </span>
                      {!isConclaveCompleted && (
                        <span className="text-[10px] text-zinc-400 font-semibold mt-1">
                          Total Round Time: <strong className="text-zinc-700 font-mono font-bold">{formatTime(timeLeft)}</strong>
                        </span>
                      )}
                    </div>
                    <span className="text-[9.5px] font-bold text-zinc-455">
                      {isConclaveCompleted
                        ? '100% Completed'
                        : `${Math.round(((ROUND_BLOCK_DURATION_SECS - timeLeft) / ROUND_BLOCK_DURATION_SECS) * 100)}% Completed`}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden border border-zinc-200/50">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out shadow-inner ${
                        isConclaveCompleted
                          ? 'bg-emerald-600'
                          : timingState.phase === 'active'
                          ? 'bg-emerald-500'
                          : timingState.phase === 'transition'
                          ? 'bg-amber-500'
                          : 'bg-brand-red'
                      }`}
                      style={{
                        width: isConclaveCompleted
                          ? '100%'
                          : `${((ROUND_BLOCK_DURATION_SECS - timeLeft) / ROUND_BLOCK_DURATION_SECS) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-6 border-t border-zinc-100 mt-6">
                {!isConclaveCompleted && (
                  <button
                    onClick={handleSelfCheckIn}
                    disabled={isCheckedIn}
                    className={`text-[10px] font-black uppercase tracking-wider px-5 py-2.5 rounded-lg transition-smooth flex items-center gap-1.5 cursor-pointer shadow-sm ${
                      isCheckedIn 
                        ? 'bg-emerald-600 text-white cursor-default' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {isCheckedIn ? 'Attendance Confirmed' : 'Mark My Attendance'}
                  </button>
                )}
                {!hasActiveConclave && (
                  <button
                    onClick={() => onTabChange && onTabChange('registrations')}
                    className="text-[10px] font-black uppercase tracking-wider px-5 py-2.5 bg-brand-red hover:bg-red-700 text-white rounded-lg transition-smooth flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Browse &amp; Register Conclaves
                  </button>
                )}
                <button
                  onClick={() => onTabChange && onTabChange('current-round')}
                  className={`text-[10px] font-black uppercase tracking-wider px-5 py-2.5 rounded-lg transition-smooth flex items-center gap-1.5 cursor-pointer shadow-sm ${
                    hasActiveConclave
                      ? 'bg-brand-red hover:bg-red-700 text-white'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
                  }`}
                >
                  View Current Round
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                {!hasActiveConclave && (
                  <button
                    onClick={() => onTabChange && onTabChange('history')}
                    className="text-[10px] font-black uppercase tracking-wider px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition-smooth flex items-center gap-1.5 cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    View Conclave History
                  </button>
                )}
              </div>
        </div>

        <div className="col-span-12 lg:col-span-4 bg-white p-6 rounded-xl shadow-2xs border border-zinc-200 flex flex-col justify-between min-h-[300px]">
          <div>
            <h3 className="font-black text-zinc-900 text-body-sm mb-4">Table {conclaveSyncData?.tableNumber || 'N/A'} Intelligence</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200/60 rounded-lg">
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-brand-red" />
                  <span className="text-xs text-zinc-650 font-semibold">Total Seated Members</span>
                </div>
                <span className="font-extrabold text-zinc-900 text-body-sm">
                  {conclaveSyncData?.tableOccupants?.length || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200/60 rounded-lg">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-brand-red" />
                  <span className="text-xs text-zinc-650 font-semibold">Unique Niches</span>
                </div>
                <span className="font-extrabold text-zinc-900 text-body-sm">
                  {new Set(conclaveSyncData?.tableOccupants?.map(o => o.category)).size}
                </span>
              </div>
            </div>

            <div className="mt-5">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2.5">Networking In Progress</span>
              <div className="flex -space-x-2.5 overflow-hidden">
                {(conclaveSyncData?.tableOccupants || []).map((m, idx) => {
                  const initials = m.name.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() || 'M';
                  return (
                    <div
                      key={idx}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 border-2 border-white font-bold text-[10.5px] text-zinc-550 shadow-inner select-none"
                      title={m.name}
                    >
                      {initials}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 mt-5 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-650 shrink-0 mt-0.5" />
            <p className="text-[10px] leading-relaxed text-zinc-500 font-semibold">
              No cross-chapter business overlaps detected in this round. High potential for external referrals.
            </p>
          </div>
        </div>
      </div>

      {/* Today's Schedule Timeline Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-black text-zinc-900 text-body-md">Today's Schedule</h2>
            {conclaveSyncData?.conclaveStatus?.title && (
              <p className="text-[9.5px] text-zinc-400 font-semibold mt-0.5">
                Conclave: <span className="text-zinc-600 font-bold">{conclaveSyncData.conclaveStatus.title}</span>
              </p>
            )}
          </div>
          <span
            onClick={() => onTabChange && onTabChange('my-schedule')}
            className="text-brand-red font-black text-[10.5px] uppercase tracking-wider hover:underline cursor-pointer"
          >
            View Detailed Plan
          </span>
        </div>

        <div className="flex overflow-x-auto gap-4 pt-3.5 pb-2 scrollbar-none select-none -mt-3.5">
          {(conclaveSyncData?.mySchedule || []).map((round) => {
            const isCompleted = round.status === 'Completed';
            const isActive = round.status === 'Active';

            return (
              <div
                key={round.number}
                className={`min-w-[220px] flex-shrink-0 p-4.5 rounded-xl border flex flex-col justify-between relative ${isActive
                  ? 'border-2 border-brand-red bg-white shadow-sm'
                  : isCompleted
                  ? 'border-zinc-200 bg-zinc-50/50 opacity-60'
                  : 'border-zinc-200 bg-white'
                }`}
              >
                {isActive && (
                  <span className="absolute -top-2.5 left-4 bg-brand-red text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-white">
                    CURRENT
                  </span>
                )}
                <div>
                  <span className={`text-[9px] font-bold block ${isActive ? 'text-brand-red' : 'text-zinc-400'}`}>
                    {round.time}
                  </span>
                  <h4 className="font-black text-zinc-900 text-[13.5px] mt-1">Round {round.number} Seating</h4>
                  <p className="text-[10px] text-zinc-450 font-semibold mt-0.5">{round.table} • Captain: {round.captain.split(' ')[0]}</p>
                </div>
                
                {isActive ? (
                  <div className="flex items-center gap-1.5 text-brand-red font-black text-[9px] uppercase tracking-wider mt-3.5 animate-pulse">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatTime(timeLeft)} Left</span>
                  </div>
                ) : isCompleted ? (
                  <div className="flex items-center gap-1.5 text-emerald-600 font-black text-[9px] uppercase tracking-wider mt-3">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Completed</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-zinc-400 font-black text-[9px] uppercase tracking-wider mt-3">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Upcoming</span>
                  </div>
                )}
              </div>
            );
          })}
          {(!conclaveSyncData?.mySchedule || conclaveSyncData.mySchedule.length === 0) && (
            <p className="p-4 text-center text-zinc-400 text-caption font-semibold">No schedule has been generated yet for this conclave.</p>
          )}
        </div>
      </section>

      {/* Grid: Table Members & Sidebar Previews */}
      <div className="grid grid-cols-12 gap-6 items-start">

        {/* Left Column: Current Table Members (Takes 8 cols) */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-zinc-900 text-body-md">
              Current Table Members <span className="text-zinc-400 font-normal">(Table {conclaveSyncData?.tableNumber || 'N/A'})</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredOccupants.map((member) => {
              const initials = member.name.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() || 'M';
              return (
                <div
                  key={member.uid}
                  onClick={() => setSelectedProfileMember(member)}
                  className={`p-4 rounded-2xl border transition-all duration-200 group cursor-pointer hover:border-brand-red/35 flex flex-col justify-between gap-3 shadow-2xs hover:shadow-md ${member.isCaptain
                    ? 'bg-red-50/20 border-brand-red/30 relative'
                    : 'bg-white border-zinc-200/90'
                    }`}
                >
                  {member.isCaptain && (
                    <span className="absolute top-3 right-3 bg-brand-red text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-2xs z-10">
                      Captain
                    </span>
                  )}

                  {/* Card Details */}
                  <div className="space-y-2.5">
                    {/* Top Header: Avatar + Name + Company */}
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full overflow-hidden border-2 flex items-center justify-center font-black text-xs shrink-0 select-none shadow-2xs ${member.isCaptain
                        ? 'border-brand-red bg-red-100 text-brand-red'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-500'
                        }`}>
                        {initials}
                      </div>

                      <div className="min-w-0 flex-1 pr-12">
                        <h4 className="text-[13px] font-extrabold text-zinc-950 leading-snug select-text truncate">
                          {member.name}
                        </h4>
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
                    timingState?.isTalking ? (
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
                    ) : (
                      <button
                        disabled
                        title="Referrals are closed after talking time for this round"
                        className="w-full py-1.5 border border-zinc-200 text-zinc-400 bg-zinc-100 rounded-xl text-[9.5px] font-black uppercase tracking-wider cursor-not-allowed"
                      >
                        Referrals Closed
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Previews & Announcements (Takes 4 cols) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">

          {/* Next Round Card */}
          {conclaveSyncData?.mySchedule?.find(s => s.number === (conclaveSyncData?.conclaveStatus?.currentRound || 1) + 1) && (() => {
            const nextRoundSeating = conclaveSyncData.mySchedule.find(s => s.number === (conclaveSyncData.conclaveStatus.currentRound || 1) + 1);
            return (
              <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs">
                <div className="flex items-center justify-between mb-3 text-zinc-450">
                  <span className="text-[9px] font-black uppercase tracking-widest">Next Session Preview</span>
                  <Calendar className="w-4 h-4 text-brand-red" />
                </div>
                <div>
                  <h4 className="text-[13.5px] font-black text-zinc-900 leading-snug">Round {nextRoundSeating.number} Seating: {nextRoundSeating.table}</h4>
                  <p className="text-[10px] text-zinc-455 font-semibold mt-1">Starts at {formatUpcomingRoundStartTime(nextRoundSeating.time)}</p>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3.5 border-t border-zinc-100">
                  <div className="flex -space-x-1.5">
                    {nextRoundSeating.participants.slice(0, 3).map((p, pIdx) => {
                      const initials = p.name.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() || 'M';
                      return (
                        <div key={pIdx} className="w-6 h-6 rounded-full bg-zinc-100 border border-white text-[7.5px] font-bold flex items-center justify-center" title={p.name}>
                          {initials}
                        </div>
                      );
                    })}
                  </div>
                  {nextRoundSeating.participants.length > 3 && (
                    <span className="text-[9.5px] text-zinc-455 font-extrabold ml-1">
                      +{nextRoundSeating.participants.length - 3} co-attendees
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Event Progress Card */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 shadow-2xs">
            <h3 className="text-[9px] font-black text-zinc-450 uppercase tracking-widest block mb-2.5">Event Seating Progress</h3>
            <div className="flex items-end justify-between mb-2">
              <div className="flex items-center gap-1.5 text-brand-red">
                <Activity className="w-4 h-4 animate-pulse" />
                <span className="text-lg font-black tracking-tight">
                  {conclaveSyncData?.mySchedule?.length && conclaveSyncData?.conclaveStatus?.currentRound
                    ? Math.floor(((conclaveSyncData.conclaveStatus.currentRound - 1) / conclaveSyncData.mySchedule.length) * 100)
                    : 0}%
                </span>
              </div>
              <span className="text-[10px] text-zinc-455 font-bold">
                {conclaveSyncData?.conclaveStatus?.currentRound ? conclaveSyncData.conclaveStatus.currentRound - 1 : 0} of {conclaveSyncData?.mySchedule?.length || 6} rounds finished
              </span>
            </div>
            <div className="w-full bg-zinc-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-brand-red h-full rounded-full"
                style={{
                  width: `${conclaveSyncData?.mySchedule?.length && conclaveSyncData?.conclaveStatus?.currentRound
                    ? ((conclaveSyncData.conclaveStatus.currentRound - 1) / conclaveSyncData.mySchedule.length) * 100
                    : 0}%`
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {selectedProfileMember && (
        <MemberProfileModal
          member={selectedProfileMember}
          onClose={() => setSelectedProfileMember(null)}
          isReferralDisabled={!timingState?.isReferralOpen}
          referralDisabledReason="Referrals are only active during the dedicated Referral Window (after speaking concludes)."
          onSendReferral={timingState?.isReferralOpen ? (m) => setReferTarget({
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
          loggedInUser={loggedInMember || { name: 'Member' }}
          activeConclaveId={conclaveSyncData?.conclaveStatus?.id || conclaveSyncData?.conclaveId || conclaveSyncData?.id}
          isReferralOpen={Boolean(timingState?.isReferralOpen)}
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
            <p className="font-bold text-white">{typeof toast === 'object' && toast?.title ? toast.title : 'Success!'}</p>
            <p className="text-zinc-400 mt-0.5">{typeof toast === 'object' && toast?.desc ? toast.desc : (typeof toast === 'string' ? toast : JSON.stringify(toast))}</p>
          </div>
        </div>
      )}

    </div>
  );
}
