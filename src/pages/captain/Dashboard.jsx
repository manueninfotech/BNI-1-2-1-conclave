import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Clock,
  Calendar,
  MapPin,
  RefreshCw,
  Users,
  Bell,
  ArrowRight,
  History,
  TrendingUp,
  Check,
  CheckCircle,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../../services/api';
import MemberProfileModal from '../../components/MemberProfileModal';

export default function CaptainDashboard({ loggedInCaptain, activeTab = 'dashboard', onTabChange, onLogout, conclaveSyncData: propConclaveSyncData }) {
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

  const [selectedProfileMember, setSelectedProfileMember] = useState(null);
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

  useEffect(() => {
    if (conclaveSyncData?.newReferralsReceived && Array.isArray(conclaveSyncData.newReferralsReceived)) {
      setReferrals(prev => {
        const map = new Map();
        prev.forEach(r => map.set(r.id, r));
        conclaveSyncData.newReferralsReceived.forEach(r => {
          const existing = map.get(r.id);
          map.set(r.id, existing ? { ...existing, ...r, status: r.status || existing.status } : r);
        });
        const merged = Array.from(map.values());
        if (JSON.stringify(prev) !== JSON.stringify(merged)) {
          localStorage.setItem('bni_referrals', JSON.stringify(merged));
          return merged;
        }
        return prev;
      });
    }
  }, [conclaveSyncData?.newReferralsReceived]);

  const getMemberReferralCount = (name, uid) => {
    const targetName = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const occupant = (conclaveSyncData?.tableOccupants || []).find(o => 
      (uid && (o.uid === uid || o.id === uid)) ||
      (targetName && o.name && o.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(targetName))
    );

    const targetUid = uid || occupant?.uid || occupant?.id;

    const allRefs = [
      ...referrals,
      ...(conclaveSyncData?.newReferralsReceived || []).map(r => ({
        fromUserId: r.fromUserId,
        fromMemberId: r.fromUserId,
        fromName: r.giverName,
        toUserId: conclaveSyncData?.userUid,
        toMemberId: conclaveSyncData?.userUid,
        status: r.status || 'Pending'
      }))
    ];

    const given = allRefs.filter(r => {
      const gName = (r.fromName || r.giverName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const gId = r.fromMemberId || r.fromUserId;
      if (targetUid && gId && (gId === targetUid || gId.includes(targetUid) || targetUid.includes(gId))) return true;
      if (targetName && gName && (gName.includes(targetName) || targetName.includes(gName))) return true;
      return false;
    }).length;

    const received = allRefs.filter(r => {
      const rName = (r.toName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const rId = r.toMemberId || r.toUserId;
      if (targetUid && rId && (rId === targetUid || rId.includes(targetUid) || targetUid.includes(rId))) return true;
      if (targetName && rName && (rName.includes(targetName) || targetName.includes(rName))) return true;
      return false;
    }).length;

    return { given, received };
  };
  const [attendance, setAttendance] = useState({});
  const [isLocked, setIsLocked] = useState(false);
  const [toast, setToast] = useState(null);
  const activeRound = `Round ${conclaveSyncData?.conclaveStatus?.currentRound || 0}`;
  const [searchQuery, setSearchQuery] = useState('');

  const displayTable = `Table ${conclaveSyncData?.tableNumber || 'N/A'}`;

  const ROUND_DURATION_SECS = 15 * 60; // 900 seconds (15:00)
  const [secondsLeft, setSecondsLeft] = useState(ROUND_DURATION_SECS);

  useEffect(() => {
    const startedAt = conclaveSyncData?.conclaveStatus?.currentRoundStartedAt;
    const status = (conclaveSyncData?.conclaveStatus?.status || '').toLowerCase();
    const isRunning = status === 'running' || status === 'active';

    if (startedAt && isRunning) {
      const updateTimer = () => {
        let startTime = NaN;
        if (typeof startedAt === 'object' && startedAt !== null) {
          if (typeof startedAt._seconds === 'number') startTime = startedAt._seconds * 1000;
          else if (typeof startedAt.seconds === 'number') startTime = startedAt.seconds * 1000;
          else if (typeof startedAt.toDate === 'function') startTime = startedAt.toDate().getTime();
        }
        if (isNaN(startTime)) startTime = new Date(startedAt).getTime();
        if (isNaN(startTime)) startTime = Date.now();

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setSecondsLeft(Math.max(0, ROUND_DURATION_SECS - elapsed));
      };
      updateTimer();
      const timer = setInterval(updateTimer, 1000);
      return () => clearInterval(timer);
    } else {
      setSecondsLeft(ROUND_DURATION_SECS);
    }
  }, [conclaveSyncData]);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  };

  const formatTimeSimple = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Find the table details assigned to this Captain from live backend sync data
  const liveMembers = (conclaveSyncData?.tableOccupants || []).map(m => ({
    id: m.uid || String(m.id),
    name: m.name,
    category: m.category,
    company: m.company,
    initials: m.name ? m.name.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() : 'M'
  }));

  const myTable = {
    capacity: `${liveMembers.length}/${conclaveSyncData?.personsPerTable || 6}`,
    members: liveMembers
  };

  const filteredMyTableMembers = useMemo(() => {
    const list = myTable?.members || [];
    if (!searchQuery || !searchQuery.trim()) return list;
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/);
    return list.filter(m => {
      const text = `${m.name || ''} ${m.company || ''} ${m.category || ''} ${m.chapter || ''}`.toLowerCase();
      return tokens.every(token => text.includes(token));
    });
  }, [myTable?.members, searchQuery]);

  const showToast = (title, desc) => {
    setToast({ title, desc });
    setTimeout(() => setToast(null), 3000);
  };

  // Initialize and sync attendance state for members from live backend sync
  useEffect(() => {
    if (conclaveSyncData?.tableOccupants && Array.isArray(conclaveSyncData.tableOccupants)) {
      setAttendance(prev => {
        const next = { ...prev };
        let changed = false;
        conclaveSyncData.tableOccupants.forEach(m => {
          const memberId = m.uid || String(m.id);
          const val = m.isPresent ? 'present' : (m.isPresent === false ? 'absent' : 'present');
          if (next[memberId] !== val) {
            next[memberId] = val;
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem('bni_captain_attendance_cache', JSON.stringify(next));
          return next;
        }
        return prev;
      });
    }
  }, [conclaveSyncData?.tableOccupants]);

  const handleToggleAttendance = (memberId, status) => {
    if (isLocked) return;
    setAttendance(prev => ({
      ...prev,
      [memberId]: prev[memberId] === status ? null : status
    }));
  };

  const handleSubmitAttendance = async () => {
    if (isLocked) return;

    const totalMembers = myTable.members ? myTable.members.length : 0;
    const checkedCount = Object.values(attendance).filter(status => status !== null).length;

    if (checkedCount < totalMembers) {
      showToast('Incomplete Check-In', 'Please record attendance for all assigned members.');
      return;
    }

    const captainUid = loggedInCaptain?.uid || loggedInCaptain?.id || 'captain';
    const activeConclaveId = conclaveSyncData?.conclaveStatus?.id || conclaveSyncData?.conclaveId;
    const currentRound = conclaveSyncData?.conclaveStatus?.currentRound || 1;

    if (activeConclaveId) {
      try {
        const attendancePayload = Object.entries(attendance).map(([uid, status]) => ({
          id: `att_r${currentRound}_${uid}`,
          userId: uid,
          roundNumber: currentRound,
          tableNumber: myTable?.tableNumber || 1,
          isPresent: status === 'present',
          markedBy: captainUid,
          timestamp: new Date().toISOString()
        }));

        await api.post(`/conclaves/${activeConclaveId}/sync`, {
          attendance: attendancePayload
        });
      } catch (err) {
        console.warn("Backend attendance sync failed:", err.message);
      }
    }

    setIsLocked(true);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    showToast('Attendance Locked', `${displayTable} attendance submitted successfully to regional admin.`);
  };

  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const absentCount = Object.values(attendance).filter(s => s === 'absent').length;

  const conclaveStatusStr = (conclaveSyncData?.conclaveStatus?.status || '').toLowerCase();
  const isConclaveCompleted = conclaveStatusStr === 'completed' || conclaveStatusStr === 'finished' || conclaveStatusStr === 'ended';

  if (isConclaveCompleted) {
    return (
      <div className="space-y-8 animate-fade-in font-sans pb-20">
        <div className="bg-white p-8 md:p-12 pb-12 md:pb-16 rounded-xl border border-zinc-200 text-center shadow-2xs space-y-6 mb-10">
          <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto" />
          <div className="space-y-2">
            <h2 className="text-xl font-black text-zinc-900">Conclave Session Completed</h2>
            <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
              The previous conclave session has officially concluded. Table captain management controls are active only during running conclaves. Please browse upcoming conclaves!
            </p>
          </div>
          <div className="pt-2 pb-4">
            <button
              onClick={() => onTabChange ? onTabChange('dashboard') : (window.location.href = '/')}
              className="px-6 py-2.5 bg-brand-red hover:bg-red-700 text-white font-extrabold text-xs rounded-lg transition-smooth shadow-sm inline-flex items-center gap-2 cursor-pointer"
            >
              Go to Member Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!conclaveSyncData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-zinc-500">Loading captain table session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Welcome Card */}
      <section className="bg-white rounded-xl border border-zinc-200 shadow-2xs overflow-hidden flex items-stretch">
        {/* Main content */}
        <div className="flex items-center justify-between gap-6 px-5 py-4 flex-1 min-w-0">
          {/* Left: all text info */}
          <div className="min-w-0 space-y-1">
            {/* Tags row */}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-widest border ${
                isConclaveCompleted 
                  ? 'bg-zinc-100 text-zinc-700 border-zinc-200' 
                  : 'bg-red-50 text-brand-red border-red-100'
              }`}>
                {isConclaveCompleted ? (
                  <><CheckCircle className="w-3 h-3 text-emerald-600 inline-block" /> Conclave Completed</>
                ) : conclaveSyncData?.conclaveStatus?.status === 'active' || conclaveSyncData?.conclaveStatus?.status === 'running' ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse inline-block" /> Live Now</>
                ) : 'Conclave Session'}
              </span>
              <span className="text-zinc-400 text-[10px] font-semibold uppercase tracking-widest">
                {conclaveSyncData?.conclaveStatus?.region || conclaveSyncData?.region || 'BNI Region'}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-[20px] font-black text-zinc-955 leading-tight truncate">
              {conclaveSyncData?.conclaveStatus?.name || conclaveSyncData?.conclaveStatus?.title || conclaveSyncData?.conclaveName || 'Networking Conclave Session'}
            </h1>

            {/* Venue & Timing */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                <span className="text-[11px] text-zinc-400 font-medium truncate">
                  {conclaveSyncData?.conclaveStatus?.venue || conclaveSyncData?.venue || 'Venue TBD'}
                </span>
              </div>
              {(conclaveSyncData?.conclaveStatus?.startTime || conclaveSyncData?.conclaveStatus?.endTime) && (
                <div className="flex items-center gap-1.5 text-[11px] text-brand-red font-bold">
                  <Clock className="w-3 h-3 text-brand-red shrink-0" />
                  <span>
                    {conclaveSyncData.conclaveStatus.startTime}
                    {conclaveSyncData.conclaveStatus.startTime && conclaveSyncData.conclaveStatus.endTime ? ' – ' : ''}
                    {conclaveSyncData.conclaveStatus.endTime}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Round info */}
          <div className="shrink-0 hidden sm:flex flex-col items-center justify-center bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 text-center min-w-[64px]">
            <span className="text-[8.5px] font-extrabold text-zinc-400 uppercase tracking-widest">{isConclaveCompleted ? 'Status' : 'Round'}</span>
            <span className="text-xl font-black text-zinc-900 leading-none mt-0.5">
              {isConclaveCompleted ? 'Ended' : conclaveSyncData?.conclaveStatus?.currentRound || 0}
              {!isConclaveCompleted && <span className="text-xs font-semibold text-zinc-400">/{conclaveSyncData?.mySchedule?.length || 6}</span>}
            </span>
          </div>
        </div>
      </section>

              {/* KPI Section */}
              <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-white p-4.5 rounded-xl border border-zinc-200 shadow-2xs flex flex-col justify-between h-24">
                  <p className="text-[11px] font-bold text-zinc-455 uppercase tracking-wide">Current Round</p>
                  <div className="flex items-end justify-between mt-2">
                    <span className="text-lg font-black text-zinc-900 leading-none">
                      {isConclaveCompleted ? 'All Finished' : `${conclaveSyncData?.conclaveStatus?.currentRound || 0} of ${conclaveSyncData?.mySchedule?.length || 6}`}
                    </span>
                    <RefreshCw className="w-5 h-5 text-brand-red shrink-0" />
                  </div>
                </div>
                <div className="bg-white p-4.5 rounded-xl border border-zinc-200 shadow-2xs flex flex-col justify-between h-24">
                  <p className="text-[11px] font-bold text-zinc-455 uppercase tracking-wide">Assigned Table</p>
                  <div className="flex items-end justify-between mt-2">
                    <span className="text-lg font-black text-zinc-900 leading-none">
                      {displayTable}
                    </span>
                    <Award className="w-5 h-5 text-brand-red shrink-0" />
                  </div>
                </div>
                <div className="bg-white p-4.5 rounded-xl border border-zinc-200 shadow-2xs flex flex-col justify-between h-24">
                  <p className="text-[11px] font-bold text-zinc-455 uppercase tracking-wide">Total Members</p>
                  <div className="flex items-end justify-between mt-2">
                    <span className="text-lg font-black text-zinc-900 leading-none">
                      {conclaveSyncData?.tableOccupants?.length || 0} <span className="text-zinc-400 text-xs font-semibold">Active</span>
                    </span>
                    <Users className="w-5 h-5 text-brand-red shrink-0" />
                  </div>
                </div>
                <div className="bg-white p-4.5 rounded-xl border border-zinc-200 shadow-2xs flex flex-col justify-between h-24">
                  <p className="text-[11px] font-bold text-zinc-455 uppercase tracking-wide">{isConclaveCompleted ? 'Status' : 'Time Remaining'}</p>
                  <div className="flex items-end justify-between mt-2">
                    <span className={`text-lg font-black leading-none ${isConclaveCompleted ? 'text-emerald-600' : 'text-brand-red'}`}>
                      {isConclaveCompleted ? 'Completed' : formatTimeSimple(secondsLeft)}
                    </span>
                    <Clock className={`w-5 h-5 ${isConclaveCompleted ? 'text-emerald-600' : 'text-brand-red animate-pulse'} shrink-0`} />
                  </div>
                </div>
                <div className="bg-white p-4.5 rounded-xl border border-zinc-200 shadow-2xs flex flex-col justify-between h-24 col-span-2 md:col-span-1">
                  <p className="text-[11px] font-bold text-zinc-455 uppercase tracking-wide">Referral Exchange</p>
                  <div className="flex items-end justify-between mt-2">
                    {(() => {
                      const uids = new Set([
                        loggedInCaptain?.uid,
                        loggedInCaptain?.id,
                        loggedInCaptain?._originalUid,
                        loggedInCaptain?.email
                      ].filter(Boolean));
                      const cleanMyName = (loggedInCaptain?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

                      const allRefs = [
                        ...referrals,
                        ...(conclaveSyncData?.newReferralsReceived || []).map(r => ({
                          fromUserId: r.fromUserId,
                          fromMemberId: r.fromUserId,
                          fromName: r.giverName,
                          toUserId: loggedInCaptain?.uid || loggedInCaptain?.id,
                          toMemberId: loggedInCaptain?.uid || loggedInCaptain?.id
                        }))
                      ];

                      const givenCount = allRefs.filter(r => {
                        if (r.fromMemberId && uids.has(r.fromMemberId)) return true;
                        if (r.fromUserId && uids.has(r.fromUserId)) return true;
                        if (r.fromName) {
                          const g = r.fromName.toLowerCase().replace(/[^a-z0-9]/g, '');
                          if (cleanMyName && (g.includes(cleanMyName) || cleanMyName.includes(g))) return true;
                        }
                        return false;
                      }).length;

                      const takenCount = allRefs.filter(r => {
                        if (r.toMemberId && uids.has(r.toMemberId)) return true;
                        if (r.toUserId && uids.has(r.toUserId)) return true;
                        if (r.toName) {
                          const rec = r.toName.toLowerCase().replace(/[^a-z0-9]/g, '');
                          if (cleanMyName && (rec.includes(cleanMyName) || cleanMyName.includes(rec))) return true;
                        }
                        return false;
                      }).length;

                      return (
                        <span className="text-body-sm font-black text-zinc-900 leading-none flex items-center gap-1">
                          <span className="text-emerald-700 font-extrabold">{givenCount} Given</span>
                          <span className="text-zinc-300">•</span>
                          <span className="text-blue-700 font-extrabold">{takenCount} Taken</span>
                        </span>
                      );
                    })()}
                    <TrendingUp className="w-5 h-5 text-brand-red shrink-0" />
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Countdown & Schedule */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Live Countdown Widget */}
                  <div className="bg-white rounded-xl border border-zinc-200 shadow-2xs p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden min-h-[300px]">
                    <div className="absolute top-4 left-4 md:top-6 md:left-6">
                      <span className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-brand-red rounded-full animate-pulse"></span>
                        LIVE ROUND {conclaveSyncData?.conclaveStatus?.currentRound || 0}
                      </span>
                    </div>

                    {/* Left side: Countdown Ring */}
                    <div className="flex flex-col items-center shrink-0 pt-6 md:pt-4">
                      <div className="relative flex items-center justify-center w-48 h-48">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            className="text-zinc-100"
                            cx="96"
                            cy="96"
                            fill="transparent"
                            r="82"
                            stroke="currentColor"
                            strokeWidth="8"
                          />
                          <circle
                            className="text-brand-red progress-ring__circle transition-all duration-1000"
                            cx="96"
                            cy="96"
                            fill="transparent"
                            r="82"
                            stroke="currentColor"
                            strokeDasharray={515.2}
                            strokeDashoffset={515.2 * (1 - secondsLeft / 600)}
                            strokeLinecap="round"
                            strokeWidth="8"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="text-4xl font-black text-zinc-955 tracking-tighter leading-none">
                            {formatTimeSimple(secondsLeft)}
                          </span>
                          <span className="text-[8.5px] text-zinc-400 font-extrabold uppercase tracking-widest mt-1.5">
                            Remaining
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right side: Round Action Checklist & Guidelines */}
                    <div className="flex-1 space-y-4 pt-4 md:pt-0">
                      <div>
                        <h3 className="text-body-md font-black text-zinc-950">Active Round Guidelines</h3>
                        <p className="text-[11.5px] leading-relaxed font-semibold text-zinc-500 mt-1">
                          All members are currently pitching. Please ensure each person gets exactly 2 minutes for their introduction.
                        </p>
                      </div>

                      <div className="border-t border-zinc-100 pt-3.5 space-y-3">
                        <span className="text-[9.5px] font-black text-zinc-450 uppercase tracking-wider block">Table Matchmaking & Insights</span>
                        
                        {(() => {
                          const tableOccupants = conclaveSyncData?.tableOccupants || [];
                          const tableCategories = tableOccupants.map(m => m.category).filter(Boolean);
                          const uniqueCats = new Set(tableCategories).size;
                          const synergyPct = tableCategories.length > 0 ? Math.min(100, Math.round((uniqueCats / tableCategories.length) * 100)) : 100;

                          const tableChapters = Array.from(new Set(
                            tableOccupants.map(m => m.chapter).filter(Boolean)
                          ));
                          const chaptersText = tableChapters.length > 0 ? tableChapters.join(', ') : 'BNI Guntur Chapters';

                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11.5px] font-semibold text-zinc-600">
                              <div className="space-y-1">
                                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block">Synergy Score</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[13px] font-black text-zinc-950 leading-none">{synergyPct}% Optimal</span>
                                  <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 leading-none">
                                    {synergyPct >= 80 ? 'Excellent' : synergyPct >= 60 ? 'Good' : 'Balanced'}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block">Coordinating Captain</span>
                                <div className="text-[12px] font-extrabold text-zinc-800 leading-none pt-0.5">
                                  {loggedInCaptain.name}
                                </div>
                              </div>

                              <div className="space-y-1 sm:col-span-2">
                                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block">Represented Chapters</span>
                                <p className="text-[11px] font-extrabold text-zinc-800 leading-normal">
                                  {chaptersText}
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Current Participants Grid */}
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-body-lg font-black text-zinc-900 tracking-tight">Current Round Participants</h3>
                      <span className="text-zinc-400 font-extrabold text-[10px] uppercase tracking-wider">
                        {myTable.members.length} Members at {displayTable}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredMyTableMembers.map((member) => (
                        <div
                          key={member.id}
                          onClick={() => setSelectedProfileMember(member)}
                          className="bg-white p-4.5 rounded-xl border border-zinc-200 hover:border-brand-red/35 hover:bg-zinc-50/20 shadow-2xs flex items-start gap-4 transition-smooth cursor-pointer"
                        >
                          <div className="w-12 h-12 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center font-bold text-sm text-zinc-500 shrink-0 shadow-inner">
                            {member.initials}
                          </div>
                          <div className="flex-1 space-y-1">
                            <h4 className="text-[13px] font-bold text-zinc-850 leading-tight">{member.name}</h4>
                            <p className="text-[11px] text-zinc-450 font-semibold leading-normal mt-0.5">{member.company}</p>
                            <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                              <span className="bg-zinc-100 text-zinc-650 text-[8px] font-black px-2 py-0.5 rounded border border-zinc-200/50 uppercase tracking-wide">
                                {member.category}
                              </span>
                              <span className="text-[9px] font-bold text-zinc-400 whitespace-nowrap">
                                Sent: <span className="text-zinc-700">{getMemberReferralCount(member.name, member.id).given}</span> • Recv: <span className="text-zinc-700">{getMemberReferralCount(member.name, member.id).received}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Table Attendance Checklist Card */}
                  <section className="bg-white rounded-xl border border-zinc-200 shadow-2xs p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-body-md font-black text-zinc-900 tracking-tight">Table Attendance Checklist</h3>
                          <span className="bg-red-50 text-brand-red text-[9px] font-black px-2 py-0.5 rounded border border-red-100 uppercase tracking-widest">
                            {displayTable}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-zinc-450 font-semibold mt-0.5">
                          Mark attendance for members seated at your table for Round {conclaveSyncData?.conclaveStatus?.currentRound || 1}.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[11.5px] font-black text-emerald-700">{presentCount} Present</span>
                          <span className="text-zinc-300 mx-1.5">•</span>
                          <span className="text-[11.5px] font-black text-red-600">{absentCount} Absent</span>
                        </div>
                        <button
                          onClick={handleSubmitAttendance}
                          disabled={isLocked}
                          className={`px-4 py-2 rounded-lg text-xs font-black transition-smooth shadow-xs flex items-center gap-1.5 cursor-pointer ${
                            isLocked
                              ? 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed'
                              : 'bg-brand-red text-white hover:bg-red-700'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {isLocked ? 'Attendance Submitted' : 'Submit Attendance'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {myTable.members.map((member) => {
                        const currentStatus = attendance[member.id] || 'present';
                        const isPresent = currentStatus === 'present';
                        const isAbsent = currentStatus === 'absent';

                        return (
                          <div
                            key={member.id}
                            className={`p-3.5 rounded-xl border transition-smooth flex items-center justify-between gap-3 ${
                              isPresent
                                ? 'bg-emerald-50/40 border-emerald-200/80'
                                : isAbsent
                                ? 'bg-red-50/40 border-red-200/80'
                                : 'bg-white border-zinc-200'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <h4 className="text-[13px] font-extrabold text-zinc-900 truncate leading-tight">{member.name}</h4>
                              <p className="text-[11px] text-zinc-450 font-semibold truncate mt-0.5">{member.company}</p>
                              <span className="inline-block mt-1 bg-zinc-100 text-zinc-600 text-[8.5px] font-black px-1.5 py-0.5 rounded border border-zinc-200/50 uppercase">
                                {member.category}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleToggleAttendance(member.id, 'present')}
                                disabled={isLocked}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase transition-smooth flex items-center gap-1 cursor-pointer ${
                                  isPresent
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-white text-zinc-500 border border-zinc-200 hover:bg-zinc-50'
                                }`}
                              >
                                <Check className="w-3 h-3" />
                                Present
                              </button>
                              <button
                                onClick={() => handleToggleAttendance(member.id, 'absent')}
                                disabled={isLocked}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase transition-smooth flex items-center gap-1 cursor-pointer ${
                                  isAbsent
                                    ? 'bg-red-600 text-white shadow-2xs'
                                    : 'bg-white text-zinc-500 border border-zinc-200 hover:bg-zinc-50'
                                }`}
                              >
                                <X className="w-3 h-3" />
                                Absent
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>

                {/* Right Column: Schedule & Activity */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-brand-red p-6 rounded-xl border border-red-700 shadow-md text-white select-none">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Your Station</p>
                        <h3 className="text-2xl font-black mt-1 leading-none">{displayTable}</h3>
                      </div>
                      <Award className="w-7 h-7 text-white opacity-50 shrink-0" />
                    </div>

                    <div className="flex items-center gap-2.5 mb-6">
                      <div className="flex -space-x-1.5">
                        {(conclaveSyncData?.tableOccupants || []).slice(0, 3).map((p, pIdx) => {
                          const initials = p.name.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() || 'M';
                          return (
                            <div key={pIdx} className="w-7 h-7 rounded-full border border-brand-red bg-red-700/60 flex items-center justify-center text-[7px] font-bold">
                              {initials}
                            </div>
                          );
                        })}
                        {conclaveSyncData?.tableOccupants?.length > 3 && (
                          <div className="w-7 h-7 rounded-full border border-brand-red bg-red-700/60 flex items-center justify-center text-[7px] font-bold font-black">
                            +{conclaveSyncData.tableOccupants.length - 3}
                          </div>
                        )}
                      </div>
                      <span className="text-[10.5px] font-extrabold text-red-50">
                        {conclaveSyncData?.tableOccupants?.length || 0} Members Assigned
                      </span>
                    </div>

                    <button
                      onClick={() => onTabChange && onTabChange('my-table')}
                      className="w-full bg-white text-brand-red font-black py-2.5 rounded-lg hover:bg-zinc-55 transition-smooth flex items-center justify-center gap-1.5 cursor-pointer shadow-xs text-button"
                    >
                      Open My Table
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Today's Schedule Timeline */}
                  <section className="bg-white rounded-xl border border-zinc-200 shadow-2xs p-5.5 space-y-5">
                    <h3 className="text-body-sm font-black text-zinc-950 border-b border-zinc-100 pb-2">Today's Schedule</h3>
                    <div className="relative space-y-6 before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-150">
                      {(conclaveSyncData?.mySchedule || []).map((rnd) => {
                        const isActive = rnd.status === 'Active';
                        const isCompleted = rnd.status === 'Completed';
                        return (
                          <div key={rnd.number} className="relative pl-8">
                            {isActive ? (
                              <div className="absolute left-[3px] top-1.5 w-[18px] h-[18px] rounded-full bg-brand-red border-4 border-red-100 z-10 shadow-xs animate-pulse"></div>
                            ) : (
                              <div className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-white z-10 ${isCompleted ? 'bg-emerald-500' : 'bg-zinc-300'}`}></div>
                            )}
                            <div className="flex flex-col">
                              <span className={`font-extrabold text-[9px] uppercase tracking-wider ${isActive ? 'text-brand-red font-black' : 'text-zinc-400'}`}>
                                {rnd.time} {isActive && '(ACTIVE)'}
                              </span>
                              <span className={`font-extrabold text-[12px] mt-0.5 ${isActive ? 'text-zinc-900 font-black' : 'text-zinc-800'}`}>
                                Round {rnd.number}: Table {rnd.tableNumber} Seating
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {(!conclaveSyncData?.mySchedule || conclaveSyncData.mySchedule.length === 0) && (
                        <p className="text-zinc-400 text-caption font-semibold text-center">No rounds generated yet.</p>
                      )}
                    </div>
                  </section>
                </div>
              </div>


      {selectedProfileMember && (
        <MemberProfileModal
          member={selectedProfileMember}
          onClose={() => setSelectedProfileMember(null)}
          onSendReferral={(m) => {
            onTabChange && onTabChange('referrals');
          }}
        />
      )}

      {/* Toast notifications */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[70] bg-zinc-900 text-white text-[11px] font-bold py-2.5 px-4 rounded-lg shadow-xl flex items-center gap-2 border border-zinc-800 animate-slide-up">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse"></span>
          <div>
            <p className="font-bold text-white">{typeof toast === 'object' && toast?.title ? toast.title : 'Success!'}</p>
            <p className="text-zinc-400 mt-0.5">{typeof toast === 'object' && toast?.desc ? toast.desc : (typeof toast === 'string' ? toast : JSON.stringify(toast))}</p>
          </div>
        </div>
      )}

    </div>
  );
}
