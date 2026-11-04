import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Play,
  PlayCircle,
  StopCircle,
  Lock,
  ShieldAlert,
  Users,
  Award,
  SlidersHorizontal,
  Plus,
  Minus,
  ChevronRight,
  Building2,
  AlertTriangle,
  RotateCcw,
  LayoutGrid,
  Layers,
  Clock,
  Check,
  Zap,
  Search,
  UserCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { formatStatus } from '../utils/statusUtils';

export default function ScheduleGen({
  selectedConclaveId,
  showGenWarning,
  clearGenWarning,
  onScheduleReady,
  onNavigateToRunner,
  isHubMode = false,
}) {
  // Conclaves list state
  const [conclaves, setConclaves] = useState(() => {
    const cached = localStorage.getItem('bni_schedule_gen_conclaves_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch { }
    }
    const adminCached = localStorage.getItem('bni_admin_conclaves_cache');
    if (adminCached) {
      try { return JSON.parse(adminCached); } catch { }
    }
    return [];
  });

  useEffect(() => {
    async function loadConclaves() {
      try {
        const data = await api.get('/admin/conclaves');
        if (data && data.length > 0) {
          const mapped = data.map(c => {
            let state = c.state;
            let country = c.country;
            const venue = c.venueLocation || c.venue || 'N/A';
            const venueShort = venue.split(',')[0] || 'N/A';
            const startDate = c.date || c.startDate || '';
            const dateRange = c.date ? new Date(c.date).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }) : (c.dateRange || 'N/A');

            let status = c.status;
            const s = (c.status || '').toLowerCase().replace(/[\s_-]/g, '');
            if (s === 'registrationopen' || s === 'upcoming') status = 'Upcoming';
            else if (s === 'running' || s === 'active') status = 'Running';
            else if (s === 'completed') status = 'Completed';
            else if (s === 'draft') status = 'Draft';
            else if (s === 'cancelled') status = 'Cancelled';

            const hasSched = Boolean(c.scheduleSummary || c.schedule || ['running', 'completed', 'locked'].includes(s));

            return {
              ...c,
              state,
              country,
              venue,
              venueShort,
              startDate,
              dateRange,
              status,
              progress: hasSched ? 100 : s === 'running' ? 60 : 0
            };
          });
          setConclaves(mapped);
          localStorage.setItem('bni_schedule_gen_conclaves_cache', JSON.stringify(mapped));
        }
      } catch (err) {
        console.error('API load failed for conclaves:', err);
      }
    }
    loadConclaves();
  }, []);

  const selectedConclave = useMemo(() =>
    conclaves.find(c => c.id === selectedConclaveId),
    [conclaves, selectedConclaveId]
  );
  const conclaveName = selectedConclave?.name || 'Conclave';

  const isLocked = Boolean(selectedConclave?.isScheduleLocked || selectedConclave?.status?.toLowerCase() === 'locked');

  // Stats state
  const [stats, setStats] = useState(() => {
    const cached = localStorage.getItem('bni_admin_stats_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch { }
    }
    return null;
  });

  useEffect(() => {
    let alive = true;
    async function loadStatsAndMembers() {
      if (!selectedConclaveId) return;
      try {
        let statsData = await api.get(`/admin/conclaves/${selectedConclaveId}/stats`).catch(() => null);
        let allUsers = await api.get('/admin/users').catch(() => []);

        let registeredCount = statsData?.counts?.registered || 0;
        let activeCount = statsData?.counts?.active ?? 0;
        let captainsCount = statsData?.counts?.captains || 0;

        const distinctCatCount = new Set((allUsers || []).map(u => u.category?.trim() || u.businessCategory?.trim()).filter(Boolean)).size || 0;

        const updatedStats = {
          counts: {
            registered: registeredCount,
            active: activeCount,
            captains: captainsCount,
            businessTypes: distinctCatCount
          }
        };
        if (alive) {
          setStats(updatedStats);
          localStorage.setItem('bni_admin_stats_cache', JSON.stringify(updatedStats));
        }
      } catch (err) {
        console.error('Failed to load conclave stats:', err);
      }
    }
    loadStatsAndMembers();
    const interval = setInterval(loadStatsAndMembers, 15000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [selectedConclaveId]);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkedQuality, setCheckedQuality] = useState(false);
  const [checkedEdits, setCheckedEdits] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  useEffect(() => {
    if (isModalOpen) {
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  const isConclaveRunningOrLocked = Boolean(
    selectedConclave && (
      ['running', 'completed', 'locked'].includes((selectedConclave.status || '').toLowerCase()) ||
      Boolean(selectedConclave.scheduleSummary) ||
      Boolean(selectedConclave.schedule)
    )
  );

  const [progress, setProgress] = useState(isConclaveRunningOrLocked ? 100 : 0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(isConclaveRunningOrLocked ? 42 : 0);
  const [processed, setProcessed] = useState(isConclaveRunningOrLocked ? (selectedConclave?.registrationCount || stats?.counts?.registered || 0) : 0);
  const [genStep, setGenStep] = useState('Idle');

  // Backend Conclave Defaults State
  const [conclaveDefaults, setConclaveDefaults] = useState(() => {
    try {
      const cached = localStorage.getItem('bni_conclave_defaults');
      if (cached) return JSON.parse(cached);
    } catch { }
    return { personsPerTable: 7, roundCount: 6 };
  });

  // Parameters
  const [personsPerTable, setPersonsPerTable] = useState(() => conclaveDefaults.personsPerTable || 7);
  const [roundCount, setRoundCount] = useState(() => conclaveDefaults.roundCount || 6);
  const [moveSeconds, setMoveSecondsState] = useState(() => selectedConclave?.moveSeconds || 120);

  // Active sub-tab inside Schedule Generation
  const [activeTab, setActiveTab] = useState('planner'); // 'planner' | 'visual' | 'blueprint'
  const [visualRound, setVisualRound] = useState(1);
  const [tableSearch, setTableSearch] = useState('');

  // Attendee Seating Pool Scope: false = all registered members; true = only members active in the room today
  const [activeOnly, setActiveOnly] = useState(false);

  const registeredAttendees = useMemo(() => {
    return Number(stats?.counts?.registered || selectedConclave?.registrationCount || selectedConclave?.participants?.length || 0);
  }, [stats, selectedConclave]);

  const activeAttendees = useMemo(() => {
    return Number(stats?.counts?.active || 0);
  }, [stats]);

  const effectiveAttendees = activeOnly ? activeAttendees : registeredAttendees;
  const totalAttendees = effectiveAttendees;

  const captainsCount = useMemo(() => {
    return Number(stats?.counts?.captains || selectedConclave?.captainCount || 0);
  }, [stats, selectedConclave]);

  const [targetTableCount, setTargetTableCount] = useState(null);

  const calculatedTableCount = useMemo(() => {
    if (targetTableCount !== null && targetTableCount > 0) {
      return targetTableCount;
    }
    if (totalAttendees <= 0) return selectedConclave?.scheduleSummary?.tableCount || 5;
    return Math.max(1, Math.ceil(totalAttendees / Math.max(2, personsPerTable)));
  }, [targetTableCount, totalAttendees, personsPerTable, selectedConclave]);

  const handleTableCountChange = (newCount) => {
    const targetTables = Math.max(1, Math.min(50, newCount));
    setTargetTableCount(targetTables);
    const count = totalAttendees > 0 ? totalAttendees : 30;
    const newCapacity = Math.max(2, Math.min(12, Math.ceil(count / targetTables)));
    setPersonsPerTable(newCapacity);
  };

  // Track previous conclave ID so we only initialize parameters when changing conclaves
  const prevConclaveIdRef = useRef(null);

  // Sync parameters only when selecting a different conclave
  useEffect(() => {
    if (!selectedConclave) return;

    const isRunning = Boolean(
      ['running', 'completed', 'locked'].includes((selectedConclave.status || '').toLowerCase()) ||
      Boolean(selectedConclave.scheduleSummary) ||
      Boolean(selectedConclave.schedule)
    );
    setProgress(isRunning ? 100 : 0);
    setElapsed(isRunning ? 42 : 0);
    setProcessed(isRunning ? (selectedConclave?.registrationCount || stats?.counts?.registered || 0) : 0);

    // Only populate input parameters when switching to a different conclave or on first load
    if (prevConclaveIdRef.current !== selectedConclave.id) {
      prevConclaveIdRef.current = selectedConclave.id;
      setTargetTableCount(null);
      if (typeof selectedConclave.personsPerTable === 'number') {
        setPersonsPerTable(selectedConclave.personsPerTable);
      } else if (conclaveDefaults.personsPerTable) {
        setPersonsPerTable(conclaveDefaults.personsPerTable);
      }
      if (typeof selectedConclave.roundCount === 'number') {
        setRoundCount(selectedConclave.roundCount);
      } else if (conclaveDefaults.roundCount) {
        setRoundCount(conclaveDefaults.roundCount);
      }
      if (typeof selectedConclave.moveSeconds === 'number') {
        setMoveSecondsState(selectedConclave.moveSeconds);
      }
    }
  }, [selectedConclave?.id, conclaveDefaults]);

  // Round Timing
  const [roundTiming, setRoundTiming] = useState({ bioSeconds: 60, referralSeconds: 30, bufferSeconds: 120 });

  useEffect(() => {
    async function loadBackendDefaults() {
      try {
        const d = await api.get('/admin/settings/conclave-defaults').catch(() => null)
          || await api.get('/app-config').then(r => r?.conclaveDefaults).catch(() => null);
        if (d && typeof d === 'object') {
          setConclaveDefaults(d);
          localStorage.setItem('bni_conclave_defaults', JSON.stringify(d));
          if (!selectedConclave || typeof selectedConclave.personsPerTable !== 'number') {
            setPersonsPerTable(d.personsPerTable || 7);
          }
          if (!selectedConclave || typeof selectedConclave.roundCount !== 'number') {
            setRoundCount(d.roundCount || 6);
          }
        }
        const t = await api.get('/admin/settings/round-timing').catch(() => null)
          || await api.get('/app-config').then(r => r?.roundTiming).catch(() => null);
        if (t && typeof t === 'object') {
          setRoundTiming(t);
        }
      } catch (err) {
        console.warn('Could not load conclave defaults from backend:', err);
      }
    }
    loadBackendDefaults();
  }, [selectedConclaveId, selectedConclave]);

  const [toast, setToast] = useState(null);
  const showToast = (title, desc) => {
    setToast({ title, desc });
    setTimeout(() => setToast(null), 3000);
  };

  const roundLengthSecs = Math.min(8, personsPerTable) * ((roundTiming?.bioSeconds || 60) + (roundTiming?.referralSeconds || 30));

  const saveMoveSeconds = async (secs) => {
    setMoveSecondsState(secs);
    if (!selectedConclaveId) return;
    try {
      await api.patch(`/admin/conclaves/${selectedConclaveId}/move-time`, { moveSeconds: secs });
      try {
        const cached = JSON.parse(localStorage.getItem('bni_admin_conclaves_cache') || '[]');
        if (Array.isArray(cached)) {
          const updated = cached.map(c => c.id === selectedConclaveId ? { ...c, moveSeconds: secs } : c);
          localStorage.setItem('bni_admin_conclaves_cache', JSON.stringify(updated));
        }
      } catch { }
      showToast('Move time saved', `${secs / 60} min between rounds in automatic mode.`);
    } catch (err) {
      showToast('Could not save move time', err.message || 'Please try again.');
    }
  };

  const handleStartGeneration = async () => {
    if (!selectedConclaveId) {
      showToast('Error', 'No conclave selected. Please select a conclave first.');
      return;
    }
    if (activeOnly && activeAttendees === 0) {
      showToast(
        'No Active Members',
        'There are no members currently active in the room. Switch to "All Registered" or wait for members to open the mobile app.'
      );
      return;
    }
    executeScheduleGeneration();
  };

  const executeScheduleGeneration = async () => {
    setProgress(0);
    setElapsed(0);
    setProcessed(0);
    setGenStep('Checking member businesses...');
    setIsGenerating(true);

    let simProgress = 0;
    const simInterval = setInterval(() => {
      simProgress = Math.min(simProgress + 10, 95);
      setProgress(simProgress);
      setElapsed(prev => prev + 1);
      setProcessed(prev => Math.min(prev + 5, effectiveAttendees || 48));
      if (simProgress === 30) setGenStep('Separating members from same chapter...');
      if (simProgress === 60) setGenStep('Balancing tables...');
      if (simProgress === 80) setGenStep('Checking for repeat meetings...');
    }, 250);

    try {
      await api.post(`/admin/conclaves/${selectedConclaveId}/generate-schedule`, {
        activeOnly,
        autoFillCaptains: false,
        personsPerTable,
        roundCount,
        tableCount: calculatedTableCount
      });

      clearInterval(simInterval);

      try {
        const data = await api.get('/admin/conclaves');
        setConclaves(data.map(c => {
          const s = (c.status || '').toLowerCase();
          const hasSched = Boolean(c.scheduleSummary || c.schedule || ['running', 'completed', 'locked'].includes(s));
          return {
            ...c,
            venueShort: (c.venueLocation || c.venue || 'N/A').split(',')[0] || 'N/A',
            dateRange: c.date ? new Date(c.date).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }) : (c.dateRange || 'N/A'),
            progress: hasSched ? 100 : s === 'running' ? 60 : 0
          };
        }));
      } catch (err) {
        console.warn('Refetching conclaves failed:', err);
      }

      setProgress(100);
      setIsGenerating(false);
      setGenStep('Schedule Ready');
      setProcessed(effectiveAttendees || 48);

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      showToast('Schedule Created', 'All tables and members have been arranged.');
    } catch (err) {
      clearInterval(simInterval);
      const msg = err.message || 'Schedule creation failed.';
      console.warn('Schedule creation failed:', msg);

      const isCaptainError = msg.toLowerCase().includes('captain');
      const details = err.details || {};
      if (typeof showGenWarning === 'function') {
        showGenWarning({
          type: isCaptainError ? 'captain' : 'error',
          title: isCaptainError ? 'Need More Table Captains' : 'Could Not Create Schedule',
          message: msg,
          issues: Array.isArray(details.issues) ? details.issues : [],
          warnings: Array.isArray(details.warnings) ? details.warnings : [],
          derived: details.derived || null,
          hint: details.hint || null,
        });
      }

      setIsGenerating(false);
      setProgress(0);
      setGenStep('Idle');
    }
  };

  const handleAbort = () => {
    setIsGenerating(false);
    setProgress(0);
    setGenStep('Stopped');
    showToast('Stopped', 'Schedule creation stopped.');
  };

  const handleConfirmLock = async () => {
    if (isLocking) return;
    setIsLocking(true);
    try {
      await api.post(`/admin/conclaves/${selectedConclaveId}/lock-schedule`);
      const updatedConclaves = conclaves.map(c =>
        c.id === selectedConclaveId
          ? {
            ...c,
            isScheduleLocked: true,
            isRegistrationOpen: false,
            registrationOverride: 'closed',
            status: (c.status === 'Completed' || c.status === 'running') ? c.status : 'registrationClosed'
          }
          : c
      );
      setConclaves(updatedConclaves);
      try {
        localStorage.setItem('bni_schedule_gen_conclaves_cache', JSON.stringify(updatedConclaves));
        localStorage.setItem('bni_conclaves_cache', JSON.stringify(updatedConclaves));
        localStorage.setItem('bni_superadmin_conclaves_cache', JSON.stringify(updatedConclaves));
      } catch { }
      setIsModalOpen(false);
      showToast('Seating Finalized & Locked', 'Table assignments are now locked and visible in the mobile app.');

      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (err) {
      console.error('Backend conclave lock failed:', err.message);
      showToast('Error', err.message || 'Failed to lock seating. Please try again.');
    } finally {
      setIsLocking(false);
    }
  };

  const handleStartRound = async (roundNumber = 1) => {
    if (!selectedConclaveId) return;
    try {
      await api.post(`/admin/conclaves/${selectedConclaveId}/start-round`, { roundNumber });
      showToast('Round 1 Started', 'Round 1 is now in progress.');
      if (typeof onNavigateToRunner === 'function') {
        onNavigateToRunner();
      }
    } catch (err) {
      console.error('Failed to start round:', err.message || err);
      showToast('Start Round Failed', err.message || 'Could not start round.');
    }
  };

  const [showRepeatModal, setShowRepeatModal] = useState(false);

  useEffect(() => {
    if (showRepeatModal) {
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    };
  }, [showRepeatModal]);

  const repeatPairingDetails = useMemo(() => {
    if (!selectedConclave || !selectedConclave.schedule || !selectedConclave.schedule.rounds) {
      return [];
    }

    const participantsList = selectedConclave.participants || [];
    const pairMap = new Map();

    selectedConclave.schedule.rounds.forEach((rd) => {
      const roundNum = rd.round || rd.roundNumber || rd.number;
      (rd.tables || []).forEach((tbl) => {
        const tableNum = tbl.tableNumber || tbl.number;
        const occupants = [];

        if (tbl.captainId !== undefined || Array.isArray(tbl.memberIds)) {
          if (tbl.captainId !== undefined) {
            const capt = participantsList.find(p => p.id === tbl.captainId) || { id: tbl.captainId, name: `Captain ${tbl.captainId}` };
            occupants.push(capt);
          }
          if (Array.isArray(tbl.memberIds)) {
            tbl.memberIds.forEach(mId => {
              const mem = participantsList.find(p => p.id === mId) || { id: mId, name: `Member ${mId}` };
              occupants.push(mem);
            });
          }
        } else {
          const rawMembers = tbl.participants || tbl.members || [];
          const captainObj = tbl.captain || (tbl.captainName ? { name: tbl.captainName, id: tbl.captainId, uid: tbl.captainId } : null);

          occupants.push(...rawMembers);
          if (captainObj) {
            const captId = captainObj.uid || captainObj.id || captainObj.name;
            if (captId && !occupants.some(p => (p.uid || p.id || p.name) === captId)) {
              occupants.unshift(captainObj);
            }
          }
        }

        for (let i = 0; i < occupants.length; i++) {
          for (let j = i + 1; j < occupants.length; j++) {
            const m1 = occupants[i];
            const m2 = occupants[j];
            const u1 = m1.uid || m1.id || m1._originalUid || m1.name;
            const u2 = m2.uid || m2.id || m2._originalUid || m2.name;

            if (u1 === undefined || u2 === undefined || u1 === u2) continue;

            const sorted = [m1, m2].sort((a, b) => String(a.name || a.id || '').localeCompare(String(b.name || b.id || '')));
            const key = `${sorted[0].uid || sorted[0].id || sorted[0].name}_${sorted[1].uid || sorted[1].id || sorted[1].name}`;

            if (!pairMap.has(key)) {
              pairMap.set(key, {
                member1: sorted[0],
                member2: sorted[1],
                occurrences: []
              });
            }

            pairMap.get(key).occurrences.push({
              round: roundNum,
              tableNumber: tableNum
            });
          }
        }
      });
    });

    const repeats = [];
    pairMap.forEach((val) => {
      if (val.occurrences.length > 1) {
        repeats.push(val);
      }
    });

    return repeats;
  }, [selectedConclave]);

  const uniqueMeetingsVal = selectedConclave?.scheduleSummary?.coverage !== undefined
    ? Math.round(selectedConclave.scheduleSummary.coverage * 100)
    : Math.min(100, Math.round(98 - (progress === 100 ? 0 : 2.5)));

  const hasSchedule = Boolean(selectedConclave?.schedule?.rounds?.length);
  const repeatedPairingsVal = hasSchedule
    ? repeatPairingDetails.length
    : (selectedConclave?.scheduleSummary?.repeatPairings !== undefined
      ? selectedConclave.scheduleSummary.repeatPairings
      : 0);

  const diversityVal = selectedConclave?.scheduleSummary?.coverage !== undefined
    ? Math.min(100, Math.round((selectedConclave.scheduleSummary.coverage * 100) - (selectedConclave.scheduleSummary.repeatPairings || 0)))
    : Math.min(100, Math.round(92 - (progress === 100 ? 0 : 3.5)));

  const isConclaveCompleted = Boolean(
    selectedConclave && (
      (selectedConclave.status || '').toLowerCase() === 'completed' ||
      (selectedConclave.status || '').toLowerCase() === 'cancelled'
    )
  );

  // Visual layout round data
  const currentVisualRoundData = useMemo(() => {
    if (!selectedConclave?.schedule?.rounds) return null;
    return selectedConclave.schedule.rounds.find(r => (r.roundNumber || r.round || r.number) === visualRound) || selectedConclave.schedule.rounds[0];
  }, [selectedConclave, visualRound]);

  return (
    <div className={`w-full flex flex-col gap-3.5 animate-fade-in pb-8 sm:pb-10 ${isHubMode ? '' : 'max-w-[1600px] mx-auto'}`}>

      {/* Standalone Header (Rendered only when not embedded in ScheduleHub) */}
      {!isHubMode && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-0.5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight leading-tight">
              Schedule Generation
            </h1>
            <p className="text-xs text-zinc-500 font-semibold mt-0.5">
              {conclaveName} · Create tables and assign members for every round
            </p>
          </div>
        </div>
      )}

      {/* Executive 4-Metric KPI Strip (Feedback UI & Typography) */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 grid grid-cols-2 sm:grid-cols-4">
        {/* Metric 1: Total Members */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">Total Members</span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-zinc-950 tabular-nums">
                {totalAttendees.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-brand-red flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2: Table Captains */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">Table Captains</span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-zinc-950 tabular-nums">{captainsCount}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Total Seats */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">Total Seats</span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-zinc-950 tabular-nums">{calculatedTableCount * personsPerTable}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <LayoutGrid className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4: People You Meet */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">People You Meet</span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-zinc-950 tabular-nums">{Math.max(1, personsPerTable - 1) * roundCount}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#00875A] flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Completed Notice */}
      {isConclaveCompleted && (
        <div className="p-3.5 sm:p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>This conclave is <strong>{formatStatus(selectedConclave?.status)}</strong>. Seating is finalized and locked.</span>
          </div>
          <span className="px-2.5 py-0.5 bg-amber-200/70 rounded-full text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
            Locked
          </span>
        </div>
      )}

      {/* Central Optimization Command Center */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
        {/* Header Row: Title, Status Pill, Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-zinc-950 tracking-tight">
              Schedule Generation
            </h2>
            <p className="text-xs text-zinc-400 font-semibold mt-1">
              Automatically arranges members at different tables each round so people meet new business partners without repeats.
            </p>
          </div>

          {/* Action Button Group */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {isGenerating ? (
              <button
                type="button"
                onClick={handleAbort}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-red text-brand-red hover:bg-red-50/50 text-xs font-black uppercase tracking-wider transition-smooth cursor-pointer"
              >
                <StopCircle className="w-4 h-4" />
                <span>Stop</span>
              </button>
            ) : progress === 100 ? (
              <>
                <button
                  type="button"
                  onClick={handleStartGeneration}
                  disabled={isLocked || isConclaveCompleted}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-250 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-extrabold transition-smooth cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title={
                    isConclaveCompleted
                      ? 'Conclave is completed. Seating is archived and cannot be regenerated.'
                      : isLocked
                        ? 'Schedule is locked. Cannot recreate schedule.'
                        : 'Re-run the seating algorithm to create a new schedule'
                  }
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Create Again</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('visual')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-zinc-250 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-extrabold transition-smooth cursor-pointer shadow-2xs"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-zinc-500" />
                  <span>View Tables</span>
                </button>

                {selectedConclave?.status?.toLowerCase() === 'running' ? (
                  <button
                    type="button"
                    onClick={() => onNavigateToRunner && onNavigateToRunner()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-smooth cursor-pointer shadow-sm animate-pulse"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Round in Progress →</span>
                  </button>
                ) : !isConclaveCompleted && (
                  <button
                    type="button"
                    onClick={() => handleStartRound(1)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-red hover:bg-red-750 text-white text-xs font-black uppercase tracking-wider transition-smooth cursor-pointer shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Round 1 →</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (isLocked) {
                      showToast('Already Locked', 'This conclave is already locked.');
                      return;
                    }
                    setIsModalOpen(true);
                  }}
                  disabled={isLocked || isConclaveCompleted}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-smooth cursor-pointer ${isLocked || isConclaveCompleted
                    ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                    }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isLocked ? 'Schedule Locked' : 'Lock & Finalize'}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleStartGeneration}
                className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-brand-red hover:bg-red-750 text-white text-xs font-black uppercase tracking-wider transition-smooth shadow-sm cursor-pointer"
              >
                <PlayCircle className="w-4.5 h-4.5" />
                <span>Create Schedule</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Center State Body */}
        {isGenerating ? (
          /* State 1: Active Progress */
          <div className="bg-zinc-50/80 border border-zinc-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-zinc-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-brand-red animate-pulse" />
                <span>{genStep}</span>
              </span>
              <span className="font-black text-brand-red">{progress}% complete</span>
            </div>
            <div className="w-full h-3 bg-zinc-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-red rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-1 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-zinc-200">
                <span className="text-[10px] text-zinc-700 font-bold uppercase block">Time Elapsed</span>
                <strong className="text-xs font-black text-zinc-900 mt-0.5 block">00:{elapsed < 10 ? `0${elapsed}` : elapsed}s</strong>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-zinc-200">
                <span className="text-[10px] text-zinc-700 font-bold uppercase block">Members Placed</span>
                <strong className="text-xs font-black text-zinc-900 mt-0.5 block">{processed} / {totalAttendees}</strong>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-zinc-200">
                <span className="text-[10px] text-zinc-700 font-bold uppercase block">Time Remaining</span>
                <strong className="text-xs font-black text-brand-red mt-0.5 block">{Math.ceil((100 - progress) * 0.8)}s</strong>
              </div>
            </div>
          </div>
        ) : progress === 100 ? (
          /* State 2: Generated & Verification Matrix */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Health 1: New Connections */}
              <div className="bg-zinc-50/70 border border-zinc-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-700">New Connections</span>
                  <span className="font-black text-emerald-700">{uniqueMeetingsVal}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${uniqueMeetingsVal}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-400 font-semibold">Goal: Meet different people each round</p>
              </div>

              {/* Health 2: Repeat Meetings */}
              <div className="bg-zinc-50/70 border border-zinc-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-700">Repeat Pairings</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-zinc-950">{repeatedPairingsVal} repeats</span>
                    <button
                      type="button"
                      onClick={() => setShowRepeatModal(true)}
                      className="text-[10.5px] font-black text-brand-red hover:underline cursor-pointer ml-1"
                    >
                      (See Names →)
                    </button>
                  </div>
                </div>
                <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${Math.min(100, (repeatedPairingsVal || 0) * 8)}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-400 font-semibold">Members sitting together more than once</p>
              </div>

              {/* Health 3: Chapter Mixing */}
              <div className="bg-zinc-50/70 border border-zinc-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-700">Chapter Mixing</span>
                  <span className="font-black text-blue-700">{diversityVal}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${diversityVal}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-400 font-semibold">Keeps same-chapter members at different tables</p>
              </div>
            </div>

            {/* Quick summary strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-zinc-600 bg-zinc-50/50 px-4 py-2.5 rounded-lg border border-zinc-200/60">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{roundCount} Rounds Created</span>
              </span>
              <span>·</span>
              <span>{calculatedTableCount} Tables Each Round</span>
              <span>·</span>
              <span>{totalAttendees} Members Seated</span>
              <span>·</span>
              <span>{captainsCount} Captains Assigned</span>
            </div>
          </div>
        ) : (
          /* State 3: Ready for Generation (Readiness Checklist) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-zinc-50/70 border border-zinc-200 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-700 font-bold uppercase block">Seating Pool</span>
                <strong className="text-xs font-black text-zinc-900 mt-0.5 block">
                  {activeOnly ? 'Active in Room' : 'All Registered'}
                </strong>
                <span className="text-[10px] font-semibold text-zinc-500">
                  {totalAttendees} {activeOnly ? 'active members' : 'members'}
                </span>
              </div>
              <span className={`p-1 rounded-full ${activeOnly && activeAttendees === 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {activeOnly && activeAttendees === 0 ? <AlertTriangle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              </span>
            </div>

            <div className="bg-zinc-50/70 border border-zinc-200 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-700 font-bold uppercase block">Table Captains</span>
                <strong className="text-xs font-black text-zinc-900 mt-0.5 block">
                  {captainsCount} / {calculatedTableCount} Tables
                </strong>
                <span className="text-[10px] font-semibold text-zinc-500">
                  {captainsCount >= calculatedTableCount ? 'Captains ready' : 'Need more captains'}
                </span>
              </div>
              {captainsCount >= calculatedTableCount ? (
                <span className="p-1 rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="w-4 h-4" />
                </span>
              ) : (
                <span className="p-1 rounded-full bg-amber-100 text-amber-700">
                  <AlertTriangle className="w-4 h-4" />
                </span>
              )}
            </div>

            <div className="bg-zinc-50/70 border border-zinc-200 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-700 font-bold uppercase block">Extra Seats Available</span>
                <strong className="text-xs font-black text-zinc-900 mt-0.5 block">
                  {Math.max(0, (calculatedTableCount * personsPerTable) - totalAttendees)} Extra Seats
                </strong>
                <span className="text-[10px] font-semibold text-zinc-500">
                  {calculatedTableCount * personsPerTable} total capacity
                </span>
              </div>
              <span className="p-1 rounded-full bg-emerald-100 text-emerald-700">
                <Check className="w-4 h-4" />
              </span>
            </div>

            <div className="bg-zinc-50/70 border border-zinc-200 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-700 font-bold uppercase block">Arrangement Rules</span>
                <strong className="text-xs font-black text-zinc-900 mt-0.5 block">
                  No repeat meetings
                </strong>
                <span className="text-[10px] font-semibold text-zinc-500">
                  Balanced seating
                </span>
              </div>
              <span className="p-1 rounded-full bg-emerald-100 text-emerald-700">
                <Check className="w-4 h-4" />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Segmented Workspace Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('planner')}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-smooth cursor-pointer ${activeTab === 'planner'
            ? 'bg-zinc-900 text-white shadow-xs'
            : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Table Setup</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('visual')}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-smooth cursor-pointer ${activeTab === 'visual'
            ? 'bg-zinc-900 text-white shadow-xs'
            : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Room View</span>
          {hasSchedule && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('blueprint')}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-smooth cursor-pointer ${activeTab === 'blueprint'
            ? 'bg-zinc-900 text-white shadow-xs'
            : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Rounds List</span>
          <span className="px-1.5 py-0.2 bg-zinc-200 text-zinc-700 rounded-full text-[9.5px]">
            {roundCount}
          </span>
        </button>
      </div>

      {/* TAB CONTENT 1: Table Setup */}
      {activeTab === 'planner' && (
        <div className="space-y-4">
          {/* Seating Cohort Banner */}
          <div className="bg-white border border-zinc-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-brand-red shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-xs uppercase tracking-wider text-zinc-950">Seating Pool</span>
                  {activeOnly && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active Only Mode
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
                  {activeOnly
                    ? 'Only seating attendees present in the room who checked in / opened their mobile app today.'
                    : 'Seating all registered attendees enrolled in this conclave.'}
                </p>
              </div>
            </div>

            <div className="flex items-center bg-zinc-100 p-1 rounded-xl gap-1 shrink-0">
              <button
                type="button"
                disabled={isConclaveRunningOrLocked}
                onClick={() => setActiveOnly(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-smooth cursor-pointer disabled:opacity-50 ${!activeOnly
                  ? 'bg-white text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-950'
                  }`}
              >
                All Registered ({registeredAttendees})
              </button>
              <button
                type="button"
                disabled={isConclaveRunningOrLocked}
                onClick={() => setActiveOnly(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-smooth cursor-pointer disabled:opacity-50 ${activeOnly
                  ? 'bg-brand-red text-white shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-950'
                  }`}
              >
                <span className={`w-2 h-2 rounded-full ${activeAttendees > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-300'}`} />
                <span>Active in Room ({activeAttendees})</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Card 1: Tables & Seats */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand-red" />
                  <h3 className="font-black text-xs uppercase tracking-wider text-zinc-900">Tables & Seats</h3>
                </div>
                <span className="text-[10px] font-bold text-zinc-500 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
                  Room Size
                </span>
              </div>

              {/* Stepper: Number of Tables */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-700">Number of Tables</label>
                  <span className="text-[10px] font-bold text-brand-red">
                    {totalAttendees} {activeOnly ? 'active members to seat' : 'members registered'}
                  </span>
                </div>
                <div className="flex items-center bg-zinc-50 border border-zinc-250 rounded-xl p-1">
                  <button
                    type="button"
                    disabled={isConclaveCompleted || calculatedTableCount <= 1}
                    onClick={() => handleTableCountChange(calculatedTableCount - 1)}
                    className="w-8 h-8 rounded-lg bg-white hover:bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 cursor-pointer shadow-2xs"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex-1 text-center font-black text-base text-zinc-950">
                    {calculatedTableCount} <span className="text-xs font-semibold text-zinc-400">Tables</span>
                  </div>
                  <button
                    type="button"
                    disabled={isConclaveCompleted || calculatedTableCount >= 50}
                    onClick={() => handleTableCountChange(calculatedTableCount + 1)}
                    className="w-8 h-8 rounded-lg bg-white hover:bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Quick Table Presets */}
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 pt-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      disabled={isConclaveCompleted}
                      onClick={() => handleTableCountChange(cnt)}
                      className={`py-1 rounded-md text-[10.5px] font-bold border transition-smooth cursor-pointer text-center ${calculatedTableCount === cnt
                        ? 'bg-brand-red text-white border-brand-red shadow-2xs'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900'
                        }`}
                    >
                      {cnt}T
                    </button>
                  ))}
                </div>
              </div>

              {/* Stepper: Seats Per Table */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-baseline">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-700">Seats at Each Table</label>
                  <span className="text-[10px] font-bold text-emerald-700">{Math.max(1, personsPerTable - 1)} Members + 1 Captain</span>
                </div>
                <div className="flex items-center bg-zinc-50 border border-zinc-250 rounded-xl p-1">
                  <button
                    type="button"
                    disabled={isConclaveCompleted || personsPerTable <= 2}
                    onClick={() => {
                      setTargetTableCount(null);
                      setPersonsPerTable(prev => Math.max(2, prev - 1));
                    }}
                    className="w-8 h-8 rounded-lg bg-white hover:bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 cursor-pointer shadow-2xs"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex-1 text-center font-black text-base text-zinc-950">
                    {personsPerTable} <span className="text-xs font-semibold text-zinc-400">Seats</span>
                  </div>
                  <button
                    type="button"
                    disabled={isConclaveCompleted || personsPerTable >= 12}
                    onClick={() => {
                      setTargetTableCount(null);
                      setPersonsPerTable(prev => Math.min(12, prev + 1));
                    }}
                    className="w-8 h-8 rounded-lg bg-white hover:bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Visual Seat Dots */}
                <div className="flex items-center justify-center gap-1.5 pt-1.5">
                  {Array.from({ length: Math.min(12, personsPerTable) }).map((_, sIdx) => (
                    <span
                      key={sIdx}
                      className={`w-2 h-2 rounded-full ${sIdx === 0 ? 'bg-brand-red ring-2 ring-red-200' : 'bg-zinc-300'}`}
                      title={sIdx === 0 ? 'Table Captain' : `Member ${sIdx}`}
                    />
                  ))}
                </div>
              </div>

              {/* Capacity Reach Summary */}
              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200/80 text-[11px] text-zinc-600 space-y-1">
                <p className="font-bold text-zinc-900">
                  Total Seats: {calculatedTableCount * personsPerTable}
                </p>
                <p>
                  You have {totalAttendees} registered members, leaving{' '}
                  <strong className="text-emerald-700 font-bold">
                    {Math.max(0, (calculatedTableCount * personsPerTable) - totalAttendees)} extra seats
                  </strong>{' '}
                  for guests or walk-ins.
                </p>
              </div>
            </div>

            {/* Card 2: Rounds & Timing */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-red" />
                  <h3 className="font-black text-xs uppercase tracking-wider text-zinc-900">Rounds & Timing</h3>
                </div>
                <span className="text-[10px] font-bold text-zinc-500 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
                  Schedule
                </span>
              </div>

              {/* Total Rounds Stepper */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-700">Total Rounds</label>
                  <span className="text-[10px] font-bold text-zinc-400">Number of rounds</span>
                </div>
                <div className="flex items-center bg-zinc-50 border border-zinc-250 rounded-xl p-1">
                  <button
                    type="button"
                    disabled={isConclaveCompleted || roundCount <= 1}
                    onClick={() => setRoundCount(prev => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-lg bg-white hover:bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 cursor-pointer shadow-2xs"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex-1 text-center font-black text-base text-zinc-950">
                    {roundCount} <span className="text-xs font-semibold text-zinc-400">Rounds</span>
                  </div>
                  <button
                    type="button"
                    disabled={isConclaveCompleted || roundCount >= 20}
                    onClick={() => setRoundCount(prev => Math.min(20, prev + 1))}
                    className="w-8 h-8 rounded-lg bg-white hover:bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-xs transition-smooth disabled:opacity-40 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Round Length (Fixed Formula) */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-700">Round Time</label>
                <div className="bg-zinc-50 border border-zinc-250 rounded-xl px-3.5 py-2.5">
                  <p className="font-black text-base text-zinc-950">{Math.round(roundLengthSecs / 60 * 10) / 10} min per round</p>
                  <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">
                    1 min introduction + 30s referral ask per member at the table.
                  </p>
                </div>
              </div>

              {/* Move Time Between Rounds */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-700">Break Between Rounds (to change tables)</label>
                <div className="flex gap-2">
                  {[60, 120, 300].map(secs => (
                    <button
                      key={secs}
                      type="button"
                      disabled={isConclaveCompleted}
                      onClick={() => saveMoveSeconds(secs)}
                      className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-smooth cursor-pointer disabled:opacity-40 ${moveSeconds === secs
                        ? 'bg-brand-red border-brand-red text-white'
                        : 'bg-white border-zinc-250 text-zinc-700 hover:bg-zinc-50'
                        }`}
                    >
                      {secs / 60} min
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-semibold text-zinc-400">Time allowed for members to walk to their next table.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: Room View */}
      {activeTab === 'visual' && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 space-y-5 shadow-2xs">
          {/* Visual Bar Header with Round Switcher & Search */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
            <div>
              <h3 className="font-black text-base text-zinc-950">Table Seating View</h3>
              <p className="text-xs text-zinc-400 font-semibold mt-0.5">
                {hasSchedule
                  ? `Table seating for Round ${visualRound}. Search by member name, business, or table number.`
                  : `Room layout: ${calculatedTableCount} tables for ${totalAttendees} members.`}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Attendee & Table Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search member name, business, or table..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full pl-8.5 pr-8 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-brand-red transition-smooth"
                />
                {tableSearch && (
                  <button
                    type="button"
                    onClick={() => setTableSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {hasSchedule && (
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700 mr-1">Round:</span>
                  {Array.from({ length: roundCount }).map((_, rIdx) => {
                    const rNum = rIdx + 1;
                    return (
                      <button
                        key={rNum}
                        type="button"
                        onClick={() => setVisualRound(rNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-black transition-smooth cursor-pointer ${visualRound === rNum
                          ? 'bg-brand-red text-white shadow-2xs'
                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                          }`}
                      >
                        {rNum}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Visual Table Grid */}
          {(() => {
            const query = tableSearch.toLowerCase().trim();
            const allTables = Array.from({ length: calculatedTableCount }).map((_, tblIdx) => {
              const tableNum = tblIdx + 1;
              const scheduledTable = currentVisualRoundData?.tables?.find(t => (t.tableNumber || t.number) === tableNum);

              const captain = scheduledTable
                ? (selectedConclave?.participants || []).find(p => p.id === scheduledTable.captainId) || { name: scheduledTable.captainName || `Captain ${tableNum}` }
                : null;

              const seatedMembers = scheduledTable && Array.isArray(scheduledTable.memberIds)
                ? scheduledTable.memberIds.map(mId => (selectedConclave?.participants || []).find(p => p.id === mId) || { name: `Member ${mId}` })
                : [];

              const captainCat = captain?.category || captain?.businessCategory || '';
              const allCats = [captainCat, ...seatedMembers.map(m => m.category || m.businessCategory || '')].filter(Boolean).map(c => c.trim().toLowerCase());
              const hasCategoryConflict = allCats.length !== new Set(allCats).size;

              const matches = !query ||
                tableNum.toString() === query ||
                `table ${tableNum}`.includes(query) ||
                (captain?.name || '').toLowerCase().includes(query) ||
                captainCat.toLowerCase().includes(query) ||
                seatedMembers.some(m =>
                  (m.name || '').toLowerCase().includes(query) ||
                  (m.category || m.businessCategory || '').toLowerCase().includes(query)
                );

              return {
                tableNum,
                captain,
                seatedMembers,
                hasCategoryConflict,
                matches
              };
            });

            const visibleTables = allTables.filter(t => t.matches);

            if (visibleTables.length === 0) {
              return (
                <div className="p-8 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200 space-y-2">
                  <p className="text-xs font-bold text-zinc-500">No tables matching "{tableSearch}" in Round {visualRound}.</p>
                  <button
                    type="button"
                    onClick={() => setTableSearch('')}
                    className="text-xs font-extrabold text-brand-red hover:underline cursor-pointer"
                  >
                    Clear Search
                  </button>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleTables.map(({ tableNum, captain, seatedMembers, hasCategoryConflict }) => (
                  <div
                    key={tableNum}
                    className={`bg-zinc-50/60 border rounded-xl p-4 space-y-3 transition-smooth ${query && tableSearch ? 'border-brand-red/40 ring-2 ring-brand-red/10 bg-white' : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                  >
                    {/* Table Card Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-zinc-900 text-white font-black text-xs flex items-center justify-center">
                          {tableNum}
                        </span>
                        <strong className="text-xs font-black text-zinc-900">Table {tableNum}</strong>
                        {hasCategoryConflict && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[8.5px] font-black uppercase">
                            Same Business
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-zinc-500 bg-white px-2 py-0.5 rounded border border-zinc-200">
                        {personsPerTable} Seats
                      </span>
                    </div>

                    {/* Captain Slot */}
                    <div className="bg-red-50/70 border border-brand-red/20 rounded-lg p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <Award className="w-4 h-4 text-brand-red shrink-0" />
                        <div className="truncate">
                          <span className="text-[9px] font-black uppercase tracking-wider text-brand-red block leading-none">Table Captain</span>
                          <span className="text-xs font-black text-zinc-900 truncate block mt-0.5">
                            {captain?.name || `Assigned Captain ${tableNum}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Seated Members Preview */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[9.5px] font-bold text-zinc-700 uppercase tracking-wider block">
                        Members at this Table ({seatedMembers.length ? seatedMembers.length : Math.max(1, personsPerTable - 1)})
                      </span>
                      {seatedMembers.length > 0 ? (
                        <div className="space-y-1">
                          {seatedMembers.map((m, mIdx) => (
                            <div key={mIdx} className="bg-white p-1.5 rounded-md border border-zinc-200/70 text-[11px] font-bold text-zinc-800 flex items-center justify-between truncate">
                              <span className="truncate">{m.name || `Member ${mIdx + 1}`}</span>
                              <span className="text-[9.5px] font-semibold text-zinc-400 truncate ml-1">{m.category || m.businessCategory || ''}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5">
                          {Array.from({ length: Math.max(1, personsPerTable - 1) }).map((_, mIdx) => (
                            <div key={mIdx} className="bg-white/80 p-1.5 rounded-md border border-dashed border-zinc-200 text-[10px] text-zinc-400 font-semibold text-center">
                              Seat {mIdx + 2}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB CONTENT 3: Rounds List */}
      {activeTab === 'blueprint' && (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-2xs overflow-hidden">
          {/* Table Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-200 bg-zinc-50/50">
            <div>
              <h3 className="font-black text-zinc-950 text-base tracking-tight">Rounds Overview</h3>
              <p className="text-xs text-zinc-400 font-semibold mt-0.5">Table count, seated members, and status for each round</p>
            </div>
            <span className="px-3 py-1 bg-white border border-zinc-200 rounded-full text-[10px] font-black uppercase tracking-wider text-zinc-700 shadow-2xs">
              {roundCount} Rounds Created
            </span>
          </div>

          {/* Clean, Dense Table Layout */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80 text-[10px] font-black uppercase tracking-wider text-zinc-700">
                  <th className="py-3 px-5">Round</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tables</th>
                  <th className="py-3 px-4">Members</th>
                  <th className="py-3 px-4">Captains</th>
                  <th className="py-3 px-4">Seat Usage</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-semibold text-zinc-700">
                {Array.from({ length: roundCount }).map((_, idx) => {
                  const roundNum = idx + 1;
                  const currentRound = selectedConclave?.currentRound || 0;
                  let roundStatus = 'SCHEDULED';
                  let isRoundCompleted = false;
                  let isRoundActive = false;

                  if (progress < 100) {
                    roundStatus = roundNum === 1 ? 'GENERATING...' : 'QUEUED';
                  } else if (isConclaveCompleted) {
                    roundStatus = 'COMPLETED';
                    isRoundCompleted = true;
                  } else if (currentRound === 0) {
                    roundStatus = 'SCHEDULED';
                  } else if (roundNum < currentRound) {
                    roundStatus = 'COMPLETED';
                    isRoundCompleted = true;
                  } else if (roundNum === currentRound) {
                    roundStatus = 'ACTIVE';
                    isRoundActive = true;
                  } else {
                    roundStatus = 'SCHEDULED';
                  }

                  const totalTables = calculatedTableCount;
                  const totalMembers = totalAttendees;

                  return (
                    <tr key={roundNum} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-black text-zinc-950">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-zinc-100 flex items-center justify-center text-xs font-black text-zinc-800">
                            {roundNum}
                          </span>
                          <span>Round {roundNum}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider border ${isRoundCompleted
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : isRoundActive
                            ? 'bg-red-50 text-brand-red border-red-200 animate-pulse'
                            : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isRoundCompleted ? 'bg-emerald-500' : isRoundActive ? 'bg-brand-red' : 'bg-zinc-400'}`} />
                          {roundStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-black text-zinc-900">{totalTables} Tables</td>
                      <td className="py-3.5 px-4 font-black text-zinc-900">{totalMembers.toLocaleString()} Members</td>
                      <td className="py-3.5 px-4 font-bold text-zinc-600">{captainsCount} Captains</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5 max-w-[160px]">
                          <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/50">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progress === 100 ? 100 : progress}%` }} />
                          </div>
                          <span className="text-[10px] font-black text-zinc-600">{progress === 100 ? '100%' : `${progress}%`}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {onScheduleReady && progress === 100 ? (
                          <button
                            type="button"
                            onClick={onScheduleReady}
                            className="inline-flex items-center gap-1 text-xs font-black text-brand-red hover:text-red-750 cursor-pointer"
                          >
                            <span>View Tables</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-zinc-400 text-xs font-semibold">Configured</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONFIRM LOCK MODAL OVERLAY */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white rounded-2xl border border-zinc-100 shadow-2xl overflow-hidden animate-scale-up">

            <div className="p-5 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-brand-red" />
              <h3 className="font-extrabold text-zinc-900 text-sm">Lock & Finalize Seating</h3>
            </div>

            <div className="p-5 space-y-4 text-xs font-semibold text-zinc-600">
              <p className="leading-relaxed text-[12.5px]">
                You are about to lock the seating arrangement for <strong className="text-zinc-950 font-extrabold">{conclaveName}</strong>.
                Once locked, the schedule is final and members will see their assigned tables in the mobile app.
              </p>

              <div className="bg-red-50/50 border-l-4 border-brand-red p-3 text-[11px] text-zinc-700 italic rounded-r-lg">
                "Table assignments will be sent to the mobile app and table captains."
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checkedQuality}
                    onChange={(e) => setCheckedQuality(e.target.checked)}
                    className="w-4.5 h-4.5 text-brand-red border-zinc-300 rounded focus:ring-brand-red cursor-pointer accent-brand-red"
                  />
                  <span className="text-[11px] text-zinc-600 font-bold">I have reviewed the tables and seating arrangement.</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checkedEdits}
                    onChange={(e) => setCheckedEdits(e.target.checked)}
                    className="w-4.5 h-4.5 text-brand-red border-zinc-300 rounded focus:ring-brand-red cursor-pointer accent-brand-red"
                  />
                  <span className="text-[11px] text-zinc-600 font-bold">I understand seating will be locked and cannot be changed.</span>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={isLocking}
                onClick={() => {
                  if (isLocking) return;
                  setIsModalOpen(false);
                  setCheckedQuality(false);
                  setCheckedEdits(false);
                }}
                className="px-4 py-2 border border-zinc-200 bg-white text-zinc-700 text-xs font-bold rounded-xl hover:bg-zinc-50 transition-smooth cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLocking || !(checkedQuality && checkedEdits)}
                onClick={handleConfirmLock}
                className="inline-flex items-center gap-2 px-5 py-2 bg-brand-red hover:bg-red-750 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm transition-smooth cursor-pointer"
              >
                {isLocking ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Locking Seating...</span>
                  </>
                ) : (
                  <span>Lock Seating</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Repeat Pairings Audit Modal */}
      {showRepeatModal && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl space-y-5 border border-zinc-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 shrink-0">
              <div>
                <h3 className="text-base font-black text-zinc-900">Repeat Meetings List</h3>
                <p className="text-[11px] text-zinc-400 font-medium">Members sitting together at the same table more than once</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRepeatModal(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-smooth cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1 flex-1">
              {repeatPairingDetails.length === 0 ? (
                <div className="p-8 text-center bg-emerald-50/40 rounded-xl border border-emerald-100 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto font-black text-lg">✓</div>
                  <h4 className="text-sm font-extrabold text-emerald-900">No Repeat Meetings!</h4>
                  <p className="text-[11px] text-emerald-700">Every member will meet completely different people in every single round.</p>
                </div>
              ) : (
                repeatPairingDetails.map((pair, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-brand-red bg-red-50 px-2 py-0.5 rounded border border-brand-red/10">
                        Sitting Together {pair.occurrences.length} Times
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-2xs">
                        <p className="text-[12px] font-black text-zinc-800 truncate">{pair.member1.name}</p>
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5">{pair.member1.company || pair.member1.businessCategory || 'Member 1'}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-2xs">
                        <p className="text-[12px] font-black text-zinc-800 truncate">{pair.member2.name}</p>
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5">{pair.member2.company || pair.member2.businessCategory || 'Member 2'}</p>
                      </div>
                    </div>
                    <div className="text-[10.5px] text-zinc-500 font-medium pt-1">
                      <span className="font-bold text-zinc-700">Tables: </span>
                      {pair.occurrences.map(o => `Round ${o.round} (Table ${o.tableNumber})`).join(' & ')}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 text-right shrink-0">
              <button
                type="button"
                onClick={() => setShowRepeatModal(false)}
                className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-xs rounded-xl transition-smooth cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[70] bg-zinc-900 text-white text-[11px] font-bold py-2.5 px-4 rounded-xl shadow-xl flex items-center gap-3 border border-zinc-800 animate-slide-up">
          <div>
            <p className="font-bold">{toast.title}</p>
            <p className="text-zinc-400 font-semibold mt-0.5">{toast.desc}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-white opacity-40 hover:opacity-100 ml-2 animate-none cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}
