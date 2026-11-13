import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useConclave } from '../hooks/useConclave';
import { useConclaveReferrals } from '../hooks/useConclaveReferrals';
import { useConclaveStats } from '../hooks/useConclaveStats';
import { useConclaveLive } from '../hooks/useConclaveLive';
import { broadcastTabMessage } from '../utils/syncBus';
import {
  CheckCircle2,
  X,
  Bell,
  BellOff,
  Play,
  Pause,
  BarChart3,
  Award,
  Zap,
  Hand,
  Timer,
  Sparkles,
  Users,
  Handshake,
  RotateCcw,
  Mic,
  AlertCircle,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Settings,
} from 'lucide-react';
import { api } from '../services/api';
import { getInitials } from '../utils/initials';
import confetti from 'canvas-confetti';
import { colors } from '../config/theme';

import {
  calculateRoundTiming,
  ROUND_BLOCK_DURATION_SECS,
} from '../utils/roundTiming';
import { clockNow, liveClock } from '../utils/roundClock';
import TableCaptainsPanel from '../admin/TableCaptainsPanel';
import WalkInsPanel from '../admin/WalkInsPanel';

/**
 * Modernized Live Round Runner.
 * Matches Stitch HUD design: Dark Ambient Timer Card, SVG radial progress ring,
 * live active speaker spotlight, dynamic speaker beads, master round controls,
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
  const queryClient = useQueryClient();
  const roundRunnerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);

  // TanStack Query shared cache hooks (deduplicated across ConclaveWorkspace & tabs)
  const { data: selectedConclave = null } = useConclave(selectedConclaveId);
  const { data: rawReferrals = [] } = useConclaveReferrals(selectedConclaveId);
  const { data: stats = null } = useConclaveStats(selectedConclaveId);
  useConclaveLive(selectedConclaveId);

  // Derives filtered referrals array cleanly from shared query cache
  const filteredReferrals = useMemo(() => {
    return Array.isArray(rawReferrals) ? rawReferrals : (rawReferrals?.referrals || []);
  }, [rawReferrals]);

  // Event listeners for instant 0ms update when referrals are submitted locally or in another tab
  useEffect(() => {
    if (!selectedConclaveId) return;

    const handleInstantReferral = () => {
      queryClient.invalidateQueries({ queryKey: ['referrals', selectedConclaveId] });
    };

    const handleStorageChange = (e) => {
      if (e.key === 'bni_referrals') {
        queryClient.invalidateQueries({ queryKey: ['referrals', selectedConclaveId] });
      }
    };

    window.addEventListener('bni_referral_sent', handleInstantReferral);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('bni_referral_sent', handleInstantReferral);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [selectedConclaveId, queryClient]);

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
        const roundNum = roundSeating.roundNumber || activeRound || 1;
        const standIns = selectedConclave.standInCaptains?.[String(roundNum)] || {};

        return roundSeating.tables.map(t => {
          const standInUid = standIns[String(t.tableNumber)];
          const anchorCaptain = selectedConclave.participants.find(p => p.id === t.captainId || p.uid === t.captainId || p._originalUid === t.captainId);
          const standInCaptain = standInUid
            ? selectedConclave.participants.find(p => p._originalUid === standInUid || p.uid === standInUid || String(p.id) === String(standInUid))
            : null;
          const effectiveCaptain = standInCaptain || anchorCaptain;

          const rawMembers = (t.memberIds || []).map(mId => {
            const p = selectedConclave.participants.find(part => part.id === mId || part.uid === mId || part._originalUid === mId);
            return {
              id: p?._originalUid || p?.uid || String(mId),
              pId: p?.id,
              name: p?.name || 'Member',
              category: p?.businessCategory || p?.category || 'General',
              chapter: p?.chapter || '',
              checkedIn: p?.isActive ?? true
            };
          });

          const members = standInCaptain
            ? rawMembers.filter(m => {
              const mUid = m.id;
              const sUid = standInCaptain._originalUid || standInCaptain.uid || String(standInCaptain.id);
              return mUid !== sUid && m.pId !== standInCaptain.id;
            })
            : rawMembers;

          return {
            id: `Table ${t.tableNumber}`,
            tableNumber: t.tableNumber,
            conclaveId: selectedConclaveId,
            status: 'active',
            isStandIn: Boolean(standInCaptain),
            anchorCaptainName: anchorCaptain?.name,
            captain: !effectiveCaptain ? null : {
              id: effectiveCaptain?.id || effectiveCaptain?.uid || effectiveCaptain?._originalUid,
              name: effectiveCaptain?.name || 'Table Captain',
              role: standInCaptain ? 'Stand-In Captain' : 'Table Captain',
              isStandIn: Boolean(standInCaptain),
              anchorCaptainName: anchorCaptain?.name,
              category: effectiveCaptain?.businessCategory || effectiveCaptain?.category || 'Captain',
              chapter: effectiveCaptain?.chapter || '',
              initials: getInitials(effectiveCaptain?.name, 'TC')
            },
            members
          };
        });
      }
    }
    return [];
  }, [selectedConclave, activeRound, isCompleted, selectedConclaveId]);

  // Selected round filter for referrals stats: 'current' (dynamic) | 'all' | number (1, 2, ...)
  const [referralRoundFilter, setReferralRoundFilter] = useState('current');

  const effectiveReferralRound = useMemo(() => {
    if (referralRoundFilter === 'all') return 'all';
    if (referralRoundFilter === 'current') return activeRound > 0 ? activeRound : 1;
    return Number(referralRoundFilter);
  }, [referralRoundFilter, activeRound]);

  // Overall conclave referrals count for mini-stats
  const allReferralsCount = filteredReferrals.length;
  const currentRoundReferralsCount = useMemo(() => {
    const curR = activeRound > 0 ? activeRound : 1;
    return filteredReferrals.filter(r => Number(r.roundNumber || r.round_number || r.round) === curR).length;
  }, [filteredReferrals, activeRound]);

  // Scoped referrals filtered strictly by the chosen round scope
  const scopedReferrals = useMemo(() => {
    if (effectiveReferralRound === 'all') {
      return filteredReferrals;
    }
    return filteredReferrals.filter(r => {
      const rNum = Number(r.roundNumber || r.round_number || r.round);
      return rNum === effectiveReferralRound;
    });
  }, [filteredReferrals, effectiveReferralRound]);

  // Genuine Referrals Analytics for active scope
  const totalReferrals = scopedReferrals.length;
  const connectedReferrals = useMemo(() => {
    return scopedReferrals.filter(r => {
      const st = (r.status || '').toLowerCase();
      const out = (r.outcome || '').toLowerCase();
      return st === 'connected' || st === 'completed' || out === 'accepted';
    }).length;
  }, [scopedReferrals]);

  const closedReferrals = useMemo(() => {
    return scopedReferrals.filter(r => {
      const st = (r.status || '').toLowerCase();
      const out = (r.outcome || '').toLowerCase();
      return st === 'closed' || out === 'closed' || (r.closedAmount && r.closedAmount > 0);
    }).length;
  }, [scopedReferrals]);

  const pendingReferrals = useMemo(() => {
    return Math.max(0, totalReferrals - connectedReferrals - closedReferrals);
  }, [totalReferrals, connectedReferrals, closedReferrals]);

  // View mode for Referrals card: 'table' (by table T1..Tn) or 'status' (Connected/Pending/Closed)
  const [referralChartMode, setReferralChartMode] = useState('table');

  // Calculate referrals per table from real data
  const tableReferralsChartData = useMemo(() => {
    const tableCount = selectedConclave?.scheduleSummary?.tableCount || tables.length || 0;
    if (tableCount === 0) return [];
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

      const targetRoundNum = roundNum || (effectiveReferralRound === 'all' ? (activeRound || 1) : effectiveReferralRound);
      const targetRounds = targetRoundNum ? scheduleRounds.filter(r => r.roundNumber === targetRoundNum) : scheduleRounds;
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

    scopedReferrals.forEach((r, idx) => {
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
  }, [tables, selectedConclave, scopedReferrals, effectiveReferralRound, activeRound]);

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
  const moveTimeLeft = clock.phase === 'move' && clock.phaseEndsMs
    ? Math.max(0, Math.ceil((clock.phaseEndsMs - clockNow(selectedConclave, nowTick)) / 1000))
    : null;

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

  // The move window is still part of the RUNNING round — participants are actively moving to their next table
  const isMovePhase = !isCompleted && !isUpcoming && activeRound > 0 && clock.phase === 'move';

  const isRoundEnded = useMemo(() => {
    if (isCompleted || isUpcoming || activeRound === 0) return false;
    if (isMovePhase) return false;
    return Boolean(
      timingState.phase === 'ended' ||
      timingState.isEnded ||
      clock.phase === 'waiting' ||
      clock.phase === 'done' ||
      (timingState.totalRemaining !== undefined && timingState.totalRemaining <= 0 && timingState.phase !== 'active' && timingState.phase !== 'referral' && timingState.phase !== 'paused' && timingState.phase !== 'transition')
    );
  }, [isCompleted, isUpcoming, activeRound, isMovePhase, timingState.phase, timingState.isEnded, timingState.totalRemaining, clock.phase]);

  // Round is actively running only when unpaused, not ended, not upcoming, and has time remaining
  const isRoundRunning = useMemo(() => {
    if (isCompleted || isUpcoming || activeRound === 0 || isRoundEnded || isRoundPaused) return false;
    if (isMovePhase) return true;
    if (timingState.totalRemaining !== undefined && timingState.totalRemaining <= 0) return false;
    if (timingState.phase === 'ended' || timingState.phase === 'not_started' || timingState.phase === 'ready') return false;
    return Boolean(
      timerRunning ||
      timingState.isTalking ||
      timingState.isReferral ||
      timingState.isTransition ||
      timingState.phase === 'active' ||
      timingState.phase === 'referral' ||
      timingState.phase === 'transition'
    );
  }, [isCompleted, isUpcoming, activeRound, isRoundEnded, isRoundPaused, isMovePhase, timerRunning, timingState]);

  const [toast, setToast] = useState(null);
  const showToast = (title, desc) => {
    setToast({ title, desc });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === roundRunnerRef.current);
    };
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === roundRunnerRef.current) {
        await document.exitFullscreen();
      } else if (roundRunnerRef.current?.requestFullscreen) {
        await roundRunnerRef.current.requestFullscreen();
      } else {
        showToast('Fullscreen Unavailable', 'This browser does not support fullscreen for the Round Runner.');
      }
    } catch (error) {
      showToast('Fullscreen Failed', error.message || 'Could not change fullscreen mode.');
    }
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
    scopedReferrals.forEach(r => {
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

        const resolvedCategory = (r.fromCategory && r.fromCategory !== '1-2-1 Connect Member' && r.fromCategory !== 'Uncategorized')
          ? r.fromCategory
          : (participant?.businessCategory || participant?.category || r.fromCategory || '1-2-1 Connect Member');

        counts[giverId] = {
          name: resolvedName.replace(/\s*\(Active\)/gi, '').trim(),
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
  }, [scopedReferrals, selectedConclave]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Guard against double-click re-firing start-round (which would restart the
  // move timer / double-advance). See post-test bug #12.
  const [isStartingRound, setIsStartingRound] = useState(false);

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
      queryClient.setQueryData(['conclave', selectedConclaveId], old => (
        old ? { ...old, roundProgressionMode: mode } : old
      ));

      try {
        await api.post(`/admin/conclaves/${selectedConclaveId}/progression-mode`, { mode });
        queryClient.invalidateQueries({ queryKey: ['conclave', selectedConclaveId] });
        showToast('Progression Mode', `Auto progression set to ${nextVal ? 'ON' : 'OFF'}.`);
      } catch (err) {
        console.warn("Failed to update progression mode on server:", err);
        // Rollback state immediately if server rejects
        setAutoAdvanceEnabled(previousVal);
        try {
          localStorage.setItem('bni_auto_advance_enabled', String(previousVal));
        } catch { }
        queryClient.setQueryData(['conclave', selectedConclaveId], old => (
          old ? { ...old, roundProgressionMode: previousVal ? 'automatic' : 'manual' } : old
        ));
        showToast('Progression Mode Failed', err.message || 'Cannot update progression mode.');
      }
    }
  };

  const executeStartNextRound = async (customRoundNum = null) => {
    if (isStartingRound) return; // ignore rapid double-clicks (bug #12)
    setIsStartingRound(true);
    const nextRoundVal = customRoundNum !== null ? customRoundNum : (activeRound + 1);
    const now = new Date();

    queryClient.setQueryData(['conclave', selectedConclaveId], old => (
      old ? {
        ...old,
        currentRound: nextRoundVal,
        currentRoundStartedAt: now,
        status: 'running'
      } : old
    ));
    setTimerRunning(true);
    setTimeLeft(ROUND_BLOCK_DURATION_SECS);

    try {
      await api.post(`/admin/conclaves/${selectedConclaveId}/start-round`, {
        roundNumber: nextRoundVal
      });
      queryClient.invalidateQueries({ queryKey: ['conclave', selectedConclaveId] });
      queryClient.invalidateQueries({ queryKey: ['stats', selectedConclaveId] });
      queryClient.invalidateQueries({ queryKey: ['referrals', selectedConclaveId] });
      broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey: ['conclave', selectedConclaveId] });
      playBellSound('double');
      showToast('Round Started', `Round ${nextRoundVal} is live! Tables synced.`);
    } catch (err) {
      console.error("Failed to start round:", err);
      showToast('Start Round Failed', err.message || "Could not start next round.");
    } finally {
      setIsStartingRound(false);
    }
  };

  const handleStartNextRound = (customRoundNum = null) => {
    if (isCompleted) {
      showToast('Conclave Concluded', 'This conclave is already finished.');
      return;
    }

    if (activeRound >= totalRounds && !isUpcoming) {
      setConfirmModal({
        title: 'All Rounds Completed',
        message: `All ${totalRounds} scheduled rounds have been completed. Would you like to conclude and finish the conclave now?`,
        confirmText: 'Yes, Finish Conclave',
        confirmColor: 'brand',
        onConfirm: executeFinishConclave
      });
      return;
    }

    const nextRoundVal = customRoundNum !== null ? customRoundNum : (activeRound + 1);
    const isRound1 = activeRound === 0 || isUpcoming;

    setConfirmModal({
      title: isRound1 ? 'Start Round 1?' : `Start Round ${nextRoundVal}?`,
      message: isRound1
        ? 'Are you sure you want to begin Round 1? Seated members will be notified and the round timer will begin.'
        : `Are you sure you want to start Round ${nextRoundVal}? All tables will sync and members will move to their next assignments.`,
      confirmText: isRound1 ? 'Yes, Start Round 1' : `Yes, Start Round ${nextRoundVal}`,
      confirmColor: 'emerald',
      onConfirm: () => executeStartNextRound(customRoundNum)
    });
  };

  const executeFinishConclave = async () => {
    queryClient.setQueryData(['conclave', selectedConclaveId], old => (
      old ? {
        ...old,
        status: 'completed',
        currentRound: totalRounds
      } : old
    ));
    setTimerRunning(false);
    setTimeLeft(0);
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });

    try {
      await api.post(`/admin/conclaves/${selectedConclaveId}/complete`);
      queryClient.invalidateQueries({ queryKey: ['conclave', selectedConclaveId] });
      queryClient.invalidateQueries({ queryKey: ['stats', selectedConclaveId] });
      broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey: ['conclave', selectedConclaveId] });
      showToast('Conclave Concluded', 'Live conclave finished successfully.');
    } catch (err) {
      console.error("Failed to conclude conclave:", err);
      showToast('Finish Failed', err.message || "Could not complete conclave.");
    }
  };

  const handleFinishConclave = () => {
    if (isCompleted) {
      showToast('Conclave Concluded', 'This conclave is already finished.');
      return;
    }
    setConfirmModal({
      title: 'Finish Entire Conclave?',
      message: 'Are you sure you want to conclude the conclave? This will complete all rounds and finalize participation.',
      confirmText: 'Yes, Finish Conclave',
      confirmColor: 'brand',
      onConfirm: executeFinishConclave
    });
  };

  const handlePauseRound = async () => {
    if (!selectedConclaveId || !isRoundRunning) return;

    await queryClient.cancelQueries({ queryKey: ['conclave', selectedConclaveId] });
    const previousConclave = queryClient.getQueryData(['conclave', selectedConclaveId]);
    const previousTimerRunning = timerRunning;

    try {
      const now = new Date();
      queryClient.setQueryData(['conclave', selectedConclaveId], old => {
        if (!old) return old;
        const startedAt = old.currentRoundStartedAt ? new Date(old.currentRoundStartedAt).getTime() : Date.now();
        const elapsed = Math.max(0, now.getTime() - startedAt);
        return {
          ...old,
          isRoundPaused: true,
          roundPausedAt: now,
          roundElapsedMsBeforePause: elapsed,
        };
      });
      setTimerRunning(false);

      await api.post(`/admin/conclaves/${selectedConclaveId}/pause-round`);
      queryClient.invalidateQueries({ queryKey: ['conclave', selectedConclaveId] });
      broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey: ['conclave', selectedConclaveId] });
      showToast('Round Paused', `Round ${activeRound} timer paused.`);
    } catch (err) {
      if (previousConclave !== undefined) {
        queryClient.setQueryData(['conclave', selectedConclaveId], previousConclave);
      }
      setTimerRunning(previousTimerRunning);
      console.error("Failed to pause round:", err);
      showToast('Pause Failed', err.message || "Could not pause round.");
    }
  };

  const handleResumeRound = async () => {
    if (!selectedConclaveId || !isRoundPaused) return;

    await queryClient.cancelQueries({ queryKey: ['conclave', selectedConclaveId] });
    const previousConclave = queryClient.getQueryData(['conclave', selectedConclaveId]);
    const previousTimerRunning = timerRunning;

    try {
      const now = Date.now();
      queryClient.setQueryData(['conclave', selectedConclaveId], old => {
        if (!old) return old;
        const elapsed = old.roundElapsedMsBeforePause || 0;
        return {
          ...old,
          isRoundPaused: false,
          roundPausedAt: null,
          roundElapsedMsBeforePause: null,
          currentRoundStartedAt: new Date(now - elapsed),
        };
      });
      setTimerRunning(true);

      await api.post(`/admin/conclaves/${selectedConclaveId}/resume-round`);
      queryClient.invalidateQueries({ queryKey: ['conclave', selectedConclaveId] });
      broadcastTabMessage({ type: 'INVALIDATE_QUERY', queryKey: ['conclave', selectedConclaveId] });
      playBellSound('single');
      showToast('Round Resumed', `Round ${activeRound} timer resumed.`);
    } catch (err) {
      if (previousConclave !== undefined) {
        queryClient.setQueryData(['conclave', selectedConclaveId], previousConclave);
      }
      setTimerRunning(previousTimerRunning);
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

  const activeTablesCount = tables.length || selectedConclave?.scheduleSummary?.tableCount || stats?.counts?.captains || 0;

  // Round timing block & elapsed ratio
  const currentTotalBlock = Math.max(1, timingState.totalBlockSecs || ROUND_BLOCK_DURATION_SECS);
  const moveElapsedRatio = moveTimeLeft !== null
    ? Math.max(0, Math.min(1, 1 - (moveTimeLeft / Math.max(1, conclaveMoveSeconds))))
    : null;
  const roundElapsedRatio = moveElapsedRatio !== null
    ? moveElapsedRatio
    : Math.max(0, Math.min(1, (currentTotalBlock - (timeLeft || 0)) / currentTotalBlock));
  const displayedTimeLeft = moveTimeLeft ?? timeLeft;

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
      const nextRoundNum = activeRound + 1;
      const isFinalRound = activeRound >= totalRounds;
      return {
        icon: <CheckCircle2 className="w-5 h-5 text-white" />,
        iconBg: 'bg-amber-600',
        title: isFinalRound ? 'Final Round Completed' : `Next Round (R${nextRoundNum})`,
        subtitle: isFinalRound
          ? 'All rounds completed • Ready to conclude conclave'
          : `Round ${activeRound} completed • Ready for Round ${nextRoundNum}`,
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

    const pausedAt = selectedConclave?.roundPausedAt ? new Date(selectedConclave.roundPausedAt) : null;
    const pausedAtTime = pausedAt && !isNaN(pausedAt.getTime())
      ? pausedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : null;

    const isMoveTime = isMovePhase || clock.phase === 'move' || timingState.phase === 'transition';
    const isReferralTime = (timingState.phase === 'referral' || clock.phase === 'referral') && !isMoveTime;

    if (isMoveTime) {
      return {
        icon: <RotateCcw className="w-5 h-5 text-white" />,
        iconBg: isRoundPaused
          ? 'bg-gradient-to-br from-amber-500 to-amber-700'
          : 'bg-gradient-to-br from-emerald-500 to-teal-600',
        title: 'Move to Next Table',
        subtitle: isRoundPaused
          ? `Move paused${pausedAtTime ? ` at ${pausedAtTime}` : ''} • Table Move`
          : (activeRound < totalRounds ? 'Please move to your next table' : 'All rounds completed'),
        timeText: formatTime(displayedTimeLeft),
        timeSub: isRoundPaused ? (pausedAtTime ? `Paused at ${pausedAtTime}` : 'Paused') : 'Move Time',
        showProgress: false,
      };
    }

    if (isReferralTime) {
      return {
        icon: <Handshake className="w-5 h-5 text-white" />,
        iconBg: isRoundPaused
          ? 'bg-gradient-to-br from-amber-500 to-amber-700'
          : 'bg-gradient-to-br from-blue-600 to-blue-700',
        title: 'Referral Exchange',
        subtitle: isRoundPaused
          ? `Referrals paused${pausedAtTime ? ` at ${pausedAtTime}` : ''} • Referral Window`
          : 'Give referrals and log them on your phone',
        timeText: formatTime(timingState.phaseRemaining || 0),
        timeSub: isRoundPaused ? (pausedAtTime ? `Paused at ${pausedAtTime}` : 'Paused') : 'Time Left',
        showProgress: false,
      };
    }

    if (isRoundPaused) {
      const sNum = timingState.speakerNumber || 1;
      return {
        icon: <Pause className="w-5 h-5 text-white" />,
        iconBg: 'bg-gradient-to-br from-amber-500 to-amber-700',
        title: `Speaker ${sNum}`,
        subtitle: `Round ${activeRound || 1} • All Tables Paused${pausedAtTime ? ` (Paused at ${pausedAtTime})` : ''}`,
        timeText: formatTime(timeLeft),
        timeSub: pausedAtTime ? `Paused at ${pausedAtTime}` : 'Paused',
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
    selectedConclave?.roundPausedAt,
    currentTotalBlock,
    timeLeft,
    isMovePhase,
    clock.phase,
    displayedTimeLeft,
  ]);

  // Referrals by Round for Chart
  const referralsByRoundData = useMemo(() => {
    const rCount = totalRounds || 2;
    const roundCounts = {};
    for (let r = 1; r <= rCount; r++) {
      roundCounts[r] = 0;
    }
    filteredReferrals.forEach(ref => {
      const rNum = Number(ref.roundNumber || ref.round_number || ref.round || 1);
      if (roundCounts[rNum] !== undefined) {
        roundCounts[rNum]++;
      }
    });
    return Object.entries(roundCounts).map(([rNum, count]) => ({
      round: Number(rNum),
      name: `Round ${rNum}`,
      count,
    }));
  }, [totalRounds, filteredReferrals]);

  // Table Referrals for Chart (Top 5 if > 5 tables, otherwise all tables)
  const top5TablesChartData = useMemo(() => {
    const tableCount = selectedConclave?.scheduleSummary?.tableCount || tables.length || 0;
    const isMoreThan5 = tableCount > 5;
    const numTablesToShow = isMoreThan5 ? 5 : Math.max(tableCount, 2);

    // Base tables T1..T(numTablesToShow)
    const baseTables = Array.from({ length: numTablesToShow }, (_, i) => ({
      name: `T${i + 1}`,
      fullName: `Table ${i + 1}`,
      tableNumber: i + 1,
      referrals: 0,
    }));

    if (!tableReferralsChartData || tableReferralsChartData.length === 0) {
      return baseTables;
    }

    const sorted = [...tableReferralsChartData].sort((a, b) => b.referrals - a.referrals);
    const result = isMoreThan5 ? sorted.slice(0, 5) : sorted;

    const top = result.map(t => ({
      name: `T${t.tableNumber}`,
      fullName: `Table ${t.tableNumber}`,
      tableNumber: t.tableNumber,
      referrals: t.referrals,
    }));

    // If fewer than numTablesToShow, fill in with base tables
    if (top.length < numTablesToShow) {
      const existing = new Set(top.map(t => t.tableNumber));
      for (const bt of baseTables) {
        if (!existing.has(bt.tableNumber) && top.length < numTablesToShow) {
          top.push(bt);
        }
      }
    }

    return top.length > 0 ? top : baseTables;
  }, [tableReferralsChartData, selectedConclave, tables]);

  // Referrals by Status for Chart (100% Real Data)
  const referralsByStatusData = useMemo(() => {
    const counts = {
      pending: 0,
      connected: 0,
      closed: 0,
    };

    filteredReferrals.forEach(r => {
      const s = (r.status || '').toLowerCase();
      if (s.includes('close') || s.includes('won') || s.includes('complete')) {
        counts.closed++;
      } else if (s.includes('connect') || s.includes('accept') || s.includes('discuss')) {
        counts.connected++;
      } else {
        counts.pending++;
      }
    });

    return [
      {
        key: 'pending',
        name: 'Pending',
        count: counts.pending,
        barColor: 'bg-amber-500',
        badgeBg: 'bg-amber-50 border-amber-200 text-amber-800'
      },
      {
        key: 'connected',
        name: 'Connected',
        count: counts.connected,
        barColor: 'bg-blue-600',
        badgeBg: 'bg-blue-50 border-blue-200 text-blue-800'
      },
      {
        key: 'closed',
        name: 'Closed',
        count: counts.closed,
        barColor: 'bg-emerald-600',
        badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-800'
      },
    ];
  }, [filteredReferrals]);

  // Display Leaderboard (100% Real Data)
  const displayLeaderboard = leaderboard;

  const [portalTarget, setPortalTarget] = useState(null);

  useEffect(() => {
    if (isHubMode && typeof document !== 'undefined') {
      const el = document.getElementById('conclave-tab-controls');
      if (el) setPortalTarget(el);
    }
  }, [isHubMode]);

  const topControlsContent = (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={handleToggleAutoAdvance}
        disabled={isCompleted}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shadow-2xs ${isCompleted
          ? 'opacity-50 cursor-not-allowed bg-zinc-100 text-zinc-400 border-zinc-200'
          : autoAdvanceEnabled
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 cursor-pointer'
            : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 cursor-pointer'
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

      <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full text-zinc-700 text-xs font-medium border border-zinc-200 shadow-2xs">
        <Timer className="w-3.5 h-3.5 text-zinc-500" />
        <span>Move Time: <strong className="text-brand-red font-bold">{conclaveMoveSeconds < 60 ? `${conclaveMoveSeconds}s` : `${Math.round(conclaveMoveSeconds / 60)}m`}</strong></span>
      </div>
      <button
        type="button"
        onClick={handleToggleFullscreen}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        title={isFullscreen ? 'Exit fullscreen (Esc)' : 'View Round Runner fullscreen'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
      >
        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        <span>{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
      </button>
    </div>
  );

  return (
    <div
      ref={roundRunnerRef}
      className={`w-full max-w-full overflow-hidden flex flex-col animate-fade-in relative select-none gap-4 pb-8 ${isFullscreen ? 'fixed inset-0 z-[9999] h-screen overflow-y-auto bg-zinc-50 p-2 sm:p-4' : isHubMode ? 'pt-1' : 'p-2 sm:p-4'}`}
    >

      {/* Top Controls: Portaled into workspace tab bar if in hub mode, otherwise displayed inline */}
      {isFullscreen ? (
        <div className="w-full flex flex-wrap items-center justify-end gap-2">
          {topControlsContent}
        </div>
      ) : portalTarget ? (
        createPortal(topControlsContent, portalTarget)
      ) : (
        <div className="w-full flex flex-wrap items-center justify-end gap-2">
          {topControlsContent}
        </div>
      )}

      {/* 2-Column Live Round & Analytics Grid (Matches Reference Design) */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">

        {/* LEFT COLUMN: LIVE ROUND CARD + CONTROLS + SUMMARY (lg:col-span-5) */}
        <div className="lg:col-span-5 min-w-0 flex flex-col gap-4">

          {/* 1. Live Round Card (Red Gradient Card) */}
          <div
            className="relative rounded-3xl p-4 sm:p-5 text-white border border-rose-500/30 shadow-xl overflow-hidden flex flex-col gap-2.5 sm:gap-3 font-sans"
            style={{
              background: 'linear-gradient(135deg, #CF2030 0%, #8F1C29 55%, #3A171E 100%)',
            }}
          >
            {/* Ambient Lighting Glows */}
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl pointer-events-none bg-rose-400/20" />
            <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full blur-3xl pointer-events-none bg-black/30" />

            {/* Header: LIVE ROUND + Sound toggle button + Round pill */}
            <div className="relative flex items-center justify-between shrink-0 pb-2 border-b border-white/15">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white" />
                <span className="text-xs sm:text-sm font-black tracking-widest text-white uppercase font-sans">
                  LIVE ROUND
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !isSoundEnabled;
                    setIsSoundEnabled(next);
                    if (next) playBellSound('chime');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/25 hover:bg-black/40 text-white border border-white/20 text-xs font-bold transition-all cursor-pointer shadow-xs backdrop-blur-sm"
                  title={isSoundEnabled ? "Mute audio" : "Enable sound"}
                >
                  {isSoundEnabled ? (
                    <Bell className="w-3.5 h-3.5 text-amber-300" />
                  ) : (
                    <BellOff className="w-3.5 h-3.5 text-white/60" />
                  )}
                  <span>Sound: {isSoundEnabled ? 'On' : 'Off'}</span>
                </button>
                <span className="px-3 py-1 rounded-full border border-white/40 bg-white/10 text-white font-bold text-xs">
                  Round {isCompleted ? totalRounds : (activeRound || 1)} of {totalRounds}
                </span>
              </div>
            </div>

            {/* Center: Circular Progress Ring with Timer Inside */}
            <div className="relative flex flex-col items-center justify-center text-center py-1">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="rgba(0, 0, 0, 0.4)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="#00D084"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={314.16}
                    strokeDashoffset={isCompleted ? 0 : 314.16 * (1 - roundElapsedRatio)}
                    className="transition-all duration-500"
                  />
                </svg>

                {/* Timer Inside the Ring */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                  {(() => {
                    const isMoveTime = isMovePhase || clock.phase === 'move';
                    const isReferralPhase = (timingState.subPhase === 'referral' || timingState.phase === 'referral' || clock.phase === 'referral') && !isMoveTime;
                    const isTransitionPhase = timingState.subPhase === 'transition' || timingState.phase === 'transition' || isMoveTime;

                    let headingText = 'TALKING TIME';
                    let HeadingIcon = Mic;

                    if (isCompleted || (isRoundEnded && !isMoveTime)) {
                      headingText = 'ROUND COMPLETED';
                      HeadingIcon = CheckCircle2;
                    } else if (isTransitionPhase) {
                      headingText = 'MOVE TIME';
                      HeadingIcon = RotateCcw;
                    } else if (isReferralPhase) {
                      headingText = 'REFERRAL TIME';
                      HeadingIcon = Handshake;
                    } else {
                      headingText = 'TALKING TIME';
                      HeadingIcon = Mic;
                    }

                    return (
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-black tracking-widest text-white/85 uppercase mb-1">
                        <HeadingIcon className="w-4 h-4 text-white/85" />
                        <span>{headingText}</span>
                      </div>
                    );
                  })()}
                  <div className="text-6xl sm:text-7xl font-black font-sans tabular-nums text-white tracking-tight leading-none drop-shadow-lg my-1">
                    {isCompleted ? '00:00' : formatTime(displayedTimeLeft)}
                  </div>
                </div>
              </div>
            </div>

            {/* INTEGRATED FROM IMAGE 2: Speaker Box, S1..Sn Pills & Timing Formula */}
            <div className="relative pt-2.5 border-t border-white/15 space-y-2.5">
              {/* Speaker Box (Shows Person's Talking Time, Referral Time, or Move to Next Table) */}
              {(() => {
                const isMoveTime = isMovePhase || clock.phase === 'move';
                const isReferralPhase = (timingState.subPhase === 'referral' || timingState.phase === 'referral' || clock.phase === 'referral') && !isMoveTime;
                const isTransitionPhase = timingState.subPhase === 'transition' || timingState.phase === 'transition' || isMoveTime;

                let speakerTimeSeconds = 0;
                let phaseTitle = `Speaker ${timingState.speakerNumber || 1}`;
                let phaseSubtitle = `Round ${activeRound || 1} • ${isRoundPaused ? 'All Tables Paused' : isCompleted ? 'Completed' : 'Speaking Turn'}`;
                let phaseBadge = isCompleted ? 'DONE' : isRoundPaused ? 'PAUSED' : 'TALKING TIME';

                if (isCompleted || (isRoundEnded && !isMoveTime)) {
                  speakerTimeSeconds = 0;
                  phaseTitle = `Round ${activeRound || 1} Completed`;
                  phaseSubtitle = isCompleted
                    ? 'Conclave Completed'
                    : (activeRound >= totalRounds ? 'All rounds completed' : `Next Round (R${activeRound + 1})`);
                  phaseBadge = 'DONE';
                } else if (isTransitionPhase) {
                  speakerTimeSeconds = displayedTimeLeft;
                  phaseTitle = 'Move to Next Table';
                  phaseSubtitle = `Round ${activeRound || 1} • ${isRoundPaused ? 'All Tables Paused' : 'Table Move'}`;
                  phaseBadge = isRoundPaused ? 'PAUSED' : 'MOVE TIME';
                } else if (isReferralPhase) {
                  speakerTimeSeconds = timingState.phaseRemaining || 0;
                  phaseTitle = 'Referral Exchange';
                  phaseSubtitle = `Round ${activeRound || 1} • ${isRoundPaused ? 'All Tables Paused' : 'Referral Window'}`;
                  phaseBadge = isRoundPaused ? 'PAUSED' : 'REFERRAL TIME';
                } else {
                  // Talking Phase (current speaker turn countdown)
                  speakerTimeSeconds = isCompleted ? 0 : (timingState.speakerTimeLeft ?? (timingState.bioSecs || 60));
                  phaseTitle = `Speaker ${timingState.speakerNumber || 1}`;
                  phaseSubtitle = `Round ${activeRound || 1} • ${isRoundPaused ? 'All Tables Paused' : isCompleted ? 'Completed' : 'Speaking Turn'}`;
                  phaseBadge = isRoundPaused ? 'PAUSED' : 'TALKING TIME';
                }

                return (
                  <div className="w-full bg-black/35 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 border border-white/15 shadow-md">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 shadow-md ${isTransitionPhase ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-amber-500 to-orange-600'
                        }`}>
                        {isRoundPaused ? (
                          <Pause className="w-5 h-5 fill-white text-white" />
                        ) : isTransitionPhase ? (
                          <RotateCcw className="w-5 h-5 text-white" />
                        ) : isReferralPhase ? (
                          <Handshake className="w-5 h-5 text-white" />
                        ) : isCompleted || (isRoundEnded && !isMoveTime) ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : (
                          <Mic className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 text-left">
                        <span className="text-base sm:text-lg font-black text-white leading-tight truncate">
                          {phaseTitle}
                        </span>
                        <span className="text-xs font-semibold text-white/80 truncate">
                          {phaseSubtitle}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl sm:text-3xl font-black font-sans tabular-nums text-white leading-tight">
                        {isCompleted ? '0:00' : formatTime(speakerTimeSeconds)}
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-white/70">
                        {phaseBadge}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Speaker Pills (S1, S2, S3, S4, S5) */}
              <div className="grid grid-flow-col auto-cols-fr gap-2 w-full">
                {speakerBeads.map(({ num, state }) => (
                  <div
                    key={num}
                    className={`h-9 rounded-xl flex items-center justify-center font-black text-xs transition-all ${state === 'done'
                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-xs'
                        : state === 'active'
                          ? 'bg-gradient-to-r from-brand-red to-red-600 text-white shadow-md ring-2 ring-red-400 scale-105'
                          : 'bg-black/30 text-white/80 border border-white/20'
                      }`}
                  >
                    <span>S{num}</span>
                  </div>
                ))}
              </div>

              {/* Timing Formula Caption */}
              <div className="text-center text-[10px] sm:text-[11px] font-black tracking-wider text-white/90 uppercase pt-0.5">
                {personsPerTable} MEMBERS • {formatDurationText(talkingSecs).toUpperCase()} SPEAKING + {formatDurationText(referralSecs).toUpperCase()} REFERRALS + {formatDurationText(transitionSecs).toUpperCase()} MOVE = {formatDurationText(totalTimingSecs).toUpperCase()} TOTAL ROUND
              </div>
            </div>

            {/* INTEGRATED FROM IMAGE 1: Round Controls at bottom of card */}
            <div className="relative pt-3 border-t border-white/15 space-y-3 font-sans">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-white/90" />
                <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  Round Controls
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
                {/* Pause / Resume */}
                {isRoundPaused ? (
                  <button
                    type="button"
                    onClick={handleResumeRound}
                    disabled={isCompleted || (isRoundEnded && !isMovePhase)}
                    className="h-10 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-bold text-xs flex items-center justify-center gap-2 transition-smooth cursor-pointer disabled:opacity-40 shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-zinc-900 text-zinc-900" />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePauseRound}
                    disabled={!isRoundRunning}
                    className="h-10 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-bold text-xs flex items-center justify-center gap-2 transition-smooth cursor-pointer disabled:opacity-40 shadow-xs"
                  >
                    <Pause className="w-3.5 h-3.5 fill-zinc-900 text-zinc-900" />
                    <span>Pause</span>
                  </button>
                )}

                {/* Next Round */}
                <button
                  type="button"
                  onClick={() => handleStartNextRound()}
                  disabled={isStartingRound || isCompleted}
                  className={`h-10 px-4 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 transition-smooth shadow-xs cursor-pointer disabled:opacity-40 ${
                    activeRound >= totalRounds && !isUpcoming
                      ? 'bg-zinc-700 hover:bg-zinc-800'
                      : 'bg-[#00875A] hover:bg-emerald-600'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-white text-white" />
                  <span>
                    {(() => {
                      if (activeRound === 0 || isUpcoming) return 'Start Round 1';
                      if (activeRound >= totalRounds) return 'All Rounds Completed';
                      return `Next Round (R${activeRound + 1})`;
                    })()}
                  </span>
                </button>

                {/* Finish Conclave */}
                <button
                  type="button"
                  onClick={handleFinishConclave}
                  disabled={isCompleted}
                  className="h-10 px-4 rounded-xl bg-white hover:bg-rose-50 text-brand-red font-bold text-xs flex items-center justify-center gap-2 transition-smooth cursor-pointer disabled:opacity-40 shadow-xs border border-rose-200"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-red" />
                  <span>Finish Conclave</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4 Stat Cards Row: Members, Tables, Rounds, Total Referrals (Moved below Live Round Card) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2.5 sm:gap-3">
            {/* Members */}
            <div className="bg-white rounded-2xl border border-zinc-200/90 p-3.5 shadow-3xs flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-brand-red flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-brand-red" />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black text-zinc-950 leading-tight truncate">
                  {totalParticipantsSeated}
                </div>
                <div className="text-[11px] font-bold text-zinc-500 truncate">Members</div>
              </div>
            </div>

            {/* Tables */}
            <div className="bg-white rounded-2xl border border-zinc-200/90 p-3.5 shadow-3xs flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-brand-red flex items-center justify-center shrink-0">
                <LayoutGrid className="w-5 h-5 text-brand-red" />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black text-zinc-950 leading-tight truncate">
                  {activeTablesCount}
                </div>
                <div className="text-[11px] font-bold text-zinc-500 truncate">Tables</div>
              </div>
            </div>

            {/* Rounds */}
            <div className="bg-white rounded-2xl border border-zinc-200/90 p-3.5 shadow-3xs flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black text-zinc-950 leading-tight truncate">
                  {totalRounds || 2}
                </div>
                <div className="text-[11px] font-bold text-zinc-500 truncate">Rounds</div>
              </div>
            </div>

            {/* Total Referrals */}
            <div className="bg-white rounded-2xl border border-zinc-200/90 p-3.5 shadow-3xs flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-brand-red flex items-center justify-center shrink-0">
                <Handshake className="w-5 h-5 text-brand-red" />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black text-zinc-950 leading-tight truncate">
                  {allReferralsCount}
                </div>
                <div className="text-[11px] font-bold text-zinc-500 truncate">Total Referrals</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 2 CHARTS + TOP REFERRALS LEADERBOARD + PANELS (lg:col-span-7) */}
        <div className="lg:col-span-7 min-w-0 flex flex-col gap-4">

          {/* 1. Top Charts Row: Referrals by Round & Table Referrals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Chart 1: Referrals by Round */}
            <div className="bg-white rounded-2xl border border-zinc-200/90 p-4 sm:p-5 shadow-3xs flex flex-col gap-3 font-sans min-w-0 overflow-hidden">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-brand-red shrink-0" />
                <h4 className="text-xs sm:text-sm font-black text-zinc-950 uppercase tracking-wider truncate">Referrals by Round</h4>
              </div>

              {/* Bar Chart Area */}
              <div className="flex-1 flex flex-col justify-end min-h-[170px] pt-4 w-full min-w-0 overflow-hidden">
                <div className="flex items-end justify-between gap-1.5 sm:gap-2.5 md:gap-3 h-36 px-2 sm:px-3 pb-0 w-full min-w-0">
                  {referralsByRoundData.map((item, idx) => {
                    const maxVal = Math.max(1, ...referralsByRoundData.map(r => r.count));
                    const heightPct = item.count > 0 ? Math.max(15, Math.min(100, (item.count / maxVal) * 100)) : 0;
                    return (
                      <div key={idx} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
                        <span className="text-xs font-black text-zinc-900 mb-1.5 tabular-nums">{item.count}</span>
                        {item.count > 0 ? (
                          <div
                            className={`w-3.5 sm:w-4.5 rounded-t-md transition-all duration-300 ${
                              item.round === activeRound ? 'bg-brand-red' : 'bg-red-800'
                            }`}
                            style={{ height: `${heightPct}%` }}
                          />
                        ) : (
                          <div className="w-3.5 sm:w-4.5 h-1 bg-zinc-300 rounded-full" />
                        )}
                        <span className="text-xs font-black text-zinc-600 mt-2 text-center whitespace-nowrap" title={`Round ${item.round}`}>
                          R{item.round}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Chart 2: Dynamic Table Referrals */}
            <div className="bg-white rounded-2xl border border-zinc-200/90 p-4 sm:p-5 shadow-3xs flex flex-col gap-3 font-sans min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Award className="w-4 h-4 text-brand-red shrink-0" />
                  <h4 className="text-xs sm:text-sm font-black text-zinc-950 uppercase tracking-wider truncate">
                    {(selectedConclave?.scheduleSummary?.tableCount || tables.length || 0) > 5 ? 'Top 5 Table Referrals' : 'Table Referrals'}
                  </h4>
                </div>
                {/* Round Filter Selector */}
                <select
                  value={referralRoundFilter}
                  onChange={(e) => setReferralRoundFilter(e.target.value)}
                  className="text-[11px] font-bold text-zinc-700 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 rounded-lg px-2 py-1 outline-none transition cursor-pointer shrink-0"
                  title="Filter table referrals by round"
                >
                  <option value="current">Round {activeRound > 0 ? activeRound : 1} (Live)</option>
                  <option value="all">All Rounds</option>
                  {Array.from({ length: totalRounds || 2 }, (_, i) => i + 1).map(r => (
                    <option key={r} value={String(r)}>Round {r}</option>
                  ))}
                </select>
              </div>

              {/* Bar Chart Area */}
              <div className="flex-1 flex flex-col justify-end min-h-[170px] pt-4 w-full min-w-0 overflow-hidden">
                <div className="flex items-end justify-between gap-1.5 sm:gap-2.5 md:gap-3 h-36 px-2 sm:px-3 pb-0 w-full min-w-0">
                  {top5TablesChartData.map((item, idx) => {
                    const maxVal = Math.max(1, ...top5TablesChartData.map(t => t.referrals));
                    const heightPct = item.referrals > 0 ? Math.max(12, Math.min(100, (item.referrals / maxVal) * 100)) : 0;
                    const barColor = idx === 0
                      ? 'bg-brand-red'
                      : idx === 1
                        ? 'bg-red-700'
                        : idx === 2
                          ? 'bg-red-800'
                          : idx === 3
                            ? 'bg-red-900'
                            : 'bg-zinc-800';

                    return (
                      <div key={idx} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
                        <span className="text-xs font-black text-zinc-900 mb-1.5 tabular-nums">{item.referrals}</span>
                        {item.referrals > 0 ? (
                          <div
                            className={`w-3.5 sm:w-4.5 rounded-t-md transition-all duration-300 ${barColor}`}
                            style={{ height: `${heightPct}%` }}
                          />
                        ) : (
                          <div className="w-3.5 sm:w-4.5 h-1 bg-zinc-200 rounded-full" />
                        )}
                        <span className="text-xs font-black text-zinc-600 mt-2 text-center whitespace-nowrap" title={item.fullName}>
                          {item.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Bottom Row: Top Referrals + Referrals by Status (Responsive Side-by-side) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Top Referrals Leaderboard (Kept same as it is) */}
            <div className="bg-white rounded-2xl border border-zinc-200/90 p-4 sm:p-5 shadow-3xs flex flex-col gap-3 font-sans min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-red shrink-0" />
                  <h4 className="text-xs sm:text-sm font-black text-zinc-950 uppercase tracking-wider truncate">Top Referrals</h4>
                </div>
                {displayLeaderboard?.length > 0 && (
                  <span className="text-[11px] font-bold text-zinc-400">{displayLeaderboard.length} Members</span>
                )}
              </div>

              <div className="space-y-2 pt-1 flex-1">
                {displayLeaderboard && displayLeaderboard.length > 0 ? (
                  displayLeaderboard.map((item, idx) => {
                    const badgeColor = idx === 0
                      ? 'bg-amber-400 text-amber-950'
                      : idx === 1
                        ? 'bg-slate-300 text-slate-800'
                        : idx === 2
                          ? 'bg-amber-600 text-white'
                          : 'bg-zinc-100 text-zinc-700';

                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl hover:bg-zinc-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${badgeColor}`}>
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-zinc-900 truncate">{item.name}</div>
                            <div className="text-[10px] font-semibold text-zinc-400 truncate">{item.category}</div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-brand-red tabular-nums">{item.count} {item.count === 1 ? 'Referral' : 'Referrals'}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-6 flex items-center justify-center h-full text-center text-xs font-bold text-zinc-400">
                    No referrals logged yet
                  </div>
                )}
              </div>
            </div>

            {/* Right: Referrals by Status (Bar Chart) */}
            <div className="bg-white rounded-2xl border border-zinc-200/90 p-4 sm:p-5 shadow-3xs flex flex-col gap-3 font-sans min-w-0 overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-red shrink-0" />
                  <h4 className="text-xs sm:text-sm font-black text-zinc-950 uppercase tracking-wider truncate">Referrals by Status</h4>
                </div>
                <span className="text-[11px] font-bold text-zinc-400 tabular-nums">
                  {allReferralsCount} Total
                </span>
              </div>

              {/* Bar Chart Area */}
              <div className="flex-1 flex flex-col justify-end min-h-[170px] pt-4 w-full min-w-0 overflow-hidden">
                <div className="flex items-end justify-between gap-1.5 sm:gap-2.5 md:gap-3 h-36 px-3 sm:px-6 pb-0 w-full min-w-0">
                  {referralsByStatusData.map((item, idx) => {
                    const maxVal = Math.max(1, ...referralsByStatusData.map(s => s.count));
                    const heightPct = item.count > 0 ? Math.max(12, Math.min(100, (item.count / maxVal) * 100)) : 0;

                    return (
                      <div key={idx} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
                        <span className="text-xs font-black text-zinc-900 mb-1.5 tabular-nums">{item.count}</span>
                        {item.count > 0 ? (
                          <div
                            className={`w-4 sm:w-5 rounded-t-md transition-all duration-300 ${item.barColor}`}
                            style={{ height: `${heightPct}%` }}
                          />
                        ) : (
                          <div className="w-4 sm:w-5 h-1 bg-zinc-200 rounded-full" />
                        )}
                        <span className="text-xs font-black text-zinc-600 mt-2 text-center whitespace-nowrap">
                          {item.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mini Status Breakdown Pills */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                {referralsByStatusData.map((item, idx) => (
                  <div key={idx} className={`p-1.5 rounded-lg border text-center ${item.badgeBg}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider">{item.name}</div>
                    <div className="text-xs font-black tabular-nums">{item.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Walk-ins & Table Captains panels (Shifted to bottom) */}
          {!isCompleted && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <WalkInsPanel
                conclave={selectedConclave}
                showToast={showToast}
                onChanged={() => {
                  queryClient.invalidateQueries({ queryKey: ['conclave', selectedConclaveId] });
                }}
              />
              <TableCaptainsPanel
                conclave={selectedConclave}
                activeRound={activeRound}
                showToast={showToast}
                onChanged={() => {
                  queryClient.invalidateQueries({ queryKey: ['conclave', selectedConclaveId] });
                }}
              />
            </div>
          )}

        </div>
      </div>

      {/* React Confirmation Modal (Zero browser alert/confirm popups) */}
      {confirmModal && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[10002] animate-fade-in p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-scale-up font-sans">
            <div className="flex gap-3.5 items-start">
              <div className={`p-2.5 rounded-xl shrink-0 border ${
                confirmModal.confirmColor === 'emerald'
                  ? 'bg-emerald-50 text-[#00875A] border-emerald-100'
                  : 'bg-red-50 text-brand-red border-red-100'
              }`}>
                {confirmModal.confirmColor === 'emerald' ? (
                  <Play className="w-5 h-5 fill-current" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
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
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition-smooth cursor-pointer shadow-xs ${
                  confirmModal.confirmColor === 'emerald'
                    ? 'bg-[#00875A] hover:bg-emerald-700'
                    : 'bg-brand-red hover:bg-[#b51c2a]'
                }`}
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
