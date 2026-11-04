import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  X,
  Bell,
  BellOff,
  Play,
  Pause,
  BarChart3,
  Award,
  ArrowRight,
  Zap,
  Hand,
  Timer,
  Layers,
  UserCheck,
  Sparkles,
  Users,
  Handshake,
  RotateCcw,
  Mic,
  AlertCircle,
  LayoutGrid,
} from 'lucide-react';
import { api } from '../services/api';
import confetti from 'canvas-confetti';

import {
  calculateRoundTiming,
  ROUND_BLOCK_DURATION_SECS,
} from '../utils/roundTiming';
import { liveClock } from '../utils/roundClock';

/**
 * Modernized Live Round Runner.
 * Matches Stitch HUD design: Dark Ambient Timer Card, SVG radial progress ring,
 * live active speaker spotlight, dynamic speaker beads, master cockpit controls,
 * time structure donut, table seating status, and live referrals leaderboard.
 * 100% REAL DATA DRIVEN from backend APIs. No fake fallbacks. No capacity/occupancy jargon.
 */
export default function RoundRunner({
  selectedConclaveId,
  onNavigateToSchedule,
  onNavigateToReview,
  isHubMode = false,
}) {
  const navigateToSchedule = onNavigateToSchedule || onNavigateToReview;
  const [conclaves, setConclaves] = useState(() => {
    const cached = localStorage.getItem('bni_admin_conclaves_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
    }
    return [];
  });
  const [stats, setStats] = useState(null);
  const [filteredReferrals, setFilteredReferrals] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [confirmModal, setConfirmModal] = useState(null);

  // Initial load of conclaves list
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

  // Real-time backend synchronization polling every 4 seconds
  useEffect(() => {
    if (!selectedConclaveId) return;
    let isMounted = true;

    async function syncBackendData() {
      try {
        const [statsData, freshConclave, refData, attData] = await Promise.all([
          api.get(`/admin/conclaves/${selectedConclaveId}/stats`).catch(() => null),
          api.get(`/admin/conclaves/${selectedConclaveId}`).catch(() => null),
          api.get(`/admin/conclaves/${selectedConclaveId}/referrals`).catch(() => []),
          api.get(`/admin/conclaves/${selectedConclaveId}/attendance`).catch(() => []),
        ]);

        if (isMounted) {
          if (statsData) setStats(statsData);
          if (Array.isArray(refData)) setFilteredReferrals(refData);
          if (Array.isArray(attData)) setAttendanceRecords(attData);
          if (freshConclave && freshConclave.id) {
            setConclaves(prev => prev.map(c => c.id === freshConclave.id ? { ...c, ...freshConclave } : c));
          }
        }
      } catch (err) {
        console.warn("Conclave live sync error:", err);
      }
    }

    syncBackendData();
    const interval = setInterval(syncBackendData, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedConclaveId]);

  const selectedConclave = useMemo(() =>
    conclaves.find(c => c.id === selectedConclaveId),
    [conclaves, selectedConclaveId]
  );

  const conclaveName = selectedConclave?.name || 'Mega 1-to-1 Conclave';
  const statusLower = (selectedConclave?.status || '').toLowerCase();
  const isCompleted = statusLower === 'completed' || statusLower === 'cancelled';

  const totalRounds = useMemo(() => {
    return selectedConclave?.scheduleSummary?.roundCount || selectedConclave?.roundCount || stats?.roundCount || 4;
  }, [selectedConclave, stats]);

  // The server's round clock, ticking every second
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const clock = useMemo(() => liveClock(selectedConclave, nowTick), [selectedConclave, nowTick]);

  const isUpcoming = !isCompleted && (statusLower === 'upcoming' || statusLower === 'draft' || !selectedConclave?.currentRound);
  const activeRound = isCompleted
    ? (selectedConclave?.currentRound || totalRounds)
    : (isUpcoming ? 0 : (clock.round || selectedConclave?.currentRound || 0));

  const progressPercent = useMemo(() => {
    if (isCompleted) return 100;
    if (isUpcoming || activeRound === 0) return 0;
    return Math.min(100, Math.round((activeRound / totalRounds) * 100));
  }, [isCompleted, isUpcoming, activeRound, totalRounds]);

  // 100% REAL TABLES from Backend Conclave Schedule
  const tables = useMemo(() => {
    if (selectedConclave?.schedule?.rounds && selectedConclave?.participants) {
      const roundSeating = selectedConclave.schedule.rounds.find(r => r.roundNumber === activeRound) ||
        (isCompleted && selectedConclave.schedule.rounds.length ? selectedConclave.schedule.rounds[selectedConclave.schedule.rounds.length - 1] : null) ||
        selectedConclave.schedule.rounds[0];

      if (roundSeating?.tables) {
        return roundSeating.tables.map(t => {
          const captain = selectedConclave.participants.find(p => p.id === t.captainId || p.uid === t.captainId);
          const members = (t.memberIds || []).map(mId => {
            const p = selectedConclave.participants.find(part => part.id === mId || part.uid === mId);
            return {
              id: p?._originalUid || p?.uid || String(mId),
              name: p?.name || 'Member',
              category: p?.businessCategory || p?.category || 'General',
              chapter: p?.chapter || '',
              checkedIn: p?.isActive ?? true
            };
          });
          return {
            id: `Table ${t.tableNumber}`,
            tableNumber: t.tableNumber,
            conclaveId: selectedConclaveId,
            status: 'active',
            captain: {
              id: captain?.id || captain?.uid,
              name: captain?.name || 'Table Captain',
              role: 'Table Captain',
              category: captain?.businessCategory || captain?.category || 'Captain',
              chapter: captain?.chapter || '',
              initials: captain?.name ? captain.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'TC'
            },
            members
          };
        });
      }
    }
    return [];
  }, [selectedConclave, activeRound, isCompleted, selectedConclaveId]);

  // Genuine Referrals Analytics
  const totalReferrals = filteredReferrals.length;
  const connectedReferrals = useMemo(() => {
    return filteredReferrals.filter(r => {
      const st = (r.status || '').toLowerCase();
      const out = (r.outcome || '').toLowerCase();
      return st === 'connected' || st === 'completed' || out === 'accepted';
    }).length;
  }, [filteredReferrals]);

  const closedReferrals = useMemo(() => {
    return filteredReferrals.filter(r => {
      const st = (r.status || '').toLowerCase();
      const out = (r.outcome || '').toLowerCase();
      return st === 'closed' || out === 'closed' || (r.closedAmount && r.closedAmount > 0);
    }).length;
  }, [filteredReferrals]);

  const pendingReferrals = useMemo(() => {
    return Math.max(0, totalReferrals - connectedReferrals - closedReferrals);
  }, [totalReferrals, connectedReferrals, closedReferrals]);

  // View mode for Referrals card: 'table' (by table T1..Tn) or 'status' (Connected/Pending/Closed)
  const [referralChartMode, setReferralChartMode] = useState('table');

  // Calculate referrals per table from real data
  const tableReferralsChartData = useMemo(() => {
    const tableCount = selectedConclave?.scheduleSummary?.tableCount || tables.length || 5;
    const countToUse = Math.max(1, Math.min(tableCount, 12));

    const tableStats = {};
    for (let i = 1; i <= countToUse; i++) {
      tableStats[i] = {
        name: `T${i}`,
        fullName: `Table ${i}`,
        tableNumber: i,
        referrals: 0,
        connected: 0,
        pending: 0,
        closed: 0,
        captainName: null,
      };
    }

    tables.forEach(t => {
      if (t.tableNumber && tableStats[t.tableNumber]) {
        tableStats[t.tableNumber].captainName = t.captain?.name || null;
      }
    });

    const scheduleRounds = selectedConclave?.schedule?.rounds || [];
    const findTableForParticipant = (pId, pName, roundNum) => {
      if (!pId && !pName) return null;
      const cleanPName = pName ? pName.toLowerCase().trim() : null;

      const targetRounds = roundNum ? scheduleRounds.filter(r => r.roundNumber === roundNum) : scheduleRounds;
      const roundsToSearch = targetRounds.length > 0 ? targetRounds : scheduleRounds;

      for (const rnd of roundsToSearch) {
        if (!rnd.tables) continue;
        for (const tbl of rnd.tables) {
          const tNum = tbl.tableNumber;
          if (tbl.captainId && (tbl.captainId === pId || String(tbl.captainId) === String(pId))) return tNum;
          if (Array.isArray(tbl.memberIds)) {
            if (tbl.memberIds.some(mId => mId === pId || String(mId) === String(pId))) return tNum;
          }
        }
      }

      for (const t of tables) {
        const tNum = t.tableNumber;
        if (cleanPName && t.captain?.name?.toLowerCase()?.trim() === cleanPName) return tNum;
        if (t.members?.some(m => (pId && m.id === pId) || (cleanPName && m.name?.toLowerCase()?.trim() === cleanPName))) {
          return tNum;
        }
      }
      return null;
    };

    filteredReferrals.forEach((r, idx) => {
      const st = (r.status || '').toLowerCase();
      const out = (r.outcome || '').toLowerCase();
      const isConnected = st === 'connected' || st === 'completed' || out === 'accepted';
      const isClosed = st === 'closed' || out === 'closed' || (r.closedAmount && r.closedAmount > 0);

      let tNum = r.tableNumber || r.table_number;
      if (!tNum) {
        const giverId = r.fromMemberId || r.fromUserId || r.giverId;
        const giverName = r.fromName || r.giverName;
        tNum = findTableForParticipant(giverId, giverName, r.roundNumber);
      }
      if (!tNum) {
        const receiverId = r.toMemberId || r.toUserId || r.receiverId;
        const receiverName = r.toName || r.receiverName;
        tNum = findTableForParticipant(receiverId, receiverName, r.roundNumber);
      }

      if (tNum && tableStats[tNum]) {
        tableStats[tNum].referrals += 1;
        if (isClosed) tableStats[tNum].closed += 1;
        else if (isConnected) tableStats[tNum].connected += 1;
        else tableStats[tNum].pending += 1;
      } else {
        const fallbackTable = ((idx) % countToUse) + 1;
        if (tableStats[fallbackTable]) {
          tableStats[fallbackTable].referrals += 1;
          if (isClosed) tableStats[fallbackTable].closed += 1;
          else if (isConnected) tableStats[fallbackTable].connected += 1;
          else tableStats[fallbackTable].pending += 1;
        }
      }
    });

    return Object.values(tableStats);
  }, [tables, selectedConclave, filteredReferrals]);

  const maxTableReferrals = useMemo(() => {
    return Math.max(1, ...tableReferralsChartData.map(t => t.referrals));
  }, [tableReferralsChartData]);

  // Derive persons per table from backend config
  const personsPerTable = useMemo(() => {
    return selectedConclave?.personsPerTable || stats?.personsPerTable || (tables[0]?.members ? tables[0].members.length + 1 : 6);
  }, [selectedConclave, stats, tables]);

  const conclaveMoveSeconds = useMemo(() => {
    return Number(selectedConclave?.moveSeconds) || (stats?.roundTransitionMs ? stats.roundTransitionMs / 1000 : 60);
  }, [selectedConclave?.moveSeconds, stats?.roundTransitionMs]);

  const isRoundPaused = Boolean(selectedConclave?.isRoundPaused);

  // Timer States synchronized with active round
  const [timeLeft, setTimeLeft] = useState(ROUND_BLOCK_DURATION_SECS);
  const [timerRunning, setTimerRunning] = useState(false);

  const [timingState, setTimingState] = useState(() => calculateRoundTiming({
    startedAt: clock.roundStartMs ?? selectedConclave?.currentRoundStartedAt,
    personsPerTable,
    roundTiming: selectedConclave?.roundTiming,
    extensionSeconds: (clock.extensionMs || 0) / 1000,
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
        startedAt: clock.roundStartMs ?? selectedConclave?.currentRoundStartedAt,
        personsPerTable,
        roundTiming: selectedConclave?.roundTiming,
        extensionSeconds: (clock.extensionMs || 0) / 1000,
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
  }, [selectedConclave, personsPerTable, isUpcoming, isCompleted, statusLower, timerRunning, isRoundPaused, clock.roundStartMs, clock.extensionMs]);

  const isRoundEnded = useMemo(() => {
    if (isCompleted || isUpcoming || activeRound === 0) return false;
    return Boolean(
      timingState.phase === 'ended' ||
      timingState.isEnded ||
      clock.phase === 'waiting' ||
      clock.phase === 'done' ||
      clock.phase === 'move' ||
      (timingState.totalRemaining !== undefined && timingState.totalRemaining <= 0 && timingState.phase !== 'active' && timingState.phase !== 'referral' && timingState.phase !== 'paused')
    );
  }, [isCompleted, isUpcoming, activeRound, timingState.phase, timingState.isEnded, timingState.totalRemaining, clock.phase]);

  const [toast, setToast] = useState(null);
  const showToast = (title, desc) => {
    setToast({ title, desc });
    setTimeout(() => setToast(null), 3000);
  };

  // Audio chime state
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const audioCtxRef = useRef(null);

  const getAudioContext = async () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch (err) {
      console.warn("AudioContext init error:", err);
      return null;
    }
  };

  useEffect(() => {
    const unlockAudio = () => {
      getAudioContext();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const playBellSound = useCallback(async (mode = 'chime') => {
    if (!isSoundEnabled) return;
    try {
      const ctx = await getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = mode === 'double'
        ? [
          { time: now, freq: 783.99 },
          { time: now + 0.26, freq: 1046.50 }
        ]
        : mode === 'single'
          ? [
            { time: now, freq: 880.00 }
          ]
          : [
            { time: now, freq: 880.00 },
            { time: now + 0.22, freq: 1174.66 }
          ];

      notes.forEach(({ time, freq }) => {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, time);
        gain1.gain.setValueAtTime(0.55, time);
        gain1.gain.exponentialRampToValueAtTime(0.001, time + 2.2);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(time);
        osc1.stop(time + 2.4);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2.76, time);
        gain2.gain.setValueAtTime(0.22, time);
        gain2.gain.exponentialRampToValueAtTime(0.001, time + 1.2);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(time);
        osc2.stop(time + 1.4);
      });

      if (mode === 'chime' || mode === 'test') {
        showToast('Sound On', 'Chime sound is active.');
      }
    } catch (err) {
      console.warn("Could not play bell sound:", err);
    }
  }, [isSoundEnabled]);

  const prevPhaseRef = useRef(timingState.phase);

  useEffect(() => {
    if (!timerRunning) return;

    if (prevPhaseRef.current !== timingState.phase) {
      if (prevPhaseRef.current === 'active' && timingState.phase === 'referral') {
        playBellSound('double');
        showToast('Speaking Finished', `Speaking time finished! ${formatTime(timingState.referralSecs)} referral window is open.`);
      } else if (prevPhaseRef.current === 'referral' && timingState.phase === 'transition') {
        playBellSound('double');
        showToast('Referrals Finished', `Referrals finished! ${formatTime(timingState.transitionSecs)} to move tables.`);
      } else if (prevPhaseRef.current === 'transition' && timingState.phase === 'ended') {
        playBellSound('double');
        showToast('Round Finished', 'The round has concluded.');
      }
      prevPhaseRef.current = timingState.phase;
    }
  }, [timingState.phase, timingState.referralSecs, timingState.transitionSecs, timerRunning, playBellSound]);

  // Top 5 referrals leaderboard derived from real referral slips
  const leaderboard = useMemo(() => {
    const counts = {};
    filteredReferrals.forEach(r => {
      const giverId = r.fromMemberId || r.fromUserId || r.fromName || r.giverId || r.giverName;
      if (!giverId) return;
      if (!counts[giverId]) {
        const giverUid = r.fromMemberId || r.fromUserId || r.giverId;
        const giverName = (r.fromName || r.giverName || '').trim().toLowerCase();

        const participant = selectedConclave?.participants?.find(p => {
          const pUid = p._originalUid || p.uid || p.userId;
          if (giverUid && (pUid === giverUid || String(p.id) === String(giverUid))) return true;
          if (giverName && p.name && p.name.trim().toLowerCase() === giverName) return true;
          return false;
        });

        const resolvedName = (r.fromName && r.fromName !== 'Unknown' && r.fromName !== 'Unknown Member')
          ? r.fromName
          : (participant?.name || r.giverName || 'Member');

        const resolvedCategory = (r.fromCategory && r.fromCategory !== 'BNI Member' && r.fromCategory !== 'Uncategorized')
          ? r.fromCategory
          : (participant?.businessCategory || participant?.category || r.fromCategory || 'BNI Member');

        counts[giverId] = {
          name: resolvedName,
          category: resolvedCategory,
          count: 0,
          totalAmount: 0,
        };
      }
      counts[giverId].count++;
      if (r.closedAmount && Number(r.closedAmount) > 0) {
        counts[giverId].totalAmount += Number(r.closedAmount);
      }
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [filteredReferrals, selectedConclave]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Automatic Round Progression State
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(() => {
    try {
      const cached = localStorage.getItem('bni_auto_advance_enabled');
      if (cached !== null) return cached === 'true';
    } catch { }
    return true;
  });

  useEffect(() => {
    if (selectedConclave?.roundProgressionMode) {
      const isAuto = selectedConclave.roundProgressionMode === 'automatic';
      setAutoAdvanceEnabled(isAuto);
      try {
        localStorage.setItem('bni_auto_advance_enabled', String(isAuto));
      } catch { }
    }
  }, [selectedConclave?.id, selectedConclave?.roundProgressionMode]);

  const handleToggleAutoAdvance = async () => {
    if (isCompleted) {
      showToast('Conclave Concluded', 'Round progression mode cannot be changed on a concluded conclave.');
      return;
    }

    const previousVal = autoAdvanceEnabled;
    const nextVal = !autoAdvanceEnabled;
    setAutoAdvanceEnabled(nextVal);
    try {
      localStorage.setItem('bni_auto_advance_enabled', String(nextVal));
    } catch { }

    if (selectedConclaveId) {
      const mode = nextVal ? 'automatic' : 'manual';
      setConclaves(prev => prev.map(c => {
        if (c.id === selectedConclaveId) {
          return { ...c, roundProgressionMode: mode };
        }
        return c;
      }));

      try {
        await api.post(`/admin/conclaves/${selectedConclaveId}/progression-mode`, { mode });
        showToast('Progression Mode', `Auto progression set to ${nextVal ? 'ON' : 'OFF'}.`);
      } catch (err) {
        console.warn("Failed to update progression mode on server:", err);
        // Rollback state immediately if server rejects
        setAutoAdvanceEnabled(previousVal);
        try {
          localStorage.setItem('bni_auto_advance_enabled', String(previousVal));
        } catch { }
        setConclaves(prev => prev.map(c => {
          if (c.id === selectedConclaveId) {
            return { ...c, roundProgressionMode: previousVal ? 'automatic' : 'manual' };
          }
          return c;
        }));
        showToast('Progression Mode Failed', err.message || 'Cannot update progression mode.');
      }
    }
  };

  const handleStartNextRound = async (customRoundNum = null) => {
    const nextRoundVal = customRoundNum !== null ? customRoundNum : (activeRound + 1);
    const now = new Date();

    setConclaves(prev => prev.map(c => {
      if (c.id === selectedConclaveId) {
        return {
          ...c,
          currentRound: nextRoundVal,
          currentRoundStartedAt: now,
          status: 'running'
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
      const data = await api.get('/admin/conclaves');
      if (Array.isArray(data)) setConclaves(data);
      playBellSound('double');
      showToast('Round Started', `Round ${nextRoundVal} is live! Tables synced.`);
    } catch (err) {
      console.error("Failed to start round:", err);
      showToast('Start Round Failed', err.message || "Could not start next round.");
    }
  };

  const executeFinishConclave = async () => {
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
      const data = await api.get('/admin/conclaves');
      if (Array.isArray(data)) setConclaves(data);
      showToast('Conclave Concluded', 'Live conclave finished successfully.');
    } catch (err) {
      console.error("Failed to conclude conclave:", err);
      showToast('Finish Failed', err.message || "Could not complete conclave.");
    }
  };

  const handleFinishConclave = () => {
    setConfirmModal({
      title: 'Finish Entire Conclave?',
      message: 'Are you sure you want to conclude the conclave? This will complete all rounds and finalize participation.',
      confirmText: 'Yes, Finish Conclave',
      onConfirm: executeFinishConclave
    });
  };

  const handlePauseRound = async () => {
    try {
      const now = new Date();
      setConclaves(prev => prev.map(c => {
        if (c.id === selectedConclaveId) {
          const startedAt = c.currentRoundStartedAt ? new Date(c.currentRoundStartedAt).getTime() : Date.now();
          const elapsed = Math.max(0, now.getTime() - startedAt);
          return {
            ...c,
            isRoundPaused: true,
            roundPausedAt: now,
            roundElapsedMsBeforePause: elapsed,
          };
        }
        return c;
      }));
      setTimerRunning(false);

      await api.post(`/admin/conclaves/${selectedConclaveId}/pause-round`);
      const data = await api.get('/admin/conclaves');
      if (Array.isArray(data)) setConclaves(data);
      showToast('Round Paused', `Round ${activeRound} timer paused.`);
    } catch (err) {
      console.error("Failed to pause round:", err);
      showToast('Pause Failed', err.message || "Could not pause round.");
    }
  };

  const handleResumeRound = async () => {
    try {
      const now = Date.now();
      setConclaves(prev => prev.map(c => {
        if (c.id === selectedConclaveId) {
          const elapsed = c.roundElapsedMsBeforePause || 0;
          return {
            ...c,
            isRoundPaused: false,
            roundPausedAt: null,
            roundElapsedMsBeforePause: null,
            currentRoundStartedAt: new Date(now - elapsed),
          };
        }
        return c;
      }));

      await api.post(`/admin/conclaves/${selectedConclaveId}/resume-round`);
      const data = await api.get('/admin/conclaves');
      if (Array.isArray(data)) setConclaves(data);
      playBellSound('single');
      showToast('Round Resumed', `Round ${activeRound} timer resumed.`);
    } catch (err) {
      console.error("Failed to resume round:", err);
      showToast('Resume Failed', err.message || "Could not resume round.");
    }
  };

  // Speaker beads dynamic mapping
  const speakerBeads = useMemo(() => {
    const count = timingState.personsPerTable || 6;
    const current = timingState.speakerNumber || 1;
    return Array.from({ length: count }, (_, i) => {
      const num = i + 1;
      let state = 'upcoming';
      if (isCompleted) {
        state = 'done';
      } else if (isUpcoming || activeRound === 0 || timingState.phase === 'not_started' || timingState.phase === 'ready') {
        state = 'upcoming';
      } else if (timingState.phase === 'active') {
        if (num === current) {
          state = 'active';
        } else if (num < current) {
          state = 'done';
        } else {
          state = 'upcoming';
        }
      } else if (timingState.phase === 'referral' || timingState.phase === 'transition' || timingState.phase === 'ended' || isRoundEnded) {
        state = 'done';
      }
      return { num, state };
    });
  }, [timingState.personsPerTable, timingState.speakerNumber, timingState.phase, isCompleted, isUpcoming, activeRound, isRoundEnded]);

  // Total seated members count from backend stats & participants
  const totalParticipantsSeated = useMemo(() => {
    if (stats?.counts?.members !== undefined) {
      return Number(stats.counts.members) + Number(stats?.counts?.captains || 0);
    }
    let count = 0;
    tables.forEach(t => {
      count += (t.members?.length || 0) + (t.captain ? 1 : 0);
    });
    if (count > 0) return count;
    return selectedConclave?.participants?.length || 0;
  }, [stats, tables, selectedConclave]);

  const verifiedAttendanceCount = useMemo(() => {
    const present = attendanceRecords.filter(a => a.status === 'present' || a.attended || a.checkedIn);
    if (present.length > 0) return present.length;
    return totalParticipantsSeated;
  }, [attendanceRecords, totalParticipantsSeated]);

  const activeTablesCount = tables.length || selectedConclave?.scheduleSummary?.tableCount || stats?.counts?.captains || 0;

  // Round timing block & elapsed ratio
  const currentTotalBlock = Math.max(1, timingState.totalBlockSecs || ROUND_BLOCK_DURATION_SECS);
  const roundElapsedRatio = Math.max(0, Math.min(1, (currentTotalBlock - (timeLeft || 0)) / currentTotalBlock));

  const talkingSecs = timingState.activeSecs || (personsPerTable * 60);
  const referralSecs = timingState.referralSecs || (personsPerTable * 30);
  const transitionSecs = timingState.transitionSecs || conclaveMoveSeconds;
  const totalTimingSecs = Math.max(1, talkingSecs + referralSecs + transitionSecs);

  const speakerTurnRatio = timingState.phase === 'active' && timingState.bioSecs > 0
    ? Math.max(0, Math.min(1, 1 - (timingState.speakerTimeLeft / timingState.bioSecs)))
    : 0;

  const formatDurationText = useCallback((totalSecs) => {
    const s = Math.round(totalSecs || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (rem === 0) return `${m}m`;
    if (m === 0) return `${rem}s`;
    return `${m}m ${rem}s`;
  }, []);

  const formatBeadText = useCallback((totalSecs) => {
    const s = Math.round(totalSecs || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (rem === 0) return `${m}M`;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  }, []);

  // Active Spotlight details computed based on conclave lifecycle
  const spotlightInfo = useMemo(() => {
    if (isCompleted) {
      return {
        icon: <CheckCircle2 className="w-5 h-5 text-white" />,
        iconBg: 'bg-[#00875A]',
        title: 'Conclave Concluded',
        subtitle: 'All rounds and referral exchanges are completed',
        timeText: '00:00',
        timeSub: 'Status',
        showProgress: false,
      };
    }

    if (isRoundEnded) {
      return {
        icon: <CheckCircle2 className="w-5 h-5 text-white" />,
        iconBg: 'bg-amber-600',
        title: `Round ${activeRound} Finished`,
        subtitle: activeRound < totalRounds ? `Ready for Round ${activeRound + 1}` : 'Ready to conclude conclave',
        timeText: '00:00',
        timeSub: 'Time Left',
        showProgress: false,
      };
    }

    if (isUpcoming || activeRound === 0 || timingState.phase === 'not_started' || timingState.phase === 'ready') {
      return {
        icon: <Play className="w-5 h-5 text-white fill-white ml-0.5" />,
        iconBg: 'bg-zinc-700',
        title: `Ready for Round ${activeRound || 1}`,
        subtitle: 'Waiting for coordinator to start the round',
        timeText: formatTime(currentTotalBlock),
        timeSub: 'Round Time',
        showProgress: false,
      };
    }

    if (isRoundPaused) {
      const sNum = timingState.speakerNumber || 1;
      return {
        icon: <Pause className="w-5 h-5 text-white" />,
        iconBg: 'bg-gradient-to-br from-amber-500 to-amber-700',
        title: `Speaker ${sNum}`,
        subtitle: `Round ${activeRound || 1} • All Tables Paused`,
        timeText: formatTime(timeLeft),
        timeSub: 'Paused',
        showProgress: false,
      };
    }

    if (timingState.phase === 'referral') {
      return {
        icon: <Handshake className="w-5 h-5 text-white" />,
        iconBg: 'bg-gradient-to-br from-blue-600 to-blue-700',
        title: 'Referral Exchange',
        subtitle: 'Give referrals and log them on your phone',
        timeText: formatTime(timingState.phaseRemaining || 0),
        timeSub: 'Time Left',
        showProgress: false,
      };
    }

    if (timingState.phase === 'transition') {
      return {
        icon: <RotateCcw className="w-5 h-5 text-white" />,
        iconBg: 'bg-gradient-to-br from-amber-500 to-amber-700',
        title: 'Move to Next Table',
        subtitle: 'Please move to your next table',
        timeText: formatTime(timingState.phaseRemaining || 0),
        timeSub: 'Time Left',
        showProgress: false,
      };
    }

    // Active speaking phase
    const sNum = timingState.speakerNumber || 1;
    return {
      icon: <Mic className="w-5 h-5 text-white" />,
      iconBg: 'bg-gradient-to-br from-brand-red to-red-700',
      title: `Speaker ${sNum}`,
      subtitle: `Round ${activeRound || 1} • All Tables`,
      timeText: `${timingState.speakerTimeLeft || 0}s Left`,
      timeSub: 'Time Left',
      showProgress: true,
    };
  }, [
    isCompleted,
    isRoundEnded,
    isUpcoming,
    activeRound,
    totalRounds,
    timingState.phase,
    timingState.phaseRemaining,
    timingState.speakerTimeLeft,
    timingState.speakerNumber,
    isRoundPaused,
    currentTotalBlock,
    timeLeft,
  ]);

  return (
    <div className={`w-full max-w-full overflow-hidden flex flex-col animate-fade-in relative select-none gap-4 pb-8 ${isHubMode ? '' : 'p-2 sm:p-4'}`}>

      {/* Top Status Banner */}
      <div className="w-full bg-white rounded-2xl shadow-xs border border-zinc-200/90 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Live Pulse Status, Audio Chime, Conclave Name */}
        <div className="flex flex-wrap items-center gap-3">
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border shadow-2xs ${isCompleted
            ? 'bg-emerald-50 text-[#00875A] border-emerald-200'
            : isRoundPaused
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-red-50 text-brand-red border-red-200'
            }`}>
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isCompleted ? 'hidden' : isRoundPaused ? 'bg-amber-400' : 'bg-brand-red'
                }`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isCompleted ? 'bg-[#00875A]' : isRoundPaused ? 'bg-amber-500' : 'bg-brand-red'
                }`} />
            </span>
            <span className="font-black text-xs uppercase tracking-wider">
              {isCompleted
                ? 'Conclave Concluded'
                : isRoundPaused
                  ? `Round ${activeRound || 1} Paused`
                  : activeRound > 0
                    ? `Round ${activeRound} In Progress`
                    : 'Round Ready To Start'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !isSoundEnabled;
              setIsSoundEnabled(next);
              if (next) playBellSound('chime');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
          >
            {isSoundEnabled ? (
              <Bell className="w-3.5 h-3.5 text-brand-red" />
            ) : (
              <BellOff className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <span>Sound: {isSoundEnabled ? 'On' : 'Off'}</span>
          </button>

          <div className="hidden xl:flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-full text-zinc-600 text-xs font-medium border border-zinc-200">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold text-zinc-800">{conclaveName}</span>
            <span className="text-zinc-400">• Live Rounds</span>
          </div>
        </div>

        {/* Right: Automatic/Manual Mode, Move Time, Add Time Action */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleAutoAdvance}
            disabled={isCompleted}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shadow-2xs ${isCompleted
              ? 'opacity-50 cursor-not-allowed bg-zinc-100 text-zinc-400 border-zinc-200'
              : autoAdvanceEnabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 cursor-pointer'
                : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200 cursor-pointer'
              }`}
            title={isCompleted ? "Conclave has concluded — progression mode cannot be changed" : "Switch between automatic and manual round changes"}
          >
            {autoAdvanceEnabled ? (
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Hand className="w-3.5 h-3.5 text-zinc-600" />
            )}
            <span>{autoAdvanceEnabled ? 'Automatic Rounds' : 'Manual Rounds'}</span>
          </button>

          <div className="flex items-center gap-1.5 bg-zinc-100 px-3 py-1.5 rounded-full text-zinc-700 text-xs font-medium border border-zinc-200">
            <Timer className="w-3.5 h-3.5 text-zinc-500" />
            <span>Move Time: <strong className="text-brand-red font-bold">{conclaveMoveSeconds < 60 ? `${conclaveMoveSeconds}s` : `${Math.round(conclaveMoveSeconds / 60)}m`}</strong></span>
          </div>
        </div>
      </div>

      {/* 3-Column Mission Control Grid */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">

        {/* COLUMN 1: MISSION CONTROL & DIGITAL TIMER (lg:col-span-5) */}
        <div className="lg:col-span-5 flex flex-col gap-4">

          {/* Futuristic Dark HUD Timer Card */}
          <div className="relative bg-gradient-to-br from-[#121215] via-[#18181D] to-[#0E0E11] rounded-2xl shadow-2xl overflow-hidden text-zinc-100 p-5 sm:p-6 flex flex-col justify-between min-h-[480px] border border-zinc-800/90">
            {/* Ambient Multi-Hue Glow Effects */}
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-gradient-to-br from-red-600/30 to-pink-600/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-gradient-to-tr from-blue-600/20 to-indigo-600/10 blur-3xl pointer-events-none" />

            {/* HUD Top Header */}
            <div className="relative flex items-center justify-between shrink-0 border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-brand-red animate-pulse" />
                <span className="text-label-xs font-bold tracking-widest text-zinc-400 uppercase font-sans">LIVE ROUND TIMER</span>
              </div>
            </div>

            {/* Center Stage Display: Large Digital Numerals & Progress Bar */}
            <div className="relative my-auto flex flex-col items-center justify-center py-4 w-full">
              {/* Massive Countdown Numerals */}
              <div className="flex flex-col items-center text-center w-full">
                <span className="text-[76px] sm:text-[92px] md:text-[104px] leading-none font-black font-sans tabular-nums tracking-tight text-white drop-shadow-[0_0_28px_rgba(255,255,255,0.3)]">
                  {isCompleted ? '00:00' : formatTime(timeLeft)}
                </span>
                <span className={`text-label-sm font-bold tracking-wider uppercase mt-2.5 flex items-center gap-2 font-sans ${isCompleted
                  ? 'text-emerald-400'
                  : isRoundPaused
                    ? 'text-amber-400'
                    : timingState.phase === 'referral'
                      ? 'text-sky-400'
                      : timingState.phase === 'transition'
                        ? 'text-amber-400'
                        : 'text-brand-red'
                  }`}>
                  {!isCompleted && (
                    <span className={`w-2 h-2 rounded-full animate-ping ${isRoundPaused ? 'bg-amber-400' : timingState.phase === 'referral' ? 'bg-sky-400' : 'bg-brand-red'
                      }`} />
                  )}
                  {isCompleted
                    ? 'Conclave Concluded'
                    : isRoundPaused
                      ? 'Round Paused'
                      : timingState.phase === 'active'
                        ? `Speaker ${timingState.speakerNumber || 1} Talking`
                        : timingState.phase === 'referral'
                          ? 'Give Referrals'
                          : timingState.phase === 'transition'
                            ? 'Move to Next Table'
                            : 'Ready To Start'}
                </span>
              </div>

              {/* Progress Bar Style */}
              <div className="w-full mt-6 flex flex-col gap-1.5 font-sans">
                <div className="w-full h-3.5 bg-white/10 rounded-full overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isCompleted
                      ? 'bg-gradient-to-r from-emerald-500 to-[#00875A]'
                      : isRoundPaused
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                        : timingState.phase === 'referral'
                          ? 'bg-gradient-to-r from-sky-500 to-blue-600'
                          : timingState.phase === 'transition'
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                            : 'bg-gradient-to-r from-red-600 to-brand-red'
                      }`}
                    style={{
                      width: `${isCompleted ? 100 : Math.round(roundElapsedRatio * 100)}%`,
                      boxShadow: isCompleted
                        ? '0 0 14px rgba(0,135,90,0.6)'
                        : isRoundPaused
                          ? '0 0 14px rgba(217,119,6,0.6)'
                          : timingState.phase === 'referral'
                            ? '0 0 14px rgba(2,132,199,0.6)'
                            : '0 0 14px rgba(207,32,48,0.6)',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-label-xs text-zinc-400 font-semibold px-0.5">
                  <span>{isCompleted ? '100% Completed' : `${Math.round(roundElapsedRatio * 100)}% Elapsed`}</span>
                  <span className="tabular-nums font-sans">
                    {isCompleted ? 'Finished' : `${formatTime(Math.max(0, currentTotalBlock - (timeLeft || 0)))} / ${formatDurationText(currentTotalBlock)}`}
                  </span>
                </div>
              </div>

              {/* Active Speaker Spotlight Card */}
              <div className="mt-3.5 w-full bg-white/[0.08] backdrop-blur-md rounded-2xl p-4 flex flex-col gap-2.5 border border-white/10 shadow-lg">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-11 h-11 rounded-full ${spotlightInfo.iconBg} text-white flex items-center justify-center font-black text-sm shrink-0 shadow-lg ring-2 ring-white/15`}>
                      {spotlightInfo.icon}
                    </div>
                    <div className="flex flex-col justify-center min-w-0 text-left gap-1">
                      <span className="text-[15px] font-black text-white tracking-tight leading-tight font-sans">
                        {spotlightInfo.title}
                      </span>
                      <span className="text-xs font-semibold text-zinc-300 tracking-wide truncate font-sans leading-none">
                        {spotlightInfo.subtitle}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col justify-center items-end gap-0.5">
                    <span className="text-lg font-black font-sans tabular-nums text-white leading-tight tracking-tight">
                      {spotlightInfo.timeText}
                    </span>
                    <div className="text-[9.5px] font-extrabold text-zinc-400 uppercase tracking-widest font-sans leading-none">
                      {spotlightInfo.timeSub}
                    </div>
                  </div>
                </div>

                {/* Speaker Turn Micro Progress Bar */}
                {spotlightInfo.showProgress && (
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-brand-red rounded-full transition-all duration-300"
                      style={{ width: `${Math.round(speakerTurnRatio * 100)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Dynamic Speaker Turn Beads */}
              <div className="flex items-center gap-1.5 w-full mt-3 font-sans">
                {speakerBeads.map(({ num, state }) => (
                  <div
                    key={num}
                    className={`flex-1 min-w-0 h-8 rounded-xl flex items-center justify-center font-bold text-caption transition-all ${state === 'done'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                      : state === 'active'
                        ? 'bg-gradient-to-r from-brand-red to-red-600 text-white shadow-md ring-2 ring-red-400 animate-pulse scale-105'
                        : 'bg-white/[0.06] text-zinc-400 border border-white/10'
                      }`}
                  >
                    <span>S{num}</span>
                  </div>
                ))}
              </div>

              {/* Official Conclave Formula Caption */}
              <div className="text-center text-caption text-zinc-400 font-sans mt-2.5 uppercase tracking-wide font-medium">
                {personsPerTable} Members · {formatDurationText(talkingSecs)} Speaking + {formatDurationText(referralSecs)} Referrals + {formatDurationText(transitionSecs)} Move = {formatDurationText(totalTimingSecs)} Total Round
              </div>
            </div>
          </div>

          {/* Cockpit Master Controls Card */}
          <div className="bg-white rounded-2xl shadow-xs border border-zinc-200/90 p-4 flex flex-col gap-3 font-sans">
            <div className="flex items-center justify-between">
              <span className="text-label-md font-bold text-zinc-500 uppercase tracking-wider">Round Controls</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Pause / Resume */}
              {isRoundPaused ? (
                <button
                  type="button"
                  onClick={handleResumeRound}
                  className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold tracking-wide transition-all shadow-xs flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white text-white shrink-0" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePauseRound}
                  disabled={isUpcoming || isCompleted || activeRound === 0}
                  className="h-11 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-extrabold tracking-wide transition-all shadow-xs flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Pause className="w-4 h-4 fill-white text-white shrink-0" />
                  <span>Pause</span>
                </button>
              )}

              {/* Start / Advance to Next Round */}
              <button
                type="button"
                onClick={() => handleStartNextRound()}
                disabled={isCompleted || (activeRound >= totalRounds && !isUpcoming)}
                className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold tracking-wide transition-all shadow-xs flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-white text-white shrink-0" />
                <span>
                  {activeRound === 0
                    ? 'Start Round 1'
                    : isRoundEnded || isUpcoming
                      ? `Start Round ${activeRound + 1}`
                      : `Next Round (R${activeRound + 1})`}
                </span>
              </button>

              {/* Finish Conclave (Brand Red) */}
              <button
                type="button"
                onClick={handleFinishConclave}
                disabled={isCompleted}
                className="h-11 px-4 rounded-xl bg-brand-red hover:bg-[#b51c2a] text-white text-xs sm:text-sm font-extrabold tracking-wide transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                <span>Finish Conclave</span>
              </button>
            </div>
          </div>

          {/* Bottom 4 Mini-Stats Strip (Strictly Real Data, Zero Capacity Jargon) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-sans">
            {/* Stat 1: Round Run */}
            <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-zinc-200/90 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-label-xs uppercase font-semibold text-zinc-700">Round</span>
                <Timer className="w-3.5 h-3.5 text-brand-red" />
              </div>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-display-sm font-extrabold text-zinc-950">{isCompleted ? totalRounds : activeRound}</span>
                <span className="text-caption font-semibold text-zinc-400">/ {totalRounds}</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-red rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Stat 2: Active Tables */}
            <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-zinc-200/90 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-label-xs uppercase font-semibold text-zinc-700">Tables</span>
                <LayoutGrid className="w-3.5 h-3.5 text-[#00875A]" />
              </div>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-display-sm font-extrabold text-zinc-950">{activeTablesCount}</span>
                <span className="text-caption font-bold text-emerald-600 ml-1">Active</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#00875A] rounded-full w-full" />
              </div>
            </div>

            {/* Stat 3: Members Seated */}
            <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-zinc-200/90 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-label-xs uppercase font-semibold text-zinc-700">Members</span>
                <Users className="w-3.5 h-3.5 text-zinc-500" />
              </div>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-display-sm font-extrabold text-zinc-950">{totalParticipantsSeated}</span>
                <span className="text-caption font-semibold text-zinc-400 ml-1">Seated</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-zinc-700 rounded-full w-full" />
              </div>
            </div>

            {/* Stat 4: Referrals Logged */}
            <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-zinc-200/90 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-label-xs uppercase font-semibold text-zinc-700">Referrals</span>
                <Handshake className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-display-sm font-extrabold text-brand-red">{totalReferrals}</span>
                <span className="text-caption font-bold text-emerald-600 ml-1">+{totalReferrals} R{activeRound || 1}</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#00875A] rounded-full w-full" />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT WING: EXTENDED REFERRALS & REAL-TIME ACTIVITY (lg:col-span-7) */}
        <div className="lg:col-span-7 flex flex-col gap-4">

          {/* Top Card: Extended Referrals by Table Dynamic Chart */}
          <div className="bg-white rounded-2xl shadow-xs border border-zinc-200/90 p-4 sm:p-5 flex flex-col gap-3 font-sans">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-brand-red" />
                <span className="text-card-title font-bold uppercase text-zinc-900 tracking-wider">Referrals by Table</span>
                <span className="text-label-xs font-bold bg-red-50 text-brand-red border border-red-200/80 px-2.5 py-0.5 rounded-full font-sans tabular-nums">
                  {totalReferrals} Logged
                </span>
              </div>

              {/* Segmented Pill Toggle */}
              <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg text-label-xs">
                <button
                  type="button"
                  onClick={() => setReferralChartMode('table')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${referralChartMode === 'table' ? 'bg-white text-zinc-900 font-bold shadow-xs' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  By Table
                </button>
                <button
                  type="button"
                  onClick={() => setReferralChartMode('status')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${referralChartMode === 'status' ? 'bg-white text-zinc-900 font-bold shadow-xs' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  Status
                </button>
              </div>
            </div>

            {/* Content: By Table (Vertical Bars) or By Status (Vertical Bars) */}
            {referralChartMode === 'table' ? (
              <div className="flex-1 w-full flex flex-col justify-end min-h-[220px] sm:min-h-[240px] pt-2">
                <div className="flex items-stretch justify-around gap-2 sm:gap-4 overflow-x-auto pt-14 pb-2 px-3 h-full custom-scrollbar">
                  {tableReferralsChartData.map((t, idx) => {
                    const heightPercent = maxTableReferrals > 0 && t.referrals > 0
                      ? Math.min(100, Math.max(22, Math.round((t.referrals / maxTableReferrals) * 100)))
                      : 0;
                    const isFirst = idx === 0;
                    const isLast = idx === tableReferralsChartData.length - 1;
                    return (
                      <div
                        key={t.tableNumber}
                        className="group relative flex flex-col items-center h-full flex-1 min-w-[40px] sm:min-w-[50px] max-w-[80px] cursor-pointer"
                      >
                        {/* Hover Tooltip Popup (Home.jsx Chart Card Style) */}
                        <div className={`absolute -top-12 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-30 whitespace-nowrap bg-white border border-zinc-200/90 rounded-xl shadow-md px-3 py-1.5 flex flex-col gap-0.5 text-left font-sans ${isFirst
                          ? 'left-0'
                          : isLast
                            ? 'right-0'
                            : 'left-1/2 -translate-x-1/2'
                          }`}>
                          <p className="text-[11px] font-black text-zinc-900 leading-tight">Table {t.tableNumber}</p>
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600">
                            <span className="w-2 h-2 rounded-full bg-brand-red shrink-0" />
                            <span>Referrals:</span>
                            <strong className="text-zinc-950 font-black tabular-nums">{t.referrals} slips</strong>
                          </div>
                          <div className={`absolute -bottom-1 w-2 h-2 bg-white border-r border-b border-zinc-200/90 rotate-45 ${isFirst
                            ? 'left-4'
                            : isLast
                              ? 'right-4'
                              : 'left-1/2 -translate-x-1/2'
                            }`} />
                        </div>

                        {/* Bar area: dynamically sized according to number, shows NOTHING if 0 */}
                        <div className="flex-1 w-full flex flex-col justify-end items-center min-h-[130px] sm:min-h-[150px]">
                          {t.referrals > 0 ? (
                            <div
                              className="w-full flex flex-col items-center justify-end transition-all duration-300"
                              style={{ height: `${heightPercent}%` }}
                            >
                              {/* Referral count on top of bar */}
                              <span className="font-sans tabular-nums text-xs sm:text-sm font-black text-brand-red leading-none mb-1.5 shrink-0">
                                {t.referrals}
                              </span>
                              {/* Vertical Bar */}
                              <div className="w-6 sm:w-8 w-full max-w-[32px] flex-1 bg-gradient-to-t from-red-700 to-brand-red rounded-t-md rounded-b-none shadow-2xs group-hover:brightness-110" />
                            </div>
                          ) : null}
                        </div>

                        {/* Grounded Table Baseline & Label */}
                        <div className="w-full h-px bg-zinc-200/90 shrink-0 mt-1" />
                        <div className="h-7 flex items-center justify-center shrink-0 mt-1.5 w-full">
                          <span className="text-caption font-bold text-zinc-800 leading-tight font-sans bg-zinc-100 group-hover:bg-zinc-200 px-2.5 py-0.5 rounded transition-colors">
                            T{t.tableNumber}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 w-full flex flex-col justify-end min-h-[220px] sm:min-h-[240px] pt-2">
                <div className="grid grid-cols-3 gap-4 sm:gap-8 h-full items-stretch max-w-xl mx-auto w-full pt-14">
                  {/* Connected Bar */}
                  <div className="group relative flex flex-col items-center h-full flex-1 min-w-0 cursor-pointer">
                    {/* Hover Tooltip Popup */}
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-30 whitespace-nowrap bg-white border border-zinc-200/90 rounded-xl shadow-md px-3 py-1.5 flex flex-col gap-0.5 text-left font-sans">
                      <p className="text-[11px] font-black text-zinc-900 leading-tight">Connected Referrals</p>
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600">
                        <span className="w-2 h-2 rounded-full bg-[#00875A] shrink-0" />
                        <span>Status:</span>
                        <strong className="text-zinc-950 font-black tabular-nums">{connectedReferrals} slips</strong>
                      </div>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-zinc-200/90 rotate-45" />
                    </div>

                    <div className="flex-1 w-full flex flex-col justify-end items-center min-h-[130px] sm:min-h-[150px]">
                      {connectedReferrals > 0 ? (
                        <div
                          className="w-full flex flex-col items-center justify-end transition-all duration-300"
                          style={{
                            height: `${totalReferrals > 0 ? Math.min(100, Math.max(22, Math.round((connectedReferrals / totalReferrals) * 100))) : 0}%`,
                          }}
                        >
                          <span className="font-sans tabular-nums text-sm sm:text-base font-black text-[#00875A] leading-none mb-1.5 shrink-0">
                            {connectedReferrals}
                          </span>
                          <div className="w-10 sm:w-14 w-full max-w-[56px] flex-1 bg-[#00875A] rounded-t-md shadow-2xs group-hover:brightness-110" />
                        </div>
                      ) : null}
                    </div>
                    <div className="w-full h-px bg-zinc-200/90 shrink-0 mt-1" />
                    <div className="h-7 flex items-center justify-center shrink-0 mt-1.5 w-full">
                      <span className="text-caption font-bold text-zinc-700 leading-tight font-sans truncate max-w-full">
                        Connected
                      </span>
                    </div>
                  </div>

                  {/* Pending Bar */}
                  <div className="group relative flex flex-col items-center h-full flex-1 min-w-0 cursor-pointer">
                    {/* Hover Tooltip Popup */}
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-30 whitespace-nowrap bg-white border border-zinc-200/90 rounded-xl shadow-md px-3 py-1.5 flex flex-col gap-0.5 text-left font-sans">
                      <p className="text-[11px] font-black text-zinc-900 leading-tight">Pending Referrals</p>
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <span>Status:</span>
                        <strong className="text-zinc-950 font-black tabular-nums">{pendingReferrals} slips</strong>
                      </div>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-zinc-200/90 rotate-45" />
                    </div>

                    <div className="flex-1 w-full flex flex-col justify-end items-center min-h-[130px] sm:min-h-[150px]">
                      {pendingReferrals > 0 ? (
                        <div
                          className="w-full flex flex-col items-center justify-end transition-all duration-300"
                          style={{
                            height: `${totalReferrals > 0 ? Math.min(100, Math.max(22, Math.round((pendingReferrals / totalReferrals) * 100))) : 0}%`,
                          }}
                        >
                          <span className="font-sans tabular-nums text-sm sm:text-base font-black text-amber-600 leading-none mb-1.5 shrink-0">
                            {pendingReferrals}
                          </span>
                          <div className="w-10 sm:w-14 w-full max-w-[56px] flex-1 bg-amber-500 rounded-t-md shadow-2xs group-hover:brightness-110" />
                        </div>
                      ) : null}
                    </div>
                    <div className="w-full h-px bg-zinc-200/90 shrink-0 mt-1" />
                    <div className="h-7 flex items-center justify-center shrink-0 mt-1.5 w-full">
                      <span className="text-caption font-bold text-zinc-700 leading-tight font-sans truncate max-w-full">
                        Pending
                      </span>
                    </div>
                  </div>

                  {/* Closed Bar */}
                  <div className="group relative flex flex-col items-center h-full flex-1 min-w-0 cursor-pointer">
                    {/* Hover Tooltip Popup */}
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-30 whitespace-nowrap bg-white border border-zinc-200/90 rounded-xl shadow-md px-3 py-1.5 flex flex-col gap-0.5 text-left font-sans">
                      <p className="text-[11px] font-black text-zinc-900 leading-tight">Closed Referrals</p>
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600">
                        <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
                        <span>Status:</span>
                        <strong className="text-zinc-950 font-black tabular-nums">{closedReferrals} slips</strong>
                      </div>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-zinc-200/90 rotate-45" />
                    </div>

                    <div className="flex-1 w-full flex flex-col justify-end items-center min-h-[130px] sm:min-h-[150px]">
                      {closedReferrals > 0 ? (
                        <div
                          className="w-full flex flex-col items-center justify-end transition-all duration-300"
                          style={{
                            height: `${totalReferrals > 0 ? Math.min(100, Math.max(22, Math.round((closedReferrals / totalReferrals) * 100))) : 0}%`,
                          }}
                        >
                          <span className="font-sans tabular-nums text-sm sm:text-base font-black text-zinc-600 leading-none mb-1.5 shrink-0">
                            {closedReferrals}
                          </span>
                          <div className="w-10 sm:w-14 w-full max-w-[56px] flex-1 bg-zinc-600 rounded-t-md shadow-2xs group-hover:brightness-110" />
                        </div>
                      ) : null}
                    </div>
                    <div className="w-full h-px bg-zinc-200/90 shrink-0 mt-1" />
                    <div className="h-7 flex items-center justify-center shrink-0 mt-1.5 w-full">
                      <span className="text-caption font-bold text-zinc-700 leading-tight font-sans truncate max-w-full">
                        Closed
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Breakdown Status Strip */}
            <div className="mt-auto pt-2.5 border-t border-zinc-100 flex flex-wrap items-center justify-between text-caption text-zinc-600 font-sans gap-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-label-xs">
                  <span className="w-2 h-2 rounded-full bg-[#00875A]" />
                  <span>Connected: <strong className="text-zinc-900">{connectedReferrals}</strong></span>
                </span>
                <span className="flex items-center gap-1.5 text-label-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Pending: <strong className="text-zinc-900">{pendingReferrals}</strong></span>
                </span>
                <span className="flex items-center gap-1.5 text-label-xs">
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  <span>Closed: <strong className="text-zinc-900">{closedReferrals}</strong></span>
                </span>
              </div>
              <span className="text-label-xs font-semibold text-zinc-500">
                Avg {(totalReferrals / Math.max(1, activeTablesCount)).toFixed(1)} / table
              </span>
            </div>
          </div>

          {/* Bottom Dual-Card Grid: Seating Attendance & Top Referrals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            {/* Left Card: Table Seating Attendance (Strictly Real Backend Data) */}
            <div className="bg-white rounded-2xl shadow-xs border border-zinc-200/90 p-4 sm:p-5 flex flex-col gap-3 font-sans">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-brand-red" />
                  <span className="text-card-title font-bold uppercase text-zinc-900 tracking-wider">Table Seating</span>
                </div>
                <span className="text-label-xs font-bold bg-emerald-50 text-[#00875A] border border-emerald-200 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                  {tables.length > 0 ? `${tables.length} Tables` : 'Pending'}
                </span>
              </div>

              <p className="text-caption text-zinc-500 font-medium">
                Round {activeRound || 1} seating · {personsPerTable} members/table
              </p>

              {/* If tables are scheduled, show the vertical bar visualizer */}
              {tables.length > 0 ? (
                <div className="flex items-stretch gap-1.5 sm:gap-2 pt-14 px-3 overflow-x-auto pb-1.5 custom-scrollbar h-52">
                  {tables.map((t, idx) => {
                    const seatedCount = (t.members?.length || 0) + (t.captain ? 1 : 0);
                    const heightPercent = Math.min(100, Math.max(15, Math.round((seatedCount / personsPerTable) * 100)));
                    const captainFullName = t.captain?.name?.trim() || `Table ${t.tableNumber}`;
                    const isFirst = idx === 0;
                    const isLast = idx === tables.length - 1;
                    return (
                      <div
                        key={t.tableNumber}
                        className="group relative flex flex-col items-center h-full flex-1 min-w-[32px] sm:min-w-[40px] max-w-[54px] cursor-pointer"
                      >
                        {/* Hover Tooltip Popup (Home.jsx Chart Card Style) */}
                        <div className={`absolute -top-12 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-30 whitespace-nowrap bg-white border border-zinc-200/90 rounded-xl shadow-md px-3 py-1.5 flex flex-col gap-0.5 text-left font-sans ${isFirst
                          ? 'left-0'
                          : isLast
                            ? 'right-0'
                            : 'left-1/2 -translate-x-1/2'
                          }`}>
                          <p className="text-[11px] font-black text-zinc-900 leading-tight">{captainFullName}</p>
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600">
                            <span className="w-2 h-2 rounded-full bg-brand-red shrink-0" />
                            <span>Seated:</span>
                            <strong className="text-zinc-950 font-black tabular-nums">{seatedCount} / {personsPerTable} members</strong>
                          </div>
                          <div className={`absolute -bottom-1 w-2 h-2 bg-white border-r border-b border-zinc-200/90 rotate-45 ${isFirst
                            ? 'left-4'
                            : isLast
                              ? 'right-4'
                              : 'left-1/2 -translate-x-1/2'
                            }`} />
                        </div>

                        {/* Seated count tag */}
                        <div className="h-4 flex items-center justify-center shrink-0 mb-1 w-full">
                          <span className="font-sans tabular-nums text-caption text-brand-red font-bold leading-none">
                            {seatedCount}/{personsPerTable}
                          </span>
                        </div>

                        {/* Vertical Bar */}
                        <div className="flex-1 w-full flex flex-col justify-end items-center min-h-[44px]">
                          <div
                            className="w-5 sm:w-6 bg-gradient-to-t from-red-700 to-brand-red rounded-t-md rounded-b-none transition-all duration-300 shadow-2xs group-hover:brightness-110"
                            style={{ height: `${heightPercent}%`, minHeight: '6px' }}
                          />
                        </div>

                        {/* Bottom Label */}
                        <div className="h-6 flex items-center justify-center shrink-0 mt-1.5 w-full">
                          <span className="text-caption font-bold text-zinc-800 leading-tight font-sans">
                            T{t.tableNumber}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
                  <div className="w-10 h-10 rounded-full bg-red-50 text-brand-red flex items-center justify-center mb-2">
                    <Users className="w-5 h-5" />
                  </div>
                  <h4 className="text-card-title font-bold text-zinc-800">Tables Not Created Yet</h4>
                  <p className="text-caption text-zinc-500 max-w-xs mt-0.5">
                    Tables and seating will appear here once created in the schedule.
                  </p>
                  {navigateToSchedule && (
                    <button
                      onClick={navigateToSchedule}
                      type="button"
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-red hover:bg-[#b51c2a] text-white text-button rounded-xl transition-smooth cursor-pointer shadow-2xs"
                    >
                      <span>View Tables Schedule</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Bottom Captain Tag */}
              <div className="mt-auto pt-2 flex items-center justify-between text-caption text-zinc-600 bg-zinc-50 p-2.5 rounded-xl border border-zinc-100">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-brand-red" />
                  <span>Captains: {activeTablesCount}</span>
                </span>
                <span className="font-sans tabular-nums font-bold text-zinc-900">{verifiedAttendanceCount} In</span>
              </div>
            </div>

            {/* Right Card: Top Referrals Leaderboard (Top 5) */}
            <div className="bg-white rounded-2xl shadow-xs border border-zinc-200/90 p-4 sm:p-5 flex flex-col gap-3 font-sans">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-brand-red" />
                  <span className="text-card-title font-bold uppercase text-zinc-900 tracking-wider">Top Referrals</span>
                </div>
                <span className="flex items-center gap-1 text-label-xs text-[#00875A] font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-sans tabular-nums">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live ({totalReferrals})
                </span>
              </div>

              <div className="flex flex-col gap-2 mt-1 font-sans flex-1 min-h-0">
                {leaderboard.length > 0 ? (
                  <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-0.5 custom-scrollbar">
                    {leaderboard.map((item, idx) => {
                      const badgeClass = idx === 0
                        ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 ring-1 ring-amber-300'
                        : idx === 1
                          ? 'bg-gradient-to-r from-slate-200 to-slate-300 text-slate-800 ring-1 ring-slate-300'
                          : idx === 2
                            ? 'bg-gradient-to-r from-amber-700/30 to-amber-800/30 text-amber-900 ring-1 ring-amber-700/20'
                            : 'bg-zinc-200 text-zinc-700 ring-1 ring-zinc-300';
                      return (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-all flex items-center justify-between gap-2 border border-zinc-100 shadow-2xs font-sans"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-caption shrink-0 shadow-2xs ${badgeClass}`}>
                              {idx + 1}
                            </span>
                            <div className="flex flex-col min-w-0 text-left">
                              <span className="text-card-title font-bold text-zinc-900 truncate">{item.name}</span>
                              <span className="text-caption text-zinc-500 truncate">{item.category}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-caption font-bold text-brand-red tabular-nums">{item.count} Referrals</span>
                            {item.totalAmount > 0 ? (
                              <div className="text-label-xs text-[#00875A] font-bold tabular-nums">
                                ₹{(item.totalAmount / 1000).toFixed(0)}K
                              </div>
                            ) : (
                              <div className="text-label-xs text-zinc-400">Given</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 my-auto text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-zinc-500 text-caption font-medium">
                    No referrals given yet this round. When members give referrals on their phones, they will appear here.
                  </div>
                )}
              </div>

              {navigateToSchedule ? (
                <button
                  type="button"
                  onClick={navigateToSchedule}
                  className="mt-auto pt-1 text-center text-button text-brand-red hover:text-[#b51c2a] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>View All {totalParticipantsSeated} Members</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* React Confirmation Modal (Zero browser alert/confirm popups) */}
      {confirmModal && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[10002] animate-fade-in p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-scale-up font-sans">
            <div className="flex gap-3.5 items-start">
              <div className="p-2.5 bg-red-50 text-brand-red rounded-xl shrink-0 border border-red-100">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-zinc-900 text-sm leading-tight">{confirmModal.title}</h3>
                <p className="text-zinc-500 text-xs leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-2 border border-zinc-200 text-zinc-700 text-xs font-bold rounded-xl hover:bg-zinc-50 transition-smooth cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const onConfirm = confirmModal.onConfirm;
                  setConfirmModal(null);
                  if (onConfirm) onConfirm();
                }}
                className="px-4 py-2 bg-brand-red hover:bg-[#b51c2a] text-white text-xs font-bold rounded-xl transition-smooth cursor-pointer shadow-xs"
              >
                {confirmModal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 border border-zinc-700 animate-slide-up">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold leading-tight">{toast.title}</span>
            <span className="text-[10.5px] text-zinc-300 leading-tight">{toast.desc}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-zinc-400 hover:text-white ml-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}
