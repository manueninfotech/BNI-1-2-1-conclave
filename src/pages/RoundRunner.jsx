import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  CheckCircle2,
  Grid,
  Users,
  Shield,
  X,
  RefreshCw,
  Send,
  Bell,
  BellOff,
  Volume2,
  Sparkles,
  Play,
  Pause,
  Square
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, BarChart, Bar, Cell, XAxis } from 'recharts';
import { api } from '../services/api';
import { colors } from '../config/theme';
import { formatStatus } from '../utils/statusUtils';



import runnerData from '../data/tables_runner.json';
import {
  calculateRoundTiming,
  formatTime,
  ROUND_BLOCK_DURATION_SECS,
  TALKING_SECS_PER_PERSON
} from '../utils/roundTiming';
const { initialTables, mockRosters } = runnerData;

export default function RoundRunner({ selectedConclaveId, onNavigateToReview, isHubMode = false }) {
  const [conclaves, setConclaves] = useState(() => {
    const cached = localStorage.getItem('bni_admin_conclaves_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
    }
    return [];
  });
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function loadConclaves() {
      try {
        const data = await api.get('/admin/conclaves');
        if (Array.isArray(data)) {
          setConclaves(data);
          localStorage.setItem('bni_admin_conclaves_cache', JSON.stringify(data));
        }
      } catch (err) {
        console.error("Failed to load conclaves:", err);
      }
    }
    loadConclaves();
  }, []);

  useEffect(() => {
    if (!selectedConclaveId) return;
    async function loadStats() {
      try {
        const data = await api.get(`/admin/conclaves/${selectedConclaveId}/stats`);
        setStats(data);
      } catch (err) {
        console.error("Failed to load conclave stats:", err);
      }
    }
    loadStats();
  }, [selectedConclaveId]);

  const selectedConclave = useMemo(() =>
    conclaves.find(c => c.id === selectedConclaveId),
    [conclaves, selectedConclaveId]
  );

  const conclaveName = selectedConclave?.name || 'Conclave';

  const [allTables, setAllTables] = useState(initialTables);
  const setTables = (updater) => setAllTables(updater);

  const statusLower = (selectedConclave?.status || '').toLowerCase();
  const isCompleted = statusLower === 'completed' || statusLower === 'cancelled';

  const totalRounds = useMemo(() => {
    return selectedConclave?.scheduleSummary?.roundCount || selectedConclave?.roundCount || 4;
  }, [selectedConclave]);

  const isUpcoming = !isCompleted && (statusLower === 'upcoming' || statusLower === 'draft' || !selectedConclave?.currentRound);
  const activeRound = isCompleted
    ? (selectedConclave?.currentRound || totalRounds)
    : (isUpcoming ? 0 : (selectedConclave?.currentRound || 0));

  const progressPercent = useMemo(() => {
    if (isCompleted) return 100;
    if (isUpcoming || activeRound === 0) return 0;
    return Math.min(100, Math.round((activeRound / totalRounds) * 100));
  }, [isCompleted, isUpcoming, activeRound, totalRounds]);

  const [filteredReferrals, setFilteredReferrals] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  useEffect(() => {
    if (!selectedConclaveId) return;
    async function loadReferralsAndAttendance() {
      try {
        const [refData, attData, conclaveData] = await Promise.all([
          api.get(`/admin/conclaves/${selectedConclaveId}/referrals`).catch(() => []),
          api.get(`/admin/conclaves/${selectedConclaveId}/attendance`).catch(() => []),
          api.get(`/admin/conclaves/${selectedConclaveId}`).catch(() => null)
        ]);
        if (Array.isArray(refData)) setFilteredReferrals(refData);
        if (Array.isArray(attData)) setAttendanceRecords(attData);
        if (conclaveData && conclaveData.id) {
          setConclaves(prev => prev.map(c => c.id === conclaveData.id ? { ...c, ...conclaveData } : c));
        }
      } catch (err) {
        console.warn("Failed to load conclave activity data:", err.message);
      }
    }

    loadReferralsAndAttendance();
    const interval = setInterval(loadReferralsAndAttendance, 5000);
    return () => clearInterval(interval);
  }, [selectedConclaveId]);

  const tables = useMemo(() => {
    if (selectedConclave && selectedConclave.schedule && selectedConclave.participants) {
      const roundSeating = selectedConclave.schedule.rounds?.find(r => r.roundNumber === activeRound) ||
        (isCompleted && selectedConclave.schedule.rounds?.length ? selectedConclave.schedule.rounds[selectedConclave.schedule.rounds.length - 1] : null);
      if (roundSeating) {
        return roundSeating.tables.map(t => {
          const captain = selectedConclave.participants.find(p => p.id === t.captainId);
          const members = t.memberIds.map(mId => {
            const p = selectedConclave.participants.find(p => p.id === mId);
            return {
              id: p?._originalUid || String(mId),
              name: p?.name || 'Unknown',
              category: p?.businessCategory || 'Uncategorized',
              checkedIn: p?.isActive ?? true
            };
          });
          return {
            id: `Table ${t.tableNumber}`,
            tableNumber: t.tableNumber,
            conclaveId: selectedConclaveId,
            status: 'active',
            captain: {
              name: captain?.name || 'Unknown',
              role: 'Table Captain',
              initials: captain?.name ? captain.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'TC'
            },
            members
          };
        });
      }
    }
    return [];
  }, [selectedConclave, activeRound]);

  const totalReferrals = filteredReferrals.length;
  const connectedReferrals = filteredReferrals.filter(r => {
    const st = (r.status || '').toLowerCase();
    const out = (r.outcome || '').toLowerCase();
    return st === 'connected' || st === 'completed' || out === 'accepted';
  }).length;
  const closedReferrals = filteredReferrals.filter(r => {
    const st = (r.status || '').toLowerCase();
    const out = (r.outcome || '').toLowerCase();
    return st === 'closed' || out === 'closed' || (r.closedAmount && r.closedAmount > 0);
  }).length;
  const pendingReferrals = filteredReferrals.filter(r => {
    const st = (r.status || '').toLowerCase();
    const out = (r.outcome || '').toLowerCase();
    const isConnected = st === 'connected' || st === 'completed' || out === 'accepted';
    const isClosed = st === 'closed' || out === 'closed' || (r.closedAmount && r.closedAmount > 0);
    return !isConnected && !isClosed;
  }).length;

  // Segment data for the Referrals Tracker donut chart
  const referralChartData = useMemo(() => {
    if (totalReferrals === 0) {
      return [{ name: 'None', value: 1, fill: '#f4f4f5' }];
    }
    const data = [];
    if (connectedReferrals > 0) {
      data.push({ name: 'Connected', value: connectedReferrals, fill: colors.bniRed });
    }
    if (pendingReferrals > 0) {
      data.push({ name: 'Pending', value: pendingReferrals, fill: '#f59e0b' });
    }
    if (closedReferrals > 0) {
      data.push({ name: 'Closed', value: closedReferrals, fill: '#71717a' });
    }
    return data.length > 0 ? data : [{ name: 'None', value: 1, fill: '#f4f4f5' }];
  }, [totalReferrals, connectedReferrals, pendingReferrals, closedReferrals]);

  // Derive persons per table (default 6 if not explicitly configured)
  const personsPerTable = useMemo(() => {
    return selectedConclave?.personsPerTable || selectedConclave?.tableSize || (tables[0]?.members ? tables[0].members.length + 1 : 6);
  }, [selectedConclave, tables]);

  const isRoundPaused = Boolean(selectedConclave?.isRoundPaused);

  // Timer States (synchronized with active round)
  const [timeLeft, setTimeLeft] = useState(ROUND_BLOCK_DURATION_SECS);
  const [timerRunning, setTimerRunning] = useState(false);

  const [timingState, setTimingState] = useState(() => calculateRoundTiming({
    startedAt: selectedConclave?.currentRoundStartedAt,
    personsPerTable,
    isRunning: Boolean(selectedConclave?.currentRound && selectedConclave?.currentRoundStartedAt && !isUpcoming && !isCompleted),
    isPaused: isRoundPaused && !isCompleted,
    pausedAt: selectedConclave?.roundPausedAt,
    elapsedMsBeforePause: selectedConclave?.roundElapsedMsBeforePause,
  }));

  // Sync real-time dynamic round timer from database status
  useEffect(() => {
    if (isCompleted) {
      setTimeLeft(0);
      setTimerRunning(false);
      return;
    }

    const isRoundLive = Boolean(
      selectedConclave &&
      selectedConclave.currentRound &&
      selectedConclave.currentRoundStartedAt &&
      !isUpcoming &&
      !isCompleted
    );

    const updateTimer = () => {
      const timing = calculateRoundTiming({
        startedAt: selectedConclave?.currentRoundStartedAt,
        personsPerTable,
        isRunning: isRoundLive || timerRunning,
        isPaused: isRoundPaused,
        pausedAt: selectedConclave?.roundPausedAt,
        elapsedMsBeforePause: selectedConclave?.roundElapsedMsBeforePause,
      });

      setTimingState(timing);
      setTimeLeft(timing.totalRemaining);
      setTimerRunning(!isRoundPaused && (timing.isTalking || timing.isTransition));
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [selectedConclave, personsPerTable, isUpcoming, isCompleted, statusLower, timerRunning, isRoundPaused]);

  const [toast, setToast] = useState(null);
  const showToast = (title, desc) => {
    setToast({ title, desc });
    setTimeout(() => setToast(null), 3000);
  };

  // Audio chime state
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const lastChimeRef = useRef(null);

  // Web Audio API chime synthesizer (realistic brass bell gong sound, zero MP3 dependency)
  const playBellSound = (mode = 'chime') => {
    if (!isSoundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const freqs = mode === 'double' ? [523.25, 659.25, 783.99] : mode === 'single' ? [659.25] : [659.25, 987.77];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.18);

        gain.gain.setValueAtTime(0.35, now + idx * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 1.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.18);
        osc.stop(now + idx * 0.18 + 2.0);
      });
    } catch (err) {
      console.warn("Could not play bell sound:", err);
    }
  };

  // Manual local timer tick for unlinked / simulated countdowns
  useEffect(() => {
    let timer = null;
    const hasRemoteStart = Boolean(selectedConclave?.currentRoundStartedAt);
    if (!hasRemoteStart && timerRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [timerRunning, timeLeft, selectedConclave?.currentRoundStartedAt]);

  const prevPhaseRef = useRef(timingState.phase);

  // Auto bell chimes for phase transitions: Talking Time over -> Referrals -> Move to Next Table -> Round End
  useEffect(() => {
    if (!timerRunning) return;

    if (prevPhaseRef.current !== timingState.phase) {
      if (prevPhaseRef.current === 'active' && timingState.phase === 'referral') {
        playBellSound('double');
        showToast('Talking Time Concluded', `Speaking rounds finished! ${formatTime(timingState.referralSecs)} referral exchange window is now open.`);
      } else if (prevPhaseRef.current === 'referral' && timingState.phase === 'transition') {
        playBellSound('double');
        showToast('Referral Window Closed', `Referrals closed! ${formatTime(timingState.transitionSecs)} transition window to move to next table.`);
      } else if (prevPhaseRef.current === 'transition' && timingState.phase === 'ended') {
        playBellSound('double');
        showToast('Round Ended', 'The 15-minute round has officially concluded.');
      }
      prevPhaseRef.current = timingState.phase;
    }
  }, [timingState.phase, timingState.referralSecs, timingState.transitionSecs, timerRunning]);


  // Top 3 referrals leaderboard
  const leaderboard = useMemo(() => {
    const counts = {};
    filteredReferrals.forEach(r => {
      const giverId = r.fromMemberId || r.fromUserId || r.fromName || r.giverId || r.giverName;
      if (!giverId) return;
      if (!counts[giverId]) {
        const participant = selectedConclave?.participants?.find(p =>
          p.id === r.fromMemberId ||
          p.uid === r.fromMemberId ||
          p.id === r.fromUserId ||
          p.uid === r.fromUserId ||
          (p.name && r.fromName && p.name.toLowerCase().trim() === r.fromName.toLowerCase().trim())
        );
        const resolvedName = (r.fromName && r.fromName !== 'Unknown' && r.fromName !== 'Unknown Member')
          ? r.fromName
          : (participant?.name || r.giverName || 'Member');
        counts[giverId] = {
          name: resolvedName,
          category: participant?.businessCategory || r.fromCategory || 'BNI Member',
          count: 0
        };
      }
      counts[giverId].count++;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [filteredReferrals, selectedConclave]);


  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Automatic Round Progression State
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
  const [autoStartCountdown, setAutoStartCountdown] = useState(null);
  const autoAdvancingRoundRef = useRef(null);
  const autoStartTimerRef = useRef(null);

  // Clear countdown when activeRound changes or conclave finishes
  useEffect(() => {
    if (autoStartTimerRef.current) {
      clearInterval(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }
    setAutoStartCountdown(null);
  }, [activeRound, statusLower]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoStartTimerRef.current) {
        clearInterval(autoStartTimerRef.current);
      }
    };
  }, []);

  // Automatic round progression effect:
  // Starts next round automatically when previous round completes
  useEffect(() => {
    if (!autoAdvanceEnabled) return;
    if (statusLower !== 'running') return;
    if (activeRound < 1) return; // Round 1 must be started manually by the admin!

    const isRoundEnded = Boolean(
      timingState.phase === 'ended' ||
      timingState.isEnded ||
      (timingState.totalRemaining !== undefined && timingState.totalRemaining <= 0 && timingState.phase !== 'active' && timingState.phase !== 'referral')
    );

    if (isRoundEnded) {
      if (activeRound < totalRounds) {
        const nextRoundNum = activeRound + 1;
        if (autoAdvancingRoundRef.current === activeRound) return;
        autoAdvancingRoundRef.current = activeRound;

        let count = 5;
        setAutoStartCountdown(count);

        if (autoStartTimerRef.current) clearInterval(autoStartTimerRef.current);
        autoStartTimerRef.current = setInterval(() => {
          count -= 1;
          if (count <= 0) {
            clearInterval(autoStartTimerRef.current);
            autoStartTimerRef.current = null;
            setAutoStartCountdown(null);
            handleStartNextRound(nextRoundNum);
          } else {
            setAutoStartCountdown(count);
          }
        }, 1000);
      } else if (activeRound >= totalRounds) {
        if (autoAdvancingRoundRef.current === `finished-${activeRound}`) return;
        autoAdvancingRoundRef.current = `finished-${activeRound}`;

        let count = 5;
        setAutoStartCountdown(count);

        if (autoStartTimerRef.current) clearInterval(autoStartTimerRef.current);
        autoStartTimerRef.current = setInterval(() => {
          count -= 1;
          if (count <= 0) {
            clearInterval(autoStartTimerRef.current);
            autoStartTimerRef.current = null;
            setAutoStartCountdown(null);
            handleFinishConclave();
          } else {
            setAutoStartCountdown(count);
          }
        }, 1000);
      }
    }
  }, [timingState.phase, timingState.isEnded, timingState.totalRemaining, activeRound, totalRounds, statusLower, autoAdvanceEnabled]);

  // Start next round trigger (supports manual click and automated progression)
  const handleStartNextRound = async (customRoundNum = null) => {
    if (autoStartTimerRef.current) {
      clearInterval(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }
    setAutoStartCountdown(null);

    const nextRoundVal = customRoundNum !== null ? customRoundNum : (activeRound + 1);
    const now = new Date();

    // Optimistically start timer instantly on button click
    setConclaves(prev => prev.map(c => {
      if (c.id === selectedConclaveId) {
        return {
          ...c,
          currentRound: nextRoundVal,
          currentRoundStartedAt: now,
          status: 'Running'
        };
      }
      return c;
    }));
    setTimerRunning(true);
    setTimeLeft(ROUND_BLOCK_DURATION_SECS);

    try {
      await api.post(`/admin/conclaves/${selectedConclaveId}/start-round`, {
        roundNumber: nextRoundVal
      });
      // Reload conclaves from Express backend API to sync states
      const data = await api.get('/admin/conclaves');
      if (Array.isArray(data)) setConclaves(data);
      playBellSound('double');
      showToast('Round Started', `Round ${nextRoundVal} is live! Captains & members synced.`);
    } catch (err) {
      console.error("Failed to start round:", err);
      autoAdvancingRoundRef.current = null; // allow retry
      showToast('Start Round Failed', err.message || "Could not start next round.");
    }
  };

  // Finish conclave trigger
  const handleFinishConclave = async () => {
    if (autoStartTimerRef.current) {
      clearInterval(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }
    setAutoStartCountdown(null);

    // Optimistically update conclave status to completed
    setConclaves(prev => prev.map(c => {
      if (c.id === selectedConclaveId) {
        return {
          ...c,
          status: 'completed',
          currentRound: totalRounds
        };
      }
      return c;
    }));
    setTimerRunning(false);
    setTimeLeft(0);
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });

    try {
      await api.post(`/admin/conclaves/${selectedConclaveId}/complete`);
      // Reload conclaves from Express backend API to sync states
      const data = await api.get('/admin/conclaves');
      if (Array.isArray(data)) setConclaves(data);
      showToast('Conclave Concluded', 'Live conclave completed successfully.');
    } catch (err) {
      console.error("Failed to conclude conclave:", err);
      autoAdvancingRoundRef.current = null;
      showToast('Conclude Failed', err.message || "Could not complete conclave.");
    }
  };

  // Pause active round
  const handlePauseRound = async () => {
    try {
      setConclaves(prev => prev.map(c => {
        if (c.id === selectedConclaveId) {
          return {
            ...c,
            isRoundPaused: true,
            roundPausedAt: new Date(),
          };
        }
        return c;
      }));

      await api.post(`/admin/conclaves/${selectedConclaveId}/pause-round`);
      const data = await api.get('/admin/conclaves');
      if (Array.isArray(data)) setConclaves(data);
      showToast('Round Paused', `Round ${activeRound} timer is now paused.`);
    } catch (err) {
      console.error("Failed to pause round:", err);
      showToast('Pause Failed', err.message || "Could not pause round.");
    }
  };

  // Resume paused round
  const handleResumeRound = async () => {
    try {
      setConclaves(prev => prev.map(c => {
        if (c.id === selectedConclaveId) {
          return {
            ...c,
            isRoundPaused: false,
            roundPausedAt: null,
            roundElapsedMsBeforePause: null,
          };
        }
        return c;
      }));

      await api.post(`/admin/conclaves/${selectedConclaveId}/resume-round`);
      const data = await api.get('/admin/conclaves');
      if (Array.isArray(data)) setConclaves(data);
      playBellSound('single');
      showToast('Round Resumed', `Round ${activeRound} timer has resumed.`);
    } catch (err) {
      console.error("Failed to resume round:", err);
      showToast('Resume Failed', err.message || "Could not resume round.");
    }
  };

  // Close current round
  const handleCloseRound = async () => {
    if (!window.confirm(`Close Round ${activeRound}? This will conclude the current round.`)) {
      return;
    }
    try {
      await api.post(`/admin/conclaves/${selectedConclaveId}/close-round`);
      const data = await api.get('/admin/conclaves');
      if (Array.isArray(data)) setConclaves(data);
      playBellSound('double');
      showToast('Round Concluded', `Round ${activeRound} has been closed.`);
    } catch (err) {
      console.error("Failed to close round:", err);
      showToast('Close Round Failed', err.message || "Could not close round.");
    }
  };


  return (
    <div className={`w-full flex flex-col gap-6 animate-fade-in relative ${isHubMode ? '' : 'p-4 sm:p-6 max-w-[1600px] mx-auto'}`}>

      {/* Header Section */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isHubMode ? 'pb-1' : 'border-b border-zinc-100 pb-6'}`}>
        {!isHubMode && (
          <div>
            <h2 className="text-dashboard-title text-zinc-950 font-extrabold tracking-tight">Round Runner</h2>
            <p className="text-body-text text-zinc-500 mt-2">
              Live control for <span className="font-bold text-brand-red">{conclaveName}</span>.
            </p>
          </div>
        )}

        <div className={`flex flex-wrap items-center gap-3 shrink-0 ${isHubMode ? 'ml-auto' : ''}`}>
          {!['completed', 'cancelled'].includes(statusLower) && (
            <>
              {activeRound > 0 && (
                <button
                  type="button"
                  onClick={() => setAutoAdvanceEnabled(prev => !prev)}
                  title="Toggle automatic progression between rounds"
                  className={`inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border text-xs font-bold transition-smooth cursor-pointer ${autoAdvanceEnabled
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 shadow-2xs'
                    : 'bg-zinc-100 border-zinc-250 text-zinc-600 hover:bg-zinc-150'
                    }`}
                >
                  <Sparkles className={`w-3.5 h-3.5 ${autoAdvanceEnabled ? 'text-emerald-600 animate-pulse' : 'text-zinc-400'}`} />
                  <span>Auto-Advance: {autoAdvanceEnabled ? 'ON' : 'PAUSED'}</span>
                </button>
              )}

              {activeRound === 0 ? (
                <button
                  onClick={() => handleStartNextRound(1)}
                  type="button"
                  className="inline-flex items-center justify-center gap-2 h-10 px-5 bg-brand-red hover:bg-red-750 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-smooth shadow-md cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Round 1</span>
                </button>
              ) : (
                <>
                  {isRoundPaused ? (
                    <button
                      onClick={handleResumeRound}
                      type="button"
                      className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-smooth shadow-md cursor-pointer"
                      title="Resume the active round timer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Resume</span>
                    </button>
                  ) : (
                    <button
                      onClick={handlePauseRound}
                      type="button"
                      className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-smooth shadow-md cursor-pointer"
                      title="Pause the active round timer"
                    >
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Pause</span>
                    </button>
                  )}

                  {activeRound < (selectedConclave?.roundCount || 4) && (
                    <button
                      onClick={() => handleStartNextRound()}
                      type="button"
                      className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-white border border-zinc-250 hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded-xl transition-smooth shadow-2xs cursor-pointer"
                      title="Manually force-start the next round now"
                    >
                      <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin-slow" />
                      <span>Start Round {activeRound + 1}</span>
                    </button>
                  )}

                  <button
                    onClick={handleCloseRound}
                    type="button"
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-300 text-xs font-bold rounded-xl transition-smooth cursor-pointer"
                    title={`Close active Round ${activeRound}`}
                  >
                    <Square className="w-3.5 h-3.5 fill-zinc-500 text-zinc-500" />
                    <span>Close Round</span>
                  </button>

                  <button
                    onClick={handleFinishConclave}
                    type="button"
                    className="inline-flex items-center justify-center gap-2 h-10 px-5 bg-brand-red hover:bg-red-750 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-smooth shadow-md cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Finish Conclave</span>
                  </button>
                </>
              )}
            </>
          )}
          {onNavigateToReview && (
            <button
              onClick={onNavigateToReview}
              type="button"
              className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-250 text-xs font-bold rounded-xl transition-smooth shadow-2xs cursor-pointer"
              title="Inspect member seating and table assignments in review matrix"
            >
              <span>Review Table Matrix</span>
            </button>
          )}
        </div>
      </div>

      {/* Auto-Start Countdown Banner */}
      {autoStartCountdown !== null && (
        <div className="p-4 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-orange-500/10 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-800 shrink-0">
              <Sparkles className="w-5 h-5 animate-spin-slow text-amber-700" />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                {activeRound < totalRounds ? `Round ${activeRound} Concluded` : 'All Rounds Concluded'}
              </h4>
              <p className="text-body-xs text-amber-900 font-semibold mt-0.5">
                {activeRound < totalRounds
                  ? `Round ${activeRound + 1} will start automatically in ${autoStartCountdown} second${autoStartCountdown === 1 ? '' : 's'}...`
                  : `Live conclave will conclude automatically in ${autoStartCountdown} second${autoStartCountdown === 1 ? '' : 's'}...`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => {
                if (autoStartTimerRef.current) clearInterval(autoStartTimerRef.current);
                setAutoStartCountdown(null);
                if (activeRound < totalRounds) {
                  handleStartNextRound(activeRound + 1);
                } else {
                  handleFinishConclave();
                }
              }}
              type="button"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-lg shadow-2xs transition-smooth cursor-pointer"
            >
              {activeRound < totalRounds ? `Start Round ${activeRound + 1} Now` : 'Finish Now'}
            </button>
          </div>
        </div>
      )}

      {/* Completed Conclave Notice */}
      {['completed', 'cancelled'].includes(statusLower) && (
        <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-900 text-xs font-bold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
            <span>This conclave is <strong>{formatStatus(selectedConclave?.status) || 'Completed'}</strong>. Live timer controls and round advancement are disabled.</span>
          </div>
          <span className="px-2.5 py-1 bg-emerald-200/60 rounded text-[9.5px] font-black uppercase tracking-wider text-emerald-950">Conclave Completed</span>
        </div>
      )}

      {/* Status & KPI cards — Full Width */}
      <div className="bg-white border border-zinc-200/80 rounded-xl p-5 sm:p-6 shadow-sm space-y-6 w-full">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-4">
            <div className={`px-3.5 py-1.5 rounded-lg border ${isCompleted ? 'bg-zinc-100 text-zinc-700 border-zinc-250' : 'bg-red-50 text-brand-red border-red-100'}`}>
              <p className="text-[8px] font-bold uppercase tracking-wider">{isCompleted ? 'Conclave Status' : 'Current Stage'}</p>
              <p className="text-body-sm font-bold mt-0.5">{isCompleted ? `Completed (${totalRounds}/${totalRounds} Rounds)` : `Round ${activeRound} of ${totalRounds}`}</p>
            </div>
            {isCompleted ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Completed ({totalRounds}/{totalRounds})
              </div>
            ) : isUpcoming ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-100 rounded-full text-[10px] font-bold uppercase">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                Upcoming (0/{totalRounds})
              </div>
            ) : isRoundPaused ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-full text-[10px] font-bold uppercase">
                <Pause className="w-3 h-3 fill-amber-600 text-amber-600" />
                Round {activeRound} Paused
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-full text-[10px] font-bold uppercase">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Running
              </div>
            )}
          </div>

          <div className="text-left sm:text-right">
            <p className="text-[9px] text-zinc-455 font-bold uppercase tracking-wider mb-1">Global Completion</p>
            <div className="w-56 h-2 rounded-full overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={[{ value: progressPercent }]} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <Bar dataKey="value" fill="#af101a" radius={[3, 3, 3, 3]} background={{ fill: '#f4f4f5' }} barSize={8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[9px] text-zinc-400 font-bold mt-1">{progressPercent}% Complete</p>
          </div>
        </div>

        {/* KPI Overview row — 5 cards spanning full width */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white border border-zinc-200/80 p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <RefreshCw className="w-5 h-5 text-brand-red mb-2" />
            <div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase">{isCompleted ? 'Total Rounds' : 'Active Round'}</p>
              <h4 className="text-headline-md font-extrabold text-zinc-955 mt-1">{isCompleted ? `${totalRounds} / ${totalRounds}` : `${activeRound} / ${totalRounds}`}</h4>
            </div>
          </div>

          <div className="bg-white border border-zinc-200/80 p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <Grid className="w-5 h-5 text-brand-red mb-2" />
            <div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase">Running Tables</p>
              <h4 className="text-headline-md font-extrabold text-zinc-955 mt-1">
                {selectedConclave?.scheduleSummary?.tableCount || stats?.counts?.captains || 0}
              </h4>
            </div>
          </div>

          <div className="bg-white border border-zinc-200/85 p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <Users className="w-5 h-5 text-brand-red mb-2" />
            <div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase">Members</p>
              <h4 className="text-headline-md font-extrabold text-zinc-955 mt-1">
                {stats?.counts?.members !== undefined
                  ? stats.counts.members
                  : (stats?.counts?.registered !== undefined
                    ? (stats.counts.registered - (stats.counts.captains || 0))
                    : (selectedConclave?.participants?.filter(p => p.role !== 'captain')?.length || selectedConclave?.participants?.length || 0))}
              </h4>
            </div>
          </div>

          <div className="bg-white border border-zinc-200/80 p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <Shield className="w-5 h-5 text-brand-red mb-2" />
            <div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase">Captains Active</p>
              <h4 className="text-headline-md font-extrabold text-zinc-955 mt-1">
                {stats?.counts?.captains !== undefined
                  ? stats.counts.captains
                  : (selectedConclave?.participants?.filter(p => p.role === 'captain')?.length || selectedConclave?.scheduleSummary?.tableCount || 0)}
              </h4>
            </div>
          </div>

          <div className="bg-white border border-zinc-200/80 p-4 rounded-xl shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
            <Send className="w-5 h-5 text-brand-red mb-2" />
            <div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase">Total Referrals</p>
              <h4 className="text-headline-md font-extrabold text-zinc-950 mt-1">
                {stats?.counts?.referrals || 0}
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* Large Round Seating Timer — Placed Directly Below Stat Cards */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col w-full">
        <div className="flex justify-between items-center border-b border-zinc-100 pb-3 mb-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${timingState.phase === 'active' ? 'bg-emerald-400' : 'bg-brand-red'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${timingState.phase === 'active' ? 'bg-emerald-500' : 'bg-brand-red'}`}></span>
            </span>
            <h3 className="text-title-lg font-extrabold text-zinc-955 uppercase tracking-wide">
              Round Seating Timer
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => playBellSound('chime')}
              title="Test 5-Minute Bell Sound"
              className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-amber-100 transition-smooth cursor-pointer shadow-2xs"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Test Bell
            </button>
            <button
              onClick={() => setIsSoundEnabled(!isSoundEnabled)}
              title={isSoundEnabled ? "Mute Bell Sound" : "Enable Bell Sound"}
              className={`p-1.5 rounded-lg border transition-smooth cursor-pointer ${isSoundEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-zinc-100 text-zinc-400 border-zinc-200'
                }`}
            >
              {isSoundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="w-full flex flex-col items-center justify-center bg-zinc-50/70 rounded-2xl border border-dashed border-zinc-200/90 py-8 px-4 sm:px-8 text-center">
          {/* Phase Badge */}
          <div className="mb-3">
            {isCompleted ? (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Conclave Completed ({totalRounds}/{totalRounds} Rounds)
              </span>
            ) : isRoundPaused ? (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500 text-white shadow-md animate-pulse">
                <Pause className="w-3.5 h-3.5 fill-current" />
                Round {activeRound} Paused
              </span>
            ) : timingState.phase === 'active' ? (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Talking Time ({formatTime(timingState.phaseRemaining)} left)
              </span>
            ) : timingState.phase === 'referral' ? (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs animate-pulse">
                <Send className="w-4 h-4 text-blue-600" />
                Referral Window ({formatTime(timingState.phaseRemaining)} left)
              </span>
            ) : timingState.phase === 'transition' ? (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                Move to Next Table ({formatTime(timingState.phaseRemaining)} left)
              </span>
            ) : timingState.phase === 'ended' ? (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs animate-pulse">
                <Sparkles className="w-4 h-4 text-amber-600" />
                {autoStartCountdown !== null
                  ? (activeRound < totalRounds ? `Auto-starting Round ${activeRound + 1} in ${autoStartCountdown}s` : `Auto-concluding in ${autoStartCountdown}s`)
                  : (activeRound < totalRounds ? `Round Finished · Auto-advancing` : 'All Rounds Finished')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-zinc-100 text-zinc-600 border border-zinc-250">
                15-Minute Round Ready
              </span>
            )}
          </div>

          {/* Large Main Digital Clock */}
          <div className={`text-[96px] sm:text-[132px] md:text-[148px] leading-none font-black tabular-nums tracking-tight select-none my-2 drop-shadow-xs ${
            isCompleted
              ? 'text-zinc-350'
              : isRoundPaused
                ? 'text-amber-500'
                : timingState.phase === 'active'
                  ? 'text-emerald-600'
                  : timingState.phase === 'referral'
                    ? 'text-blue-600'
                    : timingState.phase === 'transition'
                      ? 'text-amber-600'
                      : 'text-brand-red'
          }`}>
            {isCompleted ? '00:00' : formatTime(timeLeft)}
          </div>

          {/* Speaker Progression / Phase Breakdown */}
          {isCompleted ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 my-2 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Conclave Complete · Attendance & Referral Records Finalized</span>
            </div>
          ) : timingState.phase === 'active' && !isRoundPaused ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 my-2 shadow-2xs">
              <span className="font-extrabold">Speaker {timingState.speakerNumber} of {timingState.personsPerTable}</span>
              <span className="text-emerald-300">•</span>
              <span className="font-bold">{formatTime(timingState.speakerTimeLeft)} in 60s turn</span>
            </div>
          ) : null}

          {timingState.phase === 'referral' && !isRoundPaused && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-blue-200 rounded-xl text-xs font-bold text-blue-800 my-2 shadow-2xs animate-pulse">
              <Send className="w-4 h-4 text-blue-600" />
              <span>Referral Window ({formatTime(timingState.phaseRemaining)} left)</span>
            </div>
          )}

          {timingState.phase === 'transition' && !isRoundPaused && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-amber-200 rounded-xl text-xs font-bold text-amber-800 my-2 shadow-2xs">
              <span>Table Rotation Window</span>
            </div>
          )}

          {/* Table Timing Breakdown formula */}
          <p className="text-xs sm:text-[13px] text-zinc-500 font-bold uppercase tracking-wider mt-3">
            {timingState.personsPerTable} Seats · {Math.round(timingState.activeSecs / 60)}m Talking (1m/ea) + {(timingState.referralSecs / 60).toFixed(1)}m Referrals (30s/ea) + {Math.round(timingState.transitionSecs / 60)}m Transition
          </p>

          {/* Admin Round Controls: Start, Pause, Resume, Close */}
          {!['completed', 'cancelled'].includes(statusLower) && (
            <div className="flex flex-wrap items-center justify-center gap-3 mt-6 pt-5 border-t border-zinc-200/80 w-full max-w-2xl">
              {activeRound === 0 ? (
                <button
                  type="button"
                  onClick={() => handleStartNextRound(1)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-brand-red hover:bg-red-750 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-smooth shadow-md cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Round 1</span>
                </button>
              ) : (
                <>
                  {isRoundPaused ? (
                    <button
                      type="button"
                      onClick={handleResumeRound}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-smooth shadow-md cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Resume</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePauseRound}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-smooth shadow-md cursor-pointer"
                    >
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Pause</span>
                    </button>
                  )}

                  {activeRound < totalRounds && (
                    <button
                      type="button"
                      onClick={() => handleStartNextRound()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded-xl transition-smooth shadow-2xs cursor-pointer"
                      title="Force start the next round"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Start Round {activeRound + 1}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCloseRound}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-300 text-xs font-bold rounded-xl transition-smooth cursor-pointer"
                    title={`Close active Round ${activeRound}`}
                  >
                    <Square className="w-3.5 h-3.5 fill-zinc-500 text-zinc-500" />
                    <span>Close Round</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFinishConclave}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-red hover:bg-red-750 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-smooth shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Finish Conclave</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Referrals & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 3 Referrals section */}
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between h-[300px]">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-2.5 flex-shrink-0">
            <h3 className="text-body-sm font-extrabold text-zinc-955 uppercase">Top 3 Referrals</h3>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded text-[9px] font-extrabold tracking-wider">
              ACTIVE ROUND
            </span>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {leaderboard.length === 0 ? (
              <div className="text-center py-6 text-zinc-400 font-semibold text-[10px]">
                No referrals logged yet for this conclave.
              </div>
            ) : (
              leaderboard.map((person, idx) => {
                const colors = [
                  { bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-300' }, // Gold
                  { bg: 'bg-zinc-400', text: 'text-zinc-500', border: 'border-zinc-300' },    // Silver
                  { bg: 'bg-amber-700/85', text: 'text-amber-700/85', border: 'border-amber-600/30' } // Bronze
                ];
                const c = colors[idx] || colors[2];
                return (
                  <div key={idx} className="bg-gradient-to-r from-zinc-50/10 to-white border border-zinc-150 rounded-lg p-2.5 flex items-center justify-between shadow-xs animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${c.bg} text-white rounded-full flex items-center justify-center font-black text-xs border ${c.border} shadow-sm`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-body-sm font-extrabold text-zinc-850">{person.name}</p>
                        <p className="text-[9px] text-zinc-455 font-bold uppercase tracking-wider">{person.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-body-sm font-extrabold ${c.text} leading-none`}>{person.count}</span>
                      <p className="text-[8px] text-zinc-400 font-bold uppercase mt-0.5">Referrals</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Referrals Analytics Pie Tracker — matching Dashboard layout */}
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between h-[300px]">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-2.5 flex-shrink-0">
            <h3 className="text-body-sm font-extrabold text-zinc-950 uppercase">Referrals Tracker</h3>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-100 rounded text-[9px] font-extrabold tracking-wider">
              ANALYTICS
            </span>
          </div>

          <div className="flex-1 flex flex-col sm:flex-row items-center gap-4 min-h-0">
            <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
              <PieChart width={112} height={112}>
                <Pie
                  data={referralChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={38}
                  outerRadius={46}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={referralChartData.length > 1 ? 3 : 0}
                  stroke="none"
                >
                  {referralChartData.map((entry, index) => (
                    <Cell key={`pie-cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl text-zinc-950 font-bold leading-none">{totalReferrals}</span>
                <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">Total</span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-1.5 overflow-y-auto">
              <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-zinc-200/60 shadow-xs">
                <span className="text-[10px] font-semibold text-zinc-500 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-brand-red rounded-full"></span> Connected
                </span>
                <span className="font-bold text-zinc-800 text-[11px]">{connectedReferrals}</span>
              </div>
              <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-zinc-200/60 shadow-xs">
                <span className="text-[10px] font-semibold text-zinc-500 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-amber-400 rounded-full"></span> Pending
                </span>
                <span className="font-bold text-zinc-800 text-[11px]">{pendingReferrals}</span>
              </div>
              <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-zinc-200/60 shadow-xs">
                <span className="text-[10px] font-semibold text-zinc-500 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-zinc-400 rounded-full"></span> Closed
                </span>
                <span className="font-bold text-zinc-800 text-[11px]">{closedReferrals}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Alert Feedback */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[70] bg-zinc-900 text-white text-[11px] font-bold py-2.5 px-4 rounded-lg shadow-xl flex items-center gap-2 border border-zinc-800 animate-slide-up">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-red"></span>
          <div>
            <p className="font-bold">{toast.title}</p>
            <p className="text-zinc-400 font-semibold mt-0.5">{toast.desc}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-white opacity-40 hover:opacity-100 ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
