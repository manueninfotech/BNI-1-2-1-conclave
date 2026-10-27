import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  CheckCircle2,
  X,
  RefreshCw,
  Send,
  Bell,
  BellOff,
  Volume2,
  Sparkles,
  Play,
  Pause,
  Square,
  Clock,
  Award,
  BarChart2,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { api } from '../services/api';
import confetti from 'canvas-confetti';
import { colors } from '../config/theme';
import { formatStatus } from '../utils/statusUtils';

import runnerData from '../data/tables_runner.json';
import {
  calculateRoundTiming,
  ROUND_BLOCK_DURATION_SECS,
} from '../utils/roundTiming';
const { initialTables } = runnerData;

export default function RoundRunner({
  selectedConclaveId,
  onNavigateToReview,
  isHubMode = false,
}) {
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

  // View mode for Referrals bar chart: 'table' (by table T1..Tn) or 'status' (Connected/Pending/Closed)
  const [referralChartMode, setReferralChartMode] = useState('table');

  // Calculate referrals per table for the Bar Chart model
  const tableReferralsChartData = useMemo(() => {
    const tableCount = selectedConclave?.scheduleSummary?.tableCount ||
      tables.length ||
      (selectedConclave?.schedule?.rounds?.[0]?.tables?.length) ||
      8;
    const countToUse = Math.max(1, Math.min(tableCount, 14));

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

    // Set captain names from current active round tables
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
        // Deterministic distribution across tables if unassigned so total matches exactly
        let hash = 0;
        const str = String(r.id || r.fromName || idx);
        for (let i = 0; i < str.length; i++) {
          hash = ((hash << 5) - hash) + str.charCodeAt(i);
          hash |= 0;
        }
        const assignedTable = (Math.abs(hash) % countToUse) + 1;
        if (tableStats[assignedTable]) {
          tableStats[assignedTable].referrals += 1;
          if (isClosed) tableStats[assignedTable].closed += 1;
          else if (isConnected) tableStats[assignedTable].connected += 1;
          else tableStats[assignedTable].pending += 1;
        }
      }
    });

    return Object.values(tableStats);
  }, [tables, selectedConclave, filteredReferrals]);

  // Status breakdown data for the Bar Chart
  const statusReferralsChartData = useMemo(() => {
    return [
      { name: 'Connected', count: connectedReferrals, fill: '#10b981' },
      { name: 'Pending', count: pendingReferrals, fill: '#f59e0b' },
      { name: 'Closed', count: closedReferrals, fill: '#71717a' },
    ];
  }, [connectedReferrals, pendingReferrals, closedReferrals]);

  const maxReferralsY = useMemo(() => {
    const maxVal = Math.max(...tableReferralsChartData.map(t => t.referrals), 0);
    return Math.max(4, Math.ceil(maxVal * 1.2));
  }, [tableReferralsChartData]);

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
    roundTiming: selectedConclave?.roundTiming,
    roundDurationMinutes: selectedConclave?.roundDurationMinutes,
    extensionSeconds: selectedConclave?.roundExtensionSeconds,
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
        roundTiming: selectedConclave?.roundTiming,
        roundDurationMinutes: selectedConclave?.roundDurationMinutes,
        extensionSeconds: selectedConclave?.roundExtensionSeconds,
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
  const audioCtxRef = useRef(null);

  // Singleton AudioContext with state resumption
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

  // Unlock AudioContext on the user's first click or touch
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

  // Web Audio API brass bell chime synthesizer (realistic resonance + overtones, zero MP3 dependency)
  const playBellSound = async (mode = 'chime') => {
    if (!isSoundEnabled) return;
    try {
      const ctx = await getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Notes: double = round change/end; single = resume; chime = manual test
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
        // Fundamental bell body tone
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

        // Overtone strike harmonic (2.76x physical brass bell ratio)
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
        showToast('🔔 Bell Sound', 'Bell chime sound played successfully.');
      }
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

  // Live Round Extension States
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [isExtending, setIsExtending] = useState(false);

  const handleExtendRound = async (additionalMinutes) => {
    if (!selectedConclaveId || isExtending) return;
    setIsExtending(true);
    const addedSecs = additionalMinutes * 60;

    // Optimistically update conclave state so timer extends instantly
    setConclaves(prev => prev.map(c => {
      if (c.id === selectedConclaveId) {
        return {
          ...c,
          roundExtensionSeconds: (c.roundExtensionSeconds || 0) + addedSecs,
        };
      }
      return c;
    }));

    try {
      await api.post(`/admin/conclaves/${selectedConclaveId}/extend-round`, {
        additionalMinutes,
        additionalSeconds: addedSecs,
      });
      playBellSound('single');
      showToast('Round Extended', `Round ${activeRound} extended by +${additionalMinutes}m. All screens synced.`);
      setShowExtensionModal(false);
    } catch (err) {
      console.error("Failed to extend round:", err);
      showToast('Extension Failed', err.message || "Could not extend round time.");
    } finally {
      setIsExtending(false);
    }
  };

  // Automatic Round Progression State (persisted to localStorage and backend conclave setting)
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(() => {
    try {
      const cached = localStorage.getItem('bni_auto_advance_enabled');
      if (cached !== null) return cached === 'true';
    } catch {}
    return true;
  });

  // Sync progression mode from selected conclave when loaded
  useEffect(() => {
    if (selectedConclave?.roundProgressionMode) {
      const isAuto = selectedConclave.roundProgressionMode === 'automatic';
      setAutoAdvanceEnabled(isAuto);
      try {
        localStorage.setItem('bni_auto_advance_enabled', String(isAuto));
      } catch {}
    }
  }, [selectedConclave?.id, selectedConclave?.roundProgressionMode]);

  const handleToggleAutoAdvance = async () => {
    const nextVal = !autoAdvanceEnabled;
    setAutoAdvanceEnabled(nextVal);
    try {
      localStorage.setItem('bni_auto_advance_enabled', String(nextVal));
    } catch {}

    if (!nextVal) {
      if (autoStartTimerRef.current) {
        clearInterval(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
      setAutoStartCountdown(null);
    }

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
      }
    }
  };

  const handleSetProgressionMode = async (mode) => {
    const isAuto = mode === 'automatic';
    setAutoAdvanceEnabled(isAuto);
    try {
      localStorage.setItem('bni_auto_advance_enabled', String(isAuto));
    } catch {}

    if (!isAuto) {
      if (autoStartTimerRef.current) {
        clearInterval(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
      setAutoStartCountdown(null);
    }

    if (selectedConclaveId) {
      setConclaves(prev => prev.map(c => {
        if (c.id === selectedConclaveId) {
          return { ...c, roundProgressionMode: mode };
        }
        return c;
      }));

      try {
        await api.post(`/admin/conclaves/${selectedConclaveId}/progression-mode`, { mode });
        showToast('Progression Mode', `Round progression set to ${isAuto ? 'Automatic' : 'Manual'}.`);
      } catch (err) {
        console.warn("Failed to update progression mode on server:", err);
      }
    }
  };

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
  // Starts next round automatically when previous round completes ONLY IF autoAdvanceEnabled is true.
  // When all rounds (activeRound >= totalRounds) complete, mark conclave as completed!
  useEffect(() => {
    if (isRoundPaused || timingState.isPaused) {
      if (autoStartTimerRef.current) {
        clearInterval(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
      setAutoStartCountdown(null);
      return;
    }
    if (statusLower !== 'running') return;
    if (activeRound < 1) return; // Round 1 must be started manually by the admin!

    const isRoundEnded = Boolean(
      timingState.phase === 'ended' ||
      timingState.isEnded ||
      (timingState.totalRemaining !== undefined && timingState.totalRemaining <= 0 && timingState.phase !== 'active' && timingState.phase !== 'referral' && timingState.phase !== 'paused')
    );

    if (isRoundEnded) {
      if (activeRound < totalRounds) {
        // In Manual mode, do NOT auto-advance to next round! Wait for admin.
        if (!autoAdvanceEnabled) {
          if (autoStartTimerRef.current) {
            clearInterval(autoStartTimerRef.current);
            autoStartTimerRef.current = null;
          }
          setAutoStartCountdown(null);
          return;
        }

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
        // All rounds completed! Auto-complete the conclave
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
  }, [timingState.phase, timingState.isEnded, timingState.isPaused, timingState.totalRemaining, activeRound, totalRounds, statusLower, autoAdvanceEnabled, isRoundPaused]);

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
      if (autoStartTimerRef.current) {
        clearInterval(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
      setAutoStartCountdown(null);

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
      showToast('Round Paused', `Round ${activeRound} timer is now paused.`);
    } catch (err) {
      console.error("Failed to pause round:", err);
      showToast('Pause Failed', err.message || "Could not pause round.");
    }
  };

  // Resume paused round
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

  // Calculate table seating and activity chart data
  const tableChartData = useMemo(() => {
    if (!tables || tables.length === 0) {
      const count = selectedConclave?.scheduleSummary?.tableCount || 8;
      return Array.from({ length: Math.min(count, 12) }, (_, i) => ({
        name: `T${i + 1}`,
        members: Math.max(1, personsPerTable - 1),
        capacity: personsPerTable,
      }));
    }
    return tables.slice(0, 14).map(t => ({
      name: `T${t.tableNumber}`,
      members: (t.members?.length || 0) + (t.captain ? 1 : 0),
      capacity: personsPerTable,
    }));
  }, [tables, selectedConclave, personsPerTable]);

  // Round phase timing breakdown chart
  const timingChartData = useMemo(() => {
    const talking = timingState.activeSecs || 180;
    const referral = timingState.referralSecs || 90;
    const transition = timingState.transitionSecs || 75;
    return [
      { name: 'Talking', value: talking, fill: '#10b981' },
      { name: 'Referrals', value: referral, fill: '#3b82f6' },
      { name: 'Rotation', value: transition, fill: '#f59e0b' },
    ];
  }, [timingState]);

  // 1 to personsPerTable visual dots
  const speakerBeads = useMemo(() => {
    const count = timingState.personsPerTable || 6;
    const current = timingState.speakerNumber || 1;
    return Array.from({ length: count }, (_, i) => {
      const num = i + 1;
      let state = 'upcoming';
      if (timingState.phase === 'active') {
        if (num < current) state = 'done';
        else if (num === current) state = 'active';
      } else if (timingState.phase === 'referral' || timingState.phase === 'transition' || timingState.phase === 'ended') {
        state = 'done';
      }
      return { num, state };
    });
  }, [timingState.personsPerTable, timingState.speakerNumber, timingState.phase]);

  // Array of round numbers 1..totalRounds
  const roundPills = useMemo(() => {
    return Array.from({ length: totalRounds }, (_, i) => {
      const rNum = i + 1;
      const isDone = isCompleted || (activeRound > rNum);
      const isCurrent = !isCompleted && (activeRound === rNum);
      return { rNum, isDone, isCurrent };
    });
  }, [totalRounds, activeRound, isCompleted]);

  return (
    <div className={`w-full max-w-full overflow-hidden flex flex-col animate-fade-in relative select-none gap-4 sm:gap-5 pb-6 ${isHubMode ? '' : 'p-2 sm:p-4'}`}>

      {/* Main 3-Column Cockpit Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12 gap-4 sm:gap-5 items-stretch min-w-0">

        {/* COLUMN 1: Timer & Live Speaker Mission Control */}
        <div className="lg:col-span-1 xl:col-span-4 flex flex-col justify-between gap-4 sm:gap-5 min-w-0">
          {/* Main Timer Card */}
          <div className="flex-1 bg-white border border-zinc-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[460px] sm:min-h-[500px] min-w-0">
            {/* Top Phase Header */}
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${timingState.phase === 'active' ? 'bg-emerald-400' : isRoundPaused ? 'bg-amber-400' : 'bg-brand-red'
                    }`} />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${timingState.phase === 'active' ? 'bg-emerald-500' : isRoundPaused ? 'bg-amber-500' : 'bg-brand-red'
                    }`} />
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-zinc-900">
                  {isCompleted
                    ? 'Conclave Completed'
                    : isRoundPaused
                      ? `Round ${activeRound} Paused`
                      : timingState.phase === 'active'
                        ? 'Talking Time'
                        : timingState.phase === 'referral'
                          ? 'Referral Window'
                          : timingState.phase === 'transition'
                            ? 'Move To Next Table'
                            : timingState.phase === 'ended'
                              ? 'Round Concluded'
                              : 'Round Ready'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => playBellSound('chime')}
                  title="Test Bell Sound"
                  type="button"
                  className="p-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 transition-smooth cursor-pointer shadow-2xs"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                  title={isSoundEnabled ? "Mute Bell Sound" : "Enable Bell Sound"}
                  type="button"
                  className={`p-1.5 rounded-lg border transition-smooth cursor-pointer shadow-2xs ${isSoundEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-50 text-zinc-400 border-zinc-200'}`}
                >
                  {isSoundEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                </button>
                <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${timingState.phase === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : timingState.phase === 'referral'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : timingState.phase === 'transition'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-zinc-100 text-zinc-600 border-zinc-250'
                  }`}>
                  {isCompleted ? 'Finished' : `${formatTime(timingState.phaseRemaining)} left`}
                </span>
              </div>
            </div>

            {/* Huge Dynamic Digital Clock */}
            <div className="flex-1 flex flex-col items-center justify-center py-4 sm:py-6 my-auto">
              <div className={`text-7xl sm:text-8xl xl:text-9xl font-black tabular-nums tracking-tighter leading-none select-none drop-shadow-xs ${isCompleted
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

              {/* Linear Progress Bar (Hidden when time is 0 / completed) */}
              <div className={`w-full max-w-[320px] h-2.5 bg-zinc-100 rounded-full overflow-hidden mt-3 border border-zinc-200/60 ${(isCompleted || timeLeft <= 0) ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}>
                <div
                  className={`h-full transition-all duration-300 rounded-full ${timingState.phase === 'active'
                      ? 'bg-emerald-500'
                      : timingState.phase === 'referral'
                        ? 'bg-blue-500'
                        : timingState.phase === 'transition'
                          ? 'bg-amber-500'
                          : 'bg-brand-red'
                    }`}
                  style={{
                    width: (isCompleted || timeLeft <= 0)
                      ? '0%'
                      : `${Math.min(
                          100,
                          Math.max(0, 100 - (timingState.phaseRemaining / Math.max(1, timingState.phase === 'active' ? timingState.activeSecs : timingState.phase === 'referral' ? timingState.referralSecs : timingState.transitionSecs)) * 100)
                        )}%`
                  }}
                />
              </div>
            </div>

            {/* Speaker Turn Progression & Visual Beads */}
            <div className="bg-zinc-50/90 border border-zinc-200/80 rounded-xl p-3 shrink-0 space-y-2.5">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-zinc-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-red" />
                  Speaker Turn
                </span>
                <span className="text-zinc-900 font-extrabold">
                  {timingState.phase === 'active' && !isRoundPaused
                    ? `Speaker ${timingState.speakerNumber} of ${timingState.personsPerTable} (${formatTime(timingState.speakerTimeLeft)})`
                    : timingState.phase === 'referral'
                      ? 'Referral Window'
                      : timingState.phase === 'transition'
                        ? 'Table Rotation'
                        : timingState.bioSecs < 60
                          ? `${timingState.bioSecs}s / Person`
                          : `${(timingState.bioSecs / 60).toFixed(1).replace(/\.0$/, '')}m / Person`}
                </span>
              </div>

              {/* Visual Speaker Seat Beads */}
              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                {speakerBeads.map(({ num, state }) => (
                  <div
                    key={num}
                    className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs font-black border transition-all ${state === 'done'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : state === 'active'
                          ? 'bg-brand-red text-white border-brand-red shadow-xs ring-2 ring-red-200 animate-pulse'
                          : 'bg-white text-zinc-400 border-zinc-200'
                      }`}
                  >
                    <span>S{num}</span>
                  </div>
                ))}
              </div>

              {/* Formula Subtitle */}
              <p className="text-[10px] text-zinc-400 font-semibold text-center uppercase tracking-wider">
                {timingState.personsPerTable} Seats · {((timingState.talkingSecs || timingState.activeSecs) / 60).toFixed(1).replace(/\.0$/, '')}m Speaking + {(timingState.referralSecs / 60).toFixed(1).replace(/\.0$/, '')}m Referrals + {timingState.transitionSecs < 60 ? `${timingState.transitionSecs}s` : `${(timingState.transitionSecs / 60).toFixed(1).replace(/\.0$/, '')}m`} Move = {(timingState.totalBlockSecs / 60).toFixed(1).replace(/\.0$/, '')}m Round Total
              </p>
            </div>

            {/* Mission Control Round Stepper & Action Controls */}
            <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2 flex-wrap shrink-0">
              {/* Stepper Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    All {totalRounds} Rounds Completed
                  </span>
                ) : (
                  <>
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mr-0.5">Rounds:</span>
                    {roundPills.map(({ rNum, isDone, isCurrent }) => (
                      <div
                        key={rNum}
                        className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-black border transition-all ${
                          isDone
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : isCurrent
                            ? 'bg-brand-red text-white border-brand-red shadow-2xs'
                            : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <span>R{rNum}</span>}
                        {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
                      </div>
                    ))}
                    {!['completed', 'cancelled'].includes(statusLower) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-500">
                        {autoAdvanceEnabled ? '⚡ Auto Progression' : '✋ Manual Progression'}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Action Buttons */}
              {!['completed', 'cancelled'].includes(statusLower) && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {activeRound === 0 ? (
                    <div className="flex items-center gap-2">
                      {/* Progression Mode selector BEFORE starting Round 1 */}
                      <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleSetProgressionMode('manual')}
                          className={`px-2.5 py-1 text-[11px] font-black rounded-md transition-smooth cursor-pointer ${
                            !autoAdvanceEnabled
                              ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-250'
                              : 'text-zinc-500 hover:text-zinc-800'
                          }`}
                          title="Manual Mode: Admin explicitly clicks to start each round"
                        >
                          Manual
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetProgressionMode('automatic')}
                          className={`px-2.5 py-1 text-[11px] font-black rounded-md transition-smooth cursor-pointer flex items-center gap-1 ${
                            autoAdvanceEnabled
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'text-zinc-500 hover:text-zinc-800'
                          }`}
                          title="Automatic Mode: Rounds advance on the timer automatically"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Auto</span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleStartNextRound(1)}
                        type="button"
                        className="inline-flex items-center gap-1.5 h-7 px-3 bg-brand-red hover:bg-red-750 text-white text-xs font-black uppercase tracking-wider rounded-lg transition-smooth shadow-xs cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Start Round 1</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {isRoundPaused ? (
                        <button
                          onClick={handleResumeRound}
                          type="button"
                          className="inline-flex items-center gap-1 h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-smooth cursor-pointer"
                          title="Resume active round timer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Resume</span>
                        </button>
                      ) : (
                        <button
                          onClick={handlePauseRound}
                          type="button"
                          className="inline-flex items-center gap-1 h-7 px-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-smooth cursor-pointer"
                          title="Pause active round timer"
                        >
                          <Pause className="w-3 h-3 fill-current" />
                          <span>Pause</span>
                        </button>
                      )}

                      {activeRound < (selectedConclave?.roundCount || 4) && (
                        <button
                          onClick={() => handleStartNextRound()}
                          type="button"
                          className="inline-flex items-center gap-1 h-7 px-2.5 bg-white border border-zinc-250 hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded-lg transition-smooth cursor-pointer"
                          title="Force start next round"
                        >
                          <RefreshCw className="w-3 h-3 text-zinc-500" />
                          <span>Next</span>
                        </button>
                      )}

                      <button
                        onClick={handleCloseRound}
                        type="button"
                        className="inline-flex items-center gap-1 h-7 px-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-250 text-xs font-bold rounded-lg transition-smooth cursor-pointer"
                        title={`End Round ${activeRound} early (keeps conclave running)`}
                      >
                        <Square className="w-3 h-3 fill-zinc-500 text-zinc-500" />
                        <span>End Round {activeRound}</span>
                      </button>

                      <button
                        onClick={handleFinishConclave}
                        type="button"
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 bg-brand-red hover:bg-red-750 text-white text-xs font-black uppercase rounded-lg transition-smooth shadow-xs cursor-pointer"
                        title="Conclude entire conclave event (marks completed)"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Finish Conclave</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics 4-Grid Strip */}
          <div className="shrink-0 grid grid-cols-4 gap-2 bg-white border border-zinc-200/90 rounded-2xl p-3 sm:p-4 shadow-xs text-center min-w-0">
            <div className="p-1">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Round</p>
              <p className="text-lg sm:text-2xl font-black text-zinc-900 mt-1 leading-tight">{isCompleted ? `${totalRounds}/${totalRounds}` : `${activeRound}/${totalRounds}`}</p>
            </div>
            <div className="p-1 border-l border-zinc-100">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tables</p>
              <p className="text-lg sm:text-2xl font-black text-zinc-900 mt-1 leading-tight">{selectedConclave?.scheduleSummary?.tableCount || stats?.counts?.captains || 0}</p>
            </div>
            <div className="p-1 border-l border-zinc-100">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Members</p>
              <p className="text-lg sm:text-2xl font-black text-zinc-900 mt-1 leading-tight">
                {stats?.counts?.members !== undefined
                  ? stats.counts.members
                  : (selectedConclave?.participants?.filter(p => p.role !== 'captain')?.length || selectedConclave?.participants?.length || 0)}
              </p>
            </div>
            <div className="p-1 border-l border-zinc-100">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Referrals</p>
              <p className="text-lg sm:text-2xl font-black text-brand-red mt-1 leading-tight">{totalReferrals || stats?.counts?.referrals || 0}</p>
            </div>
          </div>
        </div>

        {/* COLUMN 2: Real-time Round Progress & Table Activity Charts */}
        <div className="lg:col-span-1 xl:col-span-4 flex flex-col justify-between gap-4 sm:gap-5 min-w-0">
          {/* Chart 1: Round Time Structure & Phase Distribution Donut */}
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[250px] sm:min-h-[280px] flex-1 min-w-0">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brand-red" />
                <h3 className="text-xs font-black uppercase text-zinc-900 tracking-wider">Round Time Structure</h3>
              </div>
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase bg-zinc-100 px-2 py-0.5 rounded-md">
                {(() => {
                  const s = timingState.totalBlockSecs || ROUND_BLOCK_DURATION_SECS;
                  const m = Math.floor(s / 60);
                  const rem = s % 60;
                  return rem > 0 ? `${m}m ${rem}s Block` : `${m}m Block`;
                })()}
              </span>
            </div>

            <div className="flex-1 min-h-0 flex items-center justify-center gap-2.5 sm:gap-3 xl:gap-4 px-1 py-2 min-w-0">
              {/* Responsive Donut Chart */}
              <div className="relative w-36 h-36 sm:w-40 sm:h-40 xl:w-44 xl:h-44 shrink-0 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={timingChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={46}
                      outerRadius={66}
                      startAngle={90}
                      endAngle={-270}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {timingChartData.map((entry, index) => (
                        <Cell key={`timing-cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl sm:text-3xl font-black text-zinc-950 leading-none">{progressPercent}%</span>
                  <span className="text-[10px] sm:text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider mt-1">Progress</span>
                </div>
              </div>

              {/* Compact Responsive Legend & Phase Breakdown */}
              <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-emerald-50/70 rounded-xl border border-emerald-100 text-[11px] sm:text-xs">
                  <span className="font-bold text-emerald-800 flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Talking
                  </span>
                  <span className="font-extrabold text-emerald-900 shrink-0 ml-1">
                    {(timingState.activeSecs / 60).toFixed(1).replace(/\.0$/, '')}m ({timingState.bioSecs < 60 ? `${timingState.bioSecs}s/ea` : `${(timingState.bioSecs / 60).toFixed(1).replace(/\.0$/, '')}m/ea`})
                  </span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-blue-50/70 rounded-xl border border-blue-100 text-[11px] sm:text-xs">
                  <span className="font-bold text-blue-800 flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" /> Referrals
                  </span>
                  <span className="font-extrabold text-blue-900 shrink-0 ml-1">
                    {(timingState.referralSecs / 60).toFixed(1).replace(/\.0$/, '')}m ({timingState.refSecs < 60 ? `${timingState.refSecs}s/ea` : `${(timingState.refSecs / 60).toFixed(1).replace(/\.0$/, '')}m/ea`})
                  </span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-amber-50/70 rounded-xl border border-amber-100 text-[11px] sm:text-xs">
                  <span className="font-bold text-amber-800 flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" /> Rotation
                  </span>
                  <span className="font-extrabold text-amber-900 shrink-0 ml-1">
                    {timingState.transitionSecs < 60
                      ? `${timingState.transitionSecs}s`
                      : timingState.transitionSecs % 60 === 0
                        ? `${timingState.transitionSecs / 60}m`
                        : `${(timingState.transitionSecs / 60).toFixed(1)}m (${timingState.transitionSecs}s)`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart 2: Table Activity & Seating Fill Bar Chart */}
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[250px] sm:min-h-[280px] flex-1 min-w-0">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-brand-red" />
                <h3 className="text-xs font-black uppercase text-zinc-900 tracking-wider">Table Seating & Fill</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Live Attendance
                </span>
                {onNavigateToReview && (
                  <button
                    onClick={onNavigateToReview}
                    type="button"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200 text-xs font-bold rounded-md transition-smooth cursor-pointer"
                    title="Inspect table matrix in Schedule Review"
                  >
                    <span>Matrix</span>
                    <ArrowRight className="w-3 h-3 text-zinc-400" />
                  </button>
                )}
              </div>
            </div>

            <div className="h-44 sm:h-52 w-full pt-2 flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tableChartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, personsPerTable]} tick={{ fontSize: 9.5, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-zinc-900 text-white text-xs p-2.5 rounded-xl shadow-lg border border-zinc-700">
                            <p className="font-extrabold">{data.name}</p>
                            <p className="text-zinc-300 mt-0.5">{data.members} / {data.capacity} seats assigned</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="members" fill="#af101a" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* COLUMN 3: Referrals Analytics & Leaderboard */}
        <div className="lg:col-span-2 xl:col-span-4 flex flex-col justify-between gap-4 sm:gap-5 min-w-0">
          {/* Chart 3: Table Referrals Bar Chart */}
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[250px] sm:min-h-[280px] flex-1 min-w-0">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-brand-red" />
                <h3 className="text-xs font-black uppercase text-zinc-900 tracking-wider">Table Referrals</h3>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Mode Switcher */}
                <div className="inline-flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setReferralChartMode('table')}
                    className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md transition-colors cursor-pointer ${
                      referralChartMode === 'table'
                        ? 'bg-white text-zinc-900 shadow-2xs font-black'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    By Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setReferralChartMode('status')}
                    className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md transition-colors cursor-pointer ${
                      referralChartMode === 'status'
                        ? 'bg-white text-zinc-900 shadow-2xs font-black'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    By Status
                  </button>
                </div>
                <span className="px-2 py-0.5 bg-brand-red/10 text-brand-red border border-brand-red/20 rounded-md text-[10px] font-black">
                  {totalReferrals} TOTAL
                </span>
              </div>
            </div>

            {/* Bar Chart Representation */}
            <div className="h-44 sm:h-52 w-full pt-2 flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                {referralChartMode === 'table' ? (
                  <BarChart data={tableReferralsChartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#71717a' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, maxReferralsY]}
                      allowDecimals={false}
                      tick={{ fontSize: 9.5, fill: '#a1a1aa' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-zinc-900 text-white text-xs p-2.5 rounded-xl shadow-lg border border-zinc-700 min-w-[130px]">
                              <div className="flex items-center justify-between border-b border-zinc-800 pb-1 mb-1.5">
                                <span className="font-extrabold">{data.fullName}</span>
                                {data.captainName && (
                                  <span className="text-[9px] text-zinc-400 truncate max-w-[80px]">
                                    Cap: {data.captainName}
                                  </span>
                                )}
                              </div>
                              <div className="space-y-0.5">
                                <p className="font-bold text-white flex justify-between">
                                  <span>Total Referrals:</span>
                                  <span className="text-brand-red font-black">{data.referrals}</span>
                                </p>
                                <p className="text-emerald-400 flex justify-between text-[10px]">
                                  <span>Connected:</span>
                                  <span>{data.connected}</span>
                                </p>
                                <p className="text-amber-400 flex justify-between text-[10px]">
                                  <span>Pending:</span>
                                  <span>{data.pending}</span>
                                </p>
                                {data.closed > 0 && (
                                  <p className="text-zinc-400 flex justify-between text-[10px]">
                                    <span>Closed:</span>
                                    <span>{data.closed}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="referrals" fill="#af101a" radius={[4, 4, 0, 0]} maxBarSize={32}>
                      {tableReferralsChartData.map((entry, index) => (
                        <Cell key={`table-ref-cell-${index}`} fill={entry.referrals > 0 ? '#af101a' : '#e4e4e7'} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={statusReferralsChartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#71717a' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, Math.max(5, totalReferrals)]}
                      allowDecimals={false}
                      tick={{ fontSize: 9.5, fill: '#a1a1aa' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-zinc-900 text-white text-xs p-2.5 rounded-xl shadow-lg border border-zinc-700">
                              <p className="font-extrabold">{data.name}</p>
                              <p className="text-zinc-300 font-bold mt-0.5">{data.count} Referrals</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {statusReferralsChartData.map((entry, index) => (
                        <Cell key={`status-cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Bottom Status Breakdown Strip */}
            <div className="flex items-center justify-between px-1 pt-2 border-t border-zinc-100 text-[11px] shrink-0 font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-zinc-600">Connected:</span>
                <span className="font-black text-zinc-900">{connectedReferrals}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-zinc-600">Pending:</span>
                <span className="font-black text-zinc-900">{pendingReferrals}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-zinc-400 shrink-0" />
                <span className="text-zinc-600">Closed:</span>
                <span className="font-black text-zinc-900">{closedReferrals}</span>
              </div>
            </div>
          </div>

          {/* Widget 4: Top 3 Referrals Leaderboard */}
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[250px] sm:min-h-[280px] flex-1 min-w-0">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-black uppercase text-zinc-900 tracking-wider">Top Referrers</h3>
              </div>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[10px] font-bold">
                LEADERS
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-center py-2">
              {leaderboard.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-500 mb-2 shadow-2xs">
                    <Award className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-zinc-700">No Referrals Logged Yet</p>
                  <p className="text-[11px] text-zinc-400 max-w-[220px] mt-0.5 leading-relaxed">
                    Referrals exchanged during rounds will rank here live.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.slice(0, 3).map((person, idx) => {
                    const medalColors = [
                      { bg: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-300' },
                      { bg: 'bg-zinc-400', text: 'text-zinc-600', border: 'border-zinc-300' },
                      { bg: 'bg-amber-700/85', text: 'text-amber-800', border: 'border-amber-600/30' },
                    ];
                    const c = medalColors[idx] || medalColors[2];
                    return (
                      <div key={idx} className="bg-zinc-50/80 border border-zinc-200/70 rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-6 h-6 ${c.bg} text-white rounded-full flex items-center justify-center font-black text-[10px] border ${c.border} shrink-0`}>
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-zinc-900 truncate leading-tight">{person.name}</p>
                            <p className="text-[10px] text-zinc-400 font-semibold uppercase truncate">{person.category}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-1.5">
                          <span className={`text-base font-black ${c.text}`}>{person.count}</span>
                          <span className="text-[9px] text-zinc-400 font-bold block -mt-0.5">refs</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Auto-Start Countdown Overlay Banner */}
      {autoStartCountdown !== null && (
        <div className="absolute top-12 right-4 z-50 p-3 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white rounded-xl shadow-xl flex items-center gap-3 animate-fade-in border border-amber-300">
          <Sparkles className="w-4 h-4 animate-spin-slow text-amber-200 shrink-0" />
          <div className="text-xs">
            <p className="font-black uppercase tracking-wider">
              {activeRound < totalRounds ? `Starting Round ${activeRound + 1}` : 'Concluding Conclave'}
            </p>
            <p className="text-[11px] text-amber-100 font-semibold">
              Auto-starting in {autoStartCountdown}s...
            </p>
          </div>
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
            className="px-3 py-1 bg-white text-amber-900 text-xs font-black rounded-lg shadow-sm hover:bg-amber-50 cursor-pointer"
          >
            Start Now
          </button>
        </div>
      )}

      {/* Toast Alert Feedback */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[70] bg-zinc-900 text-white text-[11px] font-bold py-2 px-3 rounded-lg shadow-xl flex items-center gap-2 border border-zinc-800 animate-slide-up">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-red shrink-0" />
          <div>
            <p className="font-bold">{toast.title}</p>
            <p className="text-zinc-400 font-semibold text-[10px]">{toast.desc}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-white opacity-40 hover:opacity-100 ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    
      {/* Dynamic Round Extension Modal */}
      {showExtensionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 max-w-md w-full p-5 space-y-4 animate-scale-in">
            <div className="flex items-start justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-brand-red flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wide">Extend Round {activeRound}</h3>
                  <p className="text-[11px] text-zinc-500 font-medium">Add transition or speaking time to the live clock</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExtensionModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Context Notice */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 text-[11px] text-zinc-600 space-y-1">
              <div className="flex justify-between font-bold text-zinc-800">
                <span>Table Capacity:</span>
                <span>{personsPerTable} members / table</span>
              </div>
              <div className="flex justify-between font-bold text-zinc-800">
                <span>Current Move Buffer:</span>
                <span className={timingState.transitionSecs < 120 ? 'text-amber-600' : 'text-emerald-600'}>
                  {Math.round(timingState.transitionSecs / 60)} minutes
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 pt-1">
                Extending updates all captain and member phone timers in real time.
              </p>
            </div>

            {/* Extension Option Cards */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                disabled={isExtending}
                onClick={() => handleExtendRound(5)}
                className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-zinc-200 hover:border-brand-red hover:bg-red-50/40 transition-all cursor-pointer group"
              >
                <span className="text-lg font-black text-zinc-900 group-hover:text-brand-red">+5 Min</span>
                <span className="text-[9.5px] font-semibold text-zinc-500 text-center mt-0.5">Quick Buffer</span>
              </button>

              <button
                type="button"
                disabled={isExtending}
                onClick={() => handleExtendRound(10)}
                className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-brand-red bg-red-50/20 hover:bg-red-50/60 transition-all cursor-pointer group shadow-2xs"
              >
                <span className="text-lg font-black text-brand-red">+10 Min</span>
                <span className="text-[9.5px] font-black text-brand-red text-center mt-0.5">Recommended</span>
              </button>

              <button
                type="button"
                disabled={isExtending}
                onClick={() => handleExtendRound(15)}
                className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-zinc-200 hover:border-brand-red hover:bg-red-50/40 transition-all cursor-pointer group"
              >
                <span className="text-lg font-black text-zinc-900 group-hover:text-brand-red">+15 Min</span>
                <span className="text-[9.5px] font-semibold text-zinc-500 text-center mt-0.5">Double Block</span>
              </button>
            </div>

            {/* Cancel Button */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowExtensionModal(false)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
